const express = require('express');
const {
  Settings,
  Users,
  Units,
  Calls,
  Departments,
  FiveMPlayerLinks,
  FiveMFineJobs,
  FiveMJailJobs,
  DriverLicenses,
  VehicleRegistrations,
  VoiceCallSessions,
  VoiceChannels,
  VoiceParticipants,
  Bolos,
} = require('../db/sqlite');
const bus = require('../utils/eventBus');
const { audit } = require('../utils/audit');
const liveMapStore = require('../services/liveMapStore');
const { handleParticipantJoin, handleParticipantLeave } = require('../services/voiceBridgeSync');

const router = express.Router();
const liveLinkUserCache = new Map();
const ACTIVE_LINK_MAX_AGE_MS = 5 * 60 * 1000;
const pendingRouteJobs = new Map();
const pendingVoiceEvents = new Map();
let nextVoiceEventId = 1;
const VOICE_EVENT_RETRY_LIMIT = 5;
const DRIVER_LICENSE_STATUSES = new Set(['valid', 'suspended', 'disqualified', 'expired']);
const VEHICLE_REGISTRATION_STATUSES = new Set(['valid', 'suspended', 'revoked', 'expired']);
const BRIDGE_MUGSHOT_MAX_CHARS = Math.max(
  250000,
  Number.parseInt(process.env.FIVEM_BRIDGE_MUGSHOT_MAX_CHARS || '4000000', 10) || 4000000
);
const VOICE_HEARTBEAT_LOG_INTERVAL_MS = Math.max(
  5_000,
  Number.parseInt(process.env.FIVEM_VOICE_LOG_INTERVAL_MS || '15000', 10) || 15_000
);
let lastVoiceHeartbeatLogAt = 0;

function getBridgeToken() {
  return String(Settings.get('fivem_bridge_shared_token') || process.env.FIVEM_BRIDGE_SHARED_TOKEN || '').trim();
}

function getFineDeliveryMode() {
  return String(Settings.get('fivem_bridge_qbox_fines_delivery_mode') || 'bridge')
    .trim()
    .toLowerCase();
}

function getFineAccountKey() {
  return String(Settings.get('qbox_fine_account_key') || 'bank').trim() || 'bank';
}

function parseSqliteUtc(value) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  const base = text.replace(' ', 'T');
  const normalized = base.endsWith('Z') ? base : `${base}Z`;
  return Date.parse(normalized);
}

function isActiveFiveMLink(link) {
  const ts = parseSqliteUtc(link?.updated_at);
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) <= ACTIVE_LINK_MAX_AGE_MS;
}

function requireBridgeAuth(req, res, next) {
  const configured = getBridgeToken();
  if (!configured) {
    return res.status(503).json({ error: 'FiveM bridge token not configured' });
  }
  const header = String(req.headers['x-cad-bridge-token'] || '').trim();
  if (!header || header !== configured) {
    return res.status(401).json({ error: 'Bridge authentication failed' });
  }
  next();
}

function steamHexToSteam64(hexValue) {
  try {
    const normalized = String(hexValue || '').toLowerCase().replace(/^steam:/, '').trim();
    if (!/^[0-9a-f]+$/.test(normalized)) return '';
    return BigInt(`0x${normalized}`).toString(10);
  } catch {
    return '';
  }
}

function parseIdentifier(identifiers = [], prefix = '') {
  if (!Array.isArray(identifiers)) return '';
  const normalizedPrefix = `${String(prefix || '').toLowerCase()}:`;
  if (!normalizedPrefix || normalizedPrefix === ':') return '';
  const hit = identifiers.find(i => typeof i === 'string' && i.toLowerCase().startsWith(normalizedPrefix));
  if (!hit) return '';
  const raw = String(hit);
  return raw.slice(raw.indexOf(':') + 1).trim();
}

function parseSteamIdentifier(identifiers = []) {
  const steamRaw = parseIdentifier(identifiers, 'steam');
  if (!steamRaw) return '';
  const steam64 = steamHexToSteam64(steamRaw);
  return steam64 || String(steamRaw).toLowerCase();
}

function parseDiscordIdentifier(identifiers = []) {
  return parseIdentifier(identifiers, 'discord');
}

function parseLicenseIdentifier(identifiers = []) {
  return parseIdentifier(identifiers, 'license') || parseIdentifier(identifiers, 'license2');
}

function resolveLinkIdentifiers(identifiers = []) {
  const steamId = parseSteamIdentifier(identifiers);
  const discordId = parseDiscordIdentifier(identifiers);
  const licenseId = parseLicenseIdentifier(identifiers);

  if (steamId) {
    return {
      linkKey: steamId,
      steamId,
      discordId,
      licenseId,
      source: 'steam',
    };
  }
  if (discordId) {
    return {
      linkKey: `discord:${discordId}`,
      steamId: '',
      discordId,
      licenseId,
      source: 'discord',
    };
  }
  if (licenseId) {
    return {
      linkKey: `license:${licenseId}`,
      steamId: '',
      discordId: '',
      licenseId,
      source: 'license',
    };
  }
  return {
    linkKey: '',
    steamId: '',
    discordId: '',
    licenseId: '',
    source: '',
  };
}

function resolveCadUserFromIdentifiers(identifiers = {}) {
  if (identifiers.steamId) {
    const bySteam = Users.findBySteamId(identifiers.steamId);
    if (bySteam) return bySteam;
  }
  if (identifiers.discordId) {
    const byDiscord = Users.findByDiscordId(identifiers.discordId);
    if (byDiscord) return byDiscord;
  }
  return null;
}

function parseCadUserId(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 0;
  return parsed;
}

function resolveCadUserFromHeartbeatPayload(player = {}) {
  const candidates = [
    player?.cad_user_id,
    player?.cadUserId,
    player?.cad_id,
    player?.cadId,
  ];

  for (const candidate of candidates) {
    const userId = parseCadUserId(candidate);
    if (!userId) continue;
    const user = Users.findById(userId);
    if (user) return user;
  }
  return null;
}

function normalizeIdentityToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isAutoInGameNote(value) {
  return /^in-game\s*#\d+\b/i.test(String(value || '').trim());
}

function buildOnDutyNameIndex(units = []) {
  const index = new Map();
  for (const unit of units) {
    const key = normalizeIdentityToken(unit.user_name);
    if (!key) continue;
    const bucket = index.get(key) || [];
    bucket.push(unit);
    index.set(key, bucket);
  }
  return index;
}

function resolveCadUserByName(playerName, onDutyNameIndex) {
  const key = normalizeIdentityToken(playerName);
  if (!key) return null;
  const matches = onDutyNameIndex.get(key) || [];
  if (matches.length !== 1) return null;
  return Users.findById(matches[0].user_id) || null;
}

function getDispatchDepartmentIds() {
  return new Set(
    Departments.list()
      .filter(d => d.is_dispatch)
      .map(d => d.id)
  );
}

function offDutyIfNotDispatch(unit, source) {
  if (!unit) return false;
  const dept = Departments.findById(unit.department_id);
  if (dept && dept.is_dispatch) return false;

  Units.remove(unit.id);
  bus.emit('unit:offline', { departmentId: unit.department_id, unit });
  audit(null, 'unit_off_duty_not_detected', {
    source,
    unitId: unit.id,
    userId: unit.user_id,
    callsign: unit.callsign,
    departmentId: unit.department_id,
  });
  return true;
}

function enforceInGamePresenceForOnDutyUnits(detectedCadUserIds, source) {
  const dispatchDeptIds = getDispatchDepartmentIds();
  let removed = 0;
  for (const unit of Units.list()) {
    if (dispatchDeptIds.has(unit.department_id)) continue;
    if (detectedCadUserIds.has(unit.user_id)) continue;
    if (offDutyIfNotDispatch(unit, source)) removed += 1;
  }
  return removed;
}

function formatUnitLocation(payload) {
  const street = String(payload?.street || '').trim();
  const crossing = String(payload?.crossing || '').trim();
  const postal = String(payload?.postal || '').trim();

  const withPostal = (base) => (postal ? `${base} (${postal})` : base);
  if (street && crossing && street.toLowerCase() !== crossing.toLowerCase()) {
    return withPostal(`${street} / ${crossing}`);
  }
  if (street) return withPostal(street);
  if (crossing) return withPostal(crossing);

  const x = Number(payload?.position?.x || 0).toFixed(1);
  const y = Number(payload?.position?.y || 0).toFixed(1);
  const z = Number(payload?.position?.z || 0).toFixed(1);
  const fallback = `X:${x} Y:${y} Z:${z}`;
  return postal ? `${fallback} (${postal})` : fallback;
}

