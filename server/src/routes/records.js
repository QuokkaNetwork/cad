const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { CriminalRecords, Units, FiveMFineJobs, Settings, OffenceCatalog } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const { processPendingFineJobs } = require('../services/fivemFineProcessor');

const router = express.Router();
const VALID_RECORD_TYPES = new Set(['charge', 'fine', 'warning']);

function normalizeRecordType(value, fallback = 'charge') {
  const normalized = String(value || '').trim().toLowerCase();
  if (VALID_RECORD_TYPES.has(normalized)) return normalized;
  return fallback;
}

function normalizeOffenceSelections(input) {
  if (!Array.isArray(input)) {
    return { error: 'offence_items must be an array' };
  }
  const counts = new Map();
  for (const row of input) {
    const offenceId = Number(row?.offence_id ?? row?.id ?? row);
    if (!Number.isInteger(offenceId) || offenceId <= 0) continue;
    const rawQty = Number(row?.quantity);
    const qty = Number.isFinite(rawQty) ? Math.max(1, Math.min(20, Math.trunc(rawQty))) : 1;
    counts.set(offenceId, (counts.get(offenceId) || 0) + qty);
  }
  const selections = Array.from(counts.entries()).map(([offence_id, quantity]) => ({ offence_id, quantity }));
  return { selections };
}

function resolveOffenceItems(input) {
  const normalized = normalizeOffenceSelections(input);
  if (normalized.error) return normalized;
  if (!normalized.selections.length) {
    return { items: [], totalFine: 0 };
  }

  const ids = normalized.selections.map(s => s.offence_id);
  const offences = OffenceCatalog.findByIds(ids);
  const byId = new Map(offences.map(row => [row.id, row]));
  const missing = ids.filter(id => !byId.has(id));
  if (missing.length > 0) {
    return { error: `Unknown offence id(s): ${missing.join(', ')}` };
  }

  let totalFine = 0;
  const items = normalized.selections.map((selection) => {
    const offence = byId.get(selection.offence_id);
    const fineAmount = Math.max(0, Number(offence.fine_amount || 0));
    const lineTotal = fineAmount * selection.quantity;
    totalFine += lineTotal;
    return {
      offence_id: offence.id,
      category: offence.category,
      code: String(offence.code || ''),
      title: String(offence.title || ''),
      fine_amount: fineAmount,
      quantity: selection.quantity,
      line_total: lineTotal,
    };
  });

  return { items, totalFine };
}

function buildDefaultOffenceTitle(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Criminal Record';
  const top = items.slice(0, 3).map((item) => {
    const code = String(item.code || '').trim();
    const title = String(item.title || '').trim() || 'Offence';
    return code ? `${code} ${title}` : title;
  });
  const suffix = items.length > 3 ? ` +${items.length - 3} more` : '';
  return `${top.join('; ')}${suffix}`;
}

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

// Active offence catalog for law-enforcement records UI
router.get('/offence-catalog', requireAuth, (_req, res) => {
  res.json(OffenceCatalog.list(true));
});

// Get a single record
router.get('/:id', requireAuth, (req, res) => {
  const record = CriminalRecords.findById(parseInt(req.params.id, 10));
  if (!record) return res.status(404).json({ error: 'Record not found' });
  res.json(record);
});

