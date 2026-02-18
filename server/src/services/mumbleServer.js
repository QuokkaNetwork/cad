/**
 * Managed Mumble Server (rust-mumble)
 *
 * When MUMBLE_MANAGE=true in .env, the CAD server spawns and supervises
 * rust-mumble — a Rust implementation of the Mumble protocol built
 * specifically for FiveM external voice.
 *
 * Binary: server/murmur/rust-mumble.exe (Windows) or rust-mumble (Linux)
 * Releases: https://github.com/AvarianKnight/rust-mumble/releases
 *
 * Unlike classic Murmur, rust-mumble requires no SQLite database, no .ini
 * file, and no ACL patches — it is configured entirely via command-line flags
 * and handles FiveM voice targets (MumbleAddVoiceTargetChannel etc.) natively.
 *
 * Falls back to legacy murmur.exe / mumble-server.exe automatically if
 * rust-mumble.exe is not yet present in server/murmur/.
 */

const { spawn, execSync } = require('child_process');
const fs     = require('fs');
const net    = require('net');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');

const IS_WINDOWS = os.platform() === 'win32';

// Binary search order — rust-mumble is preferred, legacy murmur.exe is fallback
const WINDOWS_BUNDLED_CANDIDATES = [
  path.join(__dirname, '../../murmur/rust-mumble.exe'),
  path.join(__dirname, '../../murmur/murmur.exe'),
  path.join(__dirname, '../../murmur/mumble-server.exe'),
];
const LINUX_CANDIDATES = [
  path.join(__dirname, '../../murmur/rust-mumble'),
  '/usr/local/bin/rust-mumble',
  '/usr/sbin/murmurd',
  '/usr/sbin/mumble-server',
  '/usr/bin/murmurd',
  '/usr/bin/mumble-server',
  'murmurd',
  'mumble-server',
];

// Alternative ports to try if the primary port is taken
const PORT_FALLBACK_OFFSETS = [1, 2, 3, 4, 5];

let murmurProcess = null;
let shuttingDown  = false;
let restartTimer  = null;
let activePort    = null;

function parseBool(value, fallback = false) {
  const v = String(value ?? '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  return fallback;
}

function isManagedEnabled() {
  return parseBool(process.env.MUMBLE_MANAGE, false);
}

function getMumblePort() {
  return parseInt(process.env.MUMBLE_PORT || '64738', 10) || 64738;
}

function getMumblePassword() {
  return String(process.env.MUMBLE_PASSWORD || '').trim();
}

/**
 * Generate (or reuse) a stable HTTP API password for rust-mumble.
 * Stored in data/rust-mumble-http-password.txt so it survives restarts.
 */
function getOrCreateHttpPassword() {
  const dataDir = path.join(__dirname, '../../data');
  const pwFile  = path.join(dataDir, 'rust-mumble-http-password.txt');
  if (fs.existsSync(pwFile)) {
    const pw = fs.readFileSync(pwFile, 'utf8').trim();
    if (pw) return pw;
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const pw = crypto.randomBytes(24).toString('base64');
  fs.writeFileSync(pwFile, pw, 'utf8');
  return pw;
}

function findMurmurBinary() {
  const candidates = IS_WINDOWS ? WINDOWS_BUNDLED_CANDIDATES : LINUX_CANDIDATES;
  for (const p of candidates) {
    // On Windows, executability check is unreliable — just check existence
    if (IS_WINDOWS) {
      if (fs.existsSync(p)) return p;
    } else {
      try {
        fs.accessSync(p, fs.constants.X_OK);
        return p;
      } catch {
        // Try next
      }
    }
  }
  return null;
}

function isRustMumble(binaryPath) {
  return binaryPath && path.basename(binaryPath).toLowerCase().startsWith('rust-mumble');
}

/**
 * Check whether a TCP port is free by attempting to bind to it.
 */
function isPortFree(port) {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(); resolve(true); });
    srv.listen(port, '0.0.0.0');
  });
}

/**
 * On Windows, try to stop any Murmur/MumbleServer Windows Service
 * that may be holding the Mumble port.
 */
