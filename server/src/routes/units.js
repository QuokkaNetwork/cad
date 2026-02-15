const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Units, Departments } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();
const DISPATCH_SHORT_NAME = 'DISPATCH';

function findDispatchDepartment() {
  const all = Departments.list();
  return all.find(d => String(d.short_name || '').toUpperCase() === DISPATCH_SHORT_NAME) || null;
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

  const dispatchDepartment = findDispatchDepartment();
  if (!dispatchDepartment) {
    return res.json({
      dispatch_department: null,
      dispatcher_online: false,
      online_count: 0,
      is_dispatch_department: false,
    });
  }

  const dispatchUnits = Units.listByDepartment(dispatchDepartment.id);
  return res.json({
    dispatch_department: dispatchDepartment,
    dispatcher_online: dispatchUnits.length > 0,
    online_count: dispatchUnits.length,
    is_dispatch_department: dispatchDepartment.id === deptId,
  });
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

  const { callsign, department_id } = req.body;
  if (!callsign || !department_id) {
    return res.status(400).json({ error: 'Callsign and department are required' });
  }

  const deptId = parseInt(department_id, 10);
  const dept = Departments.findById(deptId);
  if (!dept) return res.status(400).json({ error: 'Department not found' });

  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const unit = Units.create({
    user_id: req.user.id,
    department_id: deptId,
    callsign: callsign.trim(),
  });

  audit(req.user.id, 'unit_on_duty', { callsign, department: dept.short_name });
  bus.emit('unit:online', { departmentId: deptId, unit });
  res.status(201).json(unit);
});

// Update own unit (status, location, note)
router.patch('/me', requireAuth, (req, res) => {
  const unit = Units.findByUserId(req.user.id);
  if (!unit) return res.status(404).json({ error: 'Not on duty' });

  const { status, location, note, callsign } = req.body;
  const updates = {};
  if (status !== undefined) updates.status = status;
  if (location !== undefined) updates.location = location;
  if (note !== undefined) updates.note = note;
  if (callsign !== undefined) updates.callsign = callsign;

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
