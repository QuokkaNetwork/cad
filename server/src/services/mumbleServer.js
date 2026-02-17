/**
 * Managed Mumble Server (Murmur)
 *
 * When MUMBLE_MANAGE=true in .env, the CAD server spawns and supervises
 * the murmurd/mumble-server process. On Windows this expects murmur.exe
 * (bundled in server/murmur/). On Linux it uses the system mumble-server.
 *
 * Both pma-voice in-game clients (via voice_externalAddress in server.cfg)
 * and the CAD voice bridge (mumble-node) connect to this same Murmur process.
 */

const { spawn, execSync } = require('child_process');
const fs   = require('fs');
const net  = require('net');
const path = require('path');
const os   = require('os');

const IS_WINDOWS = os.platform() === 'win32';

// On Windows: look for bundled exe inside server/murmur/
// v1.4 shipped as murmur.exe, v1.5+ ships as mumble-server.exe
// On Linux:   use system package (mumble-server / murmurd)
const WINDOWS_BUNDLED_CANDIDATES = [
  path.join(__dirname, '../../murmur/murmur.exe'),
  path.join(__dirname, '../../murmur/mumble-server.exe'),
];
const LINUX_CANDIDATES = [
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
let activePort    = null; // the port Murmur actually bound to

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

function getIniPath() {
  const configured = String(process.env.MUMBLE_INI_PATH || '').trim();
  if (configured) return configured;
  return path.join(__dirname, '../../data/murmur.ini');
}

function buildIniContent(bindHost = '0.0.0.0', port = null) {
  port = port || getMumblePort();
  const password = getMumblePassword();
  const dataDir = path.join(__dirname, '../../data');
  const dbPath  = path.join(dataDir, 'mumble-server.sqlite').replace(/\\/g, '/');
  const logPath = path.join(dataDir, 'murmur.log').replace(/\\/g, '/');

  const lines = [
    '[murmur]',
    `host=${bindHost}`,
    `port=${port}`,
    `database=${dbPath}`,
    `logfile=${logPath}`,
    'logdays=7',
    'users=200',
    'registerName=CAD Voice',
    'ice=',
    'dbus=',
    'welcometext=',
    password ? `serverpassword=${password}` : '',
    'bandwidth=72000',
    'timeout=30',
    'sslCert=',
    'sslKey=',
    // Force Opus codec for all clients (pma-voice uses Opus only)
    'opusthreshold=0',
    // Don't remember last channel — pma-voice manages channel placement
    'rememberchannel=false',
  ].filter(line => line !== '');

  return lines.join('\n') + '\n';
}

function ensureDataDir() {
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

function ensureIniFile(bindHost = '0.0.0.0', port = null) {
  ensureDataDir();
  const iniPath = getIniPath();
  const dir = path.dirname(iniPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(iniPath, buildIniContent(bindHost, port), 'utf8');
  return iniPath;
}

function findMurmurBinary() {
  if (IS_WINDOWS) {
    const found = WINDOWS_BUNDLED_CANDIDATES.find(p => fs.existsSync(p));
    if (found) return found;
    console.warn('[MumbleServer] Mumble server exe not found. Checked:');
    WINDOWS_BUNDLED_CANDIDATES.forEach(p => console.warn(`  ${p}`));
    console.warn('[MumbleServer] Place murmur.exe or mumble-server.exe in server/murmur/');
    return null;
  }

  for (const candidate of LINUX_CANDIDATES) {
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // Try next
    }
  }
  console.warn('[MumbleServer] murmurd not found. Install with: sudo apt install mumble-server');
  return null;
}

/**
 * Check whether a TCP port is free by attempting to bind to it.
 * Returns a Promise<boolean> — true = free, false = in use.
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
 *
 * Common service names installed by the Murmur MSI installer:
 *   "MumbleServer", "Murmur", "mumble-server", "murmurd"
 *
 * Returns true if a service was found and stopped successfully.
 */
function tryStopMumbleWindowsService() {
  if (!IS_WINDOWS) return false;

  const serviceNames = ['MumbleServer', 'Murmur', 'mumble-server', 'murmurd'];
  for (const name of serviceNames) {
    try {
      // sc query returns exit code 0 if service exists
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
        console.warn(`[MumbleServer] Or disable it: sc config "${name}" start= disabled`);
      }
    } catch {
      // Service doesn't exist — try next name
    }
  }
  return false;
}

/**
 * Find a free port starting from the configured port.
 * If the preferred port is taken, tries to stop any conflicting Murmur
 * Windows service first, then tries fallback ports.
 *
 * Returns the first free port found, or null if none available.
 */
async function findFreePort() {
  const preferredPort = getMumblePort();

  if (await isPortFree(preferredPort)) {
    return preferredPort;
  }

  // Port is taken — log a clear warning
  console.warn(`[MumbleServer] ⚠️  Port ${preferredPort} is already in use!`);
  console.warn(`[MumbleServer]    This usually means a Murmur Windows Service is running`);
  console.warn(`[MumbleServer]    from a previous MSI installation. That service is using`);
  console.warn(`[MumbleServer]    an UNPATCHED Murmur — players connecting to it won't be`);
  console.warn(`[MumbleServer]    able to create temporary channels (proximity voice broken).`);
  console.warn(`[MumbleServer] Attempting to stop conflicting Murmur Windows service...`);

  const stopped = tryStopMumbleWindowsService();

  if (stopped) {
    // Give the service time to release the port
    await new Promise(r => setTimeout(r, 3000));
    if (await isPortFree(preferredPort)) {
      console.log(`[MumbleServer] ✓ Port ${preferredPort} is now free after stopping the service.`);
      return preferredPort;
    }
    console.warn(`[MumbleServer] Port ${preferredPort} still in use after stopping service. Trying fallback ports...`);
  } else {
    console.warn(`[MumbleServer] Could not stop conflicting service. Trying fallback ports...`);
    console.warn(`[MumbleServer] NOTE: voice_externalPort in voice.cfg must match the port we bind to.`);
  }

  // Try fallback ports
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

function spawnMurmur(bindHost = '0.0.0.0', port = null) {
  if (shuttingDown) return;

  const binary = findMurmurBinary();
  if (!binary) return;

  port = port || getMumblePort();
  const iniPath = ensureIniFile(bindHost, port);
  // -fg keeps Murmur in the foreground so we can capture stdout/stderr
  const args = IS_WINDOWS
    ? ['-ini', iniPath]      // murmur.exe on Windows doesn't support -fg but runs in foreground by default
    : ['-ini', iniPath, '-fg'];

  console.log(`[MumbleServer] Starting Murmur: ${binary} ${args.join(' ')}`);

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
    console.warn(`[MumbleServer] Murmur exited (${reason}). Restarting in 5 seconds...`);
    restartTimer = setTimeout(() => spawnMurmur(bindHost, port), 5000);
  });

  murmurProcess.on('error', (err) => {
    console.error('[MumbleServer] Failed to start Murmur:', err.message);
    murmurProcess = null;
    if (!shuttingDown) {
      restartTimer = setTimeout(() => spawnMurmur(bindHost, port), 10000);
    }
  });

  activePort = port;
  console.log(`[MumbleServer] Murmur started (PID ${murmurProcess.pid}) on ${bindHost}:${port}`);
  if (port !== getMumblePort()) {
    console.warn(`[MumbleServer] ⚠️  Murmur is on port ${port}, NOT the configured ${getMumblePort()}.`);
    console.warn(`[MumbleServer]    Set voice_externalPort "${port}" in voice.cfg and restart FiveM!`);
  }
}

