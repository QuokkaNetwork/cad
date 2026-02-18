module.exports = {
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS driver_licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        citizen_id TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL DEFAULT '',
        date_of_birth TEXT NOT NULL DEFAULT '',
        gender TEXT NOT NULL DEFAULT '',
        license_number TEXT NOT NULL DEFAULT '',
        license_classes_json TEXT NOT NULL DEFAULT '[]',
        conditions_json TEXT NOT NULL DEFAULT '[]',
        mugshot_url TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid', 'suspended', 'disqualified', 'expired')),
        issued_at TEXT NOT NULL DEFAULT (datetime('now')),
        expiry_at TEXT,
        created_by_user_id INTEGER REFERENCES users(id),
        updated_by_user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_driver_licenses_status_expiry ON driver_licenses(status, expiry_at);
      CREATE INDEX IF NOT EXISTS idx_driver_licenses_name ON driver_licenses(full_name);

      CREATE TABLE IF NOT EXISTS vehicle_registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        plate TEXT NOT NULL DEFAULT '',
        plate_normalized TEXT NOT NULL UNIQUE,
        citizen_id TEXT NOT NULL DEFAULT '',
        owner_name TEXT NOT NULL DEFAULT '',
        vehicle_model TEXT NOT NULL DEFAULT '',
        vehicle_colour TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'valid' CHECK(status IN ('valid', 'suspended', 'revoked', 'expired')),
        issued_at TEXT NOT NULL DEFAULT (datetime('now')),
        expiry_at TEXT,
        duration_days INTEGER NOT NULL DEFAULT 365,
        created_by_user_id INTEGER REFERENCES users(id),
        updated_by_user_id INTEGER REFERENCES users(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_citizen ON vehicle_registrations(citizen_id);
      CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_status_expiry ON vehicle_registrations(status, expiry_at);
      CREATE INDEX IF NOT EXISTS idx_vehicle_registrations_owner ON vehicle_registrations(owner_name);
    `);
  },
};
