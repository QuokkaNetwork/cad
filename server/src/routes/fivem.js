const express = require('express');
const {
  Settings,
  Users,
  Units,
  Departments,
  FiveMPlayerLinks,
  FiveMFineJobs,
} = require('../db/sqlite');
const bus = require('../utils/eventBus');
const { audit } = require('../utils/audit');

const router = express.Router();

function getBridgeToken() {
  return String(Settings.get('fivem_bridge_shared_token') || process.env.FIVEM_BRIDGE_SHARED_TOKEN || '').trim();
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

function resolveLinkIdentifiers(identifiers = []) {
  const steamId = parseSteamIdentifier(identifiers);
  const discordId = parseDiscordIdentifier(identifiers);

  if (steamId) {
    return {
      linkKey: steamId,
      steamId,
      discordId,
      source: 'steam',
    };
  }
  if (discordId) {
    return {
      linkKey: `discord:${discordId}`,
      steamId: '',
      discordId,
      source: 'discord',
    };
  }
  return {
    linkKey: '',
    steamId: '',
    discordId: '',
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

// Heartbeat from FiveM resource with online players + position.
router.post('/heartbeat', requireBridgeAuth, (req, res) => {
  const players = Array.isArray(req.body?.players) ? req.body.players : [];
  const seenLinks = new Set();
  const detectedCadUserIds = new Set();

  for (const player of players) {
    const ids = resolveLinkIdentifiers(player.identifiers);
    if (!ids.linkKey) continue;
    seenLinks.add(ids.linkKey);

    const position = player.position || {};
    const link = FiveMPlayerLinks.upsert({
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

    const cadUser = resolveCadUserFromIdentifiers(ids);
    if (!cadUser) continue;
    detectedCadUserIds.add(cadUser.id);
    const unit = Units.findByUserId(cadUser.id);
    if (!unit) continue;

    const idSource = ids.source === 'discord' ? 'discord' : 'steam';
    Units.update(unit.id, {
      location: formatUnitLocation(player),
      note: `In-game #${link.game_id} ${link.player_name || ''} (${idSource})`.trim(),
    });
    const updated = Units.findById(unit.id);
    bus.emit('unit:update', { departmentId: unit.department_id, unit: updated });
  }

  const autoOffDutyCount = enforceInGamePresenceForOnDutyUnits(detectedCadUserIds, 'heartbeat');
  res.json({ ok: true, tracked: seenLinks.size, auto_off_duty: autoOffDutyCount });
});

// Optional player disconnect event.
router.post('/offline', requireBridgeAuth, (req, res) => {
  const ids = resolveLinkIdentifiers(req.body?.identifiers || []);
  if (ids.steamId) FiveMPlayerLinks.removeBySteamId(ids.steamId);
  if (ids.discordId) FiveMPlayerLinks.removeBySteamId(`discord:${ids.discordId}`);

  let autoOffDuty = false;
  const cadUser = resolveCadUserFromIdentifiers(ids);
  if (cadUser) {
    autoOffDuty = offDutyIfNotDispatch(Units.findByUserId(cadUser.id), 'offline_event');
  }
  res.json({ ok: true, auto_off_duty: autoOffDuty });
});

// FiveM resource polls pending fine jobs and applies them through QBox-side logic.
router.get('/fine-jobs', requireBridgeAuth, (req, res) => {
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