/**
 * Patch the Murmur SQLite database to grant the "Make" permission (create
 * temporary channels) to all users on the Root channel.
 *
 * Murmur 1.5 no longer grants this by default, which breaks pma-voice
 * proximity voice — players need to create temporary sub-channels in Root.
 *
 * Returns true if the database was modified (needs Murmur restart).
 * Returns false if already patched (no restart needed).
 */
function patchMurmurAcl() {
  const dataDir = path.join(__dirname, '../../data');
  const dbPath  = path.join(dataDir, 'mumble-server.sqlite');

  if (!fs.existsSync(dbPath)) {
    console.warn('[MumbleServer] mumble-server.sqlite not found yet — skipping ACL patch');
    return false;
  }

  try {
    const Database = require('better-sqlite3');
    const murmurDb = new Database(dbPath);

    // Inspect actual schema to handle both Murmur 1.4 and 1.5 column names
    const tableInfo = murmurDb.prepare(`PRAGMA table_info(acl)`).all();
    const colNames  = tableInfo.map(c => c.name);
    console.log('[MumbleServer] ACL table columns:', colNames.join(', '));

    // Murmur 1.5 renamed columns; detect which version's schema we have
    const isV15 = colNames.includes('granted_flags');

    // Correct Mumble permission bits (from ACL.h):
    // MakeTempChannel=0x400, Enter=0x4, Traverse=0x2
    const GRANT_BITS = 0x400 | 0x4 | 0x2;

    if (isV15) {
      // Murmur 1.5 schema
      const existing = murmurDb.prepare(`
        SELECT rowid, granted_flags FROM acl
        WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'
      `).get();

      if (existing && (existing.granted_flags & 0x400)) {
        murmurDb.close();
        console.log('[MumbleServer] Root channel ACL already correct — no patch needed');
        return false;
      }

      if (existing) {
        murmurDb.prepare(`
          UPDATE acl SET granted_flags = granted_flags | ?, apply_in_sub = 1
          WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'
        `).run(GRANT_BITS);
      } else {
        murmurDb.prepare(`
          INSERT INTO acl (server_id, channel_id, priority, aff_user_id, aff_group_id, aff_meta_group_id, apply_in_current, apply_in_sub, granted_flags, revoked_flags)
          VALUES (1, 0, 1000, NULL, 'all', NULL, 1, 1, ?, 0)
        `).run(GRANT_BITS);
      }
    } else {
      // Murmur 1.4 schema
      const applySubCol = colNames.includes('apply_sub') ? 'apply_sub' : 'apply_subs';

      const existing = murmurDb.prepare(`
        SELECT grantpriv FROM acl
        WHERE server_id=1 AND channel_id=0 AND group_name='all'
      `).get();

      if (existing && (existing.grantpriv & 0x400)) {
        murmurDb.close();
        console.log('[MumbleServer] Root channel ACL already correct — no patch needed');
        return false;
      }

      if (existing) {
        murmurDb.prepare(`
          UPDATE acl SET grantpriv = grantpriv | ?, ${applySubCol} = 1
          WHERE server_id=1 AND channel_id=0 AND group_name='all'
        `).run(GRANT_BITS);
      } else {
        murmurDb.prepare(`
          INSERT INTO acl (server_id, channel_id, priority, user_id, group_name, apply_here, ${applySubCol}, grantpriv, revokepriv)
          VALUES (1, 0, 1000, -1, 'all', 1, 1, ?, 0)
        `).run(GRANT_BITS);
      }
    }

    // Log what's actually in the ACL table for Root after patching
    const allRows = murmurDb.prepare(`SELECT * FROM acl WHERE server_id=1 AND channel_id=0`).all();
    console.log('[MumbleServer] Root ACL after patch:', JSON.stringify(allRows));

    murmurDb.close();
    console.log('[MumbleServer] Root channel ACL patched — Make permission granted to @all');
    return true;
  } catch (err) {
    console.warn('[MumbleServer] ACL patch failed (non-fatal):', err.message);
    return false;
  }
}

