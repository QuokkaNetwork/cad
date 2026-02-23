function tableExists(db, tableName) {
  try {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(?)"
    ).get(tableName);
    return !!row;
  } catch {
    return false;
  }
}

function hasColumn(db, tableName, columnName) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some((row) => String(row?.name || '').trim().toLowerCase() === String(columnName || '').trim().toLowerCase());
  } catch {
    return false;
  }
}

exports.up = (db) => {
  if (!tableExists(db, 'pursuit_outcomes')) {
    db.exec(`
      CREATE TABLE pursuit_outcomes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        call_id INTEGER NOT NULL,
        department_id INTEGER NOT NULL,
        primary_unit_id INTEGER,
        outcome_code TEXT NOT NULL DEFAULT 'other',
        termination_location TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        involved_units_json TEXT NOT NULL DEFAULT '[]',
        created_by_user_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  if (!hasColumn(db, 'pursuit_outcomes', 'involved_units_json')) {
    db.exec(`ALTER TABLE pursuit_outcomes ADD COLUMN involved_units_json TEXT NOT NULL DEFAULT '[]'`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_pursuit_outcomes_call_id ON pursuit_outcomes(call_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pursuit_outcomes_department_id ON pursuit_outcomes(department_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_pursuit_outcomes_created_at ON pursuit_outcomes(created_at)`);

  console.log('Migration 028 applied: added pursuit_outcomes table');
};
