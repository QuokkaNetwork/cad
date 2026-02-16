module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS warrants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER NOT NULL REFERENCES departments(id),
        citizen_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'served', 'cancelled')),
        created_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_warrants_department ON warrants(department_id);
      CREATE INDEX IF NOT EXISTS idx_warrants_citizen ON warrants(citizen_id);
      CREATE INDEX IF NOT EXISTS idx_warrants_status ON warrants(status);
    `);
  },

  down(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_warrants_status;
      DROP INDEX IF EXISTS idx_warrants_citizen;
      DROP INDEX IF EXISTS idx_warrants_department;
      DROP TABLE IF EXISTS warrants;
    `);
  },
};
