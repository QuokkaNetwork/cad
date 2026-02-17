const express = require('express');
const http = require('http');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const path = require('path');
const config = require('./config');
const { verifyToken } = require('./auth/jwt');
const { initDb } = require('./db/sqlite');
const { initSteamAuth } = require('./auth/steam');
const { startBot } = require('./discord/bot');
const { startAutoUpdater } = require('./services/autoUpdater');
const { startFiveMResourceAutoSync } = require('./services/fivemResourceManager');
const { startFineProcessor } = require('./services/fivemFineProcessor');
const { ensureLiveMapTilesDir } = require('./services/liveMapTiles');
const { startMumbleServer, getMurmurStatus } = require('./services/mumbleServer');

// Initialize database
console.log('Initializing database...');
initDb();
console.log('Database ready');

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
app.use(cors({
  origin: config.webUrl,
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

// Create HTTP server for Express + WebSocket
const httpServer = http.createServer(app);

// Async startup — start Murmur first so the voice bridge can connect to it
(async () => {
  // Start managed Murmur server if MUMBLE_MANAGE=true in .env
  await startMumbleServer();

  // Initialize Voice Bridge (optional - only if dependencies are installed)
  try {
    const { getVoiceBridge } = require('./services/voiceBridge');
    const VoiceSignalingServer = require('./services/voiceSignaling');
    const { initVoiceBridgeSync } = require('./services/voiceBridgeSync');

    const voiceBridge = getVoiceBridge();
    if (voiceBridge?.getStatus?.().available) {
      new VoiceSignalingServer(httpServer, voiceBridge);
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
