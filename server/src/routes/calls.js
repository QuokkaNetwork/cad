const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Calls, Units } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();

// List calls for a department
router.get('/', requireAuth, (req, res) => {
  const { department_id, include_closed } = req.query;
  if (!department_id) return res.status(400).json({ error: 'department_id is required' });

  const deptId = parseInt(department_id, 10);
  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const calls = Calls.listByDepartment(deptId, include_closed === 'true');
  res.json(calls);
});

// Create a call
router.post('/', requireAuth, (req, res) => {
  const { department_id, title, priority, location, description, job_code } = req.body;
  if (!department_id || !title) {
    return res.status(400).json({ error: 'department_id and title are required' });
  }

  const deptId = parseInt(department_id, 10);
  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const call = Calls.create({
    department_id: deptId,
    title,
    priority: priority || '3',
    location: location || '',
    description: description || '',
    job_code: job_code || '',
    created_by: req.user.id,
  });

  audit(req.user.id, 'call_created', { callId: call.id, title });
  bus.emit('call:create', { departmentId: deptId, call });
  res.status(201).json(call);
});

// Update a call
router.patch('/:id', requireAuth, (req, res) => {
  const call = Calls.findById(parseInt(req.params.id, 10));
  if (!call) return res.status(404).json({ error: 'Call not found' });

  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === call.department_id);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const { title, priority, location, description, job_code, status } = req.body;
  Calls.update(call.id, { title, priority, location, description, job_code, status });
  const updated = Calls.findById(call.id);

  const eventName = status === 'closed' ? 'call:close' : 'call:update';
  bus.emit(eventName, { departmentId: call.department_id, call: updated });
  res.json(updated);
});

// Assign a unit to a call
router.post('/:id/assign', requireAuth, (req, res) => {
  const call = Calls.findById(parseInt(req.params.id, 10));
  if (!call) return res.status(404).json({ error: 'Call not found' });

  const { unit_id } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

  const unit = Units.findById(parseInt(unit_id, 10));
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  Calls.assignUnit(call.id, unit.id);
  const updated = Calls.findById(call.id);

  bus.emit('call:assign', { departmentId: call.department_id, call: updated, unit });
  res.json(updated);
});

// Unassign a unit from a call
router.post('/:id/unassign', requireAuth, (req, res) => {
  const call = Calls.findById(parseInt(req.params.id, 10));
  if (!call) return res.status(404).json({ error: 'Call not found' });

  const { unit_id } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

  Calls.unassignUnit(call.id, parseInt(unit_id, 10));
  const updated = Calls.findById(call.id);

  bus.emit('call:unassign', { departmentId: call.department_id, call: updated });
  res.json(updated);
});

module.exports = router;
