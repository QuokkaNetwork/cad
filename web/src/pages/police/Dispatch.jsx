import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import CallCard from '../../components/CallCard';
import UnitCard from '../../components/UnitCard';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';
import { getHighContrastBadgeStyle } from '../../utils/color';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';
import { formatDateTimeAU } from '../../utils/dateTime';

const UNIT_STATUSES = ['available', 'busy', 'enroute', 'on-scene', 'unavailable'];
const DISPATCH_MACROS = [
  'Shots fired, multiple callers.',
  'MVA with injuries, emergency services required.',
  'Domestic disturbance in progress.',
  'Suspicious person / vehicle reported.',
  'Caller disconnected, callback pending.',
];
const PURSUIT_OUTCOME_OPTIONS = [
  { value: 'arrest', label: 'Arrest / Custody' },
  { value: 'vehicle_stopped', label: 'Vehicle Stopped' },
  { value: 'suspect_fled', label: 'Suspect Fled On Foot' },
  { value: 'lost_visual', label: 'Lost Visual / Terminated' },
  { value: 'cancelled_supervisor', label: 'Cancelled By Supervisor' },
  { value: 'cancelled_safety', label: 'Cancelled For Safety' },
  { value: 'other', label: 'Other' },
];

function isEmergency000Call(call) {
  return String(call?.job_code || '').trim() === '000';
}

function isPursuitCall(call) {
  const hay = `${String(call?.title || '')} ${String(call?.description || '')} ${String(call?.job_code || '')}`.toLowerCase();
  return /\bpursuit\b|\bvehicle pursuit\b|\bpolice pursuit\b/.test(hay);
}

function parseSqliteUtc(value) {
  const text = String(value || '').trim();
  if (!text) return 0;
  const normalized = text.replace(' ', 'T');
  const withZone = normalized.endsWith('Z') ? normalized : `${normalized}Z`;
  const ts = Date.parse(withZone);
  return Number.isFinite(ts) ? ts : 0;
}

function normalizeUnitStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePursuitEnabled(value) {
  if (value === true) return true;
  const num = Number(value);
  if (Number.isFinite(num)) return num !== 0;
  const text = String(value || '').trim().toLowerCase();
  return ['true', 'yes', 'on'].includes(text);
}