function formatCallLocation(payload) {
  const explicit = String(payload?.location || '').trim();
  if (explicit) return explicit;

  const hasStreet = !!String(payload?.street || '').trim();
  const hasCrossing = !!String(payload?.crossing || '').trim();
  const hasPostal = !!String(payload?.postal || '').trim();
  const hasPosition = payload?.position
    && (payload.position.x !== undefined || payload.position.y !== undefined || payload.position.z !== undefined);

  if (!hasStreet && !hasCrossing && !hasPostal && !hasPosition) return '';
  return formatUnitLocation(payload);
}

function normalizePriority(value) {
  const priority = String(value || '1').trim();
  return ['1', '2', '3', '4'].includes(priority) ? priority : '1';
}

function normalizeEmergencySourceType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'command';

  const commandValues = new Set([
    'command',
    'command_000',
    'slash',
    'slash_command',
    'chat_command',
    '/000',
    'ingame_command',
    'in_game_command',
  ]);
  if (commandValues.has(normalized)) return 'command';

  const phoneValues = new Set([
    'phone',
    'phone_000',
    'phone-call',
    'phone_call',
    'phonecall',
    'emergency_phone',
    'phone_emergency',
  ]);
  if (phoneValues.has(normalized)) return 'phone';

  return normalized;
}

function looksLikePhoneOrigin(payload) {
  if (!payload || typeof payload !== 'object') return false;
  if (payload.is_phone_call === true || payload.via_phone === true) return true;

  const phoneHints = [
    payload.phone_number,
    payload.caller_phone,
    payload.caller_number,
    payload.from_number,
  ];

  return phoneHints.some((value) => String(value || '').trim().length > 0);
}

function shouldCreateVoiceSession(payload, sourceType) {
  if (typeof payload?.enable_voice_session === 'boolean') {
    return payload.enable_voice_session;
  }
  if (sourceType === 'phone') return true;
  if (sourceType === 'command') return false;
  return looksLikePhoneOrigin(payload);
}

function normalizeStatus(value, allowedStatuses, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  if (allowedStatuses.has(normalized)) return normalized;
  return fallback;
}

function normalizePlateKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function describePlateStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'valid') return 'Registration valid';
  if (normalized === 'suspended') return 'Registration suspended';
  if (normalized === 'revoked') return 'Registration revoked';
  if (normalized === 'expired') return 'Registration expired';
  if (normalized === 'unregistered') return 'No registration found in CAD';
  return 'Registration status unknown';
}

const VEHICLE_BOLO_FLAG_LABELS = {
  stolen: 'Stolen',
  wanted: 'Wanted',
  armed: 'Armed',
  dangerous: 'Dangerous',
  disqualified_driver: 'Disqualified Driver',
  evade_police: 'Evade Police',
  suspended_registration: 'Suspended Registration',
  unregistered_vehicle: 'Unregistered Vehicle',
};

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const text = String(value || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeVehicleBoloFlags(value) {
  const source = Array.isArray(value) ? value : [];
  return Array.from(new Set(
    source
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean)
  ));
}

function formatVehicleBoloFlag(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (VEHICLE_BOLO_FLAG_LABELS[normalized]) return VEHICLE_BOLO_FLAG_LABELS[normalized];
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function summarizeVehicleBoloFlags(flags = []) {
  const labels = flags
    .map((flag) => formatVehicleBoloFlag(flag))
    .filter(Boolean);
  if (labels.length === 0) return 'Vehicle BOLO match';
  return `BOLO Flags: ${labels.join(', ')}`;
}

function normalizeDateOnly(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = Date.parse(text);
  if (Number.isNaN(parsed)) return '';
  return new Date(parsed).toISOString().slice(0, 10);
}

function addDaysDateOnly(daysFromNow) {
  const days = Number(daysFromNow);
  const safeDays = Number.isFinite(days) ? Math.max(1, Math.trunc(days)) : 1;
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + safeDays);
  return now.toISOString().slice(0, 10);
}

function isPastOrTodayDateOnly(value) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return false;
  const today = new Date().toISOString().slice(0, 10);
  return normalized <= today;
}


function daysUntilDateOnly(value) {
  const normalized = normalizeDateOnly(value);
  if (!normalized) return null;
  const target = Date.parse(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(target)) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((target - todayUtc) / (24 * 60 * 60 * 1000));
}

function normalizeTextList(value, { uppercase = false, maxLength = 64 } = {}) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const entry of source) {
    let text = String(entry || '').trim();
    if (!text) continue;
    if (uppercase) text = text.toUpperCase();
    if (text.length > maxLength) text = text.slice(0, maxLength);
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function getDispatchVisibleDepartments() {
  return Departments.listDispatchVisible().filter(dept => dept.is_active && !dept.is_dispatch);
}

function normalizeRequestedDepartmentIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map(item => Number(item))
      .filter(item => Number.isInteger(item) && item > 0)
  ));
}

function resolveRequestedDepartmentIds(value, fallbackDepartmentId) {
  const visibleIds = new Set(getDispatchVisibleDepartments().map(dept => Number(dept.id)));
  const normalized = normalizeRequestedDepartmentIds(value).filter(id => visibleIds.has(id));
  if (normalized.length > 0) return normalized;

  const fallbackId = Number(fallbackDepartmentId);
  if (visibleIds.has(fallbackId)) return [fallbackId];

  const firstVisibleId = Array.from(visibleIds)[0] || 0;
  return firstVisibleId ? [firstVisibleId] : [];
}

function chooseCallDepartmentId(cadUser, requestedDepartmentId) {
  if (cadUser) {
    const onDutyUnit = Units.findByUserId(cadUser.id);
    if (onDutyUnit) {
      const unitDept = Departments.findById(onDutyUnit.department_id);
      if (unitDept && unitDept.is_active && !unitDept.is_dispatch) {
        return unitDept.id;
      }
    }
  }

  const requestedId = parseInt(requestedDepartmentId, 10);
  if (requestedId) {
    const requestedDept = Departments.findById(requestedId);
    if (requestedDept && requestedDept.is_active) return requestedDept.id;
  }

  const dispatchVisible = Departments.listDispatchVisible().find(d => d.is_active && !d.is_dispatch);
  if (dispatchVisible) return dispatchVisible.id;

  const activeNonDispatch = Departments.listActive().find(d => !d.is_dispatch);
  if (activeNonDispatch) return activeNonDispatch.id;

  const activeAny = Departments.listActive()[0];
  return activeAny ? activeAny.id : null;
}

function chooseActiveLinkForUser(user) {
  if (!user) return null;
  const preferredCitizenId = String(user.preferred_citizen_id || '').trim();

  const candidates = [];
  if (String(user.steam_id || '').trim()) {
    candidates.push(FiveMPlayerLinks.findBySteamId(String(user.steam_id).trim()));
  }
  if (String(user.discord_id || '').trim()) {
    candidates.push(FiveMPlayerLinks.findBySteamId(`discord:${String(user.discord_id).trim()}`));
  }

  let selected = null;
  for (const candidate of candidates) {
    if (!candidate || !isActiveFiveMLink(candidate)) continue;
    if (preferredCitizenId && String(candidate.citizen_id || '').trim() !== preferredCitizenId) continue;
    if (!selected) {
      selected = candidate;
      continue;
    }

    const candidateScore = (String(candidate.citizen_id || '').trim() ? 2 : 0) + (String(candidate.game_id || '').trim() ? 1 : 0);
    const selectedScore = (String(selected.citizen_id || '').trim() ? 2 : 0) + (String(selected.game_id || '').trim() ? 1 : 0);
    if (candidateScore > selectedScore) selected = candidate;
  }
  return selected;
}

function findActiveLinkByCitizenId(citizenId) {
  const target = String(citizenId || '').trim().toLowerCase();
  if (!target) return null;

  for (const link of FiveMPlayerLinks.list()) {
    if (!isActiveFiveMLink(link)) continue;
    const linkedCitizenId = String(link.citizen_id || '').trim().toLowerCase();
    if (!linkedCitizenId) continue;
    if (linkedCitizenId === target) return link;
  }
  return null;
}

function normalizePostalToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function extractPostalFromLocation(location) {
  const text = String(location || '').trim();
  if (!text) return '';

  const trailingParen = text.match(/\(([^)]+)\)\s*$/);
  if (trailingParen?.[1]) return trailingParen[1].trim();

  const directPostal = text.match(/^\s*([a-zA-Z]?\d{3,6}[a-zA-Z]?)\s*$/);
  if (directPostal?.[1]) return directPostal[1].trim();

  const lastPostal = text.match(/([a-zA-Z]?\d{3,6}[a-zA-Z]?)(?!.*[a-zA-Z]?\d{3,6}[a-zA-Z]?)/);
  if (lastPostal?.[1]) return lastPostal[1].trim();
  return '';
}

function resolveCallPostal(call) {
  const explicit = String(call?.postal || '').trim();
  if (explicit) return explicit;
  return extractPostalFromLocation(call?.location || '');
}

function getRouteJobId(unitId, callId, action = 'set') {
  return `${Number(unitId || 0)}:${Number(callId || 0)}:${String(action || 'set').toLowerCase()}`;
}

function clearRouteJobsForAssignment(callId, unitId) {
  const targetCallId = Number(callId || 0);
  const targetUnitId = Number(unitId || 0);
  if (!targetCallId || !targetUnitId) return;
  for (const [key, job] of pendingRouteJobs.entries()) {
    if (Number(job.unit_id || 0) !== targetUnitId) continue;
    if (Number(job.call_id || 0) !== targetCallId) continue;
    pendingRouteJobs.delete(key);
  }
}

function resolveRouteCitizenIdForUnit(unit) {
  if (!unit) return '';
  const user = Users.findById(unit.user_id);
  if (!user) return '';
  const activeLink = chooseActiveLinkForUser(user);
  return String(activeLink?.citizen_id || user.preferred_citizen_id || '').trim();
}

function queueRouteJobForAssignment(call, unit) {
  const callId = Number(call?.id || 0);
  const unitId = Number(unit?.id || 0);
  if (!callId || !unitId) return;

  const citizenId = resolveRouteCitizenIdForUnit(unit);
  if (!citizenId) return;

  const postal = String(resolveCallPostal(call) || '').trim();
  const positionX = Number(call?.position_x);
  const positionY = Number(call?.position_y);
  const positionZ = Number(call?.position_z);
  const hasPosition = Number.isFinite(positionX) && Number.isFinite(positionY);
  if (!postal && !hasPosition) return;

  clearRouteJobsForAssignment(callId, unitId);
  const routeJobId = getRouteJobId(unitId, callId, 'set');
  pendingRouteJobs.set(routeJobId, {
    id: routeJobId,
    unit_id: unitId,
    call_id: callId,
    action: 'set',
    clear_waypoint: 0,
    call_title: String(call?.title || ''),
    citizen_id: citizenId,
    location: String(call?.location || ''),
    postal,
    position_x: hasPosition ? positionX : null,
    position_y: hasPosition ? positionY : null,
    position_z: Number.isFinite(positionZ) ? positionZ : null,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
}

function queueRouteClearJob(call, unit, fallbackUnitId = 0) {
  const unitId = Number(unit?.id || fallbackUnitId || 0);
  if (!unitId) return;

  const callId = Number(call?.id || 0);
  const citizenId = resolveRouteCitizenIdForUnit(unit);
  if (!citizenId) return;

  clearRouteJobsForAssignment(callId, unitId);
  const routeJobId = getRouteJobId(unitId, callId, 'clear');
  pendingRouteJobs.set(routeJobId, {
    id: routeJobId,
    unit_id: unitId,
    call_id: callId,
    action: 'clear',
    clear_waypoint: 1,
    call_title: String(call?.title || ''),
    citizen_id: citizenId,
    location: String(call?.location || ''),
    postal: '',
    position_x: null,
    position_y: null,
    position_z: null,
    created_at: Date.now(),
    updated_at: Date.now(),
  });
}

function clearRouteJobsForUnit(unitId) {
  const target = Number(unitId || 0);
  if (!target) return;
  for (const [key, job] of pendingRouteJobs.entries()) {
    if (Number(job.unit_id || 0) === target) {
      pendingRouteJobs.delete(key);
    }
  }
}

function clearRouteJobsForCall(callId, keepClearJobs = true) {
  const target = Number(callId || 0);
  if (!target) return;
  for (const [key, job] of pendingRouteJobs.entries()) {
    if (Number(job.call_id || 0) === target) {
      if (keepClearJobs && String(job.action || '').toLowerCase() === 'clear') continue;
      pendingRouteJobs.delete(key);
    }
  }
}

function queueVoiceEvent(eventType, options = {}) {
  const normalizedEventType = String(eventType || '').trim().toLowerCase();
  const gameId = String(options.game_id || '').trim();
  const channelNumberRaw = Number(options.channel_number || 0);
  const channelNumber = Number.isInteger(channelNumberRaw) && channelNumberRaw >= 0
    ? channelNumberRaw
    : 0;
  if (!normalizedEventType || !gameId) {
    if (normalizedEventType.includes('call')) {
      console.warn(
        `[VoiceEventQueue] Dropped ${normalizedEventType} event: missing game_id ` +
        `(channel=${channelNumber || 0}, citizen=${String(options.citizen_id || '').trim() || 'none'})`
      );
    }
    return null;
  }

  const id = nextVoiceEventId++;
  const now = Date.now();
  const entry = {
    id,
    event_type: normalizedEventType,
    game_id: gameId,
    channel_number: channelNumber,
    citizen_id: String(options.citizen_id || '').trim(),
    created_at_ms: now,
    attempts: 0,
    last_error: '',
  };
  pendingVoiceEvents.set(id, entry);
  console.log(
    `[VoiceEventQueue] Queued id=${id} type=${normalizedEventType} game=${gameId} ` +
    `channel=${channelNumber} pending=${pendingVoiceEvents.size}`
  );
  return entry;
}

function listPendingVoiceEvents(limit = 50) {
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit || 50) || 50));
  return Array.from(pendingVoiceEvents.values())
    .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
    .slice(0, normalizedLimit);
}

function markVoiceEventProcessed(id) {
  const targetId = Number(id || 0);
  const existing = pendingVoiceEvents.get(targetId);
  pendingVoiceEvents.delete(targetId);
  if (existing) {
    console.log(
      `[VoiceEventQueue] Processed id=${targetId} type=${existing.event_type} ` +
      `game=${existing.game_id} pending=${pendingVoiceEvents.size}`
    );
  }
}

function markVoiceEventFailed(id, errorText = '') {
  const targetId = Number(id || 0);
  const existing = pendingVoiceEvents.get(targetId);
  if (!existing) return;

  existing.attempts = Number(existing.attempts || 0) + 1;
  existing.last_error = String(errorText || '').trim().slice(0, 500);
  if (existing.attempts >= VOICE_EVENT_RETRY_LIMIT) {
    console.warn(
      `[VoiceEventQueue] Dropping id=${targetId} type=${existing.event_type} after ${existing.attempts} attempts. ` +
      `Last error: ${existing.last_error || 'unknown'}`
    );
    pendingVoiceEvents.delete(targetId);
    return;
  }
  console.warn(
    `[VoiceEventQueue] Retry id=${targetId} type=${existing.event_type} attempt=${existing.attempts} ` +
    `error=${existing.last_error || 'unknown'}`
  );
  pendingVoiceEvents.set(targetId, existing);
}

function shouldAutoSetUnitOnScene(unit, playerPayload, assignedCall) {
  if (!unit || String(unit.status || '').trim().toLowerCase() !== 'enroute') return false;
  if (!assignedCall || String(assignedCall.status || '').trim().toLowerCase() === 'closed') return false;

  const targetPostal = normalizePostalToken(resolveCallPostal(assignedCall));
  if (!targetPostal) return false;
  const currentPostal = normalizePostalToken(playerPayload?.postal || '');
  if (!currentPostal) return false;

  return targetPostal === currentPostal;
}

bus.on('call:assign', ({ call, unit }) => {
  try {
    queueRouteJobForAssignment(call, unit);
  } catch (err) {
    console.warn('[FiveMBridge] Could not queue route job on call assign:', err?.message || err);
  }
});

bus.on('call:unassign', ({ call, unit, unit_id, removed }) => {
  const resolvedUnit = unit || Units.findById(Number(unit_id || 0));
  const resolvedUnitId = resolvedUnit?.id || unit_id;
  clearRouteJobsForAssignment(call?.id, resolvedUnitId);
  if (!removed) return;
  if (!resolvedUnit) return;

  try {
    queueRouteClearJob(call, resolvedUnit, resolvedUnitId);
  } catch (err) {
    console.warn('[FiveMBridge] Could not queue clear route job on call unassign:', err?.message || err);
  }
});

