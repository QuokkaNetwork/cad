exports.up = (db) => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS patient_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      citizen_id TEXT NOT NULL,
      patient_name TEXT NOT NULL DEFAULT '',
      department_id INTEGER,
      triage_category TEXT NOT NULL DEFAULT 'undetermined',
      chief_complaint TEXT NOT NULL DEFAULT '',
      pain_score INTEGER NOT NULL DEFAULT 0,
      questionnaire_json TEXT NOT NULL DEFAULT '{}',
      vitals_json TEXT NOT NULL DEFAULT '{}',
      body_marks_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      created_by_user_id INTEGER,
      updated_by_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(department_id) REFERENCES departments(id) ON DELETE SET NULL,
      FOREIGN KEY(created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY(updated_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_analyses_citizen ON patient_analyses(citizen_id, updated_at)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_patient_analyses_triage ON patient_analyses(triage_category)`);

  console.log('Migration 025 applied: added patient_analyses');
};
