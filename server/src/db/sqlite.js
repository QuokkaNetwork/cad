const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db;

function initDb() {
  const dir = path.dirname(config.sqlite.file);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = new Database(config.sqlite.file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Migration tracking
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  // Run migrations
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.js')).sort();
  const applied = db.prepare('SELECT name FROM _migrations').all().map(r => r.name);

  for (const file of files) {
    if (!applied.includes(file)) {
      const migration = require(path.join(migrationsDir, file));
      db.transaction(() => {
        migration.up(db);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
      })();
      console.log(`Migration applied: ${file}`);
    }
  }

  return db;
}

// --- Users ---
const Users = {
  findBySteamId(steamId) {
    return db.prepare('SELECT * FROM users WHERE steam_id = ?').get(steamId);
  },
  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  },
  findByDiscordId(discordId) {
    return db.prepare('SELECT * FROM users WHERE discord_id = ?').get(discordId);
  },
  create({ steam_id, steam_name, avatar_url }) {
    const info = db.prepare(
      'INSERT INTO users (steam_id, steam_name, avatar_url) VALUES (?, ?, ?)'
    ).run(steam_id, steam_name, avatar_url || '');
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['steam_name', 'avatar_url', 'discord_id', 'discord_name', 'is_admin', 'is_banned'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }
    if (updates.length === 0) return;
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  list() {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  },
};

// --- Departments ---
const Departments = {
  list() {
    return db.prepare('SELECT * FROM departments ORDER BY id').all();
  },
  listActive() {
    return db.prepare('SELECT * FROM departments WHERE is_active = 1 ORDER BY id').all();
  },
  findById(id) {
    return db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  },
  findByShortName(shortName) {
    return db.prepare('SELECT * FROM departments WHERE short_name = ?').get(shortName);
  },
  create({ name, short_name, color, icon }) {
    const info = db.prepare(
      'INSERT INTO departments (name, short_name, color, icon) VALUES (?, ?, ?, ?)'
    ).run(name, short_name || '', color || '#0052C2', icon || '');
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['name', 'short_name', 'color', 'icon', 'is_active'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }
    if (updates.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  delete(id) {
    db.prepare('DELETE FROM departments WHERE id = ?').run(id);
  },
};

// --- User Departments ---
const UserDepartments = {
  getForUser(userId) {
    return db.prepare(`
      SELECT d.* FROM departments d
      JOIN user_departments ud ON ud.department_id = d.id
      WHERE ud.user_id = ?
      ORDER BY d.id
    `).all(userId);
  },
  setForUser(userId, departmentIds) {
    db.transaction(() => {
      db.prepare('DELETE FROM user_departments WHERE user_id = ?').run(userId);
      const insert = db.prepare('INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)');
      for (const deptId of departmentIds) {
        insert.run(userId, deptId);
      }
    })();
  },
  add(userId, departmentId) {
    db.prepare(
      'INSERT OR IGNORE INTO user_departments (user_id, department_id) VALUES (?, ?)'
    ).run(userId, departmentId);
  },
  remove(userId, departmentId) {
    db.prepare(
      'DELETE FROM user_departments WHERE user_id = ? AND department_id = ?'
    ).run(userId, departmentId);
  },
};

// --- Discord Role Mappings ---
const DiscordRoleMappings = {
  list() {
    return db.prepare(`
      SELECT drm.*, d.name as department_name, d.short_name as department_short_name
      FROM discord_role_mappings drm
      JOIN departments d ON d.id = drm.department_id
      ORDER BY drm.id
    `).all();
  },
  findByRoleId(roleId) {
    return db.prepare('SELECT * FROM discord_role_mappings WHERE discord_role_id = ?').get(roleId);
  },
  create({ discord_role_id, discord_role_name, department_id }) {
    const info = db.prepare(
      'INSERT INTO discord_role_mappings (discord_role_id, discord_role_name, department_id) VALUES (?, ?, ?)'
    ).run(discord_role_id, discord_role_name, department_id);
    return { id: info.lastInsertRowid, discord_role_id, discord_role_name, department_id };
  },
  delete(id) {
    db.prepare('DELETE FROM discord_role_mappings WHERE id = ?').run(id);
  },
};

// --- Units ---
const Units = {
  findById(id) {
    return db.prepare(`
      SELECT u.*, us.steam_name as user_name
      FROM units u
      JOIN users us ON us.id = u.user_id
      WHERE u.id = ?
    `).get(id);
  },
  findByUserId(userId) {
    return db.prepare('SELECT * FROM units WHERE user_id = ?').get(userId);
  },
  listByDepartment(departmentId) {
    return db.prepare(`
      SELECT u.*, us.steam_name as user_name, us.avatar_url as user_avatar
      FROM units u
      JOIN users us ON us.id = u.user_id
      WHERE u.department_id = ?
      ORDER BY u.callsign
    `).all(departmentId);
  },
  list() {
    return db.prepare(`
      SELECT u.*, us.steam_name as user_name, us.avatar_url as user_avatar
      FROM units u
      JOIN users us ON us.id = u.user_id
      ORDER BY u.callsign
    `).all();
  },
  create({ user_id, department_id, callsign, status, location, note }) {
    const info = db.prepare(
      'INSERT INTO units (user_id, department_id, callsign, status, location, note) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(user_id, department_id, callsign, status || 'available', location || '', note || '');
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['callsign', 'status', 'location', 'note'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }
    if (updates.length === 0) return;
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE units SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  remove(id) {
    db.prepare('DELETE FROM units WHERE id = ?').run(id);
  },
  removeByUserId(userId) {
    db.prepare('DELETE FROM units WHERE user_id = ?').run(userId);
  },
};

// --- Calls ---
const Calls = {
  findById(id) {
    const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(id);
    if (call) {
      call.assigned_units = db.prepare(`
        SELECT u.*, us.steam_name as user_name
        FROM call_units cu
        JOIN units u ON u.id = cu.unit_id
        JOIN users us ON us.id = u.user_id
        WHERE cu.call_id = ?
      `).all(id);
    }
    return call;
  },
  listByDepartment(departmentId, includeCompleted = false) {
    const statusFilter = includeCompleted ? '' : "AND c.status != 'closed'";
    const calls = db.prepare(`
      SELECT c.*, us.steam_name as creator_name
      FROM calls c
      LEFT JOIN users us ON us.id = c.created_by
      WHERE c.department_id = ? ${statusFilter}
      ORDER BY
        CASE c.priority WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 ELSE 4 END,
        c.created_at DESC
    `).all(departmentId);

    const getUnits = db.prepare(`
      SELECT u.id, u.callsign, u.status, us.steam_name as user_name
      FROM call_units cu
      JOIN units u ON u.id = cu.unit_id
      JOIN users us ON us.id = u.user_id
      WHERE cu.call_id = ?
    `);

    for (const call of calls) {
      call.assigned_units = getUnits.all(call.id);
    }
    return calls;
  },
  create({ department_id, title, priority, location, description, job_code, created_by }) {
    const info = db.prepare(
      'INSERT INTO calls (department_id, title, priority, location, description, job_code, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(department_id, title, priority || '3', location || '', description || '', job_code || '', created_by);
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['title', 'priority', 'location', 'description', 'job_code', 'status'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(fields[key]);
      }
    }
    if (updates.length === 0) return;
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE calls SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  assignUnit(callId, unitId) {
    db.prepare('INSERT OR IGNORE INTO call_units (call_id, unit_id) VALUES (?, ?)').run(callId, unitId);
  },
  unassignUnit(callId, unitId) {
    db.prepare('DELETE FROM call_units WHERE call_id = ? AND unit_id = ?').run(callId, unitId);
  },
  getAssignedCallForUnit(unitId) {
    return db.prepare(`
      SELECT c.* FROM calls c
      JOIN call_units cu ON cu.call_id = c.id
      WHERE cu.unit_id = ? AND c.status != 'closed'
      ORDER BY c.created_at DESC
      LIMIT 1
    `).get(unitId);
  },
};

// --- BOLOs ---
const Bolos = {
  listByDepartment(departmentId, status = 'active') {
    return db.prepare(`
      SELECT b.*, us.steam_name as creator_name
      FROM bolos b
      LEFT JOIN users us ON us.id = b.created_by
      WHERE b.department_id = ? AND b.status = ?
      ORDER BY b.created_at DESC
    `).all(departmentId, status);
  },
  findById(id) {
    return db.prepare(`
      SELECT b.*, us.steam_name as creator_name
      FROM bolos b
      LEFT JOIN users us ON us.id = b.created_by
      WHERE b.id = ?
    `).get(id);
  },
  create({ department_id, type, title, description, details_json, created_by }) {
    const info = db.prepare(
      'INSERT INTO bolos (department_id, type, title, description, details_json, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(department_id, type, title, description || '', details_json || '{}', created_by);
    return this.findById(info.lastInsertRowid);
  },
  updateStatus(id, status) {
    db.prepare('UPDATE bolos SET status = ? WHERE id = ?').run(status, id);
  },
};

// --- Criminal Records ---
const CriminalRecords = {
  findByCitizenId(citizenId) {
    return db.prepare(
      'SELECT * FROM criminal_records WHERE citizen_id = ? ORDER BY created_at DESC'
    ).all(citizenId);
  },
  findById(id) {
    return db.prepare('SELECT * FROM criminal_records WHERE id = ?').get(id);
  },
  create({ citizen_id, type, title, description, fine_amount, officer_name, officer_callsign, department_id }) {
    const info = db.prepare(
      'INSERT INTO criminal_records (citizen_id, type, title, description, fine_amount, officer_name, officer_callsign, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(citizen_id, type, title, description || '', fine_amount || 0, officer_name || '', officer_callsign || '', department_id);
    return this.findById(info.lastInsertRowid);
  },
  list(limit = 50, offset = 0) {
    return db.prepare(
      'SELECT * FROM criminal_records ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);
  },
};

// --- FiveM player links ---
const FiveMPlayerLinks = {
  upsert({ steam_id, game_id, citizen_id, player_name, position_x, position_y, position_z, heading, speed }) {
    db.prepare(`
      INSERT INTO fivem_player_links (
        steam_id, game_id, citizen_id, player_name, position_x, position_y, position_z, heading, speed, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(steam_id) DO UPDATE SET
        game_id = excluded.game_id,
        citizen_id = excluded.citizen_id,
        player_name = excluded.player_name,
        position_x = excluded.position_x,
        position_y = excluded.position_y,
        position_z = excluded.position_z,
        heading = excluded.heading,
        speed = excluded.speed,
        updated_at = datetime('now')
    `).run(
      steam_id,
      game_id || '',
      citizen_id || '',
      player_name || '',
      Number(position_x || 0),
      Number(position_y || 0),
      Number(position_z || 0),
      Number(heading || 0),
      Number(speed || 0)
    );
    return this.findBySteamId(steam_id);
  },
  removeBySteamId(steamId) {
    db.prepare('DELETE FROM fivem_player_links WHERE steam_id = ?').run(steamId);
  },
  findBySteamId(steamId) {
    return db.prepare('SELECT * FROM fivem_player_links WHERE steam_id = ?').get(steamId);
  },
  findByCitizenId(citizenId) {
    return db.prepare('SELECT * FROM fivem_player_links WHERE citizen_id = ?').get(citizenId);
  },
  list() {
    return db.prepare('SELECT * FROM fivem_player_links ORDER BY updated_at DESC').all();
  },
};

// --- FiveM fine jobs ---
const FiveMFineJobs = {
  create({ citizen_id, amount, reason, issued_by_user_id, source_record_id }) {
    const info = db.prepare(`
      INSERT INTO fivem_fine_jobs (
        citizen_id, amount, reason, issued_by_user_id, source_record_id, status, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', '', datetime('now'), datetime('now'))
    `).run(citizen_id, Number(amount || 0), reason || '', issued_by_user_id || null, source_record_id || null);
    return this.findById(info.lastInsertRowid);
  },
  findById(id) {
    return db.prepare('SELECT * FROM fivem_fine_jobs WHERE id = ?').get(id);
  },
  listPending(limit = 25) {
    return db.prepare(`
      SELECT * FROM fivem_fine_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit);
  },
  markSent(id) {
    db.prepare(`
      UPDATE fivem_fine_jobs
      SET status = 'sent', error = '', sent_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  },
  markFailed(id, error) {
    db.prepare(`
      UPDATE fivem_fine_jobs
      SET status = 'failed', error = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(String(error || '').slice(0, 500), id);
  },
  markPending(id) {
    db.prepare(`
      UPDATE fivem_fine_jobs
      SET status = 'pending', error = '', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  },
  listRecent(limit = 100) {
    return db.prepare('SELECT * FROM fivem_fine_jobs ORDER BY created_at DESC LIMIT ?').all(limit);
  },
};

// --- Settings ---
const Settings = {
  get(key) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : null;
  },
  set(key, value) {
    db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?'
    ).run(key, value, value);
  },
  getAll() {
    return db.prepare('SELECT * FROM settings').all().reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  },
};

// --- Audit Log ---
const AuditLog = {
  add({ user_id, action, details }) {
    db.prepare(
      'INSERT INTO audit_log (user_id, action, details) VALUES (?, ?, ?)'
    ).run(user_id || null, action, typeof details === 'object' ? JSON.stringify(details) : (details || ''));
  },
  list(limit = 100, offset = 0) {
    return db.prepare(`
      SELECT al.*, us.steam_name as user_name
      FROM audit_log al
      LEFT JOIN users us ON us.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  },
};

// --- Announcements ---
const Announcements = {
  listActive() {
    return db.prepare(`
      SELECT a.*, us.steam_name as creator_name
      FROM announcements a
      LEFT JOIN users us ON us.id = a.created_by
      WHERE a.expires_at IS NULL OR a.expires_at > datetime('now')
      ORDER BY a.created_at DESC
    `).all();
  },
  list() {
    return db.prepare(`
      SELECT a.*, us.steam_name as creator_name
      FROM announcements a
      LEFT JOIN users us ON us.id = a.created_by
      ORDER BY a.created_at DESC
    `).all();
  },
  create({ title, content, created_by, expires_at }) {
    const info = db.prepare(
      'INSERT INTO announcements (title, content, created_by, expires_at) VALUES (?, ?, ?, ?)'
    ).run(title, content || '', created_by, expires_at || null);
    return db.prepare('SELECT * FROM announcements WHERE id = ?').get(info.lastInsertRowid);
  },
  delete(id) {
    db.prepare('DELETE FROM announcements WHERE id = ?').run(id);
  },
};

module.exports = {
  initDb,
  getDb: () => db,
  Users,
  Departments,
  UserDepartments,
  DiscordRoleMappings,
  Units,
  Calls,
  Bolos,
  CriminalRecords,
  FiveMPlayerLinks,
  FiveMFineJobs,
  Settings,
  AuditLog,
  Announcements,
};
