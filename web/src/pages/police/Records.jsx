import { useState } from 'react';
import { useDepartment } from '../../context/DepartmentContext';
import { api } from '../../api/client';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';

const EMPTY_NEW_FORM = {
  person_name: '',
  type: 'charge',
  title: '',
  description: '',
  fine_amount: 0,
};

function mapRecordToEditForm(record) {
  return {
    type: record?.type || 'charge',
    title: record?.title || '',
    description: record?.description || '',
    fine_amount: Number(record?.fine_amount || 0),
  };
}

export default function Records() {
  const { activeDepartment } = useDepartment();
  const [personQuery, setPersonQuery] = useState('');
  const [personMatches, setPersonMatches] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [records, setRecords] = useState([]);
  const [searching, setSearching] = useState(false);
  const [lookingUpPersons, setLookingUpPersons] = useState(false);

  const [showNew, setShowNew] = useState(false);
  const [creatingRecord, setCreatingRecord] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW_FORM);

  const [showEdit, setShowEdit] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingSaving, setEditingSaving] = useState(false);
  const [editForm, setEditForm] = useState(mapRecordToEditForm(null));
  const [deletingRecordId, setDeletingRecordId] = useState(null);

  async function refreshSelectedPersonRecords(citizenId) {
    if (!citizenId) {
      setRecords([]);
      return;
    }
    setSearching(true);
    try {
      const data = await api.get(`/api/records?citizen_id=${encodeURIComponent(citizenId)}`);
      setRecords(data);
    } catch (err) {
      alert('Failed to load records: ' + err.message);
    } finally {
      setSearching(false);
    }
  }

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
    setNewForm(f => ({ ...f, person_name: `${person.firstname} ${person.lastname}`.trim() }));
    await refreshSelectedPersonRecords(person.citizenid);
  }

  async function createRecord(e) {
    e.preventDefault();
    if (!selectedPerson) {
      alert('Select a person first');
      return;
    }
    setCreatingRecord(true);
    try {
      await api.post('/api/records', {
        citizen_id: selectedPerson.citizenid,
        type: newForm.type,
        title: newForm.title,
        description: newForm.description,
        fine_amount: Number(newForm.fine_amount || 0),
        department_id: activeDepartment?.id,
      });
      setShowNew(false);
      await refreshSelectedPersonRecords(selectedPerson.citizenid);
      setNewForm({
        ...EMPTY_NEW_FORM,
        person_name: `${selectedPerson.firstname} ${selectedPerson.lastname}`.trim(),
      });
    } catch (err) {
      alert('Failed to create record: ' + err.message);
    } finally {
      setCreatingRecord(false);
    }
  }

  function openEdit(record) {
    setEditingRecord(record);
    setEditForm(mapRecordToEditForm(record));
    setShowEdit(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editingRecord) return;
    setEditingSaving(true);
    try {
      await api.patch(`/api/records/${editingRecord.id}`, {
        type: editForm.type,
        title: editForm.title,
        description: editForm.description,
        fine_amount: Number(editForm.fine_amount || 0),
      });
      setShowEdit(false);
      setEditingRecord(null);
      if (selectedPerson?.citizenid) {
        await refreshSelectedPersonRecords(selectedPerson.citizenid);
      }
    } catch (err) {
      alert('Failed to update record: ' + err.message);
    } finally {
      setEditingSaving(false);
    }
  }

  async function deleteRecord(record) {
    if (!record?.id) return;
    const ok = confirm(`Delete record #${record.id} (${record.title})?`);
    if (!ok) return;
    setDeletingRecordId(record.id);
    try {
      await api.delete(`/api/records/${record.id}`);
      if (showEdit && editingRecord?.id === record.id) {
        setShowEdit(false);
        setEditingRecord(null);
      }
      if (selectedPerson?.citizenid) {
        await refreshSelectedPersonRecords(selectedPerson.citizenid);
      }
    } catch (err) {
      alert('Failed to delete record: ' + err.message);
    } finally {
      setDeletingRecordId(null);
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
              onClick={() => {
                setSelectedPerson(null);
                setRecords([]);
                setShowEdit(false);
                setEditingRecord(null);
              }}
              className="px-2 py-1 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {records.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm text-cad-muted">
            {records.length} record(s) for {selectedPerson?.firstname} {selectedPerson?.lastname}
          </div>
          {records.map(r => (
            <div key={r.id} className="bg-cad-card border border-cad-border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2 gap-3">
                <div className="flex items-center gap-2">
                  <StatusBadge status={r.type} />
                  <span className="font-medium">{r.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(r)}
                    className="px-2 py-1 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRecord(r)}
                    disabled={deletingRecordId === r.id}
                    className="px-2 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    {deletingRecordId === r.id ? 'Deleting...' : 'Delete'}
                  </button>
                  <span className="text-xs text-cad-muted">#{r.id}</span>
                </div>
              </div>
              {r.description && <p className="text-sm text-cad-muted mb-2">{r.description}</p>}
              {r.type === 'fine' && Number(r.fine_amount || 0) > 0 && (
                <p className="text-sm text-amber-400 mb-2">Fine: ${Number(r.fine_amount).toLocaleString()}</p>
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

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Criminal Record">
        <form onSubmit={createRecord} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Person *</label>
            <input
              type="text"
              required
              value={newForm.person_name}
              readOnly
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm text-cad-ink"
              placeholder="Select a person from lookup"
            />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Type *</label>
            <select
              value={newForm.type}
              onChange={e => setNewForm(f => ({ ...f, type: e.target.value }))}
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
              value={newForm.title}
              onChange={e => setNewForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder="e.g. Assault, Speeding, Possession"
            />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Description</label>
            <textarea
              value={newForm.description}
              onChange={e => setNewForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
            />
          </div>
          {newForm.type === 'fine' && (
            <div>
              <label className="block text-sm text-cad-muted mb-1">Fine Amount ($)</label>
              <input
                type="number"
                min="0"
                value={newForm.fine_amount}
                onChange={e => setNewForm(f => ({ ...f, fine_amount: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={creatingRecord}
              className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {creatingRecord ? 'Creating...' : 'Create Record'}
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

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Edit Record #${editingRecord?.id || ''}`}>
        <form onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Type *</label>
            <select
              value={editForm.type}
              onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
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
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Description</label>
            <textarea
              value={editForm.description}
              onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
            />
          </div>
          {editForm.type === 'fine' && (
            <div>
              <label className="block text-sm text-cad-muted mb-1">Fine Amount ($)</label>
              <input
                type="number"
                min="0"
                value={editForm.fine_amount}
                onChange={e => setEditForm(f => ({ ...f, fine_amount: parseFloat(e.target.value) || 0 }))}
                className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={editingSaving}
              className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {editingSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => setShowEdit(false)}
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
