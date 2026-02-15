const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

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
