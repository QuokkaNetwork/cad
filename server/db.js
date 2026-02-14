const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const config = require('../shared/config');

let db;

async function initDb() {
  const SQL = await initSqlJs();
  const dbPath = path.resolve(config.sqlite.file);
  const dataDir = path.dirname(dbPath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'dispatcher',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL,
      citizenid TEXT NOT NULL DEFAULT '',
      callsign TEXT NOT NULL,
      name TEXT NOT NULL,
      department TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '1',
      location TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_code TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT '3',
      status TEXT NOT NULL DEFAULT 'dispatched',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS call_units (
      call_id INTEGER NOT NULL,
      unit_id INTEGER NOT NULL,
      assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (call_id, unit_id)
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS bolos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'person',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS emergency_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caller_citizenid TEXT,
      caller_name TEXT NOT NULL DEFAULT 'Unknown',
      caller_source INTEGER,
      location TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_by INTEGER,
      channel INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      accepted_at TEXT,
      completed_at TEXT
    );
  `);

  // Department assignments: which departments each user is allowed to log in as
  db.run(`
    CREATE TABLE IF NOT EXISTS user_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      department TEXT NOT NULL,
      UNIQUE(user_id, department)
    );
  `);

  // Job sync mappings: FiveM job name -> CAD department
  db.run(`
    CREATE TABLE IF NOT EXISTS job_sync_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_name TEXT NOT NULL UNIQUE,
      department TEXT NOT NULL
    );
  `);

  // Announcements / MOTD
  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Audit log
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Custom job codes (admin-managed)
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_job_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Custom status codes (admin-managed)
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_status_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  // CMS Settings (key-value configuration store)
  db.run(`
    CREATE TABLE IF NOT EXISTS cms_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL DEFAULT ''
    );
  `);

  // CMS Services (dynamic service/department management)
  db.run(`
    CREATE TABLE IF NOT EXISTS cms_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      short_name TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL DEFAULT '#444444',
      logo_path TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // CMS Departments (linked to services)
  db.run(`
    CREATE TABLE IF NOT EXISTS cms_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      UNIQUE(service_id, name)
    );
  `);

  const hasAdmin = get('SELECT 1 FROM users LIMIT 1');
  if (!hasAdmin) {
    const passwordHash = bcrypt.hashSync('changeme', 10);
    db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [
      'admin',
      passwordHash,
      'admin',
    ]);
    save();
  }

  // Seed default CMS services/departments if empty
  seedCmsDefaults();
}

