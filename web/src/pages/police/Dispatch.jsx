import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import CallCard from '../../components/CallCard';
import UnitCard from '../../components/UnitCard';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';

function normalizePostalToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function extractPostalToken(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';

  const trailing = raw.match(/\(([^)]+)\)\s*$/);
  if (trailing?.[1]) return trailing[1].trim();

  const direct = raw.match(/^\s*([a-zA-Z]?\d{3,6}[a-zA-Z]?)\s*$/);
  if (direct?.[1]) return direct[1].trim();

  const last = raw.match(/([a-zA-Z]?\d{3,6}[a-zA-Z]?)(?!.*[a-zA-Z]?\d{3,6}[a-zA-Z]?)/);
  if (last?.[1]) return last[1].trim();
  return '';
}

function getCallPostal(call) {
  return extractPostalToken(call?.postal || call?.location || '');
}

function getUnitPostal(unit) {
  return extractPostalToken(unit?.location || '');
}

function chooseClosestUnitByPostal(call, candidates = []) {
  const targetPostalRaw = getCallPostal(call);
  const targetPostal = normalizePostalToken(targetPostalRaw);
  if (!targetPostal || !Array.isArray(candidates) || candidates.length === 0) return null;

  const targetNum = Number(targetPostal);
  let best = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const unit of candidates) {
    const unitPostal = normalizePostalToken(getUnitPostal(unit));
    if (!unitPostal) continue;

    let score = Number.POSITIVE_INFINITY;
    const unitNum = Number(unitPostal);
    if (Number.isFinite(targetNum) && Number.isFinite(unitNum)) {
      score = Math.abs(unitNum - targetNum);
    } else if (unitPostal === targetPostal) {
      score = 0;
    } else {
      score = Number.POSITIVE_INFINITY;
    }

    if (score < bestScore) {
      bestScore = score;
      best = unit;
    }
  }
  return best;
}

