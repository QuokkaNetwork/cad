module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sub_departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        short_name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#0052C2',
        is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_departments_unique_name ON sub_departments(department_id, name);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_departments_unique_short ON sub_departments(department_id, short_name);

      CREATE TABLE IF NOT EXISTS user_sub_departments (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sub_department_id INTEGER NOT NULL REFERENCES sub_departments(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, sub_department_id)
      );

      CREATE TABLE IF NOT EXISTS discord_role_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_role_id TEXT NOT NULL,
        discord_role_name TEXT NOT NULL DEFAULT '',
        target_type TEXT NOT NULL CHECK(target_type IN ('department','sub_department')),
        target_id INTEGER NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_role_links_unique ON discord_role_links(discord_role_id, target_type, target_id);
    `);

    const hasLegacy = db.prepare(`
      SELECT 1 as ok
      FROM sqlite_master
      WHERE type = 'table' AND name = 'discord_role_mappings'
      LIMIT 1
    `).get();

    if (hasLegacy) {
      db.exec(`
        INSERT OR IGNORE INTO discord_role_links (discord_role_id, discord_role_name, target_type, target_id)
        SELECT discord_role_id, discord_role_name, 'department', department_id
        FROM discord_role_mappings
      `);
    }

    const unitsColumns = db.prepare(`PRAGMA table_info(units)`).all();
    const hasSubDeptColumn = unitsColumns.some(c => c.name === 'sub_department_id');
    if (!hasSubDeptColumn) {
      db.exec(`ALTER TABLE units ADD COLUMN sub_department_id INTEGER REFERENCES sub_departments(id)`);
    }
  },
};
