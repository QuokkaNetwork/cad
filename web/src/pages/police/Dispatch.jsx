import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import CallCard from '../../components/CallCard';
import UnitCard from '../../components/UnitCard';
import Modal from '../../components/Modal';
import StatusBadge from '../../components/StatusBadge';

export default function Dispatch() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [calls, setCalls] = useState([]);
  const [units, setUnits] = useState([]);
  const [showNewCall, setShowNewCall] = useState(false);
  const [selectedCall, setSelectedCall] = useState(null);
  const [form, setForm] = useState({ title: '', priority: '3', location: '', description: '', job_code: '' });

  const deptId = activeDepartment?.id;

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    try {
      const [callsData, unitsData] = await Promise.all([
        api.get(`/api/calls?department_id=${deptId}`),
        api.get(`/api/units?department_id=${deptId}`),
      ]);
      setCalls(callsData);
      setUnits(unitsData);
    } catch (err) {
      console.error('Failed to load dispatch data:', err);
    }
  }, [deptId]);

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

  async function createCall(e) {
    e.preventDefault();
    try {
      await api.post('/api/calls', { ...form, department_id: deptId });
      setShowNewCall(false);
      setForm({ title: '', priority: '3', location: '', description: '', job_code: '' });
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

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Dispatch Board</h2>
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
            />
          ))}
        </div>

        {/* Units panel */}
        <div className="w-72 flex-shrink-0 overflow-y-auto">
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
        </div>
      </div>

      {/* New Call Modal */}
      <Modal open={showNewCall} onClose={() => setShowNewCall(false)} title="New Dispatch Call">
        <form onSubmit={createCall} className="space-y-3">
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
                      >
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
