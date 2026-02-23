const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Calls, Units, Departments, PursuitOutcomes } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();
const HIDDEN_CALL_STATUSES = new Set(['pending_dispatch']);

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

function normalizeUnitStatus(status) {
  return String(status || '').trim().toLowerCase();
}

function normalizeRequestedDepartmentIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map(item => Number(item))
      .filter(item => Number.isInteger(item) && item > 0)
  ));
}

function normalizeBooleanFlag(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  const num = Number(value);
  if (Number.isFinite(num)) return num !== 0;
  const text = String(value || '').trim().toLowerCase();
  if (!text) return fallback;
  return ['true', 'yes', 'on', '1'].includes(text);
}

function normalizePursuitPayload(call, body = {}) {
  const hasEnabled = Object.prototype.hasOwnProperty.call(body, 'pursuit_mode_enabled');
  const hasPrimary = Object.prototype.hasOwnProperty.call(body, 'pursuit_primary_unit_id');
  if (!hasEnabled && !hasPrimary) {
    return { error: 'No pursuit fields supplied' };
  }

  const assignedUnits = Array.isArray(call?.assigned_units) ? call.assigned_units : [];
  const assignedUnitIds = new Set(
    assignedUnits
      .map((u) => Number(u?.id))
      .filter((id) => Number.isInteger(id) && id > 0)
  );

  const currentEnabled = normalizeBooleanFlag(call?.pursuit_mode_enabled, false);
  const nextEnabled = hasEnabled ? normalizeBooleanFlag(body.pursuit_mode_enabled, currentEnabled) : currentEnabled;

  let nextPrimaryUnitId = hasPrimary
    ? (Number.isFinite(Number(body.pursuit_primary_unit_id)) ? Math.trunc(Number(body.pursuit_primary_unit_id)) : 0)
    : (Number.isFinite(Number(call?.pursuit_primary_unit_id)) ? Math.trunc(Number(call.pursuit_primary_unit_id)) : 0);

  if (nextPrimaryUnitId > 0 && !assignedUnitIds.has(nextPrimaryUnitId)) {
    return { error: 'Primary pursuit unit must be assigned to the call' };
  }

  if (nextEnabled && nextPrimaryUnitId <= 0) {
    return { error: 'pursuit_primary_unit_id is required when enabling pursuit mode' };
  }

  if (!nextEnabled) {
    nextPrimaryUnitId = null;
  }

  return {
    pursuit_mode_enabled: nextEnabled ? 1 : 0,
    pursuit_primary_unit_id: nextPrimaryUnitId || null,
    pursuit_updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
  };
}

const PURSUIT_OUTCOME_CODES = new Set([
  'arrest',
  'vehicle_stopped',
  'suspect_fled',
  'lost_visual',
  'cancelled_supervisor',
  'cancelled_safety',
  'other',
]);

function normalizeIdArray(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0)
  ));
}

