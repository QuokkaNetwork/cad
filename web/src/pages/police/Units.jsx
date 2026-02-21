import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import UnitCard from '../../components/UnitCard';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';

function normalizeUnitStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export default function Units() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [units, setUnits] = useState([]);
  const [myUnit, setMyUnit] = useState(null);
  const [calls, setCalls] = useState([]);
  const [currentCall, setCurrentCall] = useState(null);
  const [selectedCall, setSelectedCall] = useState(null);
  const [dispatchStatus, setDispatchStatus] = useState({
    dispatch_department: null,
    dispatcher_online: false,
    online_count: 0,
    is_dispatch_department: false,
  });

  const deptId = activeDepartment?.id;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isLaw = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
  const isParamedics = layoutType === DEPARTMENT_LAYOUT.PARAMEDICS;
  const isDispatchDepartment = !!activeDepartment?.is_dispatch;
  const canSelfDispatch = !!(myUnit && !dispatchStatus.dispatcher_online && !dispatchStatus.is_dispatch_department);
  const isMyUnitAvailable = normalizeUnitStatus(myUnit?.status) === 'available';
  const canSelfAssign = canSelfDispatch && isMyUnitAvailable;
  const hideSharedPanels = !!(dispatchStatus.dispatcher_online && !dispatchStatus.is_dispatch_department);

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    try {
      const [unitsData, myData, dispatcherData, currentCallData] = await Promise.all([
        isDispatchDepartment ? api.get('/api/units/dispatchable') : api.get(`/api/units?department_id=${deptId}`),
        api.get('/api/units/me').catch(() => null),
        api.get(`/api/units/dispatcher-status?department_id=${deptId}`),
        api.get('/api/units/me/active-call').catch(() => null),
      ]);
      setUnits(isDispatchDepartment ? (unitsData.units || []) : unitsData);
      setMyUnit(myData);
      setDispatchStatus(dispatcherData);
      setCurrentCall(myData && currentCallData ? currentCallData : null);

      if (dispatcherData.dispatcher_online || dispatcherData.is_dispatch_department) {
        setCalls([]);
      } else {
        const callsData = await api.get(`/api/calls?department_id=${deptId}`);
        setCalls(callsData.filter(call => call.status !== 'closed'));
      }
    } catch (err) {
      console.error('Failed to load units:', err);
    }
  }, [deptId, isDispatchDepartment]);

  useEffect(() => { fetchData(); }, [fetchData, locationKey]);

  useEventSource({
    'unit:online': () => fetchData(),
    'unit:offline': () => fetchData(),
    'unit:update': () => fetchData(),
    'call:create': () => fetchData(),
    'call:update': () => fetchData(),
    'call:assign': () => fetchData(),
    'call:unassign': () => fetchData(),
    'call:close': () => fetchData(),
  });

  async function goOffDuty() {
    if (!confirm('Go off duty?')) return;
    try {
      await api.delete('/api/units/me');
      setMyUnit(null);
      setCurrentCall(null);
      setSelectedCall(null);
      fetchData();
    } catch (err) {
      alert('Failed to go off duty: ' + err.message);
    }
  }

  async function assignMyUnit(callId) {
    if (!myUnit) return;
    if (!isMyUnitAvailable) {
      alert('Your unit must be set to Available before attaching to a call.');
      return;
    }
    try {
      await api.post(`/api/calls/${callId}/assign`, { unit_id: myUnit.id });
      fetchData();
    } catch (err) {
      alert('Failed to self-dispatch: ' + err.message);
    }
  }

  async function unassignMyUnit(callId) {
    if (!myUnit) return;
    try {
      await api.post(`/api/calls/${callId}/unassign`, { unit_id: myUnit.id });
      fetchData();
    } catch (err) {
      alert('Failed to unassign from call: ' + err.message);
    }
  }

  async function closeMyCall(callId) {
    if (!myUnit || !callId) return;
    if (!confirm('Close this call?')) return;
    try {
      await api.patch(`/api/calls/${callId}`, { status: 'closed' });
      fetchData();
      if (selectedCall?.id === callId) setSelectedCall(null);
    } catch (err) {
      alert('Failed to close call: ' + err.message);
    }
  }

  useEffect(() => {
    if (!selectedCall?.id) return;
    const refreshedFromList = calls.find(call => call.id === selectedCall.id);
    const refreshed = refreshedFromList || (currentCall?.id === selectedCall.id ? currentCall : null);
    if (!refreshed) {
      setSelectedCall(null);
      return;
    }
    if (refreshed !== selectedCall) {
      setSelectedCall(refreshed);
    }
  }, [calls, currentCall, selectedCall]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">
        {isLaw ? 'Unit Management' : isParamedics ? 'Crew & Patient Response' : 'Appliance & Incident Response'}
      </h2>

      {/* My unit / Go on duty */}
      {myUnit ? (
        <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Your Unit</h3>
            <button
              onClick={goOffDuty}
              className="px-3 py-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
            >
              Go Off Duty
            </button>
          </div>

          <UnitCard unit={myUnit} />

          <div className="mt-4 bg-cad-surface border border-cad-border rounded-lg p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h4 className="text-xs font-semibold text-cad-muted uppercase tracking-wider">Current Attached Call</h4>
              {currentCall && (
                <button
                  onClick={() => setSelectedCall(currentCall)}
                  className="px-2 py-1 text-[11px] bg-cad-card border border-cad-border rounded text-cad-muted hover:text-cad-ink"
                >
                  Open Details
                </button>
              )}
            </div>

            {!currentCall ? (
              <p className="text-sm text-cad-muted">You are not attached to an active call.</p>
            ) : (
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">#{currentCall.id} {currentCall.title}</p>
                  <p className="text-xs text-cad-muted">{currentCall.location || 'No location'} | Priority {currentCall.priority}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={currentCall.status} />
                  {currentCall.status !== 'closed' && (
                    <button
                      onClick={() => unassignMyUnit(currentCall.id)}
                      className="px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                    >
                      Leave Call
                    </button>
                  )}
                  {currentCall.status !== 'closed' && canSelfDispatch && (
                    <button
                      onClick={() => closeMyCall(currentCall.id)}
                      className="px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                    >
                      Close Call
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-6">
          <h3 className="font-semibold mb-1">Not On Duty</h3>
          <p className="text-sm text-cad-muted">
            {isDispatchDepartment
              ? <>Use the <span className="text-cad-ink font-medium">Go On Duty</span> button in the header to go online as <span className="font-mono text-cad-ink">DISPATCH</span>.</>
              : <>Use the <span className="text-cad-ink font-medium">Go On Duty</span> button in the header to set your callsign and start your shift.</>}
          </p>
        </div>
      )}

      {hideSharedPanels ? (
        <div className="bg-cad-card border border-cad-border rounded-lg p-5">
          <h3 className="font-semibold mb-1">Dispatcher Online</h3>
          <p className="text-sm text-cad-muted">
            {dispatchStatus.dispatch_department?.name || 'Police Communications'} currently has{' '}
            {dispatchStatus.online_count} dispatcher{dispatchStatus.online_count === 1 ? '' : 's'} on duty.
            Self-dispatch panels are hidden while dispatchers are active.
          </p>
        </div>
      ) : (
        <>
          {/* Self dispatch */}
          {!dispatchStatus.is_dispatch_department && (
            <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-6">
              <h3 className="font-semibold mb-3">
                {isLaw ? 'Self Dispatch' : isParamedics ? 'Assign to Patient Calls' : 'Assign to Incident Calls'}
              </h3>
              {!myUnit && (
                <p className="text-sm text-cad-muted">Go on duty first to self-dispatch to active calls.</p>
              )}
              {myUnit && calls.length === 0 && (
                <p className="text-sm text-cad-muted">No active calls available.</p>
              )}
              {myUnit && calls.length > 0 && (
                <div className="space-y-2">
                  {!isMyUnitAvailable && (
                    <p className="text-xs text-amber-300">
                      Your unit is currently {myUnit.status || 'unavailable'}. Set status to Available to attach to calls.
                    </p>
                  )}
                  {calls.map(call => {
                    const assigned = !!call.assigned_units?.find(u => u.id === myUnit.id);
                    return (
                      <div key={call.id} className="bg-cad-surface border border-cad-border rounded px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">#{call.id} {call.title}</p>
                            <p className="text-xs text-cad-muted truncate">
                              {call.location || 'No location'} | Priority {call.priority}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedCall(call)}
                              className="px-2 py-1 text-xs bg-cad-card border border-cad-border rounded text-cad-muted hover:text-cad-ink transition-colors"
                            >
                              Details
                            </button>
                            <StatusBadge status={call.status} />
                            {assigned ? (
                              <>
                                <button
                                  onClick={() => unassignMyUnit(call.id)}
                                  className="px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                                >
                                  Leave
                                </button>
                                {canSelfDispatch && (
                                  <button
                                    onClick={() => closeMyCall(call.id)}
                                    className="px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                                  >
                                    Close
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => assignMyUnit(call.id)}
                                disabled={!canSelfAssign}
                                className="px-2 py-1 text-xs bg-cad-accent/20 text-cad-accent-light border border-cad-accent/30 rounded hover:bg-cad-accent/30 transition-colors disabled:opacity-50"
                              >
                                Self Assign
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* All units */}
          <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
            All On-Duty Units ({units.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {units.map(unit => (
              <UnitCard key={unit.id} unit={unit} />
            ))}
            {units.length === 0 && (
              <p className="text-sm text-cad-muted col-span-full text-center py-8">No units on duty</p>
            )}
          </div>
        </>
      )}

      <Modal open={!!selectedCall} onClose={() => setSelectedCall(null)} title={`Call #${selectedCall?.id}`} wide>
        {selectedCall && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selectedCall.status} />
              {selectedCall.department_short_name && (
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

            <div className="flex gap-2">
              {myUnit && selectedCall.status !== 'closed' && selectedCall.assigned_units?.some(u => u.id === myUnit.id) && (
                <button
                  onClick={() => unassignMyUnit(selectedCall.id)}
                  className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                >
                  Leave Call
                </button>
              )}
              {myUnit && selectedCall.status !== 'closed' && canSelfDispatch && selectedCall.assigned_units?.some(u => u.id === myUnit.id) && (
                <button
                  onClick={() => closeMyCall(selectedCall.id)}
                  className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                >
                  Close Call
                </button>
              )}
              {myUnit && selectedCall.status !== 'closed' && !selectedCall.assigned_units?.some(u => u.id === myUnit.id) && (
                <button
                  onClick={() => assignMyUnit(selectedCall.id)}
                  disabled={!canSelfAssign}
                  className="px-3 py-1.5 text-xs bg-cad-accent/20 text-cad-accent-light border border-cad-accent/30 rounded hover:bg-cad-accent/30 transition-colors disabled:opacity-50"
                >
                  Self Assign
                </button>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Assigned Units</h4>
              {selectedCall.assigned_units?.length > 0 ? (
                <div className="space-y-1">
                  {selectedCall.assigned_units.map(u => (
                    <div key={u.id} className="flex items-center justify-between bg-cad-surface rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono" style={{ color: u.department_color || '#7dd3fc' }}>{u.callsign}</span>
                        <span className="text-sm text-cad-muted">{u.user_name}</span>
                        <StatusBadge status={u.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-cad-muted">No units assigned</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