export default function Dispatch() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [calls, setCalls] = useState([]);
  const [units, setUnits] = useState([]);
  const [visibleDepartments, setVisibleDepartments] = useState([]);
  const [showNewCall, setShowNewCall] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [dispatchCallId, setDispatchCallId] = useState('');
  const [form, setForm] = useState({ title: '', priority: '3', location: '', description: '', job_code: '', department_id: '' });

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    try {
      if (isDispatch) {
        const [callsData, dispatchData] = await Promise.all([
          api.get(`/api/calls?department_id=${deptId}&dispatch=true`),
          api.get('/api/units/dispatchable'),
        ]);
        setCalls(callsData);
        setUnits(dispatchData.units || []);
        setVisibleDepartments(dispatchData.departments || []);
      } else {
        const [callsData, unitsData] = await Promise.all([
          api.get(`/api/calls?department_id=${deptId}`),
          api.get(`/api/units?department_id=${deptId}`),
        ]);
        setCalls(callsData);
        setUnits(unitsData);
        setVisibleDepartments([]);
      }
    } catch (err) {
      console.error('Failed to load dispatch data:', err);
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

  async function createCall(e) {
    e.preventDefault();
    try {
      const targetDeptId = isDispatch && form.department_id
        ? parseInt(form.department_id, 10)
        : deptId;
      await api.post('/api/calls', { ...form, department_id: targetDeptId });
      setShowNewCall(false);
      setForm({ title: '', priority: '3', location: '', description: '', job_code: '', department_id: '' });
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

  const activeCalls = calls.filter(c => c.status !== 'closed');
  const dispatchSelectedCall = useMemo(() => {
    if (!isDispatch) return null;
    const selectedId = Number(dispatchCallId || 0);
    if (!selectedId) return activeCalls[0] || null;
    return activeCalls.find(c => c.id === selectedId) || activeCalls[0] || null;
  }, [isDispatch, dispatchCallId, activeCalls]);

  useEffect(() => {
    if (!isDispatch) return;
    if (activeCalls.length === 0) {
      if (dispatchCallId) setDispatchCallId('');
      return;
    }
    const selectedId = Number(dispatchCallId || 0);
    const stillExists = selectedId && activeCalls.some(c => c.id === selectedId);
    if (!stillExists) {
      setDispatchCallId(String(activeCalls[0].id));
    }
  }, [isDispatch, activeCalls, dispatchCallId]);

  const dispatchAssignableUnits = useMemo(() => {
    if (!dispatchSelectedCall) return [];
    const assignedIds = new Set((dispatchSelectedCall.assigned_units || []).map(u => u.id));
    const unassigned = units.filter(u => !assignedIds.has(u.id));
    const sameDepartment = unassigned.filter(u => u.department_id === dispatchSelectedCall.department_id);
    return sameDepartment.length > 0 ? sameDepartment : unassigned;
  }, [dispatchSelectedCall, units]);

  const suggestedDispatchUnit = useMemo(
    () => chooseClosestUnitByPostal(dispatchSelectedCall, dispatchAssignableUnits),
    [dispatchSelectedCall, dispatchAssignableUnits]
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
              onClick={() => {
                if (isDispatch) {
                  setDispatchCallId(String(call.id));
                } else {
                  setSelectedCall(call);
                }
              }}
              showDepartment={isDispatch}
            />
          ))}
        </div>

        {/* Units panel */}
        <div className="w-80 flex-shrink-0 overflow-y-auto">
          {isDispatch && (
            <div className="bg-cad-card border border-cad-border rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Dispatch Panel</h3>
                {dispatchSelectedCall && (
                  <button
                    onClick={() => setSelectedCall(dispatchSelectedCall)}
                    className="px-2 py-1 text-[11px] bg-cad-surface border border-cad-border rounded text-cad-muted hover:text-cad-ink"
                  >
                    Open Details
                  </button>
                )}
              </div>

              {activeCalls.length === 0 ? (
                <p className="text-xs text-cad-muted">No active calls to dispatch.</p>
              ) : (
                <>
                  <label className="block text-xs text-cad-muted mb-1">Selected Call</label>
                  <select
                    value={dispatchSelectedCall ? String(dispatchSelectedCall.id) : ''}
                    onChange={e => setDispatchCallId(e.target.value)}
                    className="w-full bg-cad-surface border border-cad-border rounded px-2 py-1.5 text-xs focus:outline-none focus:border-cad-accent"
                  >
                    {activeCalls.map(call => (
                      <option key={call.id} value={call.id}>
                        #{call.id} P{call.priority} {call.title}
                      </option>
                    ))}
                  </select>

                  {dispatchSelectedCall && (
                    <div className="mt-3 space-y-3">
                      <div className="text-xs text-cad-muted">
                        <p className="text-cad-ink font-medium">#{dispatchSelectedCall.id} {dispatchSelectedCall.title}</p>
                        <p className="truncate">Location: {dispatchSelectedCall.location || 'No location'}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={dispatchSelectedCall.status} />
                          {getCallPostal(dispatchSelectedCall) && (
                            <span className="font-mono text-[11px] text-cad-ink">Postal {getCallPostal(dispatchSelectedCall)}</span>
                          )}
                        </div>
                        {suggestedDispatchUnit ? (
                          <p className="mt-1">
                            Suggested nearest unit:{' '}
                            <span className="text-cad-accent-light font-mono">
                              {suggestedDispatchUnit.callsign}
                            </span>{' '}
                            ({getUnitPostal(suggestedDispatchUnit) || 'no postal'})
                          </p>
                        ) : (
                          <p className="mt-1">No postal-based recommendation available.</p>
                        )}
                      </div>

                      <div>
                        <p className="text-[11px] text-cad-muted uppercase tracking-wider mb-1">Attached Units</p>
                        {dispatchSelectedCall.assigned_units?.length > 0 ? (
                          <div className="space-y-1">
                            {dispatchSelectedCall.assigned_units.map(u => (
                              <div key={u.id} className="flex items-center justify-between bg-cad-surface rounded px-2 py-1">
                                <div className="min-w-0">
                                  <p className="text-xs font-mono text-cad-accent-light truncate">{u.callsign}</p>
                                  <p className="text-[11px] text-cad-muted truncate">{u.user_name}</p>
                                </div>
                                <button
                                  onClick={() => unassignUnit(dispatchSelectedCall.id, u.id)}
                                  className="text-[11px] text-red-300 hover:text-red-200"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-cad-muted">No units attached.</p>
                        )}
                      </div>

                      {dispatchSelectedCall.status !== 'closed' && (
                        <div>
                          <p className="text-[11px] text-cad-muted uppercase tracking-wider mb-1">Attach Unit</p>
                          {dispatchAssignableUnits.length === 0 ? (
                            <p className="text-xs text-cad-muted">No available units to attach.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {dispatchAssignableUnits.map(u => {
                                const recommended = suggestedDispatchUnit && suggestedDispatchUnit.id === u.id;
                                return (
                                  <button
                                    key={u.id}
                                    onClick={() => assignUnit(dispatchSelectedCall.id, u.id)}
                                    className={`text-[11px] px-2 py-1 rounded border font-mono transition-colors ${
                                      recommended
                                        ? 'bg-cad-accent/20 text-cad-accent-light border-cad-accent/40'
                                        : 'bg-cad-surface text-cad-muted border-cad-border hover:text-cad-ink'
                                    }`}
                                    title={`${u.callsign}${u.department_short_name ? ` | ${u.department_short_name}` : ''}${getUnitPostal(u) ? ` | Postal ${getUnitPostal(u)}` : ''}`}
                                  >
                                    {u.callsign}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

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
                      <UnitCard key={unit.id} unit={unit} compact />
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
                onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              >
                <option value="">Select department...</option>
                {visibleDepartments.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
                ))}
              </select>
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
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selectedCall.status} />
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
              <span className="text-xs text-cad-muted">
                Priority {selectedCall.priority} | {selectedCall.job_code || 'No job code'}
              </span>
            </div>

            <div>
              <h3 className="font-medium text-lg">{selectedCall.title}</h3>
              {selectedCall.location && (
                <p className="text-sm text-cad-muted mt-1">Location: {selectedCall.location}</p>
              )}
              {selectedCall.description && (
                <p className="text-sm mt-2">{selectedCall.description}</p>
              )}
            </div>

            {/* Status actions */}
            <div className="flex gap-2">
              {selectedCall.status !== 'active' && (
                <button
                  onClick={() => updateCall(selectedCall.id, { status: 'active' })}
                  className="px-3 py-1.5 text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/20 transition-colors"
                >
                  Mark Active
                </button>
              )}
              {selectedCall.status !== 'closed' && (
                <button
                  onClick={() => updateCall(selectedCall.id, { status: 'closed' })}
                  className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                >
                  Close Call
                </button>
              )}
            </div>

            {/* Assigned units */}
            <div>
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Assigned Units</h4>
              {selectedCall.assigned_units?.length > 0 ? (
                <div className="space-y-1">
                  {selectedCall.assigned_units.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-cad-surface rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-cad-accent-light">{u.callsign}</span>
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
                        <StatusBadge status={u.status} />
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
                <div className="flex flex-wrap gap-1">
                  {units
                    .filter(u => !selectedCall.assigned_units?.find(au => au.id === u.id))
                    .map(u => (
                      <button
                        key={u.id}
                        onClick={() => assignUnit(selectedCall.id, u.id)}
                        className="text-xs px-2 py-1 bg-cad-surface text-cad-muted hover:text-cad-ink hover:bg-cad-card rounded transition-colors font-mono"
                        title={isDispatch ? `${u.department_short_name || ''} - ${u.callsign}` : u.callsign}
                      >
                        {isDispatch && u.department_short_name && (
                          <span
                            className="inline-block mr-1 text-[10px] px-1 py-0 rounded"
                            style={{ color: u.department_color || '#cbd5e1' }}
                          >
                            {u.department_short_name}
                          </span>
                        )}
                        {u.callsign}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
