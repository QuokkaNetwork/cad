module.exports = {
  up(db) {
    const columns = new Set(
      db.prepare('PRAGMA table_info(calls)').all().map((row) => String(row.name || '').trim())
    );

    if (!columns.has('requested_department_ids_json')) {
      db.exec("ALTER TABLE calls ADD COLUMN requested_department_ids_json TEXT NOT NULL DEFAULT '[]'");
    }

    db.exec(`
      UPDATE calls
      SET requested_department_ids_json = '[' || CAST(department_id AS TEXT) || ']'
      WHERE TRIM(COALESCE(requested_department_ids_json, '')) = ''
         OR requested_department_ids_json = '[]'
    `);
  },

  down(_db) {
    // SQLite does not support DROP COLUMN without table rebuild.
  },
};
