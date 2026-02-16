import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';
import { useEventSource } from '../hooks/useEventSource';

export default function Header() {
  const { user, logout, refreshUser } = useAuth();
  const { activeDepartment } = useDepartment();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const refreshAuth = useCallback(async () => {
    if (!user) return;
    await refreshUser();
  }, [user, refreshUser]);

  useEventSource({
    'sync:department': refreshAuth,
  });

  useEffect(() => {
    if (!user) return undefined;

    const onFocus = () => {
      refreshUser();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshUser();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, refreshUser]);

  return (
    <header>
      <div className="sillitoe-bar" />
      <div className="bg-cad-surface border-b border-cad-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-cad-gold tracking-wide">
            Quokka Networks Emergency Services CAD
          </h1>
          {activeDepartment && (
            <span
              className="text-sm font-medium px-2 py-0.5 rounded"
              style={{ backgroundColor: activeDepartment.color + '30', color: activeDepartment.color }}
            >
              {activeDepartment.short_name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-end">
          {user && (
            <div className="relative">
              <button
                onClick={() => setOpen(v => !v)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-cad-card transition-colors"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-cad-card border border-cad-border" />
                )}
                <span className="text-sm text-cad-muted">{user.steam_name}</span>
                <span className="text-cad-muted text-xs">v</span>
              </button>

              {open && (
                <div className="absolute right-0 mt-2 w-44 bg-cad-surface border border-cad-border rounded-lg shadow-lg z-50">
                  <button
                    onClick={() => { setOpen(false); navigate('/home'); }}
                    className="w-full text-left px-3 py-2 text-sm text-cad-muted hover:text-cad-ink hover:bg-cad-card rounded-t-lg transition-colors"
                  >
                    Home
                  </button>
                  <button
                    onClick={() => { setOpen(false); navigate('/settings'); }}
                    className="w-full text-left px-3 py-2 text-sm text-cad-muted hover:text-cad-ink hover:bg-cad-card transition-colors"
                  >
                    Profile Settings
                  </button>
                  <button
                    onClick={() => { setOpen(false); logout(); }}
                    className="w-full text-left px-3 py-2 text-sm text-cad-muted hover:text-cad-ink hover:bg-cad-card rounded-b-lg transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
