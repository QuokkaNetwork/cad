const express = require('express');
const passport = require('passport');
const config = require('../config');
const { generateToken } = require('../auth/jwt');
const { requireAuth } = require('../auth/middleware');
const { Users, UserDepartments } = require('../db/sqlite');
const { audit } = require('../utils/audit');

const router = express.Router();

function authCookieOptions() {
  const options = {
    httpOnly: true,
    secure: !!config.auth.cookieSecure,
    sameSite: config.auth.cookieSameSite || 'Lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  };
  if (config.auth.cookieDomain) {
    options.domain = config.auth.cookieDomain;
  }
  return options;
}

// Steam OpenID login
router.get('/steam', passport.authenticate('steam', { session: false }));

// Steam callback
router.get('/steam/callback',
  passport.authenticate('steam', { session: false, failureRedirect: `${config.webUrl}/login?error=steam_failed` }),
  (req, res) => {
    const token = generateToken(req.user);
    res.cookie(config.auth.cookieName, token, authCookieOptions());
    audit(req.user.id, 'login', 'Steam login');
    res.redirect(`${config.webUrl}/auth/callback`);
  }
);

// Get current user profile
router.get('/me', requireAuth, (req, res) => {
  const { id, steam_id, steam_name, avatar_url, discord_id, discord_name, is_admin, created_at } = req.user;
  const departments = req.user.departments;
  res.json({
    id,
    steam_id,
    steam_name,
    avatar_url,
    discord_id,
    discord_name,
    is_admin: !!is_admin,
    created_at,
    departments,
  });
});

// Generate Discord OAuth2 URL for account linking
router.post('/link-discord', requireAuth, (req, res) => {
  if (!config.discord.clientId) {
    return res.status(400).json({ error: 'Discord OAuth not configured' });
  }
  const redirectUri = `${config.steam.realm}/api/auth/discord/callback`;
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64url');
  const url = `https://discord.com/api/oauth2/authorize?client_id=${config.discord.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify&state=${state}`;
  res.json({ url });
});

// Discord OAuth2 callback
router.get('/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.redirect(`${config.webUrl}/settings?error=discord_failed`);
  }

  let userId;
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString());
    userId = decoded.userId;
  } catch {
    return res.redirect(`${config.webUrl}/settings?error=invalid_state`);
  }

  try {
    const redirectUri = `${config.steam.realm}/api/auth/discord/callback`;

    // Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.redirect(`${config.webUrl}/settings?error=discord_token_failed`);
    }

    // Fetch Discord user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const discordUser = await userRes.json();

    // Update user with Discord info
    Users.update(userId, {
      discord_id: discordUser.id,
      discord_name: `${discordUser.username}`,
    });

    audit(userId, 'discord_linked', `Linked Discord: ${discordUser.username} (${discordUser.id})`);

    // Trigger role sync for this user if the bot module is available
    try {
      const { syncUserRoles } = require('../discord/bot');
      await syncUserRoles(discordUser.id);
    } catch {
      // Bot may not be initialized yet
    }

    res.redirect(`${config.webUrl}/settings?discord=linked`);
  } catch (err) {
    console.error('Discord OAuth error:', err);
    res.redirect(`${config.webUrl}/settings?error=discord_failed`);
  }
});

// Unlink Discord account
router.post('/unlink-discord', requireAuth, (req, res) => {
  Users.update(req.user.id, { discord_id: null, discord_name: '' });
  UserDepartments.setForUser(req.user.id, []);
  audit(req.user.id, 'discord_unlinked', 'Unlinked Discord account');
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  const options = {
    httpOnly: true,
    secure: !!config.auth.cookieSecure,
    sameSite: config.auth.cookieSameSite || 'Lax',
    path: '/',
  };
  if (config.auth.cookieDomain) {
    options.domain = config.auth.cookieDomain;
  }
  res.clearCookie(config.auth.cookieName, options);
  res.json({ success: true });
});

module.exports = router;
