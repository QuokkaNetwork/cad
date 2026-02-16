const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../config');

let db;

const DEPARTMENT_LAYOUT_TYPES = new Set(['law_enforcement', 'paramedics', 'fire']);
const OFFENCE_CATEGORIES = new Set(['infringement', 'summary', 'indictment']);

function normalizeDepartmentLayoutType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (DEPARTMENT_LAYOUT_TYPES.has(normalized)) return normalized;
  return 'law_enforcement';
}

function normalizeOffenceCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (OFFENCE_CATEGORIES.has(normalized)) return normalized;
  return 'infringement';
}

function getNextSortOrder(tableName, whereClause = '', whereValues = []) {
  const query = `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order FROM ${tableName} ${whereClause}`;
  const row = db.prepare(query).get(...whereValues);
  return Number.isFinite(Number(row?.next_sort_order)) ? Number(row.next_sort_order) : 0;
}

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
    const allowed = ['steam_name', 'avatar_url', 'discord_id', 'discord_name', 'is_admin', 'is_banned', 'preferred_citizen_id'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'preferred_citizen_id') {
          values.push(String(fields[key] || '').trim());
        } else {
          values.push(fields[key]);
        }
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
    return db.prepare('SELECT * FROM departments ORDER BY sort_order ASC, id ASC').all();
  },
  listActive() {
    return db.prepare('SELECT * FROM departments WHERE is_active = 1 ORDER BY sort_order ASC, id ASC').all();
  },
  findById(id) {
    return db.prepare('SELECT * FROM departments WHERE id = ?').get(id);
  },
  findByShortName(shortName) {
    return db.prepare('SELECT * FROM departments WHERE short_name = ?').get(shortName);
  },
  create({ name, short_name, color, icon, slogan, layout_type, fivem_job_name, fivem_job_grade, sort_order }) {
    const resolvedSortOrder = Number.isFinite(Number(sort_order))
      ? Math.max(0, Math.trunc(Number(sort_order)))
      : getNextSortOrder('departments');
    const info = db.prepare(
      'INSERT INTO departments (name, short_name, color, icon, slogan, layout_type, fivem_job_name, fivem_job_grade, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name,
      short_name || '',
      color || '#0052C2',
      icon || '',
      String(slogan || '').trim(),
      normalizeDepartmentLayoutType(layout_type),
      String(fivem_job_name || '').trim(),
      Number.isFinite(Number(fivem_job_grade)) ? Math.max(0, Math.trunc(Number(fivem_job_grade))) : 0,
      resolvedSortOrder
    );
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['name', 'short_name', 'color', 'icon', 'slogan', 'is_active', 'dispatch_visible', 'is_dispatch', 'layout_type', 'fivem_job_name', 'fivem_job_grade', 'sort_order'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'fivem_job_name' || key === 'slogan') {
          values.push(String(fields[key] || '').trim());
        } else if (key === 'fivem_job_grade') {
          const grade = Number(fields[key]);
          values.push(Number.isFinite(grade) ? Math.max(0, Math.trunc(grade)) : 0);
        } else if (key === 'layout_type') {
          values.push(normalizeDepartmentLayoutType(fields[key]));
        } else if (key === 'sort_order') {
          const sortOrder = Number(fields[key]);
          values.push(Number.isFinite(sortOrder) ? Math.max(0, Math.trunc(sortOrder)) : 0);
        } else {
          values.push(fields[key]);
        }
      }
    }
    if (updates.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE departments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  listDispatchVisible() {
    const explicit = db.prepare(
      'SELECT * FROM departments WHERE dispatch_visible = 1 AND is_active = 1 AND is_dispatch = 0 ORDER BY sort_order ASC, id ASC'
    ).all();
    if (explicit.length > 0) return explicit;
    return db.prepare(
      'SELECT * FROM departments WHERE is_active = 1 AND is_dispatch = 0 ORDER BY sort_order ASC, id ASC'
    ).all();
  },
  reorder(orderedIds) {
    const tx = db.transaction(() => {
      const update = db.prepare('UPDATE departments SET sort_order = ? WHERE id = ?');
      orderedIds.forEach((id, index) => {
        update.run(index, id);
      });
    });
    tx();
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
      ORDER BY d.sort_order ASC, d.id ASC
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

// --- Sub Departments ---
const SubDepartments = {
  list() {
    return db.prepare(`
      SELECT sd.*, d.name as department_name, d.short_name as department_short_name
      FROM sub_departments sd
      JOIN departments d ON d.id = sd.department_id
      ORDER BY d.sort_order ASC, d.id ASC, sd.sort_order ASC, sd.name ASC, sd.id ASC
    `).all();
  },
  listByDepartment(departmentId, activeOnly = false) {
    const filter = activeOnly ? 'AND sd.is_active = 1' : '';
    return db.prepare(`
      SELECT sd.*, d.name as department_name, d.short_name as department_short_name
      FROM sub_departments sd
      JOIN departments d ON d.id = sd.department_id
      WHERE sd.department_id = ? ${filter}
      ORDER BY sd.sort_order ASC, sd.name ASC, sd.id ASC
    `).all(departmentId);
  },
  findById(id) {
    return db.prepare(`
      SELECT sd.*, d.name as department_name, d.short_name as department_short_name
      FROM sub_departments sd
      JOIN departments d ON d.id = sd.department_id
      WHERE sd.id = ?
    `).get(id);
  },
  create({ department_id, name, short_name, color, is_active, fivem_job_name, fivem_job_grade, sort_order }) {
    const resolvedSortOrder = Number.isFinite(Number(sort_order))
      ? Math.max(0, Math.trunc(Number(sort_order)))
      : getNextSortOrder('sub_departments', 'WHERE department_id = ?', [department_id]);
    const info = db.prepare(`
      INSERT INTO sub_departments (department_id, name, short_name, color, is_active, fivem_job_name, fivem_job_grade, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      department_id,
      name,
      short_name || '',
      color || '#0052C2',
      is_active === undefined ? 1 : (is_active ? 1 : 0),
      String(fivem_job_name || '').trim(),
      Number.isFinite(Number(fivem_job_grade)) ? Math.max(0, Math.trunc(Number(fivem_job_grade))) : 0,
      resolvedSortOrder
    );
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['name', 'short_name', 'color', 'is_active', 'fivem_job_name', 'fivem_job_grade', 'sort_order'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'fivem_job_name') {
          values.push(String(fields[key] || '').trim());
        } else if (key === 'fivem_job_grade') {
          const grade = Number(fields[key]);
          values.push(Number.isFinite(grade) ? Math.max(0, Math.trunc(grade)) : 0);
        } else if (key === 'sort_order') {
          const sortOrder = Number(fields[key]);
          values.push(Number.isFinite(sortOrder) ? Math.max(0, Math.trunc(sortOrder)) : 0);
        } else {
          values.push(fields[key]);
        }
      }
    }
    if (updates.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE sub_departments SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  reorderForDepartment(departmentId, orderedIds) {
    const tx = db.transaction(() => {
      const update = db.prepare('UPDATE sub_departments SET sort_order = ? WHERE id = ? AND department_id = ?');
      orderedIds.forEach((id, index) => {
        update.run(index, id, departmentId);
      });
    });
    tx();
  },
  delete(id) {
    db.prepare('DELETE FROM sub_departments WHERE id = ?').run(id);
  },
};

// --- User Sub Departments ---
const UserSubDepartments = {
  getForUser(userId) {
    return db.prepare(`
      SELECT sd.*, d.name as department_name, d.short_name as department_short_name
      FROM sub_departments sd
      JOIN user_sub_departments usd ON usd.sub_department_id = sd.id
      JOIN departments d ON d.id = sd.department_id
      WHERE usd.user_id = ?
      ORDER BY d.sort_order ASC, d.id ASC, sd.sort_order ASC, sd.name ASC
    `).all(userId);
  },
  setForUser(userId, subDepartmentIds) {
    db.transaction(() => {
      db.prepare('DELETE FROM user_sub_departments WHERE user_id = ?').run(userId);
      const insert = db.prepare('INSERT INTO user_sub_departments (user_id, sub_department_id) VALUES (?, ?)');
      for (const subDeptId of subDepartmentIds) {
        insert.run(userId, subDeptId);
      }
    })();
  },
};

// --- Discord Role Mappings / Links ---
const DiscordRoleMappings = {
  list() {
    return db.prepare(`
      SELECT
        drl.*,
        d.name as department_name,
        d.short_name as department_short_name,
        sd.name as sub_department_name,
        sd.short_name as sub_department_short_name,
        pd.name as parent_department_name,
        pd.short_name as parent_department_short_name
      FROM discord_role_links drl
      LEFT JOIN departments d
        ON drl.target_type = 'department' AND d.id = drl.target_id
      LEFT JOIN sub_departments sd
        ON drl.target_type = 'sub_department' AND sd.id = drl.target_id
      LEFT JOIN departments pd
        ON sd.department_id = pd.id
      ORDER BY drl.id
    `).all();
  },
  findByRoleId(roleId) {
    return db.prepare('SELECT * FROM discord_role_links WHERE discord_role_id = ?').all(roleId);
  },
  create({ discord_role_id, discord_role_name, target_type, target_id, job_name, job_grade }) {
    const normalizedTargetId = Number.isFinite(Number(target_id)) ? Math.max(0, Math.trunc(Number(target_id))) : 0;
    const normalizedJobName = String(job_name || '').trim();
    const normalizedJobGradeRaw = Number(job_grade);
    const normalizedJobGrade = Number.isFinite(normalizedJobGradeRaw)
      ? Math.max(0, Math.trunc(normalizedJobGradeRaw))
      : 0;

    const info = db.prepare(
      `INSERT INTO discord_role_links (
        discord_role_id, discord_role_name, target_type, target_id, job_name, job_grade
      ) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      discord_role_id,
      discord_role_name || '',
      target_type,
      normalizedTargetId,
      normalizedJobName,
      normalizedJobGrade
    );

    return {
      id: info.lastInsertRowid,
      discord_role_id,
      discord_role_name: discord_role_name || '',
      target_type,
      target_id: normalizedTargetId,
      job_name: normalizedJobName,
      job_grade: normalizedJobGrade,
    };
  },
  delete(id) {
    db.prepare('DELETE FROM discord_role_links WHERE id = ?').run(id);
  },
};

// --- Units ---
const Units = {
  _baseSelect() {
    return `
      SELECT
        u.*,
        us.steam_name as user_name,
        us.avatar_url as user_avatar,
        sd.name as sub_department_name,
        sd.short_name as sub_department_short_name,
        sd.color as sub_department_color
      FROM units u
      JOIN users us ON us.id = u.user_id
      LEFT JOIN sub_departments sd ON sd.id = u.sub_department_id
    `;
  },
  findById(id) {
    return db.prepare(`${this._baseSelect()} WHERE u.id = ?`).get(id);
  },
  findByUserId(userId) {
    return db.prepare(`${this._baseSelect()} WHERE u.user_id = ?`).get(userId);
  },
  listByDepartment(departmentId) {
    return db.prepare(`${this._baseSelect()} WHERE u.department_id = ? ORDER BY u.callsign`).all(departmentId);
  },
  listByDepartmentIds(departmentIds) {
    if (!departmentIds.length) return [];
    const placeholders = departmentIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT
        u.*,
        us.steam_name as user_name,
        us.avatar_url as user_avatar,
        sd.name as sub_department_name,
        sd.short_name as sub_department_short_name,
        sd.color as sub_department_color,
        d.name as department_name,
        d.short_name as department_short_name,
        d.color as department_color
      FROM units u
      JOIN users us ON us.id = u.user_id
      JOIN departments d ON d.id = u.department_id
      LEFT JOIN sub_departments sd ON sd.id = u.sub_department_id
      WHERE u.department_id IN (${placeholders})
      ORDER BY d.id, u.callsign
    `).all(...departmentIds);
  },
  list() {
    return db.prepare(`${this._baseSelect()} ORDER BY u.callsign`).all();
  },
  create({ user_id, department_id, sub_department_id, callsign, status, location, note }) {
    const info = db.prepare(
      'INSERT INTO units (user_id, department_id, sub_department_id, callsign, status, location, note) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(user_id, department_id, sub_department_id || null, callsign, status || 'available', location || '', note || '');
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

function normalizeRequestedDepartmentIds(value) {
  let source = [];
  if (Array.isArray(value)) {
    source = value;
  } else if (typeof value === 'string') {
    const text = String(value || '').trim();
    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) source = parsed;
      } catch {
        source = [];
      }
    }
  }

  return Array.from(new Set(
    source
      .map(item => Number(item))
      .filter(item => Number.isInteger(item) && item > 0)
  ));
}

function getFallbackRequestedDepartmentIds(departmentId) {
  const parsed = Number(departmentId);
  if (!Number.isInteger(parsed) || parsed <= 0) return [];
  return [parsed];
}

function normalizeRequestedDepartmentIdsWithFallback(value, fallbackDepartmentId) {
  const normalized = normalizeRequestedDepartmentIds(value);
  if (normalized.length > 0) return normalized;
  return getFallbackRequestedDepartmentIds(fallbackDepartmentId);
}

function hydrateRequestedDepartments(call) {
  if (!call || typeof call !== 'object') return call;
  call.requested_department_ids = normalizeRequestedDepartmentIdsWithFallback(
    call.requested_department_ids_json,
    call.department_id
  );
  return call;
}

// --- Calls ---
const Calls = {
  findById(id) {
    const call = db.prepare('SELECT * FROM calls WHERE id = ?').get(id);
    if (call) {
      call.assigned_units = db.prepare(`
        SELECT u.*, us.steam_name as user_name,
               sd.name as sub_department_name, sd.short_name as sub_department_short_name, sd.color as sub_department_color,
               d.short_name as department_short_name, d.color as department_color
        FROM call_units cu
        JOIN units u ON u.id = cu.unit_id
        JOIN users us ON us.id = u.user_id
        JOIN departments d ON d.id = u.department_id
        LEFT JOIN sub_departments sd ON sd.id = u.sub_department_id
        WHERE cu.call_id = ?
      `).all(id);
      hydrateRequestedDepartments(call);
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
      SELECT u.id, u.callsign, u.status, us.steam_name as user_name,
             sd.name as sub_department_name, sd.short_name as sub_department_short_name, sd.color as sub_department_color,
             d.short_name as department_short_name, d.color as department_color
      FROM call_units cu
      JOIN units u ON u.id = cu.unit_id
      JOIN users us ON us.id = u.user_id
      JOIN departments d ON d.id = u.department_id
      LEFT JOIN sub_departments sd ON sd.id = u.sub_department_id
      WHERE cu.call_id = ?
    `);

    for (const call of calls) {
      call.assigned_units = getUnits.all(call.id);
      hydrateRequestedDepartments(call);
    }
    return calls;
  },
  listByDepartmentIds(departmentIds, includeCompleted = false) {
    if (!departmentIds.length) return [];
    const placeholders = departmentIds.map(() => '?').join(',');
    const statusFilter = includeCompleted ? '' : "AND c.status != 'closed'";
    const calls = db.prepare(`
      SELECT c.*, us.steam_name as creator_name,
             d.name as department_name, d.short_name as department_short_name, d.color as department_color
      FROM calls c
      LEFT JOIN users us ON us.id = c.created_by
      JOIN departments d ON d.id = c.department_id
      WHERE c.department_id IN (${placeholders}) ${statusFilter}
      ORDER BY
        CASE c.priority WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 ELSE 4 END,
        c.created_at DESC
    `).all(...departmentIds);

    const getUnits = db.prepare(`
      SELECT u.id, u.callsign, u.status, us.steam_name as user_name,
             sd.name as sub_department_name, sd.short_name as sub_department_short_name, sd.color as sub_department_color,
             d.short_name as department_short_name, d.color as department_color
      FROM call_units cu
      JOIN units u ON u.id = cu.unit_id
      JOIN users us ON us.id = u.user_id
      JOIN departments d ON d.id = u.department_id
      LEFT JOIN sub_departments sd ON sd.id = u.sub_department_id
      WHERE cu.call_id = ?
    `);

    for (const call of calls) {
      call.assigned_units = getUnits.all(call.id);
      hydrateRequestedDepartments(call);
    }
    return calls;
  },
  create({
    department_id,
    title,
    priority,
    location,
    description,
    job_code,
    status,
    created_by,
    postal,
    position_x,
    position_y,
    position_z,
    requested_department_ids,
  }) {
    const normalizedRequestedDepartmentIds = normalizeRequestedDepartmentIdsWithFallback(
      requested_department_ids,
      department_id
    );
    const info = db.prepare(
      `INSERT INTO calls (
        department_id, title, priority, location, description, job_code, status, created_by, postal, position_x, position_y, position_z, requested_department_ids_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      department_id,
      title,
      priority || '3',
      location || '',
      description || '',
      job_code || '',
      status || 'active',
      created_by,
      String(postal || '').trim(),
      Number.isFinite(Number(position_x)) ? Number(position_x) : null,
      Number.isFinite(Number(position_y)) ? Number(position_y) : null,
      Number.isFinite(Number(position_z)) ? Number(position_z) : null,
      JSON.stringify(normalizedRequestedDepartmentIds)
    );
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['title', 'priority', 'location', 'description', 'job_code', 'status', 'postal', 'position_x', 'position_y', 'position_z', 'was_ever_assigned', 'requested_department_ids_json'];
    const existing = this.findById(id) || null;
    const normalizedFields = { ...(fields || {}) };
    if (normalizedFields.requested_department_ids !== undefined && normalizedFields.requested_department_ids_json === undefined) {
      normalizedFields.requested_department_ids_json = normalizedFields.requested_department_ids;
    }

    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (normalizedFields[key] !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'postal') {
          values.push(String(normalizedFields[key] || '').trim());
        } else if (key === 'position_x' || key === 'position_y' || key === 'position_z') {
          values.push(Number.isFinite(Number(normalizedFields[key])) ? Number(normalizedFields[key]) : null);
        } else if (key === 'was_ever_assigned') {
          values.push(normalizedFields[key] ? 1 : 0);
        } else if (key === 'requested_department_ids_json') {
          const normalizedRequestedDepartmentIds = normalizeRequestedDepartmentIdsWithFallback(
            normalizedFields[key],
            existing?.department_id
          );
          values.push(JSON.stringify(normalizedRequestedDepartmentIds));
        } else {
          values.push(normalizedFields[key]);
        }
      }
    }
    if (updates.length === 0) return;
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE calls SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  assignUnit(callId, unitId) {
    const info = db.prepare('INSERT OR IGNORE INTO call_units (call_id, unit_id) VALUES (?, ?)').run(callId, unitId);
    return Number(info?.changes || 0);
  },
  unassignUnit(callId, unitId) {
    const info = db.prepare('DELETE FROM call_units WHERE call_id = ? AND unit_id = ?').run(callId, unitId);
    return Number(info?.changes || 0);
  },
  getAssignedCallForUnit(unitId) {
    const call = db.prepare(`
      SELECT c.* FROM calls c
      JOIN call_units cu ON cu.call_id = c.id
      WHERE cu.unit_id = ? AND c.status != 'closed'
      ORDER BY c.created_at DESC
      LIMIT 1
    `).get(unitId);
    return hydrateRequestedDepartments(call);
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

// --- Warrants ---
const Warrants = {
  listByDepartment(departmentId, status = 'active') {
    return db.prepare(`
      SELECT w.*, us.steam_name as creator_name
      FROM warrants w
      LEFT JOIN users us ON us.id = w.created_by
      WHERE w.department_id = ? AND w.status = ?
      ORDER BY w.created_at DESC
    `).all(departmentId, status);
  },
  findById(id) {
    return db.prepare(`
      SELECT w.*, us.steam_name as creator_name
      FROM warrants w
      LEFT JOIN users us ON us.id = w.created_by
      WHERE w.id = ?
    `).get(id);
  },
  findByCitizenId(citizenId, status = 'active') {
    return db.prepare(`
      SELECT w.*, us.steam_name as creator_name
      FROM warrants w
      LEFT JOIN users us ON us.id = w.created_by
      WHERE w.citizen_id = ? AND w.status = ?
      ORDER BY w.created_at DESC
    `).all(citizenId, status);
  },
  create({ department_id, citizen_id, title, description, details_json, created_by }) {
    const info = db.prepare(
      'INSERT INTO warrants (department_id, citizen_id, title, description, details_json, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(department_id, citizen_id, title, description || '', details_json || '{}', created_by);
    return this.findById(info.lastInsertRowid);
  },
  updateStatus(id, status) {
    db.prepare('UPDATE warrants SET status = ? WHERE id = ?').run(status, id);
  },
};

// --- Offence Catalog ---
const OffenceCatalog = {
  list(activeOnly = false) {
    const filter = activeOnly ? 'WHERE is_active = 1' : '';
    return db.prepare(`
      SELECT *
      FROM offence_catalog
      ${filter}
      ORDER BY
        CASE category
          WHEN 'infringement' THEN 1
          WHEN 'summary' THEN 2
          WHEN 'indictment' THEN 3
          ELSE 9
        END,
        sort_order ASC,
        title ASC,
        id ASC
    `).all();
  },
  findById(id) {
    return db.prepare('SELECT * FROM offence_catalog WHERE id = ?').get(id);
  },
  findByIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const numericIds = Array.from(new Set(
      ids
        .map(id => Number(id))
        .filter(id => Number.isInteger(id) && id > 0)
    ));
    if (numericIds.length === 0) return [];
    const placeholders = numericIds.map(() => '?').join(', ');
    return db.prepare(`SELECT * FROM offence_catalog WHERE id IN (${placeholders})`).all(...numericIds);
  },
  create({ category, code, title, description, fine_amount, sort_order, is_active }) {
    const normalizedCode = String(code || '').trim().toUpperCase();
    const info = db.prepare(`
      INSERT INTO offence_catalog (
        category, code, title, description, fine_amount, sort_order, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      normalizeOffenceCategory(category),
      normalizedCode,
      String(title || '').trim(),
      String(description || '').trim(),
      Math.max(0, Number(fine_amount || 0)),
      Number.isFinite(Number(sort_order)) ? Math.trunc(Number(sort_order)) : 0,
      is_active === undefined ? 1 : (is_active ? 1 : 0)
    );
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['category', 'code', 'title', 'description', 'fine_amount', 'sort_order', 'is_active'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'category') {
          values.push(normalizeOffenceCategory(fields[key]));
        } else if (key === 'code') {
          values.push(String(fields[key] || '').trim().toUpperCase());
        } else if (key === 'title') {
          values.push(String(fields[key] || '').trim());
        } else if (key === 'description') {
          values.push(String(fields[key] || '').trim());
        } else if (key === 'fine_amount') {
          values.push(Math.max(0, Number(fields[key] || 0)));
        } else if (key === 'sort_order') {
          values.push(Number.isFinite(Number(fields[key])) ? Math.trunc(Number(fields[key])) : 0);
        } else if (key === 'is_active') {
          values.push(fields[key] ? 1 : 0);
        } else {
          values.push(fields[key]);
        }
      }
    }
    if (updates.length === 0) return;
    updates.push("updated_at = datetime('now')");
    values.push(id);
    db.prepare(`UPDATE offence_catalog SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  delete(id) {
    db.prepare('DELETE FROM offence_catalog WHERE id = ?').run(id);
  },
  clearAll() {
    const tx = db.transaction(() => {
      const info = db.prepare('DELETE FROM offence_catalog').run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name = 'offence_catalog'").run();
      return Number(info?.changes || 0);
    });
    return tx();
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
  create({
    citizen_id,
    type,
    title,
    description,
    fine_amount,
    offence_items_json,
    officer_name,
    officer_callsign,
    department_id,
  }) {
    const info = db.prepare(
      'INSERT INTO criminal_records (citizen_id, type, title, description, fine_amount, offence_items_json, officer_name, officer_callsign, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      citizen_id,
      type,
      title,
      description || '',
      fine_amount || 0,
      String(offence_items_json || '[]'),
      officer_name || '',
      officer_callsign || '',
      department_id
    );
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = ['type', 'title', 'description', 'fine_amount', 'offence_items_json'];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        if (key === 'offence_items_json') {
          values.push(String(fields[key] || '[]'));
        } else {
          values.push(fields[key]);
        }
      }
    }
    if (updates.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE criminal_records SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  delete(id) {
    db.prepare('DELETE FROM criminal_records WHERE id = ?').run(id);
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
  markCancelled(id, error = 'Cancelled by admin') {
    db.prepare(`
      UPDATE fivem_fine_jobs
      SET
        status = CASE WHEN status = 'pending' OR status = 'failed' THEN 'cancelled' ELSE status END,
        error = CASE
          WHEN status = 'pending' OR status = 'failed' THEN ?
          ELSE error
        END,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(String(error || 'Cancelled by admin').slice(0, 500), id);
  },
  cancelPendingTestJobs(error = 'Cleared queued test fine jobs') {
    const info = db.prepare(`
      UPDATE fivem_fine_jobs
      SET status = 'cancelled', error = ?, updated_at = datetime('now')
      WHERE source_record_id IS NULL AND status = 'pending'
    `).run(String(error || 'Cleared queued test fine jobs').slice(0, 500));
    return info.changes || 0;
  },
  updatePendingBySourceRecordId(sourceRecordId, { amount, reason }) {
    db.prepare(`
      UPDATE fivem_fine_jobs
      SET amount = ?, reason = ?, updated_at = datetime('now')
      WHERE source_record_id = ? AND status = 'pending'
    `).run(Number(amount || 0), String(reason || ''), sourceRecordId);
  },
  detachSourceRecord(sourceRecordId, errorMessage = 'Source record deleted') {
    const info = db.prepare(`
      UPDATE fivem_fine_jobs
      SET
        status = CASE WHEN status = 'pending' THEN 'cancelled' ELSE status END,
        error = CASE
          WHEN status = 'pending' AND (error IS NULL OR error = '') THEN ?
          ELSE error
        END,
        source_record_id = NULL,
        updated_at = datetime('now')
      WHERE source_record_id = ?
    `).run(String(errorMessage || 'Source record deleted'), sourceRecordId);
    return info.changes || 0;
  },
  listRecent(limit = 100) {
    return db.prepare('SELECT * FROM fivem_fine_jobs ORDER BY created_at DESC LIMIT ?').all(limit);
  },
};

// --- FiveM job sync jobs ---
const FiveMJobSyncJobs = {
  createOrReplacePending({
    user_id,
    steam_id,
    discord_id,
    citizen_id,
    job_name,
    job_grade,
    source_type,
    source_id,
  }) {
    const normalizedJobName = String(job_name || '').trim();
    const normalizedSourceType = ['department', 'sub_department', 'fallback', 'none'].includes(String(source_type || '').trim())
      ? String(source_type || '').trim()
      : 'none';
    const normalizedGradeRaw = Number(job_grade);
    const normalizedGrade = Number.isFinite(normalizedGradeRaw) ? Math.max(0, Math.trunc(normalizedGradeRaw)) : 0;
    const normalizedSourceId = source_id ? Number(source_id) : null;

    const tx = db.transaction(() => {
      const pending = db.prepare(`
        SELECT id FROM fivem_job_sync_jobs
        WHERE user_id = ? AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `).get(user_id);

      if (pending) {
        db.prepare(`
          UPDATE fivem_job_sync_jobs
          SET
            steam_id = ?,
            discord_id = ?,
            citizen_id = ?,
            job_name = ?,
            job_grade = ?,
            source_type = ?,
            source_id = ?,
            error = '',
            updated_at = datetime('now')
          WHERE id = ?
        `).run(
          String(steam_id || '').trim(),
          String(discord_id || '').trim(),
          String(citizen_id || '').trim(),
          normalizedJobName,
          normalizedGrade,
          normalizedSourceType,
          normalizedSourceId,
          pending.id
        );
        return this.findById(pending.id);
      }

      const info = db.prepare(`
        INSERT INTO fivem_job_sync_jobs (
          user_id, steam_id, discord_id, citizen_id, job_name, job_grade, source_type, source_id,
          status, error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', '', datetime('now'), datetime('now'))
      `).run(
        user_id,
        String(steam_id || '').trim(),
        String(discord_id || '').trim(),
        String(citizen_id || '').trim(),
        normalizedJobName,
        normalizedGrade,
        normalizedSourceType,
        normalizedSourceId
      );
      return this.findById(info.lastInsertRowid);
    });

    return tx();
  },
  findById(id) {
    return db.prepare('SELECT * FROM fivem_job_sync_jobs WHERE id = ?').get(id);
  },
  findLatestByUserId(userId) {
    return db.prepare(`
      SELECT * FROM fivem_job_sync_jobs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(userId);
  },
  listPending(limit = 25) {
    return db.prepare(`
      SELECT * FROM fivem_job_sync_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT ?
    `).all(limit);
  },
  markSent(id) {
    db.prepare(`
      UPDATE fivem_job_sync_jobs
      SET status = 'sent', error = '', sent_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  },
  markFailed(id, error) {
    db.prepare(`
      UPDATE fivem_job_sync_jobs
      SET status = 'failed', error = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(String(error || '').slice(0, 500), id);
  },
  markPending(id) {
    db.prepare(`
      UPDATE fivem_job_sync_jobs
      SET status = 'pending', error = '', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);
  },
  listRecent(limit = 100) {
    return db.prepare('SELECT * FROM fivem_job_sync_jobs ORDER BY created_at DESC LIMIT ?').all(limit);
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

// --- Field Mapping Categories ---
const FieldMappingCategories = {
  list(entityType = 'person') {
    return db.prepare(
      'SELECT * FROM field_mapping_categories WHERE entity_type = ? ORDER BY sort_order ASC, id ASC'
    ).all(entityType);
  },
  findById(id) {
    return db.prepare('SELECT * FROM field_mapping_categories WHERE id = ?').get(id);
  },
  create({ name, entity_type = 'person', sort_order = 0 }) {
    const info = db.prepare(
      'INSERT INTO field_mapping_categories (name, entity_type, sort_order) VALUES (?, ?, ?)'
    ).run(name, entity_type, sort_order);
    return this.findById(info.lastInsertRowid);
  },
  update(id, { name, sort_order }) {
    const updates = [];
    const values = [];
    if (name !== undefined) { updates.push('name = ?'); values.push(name); }
    if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }
    if (updates.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE field_mapping_categories SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  delete(id) {
    db.prepare('DELETE FROM field_mapping_categories WHERE id = ?').run(id);
  },
};

// --- Field Mappings ---
const FieldMappings = {
  listByCategory(categoryId) {
    return db.prepare(
      'SELECT * FROM field_mappings WHERE category_id = ? ORDER BY sort_order ASC, id ASC'
    ).all(categoryId);
  },
  listAll(entityType = 'person') {
    return db.prepare(`
      SELECT fm.*, fmc.name as category_name, fmc.sort_order as category_sort_order
      FROM field_mappings fm
      JOIN field_mapping_categories fmc ON fmc.id = fm.category_id
      WHERE fmc.entity_type = ?
      ORDER BY fmc.sort_order ASC, fmc.id ASC, fm.sort_order ASC, fm.id ASC
    `).all(entityType);
  },
  findById(id) {
    return db.prepare('SELECT * FROM field_mappings WHERE id = ?').get(id);
  },
  create({
    category_id,
    label,
    table_name,
    column_name,
    is_json = 0,
    json_key = '',
    character_join_column = '',
    sort_order = 0,
    is_search_column = 0,
    field_key = '',
    field_type = 'text',
    preview_width = 1,
    friendly_values_json = '',
  }) {
    const info = db.prepare(`
      INSERT INTO field_mappings
        (
          category_id, label, table_name, column_name, is_json, json_key,
          character_join_column, sort_order, is_search_column, field_key, field_type, preview_width, friendly_values_json
        )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      category_id,
      label,
      table_name,
      column_name,
      is_json ? 1 : 0,
      json_key,
      character_join_column,
      sort_order,
      is_search_column ? 1 : 0,
      field_key,
      field_type,
      preview_width,
      String(friendly_values_json || '').trim()
    );
    return this.findById(info.lastInsertRowid);
  },
  update(id, fields) {
    const allowed = [
      'category_id',
      'label',
      'table_name',
      'column_name',
      'is_json',
      'json_key',
      'character_join_column',
      'sort_order',
      'is_search_column',
      'field_key',
      'field_type',
      'preview_width',
      'friendly_values_json',
    ];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        updates.push(`${key} = ?`);
        let val = fields[key];
        if (key === 'is_json' || key === 'is_search_column') val = val ? 1 : 0;
        if (key === 'category_id') val = Number(val) || 0;
        if (key === 'preview_width') {
          const parsed = Number(val);
          val = Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : 1;
        }
        values.push(val);
      }
    }
    if (updates.length === 0) return;
    values.push(id);
    db.prepare(`UPDATE field_mappings SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  },
  delete(id) {
    db.prepare('DELETE FROM field_mappings WHERE id = ?').run(id);
  },
};

module.exports = {
  initDb,
  getDb: () => db,
  Users,
  Departments,
  UserDepartments,
  SubDepartments,
  UserSubDepartments,
  DiscordRoleMappings,
  Units,
  Calls,
  Bolos,
  Warrants,
  OffenceCatalog,
  CriminalRecords,
  FiveMPlayerLinks,
  FiveMFineJobs,
  FiveMJobSyncJobs,
  Settings,
  AuditLog,
  Announcements,
  FieldMappingCategories,
  FieldMappings,
};