function stopMurmur() {
  shuttingDown = true;
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null; }
  if (!murmurProcess) return;
  console.log('[MumbleServer] Stopping Murmur...');
  try { murmurProcess.kill(); } catch {}
  murmurProcess = null;
}

/**
 * Start the managed Mumble server.
 * Called from index.js before the voice bridge initializes.
 *
 * Strategy:
 *  1. Check if preferred port is free. If not, try to stop conflicting
 *     Murmur Windows service, then fall back to alternate ports.
 *  2. If mumble-server.sqlite already exists and ACL is patched → start (fast path)
 *  3. If DB is missing → first boot: start on 127.0.0.1, wait for schema,
 *     stop, patch ACL, restart on 0.0.0.0
 */
async function startMumbleServer() {
  if (!isManagedEnabled()) {
    console.log('[MumbleServer] MUMBLE_MANAGE not enabled — skipping managed Murmur');
    return;
  }

  // ── Port conflict detection ───────────────────────────────────────────────
  const port = await findFreePort();
  if (!port) {
    console.error('[MumbleServer] ✗ Cannot start Murmur — no free port available.');
    console.error('[MumbleServer]   Stop the conflicting process and restart the CAD server.');
    return;
  }

  const dbPath = path.join(__dirname, '../../data/mumble-server.sqlite');

  // ── Fast path: DB already exists ─────────────────────────────────────────
  if (fs.existsSync(dbPath)) {
    console.log('[MumbleServer] Existing DB found — checking ACL...');
    if (!isAclPatched(dbPath)) {
      console.log('[MumbleServer] Patching ACL...');
      patchMurmurAcl();
    } else {
      console.log('[MumbleServer] ACL already correct');
    }

    // Log the actual ACL so we have evidence in every startup log
    logCurrentAcl(dbPath);

    shuttingDown = false;
    spawnMurmur('0.0.0.0', port);
    console.log('[MumbleServer] Murmur running with proximity voice ACLs');
    return;
  }

  // ── First boot: DB doesn't exist yet ─────────────────────────────────────
  console.log('[MumbleServer] First boot — initializing DB on 127.0.0.1 (players cannot connect yet)...');
  shuttingDown = true; // block auto-restart timer for the whole init cycle

  const binary = findMurmurBinary();
  if (!binary) return;

  const iniPath = ensureIniFile('127.0.0.1', port);
  const args    = IS_WINDOWS ? ['-ini', iniPath] : ['-ini', iniPath, '-fg'];

  console.log(`[MumbleServer] Starting Murmur (init): ${binary} ${args.join(' ')}`);
  const initProc = spawn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });
  initProc.stdout.on('data', d => { const t = d.toString().trim(); if (t) console.log(`[Murmur] ${t}`); });
  initProc.stderr.on('data', d => { const t = d.toString().trim(); if (t) console.warn(`[Murmur] ${t}`); });
  console.log(`[MumbleServer] Init Murmur started (PID ${initProc.pid})`);

  // Wait until ACL table exists in the DB (up to 20s)
  const deadline = Date.now() + 20000;
  let dbReady = false;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (!fs.existsSync(dbPath)) continue;
    try {
      const Database = require('better-sqlite3');
      const checkDb  = new Database(dbPath, { readonly: true });
      const t = checkDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='acl'`).get();
      checkDb.close();
      if (t) { dbReady = true; break; }
    } catch { /* not readable yet */ }
  }

  // Kill the init process — wait for it to fully exit before touching the DB
  console.log('[MumbleServer] Stopping init Murmur...');
  try { initProc.kill(); } catch {}
  await new Promise(resolve => {
    if (initProc.exitCode !== null) { resolve(); return; }
    initProc.once('exit', resolve);
    setTimeout(resolve, 3000); // fallback
  });
  await new Promise(resolve => setTimeout(resolve, 500)); // extra safety margin

  if (!dbReady) {
    console.warn('[MumbleServer] DB never initialized — starting without ACL patch (proximity voice may not work)');
  } else {
    console.log('[MumbleServer] DB ready — patching ACL...');
    patchMurmurAcl();
    logCurrentAcl(dbPath);
  }

  // Now start Murmur publicly with the patched DB
  shuttingDown = false;
  spawnMurmur('0.0.0.0', port);
  console.log('[MumbleServer] Murmur running with proximity voice ACLs applied');
}

/**
 * Log the current Root ACL row so we always have evidence in startup logs.
 */
function logCurrentAcl(dbPath) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const cols  = db.prepare(`PRAGMA table_info(acl)`).all().map(c => c.name);
    const isV15 = cols.includes('granted_flags');
    let row;
    if (isV15) {
      row = db.prepare(`SELECT granted_flags, apply_in_sub FROM acl WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).get();
      if (row) console.log(`[MumbleServer] Root ACL: granted_flags=${row.granted_flags} (0x${row.granted_flags.toString(16)}), apply_in_sub=${row.apply_in_sub}, MakeTempChannel=${(row.granted_flags & 0x400) ? 'YES ✓' : 'NO ✗'}`);
      else console.warn('[MumbleServer] Root ACL: no @all row found!');
    } else {
      const applySubCol = cols.includes('apply_sub') ? 'apply_sub' : 'apply_subs';
      row = db.prepare(`SELECT grantpriv, ${applySubCol} FROM acl WHERE server_id=1 AND channel_id=0 AND group_name='all'`).get();
      if (row) console.log(`[MumbleServer] Root ACL: grantpriv=${row.grantpriv} (0x${row.grantpriv.toString(16)}), apply_sub=${row[applySubCol]}, MakeTempChannel=${(row.grantpriv & 0x400) ? 'YES ✓' : 'NO ✗'}`);
      else console.warn('[MumbleServer] Root ACL: no @all row found!');
    }
    db.close();
  } catch (e) {
    console.warn('[MumbleServer] Could not read ACL for logging:', e.message);
  }
}

/**
 * Check whether the Root channel ACL already has the Make permission granted.
 * Used to skip the patch cycle on subsequent restarts.
 */
function isAclPatched(dbPath) {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const tableInfo = db.prepare(`PRAGMA table_info(acl)`).all();
    const colNames  = tableInfo.map(c => c.name);
    const isV15     = colNames.includes('granted_flags');
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

process.on('exit', stopMurmur);
process.on('SIGINT', () => { stopMurmur(); process.exit(0); });
process.on('SIGTERM', () => { stopMurmur(); process.exit(0); });

function getMurmurStatus() {
  const managed = isManagedEnabled();
  const binary  = findMurmurBinary();
  return {
    managed,
    binary:     binary || null,
    running:    managed && murmurProcess != null && murmurProcess.exitCode === null,
    host:       process.env.MUMBLE_HOST || '127.0.0.1',
    port:       activePort || parseInt(process.env.MUMBLE_PORT || '64738', 10),
    configPort: parseInt(process.env.MUMBLE_PORT || '64738', 10),
  };
}

module.exports = { startMumbleServer, stopMurmur, getMurmurStatus };
