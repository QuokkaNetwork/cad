import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import BOLOCard from '../../components/BOLOCard';
import Modal from '../../components/Modal';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';

const VEHICLE_BOLO_FLAG_OPTIONS = [
  { value: 'stolen', label: 'Stolen' },
  { value: 'wanted', label: 'Wanted Vehicle' },
  { value: 'armed', label: 'Armed Occupants' },
  { value: 'dangerous', label: 'Dangerous' },
  { value: 'disqualified_driver', label: 'Disqualified Driver' },
  { value: 'evade_police', label: 'Evade Police' },
];

function normalizeVehicleDetails(details) {
  const source = details && typeof details === 'object' ? details : {};
  const flags = Array.isArray(source.flags)
    ? Array.from(new Set(source.flags.map((value) => String(value || '').trim().toLowerCase()).filter(Boolean)))
    : [];
  return {
    ...source,
    plate: String(source.plate || source.registration_plate || source.rego || '').trim().toUpperCase(),
    flags,
  };
}

export default function BOLOs() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [bolos, setBolos] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [boloType, setBoloType] = useState('person');
  const [form, setForm] = useState({ title: '', description: '' });
  const [details, setDetails] = useState({ flags: [] });

  const deptId = activeDepartment?.id;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isLaw = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;

  const fetchData = useCallback(async () => {
    if (!deptId || !isLaw) {
      setBolos([]);
      return;
    }
    try {
      const data = await api.get(`/api/bolos?department_id=${deptId}`);
      setBolos(data);
    } catch (err) {
      console.error('Failed to load BOLOs:', err);
    }
  }, [deptId, isLaw]);

  useEffect(() => { fetchData(); }, [fetchData, locationKey]);

  useEventSource({
    'bolo:create': () => fetchData(),
    'bolo:resolve': () => fetchData(),
    'bolo:cancel': () => fetchData(),
  });

  async function createBolo(e) {
    e.preventDefault();
    const payloadDetails = boloType === 'vehicle' ? normalizeVehicleDetails(details) : details;
    if (boloType === 'vehicle' && !payloadDetails.plate) {
      alert('Vehicle BOLOs require a registration plate.');
      return;
    }

    try {
      await api.post('/api/bolos', {
        department_id: deptId,
        type: boloType,
        title: form.title,
        description: form.description,
        details: payloadDetails,
      });
      setShowNew(false);
      setForm({ title: '', description: '' });
      setDetails({ flags: [] });
      fetchData();
    } catch (err) {
      alert('Failed to create BOLO: ' + err.message);
    }
  }

  async function resolveBolo(id) {
    try {
      await api.patch(`/api/bolos/${id}/resolve`);
      fetchData();
    } catch (err) {
      alert('Failed to resolve BOLO: ' + err.message);
    }
  }

  async function cancelBolo(id) {
    if (!confirm('Cancel this BOLO?')) return;
    try {
      await api.patch(`/api/bolos/${id}/cancel`);
      fetchData();
    } catch (err) {
      alert('Failed to cancel BOLO: ' + err.message);
    }
  }

  return (
    <div>
      {isLaw ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Be On the Lookout</h2>
            <button
              onClick={() => setShowNew(true)}
              className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors"
            >
              + New BOLO
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bolos.map(bolo => (
              <BOLOCard
                key={bolo.id}
                bolo={bolo}
                onResolve={resolveBolo}
                onCancel={cancelBolo}
              />
            ))}
            {bolos.length === 0 && (
              <p className="text-sm text-cad-muted col-span-full text-center py-8">No active BOLOs</p>
            )}
          </div>

          {/* New BOLO Modal */}
          <Modal open={showNew} onClose={() => setShowNew(false)} title="Create BOLO">
            <form onSubmit={createBolo} className="space-y-3">
              {/* Type toggle */}
              <div className="flex bg-cad-surface rounded border border-cad-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { setBoloType('person'); setDetails({ flags: [] }); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    boloType === 'person' ? 'bg-amber-500/20 text-amber-400' : 'text-cad-muted'
                  }`}
                >
                  Person
                </button>
                <button
                  type="button"
                  onClick={() => { setBoloType('vehicle'); setDetails({ flags: [] }); }}
                  className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                    boloType === 'vehicle' ? 'bg-blue-500/20 text-blue-400' : 'text-cad-muted'
                  }`}
                >
                  Vehicle
                </button>
              </div>

              <div>
                <label className="block text-sm text-cad-muted mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder={boloType === 'person' ? 'e.g. Wanted Male - Armed Robbery' : 'e.g. Stolen Black Sedan'}
                />
              </div>

              <div>
                <label className="block text-sm text-cad-muted mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
                />
              </div>

              {/* Type-specific details */}
              {boloType === 'person' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-cad-muted mb-1">Name</label>
                    <input
                      type="text"
                      value={details.name || ''}
                      onChange={e => setDetails(d => ({ ...d, name: e.target.value }))}
                      className="w-full bg-cad-card border border-cad-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cad-muted mb-1">Last Seen</label>
                    <input
                      type="text"
                      value={details.last_seen || ''}
                      onChange={e => setDetails(d => ({ ...d, last_seen: e.target.value }))}
                      className="w-full bg-cad-card border border-cad-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-cad-muted mb-1">Physical Description</label>
                    <input
                      type="text"
                      value={details.physical_description || ''}
                      onChange={e => setDetails(d => ({ ...d, physical_description: e.target.value }))}
                      className="w-full bg-cad-card border border-cad-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-cad-muted mb-1">Registration Plate *</label>
                    <input
                      type="text"
                      value={details.plate || ''}
                      onChange={e => setDetails(d => ({ ...d, plate: String(e.target.value || '').toUpperCase() }))}
                      className="w-full bg-cad-card border border-cad-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cad-muted mb-1">Model</label>
                    <input
                      type="text"
                      value={details.model || ''}
                      onChange={e => setDetails(d => ({ ...d, model: e.target.value }))}
                      className="w-full bg-cad-card border border-cad-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cad-muted mb-1">Color</label>
                    <input
                      type="text"
                      value={details.color || ''}
                      onChange={e => setDetails(d => ({ ...d, color: e.target.value }))}
                      className="w-full bg-cad-card border border-cad-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-cad-muted mb-1">Last Seen</label>
                    <input
                      type="text"
                      value={details.last_seen || ''}
                      onChange={e => setDetails(d => ({ ...d, last_seen: e.target.value }))}
                      className="w-full bg-cad-card border border-cad-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-cad-muted mb-1">Flags</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {VEHICLE_BOLO_FLAG_OPTIONS.map((flag) => {
                        const enabled = Array.isArray(details.flags) && details.flags.includes(flag.value);
                        return (
                          <label key={flag.value} className="inline-flex items-center gap-2 text-xs text-cad-ink bg-cad-card border border-cad-border rounded px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) => {
                                const current = Array.isArray(details.flags) ? details.flags : [];
                                if (e.target.checked) {
                                  setDetails((d) => ({ ...d, flags: Array.from(new Set([...current, flag.value])) }));
                                } else {
                                  setDetails((d) => ({ ...d, flags: current.filter((entry) => entry !== flag.value) }));
                                }
                              }}
                            />
                            <span>{flag.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors"
                >
                  Create BOLO
                </button>
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </Modal>
        </>
      ) : (
        <div className="bg-cad-card border border-cad-border rounded-lg p-5">
          <h2 className="text-xl font-bold mb-2">BOLO Board</h2>
          <p className="text-sm text-cad-muted">
            BOLO management is available for law enforcement departments only.
          </p>
        </div>
      )}
    </div>
  );
}
