module.exports = {
  up(db) {
    const tableExists = db.prepare(`
      SELECT 1 AS ok
      FROM sqlite_master
      WHERE type = 'table' AND name = 'discord_role_links'
      LIMIT 1
    `).get();
    if (!tableExists) return;

    const columns = db.prepare('PRAGMA table_info(discord_role_links)').all();
    const hasJobName = columns.some(c => c.name === 'job_name');
    const hasJobGrade = columns.some(c => c.name === 'job_grade');

    const tableSqlRow = db.prepare(`
      SELECT sql
      FROM sqlite_master
      WHERE type = 'table' AND name = 'discord_role_links'
      LIMIT 1
    `).get();
    const tableSql = String(tableSqlRow?.sql || '').toLowerCase();
    const supportsJobType = tableSql.includes("'job'");

    if (!hasJobName || !hasJobGrade || !supportsJobType) {
      db.exec('DROP INDEX IF EXISTS idx_discord_role_links_unique;');
      db.exec('ALTER TABLE discord_role_links RENAME TO discord_role_links_old;');

      db.exec(`
        CREATE TABLE discord_role_links (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          discord_role_id TEXT NOT NULL,
          discord_role_name TEXT NOT NULL DEFAULT '',
          target_type TEXT NOT NULL CHECK(target_type IN ('department','sub_department','job')),
          target_id INTEGER NOT NULL DEFAULT 0,
          job_name TEXT NOT NULL DEFAULT '',
          job_grade INTEGER NOT NULL DEFAULT 0
        );
      `);

      if (hasJobName && hasJobGrade) {
        db.exec(`
          INSERT INTO discord_role_links (
            id, discord_role_id, discord_role_name, target_type, target_id, job_name, job_grade
          )
          SELECT
            id,
            discord_role_id,
            discord_role_name,
            CASE
              WHEN target_type IN ('department', 'sub_department', 'job') THEN target_type
              ELSE 'department'
            END,
            COALESCE(target_id, 0),
            CASE
              WHEN target_type = 'job' THEN TRIM(COALESCE(job_name, ''))
              ELSE ''
            END,
            COALESCE(CAST(job_grade AS INTEGER), 0)
          FROM discord_role_links_old
        `);
      } else {
        db.exec(`
          INSERT INTO discord_role_links (
            id, discord_role_id, discord_role_name, target_type, target_id, job_name, job_grade
          )
          SELECT
            id,
            discord_role_id,
            discord_role_name,
            CASE
              WHEN target_type IN ('department', 'sub_department') THEN target_type
              ELSE 'department'
            END,
            COALESCE(target_id, 0),
            '',
            0
          FROM discord_role_links_old
        `);
      }

      db.exec('DROP TABLE discord_role_links_old;');
    }

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_role_links_unique
      ON discord_role_links(discord_role_id, target_type, target_id)
    `);
  },
};
