import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import AdminPageHeader from '../../components/AdminPageHeader';

function renderJobTarget(mapping) {
  const jobName = String(mapping.job_name || '').trim() || 'Unspecified';
  return `${jobName} / Rank ${Number(mapping.job_grade || 0)}`;
}

export default function AdminJobBindings() {
  const { key: locationKey } = useLocation();
  const [mappings, setMappings] = useState([]);
  const [discordRoles, setDiscordRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [jobName, setJobName] = useState('');
  const [jobGrade, setJobGrade] = useState('0');
  const [syncing, setSyncing] = useState(false);

  async function fetchData() {
    try {
      const mappingsData = await api.get('/api/admin/role-mappings');
      setMappings((mappingsData || []).filter(m => m.target_type === 'job'));

      try {
        const rolesData = await api.get('/api/admin/discord/roles');
        setDiscordRoles(rolesData);
      } catch {
        // Bot may not be running.
      }
    } catch (err) {
      console.error('Failed to load job bindings:', err);
    }
  }

  useEffect(() => { fetchData(); }, [locationKey]);

  const canAddMapping = useMemo(() => {
    if (!selectedRole) return false;
    const name = String(jobName || '').trim();
    return name.length > 0 && Number(jobGrade) >= 0;
  }, [selectedRole, jobName, jobGrade]);

  async function addMapping() {
    if (!canAddMapping) return;
    const role = discordRoles.find(r => r.id === selectedRole);
    try {
      await api.post('/api/admin/role-mappings', {
        discord_role_id: selectedRole,
        discord_role_name: role?.name || '',
        target_type: 'job',
        job_name: String(jobName || '').trim(),
        job_grade: Math.max(0, Number(jobGrade || 0)),
      });
      setSelectedRole('');
      setJobName('');
      setJobGrade('0');
      fetchData();
    } catch (err) {
      alert('Failed to create job binding: ' + err.message);
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
      <AdminPageHeader
        title="Job Bindings"
        subtitle="Bind Discord roles directly to in-game jobs and ranks."
      />

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={syncAll}
          disabled={syncing}
          className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync All Members'}
        </button>
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-cad-border">
          <h3 className="text-sm font-semibold">Current Job Bindings</h3>
        </div>
        {mappings.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-cad-border text-left text-xs text-cad-muted uppercase tracking-wider">
                <th className="px-4 py-2">Discord Role</th>
                <th className="px-4 py-2">Role ID</th>
                <th className="px-4 py-2">Job Target</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {mappings.map(m => (
                <tr key={m.id} className="border-b border-cad-border/50">
                  <td className="px-4 py-2 font-medium">{m.discord_role_name || '-'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-cad-muted">{m.discord_role_id}</td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-cad-ink">{renderJobTarget(m)}</span>
                  </td>
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
          <p className="px-4 py-6 text-sm text-cad-muted text-center">No job bindings configured</p>
        )}
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg p-4">
        <h3 className="text-sm font-semibold mb-3">Add Job Binding</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
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
          <div>
            <label className="block text-xs text-cad-muted mb-1">Job Name</label>
            <input
              type="text"
              value={jobName}
              onChange={e => setJobName(e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder="police"
            />
          </div>
          <div>
            <label className="block text-xs text-cad-muted mb-1">Job Rank</label>
            <input
              type="number"
              min="0"
              value={jobGrade}
              onChange={e => setJobGrade(e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <button
              onClick={addMapping}
              disabled={!canAddMapping}
              className="w-full px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              Add Binding
            </button>
          </div>
        </div>
        <p className="text-xs text-cad-muted mt-2">
          Example: map Discord role <span className="font-mono">Super Intendent</span> to job <span className="font-mono">police</span> rank <span className="font-mono">5</span>.
        </p>
        <p className="text-xs text-cad-muted mt-3">
          Removing a mapped role will queue the role-removal fallback job target (default: <span className="font-mono">unemployed</span> rank <span className="font-mono">0</span>).
        </p>
        {discordRoles.length === 0 && (
          <p className="text-xs text-cad-muted mt-2">Discord bot may not be connected. Roles will appear when the bot is online.</p>
        )}
      </div>
    </div>
  );
}
