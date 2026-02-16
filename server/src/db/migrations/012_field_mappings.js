module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS field_mapping_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        entity_type TEXT NOT NULL DEFAULT 'person' CHECK(entity_type IN ('person', 'vehicle')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_fmc_name_entity
      ON field_mapping_categories(name, entity_type);

      CREATE TABLE IF NOT EXISTS field_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL REFERENCES field_mapping_categories(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        table_name TEXT NOT NULL,
        column_name TEXT NOT NULL,
        is_json INTEGER NOT NULL DEFAULT 0,
        json_key TEXT NOT NULL DEFAULT '',
        character_join_column TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_search_column INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_fm_category
      ON field_mappings(category_id, sort_order);
    `);

    // Seed default Character Info category with mappings matching current hardcoded behavior
    const cfg = (key, fallback) => {
      const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return (row && row.value) || fallback;
    };

    const playersTable = cfg('qbox_players_table', 'players');
    const charInfoCol = cfg('qbox_charinfo_col', 'charinfo');
    const citizenIdCol = cfg('qbox_citizenid_col', 'citizenid');

    db.prepare(
      "INSERT INTO field_mapping_categories (name, entity_type, sort_order) VALUES (?, 'person', 0)"
    ).run('Character Info');

    const catId = db.prepare('SELECT last_insert_rowid() as id').get().id;

    const insert = db.prepare(`
      INSERT INTO field_mappings
        (category_id, label, table_name, column_name, is_json, json_key, character_join_column, sort_order, is_search_column)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaults = [
      { label: 'First Name', jsonKey: 'firstname', sort: 0, search: 1 },
      { label: 'Last Name', jsonKey: 'lastname', sort: 1, search: 1 },
      { label: 'Date of Birth', jsonKey: 'birthdate', sort: 2, search: 0 },
      { label: 'Gender', jsonKey: 'gender', sort: 3, search: 0 },
      { label: 'Phone', jsonKey: 'phone', sort: 4, search: 0 },
      { label: 'Nationality', jsonKey: 'nationality', sort: 5, search: 0 },
    ];

    for (const f of defaults) {
      insert.run(catId, f.label, playersTable, charInfoCol, 1, f.jsonKey, citizenIdCol, f.sort, f.search);
    }
  },
};
