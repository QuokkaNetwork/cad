import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import { useEventSource } from '../../hooks/useEventSource';
import { useDepartment } from '../../context/DepartmentContext';

function normalizeUnitStatus(value) {
  return String(value || '').trim().toLowerCase();
}

export default function CallDetails() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [loading, setLoading] = useState(true);
  const [myUnit, setMyUnit] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [canSelfDispatchClose, setCanSelfDispatchClose] = useState(false);

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const unit = await api.get('/api/units/me').catch((err) => {
        if (err?.status === 404) return null;
        throw err;
      });
      const [call, dispatcherStatus] = await Promise.all([
        api.get('/api/units/me/active-call').catch((err) => {
          if (err?.status === 404) return null;
          throw err;
        }),
        unit?.department_id
          ? api.get(`/api/units/dispatcher-status?department_id=${unit.department_id}`).catch(() => null)
          : Promise.resolve(null),
      ]);
      setMyUnit(unit);
      setActiveCall(unit && call ? call : null);
      setCanSelfDispatchClose(!!unit && !!call && !(dispatcherStatus?.dispatcher_online || dispatcherStatus?.is_dispatch_department));
    } catch (err) {
      console.error('Failed to refresh call details:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData({ silent: false });
  }, [fetchData, locationKey, activeDepartment?.id]);

  useEventSource({
    'unit:online': () => fetchData({ silent: true }),
    'unit:offline': () => fetchData({ silent: true }),
    'unit:update': (payload) => {
      const updatedUnitId = Number(payload?.unit?.id || 0);
      if (!updatedUnitId) return;

      const myUnitId = Number(myUnit?.id || 0);
      if (myUnitId > 0 && updatedUnitId === myUnitId) {
        const currentStatus = normalizeUnitStatus(myUnit?.status);
        const nextStatus = normalizeUnitStatus(payload?.unit?.status);
        if (nextStatus && nextStatus !== currentStatus) {
          fetchData({ silent: true });
        }
        return;
      }

      const matchingAssignedUnit = Array.isArray(activeCall?.assigned_units)
        ? activeCall.assigned_units.find((unit) => Number(unit?.id) === updatedUnitId)
        : null;
      if (!matchingAssignedUnit) return;

      const currentStatus = normalizeUnitStatus(matchingAssignedUnit?.status);
      const nextStatus = normalizeUnitStatus(payload?.unit?.status);
      if (nextStatus && nextStatus !== currentStatus) {
        fetchData({ silent: true });
      }
    },
    'call:update': (payload) => {
      const currentCallId = Number(activeCall?.id || 0);
      const eventCallId = Number(payload?.call?.id || 0);
      if (!eventCallId) return;
      if (currentCallId > 0 && eventCallId !== currentCallId) return;
      fetchData({ silent: true });
    },
    'call:assign': (payload) => {
      const currentCallId = Number(activeCall?.id || 0);
      const eventCallId = Number(payload?.call?.id || 0);
      const eventUnitId = Number(payload?.unit?.id || 0);
      const myUnitId = Number(myUnit?.id || 0);
      const isMyAssignment = myUnitId > 0 && eventUnitId === myUnitId;
      const isCurrentCallEvent = currentCallId > 0 && eventCallId === currentCallId;
      if (isMyAssignment || isCurrentCallEvent || currentCallId === 0) {
        fetchData({ silent: true });
      }
    },
    'call:unassign': (payload) => {
      const currentCallId = Number(activeCall?.id || 0);
      const eventCallId = Number(payload?.call?.id || 0);
      const eventUnitId = Number(payload?.unit?.id || payload?.unit_id || 0);
      const myUnitId = Number(myUnit?.id || 0);
      const isMyUnassignment = myUnitId > 0 && eventUnitId === myUnitId;
      const isCurrentCallEvent = currentCallId > 0 && eventCallId === currentCallId;
      if (isMyUnassignment || isCurrentCallEvent || currentCallId === 0) {
        fetchData({ silent: true });
      }
    },
    'call:close': (payload) => {
      const currentCallId = Number(activeCall?.id || 0);
      const eventCallId = Number(payload?.call?.id || 0);
      if (!eventCallId) return;
      if (currentCallId > 0 && eventCallId !== currentCallId) return;
      fetchData({ silent: true });
    },
  });

  async function leaveCall() {
    if (!activeCall?.id || !myUnit?.id) return;
    try {
      await api.post(`/api/calls/${activeCall.id}/unassign`, { unit_id: myUnit.id });
      fetchData();
    } catch (err) {
      alert('Failed to leave call: ' + err.message);
    }
  }

  async function closeCall() {
    if (!activeCall?.id || !canSelfDispatchClose) return;
    if (!confirm('Close this call?')) return;
    try {
      await api.patch(`/api/calls/${activeCall.id}`, { status: 'closed' });
      fetchData();
    } catch (err) {
      alert('Failed to close call: ' + err.message);
    }
  }

  if (loading) {
    return <p className="text-sm text-cad-muted">Loading call details...</p>;
  }

  if (!myUnit) {
    return (
      <div className="bg-cad-card border border-cad-border rounded-lg p-5">
        <h2 className="text-xl font-bold mb-2">Call Details</h2>
        <p className="text-sm text-cad-muted">You need to be on duty before call details can appear here.</p>
      </div>
    );
  }

  if (!activeCall) {
    return (
      <div className="bg-cad-card border border-cad-border rounded-lg p-5">
        <h2 className="text-xl font-bold mb-2">Call Details</h2>
        <p className="text-sm text-cad-muted">Your unit is not currently attached to an active call.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-cad-card border border-cad-border rounded-lg p-5">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <StatusBadge status={activeCall.status} />
          <span className="text-xs text-cad-muted">
            Priority {activeCall.priority} | {activeCall.job_code || 'No job code'}
          </span>
          {activeCall.department_short_name && (
            <span
              className="text-xs px-2 py-0.5 rounded font-semibold"
              style={{
                backgroundColor: `${activeCall.department_color || '#64748b'}22`,
                color: activeCall.department_color || '#cbd5e1',
                border: `1px solid ${activeCall.department_color || '#64748b'}44`,
              }}
            >
              {activeCall.department_short_name}
            </span>
          )}
        </div>

        <h2 className="text-xl font-bold">#{activeCall.id} {activeCall.title}</h2>
        <p className="text-sm text-cad-muted mt-1">Location: {activeCall.location || 'No location set'}</p>
        {activeCall.description && (
          <p className="text-sm mt-3 whitespace-pre-wrap">{activeCall.description}</p>
        )}

        {activeCall.status !== 'closed' && (
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={leaveCall}
                className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
              >
                Leave Call
              </button>
              {canSelfDispatchClose && (
                <button
                  onClick={closeCall}
                  className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                >
                  Close Call
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
          Assigned Units ({activeCall.assigned_units?.length || 0})
        </h3>
        {activeCall.assigned_units?.length > 0 ? (
          <div className="space-y-2">
            {activeCall.assigned_units.map(unit => (
              <div key={unit.id} className="bg-cad-surface border border-cad-border rounded px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono" style={{ color: unit.department_color || '#7dd3fc' }}>{unit.callsign}</span>
                  <span className="text-sm text-cad-muted truncate">{unit.user_name}</span>
                </div>
                <StatusBadge status={unit.status} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-cad-muted">No units assigned.</p>
        )}
      </div>
    </div>
  );
}
