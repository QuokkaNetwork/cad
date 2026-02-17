#!/usr/bin/env node
/**
 * Post-install patch for mumble-node dist/lib/client.js
 *
 * Fixes three bugs that cause rust-mumble (the Mumble server used by this CAD)
 * to drop the TCP connection when MUMBLE_DISABLE_UDP=true:
 *
 * 1. PING_INTERVAL reduced 15 s → 5 s  (rust-mumble TCP timeout is 10 s)
 * 2. Immediate ping on TLS connect + post-ServerSync ping
 * 3. Echo server Ping messages back (rust-mumble expects round-trip ping replies)
 * 4. Reply to full CryptSetup (re-key) in TCP-only mode with clientNonce ack
 * 5. Reply to empty CryptSetup (resync) in TCP-only mode with zero-nonce ack
 *
 * This script is run automatically via the "postinstall" npm script.
 * It is idempotent — safe to run multiple times.
 */

const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, '..', 'node_modules', 'mumble-node', 'dist', 'lib', 'client.js');

if (!fs.existsSync(clientPath)) {
  console.log('[patch-mumble-node] mumble-node not installed, skipping patch');
  process.exit(0);
}

let src = fs.readFileSync(clientPath, 'utf8');

// ── Guard: already patched? ──────────────────────────────────────────────────
if (src.includes('patch-mumble-node-applied')) {
  console.log('[patch-mumble-node] Already patched, skipping');
  process.exit(0);
}

let changed = false;

// ── 1. Reduce ping interval ──────────────────────────────────────────────────
if (src.includes('const PING_INTERVAL = 15000;')) {
  src = src.replace(
    'const PING_INTERVAL = 15000;',
    'const PING_INTERVAL = 5000; // patched: 15 s caused ClientTimedOutTcp on rust-mumble'
  );
  changed = true;
  console.log('[patch-mumble-node] ✓ Reduced PING_INTERVAL 15 s → 5 s');
}

// ── 2. Immediate + post-ServerSync ping ─────────────────────────────────────
const startPingOld = `    startPing() {
        this.pingInterval = setInterval(() => {`;
const startPingNew = `    startPing() {
        // patch-mumble-node: immediate ping so server sees activity before first interval
        this._lastPingTime = Date.now();
        this.connection.send(types_1.MessageType.Ping, (0, protocol_1.encodePing)(this._lastPingTime));
        this.pingInterval = setInterval(() => {`;

if (src.includes(startPingOld)) {
  src = src.replace(startPingOld, startPingNew);
  changed = true;
  console.log('[patch-mumble-node] ✓ Added immediate ping on startPing()');
}

const serverSyncOld = `        this._syncComplete = true;
        this._ready = true;
        this.emit('ready');
    }
    handleChannelState`;
const serverSyncNew = `        this._syncComplete = true;
        this._ready = true;
        // patch-mumble-node: ping immediately after ServerSync so rust-mumble resets its TCP timer
        try {
            this._lastPingTime = Date.now();
            this.connection.send(types_1.MessageType.Ping, (0, protocol_1.encodePing)(this._lastPingTime));
        } catch {}
        this.emit('ready');
    }
    handleChannelState`;

if (src.includes(serverSyncOld)) {
  src = src.replace(serverSyncOld, serverSyncNew);
  changed = true;
  console.log('[patch-mumble-node] ✓ Added post-ServerSync ping');
}

// ── 3. Echo server pings back ────────────────────────────────────────────────
const handlePingOld = `    handlePing(message) {
        // Server ping received - just track it for stats, don't respond
        // The client sends its own periodic pings to keep connection alive
        this._lastPongTime = Date.now();
        this.log(\`  Server ping received, timestamp: \${message.timestamp}\`);
    }`;
const handlePingNew = `    handlePing(message) {
        // patch-mumble-node: echo server ping back — rust-mumble requires round-trip replies
        this._lastPongTime = Date.now();
        this.log(\`  Server ping received — echoing back\`);
        try {
            const ts = message.timestamp ?? Date.now();
            const tsNum = (typeof ts === 'object' && ts !== null && 'toNumber' in ts) ? ts.toNumber() : Number(ts);
            this.connection.send(types_1.MessageType.Ping, (0, protocol_1.encodePing)(tsNum));
        } catch {}
    }`;

if (src.includes(handlePingOld)) {
  src = src.replace(handlePingOld, handlePingNew);
  changed = true;
  console.log('[patch-mumble-node] ✓ Added server ping echo');
}

// ── 4. Reply to full CryptSetup in TCP-only mode ─────────────────────────────
const cryptDisableOld = `        // Check if UDP is disabled (force TCP tunnel)
        if (this.options.disableUdp) {
            this.log('  CryptSetup received but UDP disabled, using TCP tunnel only');
            return;
        }`;
const cryptDisableNew = `        // patch-mumble-node: TCP-only mode — acknowledge full CryptSetup re-key
        if (this.options.disableUdp) {
            this.log('  CryptSetup (re-key) in TCP-only mode — sending clientNonce ack');
            try {
                const ack = protocol_1.MumbleProto.CryptSetup.create({ clientNonce: message.clientNonce });
                this.connection.send(types_1.MessageType.CryptSetup, protocol_1.MumbleProto.CryptSetup.encode(ack).finish());
            } catch {}
            return;
        }`;

if (src.includes(cryptDisableOld)) {
  src = src.replace(cryptDisableOld, cryptDisableNew);
  changed = true;
  console.log('[patch-mumble-node] ✓ Added full CryptSetup ack for TCP-only mode');
}

// ── 5. Reply to empty CryptSetup (resync) in TCP-only mode ──────────────────
const cryptResyncOld = `            else {
                this.log('  CryptSetup: Nonce resync request but no UDP initialized yet');
            }
            return;
        }`;
const cryptResyncNew = `            else {
                // patch-mumble-node: TCP-only resync — send zero-nonce ack so server doesn't timeout
                this.log('  CryptSetup: TCP-only resync — sending zero-nonce ack');
                try {
                    const resync = protocol_1.MumbleProto.CryptSetup.create({ clientNonce: Buffer.alloc(16) });
                    this.connection.send(types_1.MessageType.CryptSetup, protocol_1.MumbleProto.CryptSetup.encode(resync).finish());
                } catch {}
            }
            return;
        }`;

if (src.includes(cryptResyncOld)) {
  src = src.replace(cryptResyncOld, cryptResyncNew);
  changed = true;
  console.log('[patch-mumble-node] ✓ Added empty CryptSetup (resync) ack for TCP-only mode');
}

// ── Stamp ────────────────────────────────────────────────────────────────────
src += '\n// patch-mumble-node-applied\n';

if (changed) {
  fs.writeFileSync(clientPath, src, 'utf8');
  console.log('[patch-mumble-node] Patch applied successfully');
} else {
  console.log('[patch-mumble-node] No matching patterns found — may already be patched or version mismatch');
}
