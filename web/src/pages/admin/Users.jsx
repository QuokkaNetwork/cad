import { useState, useEffect } from 'react';
import { api } from '../../api/client';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');

  async function fetchUsers() {
    try {
      const data = await api.get('/api/admin/users');
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function toggleAdmin(userId, isAdmin) {
    try {
      await api.patch(`/api/admin/users/${userId}`, { is_admin: !isAdmin });
      fetchUsers();
    } catch (err) {
      alert('Failed to update user: ' + err.message);
    }
  }

  async function toggleBan(userId, isBanned) {
    try {
      await api.patch(`/api/admin/users/${userId}`, { is_banned: !isBanned });
      fetchUsers();
    } catch (err) {
      alert('Failed to update user: ' + err.message);
    }
  }

  const filtered = users.filter(u =>
    u.steam_name.toLowerCase().includes(search.toLowerCase()) ||
    u.discord_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.steam_id.includes(search)
  );

  return (
    <div>
      <h2 className="text-xl font-bold mb-6">User Management</h2>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search users..."
        className="w-full max-w-md bg-cad-card border border-cad-border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:border-cad-accent"
      />

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-cad-border text-left text-xs text-cad-muted uppercase tracking-wider">
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Steam ID</th>
              <th className="px-3 py-2">Discord</th>
              <th className="px-3 py-2">Departments</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(user => (
              <tr key={user.id} className={`border-b border-cad-border/50 ${user.is_banned ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {user.avatar_url && <img src={user.avatar_url} alt="" className="w-6 h-6 rounded-full" />}
                    <span className="font-medium">{user.steam_name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-cad-muted">{user.steam_id}</td>
                <td className="px-3 py-2 text-cad-muted">{user.discord_name || '-'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1 flex-wrap">
                    {user.departments?.map(d => (
                      <span key={d.id} className="text-xs px-1.5 py-0.5 rounded bg-cad-surface" style={{ color: d.color }}>
                        {d.short_name}
                      </span>
                    ))}
                    {(!user.departments || user.departments.length === 0) && <span className="text-xs text-cad-muted">-</span>}
                  </div>
                </td>
                <td className="px-3 py-2">
                  {user.is_admin ? (
                    <span className="text-xs px-2 py-0.5 bg-cad-gold/20 text-cad-gold rounded">Admin</span>
                  ) : (
                    <span className="text-xs text-cad-muted">User</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleAdmin(user.id, user.is_admin)}
                      className="text-xs px-2 py-1 bg-cad-surface text-cad-muted hover:text-cad-ink rounded transition-colors"
                    >
                      {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                    <button
                      onClick={() => toggleBan(user.id, user.is_banned)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        user.is_banned
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      }`}
                    >
                      {user.is_banned ? 'Unban' : 'Ban'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
