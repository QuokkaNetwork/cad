const express = require('express');
const { requireAuth } = require('../auth/middleware');
const {
  CriminalRecords,
  Units,
  FiveMFineJobs,
  FiveMJailJobs,
  FiveMPlayerLinks,
  Settings,
  OffenceCatalog,
} = require('../db/sqlite');
const { audit } = require('../utils/audit');
const { processPendingFineJobs } = require('../services/fivemFineProcessor');

const router = express.Router();
const VALID_RECORD_TYPES = new Set(['charge', 'fine', 'warning', 'arrest_report']);
const ACTIVE_LINK_MAX_AGE_MS = 5 * 60 * 1000;

function parseSqliteUtc(value) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  const base = text.replace(' ', 'T');
  const normalized = base.endsWith('Z') ? base : `${base}Z`;
  return Date.parse(normalized);
}

function isActiveFiveMLink(link) {
  const ts = parseSqliteUtc(link?.updated_at);
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) <= ACTIVE_LINK_MAX_AGE_MS;
}

function resolveOfficerDisplayName(user) {
  const fallback = String(user?.steam_name || '').trim() || 'Unknown Officer';
  if (!user) return fallback;

  const candidates = [];
  if (user.steam_id) {
    candidates.push(FiveMPlayerLinks.findBySteamId(user.steam_id));
  }
  if (user.discord_id) {
    candidates.push(FiveMPlayerLinks.findBySteamId(`discord:${user.discord_id}`));
  }
  if (user.preferred_citizen_id) {
    candidates.push(FiveMPlayerLinks.findByCitizenId(String(user.preferred_citizen_id).trim()));
  }

  for (const candidate of candidates) {
    if (!candidate || !isActiveFiveMLink(candidate)) continue;
    const name = String(candidate.player_name || '').trim();
    if (name) return name;
  }

  return fallback;
}

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
    return { items: [], totalFine: 0, totalJailMinutes: 0 };
  }

  const ids = normalized.selections.map(s => s.offence_id);
  const offences = OffenceCatalog.findByIds(ids);
  const byId = new Map(offences.map(row => [row.id, row]));
  const missing = ids.filter(id => !byId.has(id));
  if (missing.length > 0) {
    return { error: `Unknown offence id(s): ${missing.join(', ')}` };
  }

  let totalFine = 0;
  let totalJailMinutes = 0;
  const items = normalized.selections.map((selection) => {
    const offence = byId.get(selection.offence_id);
    const fineAmount = Math.max(0, Number(offence.fine_amount || 0));
    const lineTotal = fineAmount * selection.quantity;
    const jailMinutes = Math.max(0, Math.trunc(Number(offence.jail_minutes || 0)));
    const lineJailMinutes = jailMinutes * selection.quantity;
    totalFine += lineTotal;
    totalJailMinutes += lineJailMinutes;
    return {
      offence_id: offence.id,
      category: offence.category,
      code: String(offence.code || ''),
      title: String(offence.title || ''),
      fine_amount: fineAmount,
      jail_minutes: jailMinutes,
      quantity: selection.quantity,
      line_total: lineTotal,
      line_jail_minutes: lineJailMinutes,
    };
  });

  return { items, totalFine, totalJailMinutes };
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

function queueEnforcementForRecord(record, req) {
  if (!record || record.type === 'warning' || record.type === 'arrest_report') return;
  const citizenId = String(record.citizen_id || '').trim();
  if (!citizenId) return;

  const fivemFineEnabled = String(Settings.get('fivem_bridge_qbox_fines_enabled') || 'true').toLowerCase() === 'true';
  if (record.type === 'fine' && Number(record.fine_amount || 0) > 0 && fivemFineEnabled) {
    try {
      FiveMFineJobs.create({
        citizen_id: citizenId,
        amount: Number(record.fine_amount || 0),
        reason: record.title,
        issued_by_user_id: req.user.id,
        source_record_id: record.id,
      });
      processPendingFineJobs().catch((err) => {
        console.error('[FineProcessor] Immediate record fine run failed:', err?.message || err);
      });
    } catch (err) {
      console.error('[Records] Failed to queue fine job for record', record.id, ':', err?.message || err);
    }
  }

  if (Number(record.jail_minutes || 0) > 0) {
    try {
      FiveMJailJobs.create({
        citizen_id: citizenId,
        jail_minutes: Number(record.jail_minutes || 0),
        reason: record.title,
        issued_by_user_id: req.user.id,
        source_record_id: record.id,
      });
    } catch (err) {
      console.error('[Records] Failed to queue jail job for record', record.id, ':', err?.message || err);
    }
  }
}

