module.exports = {
  up(db) {
    db.exec(`
      ALTER TABLE departments ADD COLUMN dispatch_visible INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE departments ADD COLUMN is_dispatch INTEGER NOT NULL DEFAULT 0;
    `);

    // Mark "Police Communications" (DISPATCH) as a dispatch centre
    db.prepare(`UPDATE departments SET is_dispatch = 1 WHERE short_name = 'DISPATCH'`).run();

    // Make all non-dispatch departments visible to dispatch by default
    db.prepare(`UPDATE departments SET dispatch_visible = 1 WHERE is_dispatch = 0`).run();
  },
};
