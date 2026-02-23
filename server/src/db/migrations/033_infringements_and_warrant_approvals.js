function tableExists(db, tableName) {
  try {
    const row = db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND lower(name) = lower(?)"
    ).get(tableName);
    return !!row;
  } catch {
    return false;
  }
}

function hasColumn(db, tableName, columnName) {
  try {
    const rows = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return rows.some((row) =>
      String(row?.name || '').trim().toLowerCase() === String(columnName || '').trim().toLowerCase()
    );
  } catch {
    return false;
  }
}

exports.up = (db) => {
  if (!tableExists(db, 'infringement_notices')) {
    db.exec(`
      CREATE TABLE infringement_notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        notice_number TEXT NOT NULL DEFAULT '',
        department_id INTEGER NOT NULL REFERENCES departments(id),
        citizen_id TEXT NOT NULL DEFAULT '',
        subject_name TEXT NOT NULL DEFAULT '',
        vehicle_plate TEXT NOT NULL DEFAULT '',
        location TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        amount REAL NOT NULL DEFAULT 0,
        payable_status TEXT NOT NULL DEFAULT 'unpaid',
        due_date TEXT,
        court_date TEXT,
        court_location TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'issued',
        details_json TEXT NOT NULL DEFAULT '{}',
        officer_name TEXT NOT NULL DEFAULT '',
        officer_callsign TEXT NOT NULL DEFAULT '',
        created_by_user_id INTEGER REFERENCES users(id),
        updated_by_user_id INTEGER REFERENCES users(id),
        paid_at TEXT,
        print_count INTEGER NOT NULL DEFAULT 0,
        last_printed_at TEXT,
        last_print_job_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  if (!tableExists(db, 'infringement_notice_print_audit')) {
    db.exec(`
      CREATE TABLE infringement_notice_print_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        infringement_notice_id INTEGER NOT NULL REFERENCES infringement_notices(id) ON DELETE CASCADE,
        print_job_id INTEGER,
        print_action TEXT NOT NULL DEFAULT 'print',
        printed_by_user_id INTEGER REFERENCES users(id),
        printed_by_callsign TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  if (!hasColumn(db, 'warrants', 'approval_status')) {
    db.exec("ALTER TABLE warrants ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'");
  }
  if (!hasColumn(db, 'warrants', 'approval_requested_at')) {
    db.exec("ALTER TABLE warrants ADD COLUMN approval_requested_at TEXT");
  }
  if (!hasColumn(db, 'warrants', 'approval_decided_at')) {
    db.exec("ALTER TABLE warrants ADD COLUMN approval_decided_at TEXT");
  }
  if (!hasColumn(db, 'warrants', 'approval_decided_by_user_id')) {
    db.exec('ALTER TABLE warrants ADD COLUMN approval_decided_by_user_id INTEGER');
  }
  if (!hasColumn(db, 'warrants', 'approval_notes')) {
    db.exec("ALTER TABLE warrants ADD COLUMN approval_notes TEXT NOT NULL DEFAULT ''");
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_infringement_notices_department ON infringement_notices(department_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infringement_notices_citizen ON infringement_notices(citizen_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infringement_notices_status ON infringement_notices(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infringement_notices_payable_status ON infringement_notices(payable_status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infringement_notices_due_date ON infringement_notices(due_date)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infringement_notices_court_date ON infringement_notices(court_date)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_infringement_notices_notice_number ON infringement_notices(notice_number)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infringement_print_audit_notice ON infringement_notice_print_audit(infringement_notice_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_infringement_print_audit_created ON infringement_notice_print_audit(created_at)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_warrants_approval_status ON warrants(approval_status)');

  db.exec(`
    UPDATE warrants
    SET approval_status = CASE
      WHEN status = 'active' THEN COALESCE(NULLIF(approval_status, ''), 'approved')
      ELSE 'approved'
    END
    WHERE COALESCE(NULLIF(approval_status, ''), '') = ''
  `);

  db.exec(`
    UPDATE warrants
    SET approval_requested_at = COALESCE(approval_requested_at, created_at)
    WHERE approval_requested_at IS NULL
  `);

  const missingNoticeRows = db.prepare(`
    SELECT id FROM infringement_notices
    WHERE COALESCE(TRIM(notice_number), '') = ''
    ORDER BY id ASC
  `).all();
  const updateNoticeStmt = db.prepare(`
    UPDATE infringement_notices
    SET notice_number = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  for (const row of missingNoticeRows) {
    const id = Number(row?.id || 0);
    if (!Number.isInteger(id) || id <= 0) continue;
    updateNoticeStmt.run(`INFRINGEMENT-${String(id).padStart(6, '0')}`, id);
  }

  console.log('Migration 033 applied: infringement notices + warrant approvals');
};

