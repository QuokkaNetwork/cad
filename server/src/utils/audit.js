const { AuditLog } = require('../db/sqlite');

function audit(userId, action, details) {
  AuditLog.add({ user_id: userId, action, details });
}

module.exports = { audit };
