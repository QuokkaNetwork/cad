const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { CriminalRecords, Units, FiveMFineJobs, Settings } = require('../db/sqlite');
const { audit } = require('../utils/audit');

const router = express.Router();

// List records (with optional citizen_id filter)
router.get('/', requireAuth, (req, res) => {
  const { citizen_id, limit, offset } = req.query;
  if (citizen_id) {
    const records = CriminalRecords.findByCitizenId(citizen_id);
    return res.json(records);
  }
  const records = CriminalRecords.list(
    parseInt(limit, 10) || 50,
    parseInt(offset, 10) || 0
  );
  res.json(records);
});

// Get a single record
router.get('/:id', requireAuth, (req, res) => {
  const record = CriminalRecords.findById(parseInt(req.params.id, 10));
  if (!record) return res.status(404).json({ error: 'Record not found' });
  res.json(record);
});

// Create a record
router.post('/', requireAuth, (req, res) => {
  const { citizen_id, type, title, description, fine_amount, department_id } = req.body;
  if (!citizen_id || !type || !title) {
    return res.status(400).json({ error: 'citizen_id, type, and title are required' });
  }
  if (!['charge', 'fine', 'warning'].includes(type)) {
    return res.status(400).json({ error: 'type must be charge, fine, or warning' });
  }

  // Auto-fill officer info from current unit
  const unit = Units.findByUserId(req.user.id);
  const officerName = req.user.steam_name;
  const officerCallsign = unit ? unit.callsign : '';

  const record = CriminalRecords.create({
    citizen_id,
    type,
    title,
    description: description || '',
    fine_amount: type === 'fine' ? (fine_amount || 0) : 0,
    officer_name: officerName,
    officer_callsign: officerCallsign,
    department_id: department_id || (unit ? unit.department_id : null),
  });

  const fivemFineEnabled = String(Settings.get('fivem_bridge_qbox_fines_enabled') || 'false').toLowerCase() === 'true';
  if (type === 'fine' && Number(fine_amount || 0) > 0 && fivemFineEnabled) {
    FiveMFineJobs.create({
      citizen_id,
      amount: Number(fine_amount || 0),
      reason: title,
      issued_by_user_id: req.user.id,
      source_record_id: record.id,
    });
  }

  audit(req.user.id, 'record_created', { recordId: record.id, citizen_id, type, title });
  res.status(201).json(record);
});

// Update a record
router.patch('/:id', requireAuth, (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  const record = CriminalRecords.findById(recordId);
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const { type, title, description, fine_amount } = req.body || {};
  const updates = {};

  if (type !== undefined) {
    if (!['charge', 'fine', 'warning'].includes(type)) {
      return res.status(400).json({ error: 'type must be charge, fine, or warning' });
    }
    updates.type = type;
  }

  if (title !== undefined) {
    const normalized = String(title || '').trim();
    if (!normalized) return res.status(400).json({ error: 'title is required' });
    updates.title = normalized;
  }

  if (description !== undefined) {
    updates.description = String(description || '');
  }

  const nextType = updates.type || record.type;
  if (fine_amount !== undefined) {
    const amount = Number(fine_amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'fine_amount must be a non-negative number' });
    }
    updates.fine_amount = nextType === 'fine' ? amount : 0;
  } else if (updates.type !== undefined && nextType !== 'fine') {
    updates.fine_amount = 0;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid update fields supplied' });
  }

  CriminalRecords.update(recordId, updates);
  const updated = CriminalRecords.findById(recordId);

  if (updated.type === 'fine' && Number(updated.fine_amount || 0) > 0) {
    if (updates.type !== undefined || updates.title !== undefined || updates.fine_amount !== undefined) {
      FiveMFineJobs.updatePendingBySourceRecordId(recordId, {
        amount: Number(updated.fine_amount || 0),
        reason: updated.title || '',
      });
    }
  } else {
    FiveMFineJobs.detachSourceRecord(recordId, 'Record updated to non-fine');
  }

  audit(req.user.id, 'record_updated', { recordId, updates });
  res.json(updated);
});

// Delete a record
router.delete('/:id', requireAuth, (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  const record = CriminalRecords.findById(recordId);
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const detachedJobs = FiveMFineJobs.detachSourceRecord(recordId, 'Record deleted');
  CriminalRecords.delete(recordId);

  audit(req.user.id, 'record_deleted', {
    recordId,
    citizen_id: record.citizen_id,
    type: record.type,
    title: record.title,
    detachedJobs,
  });
  res.json({ success: true });
});

module.exports = router;
