exports.up = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cad_warnings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_type TEXT NOT NULL CHECK(subject_type IN ('person', 'vehicle')),
      subject_key TEXT NOT NULL DEFAULT '',
      subject_display TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'cancelled')),
      officer_name TEXT NOT NULL DEFAULT '',
      officer_callsign TEXT NOT NULL DEFAULT '',
      department_id INTEGER,
      created_by_user_id INTEGER,
      resolved_by_user_id INTEGER,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_cad_warnings_subject ON cad_warnings(subject_type, subject_key)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_cad_warnings_status ON cad_warnings(status)');

  db.exec("ALTER TABLE criminal_records ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'finalized'");
  db.exec('ALTER TABLE criminal_records ADD COLUMN finalized_record_id INTEGER');
  db.exec('ALTER TABLE criminal_records ADD COLUMN finalized_at TEXT');
  db.exec('ALTER TABLE criminal_records ADD COLUMN finalized_by_user_id INTEGER');
};