function formatUnitStatusLabel(value) {
  if (value === 'on-scene') return 'On Scene';
  if (value === 'enroute') return 'En Route';
  if (value === 'unavailable') return 'Unavailable';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function parseCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function getCallPosition(call) {
  const x = parseCoordinate(call?.position_x);
  const y = parseCoordinate(call?.position_y);
  const z = parseCoordinate(call?.position_z);
  if (x === null || y === null) return null;
  return { x, y, z: z === null ? 0 : z };
}

function getDistanceMeters(a, b) {
  if (!a || !b) return null;
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function formatDistance(distanceMeters) {
  if (!Number.isFinite(distanceMeters)) return null;
  if (distanceMeters < 1000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(2)} km`;
}

function normalizeDepartmentIds(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(
      value
        .map(item => Number(item))
        .filter(item => Number.isInteger(item) && item > 0)
    ));
  }

  if (typeof value === 'string') {
    const text = String(value || '').trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) return [];
      return Array.from(new Set(
        parsed
          .map(item => Number(item))
          .filter(item => Number.isInteger(item) && item > 0)
      ));
    } catch {
      return [];
    }
  }

  return [];
}

function getUnitCallsignColor(unit) {
  return String(unit?.department_color || '#7dd3fc');
}

function parseEmergencyCallDescription(description) {
  const parts = String(description || '')
    .split('|')
    .map(part => part.trim())
    .filter(Boolean);

  const callerLine = parts.find(part => /^000 call from /i.test(part)) || '';
  const departmentLine = parts.find(part => /^Requested departments:/i.test(part)) || '';
  const linkLine = parts.find(part => /^Link:/i.test(part)) || '';
  const details = parts.filter(part => part !== callerLine && part !== departmentLine && part !== linkLine);

  return {
    callerLine,
    departmentLine,
    linkLine,
    details,
  };
}

function formatElapsedSinceSqlite(value, nowMs) {
  const ts = parseSqliteUtc(value);
  if (!Number.isFinite(ts) || ts <= 0 || !Number.isFinite(nowMs)) return '-';
  const diffMs = Math.max(0, nowMs - ts);
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatPursuitOutcomeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  const option = PURSUIT_OUTCOME_OPTIONS.find((entry) => entry.value === normalized);
  if (option) return option.label;
  return normalized
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Outcome';
}

function buildPursuitOutcomeForm(call) {
  const assignedUnits = Array.isArray(call?.assigned_units) ? call.assigned_units : [];
  const involvedUnitIds = assignedUnits
    .map((unit) => Number(unit?.id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const primaryUnitId = Number(call?.pursuit_primary_unit_id || 0);

  return {
    outcome_code: 'arrest',
    termination_location: String(call?.location || '').trim(),
    summary: '',
    primary_unit_id: Number.isInteger(primaryUnitId) && primaryUnitId > 0 ? primaryUnitId : (involvedUnitIds[0] || ''),
    involved_unit_ids: involvedUnitIds,
    disable_pursuit_mode: String(call?.status || '').trim().toLowerCase() !== 'closed',
  };
}

export default function Dispatch() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [calls, setCalls] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitPositionsById, setUnitPositionsById] = useState({});
  const [visibleDepartments, setVisibleDepartments] = useState([]);
  const [trafficStops, setTrafficStops] = useState([]);
  const [showNewCall, setShowNewCall] = useState(false);
  const [showTrafficStop, setShowTrafficStop] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [creatingTrafficStop, setCreatingTrafficStop] = useState(false);
  const [pursuitModeOnly, setPursuitModeOnly] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [form, setForm] = useState({
    title: '',
    priority: '3',
    location: '',
    description: '',
    job_code: '',
    department_id: '',
    requested_department_ids: [],
    pursuit_mode_enabled: false,
  });
  const [trafficStopForm, setTrafficStopForm] = useState({
    call_id: '',
    location: '',
    plate: '',
    reason: '',
    outcome: '',
    notes: '',
    link_selected_call: true,
  });
  const [pursuitOutcomes, setPursuitOutcomes] = useState([]);
  const [pursuitOutcomesLoading, setPursuitOutcomesLoading] = useState(false);
  const [showPursuitOutcomeForm, setShowPursuitOutcomeForm] = useState(false);
  const [pursuitOutcomeSaving, setPursuitOutcomeSaving] = useState(false);
  const [pursuitOutcomeForm, setPursuitOutcomeForm] = useState(() => buildPursuitOutcomeForm(null));
  const lastToneRef = useRef(0);
  const selectedCallIdRef = useRef(0);

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isLaw = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
  const canUseTrafficStopLogger = isDispatch || isLaw;

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    try {
      if (isDispatch) {
        const [callsData, dispatchData, unitMapData] = await Promise.all([
          api.get(`/api/calls?department_id=${deptId}&dispatch=true`),
          api.get('/api/units/dispatchable'),
          api.get(`/api/units/map?department_id=${deptId}&dispatch=true`).catch(() => []),
        ]);
        setCalls(callsData);
        setUnits(dispatchData.units || []);
        setVisibleDepartments(dispatchData.departments || []);
        setTrafficStops([]);
        const mapPositions = {};
        for (const unit of (Array.isArray(unitMapData) ? unitMapData : [])) {
          const unitId = Number(unit?.id);
          const x = parseCoordinate(unit?.position_x);
          const y = parseCoordinate(unit?.position_y);
          const z = parseCoordinate(unit?.position_z);
          if (!Number.isInteger(unitId) || x === null || y === null) continue;
          mapPositions[unitId] = { x, y, z: z === null ? 0 : z };
        }
        setUnitPositionsById(mapPositions);
      } else {
        const [callsData, unitsData, unitMapData, trafficStopData] = await Promise.all([
          api.get(`/api/calls?department_id=${deptId}`),
          api.get(`/api/units?department_id=${deptId}`),
          api.get(`/api/units/map?department_id=${deptId}`).catch(() => []),
          api.get(`/api/traffic-stops?department_id=${deptId}&limit=8`).catch(() => []),
        ]);
        setCalls(callsData);
        setUnits(unitsData);
        setVisibleDepartments([]);
        setTrafficStops(Array.isArray(trafficStopData) ? trafficStopData : []);
        const mapPositions = {};
        for (const unit of (Array.isArray(unitMapData) ? unitMapData : [])) {
          const unitId = Number(unit?.id);
          const x = parseCoordinate(unit?.position_x);
          const y = parseCoordinate(unit?.position_y);
          const z = parseCoordinate(unit?.position_z);
          if (!Number.isInteger(unitId) || x === null || y === null) continue;
          mapPositions[unitId] = { x, y, z: z === null ? 0 : z };
        }
        setUnitPositionsById(mapPositions);
      }
    } catch (err) {
      console.error('Failed to load dispatch data:', err);
      setUnitPositionsById({});
    }
  }, [deptId, isDispatch]);

  useEffect(() => { fetchData(); }, [fetchData, locationKey]);
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  function playPriorityTone(callPayload) {
    const now = Date.now();
    if (now - lastToneRef.current < 800) return;
    lastToneRef.current = now;

    const is000 = isEmergency000Call(callPayload);
    const priority = String(callPayload?.priority || '').trim();
    const src = is000 || priority === '1'
      ? '/sounds/000call.mp3'
      : '/sounds/cad-added-call.mp3';
    try {
      const audio = new Audio(src);
      audio.volume = is000 || priority === '1' ? 1 : 0.6;
      audio.play().catch(() => {});
    } catch {
      // Browser may block autoplay; ignore.
    }
  }

  // Real-time updates
  useEventSource({
    'call:create': (payload) => {
      if (payload?.call) {
        playPriorityTone(payload.call);
      }
      fetchData();
    },
    'call:update': () => fetchData(),
    'call:close': () => fetchData(),
    'call:assign': () => fetchData(),
    'call:unassign': () => fetchData(),
    'unit:online': () => fetchData(),
    'unit:offline': () => fetchData(),
    'unit:update': () => fetchData(),
    'trafficstop:create': () => fetchData(),
    'pursuit:update': () => fetchData(),
    'pursuit:outcome_create': (payload) => {
      fetchData();
      const selectedCallId = Number(selectedCall?.id || 0);
      const payloadCallId = Number(payload?.callId || payload?.call_id || payload?.call?.id || 0);
      if (selectedCallId > 0 && payloadCallId === selectedCallId) {
        fetchPursuitOutcomesForCall(selectedCallId, { silent: true });
      }
    },
  });

  // Group units by department for dispatch view
  const unitsByDept = useMemo(() => {
    if (!isDispatch) return null;
    const grouped = {};
    for (const unit of units) {
      const key = unit.department_id;
      if (!grouped[key]) {
        grouped[key] = {
          department_id: key,
          department_name: unit.department_name || 'Unknown',
          department_short_name: unit.department_short_name || '???',
          department_color: unit.department_color || '#64748b',
          units: [],
        };
      }
      grouped[key].units.push(unit);
    }
    return Object.values(grouped);
  }, [units, isDispatch]);

  const selectableDepartments = useMemo(
    () => (Array.isArray(visibleDepartments) ? visibleDepartments : []).filter(dept => !dept?.is_dispatch),
    [visibleDepartments]
  );

  const departmentsById = useMemo(() => {
    const map = new Map();
    for (const dept of selectableDepartments) {
      const id = Number(dept?.id);
      if (!Number.isInteger(id) || id <= 0) continue;
      map.set(id, {
        id,
        name: String(dept?.name || ''),
        short_name: String(dept?.short_name || ''),
        color: String(dept?.color || '#64748b'),
        layout_type: String(dept?.layout_type || ''),
      });
    }

    for (const unit of units) {
      const id = Number(unit?.department_id);
      if (!Number.isInteger(id) || id <= 0 || map.has(id)) continue;
      map.set(id, {
        id,
        name: String(unit?.department_name || ''),
        short_name: String(unit?.department_short_name || ''),
        color: String(unit?.department_color || '#64748b'),
        layout_type: String(unit?.department_layout_type || ''),
      });
    }

    return map;
  }, [selectableDepartments, units]);

  async function createCall(e) {
    e.preventDefault();
    try {
      const requestedDeptIds = normalizeDepartmentIds(form.requested_department_ids);
      let targetDeptId;
      if (isDispatch) {
        if (requestedDeptIds.length === 0) {
          alert('Select at least one department in Departments Required.');
          return;
        }
        targetDeptId = requestedDeptIds[0];
      } else {
        targetDeptId = deptId;
      }
      const payloadRequestedIds = requestedDeptIds.length > 0
        ? requestedDeptIds
        : (Number.isInteger(Number(targetDeptId)) ? [Number(targetDeptId)] : []);

      await api.post('/api/calls', {
        ...form,
        department_id: targetDeptId,
        requested_department_ids: payloadRequestedIds,
        pursuit_mode_enabled: !!form.pursuit_mode_enabled,
      });
      setShowNewCall(false);
      setForm({
        title: '',
        priority: '3',
        location: '',
        description: '',
        job_code: '',
        department_id: '',
        requested_department_ids: [],
        pursuit_mode_enabled: false,
      });
      fetchData();
    } catch (err) {
      alert('Failed to create call: ' + err.message);
    }
  }

  function appendDispatchMacro(text) {
    const snippet = String(text || '').trim();
    if (!snippet) return;
    setForm((current) => {
      const currentDescription = String(current.description || '').trim();
      const nextDescription = currentDescription ? `${currentDescription}\n${snippet}` : snippet;
      return { ...current, description: nextDescription };
    });
  }

  function openTrafficStopModal() {
    setTrafficStopForm({
      call_id: selectedCall?.id ? String(selectedCall.id) : '',
      location: String(selectedCall?.location || '').trim(),
      plate: '',
      reason: '',
      outcome: '',
      notes: '',
      link_selected_call: !!selectedCall?.id,
    });
    setShowTrafficStop(true);
  }

  async function createTrafficStop(e) {
    e.preventDefault();
    try {
      setCreatingTrafficStop(true);
      const linkSelected = !!trafficStopForm.link_selected_call && !!selectedCall?.id;
      const callId = linkSelected
        ? Number(selectedCall?.id)
        : Number(trafficStopForm.call_id || '');
      await api.post('/api/traffic-stops', {
        call_id: Number.isInteger(callId) && callId > 0 ? callId : null,
        location: trafficStopForm.location,
        plate: trafficStopForm.plate,
        reason: trafficStopForm.reason,
        outcome: trafficStopForm.outcome,
        notes: trafficStopForm.notes,
      });
      setShowTrafficStop(false);
      fetchData();
    } catch (err) {
      alert('Failed to create traffic stop: ' + err.message);
    } finally {
      setCreatingTrafficStop(false);
    }
  }

  async function updateCall(id, updates) {
    try {
      await api.patch(`/api/calls/${id}`, updates);
      fetchData();
      if (selectedCall?.id === id) {
        setSelectedCall(prev => ({ ...prev, ...updates }));
      }
    } catch (err) {
      alert('Failed to update call: ' + err.message);
    }
  }

  async function updateSelectedCallRequestedDepartments(nextRequestedDepartmentIds) {
    if (!selectedCall?.id) return;
    await updateCall(selectedCall.id, {
      requested_department_ids: normalizeDepartmentIds(nextRequestedDepartmentIds),
    });
  }

  async function updateSelectedCallPursuit(updates = {}) {
    if (!selectedCall?.id) return;
    try {
      const updated = await api.patch(`/api/calls/${selectedCall.id}/pursuit`, updates);
      setSelectedCall(updated);
      fetchData();
    } catch (err) {
      alert('Failed to update pursuit mode: ' + err.message);
    }
  }

  async function fetchPursuitOutcomesForCall(callId, { silent = false } = {}) {
    const parsedCallId = Number(callId || 0);
    if (!Number.isInteger(parsedCallId) || parsedCallId <= 0) {
      setPursuitOutcomes([]);
      return;
    }

    if (!silent) setPursuitOutcomesLoading(true);
    try {
      const data = await api.get(`/api/calls/${parsedCallId}/pursuit-outcomes?limit=20`);
      if (Number(selectedCallIdRef.current || 0) !== parsedCallId) return;
      setPursuitOutcomes(Array.isArray(data) ? data : []);
    } catch (err) {
      if (Number(selectedCallIdRef.current || 0) !== parsedCallId) return;
      console.error('Failed to load pursuit outcomes:', err);
      setPursuitOutcomes([]);
    } finally {
      if (!silent && Number(selectedCallIdRef.current || 0) === parsedCallId) {
        setPursuitOutcomesLoading(false);
      }
    }
  }

  function openPursuitOutcomeLogForm() {
    setPursuitOutcomeForm(buildPursuitOutcomeForm(selectedCall));
    setShowPursuitOutcomeForm(true);
  }

  function togglePursuitOutcomeInvolvedUnit(unitId) {
    const parsedUnitId = Number(unitId);
    if (!Number.isInteger(parsedUnitId) || parsedUnitId <= 0) return;
    setPursuitOutcomeForm((current) => {
      const currentIds = Array.isArray(current.involved_unit_ids) ? current.involved_unit_ids : [];
      const nextIds = currentIds.includes(parsedUnitId)
        ? currentIds.filter((id) => Number(id) !== parsedUnitId)
        : [...currentIds, parsedUnitId];
      const primaryUnitId = Number(current.primary_unit_id || 0);
      return {
        ...current,
        involved_unit_ids: nextIds,
        primary_unit_id: nextIds.includes(primaryUnitId) ? primaryUnitId : '',
      };
    });
  }

  async function createPursuitOutcome(e) {
    e.preventDefault();
    if (!selectedCall?.id) return;
    try {
      setPursuitOutcomeSaving(true);
      const payload = {
        outcome_code: pursuitOutcomeForm.outcome_code,
        termination_location: pursuitOutcomeForm.termination_location,
        summary: pursuitOutcomeForm.summary,
        primary_unit_id: Number(pursuitOutcomeForm.primary_unit_id || 0) || null,
        involved_unit_ids: Array.isArray(pursuitOutcomeForm.involved_unit_ids)
          ? pursuitOutcomeForm.involved_unit_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
          : [],
        disable_pursuit_mode: !!pursuitOutcomeForm.disable_pursuit_mode,
      };
      const result = await api.post(`/api/calls/${selectedCall.id}/pursuit-outcomes`, payload);

      if (result?.call && Number(result.call.id || 0) === Number(selectedCall.id)) {
        setSelectedCall(result.call);
      }
      if (result?.outcome) {
        setPursuitOutcomes((current) => [result.outcome, ...(Array.isArray(current) ? current : [])]);
      } else {
        await fetchPursuitOutcomesForCall(selectedCall.id, { silent: true });
      }
      setShowPursuitOutcomeForm(false);
      fetchData();
    } catch (err) {
      alert('Failed to log pursuit outcome: ' + err.message);
    } finally {
      setPursuitOutcomeSaving(false);
    }
  }

  async function assignUnit(callId, unitId) {
    try {
      await api.post(`/api/calls/${callId}/assign`, { unit_id: unitId });
      fetchData();
    } catch (err) {
      alert('Failed to assign unit: ' + err.message);
    }
  }

  async function unassignUnit(callId, unitId) {
    try {
      await api.post(`/api/calls/${callId}/unassign`, { unit_id: unitId });
      fetchData();
    } catch (err) {
      alert('Failed to unassign unit: ' + err.message);
    }
  }

  async function updateUnitStatus(unitId, status) {
    try {
      await api.patch(`/api/units/${unitId}/status`, { status });
      fetchData();
    } catch (err) {
      alert('Failed to update unit status: ' + err.message);
    }
  }

  const activeCalls = useMemo(() => (
    calls
      .filter(c => c.status !== 'closed')
      .slice()
      .sort((a, b) => {
        const aEmergency = isEmergency000Call(a) ? 1 : 0;
        const bEmergency = isEmergency000Call(b) ? 1 : 0;
        if (aEmergency !== bEmergency) return bEmergency - aEmergency;

        const aPriority = Number(a.priority || 3);
        const bPriority = Number(b.priority || 3);
        if (aPriority !== bPriority) return aPriority - bPriority;

        return parseSqliteUtc(b.created_at) - parseSqliteUtc(a.created_at);
      })
  ), [calls]);

  const incomingEmergencyCalls = useMemo(
    () => activeCalls.filter(call => isEmergency000Call(call)),
    [activeCalls]
  );

  const displayedCalls = useMemo(
    () => (
      pursuitModeOnly
        ? activeCalls.filter((call) => isPursuitCall(call) || normalizePursuitEnabled(call?.pursuit_mode_enabled))
        : activeCalls
    ),
    [activeCalls, pursuitModeOnly]
  );

  useEffect(() => {
    if (!selectedCall?.id) return;
    const refreshed = calls.find(c => c.id === selectedCall.id);
    if (!refreshed) {
      setSelectedCall(null);
      return;
    }
    if (refreshed !== selectedCall) {
      setSelectedCall(refreshed);
    }
  }, [calls, selectedCall?.id]);

  useEffect(() => {
    const callId = Number(selectedCall?.id || 0);
    selectedCallIdRef.current = callId;
    setShowPursuitOutcomeForm(false);
    setPursuitOutcomeForm(buildPursuitOutcomeForm(selectedCall));

    if (!callId) {
      setPursuitOutcomes([]);
      setPursuitOutcomesLoading(false);
      return;
    }

    fetchPursuitOutcomesForCall(callId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCall?.id]);

  const callPositionForSelectedCall = useMemo(() => getCallPosition(selectedCall), [selectedCall]);

  const requestedDepartmentIdsForSelectedCall = useMemo(() => {
    if (!selectedCall) return [];
    const normalized = normalizeDepartmentIds(selectedCall.requested_department_ids);
    if (normalized.length > 0) return normalized;
    const fallbackId = Number(selectedCall.department_id);
    return Number.isInteger(fallbackId) && fallbackId > 0 ? [fallbackId] : [];
  }, [selectedCall]);

  const emergencySummary = useMemo(
    () => parseEmergencyCallDescription(selectedCall?.description),
    [selectedCall?.description]
  );

  const pursuitEnabledForSelectedCall = useMemo(
    () => normalizePursuitEnabled(selectedCall?.pursuit_mode_enabled),
    [selectedCall?.pursuit_mode_enabled]
  );
  const pursuitPrimaryUnitIdForSelectedCall = useMemo(
    () => {
      const parsed = Number(selectedCall?.pursuit_primary_unit_id || 0);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
    },
    [selectedCall?.pursuit_primary_unit_id]
  );
  const hasPursuitOutcomeHistoryForSelectedCall = useMemo(
    () => Array.isArray(pursuitOutcomes) && pursuitOutcomes.length > 0,
    [pursuitOutcomes]
  );
  const selectedCallIsPolice = useMemo(() => {
    if (!selectedCall) return false;
    if (!isDispatch) return isLaw;
    const deptMeta = departmentsById.get(Number(selectedCall.department_id));
    return String(deptMeta?.layout_type || '').trim().toLowerCase() === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
  }, [selectedCall, isDispatch, isLaw, departmentsById]);

  const attachableUnitsForSelectedCall = useMemo(() => {
    if (!selectedCall) return [];
    const available = units
      .filter(u => !selectedCall.assigned_units?.find(au => au.id === u.id))
      .filter(u => normalizeUnitStatus(u.status) === 'available');

    const ranked = available.map((unit) => {
      const position = unitPositionsById[unit.id] || null;
      const distanceMeters = getDistanceMeters(callPositionForSelectedCall, position);
      return {
        unit,
        distanceMeters: Number.isFinite(distanceMeters) ? distanceMeters : null,
      };
    });

    ranked.sort((a, b) => {
      const aHasDistance = Number.isFinite(a.distanceMeters);
      const bHasDistance = Number.isFinite(b.distanceMeters);
      if (aHasDistance && bHasDistance) {
        if (a.distanceMeters !== b.distanceMeters) return a.distanceMeters - b.distanceMeters;
      } else if (aHasDistance !== bHasDistance) {
        return aHasDistance ? -1 : 1;
      }

      return String(a.unit.callsign || '').localeCompare(String(b.unit.callsign || ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });

    const requestedDepartmentSet = new Set(requestedDepartmentIdsForSelectedCall.map(id => Number(id)));
    const recommendedUnitIdByDepartment = new Map();
    for (const requestedDepartmentId of requestedDepartmentSet) {
      const candidates = ranked.filter(entry => Number(entry.unit.department_id) === Number(requestedDepartmentId));
      if (candidates.length === 0) continue;

      const closestWithDistance = candidates.find(entry => Number.isFinite(entry.distanceMeters)) || null;
      const selected = closestWithDistance || candidates[0];
      if (selected?.unit?.id) {
        recommendedUnitIdByDepartment.set(Number(requestedDepartmentId), Number(selected.unit.id));
      }
    }

    return ranked.map((entry) => ({
      ...entry,
      isDepartmentRecommendation: recommendedUnitIdByDepartment.get(Number(entry.unit.department_id)) === Number(entry.unit.id),
    }));
  }, [selectedCall, units, unitPositionsById, callPositionForSelectedCall, requestedDepartmentIdsForSelectedCall]);

  const departmentRecommendations = useMemo(() => {
    const requestedIds = requestedDepartmentIdsForSelectedCall;
    return requestedIds.map((departmentId) => {
      const deptMeta = departmentsById.get(Number(departmentId));
      const recommendedEntry = attachableUnitsForSelectedCall.find(entry => (
        entry.isDepartmentRecommendation && Number(entry.unit.department_id) === Number(departmentId)
      )) || null;

      return {
        department_id: Number(departmentId),
        department_name: deptMeta?.name || `Department #${departmentId}`,
        department_short_name: deptMeta?.short_name || '',
        department_color: deptMeta?.color || '#64748b',
        recommended_entry: recommendedEntry,
      };
    });
  }, [requestedDepartmentIdsForSelectedCall, departmentsById, attachableUnitsForSelectedCall]);

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">Dispatch Board</h2>
          {isDispatch && (
            <span className="text-xs px-2 py-1 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
              Multi-Department View
            </span>
          )}
          {isDispatch && incomingEmergencyCalls.length > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-red-500/15 text-red-300 border border-red-500/35 font-semibold">
              000 Calls: {incomingEmergencyCalls.length}
            </span>
          )}
          {pursuitModeOnly && (
            <span className="text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 font-semibold">
              Pursuit Mode
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPursuitModeOnly((prev) => !prev)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
              pursuitModeOnly
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                : 'bg-cad-surface text-cad-muted border-cad-border hover:text-cad-ink'
            }`}
          >
            {pursuitModeOnly ? 'Exit Pursuit Mode' : 'Pursuit Mode'}
          </button>
          {canUseTrafficStopLogger && (
            <button
              onClick={openTrafficStopModal}
              className="px-3 py-2 bg-blue-500/15 hover:bg-blue-500/20 text-blue-300 border border-blue-500/35 rounded-lg text-sm font-medium transition-colors"
            >
              + Traffic Stop
            </button>
          )}
          <button
            onClick={() => setShowNewCall(true)}
            className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Call
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Calls list */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {displayedCalls.length === 0 && (
            <div className="text-center py-12 text-cad-muted">
              {pursuitModeOnly ? 'No pursuit-tagged calls' : 'No active calls'}
            </div>
          )}
          {displayedCalls.map(call => (
            <CallCard
              key={call.id}
              call={call}
              onClick={() => setSelectedCall(call)}
              showDepartment={isDispatch}
              nowMs={nowMs}
            />
          ))}
        </div>

        {/* Units panel */}
        <div className="w-80 flex-shrink-0 overflow-y-auto">
          {isDispatch && unitsByDept ? (
            /* Dispatch mode: group by department */
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">
                All Units ({units.length})
              </h3>
              {unitsByDept.map(group => (
                <div key={group.department_id}>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${group.department_color}25`,
                        color: group.department_color,
                        border: `1px solid ${group.department_color}40`,
                      }}
                    >
                      {group.department_short_name}
                    </span>
                    <span className="text-xs text-cad-muted">
                      {group.units.length} unit{group.units.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {group.units.map(unit => (
                      <div key={unit.id} className="bg-cad-surface rounded border border-cad-border/60 px-2 py-1.5">
                        <UnitCard unit={unit} compact />
                        <div className="mt-1.5">
                          <select
                            value={normalizeUnitStatus(unit.status)}
                            onChange={e => updateUnitStatus(unit.id, e.target.value)}
                            className="w-full bg-cad-card border border-cad-border rounded px-2 py-1 text-[11px] text-cad-muted focus:outline-none focus:border-cad-accent"
                          >
                            {UNIT_STATUSES.map(status => (
                              <option key={status} value={status}>{formatUnitStatusLabel(status)}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {units.length === 0 && (
                <p className="text-sm text-cad-muted py-4 text-center">No units on duty</p>
              )}
            </div>
          ) : (
            /* Normal mode: flat list */
            <>
              <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
                On Duty ({units.length})
              </h3>
              <div className="space-y-2">
                {units.map(unit => (
                  <UnitCard key={unit.id} unit={unit} compact />
                ))}
                {units.length === 0 && (
                  <p className="text-sm text-cad-muted py-4 text-center">No units on duty</p>
                )}
              </div>
              {canUseTrafficStopLogger && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
                  Recent Traffic Stops ({trafficStops.length})
                </h3>
                <div className="space-y-2">
                  {trafficStops.map((stop) => (
                    <div key={stop.id} className="bg-cad-surface border border-cad-border/70 rounded px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-mono text-cad-accent-light">{stop.plate || 'NO-PLATE'}</p>
                        <span className="text-[10px] text-cad-muted">#{stop.id}</span>
                      </div>
                      <p className="text-xs text-cad-muted mt-1 line-clamp-2">{stop.reason || 'No reason recorded'}</p>
                      {stop.outcome ? <p className="text-[11px] text-cad-ink mt-1">Outcome: {stop.outcome}</p> : null}
                      <p className="text-[10px] text-cad-muted mt-1">{stop.unit_callsign ? `${stop.unit_callsign} | ` : ''}{stop.location || 'No location'}</p>
                    </div>
                  ))}
                  {trafficStops.length === 0 && (
                    <p className="text-sm text-cad-muted py-2 text-center">No traffic stops logged yet.</p>
                  )}
                </div>
              </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Call Modal */}
      <Modal open={showNewCall} onClose={() => setShowNewCall(false)} title="New Dispatch Call">
        <form onSubmit={createCall} className="space-y-3">
          {isDispatch && selectableDepartments.length > 0 && (
            <div>
              <label className="block text-sm text-cad-muted mb-2">Departments Required *</label>
              <div className="flex flex-wrap gap-2">
                {selectableDepartments.map((department) => {
                  const selected = normalizeDepartmentIds(form.requested_department_ids).includes(Number(department.id));
                  return (
                    <button
                      key={department.id}
                      type="button"
                      onClick={() => setForm((current) => {
                        const currentIds = normalizeDepartmentIds(current.requested_department_ids);
                        const targetId = Number(department.id);
                        const nextIds = currentIds.includes(targetId)
                          ? currentIds.filter(id => id !== targetId)
                          : [...currentIds, targetId];
                        return { ...current, requested_department_ids: nextIds };
                      })}
                      className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                        selected
                          ? 'bg-cad-accent/20 text-cad-accent-light border-cad-accent/40'
                          : 'bg-cad-surface text-cad-muted border-cad-border hover:text-cad-ink'
                      }`}
                    >
                      {department.short_name ? `${department.short_name} - ` : ''}{department.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-cad-muted mt-2">
                Select one or more operational departments. The first selected department becomes the call owner.
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm text-cad-muted mb-1">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder="e.g. Armed Robbery in Progress"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-cad-muted mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              >
                <option value="1">P1 - Urgent</option>
                <option value="2">P2 - High</option>
                <option value="3">P3 - Normal</option>
                <option value="4">P4 - Low</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-cad-muted mb-1">Job Code</label>
              <input
                type="text"
                value={form.job_code}
                onChange={e => setForm(f => ({ ...f, job_code: e.target.value }))}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="e.g. 121"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder="e.g. Vinewood Boulevard"
            />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
              placeholder="Additional details..."
            />
            <div className="mt-2">
              <p className="text-[11px] text-cad-muted mb-1">Quick Notes</p>
              <div className="flex flex-wrap gap-1.5">
                {DISPATCH_MACROS.map((macro) => (
                  <button
                    key={macro}
                    type="button"
                    onClick={() => appendDispatchMacro(macro)}
                    className="px-2 py-1 rounded border border-cad-border bg-cad-surface text-[11px] text-cad-muted hover:text-cad-ink"
                  >
                    {macro}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="rounded border border-cad-border bg-cad-surface px-3 py-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.pursuit_mode_enabled}
                onChange={e => setForm(f => ({ ...f, pursuit_mode_enabled: e.target.checked }))}
              />
              Create as pursuit call
            </label>
            <p className="text-[11px] text-cad-muted mt-1">
              Marks the call as a pursuit immediately. Set the primary unit after assignment.
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors"
            >
              Create Call
            </button>
            <button
              type="button"
              onClick={() => setShowNewCall(false)}
              className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showTrafficStop} onClose={() => setShowTrafficStop(false)} title="Traffic Stop Logger">
        <form onSubmit={createTrafficStop} className="space-y-3">
          {selectedCall?.id ? (
            <div className="rounded border border-cad-border bg-cad-surface p-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!trafficStopForm.link_selected_call}
                  onChange={(e) => setTrafficStopForm((current) => ({
                    ...current,
                    link_selected_call: e.target.checked,
                    call_id: e.target.checked ? String(selectedCall.id) : current.call_id,
                  }))}
                />
                Link to selected call #{selectedCall.id} ({selectedCall.title})
              </label>
            </div>
          ) : null}

          <div>
            <label className="block text-sm text-cad-muted mb-1">Location</label>
            <input
              type="text"
              value={trafficStopForm.location}
              onChange={(e) => setTrafficStopForm((current) => ({ ...current, location: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm"
              placeholder="Road / street / landmark"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-cad-muted mb-1">Plate</label>
              <input
                type="text"
                value={trafficStopForm.plate}
                onChange={(e) => setTrafficStopForm((current) => ({ ...current, plate: e.target.value.toUpperCase() }))}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono"
                placeholder="ABC123"
              />
            </div>
            <div>
              <label className="block text-sm text-cad-muted mb-1">Outcome</label>
              <input
                type="text"
                value={trafficStopForm.outcome}
                onChange={(e) => setTrafficStopForm((current) => ({ ...current, outcome: e.target.value }))}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm"
                placeholder="Warning / citation / arrest / clear"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-cad-muted mb-1">Reason *</label>
            <textarea
              required
              value={trafficStopForm.reason}
              onChange={(e) => setTrafficStopForm((current) => ({ ...current, reason: e.target.value }))}
              rows={2}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm resize-none"
              placeholder="Speeding, suspicious vehicle, traffic offence..."
            />
          </div>

          <div>
            <label className="block text-sm text-cad-muted mb-1">Notes</label>
            <textarea
              value={trafficStopForm.notes}
              onChange={(e) => setTrafficStopForm((current) => ({ ...current, notes: e.target.value }))}
              rows={3}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm resize-none"
              placeholder="Additional officer notes"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={creatingTrafficStop}
              className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {creatingTrafficStop ? 'Logging...' : 'Create Traffic Stop Record'}
            </button>
            <button
              type="button"
              onClick={() => setShowTrafficStop(false)}
              className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      {/* Call Detail Modal */}
      <Modal
        open={!!selectedCall}
        onClose={() => {
          setSelectedCall(null);
          setShowPursuitOutcomeForm(false);
        }}
        title={`Call #${selectedCall?.id}`}
        wide
      >
        {selectedCall && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {isDispatch && selectedCall.department_short_name && (
                  <span
                    className="text-xs px-2 py-0.5 rounded font-semibold"
                    style={{
                      backgroundColor: `${selectedCall.department_color || '#64748b'}22`,
                      color: selectedCall.department_color || '#cbd5e1',
                      border: `1px solid ${selectedCall.department_color || '#64748b'}44`,
                    }}
                  >
                    {selectedCall.department_short_name}
                  </span>
                )}
                <span className="text-xs text-cad-muted font-mono">
                  {selectedCall.job_code || 'No job code'}
                </span>
              </div>
              {isDispatch && selectedCall.status !== 'closed' && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-cad-muted">Priority:</label>
                  <select
                    value={selectedCall.priority}
                    onChange={e => updateCall(selectedCall.id, { priority: e.target.value })}
                    className="bg-cad-card border border-cad-border rounded px-2 py-1 text-xs focus:outline-none focus:border-cad-accent"
                  >
                    <option value="1">P1 - Urgent</option>
                    <option value="2">P2 - High</option>
                    <option value="3">P3 - Normal</option>
                    <option value="4">P4 - Low</option>
                  </select>
                </div>
              )}
              {!isDispatch && (
                <span className="text-xs text-cad-muted">
                  Priority {selectedCall.priority}
                </span>
              )}
            </div>

            {!isEmergency000Call(selectedCall) && (
              <div>
                <h3 className="font-medium text-lg break-words">{selectedCall.title}</h3>
                <p className="text-xs text-cad-muted mt-1">
                  Open: {formatElapsedSinceSqlite(selectedCall.created_at, nowMs)} | Last update: {formatElapsedSinceSqlite(selectedCall.updated_at || selectedCall.created_at, nowMs)}
                </p>
                {selectedCall.location && (
                  <p className="text-sm text-cad-muted mt-1 break-words">
                    Location: {selectedCall.location}
                    {selectedCall.postal && <span className="font-semibold text-cad-ink"> ({selectedCall.postal})</span>}
                  </p>
                )}
                {selectedCall.description && (
                  <p className="text-sm mt-2 break-words whitespace-pre-wrap">{selectedCall.description}</p>
                )}
              </div>
            )}

            {isEmergency000Call(selectedCall) && (
              <div className="rounded-xl border border-red-500/35 bg-gradient-to-r from-red-500/12 via-rose-500/8 to-transparent p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs uppercase tracking-wider text-red-300 font-semibold">000 Emergency Call</p>
                  <span className="text-[11px] px-2 py-0.5 rounded bg-red-500/20 text-red-200 border border-red-500/35">
                    Immediate Attention
                  </span>
                </div>
                {emergencySummary.callerLine && (
                  <p className="text-sm text-red-100 mt-2 break-words">{emergencySummary.callerLine}</p>
                )}
                {emergencySummary.departmentLine && (
                  <p className="text-xs text-red-200/85 mt-1 break-words">{emergencySummary.departmentLine}</p>
                )}
                {emergencySummary.details.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {emergencySummary.details.map((line, idx) => (
                      <p key={`${selectedCall.id}-000-${idx}`} className="text-sm text-red-100/90 break-words whitespace-pre-wrap">{line}</p>
                    ))}
                  </div>
                )}
                {emergencySummary.linkLine && (
                  <p className="text-[11px] text-red-200/80 mt-2 break-all">{emergencySummary.linkLine}</p>
                )}
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Departments Required</h4>
              {isDispatch && selectableDepartments.length > 0 ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {selectableDepartments.map((department) => {
                      const selected = requestedDepartmentIdsForSelectedCall.includes(Number(department.id));
                      return (
                        <button
                          key={`${selectedCall.id}-req-dept-${department.id}`}
                          type="button"
                          onClick={() => {
                            const currentIds = requestedDepartmentIdsForSelectedCall;
                            const targetId = Number(department.id);
                            const nextIds = currentIds.includes(targetId)
                              ? currentIds.filter(id => id !== targetId)
                              : [...currentIds, targetId];
                            updateSelectedCallRequestedDepartments(nextIds);
                          }}
                          className={`px-2.5 py-1 rounded border text-xs transition-colors ${
                            selected
                              ? 'bg-cad-accent/20 text-cad-accent-light border-cad-accent/40'
                              : 'bg-cad-surface text-cad-muted border-cad-border hover:text-cad-ink'
                          }`}
                        >
                          {department.short_name ? `${department.short_name} - ` : ''}{department.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-cad-muted">Select one or more required operational departments. Dispatch is excluded.</p>
                </div>
              ) : requestedDepartmentIdsForSelectedCall.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {requestedDepartmentIdsForSelectedCall.map((departmentId) => {
                    const deptMeta = departmentsById.get(Number(departmentId));
                    return (
                      <span
                        key={`${selectedCall.id}-requested-${departmentId}`}
                        className="px-2 py-0.5 rounded border border-cad-border text-xs text-cad-muted bg-cad-surface"
                      >
                        {deptMeta?.short_name
                          ? `${deptMeta.short_name} - ${deptMeta.name}`
                          : (deptMeta?.name || `Department #${departmentId}`)}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No department requirements set.</p>
              )}
            </div>

            {/* Status actions */}
            {selectedCall.status !== 'closed' && (
              <div className="flex gap-2">
                {canUseTrafficStopLogger && selectedCallIsPolice && (
                  <button
                    onClick={() => {
                      openTrafficStopModal();
                    }}
                    className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded hover:bg-blue-500/20 transition-colors"
                  >
                    Log Traffic Stop
                  </button>
                )}
                <button
                  onClick={() => updateCall(selectedCall.id, { status: 'closed' })}
                  className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                >
                  Close Call
                </button>
              </div>
            )}

            {/* Assigned units */}
            {(isPursuitCall(selectedCall) || pursuitEnabledForSelectedCall || hasPursuitOutcomeHistoryForSelectedCall || showPursuitOutcomeForm) && (
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Pursuit Tracking</h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (showPursuitOutcomeForm) {
                          setShowPursuitOutcomeForm(false);
                          return;
                        }
                        openPursuitOutcomeLogForm();
                      }}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        showPursuitOutcomeForm
                          ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
                          : 'bg-cad-surface text-cad-muted border-cad-border hover:text-cad-ink'
                      }`}
                    >
                      {showPursuitOutcomeForm ? 'Cancel Outcome Log' : 'Log Outcome'}
                    </button>
                    {selectedCall.status !== 'closed' && (
                      <button
                        type="button"
                        onClick={() => updateSelectedCallPursuit({
                          pursuit_mode_enabled: pursuitEnabledForSelectedCall ? 0 : 1,
                          pursuit_primary_unit_id: pursuitEnabledForSelectedCall
                            ? null
                            : (pursuitPrimaryUnitIdForSelectedCall || Number(selectedCall?.assigned_units?.[0]?.id || 0) || null),
                        })}
                        className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                          pursuitEnabledForSelectedCall
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/20'
                            : 'bg-cad-surface text-cad-muted border-cad-border hover:text-cad-ink'
                        }`}
                        disabled={!selectedCall.assigned_units?.length}
                      >
                        {pursuitEnabledForSelectedCall ? 'Disable GPS Follow' : 'Enable GPS Follow'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="bg-cad-surface border border-cad-border rounded px-3 py-2 mb-2">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                    <div>
                      <label className="block text-[11px] text-cad-muted uppercase tracking-wider mb-1">Primary Unit</label>
                      <select
                        value={pursuitPrimaryUnitIdForSelectedCall || ''}
                        onChange={(e) => updateSelectedCallPursuit({
                          pursuit_mode_enabled: 1,
                          pursuit_primary_unit_id: Number(e.target.value || 0) || null,
                        })}
                        disabled={selectedCall.status === 'closed' || !selectedCall.assigned_units?.length}
                        className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm"
                      >
                        <option value="">Select primary unit...</option>
                        {(selectedCall.assigned_units || []).map((unit) => (
                          <option key={`pursuit-primary-${unit.id}`} value={unit.id}>
                            {unit.callsign} {unit.user_name ? `- ${unit.user_name}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="text-xs text-cad-muted">
                      Followers receive a GPS route to the primary unit every 5 seconds.
                    </div>
                  </div>
                </div>
                {selectedCall.assigned_units?.length > 0 ? (
                  <div className="space-y-1">
                    {selectedCall.assigned_units.map((unit) => {
                      const position = unitPositionsById[unit.id] || null;
                      const isPrimary = Number(unit.id) === pursuitPrimaryUnitIdForSelectedCall;
                      const receivesPursuitRoute = pursuitEnabledForSelectedCall && !isPrimary;
                      return (
                        <div key={`pursuit-track-${unit.id}`} className="bg-cad-surface border border-emerald-500/20 rounded px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-sm">
                              <span className="font-mono" style={{ color: getUnitCallsignColor(unit) }}>{unit.callsign}</span>
                              <span className="text-cad-muted"> {unit.user_name || ''}</span>
                              {isPrimary && (
                                <span className="ml-2 text-[10px] px-2 py-0.5 rounded border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 font-semibold">
                                  PRIMARY
                                </span>
                              )}
                              {receivesPursuitRoute && (
                                <span className="ml-2 text-[10px] px-2 py-0.5 rounded border border-blue-500/35 bg-blue-500/10 text-blue-300">
                                  GPS Follows Primary
                                </span>
                              )}
                            </div>
                            <StatusBadge status={unit.status} />
                          </div>
                          <p className="text-[11px] text-cad-muted mt-1">
                            {position
                              ? `Live position: X ${position.x.toFixed(1)} | Y ${position.y.toFixed(1)}`
                              : 'Live position unavailable'}
                          </p>
                          {pursuitEnabledForSelectedCall && receivesPursuitRoute ? (
                            <p className="text-[11px] text-blue-300/90 mt-1">
                              Route target updates every 5s while the primary remains online.
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-cad-muted">No units assigned to this pursuit yet.</p>
                )}

                {showPursuitOutcomeForm && (
                  <form onSubmit={createPursuitOutcome} className="mt-3 bg-cad-surface border border-amber-500/20 rounded px-3 py-3 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-xs font-semibold text-cad-muted uppercase tracking-wider">Pursuit Outcome Log</h5>
                      <span className="text-[11px] text-cad-muted">
                        Captures a call-linked unit snapshot at time of logging
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-cad-muted uppercase tracking-wider mb-1">Outcome</label>
                        <select
                          value={pursuitOutcomeForm.outcome_code}
                          onChange={(e) => setPursuitOutcomeForm((current) => ({ ...current, outcome_code: e.target.value }))}
                          className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm"
                        >
                          {PURSUIT_OUTCOME_OPTIONS.map((option) => (
                            <option key={`${selectedCall.id}-po-${option.value}`} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-cad-muted uppercase tracking-wider mb-1">Termination Location</label>
                        <input
                          type="text"
                          value={pursuitOutcomeForm.termination_location}
                          onChange={(e) => setPursuitOutcomeForm((current) => ({ ...current, termination_location: e.target.value }))}
                          placeholder="Where the pursuit ended / was terminated"
                          className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-cad-muted uppercase tracking-wider mb-1">Summary</label>
                      <textarea
                        value={pursuitOutcomeForm.summary}
                        onChange={(e) => setPursuitOutcomeForm((current) => ({ ...current, summary: e.target.value }))}
                        rows={3}
                        placeholder="Short pursuit summary, disposition, vehicle stop details, custody status, etc."
                        className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                      <div>
                        <label className="block text-[11px] text-cad-muted uppercase tracking-wider mb-1">Primary Unit (log record)</label>
                        <select
                          value={pursuitOutcomeForm.primary_unit_id || ''}
                          onChange={(e) => setPursuitOutcomeForm((current) => ({ ...current, primary_unit_id: Number(e.target.value || 0) || '' }))}
                          className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm"
                        >
                          <option value="">No primary unit recorded</option>
                          {(selectedCall.assigned_units || []).map((unit) => (
                            <option key={`${selectedCall.id}-po-primary-${unit.id}`} value={unit.id}>
                              {unit.callsign} {unit.user_name ? `- ${unit.user_name}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-cad-muted self-end mb-1">
                        <input
                          type="checkbox"
                          checked={!!pursuitOutcomeForm.disable_pursuit_mode}
                          onChange={(e) => setPursuitOutcomeForm((current) => ({ ...current, disable_pursuit_mode: e.target.checked }))}
                        />
                        Disable pursuit GPS follow after save
                      </label>
                    </div>

                    <div>
                      <label className="block text-[11px] text-cad-muted uppercase tracking-wider mb-1">Units Involved</label>
                      {selectedCall.assigned_units?.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {selectedCall.assigned_units.map((unit) => {
                            const checked = Array.isArray(pursuitOutcomeForm.involved_unit_ids)
                              && pursuitOutcomeForm.involved_unit_ids.includes(Number(unit.id));
                            return (
                              <label
                                key={`${selectedCall.id}-po-unit-${unit.id}`}
                                className={`flex items-center justify-between gap-2 px-3 py-2 rounded border cursor-pointer ${
                                  checked
                                    ? 'border-amber-500/35 bg-amber-500/10'
                                    : 'border-cad-border bg-cad-card'
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="font-mono text-sm" style={{ color: getUnitCallsignColor(unit) }}>{unit.callsign}</span>
                                  <span className="text-xs text-cad-muted ml-2 truncate">{unit.user_name || ''}</span>
                                </span>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePursuitOutcomeInvolvedUnit(unit.id)}
                                />
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-cad-muted">No assigned units currently attached. You can still save an outcome with no unit snapshot.</p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowPursuitOutcomeForm(false)}
                        className="px-3 py-2 border border-cad-border rounded text-sm text-cad-muted hover:text-cad-ink"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={pursuitOutcomeSaving}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-medium disabled:opacity-50"
                      >
                        {pursuitOutcomeSaving ? 'Saving...' : 'Save Pursuit Outcome'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="mt-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h5 className="text-xs font-semibold text-cad-muted uppercase tracking-wider">Pursuit Outcome History</h5>
                    <button
                      type="button"
                      onClick={() => fetchPursuitOutcomesForCall(selectedCall.id)}
                      className="px-2 py-1 text-[11px] rounded border border-cad-border text-cad-muted hover:text-cad-ink"
                    >
                      Refresh
                    </button>
                  </div>
                  {pursuitOutcomesLoading ? (
                    <p className="text-sm text-cad-muted">Loading pursuit outcomes...</p>
                  ) : pursuitOutcomes.length === 0 ? (
                    <p className="text-sm text-cad-muted">No pursuit outcomes logged for this call yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {pursuitOutcomes.map((outcome) => (
                        <div key={`pursuit-outcome-${outcome.id}`} className="bg-cad-surface border border-amber-500/20 rounded px-3 py-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 font-medium">
                                  {formatPursuitOutcomeLabel(outcome.outcome_code)}
                                </span>
                                {outcome.primary_unit_id ? (
                                  <span className="text-[11px] text-cad-muted">
                                    Primary: <span className="text-cad-ink">#{outcome.primary_unit_id}</span>
                                  </span>
                                ) : null}
                                <span className="text-[11px] text-cad-muted">Log #{outcome.id}</span>
                              </div>
                              {outcome.termination_location ? (
                                <p className="text-sm text-cad-muted mt-1 break-words">
                                  End location: <span className="text-cad-ink">{outcome.termination_location}</span>
                                </p>
                              ) : null}
                              {outcome.summary ? (
                                <p className="text-sm mt-2 whitespace-pre-wrap break-words">{outcome.summary}</p>
                              ) : null}
                              {Array.isArray(outcome.involved_units) && outcome.involved_units.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {outcome.involved_units.map((unit) => (
                                    <span
                                      key={`po-${outcome.id}-unit-${unit.id}`}
                                      className="px-2 py-0.5 rounded border border-cad-border text-[11px] text-cad-muted bg-cad-card"
                                      title={unit.user_name || ''}
                                    >
                                      {unit.department_short_name ? `${unit.department_short_name} ` : ''}{unit.callsign || `Unit #${unit.id}`}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] text-cad-muted mt-2">No unit snapshot recorded.</p>
                              )}
                            </div>
                            <div className="text-right text-[11px] text-cad-muted whitespace-nowrap">
                              <p>{formatDateTimeAU(outcome.created_at ? `${outcome.created_at}Z` : '', '-')}</p>
                              {outcome.creator_name ? <p className="mt-1">{outcome.creator_name}</p> : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Assigned Units</h4>
              {selectedCall.assigned_units?.length > 0 ? (
                <div className="space-y-1">
                  {selectedCall.assigned_units.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-cad-surface rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono" style={{ color: getUnitCallsignColor(u) }}>{u.callsign}</span>
                        {isDispatch && u.department_short_name && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide"
                            style={getHighContrastBadgeStyle(u.department_color, '#64748b')}
                          >
                            {u.department_short_name}
                          </span>
                        )}
                        {u.sub_department_short_name && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide"
                            style={getHighContrastBadgeStyle(u.sub_department_color || u.department_color, '#64748b')}
                          >
                            {u.sub_department_short_name}
                          </span>
                        )}
                        <span className="text-sm text-cad-muted">{u.user_name}</span>
                        {isDispatch ? (
                          <select
                            value={normalizeUnitStatus(u.status)}
                            onChange={e => updateUnitStatus(u.id, e.target.value)}
                            className="bg-cad-card border border-cad-border rounded px-2 py-1 text-[11px] text-cad-muted focus:outline-none focus:border-cad-accent"
                          >
                            {UNIT_STATUSES.map(status => (
                              <option key={status} value={status}>{formatUnitStatusLabel(status)}</option>
                            ))}
                          </select>
                        ) : (
                          <StatusBadge status={u.status} />
                        )}
                      </div>
                      <button
                        onClick={() => unassignUnit(selectedCall.id, u.id)}
                        className="text-xs text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No units assigned</p>
              )}
            </div>

            {/* Assign unit */}
            {units.length > 0 && selectedCall.status !== 'closed' && (
              <div>
                <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Assign Unit</h4>
                {departmentRecommendations.length > 0 ? (
                  <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {departmentRecommendations.map((recommendation) => (
                      <div
                        key={`${selectedCall.id}-recommend-${recommendation.department_id}`}
                        className="px-3 py-2 rounded border border-emerald-500/35 bg-emerald-500/10"
                      >
                        <p className="text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
                          Closest Recommended - {recommendation.department_short_name || recommendation.department_name}
                        </p>
                        {recommendation.recommended_entry ? (
                          <p className="text-sm mt-1">
                            <span
                              className="font-mono"
                              style={{ color: getUnitCallsignColor(recommendation.recommended_entry.unit) }}
                            >
                              {recommendation.recommended_entry.unit.callsign}
                            </span>
                            <span className="text-cad-muted">
                              {' '} - {formatDistance(recommendation.recommended_entry.distanceMeters) || 'Distance unavailable'}
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-cad-muted mt-1">No available unit in this department.</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-cad-muted mb-3">
                    Closest-unit recommendation is unavailable until CAD has GPS location for this call and units.
                  </p>
                )}
                {attachableUnitsForSelectedCall.length === 0 ? (
                  <p className="text-sm text-cad-muted">No available units to attach.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {attachableUnitsForSelectedCall.map(entry => (
                      <button
                        key={entry.unit.id}
                        onClick={() => assignUnit(selectedCall.id, entry.unit.id)}
                        className={`text-left px-3 py-2 rounded border transition-colors ${
                          entry.isDepartmentRecommendation
                            ? 'bg-emerald-500/10 border-emerald-500/35 hover:bg-emerald-500/15'
                            : 'bg-cad-surface border-cad-border hover:bg-cad-card'
                        }`}
                        title={isDispatch
                          ? `${entry.unit.department_short_name || ''} - ${entry.unit.callsign}`
                          : entry.unit.callsign}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p
                              className="text-sm font-mono truncate"
                              style={{ color: getUnitCallsignColor(entry.unit) }}
                            >
                              {isDispatch && entry.unit.department_short_name
                                ? `${entry.unit.department_short_name} ${entry.unit.callsign}`
                                : entry.unit.callsign}
                            </p>
                            <p className="text-[11px] text-cad-muted truncate">
                              {entry.unit.user_name || 'Unknown unit'}
                            </p>
                          </div>
                          {entry.isDepartmentRecommendation && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/35 font-semibold uppercase tracking-wide whitespace-nowrap">
                              Dept Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-cad-muted mt-1">
                          {entry.distanceMeters === null ? 'Distance unavailable' : `Distance: ${formatDistance(entry.distanceMeters)}`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
