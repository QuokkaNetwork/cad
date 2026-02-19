const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Units, Departments, SubDepartments, Users, FiveMPlayerLinks, Settings, Calls } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const liveMapStore = require('../services/liveMapStore');
const {
  LIVE_MAP_TILE_NAMES,
  LIVE_MAP_TILE_URL_TEMPLATE,
  LIVE_MAP_TILE_SIZE,
  LIVE_MAP_TILE_ROWS,
  LIVE_MAP_TILE_COLUMNS,
  LIVE_MAP_MIN_ZOOM,
  LIVE_MAP_MAX_ZOOM,
  LIVE_MAP_MIN_NATIVE_ZOOM,
  LIVE_MAP_MAX_NATIVE_ZOOM,
  listMissingLiveMapTiles,
  hasCompleteLiveMapTiles,
} = require('../services/liveMapTiles');

const router = express.Router();
const ACTIVE_LINK_MAX_AGE_MS = 5 * 60 * 1000;
const DEFAULT_MAP_SCALE = 1;
const DEFAULT_MAP_OFFSET = 0;
const DEFAULT_MAP_CALIBRATION_INCREMENT = 0.1;
const DEFAULT_MAP_ADMIN_CALIBRATION_VISIBLE = true;
const DEFAULT_MAP_GAME_BOUNDS = Object.freeze({
  x1: -4230,
  y1: 8420,
  x2: 370,
  y2: -640,
});

function parseMapNumber(value, fallback) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseMapCalibrationIncrement(value, fallback = DEFAULT_MAP_CALIBRATION_INCREMENT) {
  const parsed = parseMapNumber(value, fallback);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(0.001, Math.min(100, parsed));
}