function tryStopMumbleWindowsService() {
  if (!IS_WINDOWS) return false;

  const serviceNames = ['MumbleServer', 'Murmur', 'mumble-server', 'murmurd'];
  for (const name of serviceNames) {
    try {
      execSync(`sc query "${name}"`, { stdio: 'ignore', timeout: 5000 });
      console.warn(`[MumbleServer] Found conflicting Windows service: "${name}"`);
      console.warn(`[MumbleServer] Attempting to stop service "${name}"...`);
      try {
        execSync(`sc stop "${name}"`, { stdio: 'ignore', timeout: 10000 });
        console.log(`[MumbleServer] Service "${name}" stopped.`);
        return true;
      } catch {
        console.warn(`[MumbleServer] Could not stop service "${name}" (may need Administrator rights).`);
        console.warn(`[MumbleServer] Run this manually: sc stop "${name}"`);
      }
    } catch {
      // Service doesn't exist — try next name
    }
  }
  return false;
}

/**
 * Find a free port starting from the configured port.
 */
async function findFreePort() {
  const preferredPort = getMumblePort();

  if (await isPortFree(preferredPort)) {
    return preferredPort;
  }

  console.warn(`[MumbleServer] ⚠️  Port ${preferredPort} is already in use!`);
  console.warn(`[MumbleServer]    Attempting to stop conflicting Murmur Windows service...`);

  const stopped = tryStopMumbleWindowsService();
  if (stopped) {
    await new Promise(r => setTimeout(r, 3000));
    if (await isPortFree(preferredPort)) {
      console.log(`[MumbleServer] ✓ Port ${preferredPort} is now free.`);
      return preferredPort;
    }
  }

  console.warn(`[MumbleServer] Trying fallback ports...`);
  for (const offset of PORT_FALLBACK_OFFSETS) {
    const candidate = preferredPort + offset;
    if (await isPortFree(candidate)) {
      console.warn(`[MumbleServer] ⚠️  Using fallback port ${candidate} instead of ${preferredPort}.`);
      console.warn(`[MumbleServer]    UPDATE voice_externalPort in voice.cfg to ${candidate} and restart FiveM!`);
      return candidate;
    }
  }

  console.error(`[MumbleServer] ✗ Could not find a free port in range ${preferredPort}–${preferredPort + PORT_FALLBACK_OFFSETS.slice(-1)[0]}`);
  return null;
}

/**
 * Build the argument list for rust-mumble.
 * Configured entirely via CLI flags — no .ini file needed.
 */
function buildRustMumbleArgs(port) {
  if (getMumblePassword()) {
    console.warn('[MumbleServer] Note: MUMBLE_PASSWORD is set but rust-mumble does not currently');
    console.warn('[MumbleServer] support a server connection password. Leave it blank for now.');
  }

  // NOTE: Do NOT pass --restrict-to-version CitizenFX here.
  // That flag causes rust-mumble to reject (or warn about) non-FiveM clients,
  // which breaks the CAD voice bridge (mumble-node identifies as 'mumble.js').
  // Without it, rust-mumble accepts all clients — FiveM players and CAD dispatchers alike.
  return [
    '--listen',       `0.0.0.0:${port}`,
    '--http-listen',  `127.0.0.1:8586`,
    '--http-password', getOrCreateHttpPassword(),
  ];
}

/**
 * Build the argument list for legacy Murmur (murmur.exe / mumble-server).
 */
function buildLegacyMurmurArgs(port) {
  const dataDir = path.join(__dirname, '../../data');
  const iniPath = path.join(dataDir, 'murmur.ini');
  const dbPath  = path.join(dataDir, 'mumble-server.sqlite').replace(/\\/g, '/');
  const logPath = path.join(dataDir, 'murmur.log').replace(/\\/g, '/');
  const password = getMumblePassword();

  const lines = [
    '[murmur]',
    `host=0.0.0.0`,
    `port=${port}`,
    `database=${dbPath}`,
    `logfile=${logPath}`,
    'logdays=7',
    'users=200',
    'registerName=CAD Voice',
    'ice=', 'dbus=', 'welcometext=',
    password ? `serverpassword=${password}` : '',
    'bandwidth=72000', 'timeout=30',
    'sslCert=', 'sslKey=',
    'opusthreshold=0',
    'rememberchannel=false',
    'autobanAttempts=0', 'autobanTimeframe=0', 'autobanTime=0',
  ].filter(Boolean);

  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(iniPath, lines.join('\n') + '\n', 'utf8');
  return IS_WINDOWS ? ['-ini', iniPath] : ['-ini', iniPath, '-fg'];
}

