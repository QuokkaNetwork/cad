const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { TrafficStops, Departments, Units } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();

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
  const departmentId = Number(req.body?.department_id);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res.status(400).json({ error: 'department_id is required' });
  }
  if (!canAccessDepartment(req.user, departmentId)) {
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
