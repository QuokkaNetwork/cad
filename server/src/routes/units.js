const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Units, Departments, SubDepartments, Users, FiveMPlayerLinks, Settings } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const liveMapStore = require('../services/liveMapStore');

const router = express.Router();
const ACTIVE_LINK_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_LIVE_MAP_IMAGE_URL = '/maps/FullMap.png';
const DEFAULT_MAP_SCALE = 1;
const DEFAULT_MAP_OFFSET = 0;

function parseMapNumber(value, fallback) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseMapBoolean(value, fallback) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'off'].includes(text)) return false;
  return fallback;
}

function parseSqliteUtc(value) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  const base = text.replace(' ', 'T');
  const normalized = base.endsWith('Z') ? base : `${base}Z`;
  return Date.parse(normalized);
}

function findDispatchDepartments() {
  return Departments.list().filter(d => d.is_dispatch);
}

function isUserInDispatchDepartment(user) {
  const dispatchDepts = findDispatchDepartments();
  if (!dispatchDepts.length) return false;
  const dispatchIds = dispatchDepts.map(d => d.id);
  return user.departments.some(d => dispatchIds.includes(d.id));
}

function chooseActiveLinkForUser(user) {
  if (!user) return null;

  const candidates = [];
  const steamId = String(user.steam_id || '').trim();
  const discordId = String(user.discord_id || '').trim();

  if (steamId) {
    const bySteam = FiveMPlayerLinks.findBySteamId(steamId);
    if (bySteam) candidates.push(bySteam);
  }
  if (discordId) {
    const byDiscord = FiveMPlayerLinks.findBySteamId(`discord:${discordId}`);
    if (byDiscord) candidates.push(byDiscord);
  }

  let selected = null;
  let selectedTs = NaN;
  for (const candidate of candidates) {
    const ts = parseSqliteUtc(candidate?.updated_at);
    if (Number.isNaN(ts)) continue;
    if (!selected || ts > selectedTs) {
      selected = candidate;
      selectedTs = ts;
    }
  }
  return selected;
}

function getAvailableSubDepartments(user, deptId) {
  const allForDept = SubDepartments.listByDepartment(deptId, true);
  if (user.is_admin) return allForDept;

  const allowed = Array.isArray(user.sub_departments)
    ? user.sub_departments.filter(sd => sd.department_id === deptId && sd.is_active)
    : [];

  // If no specific sub-department role mapping exists for this user+department,
  // allow any active sub-department in the department.
  return allowed.length > 0 ? allowed : allForDept;
}

// List on-duty units (filtered by department query param)
router.get('/', requireAuth, (req, res) => {
  const { department_id } = req.query;
  if (department_id) {
    const deptId = parseInt(department_id, 10);
    const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
    if (!hasDept) return res.status(403).json({ error: 'Department access denied' });
    return res.json(Units.listByDepartment(deptId));
  }
  res.json(Units.list());
});

// Dispatcher availability for self-dispatch logic
router.get('/dispatcher-status', requireAuth, (req, res) => {
  const { department_id } = req.query;
  const deptId = parseInt(department_id, 10);
  if (!deptId) return res.status(400).json({ error: 'department_id is required' });

  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const dispatchDepts = findDispatchDepartments();
  if (!dispatchDepts.length) {
    return res.json({
      dispatch_department: null,
      dispatcher_online: false,
      online_count: 0,
      is_dispatch_department: false,
    });
  }

  const dispatchIds = dispatchDepts.map(d => d.id);
  const dispatchUnits = Units.listByDepartmentIds(dispatchIds);
  const isDispatchDept = dispatchIds.includes(deptId);
  return res.json({
    dispatch_department: dispatchDepts[0],
    dispatcher_online: dispatchUnits.length > 0,
    online_count: dispatchUnits.length,
    is_dispatch_department: isDispatchDept,
  });
});

