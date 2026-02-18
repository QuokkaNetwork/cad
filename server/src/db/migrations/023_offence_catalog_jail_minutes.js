module.exports = {
  up(db) {
    const columns = db.prepare("PRAGMA table_info('offence_catalog')").all();
    const hasJailMinutes = columns.some((column) => column.name === 'jail_minutes');
    if (!hasJailMinutes) {
      db.exec('ALTER TABLE offence_catalog ADD COLUMN jail_minutes INTEGER NOT NULL DEFAULT 0');
    }
  },
};
