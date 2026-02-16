module.exports = {
  up(db) {
    const columns = new Set(
      db.prepare('PRAGMA table_info(field_mappings)').all().map((row) => String(row.name || '').trim())
    );

    if (!columns.has('friendly_values_json')) {
      db.exec("ALTER TABLE field_mappings ADD COLUMN friendly_values_json TEXT NOT NULL DEFAULT ''");
    }

    db.exec(`
      UPDATE field_mappings
      SET friendly_values_json = ''
      WHERE friendly_values_json IS NULL
    `);
  },
};
