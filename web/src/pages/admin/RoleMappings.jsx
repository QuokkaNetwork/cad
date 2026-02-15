import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function AdminRoleMappings() {
  const [mappings, setMappings] = useState([]);
  const [discordRoles, setDiscordRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [syncing, setSyncing] = useState(false);

  async function fetchData() {
    try {
      const [mappingsData, deptsData] = await Promise.all([
        api.get('/api/admin/role-mappings'),
        api.get('/api/admin/departments'),
      ]);
      setMappings(mappingsData);
      setDepartments(deptsData);

      try {
        const rolesData = await api.get('/api/admin/discord/roles');
        setDiscordRoles(rolesData);
      } catch {
        // Bot may not be running
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  }

  useEffect(() => { fetchData(); }, []);

  async function addMapping() {
    if (!selectedRole || !selectedDept) return;
    const role = discordRoles.find(r => r.id === selectedRole);
    try {
      await api.post('/api/admin/role-mappings', {
        discord_role_id: selectedRole,
        discord_role_name: role?.name || '',
        department_id: selectedDept,
      });
      setSelectedRole('');
      setSelectedDept('');
      fetchData();
    } catch (err) {
      alert('Failed to create mapping: ' + err.message);
    }
  }

  async function deleteMapping(id) {
    try {
      await api.delete(`/api/admin/role-mappings/${id}`);
      fetchData();
    } catch (err) {
      alert('Failed to delete mapping: ' + err.message);
    }
  }

  async function syncAll() {
    setSyncing(true);
    try {
      const result = await api.post('/api/admin/discord/sync');
      alert(`Synced ${result.synced} users (${result.skipped} skipped)`);
      fetchData();
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Discord Role Mappings</h2>
        <button
          onClick={syncAll}
          disabled={syncing}
          className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync All Members'}
        </button>
      </div>

      {/* Current mappings */}
      <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-cad-border">
          <h3 className="text-sm font-semibold">Current Mappings</h3>
        </div>
        {mappings.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cad-border text-left text-xs text-cad-muted uppercase tracking-wider">
                <th className="px-4 py-2">Discord Role</th>
                <th className="px-4 py-2">Role ID</th>
                <th className="px-4 py-2">Department</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {mappings.map(m => (
                <tr key={m.id} className="border-b border-cad-border/50">
                  <td className="px-4 py-2 font-medium">{m.discord_role_name || '-'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-cad-muted">{m.discord_role_id}</td>
                  <td className="px-4 py-2">{m.department_name} ({m.department_short_name})</td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => deleteMapping(m.id)}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-4 py-6 text-sm text-cad-muted text-center">No mappings configured</p>
        )}
      </div>

      {/* Add new mapping */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Add Mapping</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-cad-muted mb-1">Discord Role</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="">Select role...</option>
              {discordRoles.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-cad-muted mb-1">Department</label>
            <select
              value={selectedDept}
              onChange={e => setSelectedDept(e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="">Select department...</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.short_name})</option>
              ))}
            </select>
          </div>
          <button
            onClick={addMapping}
            disabled={!selectedRole || !selectedDept}
            className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {discordRoles.length === 0 && (
          <p className="text-xs text-cad-muted mt-2">Discord bot may not be connected. Roles will appear when the bot is online.</p>
        )}
      </div>
    </div>
  );
}