// List records (with optional citizen_id filter)
router.get('/', requireAuth, (req, res) => {
  const { citizen_id, limit, offset, mode } = req.query;
  if (citizen_id) {
    const records = CriminalRecords.findByCitizenId(citizen_id, { mode: String(mode || 'all') });
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
  const { citizen_id, type, title, description, fine_amount, jail_minutes, department_id, offence_items } = req.body || {};
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
    return res.status(400).json({ error: 'type must be charge, fine, warning, or arrest_report' });
  }
  const requestedType = normalizeRecordType(type, 'charge');
  let recordType = requestedType;
  let recordFineAmount = 0;
  const rawJailMinutes = Number(jail_minutes ?? 0);
  if (jail_minutes !== undefined && (!Number.isFinite(rawJailMinutes) || rawJailMinutes < 0)) {
    return res.status(400).json({ error: 'jail_minutes must be a non-negative number' });
  }
  const manualJailMinutesInput = Number.isFinite(rawJailMinutes) ? Math.max(0, Math.trunc(rawJailMinutes)) : 0;
  let recordJailMinutes = manualJailMinutesInput;
  let recordTitle = normalizedTitle;
  const recordDescription = String(description || '');
  let offenceItemsJson = '[]';

  if (resolvedOffences && resolvedOffences.items.length > 0) {
    recordType = requestedType === 'arrest_report'
      ? 'arrest_report'
      : (resolvedOffences.totalFine > 0 ? 'fine' : 'charge');
    recordFineAmount = resolvedOffences.totalFine;
    recordJailMinutes = Math.max(0, Math.trunc(Number(resolvedOffences.totalJailMinutes || 0))) + manualJailMinutesInput;
    recordTitle = normalizedTitle || buildDefaultOffenceTitle(resolvedOffences.items);
    offenceItemsJson = JSON.stringify(resolvedOffences.items);
  } else {
    if (!normalizedTitle) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!VALID_RECORD_TYPES.has(recordType)) {
      return res.status(400).json({ error: 'type must be charge, fine, warning, or arrest_report' });
    }
    if (recordType === 'fine' || recordType === 'arrest_report') {
      const amount = Number(fine_amount || 0);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: 'fine_amount must be a non-negative number' });
      }
      if (recordType === 'fine') {
        recordFineAmount = amount;
      } else {
        recordFineAmount = amount;
      }
    }
  }

  if (recordType === 'warning' && recordJailMinutes > 0) {
    return res.status(400).json({ error: 'warning records cannot include jail_minutes' });
  }

  // Auto-fill officer info from current unit
  const unit = Units.findByUserId(req.user.id);
  const officerName = resolveOfficerDisplayName(req.user);
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
    jail_minutes: recordJailMinutes,
    workflow_status: recordType === 'arrest_report' ? 'pending' : 'finalized',
  });

  queueEnforcementForRecord(record, req);

  audit(req.user.id, 'record_created', {
    recordId: record.id,
    citizen_id,
    type: record.type,
    workflow_status: String(record.workflow_status || ''),
    title: record.title,
    jail_minutes: Number(record.jail_minutes || 0),
    offence_items_count: resolvedOffences?.items?.length || 0,
  });
  res.status(201).json(record);
});

