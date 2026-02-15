module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        steam_id TEXT UNIQUE NOT NULL,
        steam_name TEXT NOT NULL DEFAULT '',
        avatar_url TEXT NOT NULL DEFAULT '',
        discord_id TEXT UNIQUE,
        discord_name TEXT DEFAULT '',
        is_admin INTEGER NOT NULL DEFAULT 0,
        is_banned INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        short_name TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '#0052C2',
        icon TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1
      );

      INSERT OR IGNORE INTO departments (name, short_name, color, icon, is_active) VALUES
        ('Victoria Police', 'VicPol', '#032261', 'vicpol', 1),
        ('Police Communications', 'DISPATCH', '#1F2937', '', 1),
        ('Ambulance Victoria', 'AV', '#007D85', 'av', 0),
        ('Fire Rescue Victoria', 'FRV', '#AA0028', 'frv', 0);

      CREATE TABLE IF NOT EXISTS user_departments (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, department_id)
      );

      CREATE TABLE IF NOT EXISTS discord_role_mappings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_role_id TEXT NOT NULL UNIQUE,
        discord_role_name TEXT NOT NULL DEFAULT '',
        department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        department_id INTEGER NOT NULL REFERENCES departments(id),
        callsign TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        location TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_units_user ON units(user_id);

      CREATE TABLE IF NOT EXISTS calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER NOT NULL REFERENCES departments(id),
        title TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT '3',
        location TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        job_code TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'dispatched',
        created_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS call_units (
        call_id INTEGER NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
        unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
        assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (call_id, unit_id)
      );

      CREATE TABLE IF NOT EXISTS bolos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_id INTEGER NOT NULL REFERENCES departments(id),
        type TEXT NOT NULL DEFAULT 'person' CHECK(type IN ('person', 'vehicle')),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'cancelled')),
        created_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS criminal_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        citizen_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('charge', 'fine', 'warning')),
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        fine_amount REAL DEFAULT 0,
        officer_name TEXT NOT NULL DEFAULT '',
        officer_callsign TEXT NOT NULL DEFAULT '',
        department_id INTEGER REFERENCES departments(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_criminal_records_citizen ON criminal_records(citizen_id);

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL,
        details TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        created_by INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT
      );
    `);
  },
};
