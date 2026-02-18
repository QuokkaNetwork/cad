const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Bolos } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();
const VEHICLE_BOLO_FLAGS = new Set([
  'stolen',
  'wanted',
  'armed',
  'dangerous',
  'disqualified_driver',
  'evade_police',
  'suspended_registration',
  'unregistered_vehicle',
]);

function normalizePlateKey(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeVehicleBoloDetails(detailsRaw) {
  const details = detailsRaw && typeof detailsRaw === 'object' && !Array.isArray(detailsRaw)
    ? { ...detailsRaw }
    : {};
  const plate = normalizePlateKey(details.plate || details.registration_plate || details.rego || '');
  const flagsRaw = Array.isArray(details.flags) ? details.flags : [];
  const flags = Array.from(new Set(
    flagsRaw
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter((entry) => VEHICLE_BOLO_FLAGS.has(entry))
  ));

  return {
    ...details,
    plate,
    flags,
  };
}

// List active BOLOs for a department
router.get('/', requireAuth, (req, res) => {
  const { department_id, status } = req.query;
  if (!department_id) return res.status(400).json({ error: 'department_id is required' });

  const deptId = parseInt(department_id, 10);
  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const bolos = Bolos.listByDepartment(deptId, status || 'active');
  res.json(bolos);
});

// Create a BOLO
router.post('/', requireAuth, (req, res) => {
  const { department_id, type, title, description, details } = req.body;
  if (!department_id || !title || !type) {
    return res.status(400).json({ error: 'department_id, type, and title are required' });
  }
  const normalizedType = String(type || '').trim().toLowerCase();
  if (!['person', 'vehicle'].includes(normalizedType)) {
    return res.status(400).json({ error: 'type must be person or vehicle' });
  }

  let normalizedDetails = details && typeof details === 'object' ? { ...details } : {};
  if (normalizedType === 'vehicle') {
    normalizedDetails = normalizeVehicleBoloDetails(details);
    if (!normalizedDetails.plate) {
      return res.status(400).json({ error: 'vehicle BOLOs require details.plate (registration plate)' });
    }
  }

  const deptId = parseInt(department_id, 10);
  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const bolo = Bolos.create({
    department_id: deptId,
    type: normalizedType,
    title,
    description: description || '',
    details_json: JSON.stringify(normalizedDetails),
    created_by: req.user.id,
  });

  audit(req.user.id, 'bolo_created', {
    boloId: bolo.id,
    type: normalizedType,
    title,
    plate: normalizedType === 'vehicle' ? String(normalizedDetails.plate || '') : '',
    flags: normalizedType === 'vehicle' ? normalizedDetails.flags : [],
  });
  bus.emit('bolo:create', { departmentId: deptId, bolo });
  res.status(201).json(bolo);
});

// Resolve a BOLO
router.patch('/:id/resolve', requireAuth, (req, res) => {
  const bolo = Bolos.findById(parseInt(req.params.id, 10));
  if (!bolo) return res.status(404).json({ error: 'BOLO not found' });

  Bolos.updateStatus(bolo.id, 'resolved');
  audit(req.user.id, 'bolo_resolved', { boloId: bolo.id });
  bus.emit('bolo:resolve', { departmentId: bolo.department_id, boloId: bolo.id });
  res.json({ success: true });
});

// Cancel a BOLO
router.patch('/:id/cancel', requireAuth, (req, res) => {
  const bolo = Bolos.findById(parseInt(req.params.id, 10));
  if (!bolo) return res.status(404).json({ error: 'BOLO not found' });

  Bolos.updateStatus(bolo.id, 'cancelled');
  audit(req.user.id, 'bolo_cancelled', { boloId: bolo.id });
  bus.emit('bolo:cancel', { departmentId: bolo.department_id, boloId: bolo.id });
  res.json({ success: true });
});

module.exports = router;
