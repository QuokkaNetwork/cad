module.exports = {
  up(db) {
    const departmentColumns = db.prepare('PRAGMA table_info(departments)').all();
    if (!departmentColumns.some((column) => column.name === 'applications_open')) {
      db.exec('ALTER TABLE departments ADD COLUMN applications_open INTEGER NOT NULL DEFAULT 0');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS department_applications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'withdrawn')),
        message TEXT NOT NULL DEFAULT '',
        review_notes TEXT NOT NULL DEFAULT '',
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_department_applications_user_id
        ON department_applications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_department_applications_department_id
        ON department_applications(department_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_department_applications_status
        ON department_applications(status, created_at DESC);
    `);
  },
};
