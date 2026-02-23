const express = require('express');
const { requireAuth, requireFiveMOnline } = require('../auth/middleware');
const { EvidenceItems, CriminalRecords, Warrants } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

const router = express.Router();

router.use(requireAuth, requireFiveMOnline);

function normalizeEntityType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'criminal_record' || normalized === 'warrant') return normalized;
  return '';
}

function canAccessDepartment(user, departmentId) {
  const deptId = Number(departmentId);
  if (!Number.isInteger(deptId) || deptId <= 0) return false;
  if (user?.is_admin) return true;
  return Array.isArray(user?.departments) && user.departments.some((d) => Number(d?.id) === deptId);
}

function resolveEntity(entityType, entityId) {
  const parsedId = Number(entityId);
  if (!Number.isInteger(parsedId) || parsedId <= 0) return null;
  if (entityType === 'criminal_record') {
    const record = CriminalRecords.findById(parsedId);
    if (!record) return null;
    return { entity: record, departmentId: record.department_id || null };
  }
  if (entityType === 'warrant') {
    const warrant = Warrants.findById(parsedId);
    if (!warrant) return null;
    return { entity: warrant, departmentId: warrant.department_id || null };
  }
  return null;
}

function normalizeReviewStatus(value, fallback = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['', 'needs_review', 'supervisor_review', 'reviewed', 'hold'].includes(normalized)) return normalized;
  return fallback;
}

