module.exports = {
  up(db) {
    const deptColumns = db.prepare('PRAGMA table_info(departments)').all();
    if (!deptColumns.some(c => c.name === 'fivem_job_name')) {
      db.exec("ALTER TABLE departments ADD COLUMN fivem_job_name TEXT NOT NULL DEFAULT ''");
    }
    if (!deptColumns.some(c => c.name === 'fivem_job_grade')) {
      db.exec('ALTER TABLE departments ADD COLUMN fivem_job_grade INTEGER NOT NULL DEFAULT 0');
    }

    const subDeptColumns = db.prepare('PRAGMA table_info(sub_departments)').all();
    if (!subDeptColumns.some(c => c.name === 'fivem_job_name')) {
      db.exec("ALTER TABLE sub_departments ADD COLUMN fivem_job_name TEXT NOT NULL DEFAULT ''");
    }
    if (!subDeptColumns.some(c => c.name === 'fivem_job_grade')) {
      db.exec('ALTER TABLE sub_departments ADD COLUMN fivem_job_grade INTEGER NOT NULL DEFAULT 0');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS fivem_job_sync_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        steam_id TEXT NOT NULL DEFAULT '',
        discord_id TEXT NOT NULL DEFAULT '',
        citizen_id TEXT NOT NULL DEFAULT '',
        job_name TEXT NOT NULL DEFAULT '',
        job_grade INTEGER NOT NULL DEFAULT 0,
        source_type TEXT NOT NULL DEFAULT 'none' CHECK(source_type IN ('department', 'sub_department', 'fallback', 'none')),
        source_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed', 'cancelled')),
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_fivem_job_sync_jobs_status_created ON fivem_job_sync_jobs(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_fivem_job_sync_jobs_user_created ON fivem_job_sync_jobs(user_id, created_at);
    `);
  },
};
