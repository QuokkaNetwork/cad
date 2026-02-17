#!/usr/bin/env node
/**
 * Post-install/startup patch for mumble-node dist/lib/client.js
 *
 * Fixes rust-mumble interoperability issues when running TCP-only voice bridge:
 * 1) PING_INTERVAL 15s -> 5s
 * 2) immediate ping on connect + post-ServerSync ping
 * 3) echo server Ping messages back
 * 4) reply to full CryptSetup in TCP-only mode
 * 5) reply to empty CryptSetup resync in TCP-only mode
 * 6) reply to server_nonce-only CryptSetup resync response in TCP-only mode
 */

const fs = require('fs');
const path = require('path');

const clientPath = path.join(__dirname, '..', 'node_modules', 'mumble-node', 'dist', 'lib', 'client.js');

if (!fs.existsSync(clientPath)) {
  console.log('[patch-mumble-node] mumble-node not installed, skipping patch');
  process.exit(0);
}

let src = fs.readFileSync(clientPath, 'utf8');
let changed = false;

function applyReplacement(name, before, after, options = {}) {
  const silentMissing = options.silentMissing ?? true;
  if (src.includes(after)) return;
  if (!src.includes(before)) {
    if (!silentMissing) {
      console.log(`[patch-mumble-node] Pattern not found for "${name}"`);
    }
    return;
  }

  src = src.replace(before, after);
  changed = true;
  console.log(`[patch-mumble-node] Applied: ${name}`);
}

applyReplacement(
  'reduce ping interval',
  'const PING_INTERVAL = 15000;',
  'const PING_INTERVAL = 5000; // patched: 15 s caused ClientTimedOutTcp on rust-mumble'
);

const startPingOld = `    startPing() {
        this.pingInterval = setInterval(() => {`;
const startPingNew = `    startPing() {
        // patch-mumble-node: immediate ping so server sees activity before first interval
        this._lastPingTime = Date.now();
        this.connection.send(types_1.MessageType.Ping, (0, protocol_1.encodePing)(this._lastPingTime));
        this.pingInterval = setInterval(() => {`;
applyReplacement('immediate ping on startPing', startPingOld, startPingNew);

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
applyReplacement('post-ServerSync ping', serverSyncOld, serverSyncNew);

const handlePingOld = `    handlePing(message) {
        // Server ping received - just track it for stats, don't respond
        // The client sends its own periodic pings to keep connection alive
        this._lastPongTime = Date.now();
        this.log(\`  Server ping received, timestamp: \${message.timestamp}\`);
    }`;
const handlePingNew = `    handlePing(message) {
        // patch-mumble-node: echo server ping back - rust-mumble requires round-trip replies
        this._lastPongTime = Date.now();
        this.log(\`  Server ping received - echoing back\`);
        try {
            const ts = message.timestamp ?? Date.now();
            const tsNum = (typeof ts === 'object' && ts !== null && 'toNumber' in ts) ? ts.toNumber() : Number(ts);
            this.connection.send(types_1.MessageType.Ping, (0, protocol_1.encodePing)(tsNum));
        } catch {}
    }`;
applyReplacement('server ping echo', handlePingOld, handlePingNew);

const cryptDisableOld = `        // Check if UDP is disabled (force TCP tunnel)
        if (this.options.disableUdp) {
            this.log('  CryptSetup received but UDP disabled, using TCP tunnel only');
            return;
        }`;
const cryptDisableNew = `        // patch-mumble-node: TCP-only mode - acknowledge full CryptSetup re-key
        if (this.options.disableUdp) {
            this.log('  CryptSetup (re-key) in TCP-only mode - sending clientNonce ack');
            try {
                const ack = protocol_1.MumbleProto.CryptSetup.create({ clientNonce: message.clientNonce });
                this.connection.send(types_1.MessageType.CryptSetup, protocol_1.MumbleProto.CryptSetup.encode(ack).finish());
            } catch {}
            return;
        }`;
applyReplacement('full CryptSetup TCP-only ack', cryptDisableOld, cryptDisableNew);

const cryptResyncOld = `            else {
                this.log('  CryptSetup: Nonce resync request but no UDP initialized yet');
            }
            return;
        }`;
const cryptResyncNew = `            else {
                // patch-mumble-node: TCP-only resync - send zero-nonce ack so server does not timeout
                this.log('  CryptSetup: TCP-only resync - sending zero-nonce ack');
                try {
                    const resync = protocol_1.MumbleProto.CryptSetup.create({ clientNonce: Buffer.alloc(16) });
                    this.connection.send(types_1.MessageType.CryptSetup, protocol_1.MumbleProto.CryptSetup.encode(resync).finish());
                } catch {}
            }
            return;
        }`;
applyReplacement('empty CryptSetup TCP-only ack', cryptResyncOld, cryptResyncNew);

const cryptServerNonceOld = `        // Server sent only server_nonce = resync response with new decrypt IV
        if (keyLen === 0 && clientNonceLen === 0 && serverNonceLen === 16) {
            if (this.udp && message.serverNonce) {
                this.log('  CryptSetup: Server sent resync with new decrypt IV');
                const success = this.udp.setDecryptIV(Buffer.from(message.serverNonce));
                this.log(\`  CryptSetup: setDecryptIV \${success ? 'succeeded' : 'failed'}\`);
            }
            return;
        }`;
const cryptServerNonceNew = `        // Server sent only server_nonce = resync response with new decrypt IV
        if (keyLen === 0 && clientNonceLen === 0 && serverNonceLen === 16) {
            if (this.udp && message.serverNonce) {
                this.log('  CryptSetup: Server sent resync with new decrypt IV');
                const success = this.udp.setDecryptIV(Buffer.from(message.serverNonce));
                this.log(\`  CryptSetup: setDecryptIV \${success ? 'succeeded' : 'failed'}\`);
            }
            else if (this.options.disableUdp) {
                // patch-mumble-node: TCP-only resync response - send clientNonce ack
                this.log('  CryptSetup: TCP-only received server_nonce - sending clientNonce ack');
                try {
                    const ack = protocol_1.MumbleProto.CryptSetup.create({ clientNonce: Buffer.alloc(16) });
                    this.connection.send(types_1.MessageType.CryptSetup, protocol_1.MumbleProto.CryptSetup.encode(ack).finish());
                } catch {}
            }
            return;
        }`;
applyReplacement('server_nonce-only CryptSetup TCP-only ack', cryptServerNonceOld, cryptServerNonceNew);

if (!src.includes('patch-mumble-node-applied')) {
  src += '\n// patch-mumble-node-applied\n';
  changed = true;
}

if (changed) {
  fs.writeFileSync(clientPath, src, 'utf8');
  console.log('[patch-mumble-node] Patch applied successfully');
} else {
  console.log('[patch-mumble-node] No changes needed');
}
