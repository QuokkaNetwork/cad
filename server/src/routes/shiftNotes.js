const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { ShiftNotes, Units } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();

function canAccessDepartment(user, departmentId) {
  const deptId = Number(departmentId);
  if (!Number.isInteger(deptId) || deptId <= 0) return false;
  if (user?.is_admin) return true;
  return Array.isArray(user?.departments) && user.departments.some((d) => Number(d?.id) === deptId);
}

router.get('/', requireAuth, (req, res) => {
  const departmentId = Number(req.query?.department_id);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res.status(400).json({ error: 'department_id is required' });
  }
  if (!canAccessDepartment(req.user, departmentId)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const mineOnly = String(req.query?.mine || '').trim().toLowerCase() === 'true';
  const limit = Number(req.query?.limit);
  const notes = ShiftNotes.listByDepartment(departmentId, {
    userId: mineOnly ? req.user.id : null,
    limit,
  });
  res.json(notes);
});

router.post('/', requireAuth, (req, res) => {
  const departmentId = Number(req.body?.department_id);
  if (!Number.isInteger(departmentId) || departmentId <= 0) {
    return res.status(400).json({ error: 'department_id is required' });
  }
  if (!canAccessDepartment(req.user, departmentId)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const note = String(req.body?.note || '').trim();
  if (!note) return res.status(400).json({ error: 'note is required' });

  const myUnit = Units.findByUserId(req.user.id);
  const unitId = (myUnit && Number(myUnit.department_id) === departmentId) ? myUnit.id : null;

  try {
    const created = ShiftNotes.create({
      department_id: departmentId,
      user_id: req.user.id,
      unit_id: unitId,
      note,
    });

    audit(req.user.id, 'shift_note_created', {
      shift_note_id: created.id,
      department_id: departmentId,
      unit_id: unitId,
    });
    bus.emit('shiftnote:create', { departmentId, note: created });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create shift note', message: err.message });
  }
});

module.exports = router;
