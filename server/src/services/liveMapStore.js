const ACTIVE_PLAYER_MAX_AGE_MS = 30 * 1000;

const playersByIdentifier = new Map();

function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeBoolean(value) {
  if (value === true || value === 1) return true;
  const text = normalizeString(value).toLowerCase();
  return ['true', '1', 'yes', 'y', 'on'].includes(text);
}

function upsertPlayer(identifier, payload = {}) {
  const key = normalizeString(identifier);
  if (!key) return;

  const pos = payload.pos || payload.position || {};
  playersByIdentifier.set(key, {
    identifier: key,
    name: normalizeString(payload.name) || 'Unknown',
    pos: {
      x: normalizeNumber(pos.x, 0),
      y: normalizeNumber(pos.y, 0),
      z: normalizeNumber(pos.z, 0),
    },
    speed: normalizeNumber(payload.speed, 0),
    heading: normalizeNumber(payload.heading, 0),
    location: normalizeString(payload.location),
    vehicle: normalizeString(payload.vehicle),
    licensePlate: normalizeString(payload.licensePlate || payload.license_plate),
    weapon: normalizeString(payload.weapon),
    icon: normalizeNumber(payload.icon, 6),
    hasSirenEnabled: normalizeBoolean(payload.hasSirenEnabled || payload.has_siren_enabled),
    steamId: normalizeString(payload.steamId || payload.steam_id),
    discordId: normalizeString(payload.discordId || payload.discord_id),
    citizenid: normalizeString(payload.citizenid),
    cadUserId: Math.max(0, Math.trunc(normalizeNumber(payload.cadUserId || payload.cad_user_id, 0))),
    unitId: Math.max(0, Math.trunc(normalizeNumber(payload.unitId || payload.unit_id, 0))),
    callsign: normalizeString(payload.callsign),
    unitStatus: normalizeString(payload.unitStatus || payload.unit_status),
    departmentId: Math.max(0, Math.trunc(normalizeNumber(payload.departmentId || payload.department_id, 0))),
    cadName: normalizeString(payload.cadName || payload.cad_name),
    updatedAtMs: Date.now(),
  });
}

function removePlayer(identifier) {
  const key = normalizeString(identifier);
  if (!key) return;
  playersByIdentifier.delete(key);
}

function retainOnly(allowedIdentifiers) {
  if (!(allowedIdentifiers instanceof Set)) return;
  for (const key of playersByIdentifier.keys()) {
    if (!allowedIdentifiers.has(key)) {
      playersByIdentifier.delete(key);
    }
  }
}

function listPlayers(maxAgeMs = ACTIVE_PLAYER_MAX_AGE_MS) {
  const now = Date.now();
  const maxAge = Math.max(1_000, normalizeNumber(maxAgeMs, ACTIVE_PLAYER_MAX_AGE_MS));
  const results = [];
  for (const player of playersByIdentifier.values()) {
    if ((now - normalizeNumber(player.updatedAtMs, 0)) > maxAge) continue;
    results.push(player);
  }
  return results;
}

function clearAll() {
  playersByIdentifier.clear();
}

module.exports = {
  ACTIVE_PLAYER_MAX_AGE_MS,
  upsertPlayer,
  removePlayer,
  retainOnly,
  listPlayers,
  clearAll,
};
