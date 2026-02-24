module.exports = {
  up(db) {
    const userColumns = db.prepare('PRAGMA table_info(users)').all();
    if (!userColumns.some(c => c.name === 'rules_agreed_version')) {
      db.exec("ALTER TABLE users ADD COLUMN rules_agreed_version TEXT NOT NULL DEFAULT ''");
    }
    if (!userColumns.some(c => c.name === 'rules_agreed_at')) {
      db.exec('ALTER TABLE users ADD COLUMN rules_agreed_at TEXT');
    }
  },
};
