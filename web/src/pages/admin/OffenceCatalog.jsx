import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import AdminPageHeader from '../../components/AdminPageHeader';
import {
  OFFENCE_CATEGORY,
  OFFENCE_CATEGORY_LABEL,
  OFFENCE_CATEGORY_ORDER,
  normalizeOffenceCategory,
} from '../../utils/offenceCatalog';

const EMPTY_FORM = {
  category: OFFENCE_CATEGORY.INFRINGEMENT,
  code: '',
  title: '',
  description: '',
  fine_amount: 0,
  sort_order: 0,
  is_active: 1,
};

function fmtMoney(amount) {
  const numeric = Number(amount || 0);
  return `$${numeric.toLocaleString()}`;
}

function sortOffences(list) {
  const order = new Map(OFFENCE_CATEGORY_ORDER.map((key, idx) => [key, idx]));
  return [...(list || [])].sort((a, b) => {
    const categoryDiff = (order.get(normalizeOffenceCategory(a.category)) || 99) - (order.get(normalizeOffenceCategory(b.category)) || 99);
    if (categoryDiff !== 0) return categoryDiff;
    const sortDiff = Number(a.sort_order || 0) - Number(b.sort_order || 0);
    if (sortDiff !== 0) return sortDiff;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

export default function AdminOffenceCatalog() {
  const { key: locationKey } = useLocation();
  const [offences, setOffences] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState({ id: null, ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const out = {};
    for (const key of OFFENCE_CATEGORY_ORDER) out[key] = [];
    for (const offence of sortOffences(offences)) {
      const key = normalizeOffenceCategory(offence.category);
      if (!out[key]) out[key] = [];
      out[key].push(offence);
    }
    return out;
  }, [offences]);

  async function fetchOffences() {
    setLoading(true);
    try {
      const data = await api.get('/api/admin/offence-catalog?include_inactive=true');
      setOffences(sortOffences(Array.isArray(data) ? data : []));
    } catch (err) {
      alert('Failed to load offence catalog: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchOffences(); }, [locationKey]);

  async function createOffence(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/admin/offence-catalog', {
        category: normalizeOffenceCategory(form.category),
        code: String(form.code || '').trim(),
        title: String(form.title || '').trim(),
        description: String(form.description || '').trim(),
        fine_amount: Number(form.fine_amount || 0),
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active ? 1 : 0,
      });
      setShowNew(false);
      setForm(EMPTY_FORM);
      fetchOffences();
    } catch (err) {
      alert('Failed to create offence: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEdit(offence) {
    setEditForm({
      id: offence.id,
      category: normalizeOffenceCategory(offence.category),
      code: offence.code || '',
      title: offence.title || '',
      description: offence.description || '',
      fine_amount: Number(offence.fine_amount || 0),
      sort_order: Number(offence.sort_order || 0),
      is_active: offence.is_active ? 1 : 0,
    });
    setShowEdit(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (!editForm.id) return;
    setSaving(true);
    try {
      await api.patch(`/api/admin/offence-catalog/${editForm.id}`, {
        category: normalizeOffenceCategory(editForm.category),
        code: String(editForm.code || '').trim(),
        title: String(editForm.title || '').trim(),
        description: String(editForm.description || '').trim(),
        fine_amount: Number(editForm.fine_amount || 0),
        sort_order: Number(editForm.sort_order || 0),
        is_active: editForm.is_active ? 1 : 0,
      });
      setShowEdit(false);
      fetchOffences();
    } catch (err) {
      alert('Failed to save offence: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOffence(offence) {
    const ok = confirm(`Delete "${offence.title}"?`);
    if (!ok) return;
    try {
      await api.delete(`/api/admin/offence-catalog/${offence.id}`);
      fetchOffences();
    } catch (err) {
      alert('Failed to delete offence: ' + err.message);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Offence Catalog"
        subtitle="Create preset Victorian-style offence entries for Infringements, Summary, and Indictments."
      />

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Offence
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-cad-muted">Loading offences...</p>
      ) : (
        <div className="space-y-6">
          {OFFENCE_CATEGORY_ORDER.map(category => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">
                {OFFENCE_CATEGORY_LABEL[category]} ({grouped[category]?.length || 0})
              </h3>
              <div className="space-y-2">
                {(grouped[category] || []).map(offence => (
                  <div key={offence.id} className="bg-cad-card border border-cad-border rounded-xl p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {offence.code && (
                          <span className="text-xs px-2 py-0.5 rounded font-mono bg-cad-surface text-cad-ink border border-cad-border">
                            {offence.code}
                          </span>
                        )}
                        <span className="font-medium">{offence.title}</span>
                        <span className="text-xs text-amber-400">{fmtMoney(offence.fine_amount)}</span>
                        {!offence.is_active && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-500/20 text-gray-300 border border-gray-500/30">
                            Inactive
                          </span>
                        )}
                      </div>
                      {offence.description && (
                        <p className="text-sm text-cad-muted mt-1">{offence.description}</p>
                      )}
                      <p className="text-xs text-cad-muted mt-1">
                        Sort Order: {Number(offence.sort_order || 0)} | ID: {offence.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => openEdit(offence)}
                        className="text-xs px-2 py-1 bg-cad-surface text-cad-muted hover:text-cad-ink rounded transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteOffence(offence)}
                        className="text-xs px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {(grouped[category] || []).length === 0 && (
                  <p className="text-sm text-cad-muted">No offences in this category.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Offence">
        <form onSubmit={createOffence} className="space-y-3">
          <OffenceFormFields form={form} setForm={setForm} />
          <div className="flex gap-2 pt-2">
            <button disabled={saving} type="submit" className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={`Edit Offence #${editForm.id || ''}`}>
        <form onSubmit={saveEdit} className="space-y-3">
          <OffenceFormFields form={editForm} setForm={setEditForm} />
          <div className="flex gap-2 pt-2">
            <button disabled={saving} type="submit" className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function OffenceFormFields({ form, setForm }) {
  return (
    <>
      <div>
        <label className="block text-sm text-cad-muted mb-1">Category *</label>
        <select
          required
          value={form.category}
          onChange={e => setForm(prev => ({ ...prev, category: e.target.value }))}
          className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
        >
          {OFFENCE_CATEGORY_ORDER.map(category => (
            <option key={category} value={category}>{OFFENCE_CATEGORY_LABEL[category]}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-cad-muted mb-1">Code</label>
          <input
            type="text"
            value={form.code}
            onChange={e => setForm(prev => ({ ...prev, code: e.target.value }))}
            className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
            placeholder="e.g. INF-01"
          />
        </div>
        <div>
          <label className="block text-sm text-cad-muted mb-1">Fine Amount ($)</label>
          <input
            type="number"
            min="0"
            value={form.fine_amount}
            onChange={e => setForm(prev => ({ ...prev, fine_amount: Number(e.target.value) || 0 }))}
            className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm text-cad-muted mb-1">Title *</label>
        <input
          type="text"
          required
          value={form.title}
          onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
          className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
        />
      </div>
      <div>
        <label className="block text-sm text-cad-muted mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-cad-muted mb-1">Sort Order</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={e => setForm(prev => ({ ...prev, sort_order: Number(e.target.value) || 0 }))}
            className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-cad-muted pt-7">
          <input
            type="checkbox"
            checked={!!form.is_active}
            onChange={e => setForm(prev => ({ ...prev, is_active: e.target.checked ? 1 : 0 }))}
            className="rounded"
          />
          Active
        </label>
      </div>
    </>
  );
}

