module.exports = {
  up(db) {
    const columns = new Set(
      db.prepare('PRAGMA table_info(field_mappings)').all().map((row) => String(row.name || '').trim())
    );

    if (!columns.has('field_key')) {
      db.exec("ALTER TABLE field_mappings ADD COLUMN field_key TEXT NOT NULL DEFAULT ''");
    }
    if (!columns.has('field_type')) {
      db.exec("ALTER TABLE field_mappings ADD COLUMN field_type TEXT NOT NULL DEFAULT 'text'");
    }
    if (!columns.has('preview_width')) {
      db.exec('ALTER TABLE field_mappings ADD COLUMN preview_width INTEGER NOT NULL DEFAULT 1');
    }

    db.exec(`
      UPDATE field_mappings
      SET field_key = lower(
        trim(
          replace(
            replace(
              replace(
                replace(label, ' ', '_'),
              '-', '_'),
            '.', ''),
          '/', '_')
        )
      )
      WHERE trim(coalesce(field_key, '')) = ''
    `);

    db.exec(`
      UPDATE field_mappings
      SET field_type = CASE
        WHEN lower(label) LIKE '%photo%' OR lower(label) LIKE '%image%' THEN 'image'
        WHEN lower(label) LIKE '%dob%' OR lower(label) LIKE '%date%' THEN 'date'
        ELSE 'text'
      END
      WHERE trim(coalesce(field_type, '')) = ''
    `);

    db.exec(`
      UPDATE field_mappings
      SET preview_width = 1
      WHERE preview_width IS NULL OR preview_width < 1
    `);
  },
};
