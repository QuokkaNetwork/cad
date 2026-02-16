const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Units, Departments, SubDepartments } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();

function findDispatchDepartments() {
  return Departments.list().filter(d => d.is_dispatch);
}

function isUserInDispatchDepartment(user) {
  const dispatchDepts = findDispatchDepartments();
  if (!dispatchDepts.length) return false;
  const dispatchIds = dispatchDepts.map(d => d.id);
  return user.departments.some(d => dispatchIds.includes(d.id));
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
