module.exports = {
  up(db) {
    const columns = db.prepare("PRAGMA table_info('criminal_records')").all();
    const hasJailMinutes = columns.some((column) => column.name === 'jail_minutes');
    if (!hasJailMinutes) {
      db.exec('ALTER TABLE criminal_records ADD COLUMN jail_minutes INTEGER NOT NULL DEFAULT 0');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS fivem_jail_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        citizen_id TEXT NOT NULL,
        jail_minutes INTEGER NOT NULL DEFAULT 0,
        reason TEXT NOT NULL DEFAULT '',
        issued_by_user_id INTEGER REFERENCES users(id),
        source_record_id INTEGER REFERENCES criminal_records(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed', 'cancelled')),
        error TEXT NOT NULL DEFAULT '',
        sent_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_fivem_jail_jobs_status_created ON fivem_jail_jobs(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_fivem_jail_jobs_citizen_status ON fivem_jail_jobs(citizen_id, status);
      CREATE INDEX IF NOT EXISTS idx_fivem_jail_jobs_source_record ON fivem_jail_jobs(source_record_id);
    `);
  },
};