function parseMapBoolean(value, fallback) {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return false;
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

function normalizeUnitStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function getEditableUnitStatuses() {
  return new Set(['available', 'busy', 'enroute', 'on-scene']);
}

function emitRouteClearOnAvailable(unit, statusValue) {
  const normalizedStatus = normalizeUnitStatus(statusValue);
  if (normalizedStatus !== 'available') return;
  if (!unit || !unit.id) return;

  const activeCall = Calls.getAssignedCallForUnit(unit.id);
  bus.emit('unit:status_available', {
    departmentId: unit.department_id,
    unit,
    call: activeCall || null,
  });
}

function canDispatchManageUnit(user, unit) {
  if (!user || !unit) return false;
  if (user.is_admin) return true;
  if (Number(user.id) === Number(unit.user_id)) return true;
  if (!isUserInDispatchDepartment(user)) return false;

  const actingUnit = Units.findByUserId(user.id);
  if (!actingUnit) return false;
  const actingDept = Departments.findById(Number(actingUnit.department_id));
  if (!actingDept?.is_dispatch) return false;

  const allowedDeptIds = new Set(Departments.listDispatchVisible().map(d => Number(d.id)));
  for (const dispatchDept of findDispatchDepartments()) {
    allowedDeptIds.add(Number(dispatchDept.id));
  }
  return allowedDeptIds.has(Number(unit.department_id));
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

function parsePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 0;
  return parsed;
}

function normalizeLookupToken(value) {
  return String(value || '').trim().toLowerCase();
}

function pickLatestPlayer(existing, candidate) {
  if (!existing) return candidate;
  const existingTs = Number(existing?.updatedAtMs || 0);
  const candidateTs = Number(candidate?.updatedAtMs || 0);
  return candidateTs >= existingTs ? candidate : existing;
}

function setIndexedPlayer(index, key, player) {
  const normalizedKey = normalizeLookupToken(key);
  if (!normalizedKey) return;
  index.set(normalizedKey, pickLatestPlayer(index.get(normalizedKey), player));
}

function buildLiveMapPlayerIndexes(players = []) {
  const byCadUserId = new Map();
  const bySteamId = new Map();
  const byDiscordId = new Map();
  const byCitizenId = new Map();

  for (const player of players) {
    const candidate = player || {};
    const cadUserId = parsePositiveInt(candidate.cadUserId ?? candidate.cad_user_id);
    if (cadUserId) {
      byCadUserId.set(cadUserId, pickLatestPlayer(byCadUserId.get(cadUserId), candidate));
    }

    setIndexedPlayer(bySteamId, candidate.steamId || candidate.steam_id, candidate);
    setIndexedPlayer(byDiscordId, candidate.discordId || candidate.discord_id, candidate);
    setIndexedPlayer(byCitizenId, candidate.citizenid, candidate);
  }

  return { byCadUserId, bySteamId, byDiscordId, byCitizenId };
}

function resolveLiveMapPlayerForUnit(unit, user, indexes) {
  const unitUserId = parsePositiveInt(unit?.user_id);
  if (unitUserId && indexes.byCadUserId.has(unitUserId)) {
    return indexes.byCadUserId.get(unitUserId) || null;
  }

  const steamId = normalizeLookupToken(user?.steam_id);
  if (steamId && indexes.bySteamId.has(steamId)) {
    return indexes.bySteamId.get(steamId) || null;
  }

  const discordId = normalizeLookupToken(user?.discord_id);
  if (discordId && indexes.byDiscordId.has(discordId)) {
    return indexes.byDiscordId.get(discordId) || null;
  }

  const preferredCitizenId = normalizeLookupToken(user?.preferred_citizen_id);
  if (preferredCitizenId && indexes.byCitizenId.has(preferredCitizenId)) {
    return indexes.byCitizenId.get(preferredCitizenId) || null;
  }

  return null;
}

function isFieldUnit(unit, dispatchDeptIds) {
  if (!unit) return false;
  if (dispatchDeptIds.has(Number(unit.department_id))) return false;
  const callsign = String(unit.callsign || '').trim().toUpperCase();
  if (!callsign || callsign === 'DISPATCH') return false;
  return true;
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
  units = units.filter(unit => isFieldUnit(unit, dispatchDeptIds));

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
  const directUrl = String(Settings.get('live_map_url') || '').trim();
  const socketUrl = String(Settings.get('live_map_socket_url') || '').trim();
  const mapScaleX = parseMapNumber(Settings.get('live_map_scale_x'), DEFAULT_MAP_SCALE);
  const mapScaleY = parseMapNumber(Settings.get('live_map_scale_y'), DEFAULT_MAP_SCALE);
  const mapOffsetX = parseMapNumber(Settings.get('live_map_offset_x'), DEFAULT_MAP_OFFSET);
  const mapOffsetY = parseMapNumber(Settings.get('live_map_offset_y'), DEFAULT_MAP_OFFSET);
  const mapCalibrationIncrement = parseMapCalibrationIncrement(
    Settings.get('live_map_calibration_increment'),
    DEFAULT_MAP_CALIBRATION_INCREMENT
  );
  const adminCalibrationVisible = parseMapBoolean(
    Settings.get('live_map_admin_calibration_visible'),
    DEFAULT_MAP_ADMIN_CALIBRATION_VISIBLE
  );
  const mapGameX1 = parseMapNumber(Settings.get('live_map_game_x1'), DEFAULT_MAP_GAME_BOUNDS.x1);
  const mapGameY1 = parseMapNumber(Settings.get('live_map_game_y1'), DEFAULT_MAP_GAME_BOUNDS.y1);
  const mapGameX2 = parseMapNumber(Settings.get('live_map_game_x2'), DEFAULT_MAP_GAME_BOUNDS.x2);
  const mapGameY2 = parseMapNumber(Settings.get('live_map_game_y2'), DEFAULT_MAP_GAME_BOUNDS.y2);
  const missingTiles = listMissingLiveMapTiles();
  const mapAvailable = hasCompleteLiveMapTiles();
  res.json({
    live_map_url: directUrl,
    map_image_url: '',
    map_available: mapAvailable,
    map_source: mapAvailable ? 'server_resource_tiles' : 'none',
    live_map_socket_url: socketUrl,
    map_scale_x: mapScaleX,
    map_scale_y: mapScaleY,
    map_offset_x: mapOffsetX,
    map_offset_y: mapOffsetY,
    map_calibration_increment: mapCalibrationIncrement,
    admin_calibration_visible: adminCalibrationVisible,
    map_game_x1: mapGameX1,
    map_game_y1: mapGameY1,
    map_game_x2: mapGameX2,
    map_game_y2: mapGameY2,
    map_game_bounds: {
      x1: mapGameX1,
      y1: mapGameY1,
      x2: mapGameX2,
      y2: mapGameY2,
    },
    tile_url_template: LIVE_MAP_TILE_URL_TEMPLATE,
    tile_names: LIVE_MAP_TILE_NAMES,
    tile_size: LIVE_MAP_TILE_SIZE,
    tile_rows: LIVE_MAP_TILE_ROWS,
    tile_columns: LIVE_MAP_TILE_COLUMNS,
    min_zoom: LIVE_MAP_MIN_ZOOM,
    max_zoom: LIVE_MAP_MAX_ZOOM,
    min_native_zoom: LIVE_MAP_MIN_NATIVE_ZOOM,
    max_native_zoom: LIVE_MAP_MAX_NATIVE_ZOOM,
    missing_tiles: missingTiles,
  });
});

