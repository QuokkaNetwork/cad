module.exports = {
  up(db) {
    const columns = new Set(
      db.prepare('PRAGMA table_info(calls)').all().map((row) => String(row.name || '').trim())
    );

    if (!columns.has('was_ever_assigned')) {
      db.exec("ALTER TABLE calls ADD COLUMN was_ever_assigned INTEGER NOT NULL DEFAULT 0");
    }

    db.exec(`
      UPDATE calls
      SET was_ever_assigned = 1
      WHERE id IN (
        SELECT DISTINCT call_id
        FROM call_units
      )
    `);
  },
};
