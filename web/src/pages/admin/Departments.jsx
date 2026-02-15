import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState({ name: '', short_name: '', color: '#0052C2', icon: '' });
  const [editForm, setEditForm] = useState({ id: null, name: '', short_name: '', color: '#0052C2', icon: '', is_active: 1 });

  async function fetchDepts() {
    try {
      const data = await api.get('/api/admin/departments');
      setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }

  useEffect(() => { fetchDepts(); }, []);

  async function createDept(e) {
    e.preventDefault();
    try {
      await api.post('/api/admin/departments', form);
      setShowNew(false);
      setForm({ name: '', short_name: '', color: '#0052C2', icon: '' });
      fetchDepts();
    } catch (err) {
      alert('Failed to create department: ' + err.message);
    }
  }

  async function toggleActive(id, isActive) {
    try {
      await api.patch(`/api/admin/departments/${id}`, { is_active: isActive ? 0 : 1 });
      fetchDepts();
    } catch (err) {
      alert('Failed to update department: ' + err.message);
    }
  }

  function openEdit(dept) {
    setEditForm({
      id: dept.id,
      name: dept.name || '',
      short_name: dept.short_name || '',
      color: dept.color || '#0052C2',
      icon: dept.icon || '',
      is_active: dept.is_active ? 1 : 0,
    });
    setShowEdit(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      await api.patch(`/api/admin/departments/${editForm.id}`, {
        name: editForm.name,
        short_name: editForm.short_name,
        color: editForm.color,
        icon: editForm.icon,
        is_active: editForm.is_active ? 1 : 0,
      });
      setShowEdit(false);
      fetchDepts();
    } catch (err) {
      alert('Failed to save department: ' + err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Departments</h2>
        <button
          onClick={() => setShowNew(true)}
          className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors"
        >
          + New Department
        </button>
      </div>

      <div className="space-y-3">
        {departments.map(dept => (
          <div key={dept.id} className="bg-cad-card border border-cad-border rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {dept.icon ? (
                <img src={dept.icon} alt="" className="w-10 h-10 rounded-xl object-cover border border-cad-border bg-cad-surface" />
              ) : (
                <div className="w-10 h-10 rounded-xl border border-cad-border bg-cad-surface flex items-center justify-center text-xs text-cad-muted">
                  {dept.short_name?.slice(0, 3) || 'DEP'}
                </div>
              )}
              <div>
                <span className="font-medium">{dept.name}</span>
                <span className="text-sm text-cad-muted ml-2">({dept.short_name})</span>
                <div className="mt-1">
                  <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ backgroundColor: `${dept.color || '#0052C2'}30`, color: dept.color || '#0052C2' }}>
                    {dept.color || '#0052C2'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${dept.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {dept.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => toggleActive(dept.id, dept.is_active)}
                className="text-xs px-2 py-1 bg-cad-surface text-cad-muted hover:text-cad-ink rounded transition-colors"
              >
                {dept.is_active ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => openEdit(dept)}
                className="text-xs px-2 py-1 bg-cad-surface text-cad-muted hover:text-cad-ink rounded transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Department">
        <form onSubmit={createDept} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Name *</label>
            <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Short Name</label>
            <input type="text" value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="e.g. VicPol" />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Logo URL (optional)</label>
            <input type="text" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded border border-cad-border cursor-pointer" />
              <input type="text" value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="flex-1 bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors">Create</button>
            <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Department">
        <form onSubmit={saveEdit} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Name *</label>
            <input type="text" required value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Short Name</label>
            <input type="text" value={editForm.short_name} onChange={e => setEditForm(f => ({ ...f, short_name: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Logo URL (optional)</label>
            <input type="text" value={editForm.icon} onChange={e => setEditForm(f => ({ ...f, icon: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="https://..." />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded border border-cad-border cursor-pointer" />
              <input type="text" value={editForm.color} onChange={e => setEditForm(f => ({ ...f, color: e.target.value }))}
                className="flex-1 bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-cad-muted">
            <input
              type="checkbox"
              checked={!!editForm.is_active}
              onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
              className="rounded"
            />
            Department is active
          </label>
          <div className="flex gap-2 pt-2">
            <button type="submit" className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors">Save</button>
            <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
