const express = require('express');
const {
  Settings,
  Users,
  Units,
  Calls,
  Departments,
  FiveMPlayerLinks,
  FiveMFineJobs,
} = require('../db/sqlite');
const bus = require('../utils/eventBus');
const { audit } = require('../utils/audit');

const router = express.Router();
const liveLinkUserCache = new Map();

function getBridgeToken() {
  return String(Settings.get('fivem_bridge_shared_token') || process.env.FIVEM_BRIDGE_SHARED_TOKEN || '').trim();
}

function getFineDeliveryMode() {
  return String(Settings.get('fivem_bridge_qbox_fines_delivery_mode') || 'direct_db')
    .trim()
    .toLowerCase();
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

// Heartbeat from FiveM resource with online players + position.
router.post('/heartbeat', requireBridgeAuth, (req, res) => {
  const players = Array.isArray(req.body?.players) ? req.body.players : [];
  const seenLinks = new Set();
  const detectedCadUserIds = new Set();
  const onDutyNameIndex = buildOnDutyNameIndex(Units.list());
  let mappedUnits = 0;
  let unmatchedPlayers = 0;

  for (const player of players) {
    const ids = resolveLinkIdentifiers(player.identifiers);
    if (!ids.linkKey) continue;
    seenLinks.add(ids.linkKey);

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

    let cadUser = resolveCadUserFromIdentifiers(ids);
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
    if (!cadUser) {
      unmatchedPlayers += 1;
      continue;
    }

    if (ids.steamId) liveLinkUserCache.set(ids.steamId, cadUser.id);
    if (ids.discordId) liveLinkUserCache.set(`discord:${ids.discordId}`, cadUser.id);
    if (ids.licenseId) liveLinkUserCache.set(`license:${ids.licenseId}`, cadUser.id);
    detectedCadUserIds.add(cadUser.id);
    const unit = Units.findByUserId(cadUser.id);
    if (!unit) continue;

    mappedUnits += 1;
    const updates = {
      location: formatUnitLocation(player),
    };
    // Clear legacy auto-generated in-game note text so cards only show operator notes.
    if (isAutoInGameNote(unit.note)) {
      updates.note = '';
    }
    Units.update(unit.id, updates);
    const updated = Units.findById(unit.id);
    bus.emit('unit:update', { departmentId: unit.department_id, unit: updated });
  }

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

  let autoOffDuty = false;
  if (cadUser) {
    autoOffDuty = offDutyIfNotDispatch(Units.findByUserId(cadUser.id), 'offline_event');
  }
  res.json({ ok: true, auto_off_duty: autoOffDuty });
});

// Create CAD calls from in-game bridge events (e.g. /000 command).
router.post('/calls', requireBridgeAuth, (req, res) => {
  const payload = req.body || {};
  const ids = resolveLinkIdentifiers(payload.identifiers || []);
  const playerName = String(payload.player_name || payload.name || '').trim() || 'Unknown Caller';
  const sourceId = String(payload.source ?? '').trim();
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

  const location = formatCallLocation(payload);
  const title = String(payload.title || '').trim() || (details ? details.slice(0, 120) : `000 Call from ${playerName}`);
  const descriptionParts = [];
  descriptionParts.push(`000 call from ${playerName}${sourceId ? ` (#${sourceId})` : ''}`);
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
    created_by: cadUser?.id || null,
  });

  bus.emit('call:create', { departmentId, call });
  audit(cadUser?.id || null, 'fivem_000_call_created', {
    callId: call.id,
    departmentId,
    playerName,
    sourceId,
    matchedUserId: cadUser?.id || null,
  });

  res.status(201).json({ ok: true, call });
});

// FiveM resource polls pending fine jobs and applies them through QBox-side logic.
router.get('/fine-jobs', requireBridgeAuth, (req, res) => {
  if (getFineDeliveryMode() === 'direct_db') {
    return res.json([]);
  }
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const jobs = FiveMFineJobs.listPending(limit);
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

module.exports = router;