router.get('/', requireAuth, (req, res) => {
  const rawEntityId = req.query?.entity_id;
  const hasEntityId = rawEntityId !== undefined && rawEntityId !== null && String(rawEntityId).trim() !== '';
  const departmentId = Number(req.query?.department_id);

  if (!hasEntityId && Number.isInteger(departmentId) && departmentId > 0) {
    if (!canAccessDepartment(req.user, departmentId)) {
      return res.status(403).json({ error: 'Department access denied' });
    }
    const rawEntityTypeFilter = String(req.query?.entity_type || '').trim();
    const entityTypeFilter = rawEntityTypeFilter ? normalizeEntityType(rawEntityTypeFilter) : '';
    if (rawEntityTypeFilter && !entityTypeFilter) {
      return res.status(400).json({ error: 'entity_type filter must be criminal_record or warrant' });
    }
    return res.json(EvidenceItems.listByDepartment(departmentId, {
      entityType: entityTypeFilter,
      query: req.query?.q,
      limit: req.query?.limit,
    }));
  }

  const entityType = normalizeEntityType(req.query?.entity_type);
  const entityId = Number(req.query?.entity_id);
  if (!entityType) return res.status(400).json({ error: 'entity_type must be criminal_record or warrant' });
  if (!Number.isInteger(entityId) || entityId <= 0) return res.status(400).json({ error: 'entity_id is required' });

  const resolved = resolveEntity(entityType, entityId);
  if (!resolved) return res.status(404).json({ error: 'Parent entity not found' });
  if (resolved.departmentId && !canAccessDepartment(req.user, resolved.departmentId)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  res.json(EvidenceItems.listByEntity(entityType, entityId));
});

router.post('/', requireAuth, (req, res) => {
  const entityType = normalizeEntityType(req.body?.entity_type);
  const entityId = Number(req.body?.entity_id);
  if (!entityType) return res.status(400).json({ error: 'entity_type must be criminal_record or warrant' });
  if (!Number.isInteger(entityId) || entityId <= 0) return res.status(400).json({ error: 'entity_id is required' });

  const resolved = resolveEntity(entityType, entityId);
  if (!resolved) return res.status(404).json({ error: 'Parent entity not found' });
  if (resolved.departmentId && !canAccessDepartment(req.user, resolved.departmentId)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const title = String(req.body?.title || '').trim();
  if (!title) return res.status(400).json({ error: 'title is required' });

  try {
    const evidence = EvidenceItems.create({
      entity_type: entityType,
      entity_id: entityId,
      department_id: resolved.departmentId || req.body?.department_id || null,
      case_number: req.body?.case_number,
      title,
      description: req.body?.description,
      photo_url: req.body?.photo_url,
      chain_status: req.body?.chain_status,
      metadata: req.body?.metadata,
      created_by_user_id: req.user.id,
    });

    audit(req.user.id, 'evidence_created', {
      evidence_id: evidence.id,
      entity_type: entityType,
      entity_id: entityId,
      case_number: evidence.case_number || '',
      title: evidence.title,
    });
    bus.emit('evidence:create', {
      departmentId: resolved.departmentId || null,
      evidence,
      entity_type: entityType,
      entity_id: entityId,
    });
    res.status(201).json(evidence);
  } catch (err) {
    res.status(400).json({ error: 'Failed to create evidence', message: err.message });
  }
});

router.patch('/:id', requireAuth, (req, res) => {
  const evidenceId = Number(req.params.id);
  if (!Number.isInteger(evidenceId) || evidenceId <= 0) return res.status(400).json({ error: 'Invalid evidence id' });

  const existing = EvidenceItems.findById(evidenceId);
  if (!existing) return res.status(404).json({ error: 'Evidence item not found' });
  if (existing.department_id && !canAccessDepartment(req.user, existing.department_id)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  const updates = {};
  for (const key of ['case_number', 'title', 'description', 'photo_url', 'chain_status']) {
    if (req.body?.[key] !== undefined) updates[key] = req.body[key];
  }

  if (req.body?.metadata !== undefined || req.body?.metadata_json !== undefined || req.body?.review_status !== undefined || req.body?.review_note !== undefined) {
    const sourceMetadata = req.body?.metadata !== undefined
      ? req.body.metadata
      : (req.body?.metadata_json !== undefined ? req.body.metadata_json : existing.metadata || {});
    const nextMetadata = (sourceMetadata && typeof sourceMetadata === 'object' && !Array.isArray(sourceMetadata))
      ? { ...sourceMetadata }
      : {};
    const review = (nextMetadata.review && typeof nextMetadata.review === 'object' && !Array.isArray(nextMetadata.review))
      ? { ...nextMetadata.review }
      : {};

    if (req.body?.review_status !== undefined) {
      const nextStatus = normalizeReviewStatus(req.body.review_status, String(review.status || '').trim().toLowerCase());
      review.status = nextStatus;
      if (nextStatus === 'reviewed') {
        review.reviewed_at = new Date().toISOString();
        review.reviewed_by_user_id = req.user.id;
      } else if (nextStatus) {
        review.flagged_at = review.flagged_at || new Date().toISOString();
        review.flagged_by_user_id = review.flagged_by_user_id || req.user.id;
      }
    }
    if (req.body?.review_note !== undefined) {
      review.note = String(req.body.review_note || '').trim().slice(0, 400);
      if (review.note && !review.flagged_at) {
        review.flagged_at = new Date().toISOString();
        review.flagged_by_user_id = req.user.id;
      }
    }
    if (Object.keys(review).length > 0) nextMetadata.review = review;
    updates.metadata = nextMetadata;
  }

  const updated = EvidenceItems.update(evidenceId, updates);
  audit(req.user.id, 'evidence_updated', {
    evidence_id: evidenceId,
    entity_type: existing.entity_type,
    entity_id: existing.entity_id,
    keys: Object.keys(updates),
  });
  bus.emit('evidence:update', {
    departmentId: updated?.department_id || existing.department_id || null,
    evidence: updated,
    entity_type: existing.entity_type,
    entity_id: existing.entity_id,
  });
  res.json(updated);
});

router.delete('/:id', requireAuth, (req, res) => {
  const evidenceId = Number(req.params.id);
  if (!Number.isInteger(evidenceId) || evidenceId <= 0) return res.status(400).json({ error: 'Invalid evidence id' });

  const evidence = EvidenceItems.findById(evidenceId);
  if (!evidence) return res.status(404).json({ error: 'Evidence item not found' });
  if (evidence.department_id && !canAccessDepartment(req.user, evidence.department_id)) {
    return res.status(403).json({ error: 'Department access denied' });
  }

  EvidenceItems.delete(evidenceId);
  audit(req.user.id, 'evidence_deleted', {
    evidence_id: evidenceId,
    entity_type: evidence.entity_type,
    entity_id: evidence.entity_id,
    title: evidence.title,
  });
  bus.emit('evidence:delete', {
    departmentId: evidence.department_id || null,
    evidence_id: evidenceId,
    entity_type: evidence.entity_type,
    entity_id: evidence.entity_id,
  });
  res.json({ success: true });
});

module.exports = router;