function spawnMurmur(port) {
  if (shuttingDown) return;

  const binary = findMurmurBinary();
  if (!binary) {
    console.error('[MumbleServer] ✗ No voice server binary found.');
    console.error('[MumbleServer]   Download rust-mumble.exe from:');
    console.error('[MumbleServer]   https://github.com/AvarianKnight/rust-mumble/releases');
    console.error('[MumbleServer]   and place it in server/murmur/rust-mumble.exe');
    return;
  }

  const useRust = isRustMumble(binary);
  const args = useRust ? buildRustMumbleArgs(port) : buildLegacyMurmurArgs(port);

  if (useRust) {
    console.log(`[MumbleServer] Starting rust-mumble: ${binary}`);
  } else {
    console.warn(`[MumbleServer] ⚠️  rust-mumble.exe not found — falling back to legacy Murmur.`);
    console.warn(`[MumbleServer]    Download rust-mumble.exe from:`);
    console.warn(`[MumbleServer]    https://github.com/AvarianKnight/rust-mumble/releases`);
    console.log(`[MumbleServer] Starting legacy Murmur: ${binary}`);
  }

  murmurProcess = spawn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });

  murmurProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.log(`[Murmur] ${text}`);
  });

  murmurProcess.stderr.on('data', (data) => {
    const text = data.toString().trim();
    if (text) console.warn(`[Murmur] ${text}`);
  });

  murmurProcess.on('exit', (code, signal) => {
    murmurProcess = null;
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.warn(`[MumbleServer] Voice server exited (${reason}). Restarting in 5 seconds...`);
    restartTimer = setTimeout(() => spawnMurmur(port), 5000);
  });

  murmurProcess.on('error', (err) => {
    console.error('[MumbleServer] Failed to start voice server:', err.message);
    murmurProcess = null;
    if (!shuttingDown) {
      restartTimer = setTimeout(() => spawnMurmur(port), 10000);
    }
  });

  activePort = port;
  console.log(`[MumbleServer] Voice server started (PID ${murmurProcess.pid}) on 0.0.0.0:${port}`);

  if (port !== getMumblePort()) {
    console.warn(`[MumbleServer] ⚠️  Voice server is on port ${port}, NOT the configured ${getMumblePort()}.`);
    console.warn(`[MumbleServer]    Set voice_externalPort "${port}" in voice.cfg and restart FiveM!`);
  }
}

function stopMurmur() {
  shuttingDown = true;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (!murmurProcess) return;
  console.log('[MumbleServer] Stopping voice server...');
  try { murmurProcess.kill(); } catch {}
  murmurProcess = null;
}

/**
 * Start the managed voice server.
 * With rust-mumble: just find a free port and launch — no DB init needed.
 * With legacy Murmur: falls back to old .ini + ACL patch path.
 */
async function startMumbleServer() {
  if (!isManagedEnabled()) {
    console.log('[MumbleServer] MUMBLE_MANAGE not enabled — skipping managed voice server');
    return;
  }

  const port = await findFreePort();
  if (!port) {
    console.error('[MumbleServer] ✗ Cannot start voice server — no free port available.');
    return;
  }

  const binary = findMurmurBinary();

  // Legacy Murmur path: need ACL patch before starting
  if (binary && !isRustMumble(binary)) {
    await startLegacyMurmur(port, binary);
    return;
  }

  // rust-mumble path: simple direct launch, no DB or ACL setup needed
  shuttingDown = false;
  spawnMurmur(port);
}

/**
 * Legacy Murmur startup — kept for backwards compatibility if rust-mumble.exe
 * has not yet been placed in server/murmur/.
 */
