const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { TrafficStops, Departments, Units, Calls } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();
const LAW_LAYOUT_TYPE = 'law_enforcement';

function isUserInDispatchDepartment(user) {
  const dispatchDepts = Departments.list().filter((d) => d.is_dispatch);
  if (!dispatchDepts.length) return false;
  const dispatchIds = new Set(dispatchDepts.map((d) => Number(d.id)));
  return Array.isArray(user?.departments) && user.departments.some((d) => dispatchIds.has(Number(d?.id)));
}

function canAccessDepartment(user, departmentId) {
  const deptId = Number(departmentId);
  if (!Number.isInteger(deptId) || deptId <= 0) return false;
  if (user?.is_admin) return true;
  if (Array.isArray(user?.departments) && user.departments.some((d) => Number(d?.id) === deptId)) return true;
  if (isUserInDispatchDepartment(user)) {
    return Departments.listDispatchVisible().some((d) => Number(d.id) === deptId);
  }
  return false;
}

function hasLawEnforcementDepartmentAccess(user) {
  if (user?.is_admin) return true;
  return Array.isArray(user?.departments)
    && user.departments.some((d) => String(d?.layout_type || '').trim().toLowerCase() === LAW_LAYOUT_TYPE);
}

function resolvePoliceDepartmentIdForTrafficStop(user, requestedDepartmentId, callId) {
  const requestedId = Number(requestedDepartmentId);
  if (Number.isInteger(requestedId) && requestedId > 0) {
    const requestedDept = Departments.findById(requestedId);
    if (requestedDept && !requestedDept.is_dispatch && String(requestedDept.layout_type || '').trim().toLowerCase() === LAW_LAYOUT_TYPE) {
      return requestedDept.id;
    }
  }

  // Prefer the user's own law-enforcement department when they are police.
  if (Array.isArray(user?.departments)) {
    const firstUserLawDept = user.departments.find((d) => (
      !d?.is_dispatch && String(d?.layout_type || '').trim().toLowerCase() === LAW_LAYOUT_TYPE
    ));
    if (firstUserLawDept?.id) return Number(firstUserLawDept.id);
  }

  // If the stop is linked to a call and that call belongs to a police department, use it.
  const parsedCallId = Number(callId);
  if (Number.isInteger(parsedCallId) && parsedCallId > 0) {
    const call = Calls.findById(parsedCallId);
    const callDept = call ? Departments.findById(Number(call.department_id || 0)) : null;
    if (callDept && !callDept.is_dispatch && String(callDept.layout_type || '').trim().toLowerCase() === LAW_LAYOUT_TYPE) {
      return Number(callDept.id);
    }
  }

  // Dispatch fallback: first active visible police department.
  const visiblePoliceDept = Departments.listDispatchVisible().find((d) => (
    !d?.is_dispatch && String(d?.layout_type || '').trim().toLowerCase() === LAW_LAYOUT_TYPE
  ));
  if (visiblePoliceDept?.id) return Number(visiblePoliceDept.id);

  // Final fallback: any active police department.
  const activePoliceDept = Departments.listActive().find((d) => (
    !d?.is_dispatch && String(d?.layout_type || '').trim().toLowerCase() === LAW_LAYOUT_TYPE
  ));
  if (activePoliceDept?.id) return Number(activePoliceDept.id);

  return 0;
}

router.get('/', requireAuth, (req, res) => {
  const departmentId = Number(req.query?.department_id);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res.status(400).json({ error: 'department_id is required' });
  }
  if (!canAccessDepartment(req.user, departmentId)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const callId = Number(req.query?.call_id);
  if (Number.isInteger(callId) && callId > 0) {
    return res.json(TrafficStops.listByCallId(callId));
  }

  const limit = Number(req.query?.limit);
  const offset = Number(req.query?.offset);
  res.json(TrafficStops.listByDepartment(departmentId, limit, offset));
});

router.post('/', requireAuth, (req, res) => {
  if (!hasLawEnforcementDepartmentAccess(req.user) && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Traffic stops are limited to law enforcement / dispatch' });
  }

  const departmentId = resolvePoliceDepartmentIdForTrafficStop(req.user, req.body?.department_id, req.body?.call_id);
  if (!departmentId) {
    return res.status(400).json({ error: 'No active law enforcement department is configured for traffic stops' });
  }
  if (!canAccessDepartment(req.user, departmentId) && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const reason = String(req.body?.reason || '').trim();
  if (!reason) return res.status(400).json({ error: 'reason is required' });

  const activeUnit = Units.findByUserId(req.user.id);
  const useUnitId = activeUnit && Number(activeUnit.department_id) === departmentId ? activeUnit.id : null;

  const stop = TrafficStops.create({
    department_id: departmentId,
    call_id: req.body?.call_id,
    unit_id: useUnitId,
    created_by_user_id: req.user.id,
    location: req.body?.location,
    postal: req.body?.postal,
    plate: req.body?.plate,
    reason,
    outcome: req.body?.outcome,
    notes: req.body?.notes,
    position_x: req.body?.position_x,
    position_y: req.body?.position_y,
    position_z: req.body?.position_z,
  });

  audit(req.user.id, 'traffic_stop_created', {
    traffic_stop_id: stop.id,
    department_id: departmentId,
    plate: stop.plate || '',
    reason: stop.reason || '',
    outcome: stop.outcome || '',
    call_id: stop.call_id || null,
  });
  bus.emit('trafficstop:create', { departmentId, stop });
  res.status(201).json(stop);
});

module.exports = router;
