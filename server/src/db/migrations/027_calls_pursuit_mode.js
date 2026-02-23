function hasColumn(db, tableName, columnName) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some((row) => String(row?.name || '').trim().toLowerCase() === String(columnName || '').trim().toLowerCase());
  } catch {
    return false;
  }
}

exports.up = (db) => {
  if (!hasColumn(db, 'calls', 'pursuit_mode_enabled')) {
    db.exec(`ALTER TABLE calls ADD COLUMN pursuit_mode_enabled INTEGER NOT NULL DEFAULT 0`);
  }
  if (!hasColumn(db, 'calls', 'pursuit_primary_unit_id')) {
    db.exec(`ALTER TABLE calls ADD COLUMN pursuit_primary_unit_id INTEGER`);
  }
  if (!hasColumn(db, 'calls', 'pursuit_updated_at')) {
    db.exec(`ALTER TABLE calls ADD COLUMN pursuit_updated_at TEXT`);
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_calls_pursuit_mode_enabled ON calls(pursuit_mode_enabled)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_calls_pursuit_primary_unit_id ON calls(pursuit_primary_unit_id)`);

  console.log('Migration 027 applied: added pursuit mode fields to calls');
};