function save() {
  const dbPath = path.resolve(config.sqlite.file);
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const results = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function run(sql, params = []) {
  db.run(sql, params);
  save();
}

function getUserByUsername(username) {
  return get('SELECT * FROM users WHERE username = ?', [username]);
}

function getUnitByUserId(userId) {
  return get('SELECT * FROM units WHERE user_id = ?', [userId]);
}

function listUnits() {
  return all('SELECT * FROM units ORDER BY updated_at DESC');
}

function upsertUnit(unit) {
  const existing = getUnitByUserId(unit.user_id);
  if (existing) {
    db.run(
      `UPDATE units SET citizenid=?, callsign=?, name=?, department=?, status=?, location=?, note=?, updated_at=datetime('now') WHERE user_id=?`,
      [unit.citizenid, unit.callsign, unit.name, unit.department, unit.status, unit.location, unit.note, unit.user_id]
    );
  } else {
    db.run(
      `INSERT INTO units (user_id, citizenid, callsign, name, department, status, location, note, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [unit.user_id, unit.citizenid, unit.callsign, unit.name, unit.department, unit.status, unit.location, unit.note]
    );
  }
  save();
  return getUnitByUserId(unit.user_id);
}

function updateUnitByUserId(userId, updates) {
  const current = getUnitByUserId(userId);
  if (!current) {
    return null;
  }

  const next = {
    user_id: userId,
    citizenid: updates.citizenid ?? current.citizenid,
    callsign: updates.callsign ?? current.callsign,
    name: updates.name ?? current.name,
    department: updates.department ?? current.department,
    status: updates.status ?? current.status,
    location: updates.location ?? current.location,
    note: updates.note ?? current.note,
  };

  return upsertUnit(next);
}

function setUnitOffDuty(userId) {
  run('DELETE FROM units WHERE user_id = ?', [userId]);
}

function listCalls() {
  const calls = all('SELECT * FROM calls ORDER BY updated_at DESC');
  const assignments = all(
    `SELECT call_units.call_id, units.id as unit_id, units.callsign, units.name
     FROM call_units
     JOIN units ON units.id = call_units.unit_id`
  );

  const byCall = new Map();
  assignments.forEach((row) => {
    if (!byCall.has(row.call_id)) {
      byCall.set(row.call_id, []);
    }
    byCall.get(row.call_id).push({ id: row.unit_id, callsign: row.callsign, name: row.name });
  });

  return calls.map((call) => ({
    ...call,
    units: byCall.get(call.id) || [],
  }));
}

function createCall(data) {
  db.run(
    `INSERT INTO calls (job_code, title, description, location, priority, status, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [data.job_code || '', data.title, data.description, data.location, data.priority, data.status]
  );
  save();
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  return get('SELECT * FROM calls WHERE id = ?', [id]);
}

function updateCall(callId, updates) {
  const current = get('SELECT * FROM calls WHERE id = ?', [callId]);
  if (!current) {
    return null;
  }

  const next = {
    id: callId,
    job_code: updates.job_code ?? current.job_code,
    title: updates.title ?? current.title,
    description: updates.description ?? current.description,
    location: updates.location ?? current.location,
    priority: updates.priority ?? current.priority,
    status: updates.status ?? current.status,
  };

  db.run(
    `UPDATE calls SET job_code=?, title=?, description=?, location=?, priority=?, status=?, updated_at=datetime('now') WHERE id=?`,
    [next.job_code, next.title, next.description, next.location, next.priority, next.status, next.id]
  );
  save();
  return get('SELECT * FROM calls WHERE id = ?', [callId]);
}

function assignUnitToCall(callId, unitId) {
  run('INSERT OR IGNORE INTO call_units (call_id, unit_id) VALUES (?, ?)', [callId, unitId]);
}

function unassignUnitFromCall(callId, unitId) {
  run('DELETE FROM call_units WHERE call_id = ? AND unit_id = ?', [callId, unitId]);
}

function listBolos() {
  return all('SELECT * FROM bolos WHERE active = 1 ORDER BY created_at DESC');
}

function createBolo(data) {
  db.run(
    `INSERT INTO bolos (type, title, description, created_by) VALUES (?, ?, ?, ?)`,
    [data.type || 'person', data.title, data.description || '', data.created_by || '']
  );
  save();
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  return get('SELECT * FROM bolos WHERE id = ?', [id]);
}

function cancelBolo(boloId) {
  run('UPDATE bolos SET active = 0 WHERE id = ?', [boloId]);
  return get('SELECT * FROM bolos WHERE id = ?', [boloId]);
}

// ===== Emergency 000 Calls =====

function listEmergencyCalls() {
  return all(
    `SELECT * FROM emergency_calls WHERE status IN ('pending', 'active') ORDER BY created_at DESC`
  );
}

function createEmergencyCall(data) {
  try {
    db.run(
      `INSERT INTO emergency_calls (caller_citizenid, caller_name, caller_source, location, status, channel)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [
        data.caller_citizenid || null,
        data.caller_name || 'Unknown',
        data.caller_source || null,
        data.location || '',
        data.channel || null,
      ]
    );
    const result = db.exec('SELECT last_insert_rowid() as id');
    if (!result || result.length === 0) {
      console.error('[db] createEmergencyCall: last_insert_rowid returned empty');
      save();
      // Fallback: get the most recent pending call
      return get("SELECT * FROM emergency_calls WHERE status = 'pending' ORDER BY id DESC LIMIT 1");
    }
    const id = result[0].values[0][0];
    save();
    return get('SELECT * FROM emergency_calls WHERE id = ?', [id]);
  } catch (err) {
    console.error('[db] createEmergencyCall error:', err.message);
    save();
    return get("SELECT * FROM emergency_calls WHERE status = 'pending' ORDER BY id DESC LIMIT 1");
  }
}

function acceptEmergencyCall(callId, acceptedByUserId) {
  const call = get('SELECT * FROM emergency_calls WHERE id = ?', [callId]);
  if (!call || call.status !== 'pending') {
    return null;
  }

  db.run(
    `UPDATE emergency_calls SET status = 'active', accepted_by = ?, accepted_at = datetime('now') WHERE id = ?`,
    [acceptedByUserId, callId]
  );
  save();
  return get('SELECT * FROM emergency_calls WHERE id = ?', [callId]);
}

function completeEmergencyCall(callId) {
  const call = get('SELECT * FROM emergency_calls WHERE id = ?', [callId]);
  if (!call) {
    return null;
  }

  db.run(
    `UPDATE emergency_calls SET status = 'completed', completed_at = datetime('now') WHERE id = ?`,
    [callId]
  );
  save();
  return get('SELECT * FROM emergency_calls WHERE id = ?', [callId]);
}

// ===== User Management =====

function listUsers() {
  return all('SELECT id, username, role, created_at FROM users ORDER BY username');
}

function createUser(username, password, role) {
  const passwordHash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, passwordHash, role || 'dispatcher']);
  save();
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  return get('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);
}

function deleteUser(userId) {
  run('DELETE FROM user_departments WHERE user_id = ?', [userId]);
  run('DELETE FROM units WHERE user_id = ?', [userId]);
  run('DELETE FROM users WHERE id = ?', [userId]);
}

function updateUserRole(userId, role) {
  run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  return get('SELECT id, username, role, created_at FROM users WHERE id = ?', [userId]);
}

function resetUserPassword(userId, newPassword) {
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

// ===== User Department Assignments =====

function getUserDepartments(userId) {
  return all('SELECT department FROM user_departments WHERE user_id = ?', [userId]).map((r) => r.department);
}

function setUserDepartments(userId, departments) {
  db.run('DELETE FROM user_departments WHERE user_id = ?', [userId]);
  for (const dept of departments) {
    db.run('INSERT OR IGNORE INTO user_departments (user_id, department) VALUES (?, ?)', [userId, dept]);
  }
  save();
  return getUserDepartments(userId);
}

function getAllUserDepartments() {
  return all('SELECT user_id, department FROM user_departments ORDER BY user_id');
}

// ===== Job Sync Mappings =====

function listJobSyncMappings() {
  return all('SELECT * FROM job_sync_mappings ORDER BY job_name');
}

function upsertJobSyncMapping(jobName, department) {
  const existing = get('SELECT * FROM job_sync_mappings WHERE job_name = ?', [jobName]);
  if (existing) {
    db.run('UPDATE job_sync_mappings SET department = ? WHERE job_name = ?', [department, jobName]);
  } else {
    db.run('INSERT INTO job_sync_mappings (job_name, department) VALUES (?, ?)', [jobName, department]);
  }
  save();
  return get('SELECT * FROM job_sync_mappings WHERE job_name = ?', [jobName]);
}

function deleteJobSyncMapping(id) {
  run('DELETE FROM job_sync_mappings WHERE id = ?', [id]);
}

function getJobSyncMappingByJob(jobName) {
  return get('SELECT * FROM job_sync_mappings WHERE job_name = ?', [jobName]);
}

// ===== Announcements =====

function listAnnouncements(activeOnly = true) {
  if (activeOnly) {
    return all('SELECT * FROM announcements WHERE active = 1 ORDER BY created_at DESC');
  }
  return all('SELECT * FROM announcements ORDER BY created_at DESC');
}

function createAnnouncement(data) {
  db.run(
    'INSERT INTO announcements (title, body, created_by) VALUES (?, ?, ?)',
    [data.title, data.body || '', data.created_by || '']
  );
  save();
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  return get('SELECT * FROM announcements WHERE id = ?', [id]);
}

function deleteAnnouncement(id) {
  run('UPDATE announcements SET active = 0 WHERE id = ?', [id]);
}

// ===== Audit Log =====

function addAuditLog(entry) {
  db.run(
    'INSERT INTO audit_log (user_id, username, action, detail) VALUES (?, ?, ?, ?)',
    [entry.user_id || null, entry.username || '', entry.action || '', entry.detail || '']
  );
  save();
}

function listAuditLog(limit = 200) {
  return all('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?', [limit]);
}

// ===== Custom Job Codes =====

function listCustomJobCodes() {
  return all('SELECT * FROM custom_job_codes ORDER BY sort_order, code');
}

function createCustomJobCode(code, label, sortOrder) {
  db.run(
    'INSERT INTO custom_job_codes (code, label, sort_order) VALUES (?, ?, ?)',
    [code, label, sortOrder || 0]
  );
  save();
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  return get('SELECT * FROM custom_job_codes WHERE id = ?', [id]);
}

function updateCustomJobCode(id, code, label, sortOrder) {
  db.run(
    'UPDATE custom_job_codes SET code = ?, label = ?, sort_order = ? WHERE id = ?',
    [code, label, sortOrder || 0, id]
  );
  save();
  return get('SELECT * FROM custom_job_codes WHERE id = ?', [id]);
}

function deleteCustomJobCode(id) {
  run('DELETE FROM custom_job_codes WHERE id = ?', [id]);
}

// ===== Custom Status Codes =====

function listCustomStatusCodes() {
  return all('SELECT * FROM custom_status_codes ORDER BY sort_order, code');
}

function createCustomStatusCode(code, label, sortOrder) {
  db.run(
    'INSERT INTO custom_status_codes (code, label, sort_order) VALUES (?, ?, ?)',
    [code, label, sortOrder || 0]
  );
  save();
  const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0];
  return get('SELECT * FROM custom_status_codes WHERE id = ?', [id]);
}

function updateCustomStatusCode(id, code, label, sortOrder) {
  db.run(
    'UPDATE custom_status_codes SET code = ?, label = ?, sort_order = ? WHERE id = ?',
    [code, label, sortOrder || 0, id]
  );
  save();
  return get('SELECT * FROM custom_status_codes WHERE id = ?', [id]);
}

function deleteCustomStatusCode(id) {
  run('DELETE FROM custom_status_codes WHERE id = ?', [id]);
}

// ===== CMS Settings =====

function getCmsSetting(key) {
  const row = get('SELECT value FROM cms_settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setCmsSetting(key, value) {
  const existing = get('SELECT 1 FROM cms_settings WHERE key = ?', [key]);
  if (existing) {
    db.run('UPDATE cms_settings SET value = ? WHERE key = ?', [String(value), key]);
  } else {
    db.run('INSERT INTO cms_settings (key, value) VALUES (?, ?)', [key, String(value)]);
  }
  save();
}

function getAllCmsSettings() {
  const rows = all('SELECT key, value FROM cms_settings ORDER BY key');
  const result = {};
  rows.forEach((r) => { result[r.key] = r.value; });
  return result;
}

function deleteCmsSetting(key) {
  run('DELETE FROM cms_settings WHERE key = ?', [key]);
}

// ===== CMS Services =====

function listCmsServices() {
  const services = all('SELECT * FROM cms_services ORDER BY sort_order, name');
  const departments = all('SELECT * FROM cms_departments ORDER BY sort_order, name');
  return services.map((svc) => ({
    ...svc,
    departments: departments.filter((d) => d.service_id === svc.service_id),
  }));
}

function getCmsService(serviceId) {
  const svc = get('SELECT * FROM cms_services WHERE service_id = ?', [serviceId]);
  if (!svc) return null;
  const departments = all('SELECT * FROM cms_departments WHERE service_id = ? ORDER BY sort_order, name', [serviceId]);
  return { ...svc, departments };
}

function createCmsService(data) {
  db.run(
    'INSERT INTO cms_services (service_id, name, short_name, color, logo_path, sort_order, enabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [data.service_id, data.name, data.short_name || '', data.color || '#444444', data.logo_path || '', data.sort_order || 0, data.enabled !== undefined ? (data.enabled ? 1 : 0) : 1]
  );
  save();
  return getCmsService(data.service_id);
}

function updateCmsService(serviceId, data) {
  const current = get('SELECT * FROM cms_services WHERE service_id = ?', [serviceId]);
  if (!current) return null;

  db.run(
    'UPDATE cms_services SET name = ?, short_name = ?, color = ?, logo_path = ?, sort_order = ?, enabled = ? WHERE service_id = ?',
    [
      data.name ?? current.name,
      data.short_name ?? current.short_name,
      data.color ?? current.color,
      data.logo_path ?? current.logo_path,
      data.sort_order ?? current.sort_order,
      data.enabled !== undefined ? (data.enabled ? 1 : 0) : current.enabled,
      serviceId,
    ]
  );
  save();
  return getCmsService(serviceId);
}

function deleteCmsService(serviceId) {
  run('DELETE FROM cms_departments WHERE service_id = ?', [serviceId]);
  run('DELETE FROM cms_services WHERE service_id = ?', [serviceId]);
}

// ===== CMS Departments =====

function addCmsDepartment(serviceId, name, sortOrder) {
  db.run(
    'INSERT OR IGNORE INTO cms_departments (service_id, name, sort_order) VALUES (?, ?, ?)',
    [serviceId, name, sortOrder || 0]
  );
  save();
  return get('SELECT * FROM cms_departments WHERE service_id = ? AND name = ?', [serviceId, name]);
}

function removeCmsDepartment(id) {
  run('DELETE FROM cms_departments WHERE id = ?', [id]);
}

function updateCmsDepartment(id, data) {
  const current = get('SELECT * FROM cms_departments WHERE id = ?', [id]);
  if (!current) return null;
  db.run(
    'UPDATE cms_departments SET name = ?, sort_order = ?, enabled = ? WHERE id = ?',
    [data.name ?? current.name, data.sort_order ?? current.sort_order, data.enabled !== undefined ? (data.enabled ? 1 : 0) : current.enabled, id]
  );
  save();
  return get('SELECT * FROM cms_departments WHERE id = ?', [id]);
}

// Seed default services into CMS if the table is empty
function seedCmsDefaults() {
  const count = get('SELECT COUNT(*) as cnt FROM cms_services');
  if (count && count.cnt > 0) return; // Already seeded

  const defaults = [
    { service_id: 'vicpol', name: 'Victoria Police', short_name: 'VicPol', color: '#032261', logo_path: '/assets/logos/vicpol.svg', sort_order: 0, departments: ['General Duties', 'Highway Patrol', 'CIU', 'SOG', 'Dog Squad', 'PolAir', 'Water Police', 'TMU', 'CIRT', 'PSO', 'Forensic', 'Counter Terrorism'] },
    { service_id: 'av', name: 'Ambulance Victoria', short_name: 'AV', color: '#006838', logo_path: '/assets/logos/av.svg', sort_order: 1, departments: ['Paramedic', 'MICA', 'Air Ambulance', 'Clinical Support', 'Emergency Dispatch'] },
    { service_id: 'frv', name: 'Fire Rescue Victoria', short_name: 'FRV', color: '#C41E3A', logo_path: '/assets/logos/frv.svg', sort_order: 2, departments: ['Firefighter', 'Station Officer', 'Hazmat', 'Technical Rescue', 'Fire Investigation'] },
    { service_id: 'cfa', name: 'Country Fire Authority', short_name: 'CFA', color: '#D4A017', logo_path: '/assets/logos/cfa.svg', sort_order: 3, departments: ['Volunteer Brigade', 'Career Staff', 'District Operations', 'Community Safety'] },
    { service_id: 'ses', name: 'Victoria SES', short_name: 'VicSES', color: '#F37021', logo_path: '/assets/logos/ses.svg', sort_order: 4, departments: ['Storm Response', 'Flood Response', 'Road Rescue', 'Search & Rescue', 'Community Resilience'] },
    { service_id: 'parks', name: 'Parks Victoria', short_name: 'Parks', color: '#2E8B57', logo_path: '/assets/logos/parks.svg', sort_order: 5, departments: ['Park Ranger', 'Wildlife Officer', 'Marine & Coastal', 'Fire Management'] },
    { service_id: 'epa', name: 'EPA Victoria', short_name: 'EPA', color: '#4B8BBE', logo_path: '/assets/logos/epa.svg', sort_order: 6, departments: ['Environmental Officer', 'Pollution Response', 'Compliance', 'Investigation'] },
    { service_id: 'comms', name: 'Emergency Communications', short_name: 'ESTA', color: '#6B4C9A', logo_path: '/assets/logos/comms.svg', sort_order: 7, departments: ['Communications'] },
  ];

  for (const svc of defaults) {
    db.run(
      'INSERT INTO cms_services (service_id, name, short_name, color, logo_path, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [svc.service_id, svc.name, svc.short_name, svc.color, svc.logo_path, svc.sort_order]
    );
    for (let i = 0; i < svc.departments.length; i++) {
      db.run(
        'INSERT INTO cms_departments (service_id, name, sort_order) VALUES (?, ?, ?)',
        [svc.service_id, svc.departments[i], i]
      );
    }
  }
  save();
}

module.exports = {
  initDb,
  getUserByUsername,
  getUnitByUserId,
  listUnits,
  upsertUnit,
  updateUnitByUserId,
  setUnitOffDuty,
  listCalls,
  createCall,
  updateCall,
  assignUnitToCall,
  unassignUnitFromCall,
  listBolos,
  createBolo,
  cancelBolo,
  listEmergencyCalls,
  createEmergencyCall,
  acceptEmergencyCall,
  completeEmergencyCall,
  listUsers,
  createUser,
  deleteUser,
  updateUserRole,
  resetUserPassword,
  getUserDepartments,
  setUserDepartments,
  getAllUserDepartments,
  listJobSyncMappings,
  upsertJobSyncMapping,
  deleteJobSyncMapping,
  getJobSyncMappingByJob,
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  addAuditLog,
  listAuditLog,
  listCustomJobCodes,
  createCustomJobCode,
  updateCustomJobCode,
  deleteCustomJobCode,
  listCustomStatusCodes,
  createCustomStatusCode,
  updateCustomStatusCode,
  deleteCustomStatusCode,
  getCmsSetting,
  setCmsSetting,
  getAllCmsSettings,
  deleteCmsSetting,
  listCmsServices,
  getCmsService,
  createCmsService,
  updateCmsService,
  deleteCmsService,
  addCmsDepartment,
  removeCmsDepartment,
  updateCmsDepartment,
  seedCmsDefaults,
};
