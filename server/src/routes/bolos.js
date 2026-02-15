const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Bolos } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();

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

  const deptId = parseInt(department_id, 10);
  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const bolo = Bolos.create({
    department_id: deptId,
    type,
    title,
    description: description || '',
    details_json: details ? JSON.stringify(details) : '{}',
    created_by: req.user.id,
  });

  audit(req.user.id, 'bolo_created', { boloId: bolo.id, type, title });
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