bus.on('call:close', ({ call }) => {
  const callId = Number(call?.id || 0);
  const resolvedCall = (callId && Array.isArray(call?.assigned_units))
    ? call
    : (callId ? (Calls.findById(callId) || call) : call);
  const assignedUnits = Array.isArray(resolvedCall?.assigned_units)
    ? resolvedCall.assigned_units
    : [];

  for (const assignedUnit of assignedUnits) {
    const assignedUnitId = Number(assignedUnit?.id || 0);
    if (!assignedUnitId) continue;

    const resolvedUnit = Units.findById(assignedUnitId) || assignedUnit;
    clearRouteJobsForAssignment(callId, assignedUnitId);
    try {
      queueRouteClearJob(resolvedCall, resolvedUnit, assignedUnitId);
    } catch (err) {
      console.warn('[FiveMBridge] Could not queue clear route job on call close:', err?.message || err);
    }
  }

  clearRouteJobsForCall(callId, true);
});

bus.on('unit:offline', ({ unit }) => {
  clearRouteJobsForUnit(unit?.id);
});

bus.on('unit:status_available', ({ unit, call }) => {
  const resolvedUnit = unit || Units.findById(Number(unit?.id || 0));
  if (!resolvedUnit) return;

  clearRouteJobsForUnit(resolvedUnit.id);
  const resolvedCall = call || Calls.getAssignedCallForUnit(resolvedUnit.id) || null;
  if (!resolvedCall) return;
  try {
    queueRouteClearJob(resolvedCall, resolvedUnit, resolvedUnit.id);
  } catch (err) {
    console.warn('[FiveMBridge] Could not queue clear route job on status available:', err?.message || err);
  }
});

bus.on('voice:join', ({ channelNumber, gameId, citizenId }) => {
  queueVoiceEvent('join_radio', {
    channel_number: Number(channelNumber || 0),
    game_id: String(gameId || '').trim(),
    citizen_id: String(citizenId || '').trim(),
  });
});

bus.on('voice:leave', ({ channelNumber, gameId, citizenId }) => {
  queueVoiceEvent('leave_radio', {
    channel_number: Number(channelNumber || 0),
    game_id: String(gameId || '').trim(),
    citizen_id: String(citizenId || '').trim(),
  });
});

bus.on('voice:call_accepted', ({ callChannelNumber, callerGameId, callerCitizenId, callerPhoneNumber }) => {
  queueVoiceEvent('join_call', {
    channel_number: Number(callChannelNumber || 0),
    game_id: String(callerGameId || '').trim(),
    citizen_id: String(callerCitizenId || '').trim(),
    phone_number: String(callerPhoneNumber || '').trim(),
  });
});

bus.on('voice:call_declined', ({ callChannelNumber, callerGameId, callerCitizenId }) => {
  queueVoiceEvent('leave_call', {
    channel_number: Number(callChannelNumber || 0),
    game_id: String(callerGameId || '').trim(),
    citizen_id: String(callerCitizenId || '').trim(),
  });
});

bus.on('voice:call_ended', ({ callChannelNumber, callerGameId, callerCitizenId }) => {
  queueVoiceEvent('leave_call', {
    channel_number: Number(callChannelNumber || 0),
    game_id: String(callerGameId || '').trim(),
    citizen_id: String(callerCitizenId || '').trim(),
  });
});

// Heartbeat from FiveM resource with online players + position.
router.post('/heartbeat', requireBridgeAuth, (req, res) => {
  const players = Array.isArray(req.body?.players) ? req.body.players : [];
  const seenLinks = new Set();
  const seenLiveMapIdentifiers = new Set();
  const detectedCadUserIds = new Set();
  const onDutyNameIndex = buildOnDutyNameIndex(Units.list());
  let mappedUnits = 0;
  let unmatchedPlayers = 0;

  for (const player of players) {
    const ids = resolveLinkIdentifiers(player.identifiers);
    if (!ids.linkKey) continue;
    seenLinks.add(ids.linkKey);
    seenLiveMapIdentifiers.add(ids.linkKey);

    const position = player.position || {};
    FiveMPlayerLinks.upsert({
      steam_id: ids.linkKey,
      game_id: String(player.source ?? ''),
      citizen_id: String(player.citizenid || ''),
      player_name: String(player.name || ''),
      position_x: Number(position.x || 0),
      position_y: Number(position.y || 0),
      position_z: Number(position.z || 0),
      heading: Number(player.heading || 0),
      speed: Number(player.speed || 0),
    });

    const cadUserFromIdentifiers = resolveCadUserFromIdentifiers(ids);
    const cadUserFromPayload = resolveCadUserFromHeartbeatPayload(player);
    let cadUser = cadUserFromIdentifiers || cadUserFromPayload;
    if (cadUserFromIdentifiers && cadUserFromPayload && Number(cadUserFromIdentifiers.id) !== Number(cadUserFromPayload.id)) {
      // Prefer identifier-based mapping if heartbeat-provided CAD id conflicts.
      cadUser = cadUserFromIdentifiers;
    }
    if (!cadUser) {
      const cachedUserId = liveLinkUserCache.get(ids.linkKey);
      if (cachedUserId) {
        const cached = Users.findById(cachedUserId);
        if (cached) {
          cadUser = cached;
        }
      }
    }
    if (!cadUser) {
      const byName = resolveCadUserByName(player.name, onDutyNameIndex);
      if (byName) {
        cadUser = byName;
      }
    }

    const mappedUnit = cadUser ? Units.findByUserId(cadUser.id) : null;
    liveMapStore.upsertPlayer(ids.linkKey, {
      name: String(player.name || ''),
      pos: {
        x: Number(position.x || 0),
        y: Number(position.y || 0),
        z: Number(position.z || 0),
      },
      speed: Number(player.speed || 0),
      heading: Number(player.heading || 0),
      location: String(player.location || '') || formatUnitLocation(player),
      vehicle: String(player.vehicle || ''),
      license_plate: String(player.license_plate || ''),
      weapon: String(player.weapon || ''),
      icon: Number(player.icon || 6),
      has_siren_enabled: !!player.has_siren_enabled,
      steam_id: ids.steamId,
      discord_id: ids.discordId,
      citizenid: String(player.citizenid || ''),
      cad_user_id: Number(cadUser?.id || 0),
      unit_id: Number(mappedUnit?.id || 0),
      callsign: String(mappedUnit?.callsign || ''),
      unit_status: String(mappedUnit?.status || ''),
      department_id: Number(mappedUnit?.department_id || 0),
      cad_name: String(cadUser?.steam_name || ''),
    });

    if (!cadUser) {
      unmatchedPlayers += 1;
      continue;
    }

    if (ids.steamId) liveLinkUserCache.set(ids.steamId, cadUser.id);
    if (ids.discordId) liveLinkUserCache.set(`discord:${ids.discordId}`, cadUser.id);
    if (ids.licenseId) liveLinkUserCache.set(`license:${ids.licenseId}`, cadUser.id);
    detectedCadUserIds.add(cadUser.id);
    const unit = mappedUnit;
    if (!unit) continue;

    mappedUnits += 1;
    const updates = {
      location: formatUnitLocation(player),
    };
    // Clear legacy auto-generated in-game note text so cards only show operator notes.
    if (isAutoInGameNote(unit.note)) {
      updates.note = '';
    }
    const activeCall = Calls.getAssignedCallForUnit(unit.id);
    if (shouldAutoSetUnitOnScene(unit, player, activeCall)) {
      updates.status = 'on-scene';
    }
    Units.update(unit.id, updates);
    const updated = Units.findById(unit.id);
    bus.emit('unit:update', { departmentId: unit.department_id, unit: updated });
  }

  liveMapStore.retainOnly(seenLiveMapIdentifiers);

  const autoOffDutyCount = enforceInGamePresenceForOnDutyUnits(detectedCadUserIds, 'heartbeat');
  res.json({
    ok: true,
    tracked: seenLinks.size,
    mapped_units: mappedUnits,
    unmatched_players: unmatchedPlayers,
    auto_off_duty: autoOffDutyCount,
  });
});