// Get all units from dispatch-visible departments (for dispatch centres)
router.get('/dispatchable', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Only dispatch departments can access this' });
  }

  const visibleDepts = Departments.listDispatchVisible();
  const deptIds = visibleDepts.map(d => d.id);
  const units = Units.listByDepartmentIds(deptIds);
  res.json({ departments: visibleDepts, units });
});

// List units with live FiveM map coordinates.
router.get('/map', requireAuth, (req, res) => {
  const deptId = parseInt(req.query.department_id, 10);
  if (!deptId) return res.status(400).json({ error: 'department_id is required' });

  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  let units = [];
  const dispatchMode = req.query.dispatch === 'true';
  if (dispatchMode && (req.user.is_admin || isUserInDispatchDepartment(req.user))) {
    const visibleIds = Departments.listDispatchVisible().map(d => d.id);
    if (!visibleIds.includes(deptId)) visibleIds.push(deptId);
    units = Units.listByDepartmentIds(visibleIds);
  } else {
    units = Units.listByDepartment(deptId);
  }

  // Live map should only show field units, never dispatch units.
  const dispatchDeptIds = new Set(findDispatchDepartments().map(d => d.id));
  units = units.filter(unit => {
    if (dispatchDeptIds.has(Number(unit.department_id))) return false;
    const callsign = String(unit.callsign || '').trim().toUpperCase();
    if (callsign === 'DISPATCH') return false;
    return true;
  });

  const userCache = new Map();
  const payload = units.map((unit) => {
    let user = userCache.get(unit.user_id);
    if (!user) {
      user = Users.findById(unit.user_id) || null;
      userCache.set(unit.user_id, user);
    }

    const link = chooseActiveLinkForUser(user);
    const linkTs = parseSqliteUtc(link?.updated_at);
    const stale = !link || Number.isNaN(linkTs) || (Date.now() - linkTs) > ACTIVE_LINK_MAX_AGE_MS;

    return {
      ...unit,
      position_x: link ? Number(link.position_x || 0) : null,
      position_y: link ? Number(link.position_y || 0) : null,
      position_z: link ? Number(link.position_z || 0) : null,
      position_heading: link ? Number(link.heading || 0) : null,
      position_speed: link ? Number(link.speed || 0) : null,
      position_updated_at: link?.updated_at || null,
      position_stale: stale,
    };
  });

  res.json(payload);
});

router.get('/map-config', requireAuth, (_req, res) => {
  const forceRepoMapAsset = parseMapBoolean(Settings.get('live_map_use_repo_asset'), true);
  const configured = String(Settings.get('live_map_image_url') || '').trim();
  const directUrl = String(Settings.get('live_map_url') || '').trim();
  const socketUrl = String(Settings.get('live_map_socket_url') || '').trim();
  const mapScaleX = parseMapNumber(Settings.get('live_map_scale_x'), DEFAULT_MAP_SCALE);
  const mapScaleY = parseMapNumber(Settings.get('live_map_scale_y'), DEFAULT_MAP_SCALE);
  const mapOffsetX = parseMapNumber(Settings.get('live_map_offset_x'), DEFAULT_MAP_OFFSET);
  const mapOffsetY = parseMapNumber(Settings.get('live_map_offset_y'), DEFAULT_MAP_OFFSET);
  res.json({
    live_map_url: directUrl,
    map_image_url: forceRepoMapAsset ? DEFAULT_LIVE_MAP_IMAGE_URL : (configured || DEFAULT_LIVE_MAP_IMAGE_URL),
    live_map_socket_url: socketUrl,
    map_scale_x: mapScaleX,
    map_scale_y: mapScaleY,
    map_offset_x: mapOffsetX,
    map_offset_y: mapOffsetY,
  });
});

router.get('/live-map/players', requireAuth, (req, res) => {
  const maxAgeMs = Math.max(5_000, parseInt(req.query.max_age_ms, 10) || liveMapStore.ACTIVE_PLAYER_MAX_AGE_MS);
  const players = liveMapStore.listPlayers(maxAgeMs);
  res.json({
    type: 'playerData',
    payload: players,
    total: players.length,
    max_age_ms: maxAgeMs,
    timestamp: Date.now(),
  });
});

