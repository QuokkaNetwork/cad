import { useState } from 'react';
import { useDepartment } from '../../context/DepartmentContext';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

export default function Records() {
  const { activeDepartment } = useDepartment();
  const [personQuery, setPersonQuery] = useState('');
  const [personMatches, setPersonMatches] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [records, setRecords] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lookingUpPersons, setLookingUpPersons] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    person_name: '',
    type: 'charge',
    title: '',
    description: '',
    fine_amount: 0,
  });

  async function searchPeople(e) {
    e.preventDefault();
    if (personQuery.trim().length < 2) return;
    setLookingUpPersons(true);
    try {
      const data = await api.get(`/api/search/persons?q=${encodeURIComponent(personQuery.trim())}`);
      setPersonMatches(data);
    } catch (err) {
      alert('Lookup failed: ' + err.message);
    } finally {
      setLookingUpPersons(false);
    }
  }

  async function selectPerson(person) {
    setSelectedPerson(person);
    setForm(f => ({ ...f, person_name: `${person.firstname} ${person.lastname}`.trim() }));
    setSearching(true);
    try {
      const data = await api.get(`/api/records?citizen_id=${encodeURIComponent(person.citizenid)}`);
      setRecords(data);
    } catch (err) {
      alert('Failed to load records: ' + err.message);
    } finally {
      setSearching(false);
    }
  }

  async function createRecord(e) {
    e.preventDefault();
    if (!selectedPerson) {
      alert('Select a person first');
      return;
    }
    try {
      await api.post('/api/records', {
        citizen_id: selectedPerson.citizenid,
        type: form.type,
        title: form.title,
        description: form.description,
        fine_amount: form.fine_amount,
        department_id: activeDepartment?.id,
      });
      setShowNew(false);
      if (selectedPerson?.citizenid) {
        const data = await api.get(`/api/records?citizen_id=${encodeURIComponent(selectedPerson.citizenid)}`);
        setRecords(data);
      }
      setForm({
        person_name: selectedPerson ? `${selectedPerson.firstname} ${selectedPerson.lastname}`.trim() : '',
        type: 'charge',
        title: '',
        description: '',
        fine_amount: 0,
      });
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
          disabled={!selectedPerson}
          className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          + New Record
        </button>
      </div>

      {/* Person lookup */}
      <div className="bg-cad-card border border-cad-border rounded-2xl p-4 mb-6">
        <form onSubmit={searchPeople} className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={personQuery}
            onChange={e => setPersonQuery(e.target.value)}
            placeholder="Search person by first or last name..."
            className="flex-1 bg-cad-surface border border-cad-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
          />
          <button
            type="submit"
            disabled={lookingUpPersons || personQuery.trim().length < 2}
            className="px-6 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            {lookingUpPersons ? 'Searching...' : 'Find Person'}
          </button>
        </form>

        {personMatches.length > 0 && (
          <div className="mt-3 border border-cad-border rounded-lg overflow-hidden">
            {personMatches.slice(0, 8).map((p, idx) => (
              <button
                key={`${p.citizenid}-${idx}`}
                onClick={() => selectPerson(p)}
                className="w-full text-left px-3 py-2 bg-cad-surface hover:bg-cad-card transition-colors border-b border-cad-border/60 last:border-b-0"
              >
                <span className="font-medium">{p.firstname} {p.lastname}</span>
                <span className="text-xs text-cad-muted ml-2">{p.birthdate || 'Unknown DOB'}</span>
              </button>
            ))}
          </div>
        )}

        {selectedPerson && (
          <div className="mt-3 flex items-center justify-between gap-2 text-sm text-cad-muted">
            <div>
              Selected: <span className="text-cad-ink font-medium">{selectedPerson.firstname} {selectedPerson.lastname}</span>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedPerson(null); setRecords([]); }}
              className="px-2 py-1 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Records list */}
      {records.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-cad-muted">
            {records.length} record(s) for {selectedPerson?.firstname} {selectedPerson?.lastname}
          </div>
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

      {records.length === 0 && selectedPerson && !searching && (
        <p className="text-center text-cad-muted py-8">No records found for this person</p>
      )}

      {/* New Record Modal */}
      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Criminal Record">
        <form onSubmit={createRecord} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Person *</label>
            <input
              type="text"
              required
              value={form.person_name}
              readOnly
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm text-cad-ink"
              placeholder="Select a person from lookup"
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
