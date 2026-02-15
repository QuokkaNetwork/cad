const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const path = require('path');
const config = require('./config');
const { initDb } = require('./db/sqlite');
const { initSteamAuth } = require('./auth/steam');
const { startBot } = require('./discord/bot');

// Initialize database
console.log('Initializing database...');
initDb();
console.log('Database ready');

// Initialize Express
const app = express();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: config.webUrl,
  credentials: true,
}));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Passport (Steam)
app.use(passport.initialize());
initSteamAuth();

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/units', require('./routes/units'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/bolos', require('./routes/bolos'));
app.use('/api/search', require('./routes/search'));
app.use('/api/records', require('./routes/records'));
app.use('/api/events', require('./routes/events'));
app.use('/api/admin', require('./routes/admin'));

// Announcements (public, auth-required)
const { requireAuth } = require('./auth/middleware');
const { Announcements } = require('./db/sqlite');
app.get('/api/announcements', requireAuth, (req, res) => {
  res.json(Announcements.listActive());
});

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
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(config.port, () => {
  console.log(`CAD server running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

// Start Discord bot
startBot().then(client => {
  if (client) console.log('Discord bot started');
}).catch(err => {
  console.error('Discord bot failed to start:', err.message);
});
