import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';
import { formatDateTimeAU } from '../../utils/dateTime';

function WarrantCard({ warrant, onServe, onCancel }) {
  const createdAt = formatDateTimeAU(warrant.created_at ? `${warrant.created_at}Z` : '', '');
  const subjectName = String(warrant.subject_name || '').trim() || 'Unknown Person';
  const citizenId = String(warrant.citizen_id || '').trim();

  return (
    <div className="bg-cad-card border border-amber-500/30 rounded-lg p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-amber-300 truncate">{warrant.title}</h3>
          <p className="text-xs text-cad-muted mt-1">Person: <span className="text-cad-ink">{subjectName}</span></p>
          {citizenId ? (
            <p className="text-xs text-cad-muted mt-1">
              Citizen ID: <span className="font-mono">{citizenId}</span>
            </p>
          ) : null}
        </div>
        <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 whitespace-nowrap">
          Active
        </span>
      </div>

      {warrant.description && (
        <p className="text-sm text-cad-muted mb-3">{warrant.description}</p>
      )}

      <div className="text-xs text-cad-muted space-y-1 mb-3">
        <p>Created by: {warrant.creator_name || 'Unknown'}</p>
        <p>Created: {createdAt}</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onServe(warrant.id)}
          className="flex-1 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-xs font-medium transition-colors"
        >
          Mark Served
        </button>
        <button
          onClick={() => onCancel(warrant.id)}
          className="flex-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded text-xs font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Warrants() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const [warrants, setWarrants] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject_name: '', citizen_id: '', title: '', description: '' });

  const deptId = activeDepartment?.id;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isLaw = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;

  const fetchData = useCallback(async () => {
    if (!deptId || !isLaw) {
      setWarrants([]);
      return;
    }
    try {
      const data = await api.get(`/api/warrants?department_id=${deptId}`);
      setWarrants(data);
    } catch (err) {
      console.error('Failed to load warrants:', err);
    }
  }, [deptId, isLaw]);

  useEffect(() => { fetchData(); }, [fetchData, locationKey]);

  useEventSource({
    'warrant:create': () => fetchData(),
    'warrant:serve': () => fetchData(),
    'warrant:cancel': () => fetchData(),
  });

  async function createWarrant(e) {
    e.preventDefault();
    try {
      await api.post('/api/warrants', {
        department_id: deptId,
        subject_name: form.subject_name,
        citizen_id: form.citizen_id,
        title: form.title,
        description: form.description,
        details: {},
      });
      setShowNew(false);
      setForm({ subject_name: '', citizen_id: '', title: '', description: '' });
      fetchData();
    } catch (err) {
      alert('Failed to create warrant: ' + err.message);
    }
  }

  async function serveWarrant(id) {
    try {
      await api.patch(`/api/warrants/${id}/serve`);
      fetchData();
    } catch (err) {
      alert('Failed to serve warrant: ' + err.message);
    }
  }

  async function cancelWarrant(id) {
    if (!confirm('Cancel this warrant?')) return;
    try {
      await api.patch(`/api/warrants/${id}/cancel`);
      fetchData();
    } catch (err) {
      alert('Failed to cancel warrant: ' + err.message);
    }
  }

  return (
    <div>
      {isLaw ? (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Warrants</h2>
            <button
              onClick={() => setShowNew(true)}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + New Warrant
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warrants.map(warrant => (
              <WarrantCard
                key={warrant.id}
                warrant={warrant}
                onServe={serveWarrant}
                onCancel={cancelWarrant}
              />
            ))}
            {warrants.length === 0 && (
              <p className="text-sm text-cad-muted col-span-full text-center py-8">No active warrants</p>
            )}
          </div>

          <Modal open={showNew} onClose={() => setShowNew(false)} title="Create Warrant">
            <form onSubmit={createWarrant} className="space-y-3">
              <div>
                <label className="block text-sm text-cad-muted mb-1">Person Name *</label>
                <input
                  type="text"
                  required
                  value={form.subject_name}
                  onChange={e => setForm(f => ({ ...f, subject_name: e.target.value }))}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="e.g. Lachlan Reith"
                />
              </div>

              <div>
                <label className="block text-sm text-cad-muted mb-1">Citizen ID (optional)</label>
                <input
                  type="text"
                  value={form.citizen_id}
                  onChange={e => setForm(f => ({ ...f, citizen_id: e.target.value }))}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
                  placeholder="e.g. VLM1B4NQ"
                />
              </div>

              <div>
                <label className="block text-sm text-cad-muted mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="e.g. Warrant for arrest - Armed robbery"
                />
              </div>

              <div>
                <label className="block text-sm text-cad-muted mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-medium transition-colors"
                >
                  Create Warrant
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
          <h2 className="text-xl font-bold mb-2">Warrants</h2>
          <p className="text-sm text-cad-muted">
            Warrant management is available for law enforcement departments only.
          </p>
        </div>
      )}
    </div>
  );
}
