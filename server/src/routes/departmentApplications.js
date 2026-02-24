const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Departments, DepartmentApplications } = require('../db/sqlite');
const { audit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

function normalizeApplicationMessage(value) {
  const message = String(value || '').trim();
  return message.slice(0, 4000);
}

router.get('/', (req, res) => {
  const assignedDepartmentIds = new Set(
    (Array.isArray(req.user?.departments) ? req.user.departments : []).map((dept) => Number(dept?.id))
  );

  const departments = Departments.listActive().map((dept) => ({
    id: dept.id,
    name: dept.name,
    short_name: dept.short_name || '',
    color: dept.color || '#0052C2',
    icon: dept.icon || '',
    slogan: dept.slogan || '',
    is_dispatch: !!dept.is_dispatch,
    layout_type: String(dept.layout_type || '').trim(),
    applications_open: !!dept.applications_open,
    is_assigned: assignedDepartmentIds.has(Number(dept.id)),
  }));

  const applications = DepartmentApplications.listByUser(req.user.id);
  res.json({ departments, applications });
});

router.post('/', (req, res) => {
  if (req.user?.is_admin) {
    return res.status(400).json({ error: 'Admins do not need department applications' });
  }

  if (!String(req.user?.discord_id || '').trim()) {
    return res.status(400).json({ error: 'Link Discord before applying to a department' });
  }

  const departmentId = Number.parseInt(String(req.body?.department_id || '').trim(), 10);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res.status(400).json({ error: 'department_id is required' });
  }

  const department = Departments.findById(departmentId);
  if (!department || !department.is_active) {
    return res.status(404).json({ error: 'Department not found' });
  }

  if (!department.applications_open) {
    return res.status(400).json({ error: 'Applications are currently closed for this department' });
  }

  const alreadyAssigned = (Array.isArray(req.user?.departments) ? req.user.departments : [])
    .some((dept) => Number(dept?.id) === departmentId);
  if (alreadyAssigned) {
    return res.status(400).json({ error: 'You already have access to this department' });
  }

  const existingPending = DepartmentApplications.findPendingByUserAndDepartment(req.user.id, departmentId);
  if (existingPending) {
    return res.status(409).json({ error: 'You already have a pending application for this department' });
  }

  const message = normalizeApplicationMessage(req.body?.message);
  if (!message) {
    return res.status(400).json({ error: 'Application message is required' });
  }

  const application = DepartmentApplications.create({
    user_id: req.user.id,
    department_id: departmentId,
    message,
  });

  audit(req.user.id, 'department_application_created', {
    department_id: departmentId,
    department_name: department.name,
    application_id: application.id,
  });

  res.status(201).json({
    success: true,
    application,
  });
});

module.exports = router;