async function startLegacyMurmur(port, binary) {
  const dbPath = path.join(__dirname, '../../data/mumble-server.sqlite');

  if (fs.existsSync(dbPath)) {
    console.log('[MumbleServer] Existing DB found — checking ACL...');
    if (!isLegacyAclPatched(dbPath)) {
      console.log('[MumbleServer] Patching ACL...');
      patchLegacyMurmurAcl(dbPath);
    } else {
      console.log('[MumbleServer] ACL already correct');
    }
    logLegacyAcl(dbPath);
    shuttingDown = false;
    spawnMurmur(port);
    console.log('[MumbleServer] Legacy Murmur running with proximity voice ACLs');
    return;
  }

  // First boot: need to let Murmur create its DB, then patch it
  console.log('[MumbleServer] First boot — initializing DB on 127.0.0.1...');
  shuttingDown = true;

  const dataDir = path.join(__dirname, '../../data');
  const iniPath = path.join(dataDir, 'murmur-init.ini');
  const initLines = [
    '[murmur]', `host=127.0.0.1`, `port=${port}`,
    `database=${path.join(dataDir, 'mumble-server.sqlite').replace(/\\/g, '/')}`,
    `logfile=${path.join(dataDir, 'murmur.log').replace(/\\/g, '/')}`,
    'users=200', 'ice=', 'dbus=', 'welcometext=',
    'autobanAttempts=0', 'autobanTimeframe=0', 'autobanTime=0',
  ];
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(iniPath, initLines.join('\n') + '\n', 'utf8');

  const initArgs = IS_WINDOWS ? ['-ini', iniPath] : ['-ini', iniPath, '-fg'];
  const initProc = spawn(binary, initArgs, { stdio: ['ignore', 'pipe', 'pipe'], detached: false, windowsHide: true });
  initProc.stdout.on('data', d => { const t = d.toString().trim(); if (t) console.log(`[Murmur] ${t}`); });
  initProc.stderr.on('data', d => { const t = d.toString().trim(); if (t) console.warn(`[Murmur] ${t}`); });
  console.log(`[MumbleServer] Init Murmur started (PID ${initProc.pid})`);

  const deadline = Date.now() + 20000;
  let dbReady = false;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1000));
    if (!fs.existsSync(dbPath)) continue;
    try {
      const Database = require('better-sqlite3');
      const checkDb = new Database(dbPath, { readonly: true });
      const t = checkDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='acl'`).get();
      checkDb.close();
      if (t) { dbReady = true; break; }
    } catch { /* not readable yet */ }
  }

  console.log('[MumbleServer] Stopping init Murmur...');
  try { initProc.kill(); } catch {}
  await new Promise(resolve => {
    if (initProc.exitCode !== null) { resolve(); return; }
    initProc.once('exit', resolve);
    setTimeout(resolve, 3000);
  });
  await new Promise(r => setTimeout(r, 500));

  if (dbReady) {
    console.log('[MumbleServer] DB ready — patching ACL...');
    patchLegacyMurmurAcl(dbPath);
    logLegacyAcl(dbPath);
  } else {
    console.warn('[MumbleServer] DB never initialized — proximity voice may not work');
  }

  shuttingDown = false;
  spawnMurmur(port);
}

// ── Legacy Murmur ACL helpers (kept for fallback path) ──────────────────────

function isLegacyAclPatched(dbPath) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const cols = db.prepare(`PRAGMA table_info(acl)`).all().map(c => c.name);
    const isV15 = cols.includes('granted_flags');
    let patched = false;
    if (isV15) {
      const row = db.prepare(`SELECT granted_flags FROM acl WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).get();
      patched = row && (row.granted_flags & 0x400) !== 0;
    } else {
      const row = db.prepare(`SELECT grantpriv FROM acl WHERE server_id=1 AND channel_id=0 AND group_name='all'`).get();
      patched = row && (row.grantpriv & 0x400) !== 0;
    }
    db.close();
    return patched;
  } catch {
    return false;
  }
}

