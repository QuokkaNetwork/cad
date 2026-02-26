import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { resolvePersonName } from './constants';

function buildDefaultDraft(person) {
  return {
    patient_name: resolvePersonName(person),
    triage_category: 'undetermined',
    chief_complaint: '',
    pain_score: 0,
    questionnaire: {
      mechanism: '',
      onset: '',
      conscious_state: 'alert',
      airway_state: 'clear',
      breathing_state: 'normal',
      circulation_state: 'stable',
      mobility_state: '',
      allergies: '',
      medications: '',
      treatment_given: '',
    },
    vitals: {
      pulse: '',
      blood_pressure: '',
      respiratory_rate: '',
      spo2: '',
      temperature: '',
      glucose: '',
    },
    body_marks: [],
    treatment_log: [],
    transport: {
      destination: '',
      eta_minutes: '',
      bed_availability: '',
      status: '',
      unit_callsign: '',
      notes: '',
    },
    mci_incident_key: '',
    mci_tag: '',
    notes: '',
  };
}

function toDraft(person, analysis) {
  const base = buildDefaultDraft(person);
  if (!analysis || typeof analysis !== 'object') return base;
  return {
    ...base,
    patient_name: String(analysis.patient_name || base.patient_name).trim(),
    triage_category: String(analysis.triage_category || base.triage_category).trim().toLowerCase(),
    chief_complaint: String(analysis.chief_complaint || '').trim(),
    pain_score: Number.isFinite(Number(analysis.pain_score)) ? Math.max(0, Math.min(10, Number(analysis.pain_score))) : 0,
    questionnaire: {
      ...base.questionnaire,
      ...(analysis.questionnaire && typeof analysis.questionnaire === 'object' ? analysis.questionnaire : {}),
    },
    vitals: {
      ...base.vitals,
      ...(analysis.vitals && typeof analysis.vitals === 'object' ? analysis.vitals : {}),
    },
    body_marks: Array.isArray(analysis.body_marks) ? analysis.body_marks : [],
    treatment_log: Array.isArray(analysis.treatment_log) ? analysis.treatment_log : [],
    transport: {
      ...base.transport,
      ...(analysis.transport && typeof analysis.transport === 'object' ? analysis.transport : {}),
      eta_minutes: (analysis.transport && analysis.transport.eta_minutes != null) ? String(analysis.transport.eta_minutes) : '',
      bed_availability: (analysis.transport && analysis.transport.bed_availability != null) ? String(analysis.transport.bed_availability) : '',
    },
    mci_incident_key: String(analysis.mci_incident_key || '').trim(),
    mci_tag: String(analysis.mci_tag || '').trim().toLowerCase(),
    notes: String(analysis.notes || '').trim(),
  };
}