// Optional player disconnect event.
router.post('/offline', requireBridgeAuth, (req, res) => {
  const ids = resolveLinkIdentifiers(req.body?.identifiers || []);
  const cachedUserId = ids.linkKey ? liveLinkUserCache.get(ids.linkKey) : null;
  let cadUser = resolveCadUserFromIdentifiers(ids);
  if (!cadUser && cachedUserId) {
    cadUser = Users.findById(cachedUserId) || null;
  }

  if (ids.steamId) FiveMPlayerLinks.removeBySteamId(ids.steamId);
  if (ids.discordId) FiveMPlayerLinks.removeBySteamId(`discord:${ids.discordId}`);
  if (ids.licenseId) FiveMPlayerLinks.removeBySteamId(`license:${ids.licenseId}`);
  if (ids.steamId) liveLinkUserCache.delete(ids.steamId);
  if (ids.discordId) liveLinkUserCache.delete(`discord:${ids.discordId}`);
  if (ids.licenseId) liveLinkUserCache.delete(`license:${ids.licenseId}`);
  if (ids.linkKey) liveLinkUserCache.delete(ids.linkKey);
  if (ids.steamId) liveMapStore.removePlayer(ids.steamId);
  if (ids.discordId) liveMapStore.removePlayer(`discord:${ids.discordId}`);
  if (ids.licenseId) liveMapStore.removePlayer(`license:${ids.licenseId}`);
  if (ids.linkKey) liveMapStore.removePlayer(ids.linkKey);

  let autoOffDuty = false;
  if (cadUser) {
    autoOffDuty = offDutyIfNotDispatch(Units.findByUserId(cadUser.id), 'offline_event');
  }
  res.json({ ok: true, auto_off_duty: autoOffDuty });
});

// List dispatch-visible non-dispatch departments for in-game /000 UI department selection.
router.get('/departments', requireBridgeAuth, (_req, res) => {
  const departments = getDispatchVisibleDepartments().map((dept) => ({
    id: Number(dept.id),
    name: String(dept.name || ''),
    short_name: String(dept.short_name || ''),
    color: String(dept.color || ''),
  }));
  res.json(departments);
});

