exports.up = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_citizen_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      citizen_id TEXT NOT NULL COLLATE NOCASE,
      source TEXT NOT NULL DEFAULT 'unknown',
      first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, citizen_id)
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_citizen_links_user_last_seen ON user_citizen_links(user_id, last_seen_at DESC)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_citizen_links_citizen_last_seen ON user_citizen_links(citizen_id, last_seen_at DESC)');

  // Backfill from the legacy single preferred citizen ID field.
  db.exec(`
    INSERT OR IGNORE INTO user_citizen_links (
      user_id, citizen_id, source, first_seen_at, last_seen_at, created_at, updated_at
    )
    SELECT
      u.id,
      TRIM(u.preferred_citizen_id),
      'preferred_backfill',
      COALESCE(NULLIF(u.updated_at, ''), datetime('now')),
      COALESCE(NULLIF(u.updated_at, ''), datetime('now')),
      datetime('now'),
      datetime('now')
    FROM users u
    WHERE TRIM(COALESCE(u.preferred_citizen_id, '')) <> ''
  `);

  // Backfill from historical queued/sent FiveM job sync jobs.
  db.exec(`
    INSERT OR IGNORE INTO user_citizen_links (
      user_id, citizen_id, source, first_seen_at, last_seen_at, created_at, updated_at
    )
    SELECT
      j.user_id,
      TRIM(j.citizen_id),
      'fivem_job_sync_history',
      COALESCE(MIN(NULLIF(j.created_at, '')), datetime('now')),
      COALESCE(MAX(NULLIF(j.updated_at, '')), MAX(NULLIF(j.created_at, '')), datetime('now')),
      datetime('now'),
      datetime('now')
    FROM fivem_job_sync_jobs j
    WHERE j.user_id IS NOT NULL
      AND TRIM(COALESCE(j.citizen_id, '')) <> ''
    GROUP BY j.user_id, LOWER(TRIM(j.citizen_id))
  `);
};