export default function usePatientAnalysis(person, activeDepartmentId) {
  const citizenId = String(person?.citizenid || '').trim();

  const [history, setHistory] = useState([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
  const [draft, setDraft] = useState(() => buildDefaultDraft(person));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!citizenId) {
        setHistory([]);
        setSelectedAnalysisId(null);
        setDraft(buildDefaultDraft(person));
        return;
      }
      setLoading(true);
      setError('');
      setMessage('');
      try {
        const data = await api.get(`/api/medical/patients/${encodeURIComponent(citizenId)}/analyses`);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setHistory(list);
        if (list.length > 0) {
          setSelectedAnalysisId(list[0].id);
          setDraft(toDraft(person, list[0]));
        } else {
          setSelectedAnalysisId(null);
          setDraft(buildDefaultDraft(person));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Failed to load patient analysis history');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [citizenId, person]);

  function setDraftField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateQuestionnaire(key, value) {
    setDraft((current) => ({
      ...current,
      questionnaire: { ...(current.questionnaire || {}), [key]: value },
    }));
  }

  function updateVitals(key, value) {
    setDraft((current) => ({
      ...current,
      vitals: { ...(current.vitals || {}), [key]: value },
    }));
  }

  function updateTransport(key, value) {
    setDraft((current) => ({
      ...current,
      transport: { ...(current.transport || {}), [key]: value },
    }));
  }

  function addBodyMark(mark) {
    setDraft((current) => ({
      ...current,
      body_marks: [
        ...(Array.isArray(current.body_marks) ? current.body_marks : []),
        { id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, ...mark },
      ],
    }));
  }

  function removeBodyMark(id) {
    setDraft((current) => ({
      ...current,
      body_marks: (Array.isArray(current.body_marks) ? current.body_marks : []).filter(
        (mark) => String(mark?.id || '') !== String(id || '')
      ),
    }));
  }

  function clearAllBodyMarks() {
    setDraft((current) => ({ ...current, body_marks: [] }));
  }

  function addTreatmentLogItem() {
    setDraft((current) => ({
      ...current,
      treatment_log: [
        ...(Array.isArray(current.treatment_log) ? current.treatment_log : []),
        {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          category: 'treatment',
          name: '',
          dose: '',
          route: '',
          status: 'completed',
          timestamp: new Date().toISOString(),
          notes: '',
        },
      ],
    }));
  }

  function updateTreatmentLogItem(id, key, value) {
    setDraft((current) => ({
      ...current,
      treatment_log: (Array.isArray(current.treatment_log) ? current.treatment_log : []).map((entry) =>
        String(entry?.id || '') === String(id || '') ? { ...entry, [key]: value } : entry
      ),
    }));
  }

  function removeTreatmentLogItem(id) {
    setDraft((current) => ({
      ...current,
      treatment_log: (Array.isArray(current.treatment_log) ? current.treatment_log : []).filter(
        (entry) => String(entry?.id || '') !== String(id || '')
      ),
    }));
  }

  function loadHistoryItem(item) {
    setSelectedAnalysisId(item.id);
    setDraft(toDraft(person, item));
    setMessage('');
    setError('');
  }

  function startNewAnalysis() {
    setSelectedAnalysisId(null);
    setDraft(buildDefaultDraft(person));
    setMessage('New analysis draft started.');
    setError('');
  }

  function clearMessages() {
    setError('');
    setMessage('');
  }

  async function saveAnalysis() {
    if (!citizenId) return;
    setSaving(true);
    setError('');
    setMessage('');

    const payload = {
      patient_name: draft.patient_name || resolvePersonName(person),
      department_id: Number.isFinite(Number(activeDepartmentId)) ? Number(activeDepartmentId) : null,
      triage_category: draft.triage_category,
      chief_complaint: draft.chief_complaint,
      pain_score: draft.pain_score,
      questionnaire: draft.questionnaire,
      vitals: draft.vitals,
      body_marks: draft.body_marks,
      treatment_log: Array.isArray(draft.treatment_log) ? draft.treatment_log : [],
      transport: {
        ...(draft.transport || {}),
        eta_minutes: draft.transport?.eta_minutes === '' ? null : Number(draft.transport?.eta_minutes),
        bed_availability: draft.transport?.bed_availability === '' ? null : Number(draft.transport?.bed_availability),
      },
      mci_incident_key: draft.mci_incident_key,
      mci_tag: draft.mci_tag,
      notes: draft.notes,
    };

    try {
      let saved;
      if (selectedAnalysisId) {
        saved = await api.patch(`/api/medical/analyses/${selectedAnalysisId}`, payload);
      } else {
        saved = await api.post(`/api/medical/patients/${encodeURIComponent(citizenId)}/analyses`, payload);
      }

      const refreshed = await api.get(`/api/medical/patients/${encodeURIComponent(citizenId)}/analyses`);
      const list = Array.isArray(refreshed) ? refreshed : [];
      setHistory(list);
      setSelectedAnalysisId(saved?.id || null);
      setDraft(toDraft(person, saved));
      setMessage(selectedAnalysisId ? 'Patient analysis updated.' : 'Patient analysis saved.');
    } catch (err) {
      setError(err?.message || 'Failed to save patient analysis');
    } finally {
      setSaving(false);
    }
  }

  return {
    draft,
    history,
    selectedAnalysisId,
    loading,
    saving,
    error,
    message,
    setDraftField,
    updateQuestionnaire,
    updateVitals,
    updateTransport,
    addBodyMark,
    removeBodyMark,
    clearAllBodyMarks,
    addTreatmentLogItem,
    updateTreatmentLogItem,
    removeTreatmentLogItem,
    loadHistoryItem,
    startNewAnalysis,
    clearMessages,
    saveAnalysis,
  };
}
