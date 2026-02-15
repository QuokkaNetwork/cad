const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function parseIntEnv(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3030,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me',
    expiresIn: '12h',
  },
  steam: {
    apiKey: process.env.STEAM_API_KEY || '',
    realm: process.env.STEAM_REALM || 'http://localhost:3030',
    returnUrl: process.env.STEAM_RETURN_URL || 'http://localhost:3030/api/auth/steam/callback',
  },
  discord: {
    botToken: process.env.DISCORD_BOT_TOKEN || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    periodicSyncMinutes: parseIntEnv(process.env.DISCORD_PERIODIC_SYNC_MINUTES, 10),
  },
  autoUpdate: {
    enabled: String(process.env.AUTO_UPDATE_ENABLED || 'false').toLowerCase() === 'true',
    intervalMinutes: parseIntEnv(process.env.AUTO_UPDATE_INTERVAL_MINUTES, 5),
    branch: process.env.AUTO_UPDATE_BRANCH || '',
    runNpmInstall: String(process.env.AUTO_UPDATE_RUN_NPM_INSTALL || 'true').toLowerCase() === 'true',
    runWebBuild: String(process.env.AUTO_UPDATE_RUN_WEB_BUILD || 'true').toLowerCase() === 'true',
    exitOnUpdate: String(process.env.AUTO_UPDATE_EXIT_ON_UPDATE || 'true').toLowerCase() === 'true',
    selfRestart: String(process.env.AUTO_UPDATE_SELF_RESTART || 'true').toLowerCase() === 'true',
  },
  webUrl: process.env.WEB_URL || 'http://localhost:5173',
  sqlite: {
    file: path.resolve(__dirname, '../data/cad.sqlite'),
  },
  qbox: {
    host: process.env.QBOX_DB_HOST || '127.0.0.1',
    port: parseInt(process.env.QBOX_DB_PORT, 10) || 3306,
    user: process.env.QBOX_DB_USER || 'root',
    password: process.env.QBOX_DB_PASSWORD || '',
    database: process.env.QBOX_DB_NAME || 'qbox',
  },
};
