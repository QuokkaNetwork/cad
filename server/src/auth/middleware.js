const { verifyToken } = require('./jwt');
const { Users, UserDepartments } = require('../db/sqlite');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = verifyToken(token);
    const user = Users.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.is_banned) {
      return res.status(403).json({ error: 'Account is banned' });
    }
    user.departments = UserDepartments.getForUser(user.id);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireDepartment(departmentId) {
  return (req, res, next) => {
    if (req.user.is_admin) return next();
    const hasDept = req.user.departments.some(d => d.id === departmentId);
    if (!hasDept) {
      return res.status(403).json({ error: 'Department access denied' });
    }
    next();
  };
}

function requireAdmin(req, res, next) {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireDepartment, requireAdmin };