// Create a record
router.post('/', requireAuth, (req, res) => {
  const { citizen_id, type, title, description, fine_amount, department_id, offence_items } = req.body || {};
  if (!citizen_id) {
    return res.status(400).json({ error: 'citizen_id is required' });
  }

  const offenceItemsProvided = offence_items !== undefined;
  let resolvedOffences = null;
  if (offenceItemsProvided) {
    resolvedOffences = resolveOffenceItems(offence_items);
    if (resolvedOffences.error) {
      return res.status(400).json({ error: resolvedOffences.error });
    }
  }

  const normalizedTitle = String(title || '').trim();
  if (type !== undefined && !VALID_RECORD_TYPES.has(String(type).trim().toLowerCase())) {
    return res.status(400).json({ error: 'type must be charge, fine, or warning' });
  }
  let recordType = normalizeRecordType(type, 'charge');
  let recordFineAmount = 0;
  let recordTitle = normalizedTitle;
  const recordDescription = String(description || '');
  let offenceItemsJson = '[]';

  if (resolvedOffences && resolvedOffences.items.length > 0) {
    recordType = resolvedOffences.totalFine > 0 ? 'fine' : 'charge';
    recordFineAmount = resolvedOffences.totalFine;
    recordTitle = normalizedTitle || buildDefaultOffenceTitle(resolvedOffences.items);
    offenceItemsJson = JSON.stringify(resolvedOffences.items);
  } else {
    if (!normalizedTitle) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!VALID_RECORD_TYPES.has(recordType)) {
      return res.status(400).json({ error: 'type must be charge, fine, or warning' });
    }
    if (recordType === 'fine') {
      const amount = Number(fine_amount || 0);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: 'fine_amount must be a non-negative number' });
      }
      recordFineAmount = amount;
    }
  }

  // Auto-fill officer info from current unit
  const unit = Units.findByUserId(req.user.id);
  const officerName = req.user.steam_name;
  const officerCallsign = unit ? unit.callsign : '';

  const record = CriminalRecords.create({
    citizen_id,
    type: recordType,
    title: recordTitle,
    description: recordDescription,
    fine_amount: recordFineAmount,
    offence_items_json: offenceItemsJson,
    officer_name: officerName,
    officer_callsign: officerCallsign,
    department_id: department_id || (unit ? unit.department_id : null),
  });

  const fivemFineEnabled = String(Settings.get('fivem_bridge_qbox_fines_enabled') || 'true').toLowerCase() === 'true';
  if (record.type === 'fine' && Number(record.fine_amount || 0) > 0 && fivemFineEnabled) {
    FiveMFineJobs.create({
      citizen_id,
      amount: Number(record.fine_amount || 0),
      reason: record.title,
      issued_by_user_id: req.user.id,
      source_record_id: record.id,
    });
    processPendingFineJobs().catch((err) => {
      console.error('[FineProcessor] Immediate record fine run failed:', err?.message || err);
    });
  }

  audit(req.user.id, 'record_created', {
    recordId: record.id,
    citizen_id,
    type: record.type,
    title: record.title,
    offence_items_count: resolvedOffences?.items?.length || 0,
  });
  res.status(201).json(record);
});

// Update a record
router.patch('/:id', requireAuth, (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  const record = CriminalRecords.findById(recordId);
  if (!record) return res.status(404).json({ error: 'Record not found' });

  const { type, title, description, fine_amount, offence_items } = req.body || {};
  const updates = {};
  const offenceItemsProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'offence_items');

  if (offenceItemsProvided) {
    const resolved = resolveOffenceItems(offence_items);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    updates.offence_items_json = JSON.stringify(resolved.items);
    if (resolved.items.length > 0) {
      updates.type = resolved.totalFine > 0 ? 'fine' : 'charge';
      updates.fine_amount = resolved.totalFine;
      if (title === undefined) {
        updates.title = buildDefaultOffenceTitle(resolved.items);
      }
    } else if (type === undefined && fine_amount === undefined) {
      updates.fine_amount = 0;
      if (record.type === 'fine') updates.type = 'charge';
    }
  }

  if (!offenceItemsProvided || (Array.isArray(offence_items) && offence_items.length === 0)) {
    if (type !== undefined) {
      const nextType = normalizeRecordType(type, '');
      if (!VALID_RECORD_TYPES.has(nextType)) {
        return res.status(400).json({ error: 'type must be charge, fine, or warning' });
      }
      updates.type = nextType;
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
  }

  if (title !== undefined) {
    const normalized = String(title || '').trim();
    if (!normalized) return res.status(400).json({ error: 'title is required' });
    updates.title = normalized;
  }

  if (description !== undefined) {
    updates.description = String(description || '');
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
