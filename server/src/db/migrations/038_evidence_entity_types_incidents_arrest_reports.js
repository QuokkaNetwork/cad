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

function createEvidenceIndexes(db) {
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evidence_entity ON evidence_items(entity_type, entity_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evidence_department ON evidence_items(department_id, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evidence_case_number ON evidence_items(case_number)`);
}

exports.up = (db) => {
  if (!tableExists(db, 'evidence_items')) {
    return;
  }

  const schemaRow = db.prepare(`
    SELECT sql
    FROM sqlite_master
    WHERE type = 'table' AND name = 'evidence_items'
    LIMIT 1
  `).get();
  const schemaSql = String(schemaRow?.sql || '').toLowerCase();
  const supportsIncident = schemaSql.includes("'incident'");
  const supportsArrestReport = schemaSql.includes("'arrest_report'");

  if (supportsIncident && supportsArrestReport) {
    createEvidenceIndexes(db);
    return;
  }

  const migrate = db.transaction(() => {
    db.exec('DROP INDEX IF EXISTS idx_evidence_entity');
    db.exec('DROP INDEX IF EXISTS idx_evidence_department');
    db.exec('DROP INDEX IF EXISTS idx_evidence_case_number');

    db.exec('ALTER TABLE evidence_items RENAME TO evidence_items_old');

    db.exec(`
      CREATE TABLE evidence_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('criminal_record', 'arrest_report', 'warrant', 'incident')),
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

    db.exec(`
      INSERT INTO evidence_items (
        id,
        entity_type,
        entity_id,
        department_id,
        case_number,
        title,
        description,
        photo_url,
        chain_status,
        metadata_json,
        created_by_user_id,
        created_at,
        updated_at
      )
      SELECT
        id,
        CASE
          WHEN lower(trim(COALESCE(entity_type, ''))) IN ('criminal_record', 'arrest_report', 'warrant', 'incident')
            THEN lower(trim(entity_type))
          ELSE 'criminal_record'
        END,
        COALESCE(entity_id, 0),
        department_id,
        COALESCE(case_number, ''),
        COALESCE(title, ''),
        COALESCE(description, ''),
        COALESCE(photo_url, ''),
        COALESCE(chain_status, 'logged'),
        COALESCE(metadata_json, '{}'),
        created_by_user_id,
        COALESCE(created_at, datetime('now')),
        COALESCE(updated_at, COALESCE(created_at, datetime('now')))
      FROM evidence_items_old
    `);

    db.exec('DROP TABLE evidence_items_old');
    createEvidenceIndexes(db);
  });

  migrate();
  console.log('Migration 038 applied: expanded evidence entity types to include arrest reports and incidents');
};