function patchLegacyMurmurAcl(dbPath) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);
    const cols = db.prepare(`PRAGMA table_info(acl)`).all().map(c => c.name);
    const isV15 = cols.includes('granted_flags');
    const GRANT_BITS = 0x400 | 0x4 | 0x2;

    if (isV15) {
      const existing = db.prepare(`SELECT rowid, granted_flags FROM acl WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).get();
      if (existing) {
        db.prepare(`UPDATE acl SET granted_flags = granted_flags | ?, apply_in_sub = 1 WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).run(GRANT_BITS);
      } else {
        db.prepare(`INSERT INTO acl (server_id, channel_id, priority, aff_user_id, aff_group_id, aff_meta_group_id, apply_in_current, apply_in_sub, granted_flags, revoked_flags) VALUES (1, 0, 1000, NULL, 'all', NULL, 1, 1, ?, 0)`).run(GRANT_BITS);
      }
    } else {
      const applySubCol = cols.includes('apply_sub') ? 'apply_sub' : 'apply_subs';
      const existing = db.prepare(`SELECT grantpriv FROM acl WHERE server_id=1 AND channel_id=0 AND group_name='all'`).get();
      if (existing) {
        db.prepare(`UPDATE acl SET grantpriv = grantpriv | ?, ${applySubCol} = 1 WHERE server_id=1 AND channel_id=0 AND group_name='all'`).run(GRANT_BITS);
      } else {
        db.prepare(`INSERT INTO acl (server_id, channel_id, priority, user_id, group_name, apply_here, ${applySubCol}, grantpriv, revokepriv) VALUES (1, 0, 1000, -1, 'all', 1, 1, ?, 0)`).run(GRANT_BITS);
      }
    }
    db.close();
    console.log('[MumbleServer] Root channel ACL patched — Make permission granted to @all');
  } catch (err) {
    console.warn('[MumbleServer] ACL patch failed (non-fatal):', err.message);
  }
}

function logLegacyAcl(dbPath) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const cols = db.prepare(`PRAGMA table_info(acl)`).all().map(c => c.name);
    const isV15 = cols.includes('granted_flags');
    if (isV15) {
      const row = db.prepare(`SELECT granted_flags, apply_in_sub FROM acl WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).get();
      if (row) console.log(`[MumbleServer] Root ACL: granted_flags=0x${row.granted_flags.toString(16)}, apply_in_sub=${row.apply_in_sub}, MakeTempChannel=${(row.granted_flags & 0x400) ? 'YES ✓' : 'NO ✗'}`);
    } else {
      const applySubCol = cols.includes('apply_sub') ? 'apply_sub' : 'apply_subs';
      const row = db.prepare(`SELECT grantpriv, ${applySubCol} FROM acl WHERE server_id=1 AND channel_id=0 AND group_name='all'`).get();
      if (row) console.log(`[MumbleServer] Root ACL: grantpriv=0x${row.grantpriv.toString(16)}, apply_sub=${row[applySubCol]}, MakeTempChannel=${(row.grantpriv & 0x400) ? 'YES ✓' : 'NO ✗'}`);
    }
    db.close();
  } catch (e) {
    console.warn('[MumbleServer] Could not read ACL for logging:', e.message);
  }
}

// ────────────────────────────────────────────────────────────────────────────

process.on('exit', stopMurmur);
process.on('SIGINT', () => { stopMurmur(); process.exit(0); });
process.on('SIGTERM', () => { stopMurmur(); process.exit(0); });

function getMurmurStatus() {
  const managed = isManagedEnabled();
  const binary  = findMurmurBinary();
  return {
    managed,
    binary:       binary || null,
    isRustMumble: binary ? isRustMumble(binary) : false,
    running:      managed && murmurProcess != null && murmurProcess.exitCode === null,
    host:         process.env.MUMBLE_HOST || '127.0.0.1',
    port:         activePort || parseInt(process.env.MUMBLE_PORT || '64738', 10),
    configPort:   parseInt(process.env.MUMBLE_PORT || '64738', 10),
  };
}

module.exports = { startMumbleServer, stopMurmur, getMurmurStatus };
