const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const path = require('path');
const config = require('./config');
const { verifyToken } = require('./auth/jwt');
const { initDb, VoiceParticipants } = require('./db/sqlite');
const { initSteamAuth } = require('./auth/steam');
const { startBot } = require('./discord/bot');
const { startAutoUpdater } = require('./services/autoUpdater');
const { startFiveMResourceAutoSync } = require('./services/fivemResourceManager');
const { startFineProcessor } = require('./services/fivemFineProcessor');
const { ensureLiveMapTilesDir } = require('./services/liveMapTiles');
const { startMumbleServer, getMurmurStatus } = require('./services/mumbleServer');

function parseBool(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return !!fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return !!fallback;
}

// Initialize database
console.log('Initializing database...');
initDb();
console.log('Database ready');

// Clear ghost voice participants left from previous run (before any routes are served)
try { VoiceParticipants.removeAllOnStartup(); } catch {};

// Initialize Express
const app = express();
app.locals.authCookieName = config.auth.cookieName;
if (config.http?.trustProxy !== false) {
  app.set('trust proxy', config.http.trustProxy);
}

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
// Allow microphone access for dispatcher voice (getUserMedia).
// Helmet v8 does not manage Permissions-Policy, so we set it manually.
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'microphone=(self)');
  next();
});
// Allow both the HTTP (port 3031) and HTTPS (port 3030) origins so users can
// access the CAD from either URL without CORS errors.
const allowedOrigins = new Set([config.webUrl]);
// Also accept the HTTPS variant on 3030 (for microphone access / dispatcher voice)
try {
  const httpUrl  = new URL(config.webUrl);
  const httpsUrl = new URL(config.webUrl);
  httpsUrl.protocol = 'https:';
  httpsUrl.port = process.env.PORT || '3030';
  httpUrl.protocol  = 'http:';
  httpUrl.port = process.env.BRIDGE_HTTP_PORT || '3031';
  allowedOrigins.add(httpsUrl.toString().replace(/\/$/, ''));
  allowedOrigins.add(httpUrl.toString().replace(/\/$/, ''));
} catch {}
app.use(cors({
  origin: (origin, cb) => {
    // No origin = same-origin / server-to-server — always allow
    if (!origin || allowedOrigins.has(origin)) return cb(null, true);
    cb(null, false);
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

function extractRequestAuthToken(req) {
  const authHeader = String(req.headers.authorization || '').trim();
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return String(req.cookies?.[config.auth.cookieName] || '').trim();
}

function hasValidRequestAuthToken(req) {
  const token = extractRequestAuthToken(req);
  if (!token) return false;
  try {
    verifyToken(token);
    return true;
  } catch {
    return false;
  }
}

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.apiWindowMs,
  max: config.rateLimit.apiMax,
  standardHeaders: true,
  legacyHeaders: false,
  // FiveM bridge endpoints are high-frequency by design.
  // Authenticated CAD traffic can legitimately be bursty (SSE refreshes, dispatch fan-out).
  skip: (req) => req.path.startsWith('/integration/fivem/')
    || (config.rateLimit.apiSkipAuthenticated && hasValidRequestAuthToken(req)),
});
const fivemBridgeLimiter = rateLimit({
  windowMs: config.rateLimit.fivemWindowMs,
  max: config.rateLimit.fivemMax,
  standardHeaders: true,
  legacyHeaders: false,
});
if (config.rateLimit.apiMax > 0) {
  app.use('/api/', apiLimiter);
}
if (config.rateLimit.fivemMax > 0) {
  app.use('/api/integration/fivem', fivemBridgeLimiter);
}

// Passport (Steam)
app.use(passport.initialize());
initSteamAuth();

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/units', require('./routes/units'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/bolos', require('./routes/bolos'));
app.use('/api/warrants', require('./routes/warrants'));
app.use('/api/search', require('./routes/search'));
app.use('/api/records', require('./routes/records'));
app.use('/api/events', require('./routes/events'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/voice', require('./routes/voice'));
app.use('/api/integration/fivem', require('./routes/fivem'));

// Announcements (public, auth-required)
const { requireAuth } = require('./auth/middleware');
const { Announcements } = require('./db/sqlite');
app.get('/api/announcements', requireAuth, (req, res) => {
  res.json(Announcements.listActive());
});

// Serve uploaded assets
const uploadsPath = path.join(__dirname, '../data/uploads');
app.use('/uploads', express.static(uploadsPath));
const liveMapTilesPath = ensureLiveMapTilesDir();
fs.mkdirSync(liveMapTilesPath, { recursive: true });
app.use('/tiles', express.static(liveMapTilesPath));

// Serve static frontend in production
const distPath = path.join(__dirname, '../../web/dist');
app.use(express.static(distPath));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next();
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err?.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const field = String(err.field || '').trim();
      const maxMb = field === 'map' || field === 'tiles' ? 40 : 2;
      return res.status(400).json({ error: `Image too large (max ${maxMb}MB)` });
    }
    return res.status(400).json({ error: err.message || 'Upload error' });
  }
  if (err?.message === 'Only image files are allowed' || err?.message === 'Only image tile files are allowed') {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP or HTTPS server for Express + WebSocket.
// If TLS_CERT and TLS_KEY are set in .env, serve over HTTPS (required for
// browser microphone access via getUserMedia on non-localhost origins).
// If the cert files don't exist yet, auto-generates a self-signed cert using
// the public IP from MUMBLE_PUBLIC_IP so no manual steps are needed.
function ensureSelfSignedCert(keyPath, certPath) {
  const { execSync } = require('child_process');
  const os = require('os');
  const dataDir = path.dirname(keyPath);
  fs.mkdirSync(dataDir, { recursive: true });

  const ip = String(process.env.MUMBLE_PUBLIC_IP || '127.0.0.1').trim();
  const confPath = path.join(os.tmpdir(), 'cad-openssl-san.cnf');
  const conf = [
    '[req]', 'default_bits = 2048', 'prompt = no', 'default_md = sha256',
    'distinguished_name = dn', 'x509_extensions = v3_req',
    '', '[dn]', 'CN = CAD Server',
    '', '[v3_req]', 'subjectAltName = @alt_names',
    'basicConstraints = CA:FALSE',
    'keyUsage = digitalSignature, keyEncipherment',
    'extendedKeyUsage = serverAuth',
    '', '[alt_names]', `IP.1 = ${ip}`, 'IP.2 = 127.0.0.1',
  ].join('\n');
  fs.writeFileSync(confPath, conf, 'utf8');

  // Try openssl candidates in order
  const candidates = [
    'openssl',
    'C:\\Program Files\\Git\\mingw64\\bin\\openssl.exe',
    'C:\\Program Files\\OpenSSL-Win64\\bin\\openssl.exe',
    '/usr/bin/openssl',
  ];
  let generated = false;
  for (const bin of candidates) {
    try {
      execSync(
        `"${bin}" req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes` +
        ` -keyout "${keyPath}" -out "${certPath}" -config "${confPath}"`,
        { stdio: 'pipe' }
      );
      generated = true;
      break;
    } catch { /* try next */ }
  }
  try { fs.unlinkSync(confPath); } catch {}

  if (!generated) {
    console.warn('[TLS] Could not auto-generate cert (openssl not found). Install openssl or generate manually.');
    return false;
  }
  console.log(`[TLS] Self-signed cert generated for IP ${ip} — cert: ${certPath}`);
  return true;
}

function createServer(expressApp) {
  // Resolve paths relative to project root (parent of server/) so that
  // values like "server/data/server.key" in .env work correctly.
  const projectRoot = path.resolve(__dirname, '../../');
  const resolveTlsPath = (p) => p ? (path.isAbsolute(p) ? p : path.resolve(projectRoot, p)) : '';

  // Default to server/data/server.key + server.cert if not explicitly set in .env.
  // This means HTTPS works automatically on first run without needing to edit .env.
  const defaultKeyPath  = path.resolve(projectRoot, 'server/data/server.key');
  const defaultCertPath = path.resolve(projectRoot, 'server/data/server.cert');

  const certPath = resolveTlsPath(String(process.env.TLS_CERT || '').trim()) || defaultCertPath;
  const keyPath  = resolveTlsPath(String(process.env.TLS_KEY  || '').trim()) || defaultKeyPath;

  // Auto-generate cert if files don't exist yet (e.g. fresh clone / first run)
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log('[TLS] Cert files not found — auto-generating self-signed certificate...');
    ensureSelfSignedCert(keyPath, certPath);
  }
  try {
    const tlsOptions = {
      cert: fs.readFileSync(certPath),
      key:  fs.readFileSync(keyPath),
    };
    console.log(`[TLS] HTTPS enabled — cert: ${certPath}`);
    return { server: https.createServer(tlsOptions, expressApp), protocol: 'https' };
  } catch (err) {
    console.warn(`[TLS] Failed to load TLS cert/key (${err.message}) — falling back to HTTP`);
  }
  return { server: http.createServer(expressApp), protocol: 'http' };
}
const { server: httpServer, protocol: serverProtocol } = createServer(app);
if (serverProtocol === 'http') {
  console.warn('[TLS] Running over plain HTTP. Set TLS_CERT and TLS_KEY in .env for HTTPS (required for microphone).');
}

// Secondary plain-HTTP server on BRIDGE_HTTP_PORT (default 3031).
// Serves two purposes:
//   1. FiveM bridge — PerformHttpRequest cannot verify self-signed TLS certs,
//      so the bridge resource must reach the CAD over plain HTTP.
//      In voice.cfg: set cad_bridge_base_url "http://127.0.0.1:3031"
//   2. Steam OpenID callback — Steam redirects the browser back to returnURL.
//      If returnURL is HTTPS with a self-signed cert, the browser blocks it.
//      Set STEAM_REALM=http://103.203.241.35:3031 in .env so the callback
//      arrives over plain HTTP (no cert warning, no ERR_EMPTY_RESPONSE).
// Binds to 0.0.0.0 so both FiveM (localhost) and browsers (public IP) can reach it.
const bridgeHttpPort = parseInt(process.env.BRIDGE_HTTP_PORT || '3031', 10) || 3031;
const bridgeHttpServer = http.createServer(app);
bridgeHttpServer.listen(bridgeHttpPort, '0.0.0.0', () => {
  console.log(`[BridgeHTTP] HTTP listener on 0.0.0.0:${bridgeHttpPort} (FiveM bridge + Steam callbacks)`);
});
bridgeHttpServer.on('error', (err) => {
  console.warn(`[BridgeHTTP] Could not start HTTP listener on port ${bridgeHttpPort}: ${err.message}`);
});

// Async startup — start Murmur first so the voice bridge can connect to it
(async () => {
  // Start managed Murmur server if MUMBLE_MANAGE=true in .env
  await startMumbleServer();

  // Initialize Voice Bridge (optional - only if dependencies are installed)
  if (parseBool(process.env.VOICE_BRIDGE_ENABLED, true)) {
    try {
      const { getVoiceBridge } = require('./services/voiceBridge');
      const VoiceSignalingServer = require('./services/voiceSignaling');
      const { initVoiceBridgeSync } = require('./services/voiceBridgeSync');

      const voiceBridge = getVoiceBridge();
      if (voiceBridge?.getStatus?.().available) {
        const voiceSignalingServer = new VoiceSignalingServer(httpServer, voiceBridge);
        app.locals.voiceSignalingServer = voiceSignalingServer;
        // Mirror /voice-bridge upgrades on the plain HTTP bridge listener too.
        // This keeps dispatcher voice available when operators access CAD via :3031.
        bridgeHttpServer.on('upgrade', (request, socket, head) => {
          if (request.url && request.url.startsWith('/voice-bridge')) {
            voiceSignalingServer.handleUpgrade(request, socket, head);
          }
        });
        initVoiceBridgeSync(voiceBridge);
        console.log('[VoiceBridge] Voice bridge initialized successfully');
      } else {
        const missing = voiceBridge?.getStatus?.().dependency_missing || 'unknown';
        console.warn(`[VoiceBridge] Voice bridge not available: missing ${missing}`);
        console.warn('[VoiceBridge] Install dependencies: npm install --workspace=server mumble-node opusscript');
      }
    } catch (error) {
      console.warn('[VoiceBridge] Voice bridge not available:', error.message);
      console.warn('[VoiceBridge] CAD will run without voice bridge support');
    }
  } else {
    console.warn('[VoiceBridge] Disabled by VOICE_BRIDGE_ENABLED=false');
  }

  // Start HTTP server
  httpServer.listen(config.port, () => {
    console.log(`CAD server running on port ${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
    console.log('[VoiceBridge] WebSocket signaling available at /voice-bridge');

    // Print voice/Mumble status summary
    const murmur = getMurmurStatus();
    const voiceServerLabel = murmur.isRustMumble ? 'rust-mumble' : 'Murmur    ';
    console.log('');
    console.log('=== Voice Status ===');
    if (murmur.managed) {
      if (murmur.running) {
        console.log(`[${voiceServerLabel}] ✓ Running  — ${murmur.host}:${murmur.port}`);
        console.log(`[${voiceServerLabel}] Binary: ${murmur.binary}`);
      } else if (murmur.binary) {
        console.log(`[${voiceServerLabel}] ✗ Not running (binary found but process not started yet)`);
      } else {
        console.log(`[VoiceServer] ✗ Binary not found — place rust-mumble.exe in server/murmur/`);
        console.log(`[VoiceServer]   Download: https://github.com/AvarianKnight/rust-mumble/releases`);
      }
    } else {
      console.log('[VoiceServer] — Not managed (MUMBLE_MANAGE not set)');
    }
    const fivemPath = String(process.env.FIVEM_SERVER_PATH || '').trim();
    const publicIp  = String(process.env.MUMBLE_PUBLIC_IP  || '').trim();
    if (fivemPath) {
      console.log(`[VoiceCfg]    voice.cfg auto-deploy → ${fivemPath}`);
      if (!publicIp) console.log(`[VoiceCfg]    ⚠️  Set MUMBLE_PUBLIC_IP in .env so players can connect`);
    } else {
      console.log('[VoiceCfg]    Set FIVEM_SERVER_PATH in .env for automatic voice.cfg deploy');
    }
    console.log('[pma-voice]   Players connect via voice_externalAddress in voice.cfg');
    console.log(`[pma-voice]   External Mumble: ${publicIp || process.env.MUMBLE_HOST || '127.0.0.1'}:${process.env.MUMBLE_PORT || '64738'}`);
    console.log('====================');
    console.log('');
  });

  // Start Discord bot
  startBot().then(client => {
    if (client) console.log('Discord bot started');
  }).catch(err => {
    console.error('Discord bot failed to start:', err.message);
  });

  startAutoUpdater().catch(err => {
    console.error('Auto updater failed to start:', err.message);
  });

  startFiveMResourceAutoSync();
  startFineProcessor();
})();
