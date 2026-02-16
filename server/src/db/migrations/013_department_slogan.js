module.exports = {
  up(db) {
    const deptCols = db.prepare('PRAGMA table_info(departments)').all();
    const hasSlogan = deptCols.some(c => c.name === 'slogan');
    if (!hasSlogan) {
      db.exec("ALTER TABLE departments ADD COLUMN slogan TEXT NOT NULL DEFAULT ''");
    }
  },
};
