module.exports = {
  up(db) {
    const userColumns = db.prepare('PRAGMA table_info(users)').all();
    if (!userColumns.some(c => c.name === 'preferred_citizen_id')) {
      db.exec("ALTER TABLE users ADD COLUMN preferred_citizen_id TEXT NOT NULL DEFAULT ''");
    }
  },
};