// Create CAD calls from in-game bridge events (e.g. /000 command).
router.post('/calls', requireBridgeAuth, (req, res) => {
  const payload = req.body || {};
  const ids = resolveLinkIdentifiers(payload.identifiers || []);
  const playerName = String(payload.player_name || payload.name || '').trim() || 'Unknown Caller';
  const sourceId = String(payload.source ?? '').trim();
  const sourceType = normalizeEmergencySourceType(
    payload.source_type || payload.call_source || payload.origin || payload.entry_type
  );
  const voiceEnabledForCall = shouldCreateVoiceSession(payload, sourceType);
  const details = String(payload.message || payload.details || '').trim();

  let cadUser = resolveCadUserFromIdentifiers(ids);
  if (!cadUser && ids.linkKey) {
    const cachedUserId = liveLinkUserCache.get(ids.linkKey);
    if (cachedUserId) cadUser = Users.findById(cachedUserId) || null;
  }
  if (!cadUser) {
    const byName = resolveCadUserByName(playerName, buildOnDutyNameIndex(Units.list()));
    if (byName) cadUser = byName;
  }
  if (cadUser) {
    if (ids.steamId) liveLinkUserCache.set(ids.steamId, cadUser.id);
    if (ids.discordId) liveLinkUserCache.set(`discord:${ids.discordId}`, cadUser.id);
    if (ids.licenseId) liveLinkUserCache.set(`license:${ids.licenseId}`, cadUser.id);
  }

  const departmentId = chooseCallDepartmentId(cadUser, payload.department_id);
  if (!departmentId) {
    return res.status(400).json({ error: 'No active department available to create call' });
  }
  const requestedDepartmentIds = resolveRequestedDepartmentIds(payload.requested_department_ids, departmentId);
  const departmentsById = new Map(getDispatchVisibleDepartments().map(dept => [Number(dept.id), dept]));

  const location = formatCallLocation(payload);
  const postal = String(payload?.postal || extractPostalFromLocation(location) || '').trim();
  const positionX = Number(payload?.position?.x);
  const positionY = Number(payload?.position?.y);
  const positionZ = Number(payload?.position?.z);
  const title = String(payload.title || '').trim() || (details ? details.slice(0, 120) : `000 Call from ${playerName}`);
  const descriptionParts = [];
  descriptionParts.push(`${voiceEnabledForCall ? '000 phone call' : '000 call'} from ${playerName}${sourceId ? ` (#${sourceId})` : ''}`);
  if (requestedDepartmentIds.length > 0) {
    const requestedLabels = requestedDepartmentIds
      .map((id) => {
        const dept = departmentsById.get(Number(id));
        if (!dept) return `#${id}`;
        return dept.short_name
          ? `${dept.name} (${dept.short_name})`
          : dept.name;
      })
      .filter(Boolean);
    if (requestedLabels.length > 0) {
      descriptionParts.push(`Requested departments: ${requestedLabels.join(', ')}`);
    }
  }
  if (details) descriptionParts.push(details);
  if (ids.linkKey) descriptionParts.push(`Link: ${ids.linkKey}`);
  const description = descriptionParts.join(' | ');

  const call = Calls.create({
    department_id: departmentId,
    title,
    priority: normalizePriority(payload.priority || '1'),
    location,
    description,
    job_code: '000',
    status: 'active',
    requested_department_ids: requestedDepartmentIds,
    created_by: cadUser?.id || null,
    postal,
    position_x: Number.isFinite(positionX) ? positionX : null,
    position_y: Number.isFinite(positionY) ? positionY : null,
    position_z: Number.isFinite(positionZ) ? positionZ : null,
  });
  const callerCitizenId = String(payload?.citizenid || '').trim();
  const callerGameId = String(payload?.source ?? '').trim();
  const callerPhoneNumber = String(payload?.phone_number || '').trim();
  const callChannelNumber = 10000 + Number(call.id || 0);
  let voiceSessionCreated = false;
  if (voiceEnabledForCall && callChannelNumber > 0) {
    try {
      VoiceCallSessions.create({
        call_id: call.id,
        call_channel_number: callChannelNumber,
        caller_citizen_id: callerCitizenId,
        caller_game_id: callerGameId,
        caller_name: playerName,
        caller_phone_number: callerPhoneNumber,
      });
      voiceSessionCreated = true;
      // Put the in-game caller into the call channel immediately so the
      // Voice call session exists as soon as 000 is dialed (pending until
      // a dispatcher accepts on the CAD side).
      if (callerGameId) {
        queueVoiceEvent('join_call', {
          channel_number: callChannelNumber,
          game_id: callerGameId,
          citizen_id: callerCitizenId,
          phone_number: callerPhoneNumber,
        });
      }
    } catch (err) {
      console.warn('[FiveMBridge] Could not create voice call session:', err?.message || err);
    }
  }

  bus.emit('call:create', { departmentId, call });

  // Notify all connected CAD clients that a 000 emergency call just came in
  // so dispatchers see it immediately without having to manually refresh.
  bus.emit('voice:call_incoming', {
    callId: call.id,
    callChannelNumber,
    callerName: playerName,
    callerPhoneNumber,
    voiceSessionCreated,
    departmentId,
  });

  audit(cadUser?.id || null, 'fivem_000_call_created', {
    callId: call.id,
    departmentId,
    playerName,
    sourceId,
    sourceType,
    voiceSessionCreated,
    matchedUserId: cadUser?.id || null,
  });

  res.status(201).json({
    ok: true,
    call,
    source_type: sourceType,
    voice_session_created: voiceSessionCreated,
  });
});

// Create/update a driver license from in-game CAD bridge UI.
router.post('/licenses', requireBridgeAuth, (req, res) => {
  try {
    const payload = req.body || {};
    const ids = resolveLinkIdentifiers(payload.identifiers || []);
    const playerName = String(payload.player_name || payload.name || '').trim() || 'Unknown Player';

    let cadUser = resolveCadUserFromIdentifiers(ids);
    if (!cadUser && ids.linkKey) {
      const cachedUserId = liveLinkUserCache.get(ids.linkKey);
      if (cachedUserId) cadUser = Users.findById(cachedUserId) || null;
    }
    if (!cadUser) {
      const byName = resolveCadUserByName(playerName, buildOnDutyNameIndex(Units.list()));
      if (byName) cadUser = byName;
    }
    if (cadUser) {
      if (ids.steamId) liveLinkUserCache.set(ids.steamId, cadUser.id);
      if (ids.discordId) liveLinkUserCache.set(`discord:${ids.discordId}`, cadUser.id);
      if (ids.licenseId) liveLinkUserCache.set(`license:${ids.licenseId}`, cadUser.id);
    }

    let citizenId = String(payload.citizenid || payload.citizen_id || '').trim();
    if (!citizenId && ids.linkKey) {
      citizenId = String(FiveMPlayerLinks.findBySteamId(ids.linkKey)?.citizen_id || '').trim();
    }
    if (!citizenId) {
      return res.status(400).json({ error: 'citizenid is required to create a license' });
    }

    const fullName = String(payload.full_name || payload.character_name || payload.name || '').trim() || playerName;
    const dateOfBirth = normalizeDateOnly(payload.date_of_birth || payload.dob || payload.birthdate || '');
    const gender = String(payload.gender || '').trim();
    const classesInput = Array.isArray(payload.license_classes)
      ? payload.license_classes
      : (Array.isArray(payload.classes) ? payload.classes : []);
    const licenseClasses = normalizeTextList(classesInput, { uppercase: true, maxLength: 10 });
    if (!fullName || !dateOfBirth || !gender || licenseClasses.length === 0) {
      return res.status(400).json({
        error: 'full_name, date_of_birth, gender and at least one license class are required',
      });
    }

    const defaultExpiryDaysRaw = Number(Settings.get('driver_license_default_expiry_days') || 1095);
    const defaultExpiryDays = Number.isFinite(defaultExpiryDaysRaw) ? Math.max(1, Math.trunc(defaultExpiryDaysRaw)) : 1095;
    const expiryDaysRaw = Number(payload.expiry_days ?? payload.duration_days ?? defaultExpiryDays);
    const expiryDays = Number.isFinite(expiryDaysRaw) ? Math.max(1, Math.trunc(expiryDaysRaw)) : defaultExpiryDays;
    const expiryAt = normalizeDateOnly(payload.expiry_at || '') || addDaysDateOnly(expiryDays);
    let status = normalizeStatus(payload.status, DRIVER_LICENSE_STATUSES, 'valid');
    if (isPastOrTodayDateOnly(expiryAt)) {
      status = 'expired';
    }

    const existingLicense = DriverLicenses.findByCitizenId(citizenId);
    if (existingLicense) {
      const daysUntilExpiry = daysUntilDateOnly(existingLicense.expiry_at);
      if (daysUntilExpiry !== null && daysUntilExpiry > 3) {
        return res.status(409).json({
          error: 'Driver license renewal is only available within 3 days of expiry',
          renewal_available_in_days: daysUntilExpiry - 3,
          existing_expiry_at: existingLicense.expiry_at,
        });
      }
    }

    const providedLicenseNumber = String(payload.license_number || '').trim();
    const generatedLicenseNumber = `VIC-${citizenId.slice(-8).toUpperCase() || String(Date.now()).slice(-8)}`;
    const licenseNumber = providedLicenseNumber || generatedLicenseNumber;
    const conditions = normalizeTextList(payload.conditions, { uppercase: false, maxLength: 80 });
    const mugshotUrl = String(payload.mugshot_url || '').trim();
    if (mugshotUrl.length > BRIDGE_MUGSHOT_MAX_CHARS) {
      return res.status(413).json({
        error: `mugshot_url is too large (max ${BRIDGE_MUGSHOT_MAX_CHARS} characters)`,
      });
    }

    const record = DriverLicenses.upsertByCitizenId({
      citizen_id: citizenId,
      full_name: fullName,
      date_of_birth: dateOfBirth,
      gender,
      license_number: licenseNumber,
      license_classes: licenseClasses,
      conditions,
      mugshot_url: mugshotUrl,
      status,
      expiry_at: expiryAt,
      created_by_user_id: cadUser?.id || null,
      updated_by_user_id: cadUser?.id || null,
    });

    audit(cadUser?.id || null, 'fivem_driver_license_upserted', {
      citizen_id: citizenId,
      status: record?.status || status,
      expiry_at: record?.expiry_at || expiryAt,
      classes: licenseClasses,
      source: 'fivem',
    });

    res.status(201).json({ ok: true, license: record });
  } catch (error) {
    console.error('[FiveMBridge] Failed to upsert driver license:', error);
    res.status(500).json({ error: 'Failed to create driver license record' });
  }
});

// Read a driver's current license record for in-game /showid display.
router.get('/licenses/:citizenid', requireBridgeAuth, (req, res) => {
  try {
    DriverLicenses.markExpiredDue();

    const citizenId = String(req.params.citizenid || '').trim();
    if (!citizenId) {
      return res.status(400).json({ error: 'citizenid is required' });
    }

    const record = DriverLicenses.findByCitizenId(citizenId);
    if (!record) {
      return res.status(404).json({ error: 'License not found' });
    }

    return res.json({ ok: true, license: record });
  } catch (error) {
    console.error('[FiveMBridge] Failed to read driver license:', error);
    return res.status(500).json({ error: 'Failed to read driver license record' });
  }
});

// Create/update a vehicle registration from in-game CAD bridge UI.
router.post('/registrations', requireBridgeAuth, (req, res) => {
  try {
    const payload = req.body || {};
    const ids = resolveLinkIdentifiers(payload.identifiers || []);
    const playerName = String(payload.player_name || payload.name || '').trim() || 'Unknown Player';

    let cadUser = resolveCadUserFromIdentifiers(ids);
    if (!cadUser && ids.linkKey) {
      const cachedUserId = liveLinkUserCache.get(ids.linkKey);
      if (cachedUserId) cadUser = Users.findById(cachedUserId) || null;
    }
    if (!cadUser) {
      const byName = resolveCadUserByName(playerName, buildOnDutyNameIndex(Units.list()));
      if (byName) cadUser = byName;
    }
    if (cadUser) {
      if (ids.steamId) liveLinkUserCache.set(ids.steamId, cadUser.id);
      if (ids.discordId) liveLinkUserCache.set(`discord:${ids.discordId}`, cadUser.id);
      if (ids.licenseId) liveLinkUserCache.set(`license:${ids.licenseId}`, cadUser.id);
    }

    let citizenId = String(payload.citizenid || payload.citizen_id || '').trim();
    if (!citizenId && ids.linkKey) {
      citizenId = String(FiveMPlayerLinks.findBySteamId(ids.linkKey)?.citizen_id || '').trim();
    }

    const plate = String(payload.plate || payload.license_plate || '').trim();
    if (!plate) {
      return res.status(400).json({ error: 'plate is required to create registration' });
    }

    const ownerName = String(payload.owner_name || payload.character_name || payload.full_name || playerName).trim();
    const vehicleModel = String(payload.vehicle_model || payload.model || '').trim();
    const vehicleColour = String(payload.vehicle_colour || payload.colour || payload.color || '').trim();
    if (!vehicleModel) {
      return res.status(400).json({ error: 'vehicle_model is required' });
    }

    const defaultDurationRaw = Number(Settings.get('vehicle_registration_default_days') || 365);
    const defaultDuration = Number.isFinite(defaultDurationRaw) ? Math.max(1, Math.trunc(defaultDurationRaw)) : 365;
    const durationRaw = Number(payload.duration_days ?? payload.expiry_days ?? defaultDuration);
    const durationDays = Number.isFinite(durationRaw) ? Math.max(1, Math.trunc(durationRaw)) : defaultDuration;
    const expiryAt = normalizeDateOnly(payload.expiry_at || '') || addDaysDateOnly(durationDays);
    let status = normalizeStatus(payload.status, VEHICLE_REGISTRATION_STATUSES, 'valid');
    if (isPastOrTodayDateOnly(expiryAt)) {
      status = 'expired';
    }

    const record = VehicleRegistrations.upsertByPlate({
      plate,
      citizen_id: citizenId,
      owner_name: ownerName,
      vehicle_model: vehicleModel,
      vehicle_colour: vehicleColour,
      status,
      expiry_at: expiryAt,
      duration_days: durationDays,
      created_by_user_id: cadUser?.id || null,
      updated_by_user_id: cadUser?.id || null,
    });

    audit(cadUser?.id || null, 'fivem_vehicle_registration_upserted', {
      plate: record?.plate || plate,
      citizen_id: citizenId,
      status: record?.status || status,
      expiry_at: record?.expiry_at || expiryAt,
      source: 'fivem',
    });

    res.status(201).json({ ok: true, registration: record });
  } catch (error) {
    console.error('[FiveMBridge] Failed to upsert vehicle registration:', error);
    res.status(500).json({ error: 'Failed to create vehicle registration record' });
  }
});

// Plate status lookup used by Wraith plate-reader integrations.
router.get('/plate-status/:plate', requireBridgeAuth, (req, res) => {
  try {
    VehicleRegistrations.markExpiredDue();

    const rawPlate = String(req.params.plate || '').trim();
    if (!rawPlate) {
      return res.status(400).json({ error: 'plate is required' });
    }
    const normalizedPlate = normalizePlateKey(rawPlate);
    const boloMatches = Bolos.listActiveVehicleByPlate(normalizedPlate).map((bolo) => {
      const details = parseJsonObject(bolo.details_json);
      const flags = normalizeVehicleBoloFlags(details.flags);
      return {
        id: Number(bolo.id || 0),
        department_id: Number(bolo.department_id || 0),
        title: String(bolo.title || '').trim(),
        description: String(bolo.description || '').trim(),
        plate: String(details.plate || details.registration_plate || details.rego || '').trim().toUpperCase(),
        flags,
      };
    });
    const boloFlags = Array.from(new Set(
      boloMatches
        .flatMap((bolo) => Array.isArray(bolo.flags) ? bolo.flags : [])
        .map((flag) => String(flag || '').trim().toLowerCase())
        .filter(Boolean)
    ));
    const boloAlert = boloMatches.length > 0;
    const boloMessage = boloAlert ? summarizeVehicleBoloFlags(boloFlags) : '';

    const registration = VehicleRegistrations.findByPlate(rawPlate);
    if (!registration) {
      const messageParts = [describePlateStatus('unregistered')];
      if (boloMessage) messageParts.push(boloMessage);
      return res.json({
        ok: true,
        found: false,
        plate: rawPlate.toUpperCase(),
        plate_normalized: normalizedPlate,
        registration_status: 'unregistered',
        registration_alert: true,
        bolo_alert: boloAlert,
        bolo_flags: boloFlags,
        bolo_count: boloMatches.length,
        bolo_matches: boloMatches,
        alert: true,
        message: messageParts.join(' | '),
      });
    }

    let status = normalizeStatus(registration.status, VEHICLE_REGISTRATION_STATUSES, 'valid');
    if (status === 'valid' && isPastOrTodayDateOnly(registration.expiry_at)) {
      status = 'expired';
    }
    const registrationAlert = status !== 'valid';
    const alert = registrationAlert || boloAlert;
    const messageParts = [];
    if (registrationAlert) {
      messageParts.push(describePlateStatus(status));
    } else if (!boloAlert) {
      messageParts.push(describePlateStatus(status));
    }
    if (boloMessage) messageParts.push(boloMessage);

    return res.json({
      ok: true,
      found: true,
      plate: String(registration.plate || rawPlate).toUpperCase(),
      plate_normalized: String(registration.plate_normalized || normalizePlateKey(rawPlate)),
      registration_status: status,
      registration_alert: registrationAlert,
      bolo_alert: boloAlert,
      bolo_flags: boloFlags,
      bolo_count: boloMatches.length,
      bolo_matches: boloMatches,
      alert,
      message: messageParts.join(' | '),
      expiry_at: String(registration.expiry_at || ''),
      owner_name: String(registration.owner_name || ''),
      citizen_id: String(registration.citizen_id || ''),
      vehicle_model: String(registration.vehicle_model || ''),
      vehicle_colour: String(registration.vehicle_colour || ''),
    });
  } catch (error) {
    console.error('[FiveMBridge] Plate status lookup failed:', error);
    return res.status(500).json({ error: 'Failed to lookup plate status' });
  }
});

// FiveM resource polls pending route jobs to set in-game waypoints for assigned calls.
router.get('/route-jobs', requireBridgeAuth, (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const jobs = [];
  for (const job of pendingRouteJobs.values()) {
    if (jobs.length >= limit) break;
    const activeLink = findActiveLinkByCitizenId(job.citizen_id);
    if (!activeLink) continue;
    jobs.push({
      ...job,
      game_id: String(activeLink.game_id || ''),
      steam_id: String(activeLink.steam_id || ''),
      player_name: String(activeLink.player_name || ''),
    });
  }
  res.json(jobs);
});

router.post('/route-jobs/:id/sent', requireBridgeAuth, (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Invalid route job id' });
  pendingRouteJobs.delete(id);
  res.json({ ok: true });
});

router.post('/route-jobs/:id/failed', requireBridgeAuth, (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'Invalid route job id' });
  const error = String(req.body?.error || 'Route delivery failed');
  pendingRouteJobs.delete(id);
  console.warn('[FiveMBridge] Route job failed:', id, error);
  res.json({ ok: true });
});

