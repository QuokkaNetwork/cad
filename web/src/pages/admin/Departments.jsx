import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import Modal from '../../components/Modal';

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', short_name: '', color: '#0052C2', icon: '' });

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
          <div key={dept.id} className="bg-cad-card border border-cad-border rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: dept.color }} />
              <div>
                <span className="font-medium">{dept.name}</span>
                <span className="text-sm text-cad-muted ml-2">({dept.short_name})</span>
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
    </div>
  );
}