router.get('/live-map/players', requireAuth, (req, res) => {
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

  const dispatchDeptIds = new Set(findDispatchDepartments().map(d => d.id));
  const fieldUnits = units.filter(unit => isFieldUnit(unit, dispatchDeptIds));

  const maxAgeMs = Math.max(5_000, parseInt(req.query.max_age_ms, 10) || liveMapStore.ACTIVE_PLAYER_MAX_AGE_MS);
  const now = Date.now();
  const players = liveMapStore.listPlayers(maxAgeMs);
  const indexes = buildLiveMapPlayerIndexes(players);
  const userCache = new Map();
  const payload = [];

  for (const unit of fieldUnits) {
    let user = userCache.get(unit.user_id);
    if (user === undefined) {
      user = Users.findById(unit.user_id) || null;
      userCache.set(unit.user_id, user);
    }

    const livePlayer = resolveLiveMapPlayerForUnit(unit, user, indexes);
    const link = chooseActiveLinkForUser(user);
    const linkTs = parseSqliteUtc(link?.updated_at);
    // Use ACTIVE_LINK_MAX_AGE_MS (5 min) for the FiveMPlayerLinks fallback — not the
    // tighter liveMapStore maxAgeMs — so on-duty units whose live-map entry has just
    // expired still appear on the map while their bridge connection recovers.
    const hasFreshLink = !!link && !Number.isNaN(linkTs) && (now - linkTs) <= ACTIVE_LINK_MAX_AGE_MS;

    const positionX = livePlayer
      ? Number(livePlayer?.pos?.x)
      : (hasFreshLink ? Number(link.position_x || 0) : NaN);
    const positionY = livePlayer
      ? Number(livePlayer?.pos?.y)
      : (hasFreshLink ? Number(link.position_y || 0) : NaN);
    const positionZ = livePlayer
      ? Number(livePlayer?.pos?.z)
      : (hasFreshLink ? Number(link.position_z || 0) : NaN);

    if (!Number.isFinite(positionX) || !Number.isFinite(positionY)) continue;

    const resolvedIdentifier = String(
      livePlayer?.identifier
      || livePlayer?.steamId
      || livePlayer?.steam_id
      || link?.steam_id
      || `unit:${unit.id}`
    ).trim();

    payload.push({
      identifier: resolvedIdentifier || `unit:${unit.id}`,
      cad_user_id: Number(user?.id || unit.user_id || 0),
      unit_id: Number(unit.id || 0),
      callsign: String(unit.callsign || '').trim(),
      status: String(unit.status || '').trim().toLowerCase(),
      name: String(livePlayer?.cadName || livePlayer?.name || unit.user_name || user?.steam_name || '').trim() || 'Unknown',
      location: String(livePlayer?.location || unit.location || '').trim(),
      vehicle: String(livePlayer?.vehicle || '').trim(),
      licensePlate: String(livePlayer?.licensePlate || livePlayer?.license_plate || '').trim(),
      weapon: String(livePlayer?.weapon || '').trim(),
      icon: Number.isFinite(Number(livePlayer?.icon)) ? Number(livePlayer.icon) : 6,
      hasSirenEnabled: livePlayer?.hasSirenEnabled === true || livePlayer?.has_siren_enabled === true,
      speed: Number.isFinite(Number(livePlayer?.speed))
        ? Number(livePlayer.speed)
        : (hasFreshLink ? Number(link.speed || 0) : 0),
      heading: Number.isFinite(Number(livePlayer?.heading))
        ? Number(livePlayer.heading)
        : (hasFreshLink ? Number(link.heading || 0) : 0),
      pos: {
        x: positionX,
        y: positionY,
        z: Number.isFinite(positionZ) ? positionZ : 0,
      },
      updatedAtMs: Number.isFinite(Number(livePlayer?.updatedAtMs))
        ? Number(livePlayer.updatedAtMs)
        : (hasFreshLink ? linkTs : now),
      department_id: Number(unit.department_id || 0),
      department_short_name: String(unit.department_short_name || ''),
    });
  }

  res.json({
    type: 'playerData',
    payload,
    total: payload.length,
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

// Get current user's active assigned call (if any)
router.get('/me/active-call', requireAuth, (req, res) => {
  const unit = Units.findByUserId(req.user.id);
  if (!unit) return res.status(404).json({ error: 'Not on duty' });

  const assigned = Calls.getAssignedCallForUnit(unit.id);
  if (!assigned) return res.json(null);

  const call = Calls.findById(assigned.id) || assigned;
  const department = Departments.findById(Number(call.department_id));
  res.json({
    ...call,
    department_name: department?.name || '',
    department_short_name: department?.short_name || '',
    department_color: department?.color || '',
  });
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
  emitRouteClearOnAvailable(updated, updates.status);
  res.json(updated);
});

// Dispatch/Admin update unit status.
router.patch('/:id/status', requireAuth, (req, res) => {
  const unitId = parseInt(req.params.id, 10);
  if (!unitId) return res.status(400).json({ error: 'Invalid unit id' });

  const unit = Units.findById(unitId);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  if (!canDispatchManageUnit(req.user, unit)) {
    return res.status(403).json({ error: 'Only dispatch or admins can update this unit status' });
  }

  const normalizedStatus = normalizeUnitStatus(req.body?.status);
  if (!getEditableUnitStatuses().has(normalizedStatus)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  Units.update(unit.id, { status: normalizedStatus });
  const updated = Units.findById(unit.id);
  bus.emit('unit:update', { departmentId: unit.department_id, unit: updated });
  emitRouteClearOnAvailable(updated, normalizedStatus);
  audit(req.user.id, 'unit_status_updated_by_dispatch', {
    target_unit_id: unit.id,
    callsign: unit.callsign,
    status: normalizedStatus,
  });
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
