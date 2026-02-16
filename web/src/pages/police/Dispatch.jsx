import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import CallCard from '../../components/CallCard';
import UnitCard from '../../components/UnitCard';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';

const UNIT_STATUSES = ['available', 'busy', 'enroute', 'on-scene'];

function isEmergency000Call(call) {
  return String(call?.job_code || '').trim() === '000';
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

function formatUnitStatusLabel(value) {
  if (value === 'on-scene') return 'On Scene';
  if (value === 'enroute') return 'En Route';
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

export default function Dispatch() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [calls, setCalls] = useState([]);
  const [units, setUnits] = useState([]);
  const [unitPositionsById, setUnitPositionsById] = useState({});
  const [visibleDepartments, setVisibleDepartments] = useState([]);
  const [showNewCall, setShowNewCall] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [form, setForm] = useState({
    title: '',
    priority: '3',
    location: '',
    description: '',
    job_code: '',
    department_id: '',
    requested_department_ids: [],
  });

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;

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
        const [callsData, unitsData, unitMapData] = await Promise.all([
          api.get(`/api/calls?department_id=${deptId}`),
          api.get(`/api/units?department_id=${deptId}`),
          api.get(`/api/units/map?department_id=${deptId}`).catch(() => []),
        ]);
        setCalls(callsData);
        setUnits(unitsData);
        setVisibleDepartments([]);
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

  // Real-time updates
  useEventSource({
    'call:create': () => fetchData(),
    'call:update': () => fetchData(),
    'call:close': () => fetchData(),
    'call:assign': () => fetchData(),
    'call:unassign': () => fetchData(),
    'unit:online': () => fetchData(),
    'unit:offline': () => fetchData(),
    'unit:update': () => fetchData(),
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
      });
    }

    return map;
  }, [selectableDepartments, units]);

  async function createCall(e) {
    e.preventDefault();
    try {
      const targetDeptId = isDispatch && form.department_id
        ? parseInt(form.department_id, 10)
        : deptId;
      const requestedDeptIds = normalizeDepartmentIds(form.requested_department_ids);
      const payloadRequestedIds = requestedDeptIds.length > 0
        ? requestedDeptIds
        : (Number.isInteger(Number(targetDeptId)) ? [Number(targetDeptId)] : []);

      await api.post('/api/calls', {
        ...form,
        department_id: targetDeptId,
        requested_department_ids: payloadRequestedIds,
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
      });
      fetchData();
    } catch (err) {
      alert('Failed to create call: ' + err.message);
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
        </div>
        <button
          onClick={() => setShowNewCall(true)}
          className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Call
        </button>
      </div>

      {/* Main content */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Calls list */}
        <div className="flex-1 overflow-y-auto space-y-3">
          {activeCalls.length === 0 && (
            <div className="text-center py-12 text-cad-muted">
              No active calls
            </div>
          )}
          {activeCalls.map(call => (
            <CallCard
              key={call.id}
              call={call}
              onClick={() => setSelectedCall(call)}
              showDepartment={isDispatch}
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
            </>
          )}
        </div>
      </div>

      {/* New Call Modal */}
      <Modal open={showNewCall} onClose={() => setShowNewCall(false)} title="New Dispatch Call">
        <form onSubmit={createCall} className="space-y-3">
          {isDispatch && visibleDepartments.length > 0 && (
            <div>
              <label className="block text-sm text-cad-muted mb-1">Target Department *</label>
              <select
                required
                value={form.department_id}
                onChange={e => setForm((current) => {
                  const nextDeptId = String(e.target.value || '');
                  const normalizedRequested = normalizeDepartmentIds(current.requested_department_ids);
                  const nextRequested = normalizedRequested.length > 0
                    ? normalizedRequested
                    : (nextDeptId ? [Number(nextDeptId)] : []);
                  return {
                    ...current,
                    department_id: nextDeptId,
                    requested_department_ids: nextRequested,
                  };
                })}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              >
                <option value="">Select department...</option>
                {selectableDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
                ))}
              </select>
            </div>
          )}
          {isDispatch && selectableDepartments.length > 0 && (
            <div>
              <label className="block text-sm text-cad-muted mb-2">Departments Required</label>
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
              <p className="text-[11px] text-cad-muted mt-2">Select one or more operational departments. Dispatch is excluded.</p>
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

      {/* Call Detail Modal */}
      <Modal open={!!selectedCall} onClose={() => setSelectedCall(null)} title={`Call #${selectedCall?.id}`} wide>
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
                <button
                  onClick={() => updateCall(selectedCall.id, { status: 'closed' })}
                  className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                >
                  Close Call
                </button>
              </div>
            )}

            {/* Assigned units */}
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
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{
                              backgroundColor: `${u.department_color || '#64748b'}22`,
                              color: u.department_color || '#cbd5e1',
                              border: `1px solid ${u.department_color || '#64748b'}44`,
                            }}
                          >
                            {u.department_short_name}
                          </span>
                        )}
                        {u.sub_department_short_name && (
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                            style={{
                              backgroundColor: `${u.sub_department_color || '#64748b'}33`,
                              color: u.sub_department_color || '#cbd5e1',
                            }}
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
