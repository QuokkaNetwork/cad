exports.up = (db) => {
  // Support warrant matching by person name (citizen_id remains optional for exact matching).
  db.exec(`ALTER TABLE warrants ADD COLUMN subject_name TEXT NOT NULL DEFAULT ''`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_warrants_subject_name ON warrants(subject_name)`);

  console.log('Migration 024 applied: added subject_name to warrants');
};