// FiveM resource polls pending voice jobs and applies them in-game.
router.get('/voice-events', requireBridgeAuth, (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const events = listPendingVoiceEvents(limit);
  if (events.length > 0) {
    console.log(
      `[VoiceEventQueue] Delivering ${events.length} event(s) to bridge poller ` +
      `(pending=${pendingVoiceEvents.size})`
    );
  }
  res.json(events);
});

router.post('/voice-events/:id/processed', requireBridgeAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid voice event id' });
  markVoiceEventProcessed(id);
  res.json({ ok: true });
});

router.post('/voice-events/:id/failed', requireBridgeAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid voice event id' });
  const error = String(req.body?.error || 'Voice delivery failed');
  markVoiceEventFailed(id, error);
  res.json({ ok: true });
});

// FiveM resource polls pending fine jobs and applies them through QBox-side logic.
router.get('/fine-jobs', requireBridgeAuth, (req, res) => {
  if (getFineDeliveryMode() === 'direct_db') {
    return res.json([]);
  }
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const account = getFineAccountKey();
  const jobs = FiveMFineJobs.listPending(limit).map((job) => {
    const activeLink = findActiveLinkByCitizenId(job.citizen_id);
    return {
      ...job,
      account,
      game_id: activeLink ? String(activeLink.game_id || '') : '',
      steam_id: activeLink ? String(activeLink.steam_id || '') : '',
      player_name: activeLink ? String(activeLink.player_name || '') : '',
    };
  });
  res.json(jobs);
});

router.post('/fine-jobs/:id/sent', requireBridgeAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid job id' });
  FiveMFineJobs.markSent(id);
  res.json({ ok: true });
});

router.post('/fine-jobs/:id/failed', requireBridgeAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid job id' });
  const error = String(req.body?.error || 'Unknown fine processing error');
  FiveMFineJobs.markFailed(id, error);
  res.json({ ok: true });
});

// FiveM resource polls pending jail jobs and applies them through configured jail resource adapters.
router.get('/jail-jobs', requireBridgeAuth, (req, res) => {
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const jobs = FiveMJailJobs.listPending(limit).map((job) => {
    const activeLink = findActiveLinkByCitizenId(job.citizen_id);
    return {
      ...job,
      game_id: activeLink ? String(activeLink.game_id || '') : '',
      steam_id: activeLink ? String(activeLink.steam_id || '') : '',
      player_name: activeLink ? String(activeLink.player_name || '') : '',
    };
  });
  res.json(jobs);
});

router.post('/jail-jobs/:id/sent', requireBridgeAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid job id' });
  FiveMJailJobs.markSent(id);
  res.json({ ok: true });
});

router.post('/jail-jobs/:id/failed', requireBridgeAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid job id' });
  const error = String(req.body?.error || 'Unknown jail processing error');
  FiveMJailJobs.markFailed(id, error);
  res.json({ ok: true });
});

// CAD -> QBX job sync is temporarily disabled. Keep endpoint for compatibility.
router.get('/job-jobs', requireBridgeAuth, (req, res) => {
  res.json([]);
});

router.post('/job-jobs/:id/sent', requireBridgeAuth, (req, res) => {
  res.json({ ok: true, disabled: true });
});

router.post('/job-jobs/:id/failed', requireBridgeAuth, (req, res) => {
  res.json({ ok: true, disabled: true });
});

// Sync Mumble server configuration from FiveM
// Expected payload: { mumble_host: "127.0.0.1", mumble_port: 64738, voice_system: "custom", detected: true }
router.post('/mumble-config/sync', requireBridgeAuth, (req, res) => {
  try {
    const host = String(req.body?.mumble_host || '').trim();
    const port = parseInt(req.body?.mumble_port || 0, 10);
    const voiceSystem = String(req.body?.voice_system || 'unknown').trim();
    const detected = !!req.body?.detected;

    if (!host || !port || port <= 0) {
      return res.status(400).json({ error: 'Invalid mumble_host or mumble_port' });
    }

    // Update settings in database
    Settings.set('mumble_host', host);
    Settings.set('mumble_port', port.toString());
    Settings.set('mumble_voice_system', voiceSystem);
    Settings.set('mumble_auto_detected', detected ? '1' : '0');

    console.log(`[MumbleConfigSync] Updated Mumble config: ${host}:${port} (${voiceSystem}, auto-detected: ${detected})`);

    res.json({
      ok: true,
      host,
      port,
      voice_system: voiceSystem,
      detected,
    });
  } catch (error) {
    console.error('[MumbleConfigSync] Error syncing Mumble config:', error);
    res.status(500).json({ error: 'Failed to sync Mumble configuration' });
  }
});