function buildPursuitOutcomeUnitSnapshots(call, requestedUnitIds = []) {
  const assignedUnits = Array.isArray(call?.assigned_units) ? call.assigned_units : [];
  const assignedById = new Map();
  for (const unit of assignedUnits) {
    const id = Number(unit?.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    assignedById.set(id, unit);
  }

  const requestedIds = normalizeIdArray(requestedUnitIds);
  const effectiveIds = requestedIds.length > 0
    ? requestedIds.filter((id) => assignedById.has(id))
    : Array.from(assignedById.keys());

  return effectiveIds
    .map((id) => assignedById.get(id))
    .filter(Boolean)
    .map((unit) => ({
      id: Number(unit.id),
      callsign: String(unit.callsign || '').trim(),
      user_name: String(unit.user_name || '').trim(),
      department_id: Number.isFinite(Number(unit.department_id)) ? Math.trunc(Number(unit.department_id)) : null,
      department_short_name: String(unit.department_short_name || '').trim(),
      status: String(unit.status || '').trim().toLowerCase(),
    }));
}

function normalizePursuitOutcomePayload(call, body = {}) {
  const outcomeCode = String(body?.outcome_code || '').trim().toLowerCase();
  if (!outcomeCode) {
    return { error: 'outcome_code is required' };
  }
  if (!PURSUIT_OUTCOME_CODES.has(outcomeCode)) {
    return { error: 'Invalid pursuit outcome code' };
  }

  const involvedUnits = buildPursuitOutcomeUnitSnapshots(call, body?.involved_unit_ids);
  const involvedUnitIds = involvedUnits.map((unit) => Number(unit.id));

  let primaryUnitId = Number.isFinite(Number(body?.primary_unit_id))
    ? Math.trunc(Number(body.primary_unit_id))
    : (Number.isFinite(Number(call?.pursuit_primary_unit_id)) ? Math.trunc(Number(call.pursuit_primary_unit_id)) : 0);
  if (!Number.isInteger(primaryUnitId) || primaryUnitId <= 0) {
    primaryUnitId = null;
  } else if (involvedUnitIds.length > 0 && !involvedUnitIds.includes(primaryUnitId)) {
    // Keep the log consistent with the "units involved" snapshot.
    primaryUnitId = null;
  }

  return {
    outcome_code: outcomeCode,
    termination_location: String(body?.termination_location || call?.location || '').trim(),
    summary: String(body?.summary || '').trim(),
    involved_units: involvedUnits,
    primary_unit_id: primaryUnitId,
    disable_pursuit_mode: normalizeBooleanFlag(body?.disable_pursuit_mode, true),
  };
}

function publishPursuitUpdate(callId, departmentId) {
  const call = Calls.findById(Number(callId || 0));
  bus.emit('pursuit:update', {
    departmentId,
    callId: Number(callId || 0),
    call: call || null,
    pursuit: call ? {
      pursuit_mode_enabled: normalizeBooleanFlag(call.pursuit_mode_enabled, false),
      pursuit_primary_unit_id: Number(call.pursuit_primary_unit_id || 0) || null,
      pursuit_updated_at: call.pursuit_updated_at || null,
    } : null,
  });
}

function filterCallsVisibleToCad(calls = []) {
  if (!Array.isArray(calls)) return [];
  return calls.filter((call) => !HIDDEN_CALL_STATUSES.has(String(call?.status || '').trim().toLowerCase()));
}

function getFallbackRequestedDepartmentIds(departmentId) {
  const parsedDepartmentId = Number(departmentId);
  const department = Departments.findById(parsedDepartmentId);
  if (department && !department.is_dispatch) return [parsedDepartmentId];

  const visibleIds = getDispatchVisibleDeptIds();
  if (visibleIds.includes(parsedDepartmentId)) return [parsedDepartmentId];
  return visibleIds.length > 0 ? [Number(visibleIds[0])] : [];
}

function resolveRequestedDepartmentIdsForCreate(user, departmentId, rawRequestedDepartmentIds) {
  const visibleIds = new Set(getDispatchVisibleDeptIds());
  const isDispatchPrivileged = !!(user?.is_admin || isUserInDispatchDepartment(user));
  const normalized = normalizeRequestedDepartmentIds(rawRequestedDepartmentIds).filter(id => visibleIds.has(id));

  if (!isDispatchPrivileged) {
    return getFallbackRequestedDepartmentIds(departmentId);
  }
  return normalized.length > 0 ? normalized : getFallbackRequestedDepartmentIds(departmentId);
}

function resolveRequestedDepartmentIdsForUpdate(user, call, rawRequestedDepartmentIds) {
  if (rawRequestedDepartmentIds === undefined) return undefined;

  const visibleIds = new Set(getDispatchVisibleDeptIds());
  const isDispatchPrivileged = !!(user?.is_admin || isUserInDispatchDepartment(user));
  const normalized = normalizeRequestedDepartmentIds(rawRequestedDepartmentIds).filter(id => visibleIds.has(id));

  if (!isDispatchPrivileged) {
    const existing = normalizeRequestedDepartmentIds(call?.requested_department_ids);
    if (existing.length > 0) return existing;
    return getFallbackRequestedDepartmentIds(call?.department_id);
  }

  if (normalized.length > 0) return normalized;
  const existing = normalizeRequestedDepartmentIds(call?.requested_department_ids);
  if (existing.length > 0) return existing;
  return getFallbackRequestedDepartmentIds(call?.department_id);
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
    return res.json(filterCallsVisibleToCad(calls));
  }

  const calls = Calls.listByDepartment(deptId, include_closed === 'true');
  res.json(filterCallsVisibleToCad(calls));
});

