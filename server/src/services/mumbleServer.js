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

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

let murmurProcess = null;
let shuttingDown = false;
let restartTimer = null;

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

function buildIniContent() {
  const port = getMumblePort();
  const password = getMumblePassword();
  const dataDir = path.join(__dirname, '../../data');
  const dbPath = path.join(dataDir, 'mumble-server.sqlite').replace(/\\/g, '/');
  const logPath = path.join(dataDir, 'murmur.log').replace(/\\/g, '/');

  const lines = [
    '[murmur]',
    'host=0.0.0.0',
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

function ensureIniFile() {
  ensureDataDir();
  const iniPath = getIniPath();
  const dir = path.dirname(iniPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(iniPath, buildIniContent(), 'utf8');
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

function spawnMurmur() {
  if (shuttingDown) return;

  const binary = findMurmurBinary();
  if (!binary) return;

  const iniPath = ensureIniFile();
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
    restartTimer = setTimeout(spawnMurmur, 5000);
  });

  murmurProcess.on('error', (err) => {
    console.error('[MumbleServer] Failed to start Murmur:', err.message);
    murmurProcess = null;
    if (!shuttingDown) {
      restartTimer = setTimeout(spawnMurmur, 10000);
    }
  });

  console.log(`[MumbleServer] Murmur started (PID ${murmurProcess.pid}) on 0.0.0.0:${getMumblePort()}`);
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

    // Make=0x0008, Enter=0x0010, Traverse=0x0100
    const GRANT_BITS = 0x0008 | 0x0010 | 0x0100;

    if (isV15) {
      // Murmur 1.5 schema: aff_user_id, aff_group_id, apply_in_current, apply_in_sub, granted_flags, revoked_flags
      // Group-based ACL rows have aff_group_id set and aff_user_id NULL (or absent)
      const existing = murmurDb.prepare(`
        SELECT rowid, granted_flags FROM acl
        WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'
      `).get();

      if (existing && (existing.granted_flags & 0x0008)) {
        murmurDb.close();
        console.log('[MumbleServer] Root channel ACL already correct — no patch needed');
        return false;
      }

      if (existing) {
        murmurDb.prepare(`
          UPDATE acl SET granted_flags = granted_flags | ?
          WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'
        `).run(GRANT_BITS);
      } else {
        murmurDb.prepare(`
          INSERT INTO acl (server_id, channel_id, priority, aff_user_id, aff_group_id, aff_meta_group_id, apply_in_current, apply_in_sub, granted_flags, revoked_flags)
          VALUES (1, 0, 1000, NULL, 'all', NULL, 1, 1, ?, 0)
        `).run(GRANT_BITS);
      }
    } else {
      // Murmur 1.4 schema: user_id, group_name, apply_here, apply_sub(s), grantpriv, revokepriv
      // Note: some builds use apply_sub, others apply_subs — detect from schema
      const applySubCol = colNames.includes('apply_sub') ? 'apply_sub' : 'apply_subs';

      const existing = murmurDb.prepare(`
        SELECT grantpriv FROM acl
        WHERE server_id=1 AND channel_id=0 AND group_name='all'
      `).get();

      if (existing && (existing.grantpriv & 0x0008)) {
        murmurDb.close();
        console.log('[MumbleServer] Root channel ACL already correct — no patch needed');
        return false;
      }

      if (existing) {
        murmurDb.prepare(`
          UPDATE acl SET grantpriv = grantpriv | ?
          WHERE server_id=1 AND channel_id=0 AND group_name='all'
        `).run(GRANT_BITS);
      } else {
        murmurDb.prepare(`
          INSERT INTO acl (server_id, channel_id, priority, user_id, group_name, apply_here, ${applySubCol}, grantpriv, revokepriv)
          VALUES (1, 0, 1000, -1, 'all', 1, 1, ?, 0)
        `).run(GRANT_BITS);
      }
    }

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
 * Resolves once Murmur has had time to bind its port.
 */
async function startMumbleServer() {
  if (!isManagedEnabled()) {
    console.log('[MumbleServer] MUMBLE_MANAGE not enabled — skipping managed Murmur');
    return;
  }

  spawnMurmur();

  // Poll for Murmur's SQLite database to appear (up to 15 seconds)
  const dbPath = path.join(__dirname, '../../data/mumble-server.sqlite');
  console.log('[MumbleServer] Waiting for mumble-server.sqlite to be created...');
  const deadline = Date.now() + 15000;
  while (!fs.existsSync(dbPath) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!fs.existsSync(dbPath)) {
    console.warn('[MumbleServer] mumble-server.sqlite never appeared after 15s — skipping ACL patch');
    console.warn('[MumbleServer] Proximity voice may not work. Delete mumble-server.sqlite and restart to retry.');
    return;
  }

  console.log('[MumbleServer] mumble-server.sqlite found — checking Root channel ACL...');

  // Stop Murmur so it releases the DB lock, patch, then restart
  stopMurmur();
  shuttingDown = false;
  await new Promise(resolve => setTimeout(resolve, 1000));

  const patched = patchMurmurAcl();

  // Restart Murmur (whether patched or not — we stopped it above)
  spawnMurmur();
  await new Promise(resolve => setTimeout(resolve, 2000));
  if (patched) {
    console.log('[MumbleServer] Murmur running with proximity voice ACLs applied');
  } else {
    console.log('[MumbleServer] Murmur running (ACLs already correct)');
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
    binary:  binary || null,
    running: managed && murmurProcess != null && murmurProcess.exitCode === null,
    host:    process.env.MUMBLE_HOST || '127.0.0.1',
    port:    parseInt(process.env.MUMBLE_PORT || '64738', 10),
  };
}

module.exports = { startMumbleServer, stopMurmur, getMurmurStatus };
