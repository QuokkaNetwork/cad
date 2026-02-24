module.exports = {
  up(db) {
    const departmentColumns = db.prepare("PRAGMA table_info('departments')").all();
    if (!departmentColumns.some((column) => column.name === 'application_form_schema')) {
      db.exec("ALTER TABLE departments ADD COLUMN application_form_schema TEXT NOT NULL DEFAULT ''");
    }

    const applicationColumns = db.prepare("PRAGMA table_info('department_applications')").all();
    if (!applicationColumns.some((column) => column.name === 'form_answers_json')) {
      db.exec("ALTER TABLE department_applications ADD COLUMN form_answers_json TEXT NOT NULL DEFAULT ''");
    }
  },
};

