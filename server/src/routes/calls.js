const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Calls, Units, Departments } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();

function isUserInDispatchDepartment(user) {
  const dispatchDepts = Departments.list().filter(d => d.is_dispatch);
  if (!dispatchDepts.length) return false;
  const dispatchIds = dispatchDepts.map(d => d.id);
  return user.departments.some(d => dispatchIds.includes(d.id));
}

function getDispatchVisibleDeptIds() {
  return Departments.listDispatchVisible().map(d => d.id);
}

function canManageCall(user, callDepartmentId) {
  if (user?.is_admin) return true;
  if (Array.isArray(user?.departments) && user.departments.some(d => d.id === callDepartmentId)) return true;
  if (!isUserInDispatchDepartment(user)) return false;
  return getDispatchVisibleDeptIds().includes(callDepartmentId);
}

// List calls for a department (or all dispatch-visible departments)
router.get('/', requireAuth, (req, res) => {
  const { department_id, include_closed, dispatch } = req.query;
  if (!department_id) return res.status(400).json({ error: 'department_id is required' });

  const deptId = parseInt(department_id, 10);
  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  // Dispatch mode: return calls from all dispatch-visible departments
  if (dispatch === 'true' && (req.user.is_admin || isUserInDispatchDepartment(req.user))) {
    const visibleIds = getDispatchVisibleDeptIds();
    // Also include the dispatch department's own calls
    if (!visibleIds.includes(deptId)) visibleIds.push(deptId);
    const calls = Calls.listByDepartmentIds(visibleIds, include_closed === 'true');
    return res.json(calls);
  }

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

  // Dispatchers can create calls for any dispatch-visible department
  const isDispatcher = isUserInDispatchDepartment(req.user);
  if (!hasDept && !isDispatcher) {
    return res.status(403).json({ error: 'Department access denied' });
  }
  if (isDispatcher && !hasDept) {
    const visibleIds = getDispatchVisibleDeptIds();
    if (!visibleIds.includes(deptId)) {
      return res.status(403).json({ error: 'Target department is not visible to dispatch' });
    }
  }

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
  const isDispatcher = isUserInDispatchDepartment(req.user);
  if (!hasDept && !isDispatcher) return res.status(403).json({ error: 'Department access denied' });

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
  if (!canManageCall(req.user, call.department_id)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const { unit_id } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

  const unit = Units.findById(parseInt(unit_id, 10));
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  Calls.assignUnit(call.id, unit.id);
  Units.update(unit.id, { status: 'enroute' });
  const refreshedUnit = Units.findById(unit.id);
  const updated = Calls.findById(call.id);

  bus.emit('unit:update', { departmentId: unit.department_id, unit: refreshedUnit });
  bus.emit('call:assign', { departmentId: call.department_id, call: updated, unit: refreshedUnit });
  audit(req.user.id, 'call_unit_assigned', {
    callId: call.id,
    unitId: unit.id,
    callsign: refreshedUnit?.callsign || unit.callsign,
  });
  res.json(updated);
});

// Unassign a unit from a call
router.post('/:id/unassign', requireAuth, (req, res) => {
  const call = Calls.findById(parseInt(req.params.id, 10));
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (!canManageCall(req.user, call.department_id)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const { unit_id } = req.body;
  if (!unit_id) return res.status(400).json({ error: 'unit_id is required' });

  const parsedUnitId = parseInt(unit_id, 10);
  const unit = Units.findById(parsedUnitId);
  Calls.unassignUnit(call.id, parsedUnitId);
  const updated = Calls.findById(call.id);

  bus.emit('call:unassign', {
    departmentId: call.department_id,
    call: updated,
    unit,
    unit_id: parsedUnitId,
  });
  audit(req.user.id, 'call_unit_unassigned', {
    callId: call.id,
    unitId: parsedUnitId,
    callsign: unit?.callsign || '',
  });
  res.json(updated);
});

module.exports = router;
