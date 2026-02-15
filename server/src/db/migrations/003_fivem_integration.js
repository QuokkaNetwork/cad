module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS fivem_player_links (
        steam_id TEXT PRIMARY KEY NOT NULL,
        game_id TEXT NOT NULL DEFAULT '',
        citizen_id TEXT NOT NULL DEFAULT '',
        player_name TEXT NOT NULL DEFAULT '',
        position_x REAL DEFAULT 0,
        position_y REAL DEFAULT 0,
        position_z REAL DEFAULT 0,
        heading REAL DEFAULT 0,
        speed REAL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS fivem_fine_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        citizen_id TEXT NOT NULL,
        amount REAL NOT NULL DEFAULT 0,
        reason TEXT NOT NULL DEFAULT '',
        issued_by_user_id INTEGER REFERENCES users(id),
        source_record_id INTEGER REFERENCES criminal_records(id),
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed', 'cancelled')),
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_fivem_fine_jobs_status_created ON fivem_fine_jobs(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_fivem_fine_jobs_citizen ON fivem_fine_jobs(citizen_id);
    `);
  },
};
