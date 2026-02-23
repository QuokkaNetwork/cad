function hasColumn(db, tableName, columnName) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some((row) => String(row?.name || '').trim().toLowerCase() === String(columnName || '').trim().toLowerCase());
  } catch {
    return false;
  }
}

function addColumnIfMissing(db, tableName, columnName, columnSql) {
  if (hasColumn(db, tableName, columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql}`);
}

exports.up = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS traffic_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      call_id INTEGER REFERENCES calls(id) ON DELETE SET NULL,
      unit_id INTEGER,
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      location TEXT NOT NULL DEFAULT '',
      postal TEXT NOT NULL DEFAULT '',
      plate TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      outcome TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      position_x REAL,
      position_y REAL,
      position_z REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traffic_stops_department_created ON traffic_stops(department_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traffic_stops_call ON traffic_stops(call_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traffic_stops_plate ON traffic_stops(plate)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_traffic_stops_user ON traffic_stops(created_by_user_id, created_at DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS evidence_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('criminal_record', 'warrant')),
      entity_id INTEGER NOT NULL,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      case_number TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      photo_url TEXT NOT NULL DEFAULT '',
      chain_status TEXT NOT NULL DEFAULT 'logged',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evidence_entity ON evidence_items(entity_type, entity_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evidence_department ON evidence_items(department_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evidence_case_number ON evidence_items(case_number)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS shift_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      unit_id INTEGER,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_shift_notes_department_created ON shift_notes(department_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_shift_notes_user_department ON shift_notes(user_id, department_id, created_at DESC)`);

  addColumnIfMissing(db, 'patient_analyses', 'treatment_log_json', "treatment_log_json TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(db, 'patient_analyses', 'transport_json', "transport_json TEXT NOT NULL DEFAULT '{}'");
  addColumnIfMissing(db, 'patient_analyses', 'mci_incident_key', "mci_incident_key TEXT NOT NULL DEFAULT ''");
  addColumnIfMissing(db, 'patient_analyses', 'mci_tag', "mci_tag TEXT NOT NULL DEFAULT ''");
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_analyses_mci_incident_key ON patient_analyses(mci_incident_key)`);

  console.log('Migration 026 applied: added traffic stops, evidence items, shift notes, and patient analysis treatment/transport/MCI fields');
};
