module.exports = {
  up(db) {
    const columns = db.prepare('PRAGMA table_info(user_departments)').all();
    const hasEmsCallsignColumn = columns.some((column) => column.name === 'ems_callsign_number');

    if (!hasEmsCallsignColumn) {
      db.exec('ALTER TABLE user_departments ADD COLUMN ems_callsign_number INTEGER');
    }

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_departments_ems_callsign_per_department
      ON user_departments(department_id, ems_callsign_number)
      WHERE ems_callsign_number IS NOT NULL
    `);

    const paramedicDepartments = db.prepare(`
      SELECT id
      FROM departments
      WHERE lower(COALESCE(layout_type, '')) = 'paramedics'
        AND COALESCE(is_dispatch, 0) = 0
    `).all();

    if (!Array.isArray(paramedicDepartments) || paramedicDepartments.length === 0) return;

    const listMembersStmt = db.prepare(`
      SELECT user_id, department_id, ems_callsign_number
      FROM user_departments
      WHERE department_id = ?
      ORDER BY user_id ASC
    `);
    const existsStmt = db.prepare(`
      SELECT 1
      FROM user_departments
      WHERE department_id = ? AND ems_callsign_number = ?
      LIMIT 1
    `);
    const updateStmt = db.prepare(`
      UPDATE user_departments
      SET ems_callsign_number = ?
      WHERE user_id = ? AND department_id = ?
    `);

    function normalize(value) {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1000 || n > 9999) return null;
      return n;
    }

    function generateForDepartment(deptId, reserved = new Set()) {
      const isTaken = (candidate) => {
        if (!Number.isInteger(candidate) || candidate < 1000 || candidate > 9999) return true;
        if (reserved.has(candidate)) return true;
        return !!existsStmt.get(deptId, candidate);
      };

      for (let i = 0; i < 500; i += 1) {
        const candidate = 1000 + Math.floor(Math.random() * 9000);
        if (!isTaken(candidate)) return candidate;
      }
      for (let candidate = 1000; candidate <= 9999; candidate += 1) {
        if (!isTaken(candidate)) return candidate;
      }
      throw new Error(`No EMS callsign numbers available for department ${deptId}`);
    }

    for (const dept of paramedicDepartments) {
      const deptId = Number(dept?.id || 0);
      if (!deptId) continue;
      const rows = listMembersStmt.all(deptId);
      const reserved = new Set();

      for (const row of rows) {
        const existing = normalize(row?.ems_callsign_number);
        if (existing) reserved.add(existing);
      }

      for (const row of rows) {
        const existing = normalize(row?.ems_callsign_number);
        if (existing) continue;
        const next = generateForDepartment(deptId, reserved);
        reserved.add(next);
        updateStmt.run(next, row.user_id, deptId);
      }
    }
  },
};

