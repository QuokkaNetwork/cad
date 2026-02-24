module.exports = {
  up(db) {
    const departmentColumns = db.prepare("PRAGMA table_info('departments')").all();

    if (!departmentColumns.some((column) => column.name === 'department_leader_role_ids')) {
      db.exec("ALTER TABLE departments ADD COLUMN department_leader_role_ids TEXT NOT NULL DEFAULT ''");
    }

    if (!departmentColumns.some((column) => column.name === 'application_template')) {
      db.exec("ALTER TABLE departments ADD COLUMN application_template TEXT NOT NULL DEFAULT ''");
    }
  },
};

