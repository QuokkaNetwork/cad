import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';
import { api } from '../api/client';

function DepartmentCard({ dept, onSelect }) {
  const logo = dept.icon && dept.icon.trim();

  return (
    <button
      onClick={() => onSelect(dept)}
      className="w-full text-left bg-cad-card border border-cad-border rounded-2xl p-5 min-h-[150px] hover:border-cad-accent/60 hover:bg-cad-surface transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {logo ? (
            <img src={logo} alt="" className="w-10 h-10 rounded-xl object-contain p-0.5 bg-cad-surface border border-cad-border" />
          ) : (
            <div className="w-10 h-10 rounded-xl border border-cad-border bg-cad-surface flex items-center justify-center text-xs text-cad-muted">
              {dept.short_name?.slice(0, 3) || 'DEP'}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{dept.name}</h3>
            <p className="text-sm text-cad-muted truncate">{dept.short_name || 'Department'}</p>
          </div>
        </div>
        <span className="w-3 h-3 rounded-full mt-1.5" style={{ backgroundColor: dept.color || '#0052C2' }} />
      </div>
      <p className="text-xs text-cad-muted mt-4">Open department workspace</p>
    </button>
  );
}

function SetupPrompt({ user, onLinked }) {
  const [linking, setLinking] = useState(false);
  const hasDiscord = !!user?.discord_id;

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

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-vicpol-navy flex items-center justify-center">
          {!hasDiscord ? (
            <svg className="w-10 h-10 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 text-cad-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold mb-2">
          {!hasDiscord ? 'Welcome to CAD' : 'No Department Access'}
        </h2>
        <p className="text-cad-muted mb-8">
          {!hasDiscord
            ? 'Link your Discord account to get started. Your Discord roles determine which departments you can access.'
            : 'Your Discord account is linked, but you don\'t have access to any departments yet. Make sure you have the correct roles in Discord.'}
        </p>

        {/* Action */}
        {!hasDiscord ? (
          <div className="space-y-4">
            <button
              onClick={linkDiscord}
              disabled={linking}
              className="inline-flex items-center gap-3 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-medium transition-colors disabled:opacity-50 w-full justify-center"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
              </svg>
              {linking ? 'Redirecting to Discord...' : 'Link Discord Account'}
            </button>

            {/* Steps */}
            <div className="bg-cad-card border border-cad-border rounded-xl p-4 text-left">
              <p className="text-xs font-semibold text-cad-ink mb-3 uppercase tracking-wider">How it works</p>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xs font-bold">1</span>
                  <p className="text-sm text-cad-muted">Link your Discord account using the button above</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xs font-bold">2</span>
                  <p className="text-sm text-cad-muted">Your Discord roles are synced to grant department access</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#5865F2]/20 text-[#5865F2] flex items-center justify-center text-xs font-bold">3</span>
                  <p className="text-sm text-cad-muted">Select a department and start using the CAD</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-cad-card border border-cad-border rounded-xl p-4 text-left">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#5865F2]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium">{user.discord_name}</p>
                  <p className="text-xs text-cad-muted">Discord linked</p>
                </div>
              </div>
              <p className="text-sm text-cad-muted">
                Ask a server administrator to ensure your Discord roles are mapped to departments, or check that you have the correct roles in the Discord server.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user, departments, isAdmin, refreshUser } = useAuth();
  const { setActiveDepartment } = useDepartment();

  function selectDepartment(dept) {
    setActiveDepartment(dept);
    navigate(dept?.is_dispatch ? '/dispatch' : '/units');
  }

  const needsSetup = !user?.discord_id || departments.length === 0;

  // Show setup prompt if no discord or no departments (unless admin — they can still access admin panel)
  if (needsSetup && !isAdmin) {
    return (
      <div className="w-full">
        <div className="max-w-6xl mx-auto">
          <SetupPrompt user={user} onLinked={refreshUser} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        {/* Show setup banner at top if admin has no discord/departments but can still access admin */}
        {needsSetup && isAdmin && (
          <SetupBanner user={user} />
        )}
        <div className="mb-5">
          <h2 className="text-xl font-bold">Departments</h2>
          <p className="text-sm text-cad-muted">Select a department to open the workspace.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {departments.map(dept => (
            <DepartmentCard key={dept.id} dept={dept} onSelect={selectDepartment} />
          ))}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full text-left bg-cad-card border border-cad-border rounded-2xl p-5 min-h-[150px] hover:border-cad-gold/60 hover:bg-cad-surface transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Administration</h3>
                  <p className="text-sm text-cad-muted">Admin dashboard</p>
                </div>
                <span className="w-3 h-3 rounded-full mt-1.5 bg-cad-gold" />
              </div>
              <p className="text-xs text-cad-muted mt-4">Open admin sections as cards</p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SetupBanner({ user }) {
  const [linking, setLinking] = useState(false);
  const hasDiscord = !!user?.discord_id;

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

  return (
    <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-xl p-4 mb-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <svg className="w-5 h-5 text-[#5865F2] flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
        </svg>
        <p className="text-sm text-[#5865F2]">
          {!hasDiscord
            ? 'Link your Discord account to access departments.'
            : 'No department access yet. Ensure your Discord roles are mapped.'}
        </p>
      </div>
      {!hasDiscord && (
        <button
          onClick={linkDiscord}
          disabled={linking}
          className="flex-shrink-0 px-4 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {linking ? 'Redirecting...' : 'Link Discord'}
        </button>
      )}
    </div>
  );
}