// Sync radio channel names from FiveM cad_bridge config.
// Expected payload: { channels: [{ id: 1, name: "Police Primary", description: "..." }, ...] }
router.post('/radio-channels/sync', requireBridgeAuth, (req, res) => {
  try {
    const channels = req.body?.channels || [];

    if (!Array.isArray(channels)) {
      return res.status(400).json({ error: 'channels must be an array' });
    }

    let updated = 0;
    let created = 0;

    for (const channelData of channels) {
      const channelNumber = parseInt(channelData?.id || channelData?.channel || 0, 10);
      const name = String(channelData?.name || '').trim();
      const description = String(channelData?.description || channelData?.label || '').trim();

      if (!channelNumber || channelNumber <= 0 || !name) {
        continue; // Skip invalid entries
      }

      // Check if channel exists
      const existing = VoiceChannels.findByChannelNumber(channelNumber);

      if (existing) {
        // Update existing channel
        VoiceChannels.update(existing.id, {
          name,
          description: description || `Radio channel ${channelNumber}`,
        });
        updated++;
      } else {
        // Create new channel (no department assigned, available to all)
        VoiceChannels.create({
          channel_number: channelNumber,
          department_id: null,
          name,
          description: description || `Radio channel ${channelNumber}`,
        });
        created++;
      }
    }

    console.log(`[RadioChannelSync] Synced ${channels.length} channels: ${created} created, ${updated} updated`);

    res.json({
      ok: true,
      synced: channels.length,
      created,
      updated,
    });
  } catch (error) {
    console.error('[RadioChannelSync] Error syncing channels:', error);
    res.status(500).json({ error: 'Failed to sync radio channels' });
  }
});

// ============================================================================
// Voice Participant Heartbeat — FiveM → CAD
// FiveM resource polls in-game voice state for every online player and POSTs
// batched updates here so the CAD channel participant list stays current
// without requiring a resource restart.
//
// Expected payload:
//   { participants: [{ game_id, citizen_id, channel_number, channel_type }] }
//
// channel_type is "radio" or "call".
// channel_number 0 (or missing) means the player left that channel.
// ============================================================================
router.post('/voice-participants/heartbeat', requireBridgeAuth, (req, res) => {
  try {
    const incoming = req.body?.participants;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: 'participants must be an array' });
    }

    // Build a map of channel_number → VoiceChannel row (cached for this request).
    // Auto-creates the channel if it doesn't exist yet (e.g. local config channels
    // reported by the heartbeat before the radio-channels sync has run).
    const channelCache = new Map();
    function getOrCreateChannel(channelNumber) {
      if (channelCache.has(channelNumber)) return channelCache.get(channelNumber);
      let ch = VoiceChannels.findByChannelNumber(channelNumber);
      if (!ch) {
        // Channel not yet synced — create it automatically so participants can be tracked
        try {
          ch = VoiceChannels.create({
            channel_number: channelNumber,
            department_id: null,
            name: `Channel ${channelNumber}`,
            description: `Radio channel ${channelNumber} (auto-created by heartbeat)`,
          });
          console.log(`[VoiceHeartbeat] Auto-created voice channel ${channelNumber}`);
        } catch (createErr) {
          // Race condition — another request may have created it simultaneously
          ch = VoiceChannels.findByChannelNumber(channelNumber) || null;
        }
      } else if (!ch.is_active) {
        // Channel exists but was deactivated — reactivate it since in-game players are using it
        VoiceChannels.update(ch.id, { is_active: 1 });
        ch = VoiceChannels.findByChannelNumber(channelNumber);
      }
      channelCache.set(channelNumber, ch || null);
      return ch || null;
    }

    const changedChannels = new Set();
    const incomingGameIds = new Set();

    // Heartbeat payload is authoritative for current in-game players.
    // Remove any existing game participant rows not present in this batch.
    for (const entry of incoming) {
      const gameId = String(entry?.game_id || '').trim();
      if (gameId) incomingGameIds.add(gameId);
    }

    const existingGameParticipants = VoiceParticipants.listAllGameParticipants();
    for (const existing of existingGameParticipants) {
      const existingGameId = String(existing?.game_id || '').trim();
      if (!existingGameId || incomingGameIds.has(existingGameId)) continue;

      VoiceParticipants.removeByGameId(existingGameId);
      bus.emit('voice:leave', {
        channelId: Number(existing?.channel_id || 0) || null,
        channelNumber: Number(existing?.channel_number || 0) || 0,
        userId: null,
        gameId: existingGameId,
        citizenId: String(existing?.citizen_id || ''),
      });

      const oldChannelNum = Number(existing?.channel_number || 0) || 0;
      if (oldChannelNum > 0) changedChannels.add(oldChannelNum);
    }

    for (const entry of incoming) {
      const gameId      = String(entry.game_id    || '').trim();
      const citizenId   = String(entry.citizen_id || '').trim();
      const channelNum  = parseInt(entry.channel_number, 10) || 0;
      const channelType = String(entry.channel_type || 'radio').trim(); // 'radio' | 'call'

      if (!gameId) continue; // Must have a game_id to identify the player

      const channel = channelNum > 0 ? getOrCreateChannel(channelNum) : null;

      // Find existing participant row for this player (by game_id)
      const existing = VoiceParticipants.findByGameId(gameId);

      if (channel && channelNum > 0) {
        // Player is in a channel — upsert participant
        if (!existing || existing.channel_id !== channel.id) {
          // Remove from old channel first
          if (existing) {
            const oldChannel = getOrCreateChannel(existing.channel_number);
            VoiceParticipants.removeByGameId(gameId);
            bus.emit('voice:leave', {
              channelId: existing.channel_id,
              channelNumber: existing.channel_number,
              userId: null,
              gameId,
              citizenId,
            });
            if (oldChannel) changedChannels.add(oldChannel.channel_number);
          }
          // Add to new channel
          const participant = VoiceParticipants.add({
            channel_id: channel.id,
            user_id: null,
            unit_id: null,
            citizen_id: citizenId,
            game_id: gameId,
          });
          bus.emit('voice:join', {
            channelId: channel.id,
            channelNumber: channel.channel_number,
            userId: null,
            gameId,
            citizenId,
            participant,
          });
          changedChannels.add(channel.channel_number);
        } else {
          // Already in the right channel — just touch the last_activity_at
          VoiceParticipants.touch(existing.id);
        }
      } else {
        // Player is not in any channel (channel_number == 0 means left)
        if (existing) {
          VoiceParticipants.removeByGameId(gameId);
          bus.emit('voice:leave', {
            channelId: existing.channel_id,
            channelNumber: existing.channel_number,
            userId: null,
            gameId,
            citizenId,
          });
          changedChannels.add(existing.channel_number);
        }
      }
    }

    // Sync routing for all changed channels
    for (const channelNum of changedChannels) {
      if (channelNum > 0) {
        handleParticipantJoin(channelNum); // triggers a full route sync
      }
    }

    const now = Date.now();
    if (changedChannels.size > 0 || (now - lastVoiceHeartbeatLogAt) >= VOICE_HEARTBEAT_LOG_INTERVAL_MS) {
      const changedList = Array.from(changedChannels.values())
        .map(value => Number(value || 0))
        .filter(value => value > 0)
        .sort((a, b) => a - b);
      lastVoiceHeartbeatLogAt = now;
      console.log(
        `[VoiceHeartbeat] processed=${incoming.length} incomingGameIds=${incomingGameIds.size} ` +
        `changedChannels=${changedList.length ? changedList.join(',') : 'none'} ` +
        `trackedParticipants=${VoiceParticipants.listAllGameParticipants().length}`
      );
    }

    res.json({ ok: true, processed: incoming.length });
  } catch (error) {
    console.error('[VoiceHeartbeat] Error processing participant heartbeat:', error);
    res.status(500).json({ error: 'Failed to process participant heartbeat' });
  }
});

module.exports = router;
