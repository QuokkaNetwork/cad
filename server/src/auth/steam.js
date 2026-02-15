const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const config = require('../config');
const { Users } = require('../db/sqlite');

function initSteamAuth() {
  if (!config.steam.apiKey) {
    console.warn('STEAM_API_KEY not set - Steam authentication disabled');
    return;
  }

  passport.use(new SteamStrategy(
    {
      returnURL: config.steam.returnUrl,
      realm: config.steam.realm,
      apiKey: config.steam.apiKey,
    },
    (identifier, profile, done) => {
      const steamId = profile.id;
      const displayName = profile.displayName || '';
      const avatarUrl = profile.photos?.[2]?.value || profile.photos?.[0]?.value || '';

      let user = Users.findBySteamId(steamId);
      if (!user) {
        user = Users.create({
          steam_id: steamId,
          steam_name: displayName,
          avatar_url: avatarUrl,
        });
      } else {
        Users.update(user.id, {
          steam_name: displayName,
          avatar_url: avatarUrl,
        });
        user = Users.findById(user.id);
      }

      done(null, user);
    }
  ));

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => {
    const user = Users.findById(id);
    done(null, user);
  });
}

module.exports = { initSteamAuth };
