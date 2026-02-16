module.exports = {
  up(db) {
    const deptColumns = db.prepare('PRAGMA table_info(departments)').all();
    const hasLayoutType = deptColumns.some(c => c.name === 'layout_type');
    if (!hasLayoutType) {
      db.exec("ALTER TABLE departments ADD COLUMN layout_type TEXT NOT NULL DEFAULT 'law_enforcement'");
    }

    // Normalize empty/invalid values first.
    db.exec(`
      UPDATE departments
      SET layout_type = 'law_enforcement'
      WHERE layout_type IS NULL
        OR trim(layout_type) = ''
        OR layout_type NOT IN ('law_enforcement', 'paramedics', 'fire')
    `);

    // Best-effort defaults for existing seeded departments.
    db.exec(`
      UPDATE departments
      SET layout_type = 'paramedics'
      WHERE lower(short_name) IN ('av', 'ems')
         OR lower(name) LIKE '%ambulance%'
         OR lower(name) LIKE '%paramedic%'
         OR lower(name) LIKE '%medical%'
    `);

    db.exec(`
      UPDATE departments
      SET layout_type = 'fire'
      WHERE lower(short_name) IN ('frv', 'fire')
         OR lower(name) LIKE '%fire%'
         OR lower(name) LIKE '%rescue%'
    `);
  },
};

