import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [searchParams] = useSearchParams();
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);

  const discordLinked = searchParams.get('discord') === 'linked';
  const error = searchParams.get('error');

  async function linkDiscord() {
    setLinking(true);
    try {
      const { url } = await api.post('/api/auth/link-discord');
      window.location.href = url;
    } catch (err) {
      alert('Failed to start Discord linking: ' + err.message);
      setLinking(false);
    }
  }

  async function unlinkDiscord() {
    if (!confirm('Unlink your Discord account? You will lose department access.')) return;
    setUnlinking(true);
    try {
      await api.post('/api/auth/unlink-discord');
      await refreshUser();
    } catch (err) {
      alert('Failed to unlink: ' + err.message);
    } finally {
      setUnlinking(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-bold mb-6">Settings</h2>

      {discordLinked && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 mb-4 text-sm text-emerald-400">
          Discord account linked successfully. Your department access will be synced from your Discord roles.
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4 text-sm text-red-400">
          Error: {error.replace(/_/g, ' ')}
        </div>
      )}

      {/* Steam Profile */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-4">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">Steam Account</h3>
        <div className="flex items-center gap-4">
          {user.avatar_url && (
            <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full" />
          )}
          <div>
            <p className="font-medium text-lg">{user.steam_name}</p>
            <p className="text-sm text-cad-muted font-mono">{user.steam_id}</p>
          </div>
        </div>
      </div>

      {/* Discord */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-5 mb-4">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">Discord Account</h3>
        {user.discord_id ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{user.discord_name}</p>
              <p className="text-sm text-cad-muted font-mono">{user.discord_id}</p>
            </div>
            <button
              onClick={unlinkDiscord}
              disabled={unlinking}
              className="px-3 py-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {unlinking ? 'Unlinking...' : 'Unlink'}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-cad-muted mb-3">
              Link your Discord account to sync your roles and gain department access.
            </p>
            <button
              onClick={linkDiscord}
              disabled={linking}
              className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {linking ? 'Redirecting...' : 'Link Discord Account'}
            </button>
          </div>
        )}
      </div>

      {/* Department Access */}
      <div className="bg-cad-card border border-cad-border rounded-lg p-5">
        <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-3">Department Access</h3>
        {user.departments && user.departments.length > 0 ? (
          <div className="space-y-2">
            {user.departments.map(dept => (
              <div key={dept.id} className="flex items-center gap-3 px-3 py-2 bg-cad-surface rounded">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: dept.color }}
                />
                <span className="font-medium">{dept.name}</span>
                <span className="text-sm text-cad-muted">({dept.short_name})</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-cad-muted">
            No department access. {!user.discord_id ? 'Link your Discord account first.' : 'Your Discord roles will be synced to grant access.'}
          </p>
        )}
      </div>
    </div>
  );
}
