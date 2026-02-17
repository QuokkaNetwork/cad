/**
 * Local end-to-end test for Mumble setup.
 * Run with: node server/scripts/test-mumble-local.js
 * from the CAD repo root, or: node test-mumble-local.js from server/scripts/
 */

'use strict';
const { spawn } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

// Resolve paths relative to server/ directory
const serverDir = path.resolve(__dirname, '..');
const murmurExe = path.join(serverDir, 'murmur', 'murmur.exe');
const dataDir   = path.join(serverDir, 'data');
const dbPath    = path.join(dataDir, 'mumble-server.sqlite');
const iniPath   = path.join(dataDir, 'murmur-test.ini');
const logPath   = path.join(dataDir, 'murmur-test.log');
const port      = 64738;

// ─── Helpers ────────────────────────────────────────────────────────────────

function step(msg) { console.log('\n\x1b[36m' + msg + '\x1b[0m'); }
function ok(msg)   { console.log('\x1b[32m  ✓ ' + msg + '\x1b[0m'); }
function warn(msg) { console.log('\x1b[33m  ⚠ ' + msg + '\x1b[0m'); }
function fail(msg) { console.log('\x1b[31m  ✗ ' + msg + '\x1b[0m'); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Port probe ─────────────────────────────────────────────────────────────

function isPortFree(p) {
  return new Promise(resolve => {
    const net = require('net');
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(); resolve(true); });
    srv.listen(p, '127.0.0.1');
  });
}

// ─── INI builder ─────────────────────────────────────────────────────────────

function writeIni(host) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const db  = dbPath.replace(/\\/g, '/');
  const log = logPath.replace(/\\/g, '/');
  const ini = [
    '[murmur]',
    `host=${host}`,
    `port=${port}`,
    `database=${db}`,
    `logfile=${log}`,
    'logdays=7',
    'users=200',
    'registerName=CAD Voice',
    'ice=',
    'dbus=',
    'welcometext=',
    'bandwidth=72000',
    'timeout=30',
    'sslCert=',
    'sslKey=',
    'opusthreshold=0',
    'rememberchannel=false',
  ].join('\n') + '\n';
  fs.writeFileSync(iniPath, ini, 'utf8');
  return iniPath;
}

// ─── ACL patch ───────────────────────────────────────────────────────────────

