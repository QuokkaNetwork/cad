import { useState, useEffect, useCallback } from 'react';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import BOLOCard from '../../components/BOLOCard';
import Modal from '../../components/Modal';

export default function BOLOs() {
  const { activeDepartment } = useDepartment();
  const [bolos, setBolos] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [boloType, setBoloType] = useState('person');
  const [form, setForm] = useState({ title: '', description: '' });
  const [details, setDetails] = useState({});

  const deptId = activeDepartment?.id;

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    try {
      const data = await api.get(`/api/bolos?department_id=${deptId}`);
      setBolos(data);
    } catch (err) {
      console.error('Failed to load BOLOs:', err);
    }
  }, [deptId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEventSource({
    'bolo:create': () => fetchData(),
    'bolo:resolve': () => fetchData(),
    'bolo:cancel': () => fetchData(),
  });

  async function createBolo(e) {
    e.preventDefault();
    try {
      await api.post('/api/bolos', {
        department_id: deptId,
        type: boloType,
        title: form.title,
        description: form.description,
        details,
      });
      setShowNew(false);
      setForm({ title: '', description: '' });
      setDetails({});
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
              onClick={() => { setBoloType('person'); setDetails({}); }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                boloType === 'person' ? 'bg-amber-500/20 text-amber-400' : 'text-cad-muted'
              }`}
            >
              Person
            </button>
            <button
              type="button"
              onClick={() => { setBoloType('vehicle'); setDetails({}); }}
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
                <label className="block text-xs text-cad-muted mb-1">Plate</label>
                <input
                  type="text"
                  value={details.plate || ''}
                  onChange={e => setDetails(d => ({ ...d, plate: e.target.value }))}
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
    </div>
  );
}
