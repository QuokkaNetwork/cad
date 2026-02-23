const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { PatientAnalyses, Settings } = require('../db/sqlite');
const { audit } = require('../utils/audit');

const router = express.Router();
const HOSPITAL_STATUS_SETTINGS_KEY = 'hospital_status_board_json';

function hasParamedicAccess(user) {
  if (!user) return false;
  if (user.is_admin) return true;
  const departments = Array.isArray(user.departments) ? user.departments : [];
  return departments.some((dept) => String(dept?.layout_type || '').trim().toLowerCase() === 'paramedics');
}

function requireParamedicAccess(req, res, next) {
  if (!hasParamedicAccess(req.user)) {
    return res.status(403).json({ error: 'Paramedic access required' });
  }
  next();
}

function sanitizeHospitalBoardRows(value) {
  const source = Array.isArray(value) ? value : [];
  const out = [];
  const seen = new Set();
  for (const row of source) {
    if (!row || typeof row !== 'object') continue;
    const id = String(row.id || row.name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const name = String(row.name || '').trim();
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    const status = String(row.status || 'open').trim().toLowerCase();
    out.push({
      id,
      name: name.slice(0, 120),
      suburb: String(row.suburb || '').trim().slice(0, 80),
      status: ['open', 'capacity_pressure', 'diversion', 'closed'].includes(status) ? status : 'open',
      available_beds: Number.isFinite(Number(row.available_beds)) ? Math.max(0, Math.min(999, Math.trunc(Number(row.available_beds)))) : null,
      trauma: !!row.trauma,
      notes: String(row.notes || '').trim().slice(0, 200),
      updated_at: String(row.updated_at || '').trim() || new Date().toISOString(),
      updated_by_user_id: Number.isInteger(Number(row.updated_by_user_id)) && Number(row.updated_by_user_id) > 0 ? Number(row.updated_by_user_id) : null,
    });
  }
  return out;
}

function defaultHospitalBoardRows() {
  return sanitizeHospitalBoardRows([
    { id: 'pillbox', name: 'Pillbox Hill Medical Centre', suburb: 'Pillbox Hill', status: 'open', available_beds: 6, trauma: true },
    { id: 'mount-zonah', name: 'Mount Zonah Medical Centre', suburb: 'Rockford Hills', status: 'open', available_beds: 4, trauma: true },
    { id: 'st-fiacre', name: 'St Fiacre Hospital', suburb: 'El Burro Heights', status: 'capacity_pressure', available_beds: 2, trauma: false },
    { id: 'sandy-medical', name: 'Sandy Shores Medical Clinic', suburb: 'Sandy Shores', status: 'open', available_beds: 1, trauma: false },
  ]);
}

function getHospitalBoard() {
  const raw = Settings.get(HOSPITAL_STATUS_SETTINGS_KEY);
  if (!raw) return defaultHospitalBoardRows();
  try {
    const parsed = JSON.parse(raw);
    const rows = sanitizeHospitalBoardRows(parsed);
    return rows.length > 0 ? rows : defaultHospitalBoardRows();
  } catch {
    return defaultHospitalBoardRows();
  }
}

function saveHospitalBoard(rows) {
  const normalized = sanitizeHospitalBoardRows(rows);
  Settings.set(HOSPITAL_STATUS_SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

router.use(requireAuth, requireParamedicAccess);

router.get('/hospital-status', (req, res) => {
  res.json({
    rows: getHospitalBoard(),
    settings_key: HOSPITAL_STATUS_SETTINGS_KEY,
  });
});

router.put('/hospital-status', (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ error: 'rows array is required' });
  try {
    const normalized = saveHospitalBoard(rows);
    audit(req.user.id, 'hospital_status_board_updated', { count: normalized.length });
    res.json({ ok: true, rows: normalized });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update hospital status board', message: err.message });
  }
});

router.get('/patients/:citizenid/analyses', (req, res) => {
  const citizenId = String(req.params.citizenid || '').trim();
  if (!citizenId) return res.status(400).json({ error: 'citizenid is required' });

  try {
    const analyses = PatientAnalyses.listByCitizenId(citizenId, 40);
    res.json(analyses);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load patient analyses', message: err.message });
  }
});

router.get('/analyses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid analysis id' });

  try {
    const analysis = PatientAnalyses.findById(id);
    if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load analysis', message: err.message });
  }
});

router.post('/patients/:citizenid/analyses', (req, res) => {
  const citizenId = String(req.params.citizenid || '').trim();
  if (!citizenId) return res.status(400).json({ error: 'citizenid is required' });

  try {
    const created = PatientAnalyses.create({
      citizen_id: citizenId,
      patient_name: req.body?.patient_name,
      department_id: req.body?.department_id,
      triage_category: req.body?.triage_category,
      chief_complaint: req.body?.chief_complaint,
      pain_score: req.body?.pain_score,
      questionnaire: req.body?.questionnaire,
      vitals: req.body?.vitals,
      body_marks: req.body?.body_marks,
      treatment_log: req.body?.treatment_log,
      transport: req.body?.transport,
      mci_incident_key: req.body?.mci_incident_key,
      mci_tag: req.body?.mci_tag,
      notes: req.body?.notes,
      created_by_user_id: req.user.id,
      updated_by_user_id: req.user.id,
    });

    audit(req.user.id, 'patient_analysis_created', {
      analysis_id: created?.id || null,
      citizen_id: citizenId,
      triage_category: created?.triage_category || '',
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create patient analysis', message: err.message });
  }
});

router.patch('/analyses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid analysis id' });

  try {
    const existing = PatientAnalyses.findById(id);
    if (!existing) return res.status(404).json({ error: 'Analysis not found' });

    const updated = PatientAnalyses.update(id, {
      patient_name: req.body?.patient_name,
      department_id: req.body?.department_id,
      triage_category: req.body?.triage_category,
      chief_complaint: req.body?.chief_complaint,
      pain_score: req.body?.pain_score,
      questionnaire: req.body?.questionnaire,
      vitals: req.body?.vitals,
      body_marks: req.body?.body_marks,
      treatment_log: req.body?.treatment_log,
      transport: req.body?.transport,
      mci_incident_key: req.body?.mci_incident_key,
      mci_tag: req.body?.mci_tag,
      notes: req.body?.notes,
      updated_by_user_id: req.user.id,
    });

    audit(req.user.id, 'patient_analysis_updated', {
      analysis_id: updated?.id || id,
      citizen_id: existing?.citizen_id || '',
      triage_category: updated?.triage_category || '',
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update patient analysis', message: err.message });
  }
});

module.exports = router;
