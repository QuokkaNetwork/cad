import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import AdminPageHeader from '../../components/AdminPageHeader';

export default function AdminDepartments() {
  const { key: locationKey } = useLocation();
  const [departments, setDepartments] = useState([]);
  const [subDepartments, setSubDepartments] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showNewSub, setShowNewSub] = useState(false);
  const [showEditSub, setShowEditSub] = useState(false);
  const [form, setForm] = useState({ name: '', short_name: '', color: '#0052C2', icon: '' });
  const [editForm, setEditForm] = useState({ id: null, name: '', short_name: '', color: '#0052C2', icon: '', is_active: 1 });
  const [subForm, setSubForm] = useState({ department_id: '', name: '', short_name: '', color: '#0052C2', is_active: 1 });
  const [editSubForm, setEditSubForm] = useState({ id: null, department_id: '', name: '', short_name: '', color: '#0052C2', is_active: 1 });
  const [newIconFile, setNewIconFile] = useState(null);
  const [editIconFile, setEditIconFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function fetchDepts() {
    try {
      const [depts, subs] = await Promise.all([
        api.get('/api/admin/departments'),
        api.get('/api/admin/sub-departments'),
      ]);
      setDepartments(depts);
      setSubDepartments(subs);
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  }

  useEffect(() => { fetchDepts(); }, [locationKey]);

  async function uploadIcon(file) {
    const data = new FormData();
    data.append('icon', file);
    const uploaded = await api.post('/api/admin/departments/upload-icon', data);
    return uploaded.icon;
  }

  async function createDept(e) {
    e.preventDefault();
    try {
      setSaving(true);
      let icon = form.icon;
      if (newIconFile) {
        icon = await uploadIcon(newIconFile);
      }
      await api.post('/api/admin/departments', { ...form, icon });
      setShowNew(false);
      setForm({ name: '', short_name: '', color: '#0052C2', icon: '' });
      setNewIconFile(null);
      fetchDepts();
    } catch (err) {
      alert('Failed to create department: ' + err.message);
    } finally {
      setSaving(false);
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
    setEditIconFile(null);
    setShowEdit(true);
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      setSaving(true);
      let icon = editForm.icon;
      if (editIconFile) {
        icon = await uploadIcon(editIconFile);
      }
      await api.patch(`/api/admin/departments/${editForm.id}`, {
        name: editForm.name,
        short_name: editForm.short_name,
        color: editForm.color,
        icon,
        is_active: editForm.is_active ? 1 : 0,
      });
      setShowEdit(false);
      setEditIconFile(null);
      fetchDepts();
    } catch (err) {
      alert('Failed to save department: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function createSubDept(e) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post('/api/admin/sub-departments', {
        department_id: parseInt(subForm.department_id, 10),
        name: subForm.name,
        short_name: subForm.short_name,
        color: subForm.color,
        is_active: subForm.is_active ? 1 : 0,
      });
      setShowNewSub(false);
      setSubForm({ department_id: '', name: '', short_name: '', color: '#0052C2', is_active: 1 });
      fetchDepts();
    } catch (err) {
      alert('Failed to create sub-department: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function openEditSub(sub) {
    setEditSubForm({
      id: sub.id,
      department_id: sub.department_id,
      name: sub.name || '',
      short_name: sub.short_name || '',
      color: sub.color || '#0052C2',
      is_active: sub.is_active ? 1 : 0,
    });
    setShowEditSub(true);
  }

  async function saveEditSub(e) {
    e.preventDefault();
    try {
      setSaving(true);
      await api.patch(`/api/admin/sub-departments/${editSubForm.id}`, {
        name: editSubForm.name,
        short_name: editSubForm.short_name,
        color: editSubForm.color,
        is_active: editSubForm.is_active ? 1 : 0,
      });
      setShowEditSub(false);
      fetchDepts();
    } catch (err) {
      alert('Failed to save sub-department: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSubActive(sub) {
    try {
      await api.patch(`/api/admin/sub-departments/${sub.id}`, { is_active: sub.is_active ? 0 : 1 });
      fetchDepts();
    } catch (err) {
      alert('Failed to update sub-department: ' + err.message);
    }
  }

  return (
    <div>
      <AdminPageHeader
        title="Departments"
        subtitle="Create and manage departments, colors, and logo assets."
      />
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors"
          >
            + New Department
          </button>
          <button
            onClick={() => setShowNewSub(true)}
            className="px-4 py-2 bg-cad-surface border border-cad-border hover:border-cad-accent/50 text-cad-ink rounded-lg text-sm font-medium transition-colors"
          >
            + New Sub-Department
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {departments.map(dept => (
          <div key={dept.id} className="bg-cad-card border border-cad-border rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {dept.icon ? (
                <img src={dept.icon} alt="" className="w-10 h-10 rounded-xl object-contain p-0.5 border border-cad-border bg-cad-surface" />
              ) : (
                <div className="w-10 h-10 rounded-xl border border-cad-border bg-cad-surface flex items-center justify-center text-xs text-cad-muted">
                  {dept.short_name?.slice(0, 3) || 'DEP'}
                </div>
              )}
              <div>
                <span className="font-medium">{dept.name}</span>
                <span className="text-sm text-cad-muted ml-2">({dept.short_name})</span>
                <span className="text-xs text-cad-muted ml-2">{dept.sub_department_count || 0} sub-department(s)</span>
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

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Sub-Departments</h3>
        {subDepartments.map(sub => (
          <div key={sub.id} className="bg-cad-card border border-cad-border rounded-xl p-3 flex items-center justify-between">
            <div>
              <span className="font-medium">{sub.name}</span>
              <span className="text-sm text-cad-muted ml-2">({sub.short_name})</span>
              <span className="text-xs text-cad-muted ml-2">Parent: {sub.department_name}</span>
              <span className="text-xs px-2 py-0.5 rounded font-mono ml-2" style={{ backgroundColor: `${sub.color || '#0052C2'}30`, color: sub.color || '#0052C2' }}>
                {sub.color || '#0052C2'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${sub.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                {sub.is_active ? 'Active' : 'Inactive'}
              </span>
              <button
                onClick={() => toggleSubActive(sub)}
                className="text-xs px-2 py-1 bg-cad-surface text-cad-muted hover:text-cad-ink rounded transition-colors"
              >
                {sub.is_active ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => openEditSub(sub)}
                className="text-xs px-2 py-1 bg-cad-surface text-cad-muted hover:text-cad-ink rounded transition-colors"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
        {subDepartments.length === 0 && (
          <p className="text-sm text-cad-muted">No sub-departments configured.</p>
        )}
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
            <label className="block text-sm text-cad-muted mb-1">Logo Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setNewIconFile(e.target.files?.[0] || null)}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded file:bg-cad-surface file:text-cad-muted"
            />
            <p className="text-xs text-cad-muted mt-1">Max 2MB. PNG, JPG, WEBP, GIF.</p>
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
            <button disabled={saving} type="submit" className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Create'}</button>
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
            <label className="block text-sm text-cad-muted mb-1">Logo Image (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={e => setEditIconFile(e.target.files?.[0] || null)}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm file:mr-3 file:px-3 file:py-1.5 file:border-0 file:rounded file:bg-cad-surface file:text-cad-muted"
            />
            <p className="text-xs text-cad-muted mt-1">Leave empty to keep current logo.</p>
            {editForm.icon && (
              <div className="mt-2 flex items-center gap-3">
                <img src={editForm.icon} alt="" className="w-10 h-10 rounded-xl object-contain p-0.5 border border-cad-border bg-cad-surface" />
                <button
                  type="button"
                  onClick={() => setEditForm(f => ({ ...f, icon: '' }))}
                  className="text-xs px-2 py-1 bg-cad-surface text-cad-muted hover:text-cad-ink rounded transition-colors"
                >
                  Remove Current Logo
                </button>
              </div>
            )}
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
            <button disabled={saving} type="submit" className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setShowEdit(false)} className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={showNewSub} onClose={() => setShowNewSub(false)} title="New Sub-Department">
        <form onSubmit={createSubDept} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Parent Department *</label>
            <select
              required
              value={subForm.department_id}
              onChange={e => {
                const dept = departments.find(d => String(d.id) === e.target.value);
                setSubForm(f => ({ ...f, department_id: e.target.value, color: dept?.color || f.color }));
              }}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="">Select department...</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Name *</label>
            <input type="text" required value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="e.g. Highway Patrol" />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Short Name *</label>
            <input type="text" required value={subForm.short_name} onChange={e => setSubForm(f => ({ ...f, short_name: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" placeholder="e.g. HWP" />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={subForm.color} onChange={e => setSubForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded border border-cad-border cursor-pointer" />
              <input type="text" value={subForm.color} onChange={e => setSubForm(f => ({ ...f, color: e.target.value }))}
                className="flex-1 bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button disabled={saving} type="submit" className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Create'}</button>
            <button type="button" onClick={() => setShowNewSub(false)} className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal open={showEditSub} onClose={() => setShowEditSub(false)} title="Edit Sub-Department">
        <form onSubmit={saveEditSub} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Name *</label>
            <input type="text" required value={editSubForm.name} onChange={e => setEditSubForm(f => ({ ...f, name: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Short Name *</label>
            <input type="text" required value={editSubForm.short_name} onChange={e => setEditSubForm(f => ({ ...f, short_name: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent" />
          </div>
          <div>
            <label className="block text-sm text-cad-muted mb-1">Color</label>
            <div className="flex items-center gap-2">
              <input type="color" value={editSubForm.color} onChange={e => setEditSubForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded border border-cad-border cursor-pointer" />
              <input type="text" value={editSubForm.color} onChange={e => setEditSubForm(f => ({ ...f, color: e.target.value }))}
                className="flex-1 bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-cad-muted">
            <input
              type="checkbox"
              checked={!!editSubForm.is_active}
              onChange={e => setEditSubForm(f => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
              className="rounded"
            />
            Sub-department is active
          </label>
          <div className="flex gap-2 pt-2">
            <button disabled={saving} type="submit" className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>
            <button type="button" onClick={() => setShowEditSub(false)} className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors">Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