// List sub-departments available to current user for a department
router.get('/sub-departments', requireAuth, (req, res) => {
  const deptId = parseInt(req.query.department_id, 10);
  if (!deptId) return res.status(400).json({ error: 'department_id is required' });

  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  res.json(getAvailableSubDepartments(req.user, deptId));
});

// Get current user's unit
router.get('/me', requireAuth, (req, res) => {
  const unit = Units.findByUserId(req.user.id);
  if (!unit) return res.status(404).json({ error: 'Not on duty' });
  res.json(unit);
});

// Go on duty
router.post('/me', requireAuth, (req, res) => {
  const existing = Units.findByUserId(req.user.id);
  if (existing) return res.status(400).json({ error: 'Already on duty' });

  const { callsign, department_id, sub_department_id } = req.body;
  if (!department_id) {
    return res.status(400).json({ error: 'Department is required' });
  }

  const deptId = parseInt(department_id, 10);
  const dept = Departments.findById(deptId);
  if (!dept) return res.status(400).json({ error: 'Department not found' });

  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const availableSubDepts = getAvailableSubDepartments(req.user, deptId);
  let selectedSubDeptId = null;
  if (!dept.is_dispatch && availableSubDepts.length > 0) {
    selectedSubDeptId = parseInt(sub_department_id, 10);
    if (!selectedSubDeptId) {
      return res.status(400).json({ error: 'sub_department_id is required for this department' });
    }
    const valid = availableSubDepts.find(sd => sd.id === selectedSubDeptId);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid sub department selection' });
    }
  }

  const normalizedCallsign = dept.is_dispatch ? 'DISPATCH' : String(callsign || '').trim();
  if (!normalizedCallsign) {
    return res.status(400).json({ error: 'Callsign is required' });
  }

  const unit = Units.create({
    user_id: req.user.id,
    department_id: deptId,
    sub_department_id: selectedSubDeptId,
    callsign: normalizedCallsign,
  });

  const selectedSubDept = selectedSubDeptId ? SubDepartments.findById(selectedSubDeptId) : null;
  audit(req.user.id, 'unit_on_duty', {
    callsign: normalizedCallsign,
    department: dept.short_name,
    sub_department: selectedSubDept?.short_name || '',
  });
  bus.emit('unit:online', { departmentId: deptId, unit });
  res.status(201).json(unit);
});

// Update own unit (status/callsign only; location is driven by bridge heartbeat)
router.patch('/me', requireAuth, (req, res) => {
  const unit = Units.findByUserId(req.user.id);
  if (!unit) return res.status(404).json({ error: 'Not on duty' });

  const { status, callsign } = req.body;
  const updates = {};
  if (status !== undefined) {
    const normalizedStatus = String(status || '').trim().toLowerCase();
    const allowed = new Set(['available', 'busy', 'enroute', 'on-scene']);
    if (!allowed.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }
    updates.status = normalizedStatus;
  }
  if (callsign !== undefined) {
    const normalizedCallsign = String(callsign || '').trim();
    if (!normalizedCallsign) {
      return res.status(400).json({ error: 'Callsign cannot be empty' });
    }
    updates.callsign = normalizedCallsign;
  }
  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No editable unit fields supplied' });
  }

  Units.update(unit.id, updates);
  const updated = Units.findById(unit.id);

  bus.emit('unit:update', { departmentId: unit.department_id, unit: updated });
  res.json(updated);
});

// Go off duty
router.delete('/me', requireAuth, (req, res) => {
  const unit = Units.findByUserId(req.user.id);
  if (!unit) return res.status(404).json({ error: 'Not on duty' });

  const deptId = unit.department_id;
  Units.remove(unit.id);

  audit(req.user.id, 'unit_off_duty', { callsign: unit.callsign });
  bus.emit('unit:offline', { departmentId: deptId, unit });
  res.json({ success: true });
});

module.exports = router;
