import { useState } from 'react';
import { useDepartment } from '../../context/DepartmentContext';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

export default function Records() {
  const { activeDepartment } = useDepartment();
  const [citizenId, setCitizenId] = useState('');
  const [records, setRecords] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    citizen_id: '',
    type: 'charge',
    title: '',
    description: '',
    fine_amount: 0,
  });

  async function searchRecords(e) {
    e.preventDefault();
    if (!citizenId.trim()) return;
    setSearching(true);
    try {
      const data = await api.get(`/api/records?citizen_id=${encodeURIComponent(citizenId.trim())}`);
      setRecords(data);
    } catch (err) {
      alert('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  }

  async function createRecord(e) {
    e.preventDefault();
    try {
      await api.post('/api/records', {
        ...form,
        department_id: activeDepartment?.id,
      });
      setShowNew(false);
      // Refresh if we're viewing this citizen's records
      if (citizenId === form.citizen_id) {
        const data = await api.get(`/api/records?citizen_id=${encodeURIComponent(citizenId)}`);
        setRecords(data);
      }
      setForm({ citizen_id: '', type: 'charge', title: '', description: '', fine_amount: 0 });
    } catch (err) {
      alert('Failed to create record: ' + err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Criminal Records</h2>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Record
        </button>
      </div>

      {/* Search by citizen ID */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-4 mb-6">
        <form onSubmit={searchRecords} className="flex gap-3">
          <input
            type="text"
            value={citizenId}
            onChange={e => setCitizenId(e.target.value)}
            placeholder="Enter Citizen ID to view records..."
            className="flex-1 bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent font-mono"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </form>
      </div>

      {/* Records list */}
      {records.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-cad-muted">{records.length} record(s) for {citizenId}</div>
          {records.map(r => (
            <div key={r.id} className="bg-cad-card border border-cad-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.type} />
                  <span className="font-medium">{r.title}</span>
                </div>
                <span className="text-xs text-cad-muted">#{r.id}</span>
              </div>
              {r.description && <p className="text-sm text-cad-muted mb-2">{r.description}</p>}
              {r.type === 'fine' && r.fine_amount > 0 && (
                <p className="text-sm text-amber-400 mb-2">Fine: ${r.fine_amount.toLocaleString()}</p>
              )}
              <div className="flex items-center justify-between text-xs text-cad-muted">
                <span>
                  {r.officer_callsign && `${r.officer_callsign} - `}{r.officer_name}
                </span>
                <span>{new Date(r.created_at + 'Z').toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {records.length === 0 && citizenId && !searching && (
        <p className="text-center text-cad-muted py-8">No records found for this citizen</p>
      )}

      {/* New Record Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Criminal Record">
        <form onSubmit={createRecord} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Citizen ID *</label>
            <input
              type="text"
              required
              value={form.citizen_id}
              onChange={e => setForm(f => ({ ...f, citizen_id: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="e.g. ABC12345"
            />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Type *</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="charge">Charge</option>
              <option value="fine">Fine</option>
              <option value="warning">Warning</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder="e.g. Assault, Speeding, Possession"
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
          {form.type === 'fine' && (
            <div>
              <label className="block text-sm text-cad-muted mb-1">Fine Amount ($)</label>
              <input
                type="number"
                min="0"
                value={form.fine_amount}
                onChange={e => setForm(f => ({ ...f, fine_amount: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors"
            >
              Create Record
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
