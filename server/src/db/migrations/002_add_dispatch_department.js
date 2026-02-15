module.exports = {
  up(db) {
    db.prepare(`
      INSERT OR IGNORE INTO departments (name, short_name, color, icon, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run('Police Communications', 'DISPATCH', '#1F2937', '', 1);
  },
};
