const express = require('express');
const { requireAuth, requireFiveMOnline } = require('../auth/middleware');
const { Warrants } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const {
  notifyWarrantCommunityPoster,
  deleteWarrantCommunityPosterMessage,
} = require('../utils/warrantCommunityPoster');
const {
  shouldRequireSupervisorApproval,
  notifyWarrantApprovalPending,
} = require('../utils/warrantApprovalWebhook');

const router = express.Router();

router.use(requireAuth, requireFiveMOnline);

// List active warrants for a department
router.get('/', requireAuth, (req, res) => {
  const { department_id, status } = req.query;
  if (!department_id) return res.status(400).json({ error: 'department_id is required' });

  const deptId = parseInt(department_id, 10);
  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const warrants = Warrants.listByDepartment(deptId, status || 'active');
  res.json(warrants);
});

// Create a warrant
router.post('/', requireAuth, (req, res) => {
  const { department_id, citizen_id, subject_name, title, description, details } = req.body;
  const normalizedSubjectName = String(subject_name || '').trim();
  if (!department_id || !title || !normalizedSubjectName) {
    return res.status(400).json({ error: 'department_id, subject_name, and title are required' });
  }

  const deptId = parseInt(department_id, 10);
  const hasDept = req.user.is_admin || req.user.departments.some(d => d.id === deptId);
  if (!hasDept) return res.status(403).json({ error: 'Department access denied' });

  const approvalRequired = shouldRequireSupervisorApproval();
  const nowIso = new Date().toISOString();
  const warrant = Warrants.create({
    department_id: deptId,
    citizen_id: String(citizen_id || '').trim(),
    subject_name: normalizedSubjectName,
    title,
    description: description || '',
    details_json: details ? JSON.stringify(details) : '{}',
    created_by: req.user.id,
    approval_status: approvalRequired ? 'pending_review' : 'approved',
    approval_requested_at: nowIso,
    approval_decided_at: approvalRequired ? null : nowIso,
    approval_decided_by_user_id: approvalRequired ? null : req.user.id,
    approval_notes: '',
  });

  audit(req.user.id, approvalRequired ? 'warrant_created_pending_review' : 'warrant_created', {
    warrantId: warrant.id,
    citizenId: String(citizen_id || '').trim(),
    subjectName: normalizedSubjectName,
    title,
    approval_status: String(warrant.approval_status || '').trim(),
  });
  bus.emit('warrant:create', { departmentId: deptId, warrant });

  if (approvalRequired) {
    setImmediate(() => {
      notifyWarrantApprovalPending(warrant).catch((err) => {
        console.warn(`[Warrants] Approval webhook notification failed for warrant #${warrant.id}: ${err?.message || err}`);
      });
    });
  } else {
    // Community wanted-post notifications are best-effort only and should never block warrant creation.
    setImmediate(() => {
      notifyWarrantCommunityPoster(warrant).catch((err) => {
        console.warn(`[Warrants] Community wanted notification failed for warrant #${warrant.id}: ${err?.message || err}`);
      });
    });
  }

  res.status(201).json(warrant);
});

router.patch('/:id/approve', requireAuth, (req, res) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Supervisor approval requires admin access' });
  }

  const warrant = Warrants.findById(parseInt(req.params.id, 10));
  if (!warrant) return res.status(404).json({ error: 'Warrant not found' });

  if (String(warrant.status || '').trim().toLowerCase() !== 'active') {
    return res.status(400).json({ error: 'Only active warrants can be approved' });
  }

  const currentApproval = String(warrant.approval_status || 'approved').trim().toLowerCase() || 'approved';
  if (currentApproval === 'approved') {
    return res.json(warrant);
  }

  const updated = Warrants.updateApproval(warrant.id, {
    approval_status: 'approved',
    approval_decided_at: new Date().toISOString(),
    approval_decided_by_user_id: req.user.id,
    approval_notes: String(req.body?.approval_notes || '').trim(),
  });

  audit(req.user.id, 'warrant_approved', { warrantId: warrant.id });
  bus.emit('warrant:update', { departmentId: warrant.department_id, warrant: updated });

  setImmediate(() => {
    notifyWarrantCommunityPoster(updated).catch((err) => {
      console.warn(`[Warrants] Community wanted notification failed for approved warrant #${warrant.id}: ${err?.message || err}`);
    });
  });

  res.json(updated);
});

router.patch('/:id/reject', requireAuth, (req, res) => {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Supervisor rejection requires admin access' });
  }

  const warrant = Warrants.findById(parseInt(req.params.id, 10));
  if (!warrant) return res.status(404).json({ error: 'Warrant not found' });

  if (String(warrant.status || '').trim().toLowerCase() !== 'active') {
    return res.status(400).json({ error: 'Only active warrants can be rejected' });
  }

  const updated = Warrants.updateApproval(warrant.id, {
    approval_status: 'rejected',
    approval_decided_at: new Date().toISOString(),
    approval_decided_by_user_id: req.user.id,
    approval_notes: String(req.body?.approval_notes || '').trim(),
  });

  audit(req.user.id, 'warrant_rejected', { warrantId: warrant.id });
  bus.emit('warrant:update', { departmentId: warrant.department_id, warrant: updated });

  setImmediate(() => {
    deleteWarrantCommunityPosterMessage(warrant.id).catch((err) => {
      console.warn(`[Warrants] Failed to delete community wanted message for rejected warrant #${warrant.id}: ${err?.message || err}`);
    });
  });

  res.json(updated);
});

// Serve a warrant (mark as completed)
router.patch('/:id/serve', requireAuth, (req, res) => {
  const warrant = Warrants.findById(parseInt(req.params.id, 10));
  if (!warrant) return res.status(404).json({ error: 'Warrant not found' });
  if (String(warrant.approval_status || 'approved').trim().toLowerCase() !== 'approved') {
    return res.status(400).json({ error: 'Warrant must be approved before it can be marked served' });
  }

  Warrants.updateStatus(warrant.id, 'served');
  audit(req.user.id, 'warrant_served', { warrantId: warrant.id });
  bus.emit('warrant:serve', { departmentId: warrant.department_id, warrantId: warrant.id });

  setImmediate(() => {
    deleteWarrantCommunityPosterMessage(warrant.id).catch((err) => {
      console.warn(`[Warrants] Failed to delete community wanted message for warrant #${warrant.id} (served): ${err?.message || err}`);
    });
  });

  res.json({ success: true });
});

// Cancel a warrant
router.patch('/:id/cancel', requireAuth, (req, res) => {
  const warrant = Warrants.findById(parseInt(req.params.id, 10));
  if (!warrant) return res.status(404).json({ error: 'Warrant not found' });

  Warrants.updateStatus(warrant.id, 'cancelled');
  audit(req.user.id, 'warrant_cancelled', { warrantId: warrant.id });
  bus.emit('warrant:cancel', { departmentId: warrant.department_id, warrantId: warrant.id });

  setImmediate(() => {
    deleteWarrantCommunityPosterMessage(warrant.id).catch((err) => {
      console.warn(`[Warrants] Failed to delete community wanted message for warrant #${warrant.id} (cancelled): ${err?.message || err}`);
    });
  });

  res.json({ success: true });
});

module.exports = router;