// Create a call
router.post('/', requireAuth, (req, res) => {
  const {
    department_id,
    title,
    priority,
    location,
    postal,
    description,
    job_code,
    requested_department_ids,
    pursuit_mode_enabled,
  } = req.body;
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
  const requestedDepartmentIds = resolveRequestedDepartmentIdsForCreate(req.user, deptId, requested_department_ids);

  const normalizedPriority = ['1', '2', '3', '4'].includes(String(priority || '').trim())
    ? String(priority).trim()
    : '3';
  const createAsPursuit = normalizeBooleanFlag(pursuit_mode_enabled, false);
  const call = Calls.create({
    department_id: deptId,
    title,
    priority: normalizedPriority,
    location: location || '',
    postal: String(postal || '').trim(),
    description: description || '',
    job_code: job_code || '',
    status: 'active',
    requested_department_ids: requestedDepartmentIds,
    pursuit_mode_enabled: createAsPursuit ? 1 : 0,
    pursuit_primary_unit_id: null,
    pursuit_updated_at: createAsPursuit ? new Date().toISOString().replace('T', ' ').slice(0, 19) : null,
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

  const { title, priority, location, postal, description, job_code, status, requested_department_ids } = req.body;
  const normalizedStatus = status === undefined
    ? undefined
    : String(status || '').trim().toLowerCase();
  const wasClosed = String(call?.status || '').trim().toLowerCase() === 'closed';
  const requestedDepartmentIds = resolveRequestedDepartmentIdsForUpdate(req.user, call, requested_department_ids);
  Calls.update(call.id, {
    title,
    priority,
    location,
    postal,
    description,
    job_code,
    status: normalizedStatus,
    requested_department_ids: requestedDepartmentIds,
  });
  let updated = Calls.findById(call.id);
  const isClosingCall = normalizedStatus === 'closed' && !wasClosed;
  if (isClosingCall && Array.isArray(updated?.assigned_units)) {
    for (const assignedUnit of updated.assigned_units) {
      const unitId = Number(assignedUnit?.id || 0);
      if (!unitId) continue;

      const currentUnit = Units.findById(unitId);
      if (!currentUnit) continue;
      if (normalizeUnitStatus(currentUnit.status) === 'available') continue;

      Units.update(unitId, { status: 'available' });
      const refreshedUnit = Units.findById(unitId) || { ...currentUnit, status: 'available' };
      bus.emit('unit:update', {
        departmentId: refreshedUnit.department_id,
        unit: refreshedUnit,
      });
      bus.emit('unit:status_available', {
        departmentId: refreshedUnit.department_id,
        unit: refreshedUnit,
        call: updated || null,
      });
    }
  }

  const eventName = normalizedStatus === 'closed' ? 'call:close' : 'call:update';
  if (normalizedStatus === 'closed' && (Number(updated?.pursuit_mode_enabled || 0) === 1 || Number(updated?.pursuit_primary_unit_id || 0) > 0)) {
    Calls.update(call.id, {
      pursuit_mode_enabled: 0,
      pursuit_primary_unit_id: null,
      pursuit_updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
    updated = Calls.findById(call.id);
  }
  bus.emit(eventName, { departmentId: call.department_id, call: updated });
  if (normalizedStatus === 'closed') {
    publishPursuitUpdate(call.id, call.department_id);
  }
  res.json(updated);
});

// Update pursuit mode configuration for a call.
router.patch('/:id/pursuit', requireAuth, (req, res) => {
  const call = Calls.findById(parseInt(req.params.id, 10));
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (!canManageCall(req.user, call.department_id)) {
    return res.status(403).json({ error: 'Department access denied' });
  }
  if (String(call.status || '').trim().toLowerCase() === 'closed') {
    return res.status(400).json({ error: 'Cannot configure pursuit mode on a closed call' });
  }

  const normalized = normalizePursuitPayload(call, req.body || {});
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  Calls.update(call.id, normalized);
  let updated = Calls.findById(call.id);
  audit(req.user.id, 'call_pursuit_updated', {
    callId: call.id,
    pursuit_mode_enabled: Number(updated?.pursuit_mode_enabled || 0) === 1,
    pursuit_primary_unit_id: Number(updated?.pursuit_primary_unit_id || 0) || null,
  });
  publishPursuitUpdate(call.id, call.department_id);
  res.json(updated);
});

router.get('/:id/pursuit-outcomes', requireAuth, (req, res) => {
  const call = Calls.findById(parseInt(req.params.id, 10));
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (!canManageCall(req.user, call.department_id)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const limit = Number.isFinite(Number(req.query?.limit)) ? Math.trunc(Number(req.query.limit)) : 25;
  const outcomes = PursuitOutcomes.listByCallId(call.id, limit);
  res.json(outcomes);
});

router.post('/:id/pursuit-outcomes', requireAuth, (req, res) => {
  const call = Calls.findById(parseInt(req.params.id, 10));
  if (!call) return res.status(404).json({ error: 'Call not found' });
  if (!canManageCall(req.user, call.department_id)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const normalized = normalizePursuitOutcomePayload(call, req.body || {});
  if (normalized.error) return res.status(400).json({ error: normalized.error });

  let outcome;
  try {
    outcome = PursuitOutcomes.create({
      call_id: call.id,
      department_id: call.department_id,
      primary_unit_id: normalized.primary_unit_id,
      outcome_code: normalized.outcome_code,
      termination_location: normalized.termination_location,
      summary: normalized.summary,
      involved_units: normalized.involved_units,
      created_by_user_id: req.user.id,
    });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to create pursuit outcome', message: err.message });
  }

  let updatedCall = call;
  const pursuitWasActive = Number(call?.pursuit_mode_enabled || 0) === 1 || Number(call?.pursuit_primary_unit_id || 0) > 0;
  if (normalized.disable_pursuit_mode && pursuitWasActive) {
    Calls.update(call.id, {
      pursuit_mode_enabled: 0,
      pursuit_primary_unit_id: null,
      pursuit_updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
    updatedCall = Calls.findById(call.id) || call;
    bus.emit('call:update', { departmentId: call.department_id, call: updatedCall });
    publishPursuitUpdate(call.id, call.department_id);
  } else {
    updatedCall = Calls.findById(call.id) || call;
  }

  audit(req.user.id, 'pursuit_outcome_logged', {
    callId: call.id,
    pursuit_outcome_id: outcome.id,
    outcome_code: outcome.outcome_code,
    primary_unit_id: outcome.primary_unit_id || null,
    involved_unit_count: Array.isArray(outcome.involved_units) ? outcome.involved_units.length : 0,
  });

  bus.emit('pursuit:outcome_create', {
    departmentId: call.department_id,
    callId: call.id,
    call: updatedCall,
    outcome,
  });

  res.status(201).json({
    outcome,
    call: updatedCall,
  });
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
  const alreadyAssigned = Array.isArray(call?.assigned_units)
    && call.assigned_units.some(assigned => Number(assigned.id) === Number(unit.id));
  const unitStatus = normalizeUnitStatus(unit.status);
  if (!alreadyAssigned && unitStatus !== 'available') {
    return res.status(400).json({ error: 'Only available units can be attached to a call' });
  }

  const assignmentChanges = Calls.assignUnit(call.id, unit.id);
  Calls.update(call.id, {
    status: 'active',
    was_ever_assigned: 1,
  });
  Units.update(unit.id, { status: 'enroute' });
  const refreshedUnit = Units.findById(unit.id);
  const updated = Calls.findById(call.id);

  bus.emit('unit:update', { departmentId: unit.department_id, unit: refreshedUnit });
  bus.emit('call:assign', { departmentId: call.department_id, call: updated, unit: refreshedUnit });
  audit(req.user.id, 'call_unit_assigned', {
    callId: call.id,
    unitId: unit.id,
    callsign: refreshedUnit?.callsign || unit.callsign,
    assignment_created: assignmentChanges > 0,
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
  const detachedUnitSnapshot = Array.isArray(call?.assigned_units)
    ? (call.assigned_units.find(u => Number(u.id) === Number(parsedUnitId)) || null)
    : null;
  const unassignmentChanges = Calls.unassignUnit(call.id, parsedUnitId);
  const updated = Calls.findById(call.id);
  let refreshedUnit = unit;
  let unitStatusSetToAvailable = false;

  if (unassignmentChanges > 0 && unit?.id) {
    if (normalizeUnitStatus(unit.status) !== 'available') {
      Units.update(unit.id, { status: 'available' });
      refreshedUnit = Units.findById(unit.id) || unit;
      unitStatusSetToAvailable = true;
      bus.emit('unit:update', { departmentId: refreshedUnit.department_id, unit: refreshedUnit });
    }
    const availableUnit = refreshedUnit || unit;
    if (availableUnit) {
      bus.emit('unit:status_available', {
        departmentId: availableUnit.department_id,
        unit: availableUnit,
        call: updated || null,
      });
    }
  }
  const unitForEvent = refreshedUnit || detachedUnitSnapshot;
  const autoClosed = false;

  const currentPursuitPrimaryUnitId = Number(updated?.pursuit_primary_unit_id || call?.pursuit_primary_unit_id || 0);
  if (unassignmentChanges > 0 && currentPursuitPrimaryUnitId > 0 && Number(parsedUnitId) === currentPursuitPrimaryUnitId) {
    Calls.update(call.id, {
      pursuit_mode_enabled: 0,
      pursuit_primary_unit_id: null,
      pursuit_updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
    });
  }

  bus.emit('call:unassign', {
    departmentId: call.department_id,
    call: updated,
    unit: unitForEvent,
    unit_id: parsedUnitId,
    removed: unassignmentChanges > 0,
    auto_closed: autoClosed,
    unit_status_set_available: unitStatusSetToAvailable,
    unit_status_set_busy: false,
  });
  audit(req.user.id, 'call_unit_unassigned', {
    callId: call.id,
    unitId: parsedUnitId,
    callsign: unitForEvent?.callsign || '',
    assignment_removed: unassignmentChanges > 0,
    auto_closed: autoClosed,
    unit_status_set_available: unitStatusSetToAvailable,
    unit_status_set_busy: false,
  });
  if (unassignmentChanges > 0 && currentPursuitPrimaryUnitId > 0 && Number(parsedUnitId) === currentPursuitPrimaryUnitId) {
    publishPursuitUpdate(call.id, call.department_id);
    return res.json(Calls.findById(call.id));
  }
  res.json(updated);
});

module.exports = router;
