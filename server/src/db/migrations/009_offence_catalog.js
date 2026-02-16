module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS offence_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL CHECK(category IN ('infringement', 'summary', 'indictment')),
        code TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        fine_amount REAL NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_offence_catalog_category_code
      ON offence_catalog(category, code)
      WHERE trim(code) != '';

      CREATE INDEX IF NOT EXISTS idx_offence_catalog_active_sort
      ON offence_catalog(is_active, category, sort_order, title);
    `);

    const recordColumns = db.prepare('PRAGMA table_info(criminal_records)').all();
    const hasOffenceItems = recordColumns.some(c => c.name === 'offence_items_json');
    if (!hasOffenceItems) {
      db.exec("ALTER TABLE criminal_records ADD COLUMN offence_items_json TEXT NOT NULL DEFAULT '[]'");
    }
  },
};
