const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../shared/config');
const { getUserByUsername } = require('./db');

function issueToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

function login(username, password) {
  const user = getUserByUsername(username);
  if (!user) {
    return null;
  }

  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) {
    return null;
  }

  return {
    token: issueToken(user),
    user: { id: user.id, username: user.username, role: user.role },
  };
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = {
  login,
  authMiddleware,
};
