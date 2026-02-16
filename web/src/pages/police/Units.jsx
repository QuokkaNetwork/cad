import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import UnitCard from '../../components/UnitCard';
import StatusBadge from '../../components/StatusBadge';

export default function Units() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [units, setUnits] = useState([]);
  const [myUnit, setMyUnit] = useState(null);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [calls, setCalls] = useState([]);
  const [dispatchStatus, setDispatchStatus] = useState({
    dispatch_department: null,
    dispatcher_online: false,
    online_count: 0,
    is_dispatch_department: false,
  });

  const deptId = activeDepartment?.id;
  const canSelfDispatch = !!(myUnit && !dispatchStatus.dispatcher_online && !dispatchStatus.is_dispatch_department);
  const hideSharedPanels = !!(dispatchStatus.dispatcher_online && !dispatchStatus.is_dispatch_department);

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    try {
      const [unitsData, myData, dispatcherData] = await Promise.all([
        api.get(`/api/units?department_id=${deptId}`),
        api.get('/api/units/me').catch(() => null),
        api.get(`/api/units/dispatcher-status?department_id=${deptId}`),
      ]);
      setUnits(unitsData);
      setMyUnit(myData);
      setDispatchStatus(dispatcherData);
      if (myData) {
        setLocation(myData.location || '');
        setNote(myData.note || '');
      }

      if (dispatcherData.dispatcher_online || dispatcherData.is_dispatch_department) {
        setCalls([]);
      } else {
        const callsData = await api.get(`/api/calls?department_id=${deptId}`);
        setCalls(callsData.filter(call => call.status !== 'closed'));
      }
    } catch (err) {
      console.error('Failed to load units:', err);
    }
  }, [deptId]);

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
      fetchData();
    } catch (err) {
      alert('Failed to go off duty: ' + err.message);
    }
  }

  async function updateStatus(status) {
    try {
      await api.patch('/api/units/me', { status });
      fetchData();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    }
  }

  async function updateDetails() {
    try {
      await api.patch('/api/units/me', { location, note });
      fetchData();
    } catch (err) {
      alert('Failed to update: ' + err.message);
    }
  }

  async function assignMyUnit(callId) {
    if (!myUnit) return;
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

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">Unit Management</h2>

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

          <UnitCard unit={myUnit} onStatusChange={updateStatus} />

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div>
              <label className="block text-xs text-cad-muted mb-1">Location</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                onBlur={updateDetails}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="Current location"
              />
            </div>
            <div>
              <label className="block text-xs text-cad-muted mb-1">Note</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                onBlur={updateDetails}
                className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                placeholder="Status note"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-6">
          <h3 className="font-semibold mb-1">Not On Duty</h3>
          <p className="text-sm text-cad-muted">
            Use the <span className="text-cad-ink font-medium">Go On Duty</span> button in the header to set your callsign and start your shift.
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
              <h3 className="font-semibold mb-3">Self Dispatch</h3>
              {!myUnit && (
                <p className="text-sm text-cad-muted">Go on duty first to self-dispatch to active calls.</p>
              )}
              {myUnit && calls.length === 0 && (
                <p className="text-sm text-cad-muted">No active calls available.</p>
              )}
              {myUnit && calls.length > 0 && (
                <div className="space-y-2">
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
                            <StatusBadge status={call.status} />
                            {assigned ? (
                              <button
                                onClick={() => unassignMyUnit(call.id)}
                                className="px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                              >
                                Leave
                              </button>
                            ) : (
                              <button
                                onClick={() => assignMyUnit(call.id)}
                                disabled={!canSelfDispatch}
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
    </div>
  );
}
