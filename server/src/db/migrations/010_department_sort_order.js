module.exports = {
  up(db) {
    const deptCols = db.prepare('PRAGMA table_info(departments)').all();
    const hasDeptSortOrder = deptCols.some(c => c.name === 'sort_order');
    if (!hasDeptSortOrder) {
      db.exec('ALTER TABLE departments ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    }

    const subCols = db.prepare('PRAGMA table_info(sub_departments)').all();
    const hasSubSortOrder = subCols.some(c => c.name === 'sort_order');
    if (!hasSubSortOrder) {
      db.exec('ALTER TABLE sub_departments ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    }

    const deptRows = db.prepare('SELECT id FROM departments ORDER BY sort_order ASC, id ASC').all();
    const setDeptOrder = db.prepare('UPDATE departments SET sort_order = ? WHERE id = ?');
    deptRows.forEach((row, index) => {
      setDeptOrder.run(index, row.id);
    });

    const subRows = db.prepare(`
      SELECT id, department_id
      FROM sub_departments
      ORDER BY department_id ASC, sort_order ASC, name ASC, id ASC
    `).all();
    const setSubOrder = db.prepare('UPDATE sub_departments SET sort_order = ? WHERE id = ?');
    const counters = new Map();
    for (const row of subRows) {
      const next = counters.get(row.department_id) || 0;
      setSubOrder.run(next, row.id);
      counters.set(row.department_id, next + 1);
    }
  },
};