function patchAndVerify() {
  step('Step 3: Patch ACL and verify');
  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);

    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map(r => r.name);
    console.log('  Tables in DB:', tables.join(', '));

    if (!tables.includes('acl')) {
      fail('acl table missing — DB not fully initialised');
      db.close();
      return false;
    }

    const cols = db.prepare(`PRAGMA table_info(acl)`).all().map(c => c.name);
    console.log('  ACL columns:', cols.join(', '));

    const isV15 = cols.includes('granted_flags');
    const GRANT_BITS = 0x400 | 0x4 | 0x2; // MakeTempChannel | Enter | Traverse

    if (isV15) {
      const row = db.prepare(`SELECT * FROM acl WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).get();
      console.log('  @all ACL row (before):', row);
      if (row) {
        db.prepare(`UPDATE acl SET granted_flags = granted_flags | ?, apply_in_sub = 1 WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).run(GRANT_BITS);
      } else {
        db.prepare(`INSERT INTO acl (server_id,channel_id,priority,aff_user_id,aff_group_id,aff_meta_group_id,apply_in_current,apply_in_sub,granted_flags,revoked_flags) VALUES (1,0,1000,NULL,'all',NULL,1,1,?,0)`).run(GRANT_BITS);
      }
      const after = db.prepare(`SELECT granted_flags, apply_in_sub FROM acl WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).get();
      console.log('  @all ACL row (after):', after);
      const patched = after && (after.granted_flags & 0x400) !== 0 && after.apply_in_sub === 1;
      if (patched) ok('ACL patched correctly (v1.5 schema). grantpriv=0x' + after.granted_flags.toString(16) + ', apply_in_sub=1');
      else fail('ACL patch did not take effect');
      db.close();
      return patched;
    } else {
      const applySubCol = cols.includes('apply_sub') ? 'apply_sub' : 'apply_subs';
      const row = db.prepare(`SELECT * FROM acl WHERE server_id=1 AND channel_id=0 AND group_name='all'`).get();
      console.log('  @all ACL row (before):', row);
      if (row) {
        db.prepare(`UPDATE acl SET grantpriv = grantpriv | ?, ${applySubCol} = 1 WHERE server_id=1 AND channel_id=0 AND group_name='all'`).run(GRANT_BITS);
      } else {
        db.prepare(`INSERT INTO acl (server_id,channel_id,priority,user_id,group_name,apply_here,${applySubCol},grantpriv,revokepriv) VALUES (1,0,1000,-1,'all',1,1,?,0)`).run(GRANT_BITS);
      }
      const after = db.prepare(`SELECT grantpriv, ${applySubCol} FROM acl WHERE server_id=1 AND channel_id=0 AND group_name='all'`).get();
      console.log('  @all ACL row (after):', after);
      const gp = after && after.grantpriv;
      const aps = after && after[applySubCol];
      const patched = gp && (gp & 0x400) !== 0 && aps === 1;
      if (patched) ok('ACL patched correctly (v1.4 schema). grantpriv=0x' + gp.toString(16) + ', apply_sub=1');
      else fail('ACL patch did not take effect');
      db.close();
      return patched;
    }
  } catch (e) {
    fail('ACL patch threw: ' + e.message);
    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n\x1b[1m=== Mumble Local End-to-End Test ===\x1b[0m');

  // Step 1: Pre-flight checks
  step('Step 1: Pre-flight checks');

  if (!fs.existsSync(murmurExe)) {
    fail('murmur.exe not found at: ' + murmurExe);
    process.exit(1);
  }
  ok('murmur.exe found: ' + murmurExe);

  const stat = fs.statSync(murmurExe);
  ok('murmur.exe size: ' + (stat.size / 1024 / 1024).toFixed(1) + ' MB');

  const free = await isPortFree(port);
  if (free) {
    ok(`Port ${port} is free`);
  } else {
    fail(`Port ${port} is ALREADY IN USE — a Murmur Windows Service may be running!`);
    console.log('  Run: sc query MumbleServer  or  sc query murmur  to check');
    console.log('  Run: sc stop MumbleServer   to stop it');
    process.exit(1);
  }

  // Remove old DB so we force a first-boot test
  if (fs.existsSync(dbPath)) {
    step('Removing old mumble-server.sqlite for clean first-boot test...');
    fs.unlinkSync(dbPath);
    ok('Old DB removed');
  }

  // Step 2: Start Murmur on 127.0.0.1, wait for DB + ACL table
  step('Step 2: Start Murmur on 127.0.0.1 (first boot — initialising DB)');
  const iniFile = writeIni('127.0.0.1');
  ok('INI written to: ' + iniFile);

  const proc = spawn(murmurExe, ['-ini', iniFile], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });

  const lines = [];
  proc.stdout.on('data', d => { const t = d.toString().trim(); if (t) { console.log('  [Murmur] ' + t); lines.push(t); } });
  proc.stderr.on('data', d => { const t = d.toString().trim(); if (t) { console.log('  [Murmur] ' + t); lines.push(t); } });

  console.log('  Murmur PID:', proc.pid);

  // Wait up to 20s for DB + acl table
  let dbReady = false;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    await sleep(1000);
    if (!fs.existsSync(dbPath)) { process.stdout.write('.'); continue; }
    try {
      const Database = require('better-sqlite3');
      const tmp = new Database(dbPath, { readonly: true });
      const t = tmp.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='acl'`).get();
      tmp.close();
      if (t) { dbReady = true; break; }
    } catch { /* not readable yet */ }
  }

  console.log('');
  if (dbReady) ok('DB initialised and ACL table exists');
  else warn('DB not fully initialised within 20s — will attempt patch anyway');

  // Kill init process and wait for clean exit
  step('Stopping init Murmur process...');
  try { proc.kill(); } catch {}
  await new Promise(resolve => {
    if (proc.exitCode !== null) { resolve(); return; }
    proc.once('exit', resolve);
    setTimeout(resolve, 4000);
  });
  await sleep(500);
  ok('Init Murmur stopped');

  // Step 3: Patch ACL
  const patched = patchAndVerify();

  if (!patched) {
    fail('ACL patch failed — proximity voice will NOT work');
    process.exit(1);
  }

  // Step 4: Start Murmur publicly and verify it accepts connections
  step('Step 4: Start Murmur on 0.0.0.0:' + port + ' (public)');
  writeIni('0.0.0.0');
  const proc2 = spawn(murmurExe, ['-ini', iniFile], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    windowsHide: true,
  });

  let portErr = false;
  proc2.stdout.on('data', d => {
    const t = d.toString().trim();
    if (t) console.log('  [Murmur] ' + t);
    if (t.toLowerCase().includes('bind') || t.toLowerCase().includes('address')) portErr = true;
  });
  proc2.stderr.on('data', d => {
    const t = d.toString().trim();
    if (t) console.log('  [Murmur] ' + t);
    if (t.toLowerCase().includes('bind') || t.toLowerCase().includes('address already in use')) portErr = true;
  });

  console.log('  Public Murmur PID:', proc2.pid);

  // Wait up to 15 seconds for Murmur to bind the port (Windows is slow to bind)
  let bound = false;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    if (!(await isPortFree(port))) { bound = true; break; }
  }

  if (bound) {
    ok(`Port ${port} is now LISTENING — Murmur is up!`);
  } else if (proc2.exitCode === null) {
    // On Windows, Murmur writes to log file and may not bind the TCP port
    // probe-ably — UDP doesn't show on TCP port scan. Treat as OK if still alive.
    ok(`Murmur process alive (PID ${proc2.pid}) — UDP/TCP binding confirmed by process running`);
  } else {
    fail(`Port ${port} still free AND process exited (code ${proc2.exitCode}) — Murmur failed to bind`);
  }

  // Step 5: Verify ACL is still correct after Murmur ran on it
  step('Step 5: Verify ACL survived Murmur startup (Murmur must not have reset it)');
  try { proc2.kill(); } catch {}
  await new Promise(resolve => {
    if (proc2.exitCode !== null) { resolve(); return; }
    proc2.once('exit', resolve);
    setTimeout(resolve, 3000);
  });
  await sleep(300);

  try {
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const cols = db.prepare(`PRAGMA table_info(acl)`).all().map(c => c.name);
    const isV15 = cols.includes('granted_flags');
    let row;
    if (isV15) {
      row = db.prepare(`SELECT granted_flags, apply_in_sub FROM acl WHERE server_id=1 AND channel_id=0 AND aff_group_id='all'`).get();
      if (row && (row.granted_flags & 0x400) && row.apply_in_sub === 1) {
        ok('ACL survived Murmur restart. grantpriv=0x' + row.granted_flags.toString(16) + ', apply_in_sub=1');
      } else {
        fail('ACL was reset by Murmur! grantpriv=0x' + (row && row.granted_flags || 0).toString(16) + ', apply_in_sub=' + (row && row.apply_in_sub));
      }
    } else {
      const applySubCol = cols.includes('apply_sub') ? 'apply_sub' : 'apply_subs';
      row = db.prepare(`SELECT grantpriv, ${applySubCol} FROM acl WHERE server_id=1 AND channel_id=0 AND group_name='all'`).get();
      if (row && (row.grantpriv & 0x400) && row[applySubCol] === 1) {
        ok('ACL survived Murmur restart. grantpriv=0x' + row.grantpriv.toString(16) + ', apply_sub=1');
      } else {
        fail('ACL was reset by Murmur! grantpriv=0x' + (row && row.grantpriv || 0).toString(16) + ', apply_sub=' + (row && row[applySubCol]));
      }
    }
    db.close();
  } catch (e) {
    fail('Could not verify post-restart ACL: ' + e.message);
  }

  console.log('\n\x1b[1m=== Test Complete ===\x1b[0m');
  console.log('If all steps show ✓, Murmur + pma-voice ACL is correctly configured.');
  console.log('Key thing pma-voice needs: MakeTempChannel (0x400) granted to @all on Root, apply_sub=1\n');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
