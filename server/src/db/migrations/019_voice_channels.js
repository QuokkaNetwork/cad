exports.up = (db) => {
  // Voice channels table - tracks radio channels for departments
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_number INTEGER NOT NULL UNIQUE,
      department_id INTEGER,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    )
  `);

  // Voice participants table - tracks who's in which channel
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      user_id INTEGER,
      unit_id INTEGER,
      citizen_id TEXT DEFAULT '',
      game_id TEXT DEFAULT '',
      is_talking INTEGER DEFAULT 0,
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (channel_id) REFERENCES voice_channels(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE CASCADE
    )
  `);

  // Voice call sessions - tracks 000 phone calls
  db.exec(`
    CREATE TABLE IF NOT EXISTS voice_call_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      call_id INTEGER NOT NULL,
      call_channel_number INTEGER NOT NULL UNIQUE,
      caller_citizen_id TEXT DEFAULT '',
      caller_game_id TEXT DEFAULT '',
      caller_name TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      accepted_by_user_id INTEGER,
      accepted_at TEXT,
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (call_id) REFERENCES calls(id) ON DELETE CASCADE,
      FOREIGN KEY (accepted_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_voice_channels_department ON voice_channels(department_id);
    CREATE INDEX IF NOT EXISTS idx_voice_participants_channel ON voice_participants(channel_id);
    CREATE INDEX IF NOT EXISTS idx_voice_participants_user ON voice_participants(user_id);
    CREATE INDEX IF NOT EXISTS idx_voice_participants_unit ON voice_participants(unit_id);
    CREATE INDEX IF NOT EXISTS idx_voice_call_sessions_call ON voice_call_sessions(call_id);
    CREATE INDEX IF NOT EXISTS idx_voice_call_sessions_status ON voice_call_sessions(status);
  `);

  // Create default channels for each department
  const departments = db.prepare('SELECT id, name FROM departments WHERE is_active = 1').all();
  const insertChannel = db.prepare(`
    INSERT INTO voice_channels (channel_number, department_id, name, description)
    VALUES (?, ?, ?, ?)
  `);

  for (const dept of departments) {
    const channelNumber = 100 + dept.id;
    insertChannel.run(channelNumber, dept.id, `${dept.name} Radio`, `Primary radio channel for ${dept.name}`);
  }

  console.log('Voice channels migration applied: created voice_channels, voice_participants, and voice_call_sessions tables');
};