// Update a record
router.patch('/:id', requireAuth, (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  const record = CriminalRecords.findById(recordId);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.type === 'arrest_report' && String(record.workflow_status || '').toLowerCase() === 'finalized') {
    return res.status(400).json({ error: 'Finalized arrest reports cannot be edited. Edit the finalized record instead.' });
  }

  const { type, title, description, fine_amount, jail_minutes, offence_items } = req.body || {};
  const updates = {};
  const offenceItemsProvided = Object.prototype.hasOwnProperty.call(req.body || {}, 'offence_items');

  if (offenceItemsProvided) {
    const resolved = resolveOffenceItems(offence_items);
    if (resolved.error) {
      return res.status(400).json({ error: resolved.error });
    }
    updates.offence_items_json = JSON.stringify(resolved.items);
    const preserveArrestReportType = String(record.type || '') === 'arrest_report'
      || String(type || '').trim().toLowerCase() === 'arrest_report';
    if (resolved.items.length > 0) {
      updates.type = preserveArrestReportType
        ? 'arrest_report'
        : (resolved.totalFine > 0 ? 'fine' : 'charge');
      updates.fine_amount = resolved.totalFine;
      const offenceJailMinutes = Math.max(0, Math.trunc(Number(resolved.totalJailMinutes || 0)));
      if (jail_minutes === undefined) {
        updates.jail_minutes = offenceJailMinutes;
      } else {
        const requestedMinutes = Number(jail_minutes);
        if (!Number.isFinite(requestedMinutes) || requestedMinutes < 0) {
          return res.status(400).json({ error: 'jail_minutes must be a non-negative number' });
        }
        updates.jail_minutes = offenceJailMinutes + Math.max(0, Math.trunc(requestedMinutes));
      }
      if (title === undefined) {
        updates.title = buildDefaultOffenceTitle(resolved.items);
      }
      if (preserveArrestReportType) {
        updates.workflow_status = 'pending';
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
        return res.status(400).json({ error: 'type must be charge, fine, warning, or arrest_report' });
      }
      updates.type = nextType;
    }

    const nextType = updates.type || record.type;
    if (fine_amount !== undefined) {
      const amount = Number(fine_amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return res.status(400).json({ error: 'fine_amount must be a non-negative number' });
      }
      updates.fine_amount = (nextType === 'fine' || nextType === 'arrest_report') ? amount : 0;
    } else if (updates.type !== undefined && nextType !== 'fine' && nextType !== 'arrest_report') {
      updates.fine_amount = 0;
    }

    if (jail_minutes !== undefined) {
      const minutes = Number(jail_minutes);
      if (!Number.isFinite(minutes) || minutes < 0) {
        return res.status(400).json({ error: 'jail_minutes must be a non-negative number' });
      }
      updates.jail_minutes = Math.max(0, Math.trunc(minutes));
    } else if (updates.type !== undefined && nextType === 'warning') {
      updates.jail_minutes = 0;
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

  const effectiveType = updates.type || record.type;
  const effectiveJailMinutes = updates.jail_minutes !== undefined
    ? Number(updates.jail_minutes || 0)
    : Number(record.jail_minutes || 0);
  if (effectiveType === 'warning' && effectiveJailMinutes > 0) {
    return res.status(400).json({ error: 'warning records cannot include jail_minutes' });
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid update fields supplied' });
  }

  CriminalRecords.update(recordId, updates);
  const updated = CriminalRecords.findById(recordId);

  if (updated.type === 'arrest_report') {
    FiveMFineJobs.detachSourceRecord(recordId, 'Arrest report pending finalization');
    FiveMJailJobs.detachSourceRecord(recordId, 'Arrest report pending finalization');
  } else if (updated.type === 'fine' && Number(updated.fine_amount || 0) > 0) {
    if (updates.type !== undefined || updates.title !== undefined || updates.fine_amount !== undefined) {
      FiveMFineJobs.updatePendingBySourceRecordId(recordId, {
        amount: Number(updated.fine_amount || 0),
        reason: updated.title || '',
      });
    }
  } else {
    FiveMFineJobs.detachSourceRecord(recordId, 'Record updated to non-fine');
  }

  if (updated.type !== 'warning' && updated.type !== 'arrest_report' && Number(updated.jail_minutes || 0) > 0) {
    FiveMJailJobs.upsertPendingBySourceRecordId(recordId, {
      citizen_id: updated.citizen_id,
      jail_minutes: Number(updated.jail_minutes || 0),
      reason: updated.title || '',
      issued_by_user_id: req.user.id,
    });
  } else {
    FiveMJailJobs.detachSourceRecord(recordId, 'Record jail sentence removed');
  }

  audit(req.user.id, 'record_updated', { recordId, updates });
  res.json(updated);
});

// Finalize an arrest report into an enforceable criminal record (queues fines/jail on finalization)
router.post('/:id/finalize-arrest-report', requireAuth, (req, res) => {
  const arrestReportId = parseInt(req.params.id, 10);
  const arrestReport = CriminalRecords.findById(arrestReportId);
  if (!arrestReport) return res.status(404).json({ error: 'Record not found' });
  if (String(arrestReport.type || '') !== 'arrest_report') {
    return res.status(400).json({ error: 'Record is not an arrest report' });
  }
  if (String(arrestReport.workflow_status || '').toLowerCase() === 'finalized' && Number(arrestReport.finalized_record_id || 0) > 0) {
    const existingFinal = CriminalRecords.findById(Number(arrestReport.finalized_record_id || 0));
    return res.json({ arrest_report: arrestReport, finalized_record: existingFinal || null, already_finalized: true });
  }

  const finalType = Number(arrestReport.fine_amount || 0) > 0 ? 'fine' : 'charge';
  const finalizedRecord = CriminalRecords.create({
    citizen_id: arrestReport.citizen_id,
    type: finalType,
    title: arrestReport.title,
    description: arrestReport.description,
    fine_amount: Number(arrestReport.fine_amount || 0),
    offence_items_json: String(arrestReport.offence_items_json || '[]'),
    officer_name: arrestReport.officer_name || '',
    officer_callsign: arrestReport.officer_callsign || '',
    department_id: arrestReport.department_id || null,
    jail_minutes: Number(arrestReport.jail_minutes || 0),
    workflow_status: 'finalized',
  });

  queueEnforcementForRecord(finalizedRecord, req);

  CriminalRecords.update(arrestReportId, {
    workflow_status: 'finalized',
    finalized_record_id: Number(finalizedRecord.id || 0),
    finalized_at: new Date().toISOString(),
    finalized_by_user_id: req.user.id,
  });
  const updatedArrestReport = CriminalRecords.findById(arrestReportId);

  audit(req.user.id, 'arrest_report_finalized', {
    arrest_report_id: arrestReportId,
    finalized_record_id: finalizedRecord.id,
    citizen_id: finalizedRecord.citizen_id,
    final_type: finalizedRecord.type,
    fine_amount: Number(finalizedRecord.fine_amount || 0),
    jail_minutes: Number(finalizedRecord.jail_minutes || 0),
  });

  res.json({
    arrest_report: updatedArrestReport,
    finalized_record: finalizedRecord,
  });
});

// Delete a record
router.delete('/:id', requireAuth, (req, res) => {
  const recordId = parseInt(req.params.id, 10);
  const record = CriminalRecords.findById(recordId);
  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.type === 'arrest_report' && String(record.workflow_status || '').toLowerCase() === 'finalized') {
    return res.status(400).json({ error: 'Finalized arrest reports cannot be deleted. Delete the finalized record if required.' });
  }

  const detachedFineJobs = FiveMFineJobs.detachSourceRecord(recordId, 'Record deleted');
  const detachedJailJobs = FiveMJailJobs.detachSourceRecord(recordId, 'Record deleted');
  CriminalRecords.delete(recordId);

  audit(req.user.id, 'record_deleted', {
    recordId,
    citizen_id: record.citizen_id,
    type: record.type,
    title: record.title,
    detachedFineJobs,
    detachedJailJobs,
  });
  res.json({ success: true });
});

module.exports = router;
