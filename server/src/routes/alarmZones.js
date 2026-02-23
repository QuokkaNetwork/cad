const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Settings } = require('../db/sqlite');

const router = express.Router();

const SETTINGS_KEY = 'fivem_bridge_auto_alarm_zones_json';

router.use(requireAuth);

function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toPositiveInt(value, fallback = null) {
  const n = Math.trunc(Number(value));
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function normalizeShape(value) {
  return String(value || '').trim().toLowerCase() === 'polygon' ? 'polygon' : 'circle';
}

function sanitizePoint(value) {
  if (!value || typeof value !== 'object') return null;
  const x = toFiniteNumber(value.x, null);
  const y = toFiniteNumber(value.y, null);
  const z = toFiniteNumber(value.z, 0);
  if (x === null || y === null) return null;
  return { x, y, z: z === null ? 0 : z };
}

function sanitizeZone(value) {
  if (!value || typeof value !== 'object') return null;
  const shape = normalizeShape(value.shape || value.type);
  const zone = {
    id: String(value.id || '').trim(),
    label: String(value.label || '').trim(),
    location: String(value.location || '').trim(),
    shape,
    postal: String(value.postal || '').trim(),
    priority: String(value.priority || '').trim(),
    job_code: String(value.job_code || '').trim(),
    department_id: toPositiveInt(value.department_id, null),
    backup_department_id: toPositiveInt(value.backup_department_id, null),
    min_z: toFiniteNumber(value.min_z, null),
    max_z: toFiniteNumber(value.max_z, null),
  };

  if (shape === 'polygon') {
    const points = Array.isArray(value.points) ? value.points.map(sanitizePoint).filter(Boolean) : [];
    zone.points = points;
    zone.x = toFiniteNumber(value.x, null);
    zone.y = toFiniteNumber(value.y, null);
    zone.z = toFiniteNumber(value.z, null);
  } else {
    zone.x = toFiniteNumber(value.x, null);
    zone.y = toFiniteNumber(value.y, null);
    zone.z = toFiniteNumber(value.z, 0);
    zone.radius = toFiniteNumber(value.radius, null);
  }

  return zone;
}

function readStoredAlarmZones() {
  const raw = Settings.get(SETTINGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeZone).filter(Boolean);
  } catch {
    return [];
  }
}

router.get('/', (req, res) => {
  let zones = readStoredAlarmZones();
  const departmentId = toPositiveInt(req.query.department_id, null);
  const dispatchMode = String(req.query.dispatch || '').trim().toLowerCase() === 'true';

  if (departmentId && !dispatchMode) {
    zones = zones.filter((zone) => {
      if (!zone) return false;
      if (!zone.department_id && !zone.backup_department_id) return true;
      return Number(zone.department_id || 0) === departmentId || Number(zone.backup_department_id || 0) === departmentId;
    });
  }

  res.json({ zones, count: zones.length, settings_key: SETTINGS_KEY });
});

module.exports = router;
