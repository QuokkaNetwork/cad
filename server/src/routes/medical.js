const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { PatientAnalyses } = require('../db/sqlite');
const { audit } = require('../utils/audit');

const router = express.Router();

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

router.use(requireAuth, requireParamedicAccess);

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
