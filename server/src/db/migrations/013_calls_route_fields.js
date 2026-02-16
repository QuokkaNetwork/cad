module.exports = {
  up(db) {
    const columns = new Set(
      db.prepare('PRAGMA table_info(calls)').all().map((row) => String(row.name || '').trim())
    );

    if (!columns.has('postal')) {
      db.exec("ALTER TABLE calls ADD COLUMN postal TEXT NOT NULL DEFAULT ''");
    }
    if (!columns.has('position_x')) {
      db.exec('ALTER TABLE calls ADD COLUMN position_x REAL');
    }
    if (!columns.has('position_y')) {
      db.exec('ALTER TABLE calls ADD COLUMN position_y REAL');
    }
    if (!columns.has('position_z')) {
      db.exec('ALTER TABLE calls ADD COLUMN position_z REAL');
    }
  },
};
