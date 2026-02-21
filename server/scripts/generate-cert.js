/**
 * generate-cert.js
 *
 * Generates a self-signed TLS certificate for the CAD server so that
 * browsers allow microphone access (getUserMedia requires HTTPS or localhost).
 *
 * Usage:
 *   node server/scripts/generate-cert.js
 *
 * Output files (written to server/data/):
 *   server.key  — private key
 *   server.cert — self-signed certificate (valid 10 years)
 *
 * After running, add these two lines to your .env:
 *   TLS_KEY=server/data/server.key
 *   TLS_CERT=server/data/server.cert
 *
 * Then update STEAM_REALM, STEAM_RETURN_URL, and WEB_URL to use https://.
 *
 * Requires: openssl on PATH (pre-installed on most Linux/Windows Server installs)
 * On Windows you can install it via: choco install openssl  OR  use Git Bash which bundles it.
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const dataDir  = path.resolve(__dirname, '../data');
const keyFile  = path.join(dataDir, 'server.key');
const certFile = path.join(dataDir, 'server.cert');

fs.mkdirSync(dataDir, { recursive: true });

const ip = process.env.TLS_PUBLIC_IP || process.argv[2] || '127.0.0.1';

// Build a minimal openssl config with SAN so Chrome accepts it
const sanConf = `
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[dn]
CN = CAD Server

[v3_req]
subjectAltName = @alt_names
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt_names]
IP.1 = ${ip}
IP.2 = 127.0.0.1
`;

const confFile = path.join(dataDir, 'openssl-san.cnf');
fs.writeFileSync(confFile, sanConf.trim() + '\n', 'utf8');

try {
  execSync(
    `openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes` +
    ` -keyout "${keyFile}" -out "${certFile}"` +
    ` -config "${confFile}"`,
    { stdio: 'inherit' }
  );
  console.log('');
  console.log('✅ Certificate generated:');
  console.log(`   Key:  ${keyFile}`);
  console.log(`   Cert: ${certFile}`);
  console.log('');
  console.log('Add these lines to your .env:');
  console.log(`  TLS_KEY=server/data/server.key`);
  console.log(`  TLS_CERT=server/data/server.cert`);
  console.log('');
  console.log('Also update .env URLs to https://:');
  console.log(`  STEAM_REALM=https://${ip}:3030`);
  console.log(`  STEAM_RETURN_URL=https://${ip}:3030/api/auth/steam/callback`);
  console.log(`  WEB_URL=https://${ip}:3030`);
  console.log('');
  console.log('⚠️  Self-signed cert: browsers will show a security warning on first visit.');
  console.log('   Click "Advanced → Proceed" once to accept it.');
  console.log('   For production, replace with a Let\'s Encrypt cert (certbot).');
} catch (err) {
  console.error('');
  console.error('❌ openssl not found or failed. Options:');
  console.error('   1. Install openssl: https://slproweb.com/products/Win32OpenSSL.html');
  console.error('   2. Use Git Bash (comes with openssl) to run this script');
  console.error('   3. On Linux: sudo apt install openssl');
  process.exit(1);
} finally {
  try { fs.unlinkSync(confFile); } catch {}
}
