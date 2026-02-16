import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import GoOnDutyModal from './GoOnDutyModal';
import { useEventSource } from '../hooks/useEventSource';

export default function Header() {
  const { user, logout, refreshUser } = useAuth();
  const { activeDepartment } = useDepartment();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [myUnit, setMyUnit] = useState(null);
  const [showOnDutyModal, setShowOnDutyModal] = useState(false);
  const [offDutyLoading, setOffDutyLoading] = useState(false);
  const [onDutyLoading, setOnDutyLoading] = useState(false);
  const onDepartmentPage = /^\/(dispatch|units|search|bolos|records)(\/|$)/.test(location.pathname);

  const refreshMyUnit = useCallback(async () => {
    if (!user) {
      setMyUnit(null);
      return;
    }

    try {
      const unit = await api.get('/api/units/me');
      setMyUnit(unit);
    } catch (err) {
      if (err?.status === 401) {
        await refreshUser();
      }
      setMyUnit(null);
    }
  }, [user, refreshUser]);

  useEffect(() => {
    refreshMyUnit();
  }, [refreshMyUnit, activeDepartment?.id]);

  const handleLiveUnitEvent = useCallback((payload) => {
    if (!user?.id) return;
    const eventUserId = payload?.unit?.user_id;
    if (!eventUserId || Number(eventUserId) === Number(user.id)) {
      refreshMyUnit();
    }
  }, [user?.id, refreshMyUnit]);

  useEventSource({
    'unit:online': handleLiveUnitEvent,
    'unit:offline': handleLiveUnitEvent,
    'unit:update': handleLiveUnitEvent,
    'sync:department': async () => {
      await refreshUser();
      await refreshMyUnit();
    },
  });

  useEffect(() => {
    if (!user) return undefined;

    const pollId = setInterval(() => {
      refreshMyUnit();
    }, 15000);

    const onFocus = () => {
      refreshUser();
      refreshMyUnit();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onFocus();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      clearInterval(pollId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user, refreshMyUnit, refreshUser]);

  useEffect(() => {
    if (!onDepartmentPage && showOnDutyModal) {
      setShowOnDutyModal(false);
    }
  }, [onDepartmentPage, showOnDutyModal]);

  async function goOffDuty() {
    setOffDutyLoading(true);
    try {
      await api.delete('/api/units/me');
      setMyUnit(null);
    } catch (err) {
      alert('Failed to go off duty: ' + err.message);
    } finally {
      setOffDutyLoading(false);
    }
  }

  async function goOnDuty() {
    if (!activeDepartment) return;

    if (!activeDepartment.is_dispatch) {
      setShowOnDutyModal(true);
      return;
    }

    setOnDutyLoading(true);
    try {
      const unit = await api.post('/api/units/me', {
        callsign: 'DISPATCH',
        department_id: activeDepartment.id,
      });
      setMyUnit(unit);
    } catch (err) {
      alert('Failed to go on duty: ' + err.message);
    } finally {
      setOnDutyLoading(false);
    }
  }

  const onActiveDeptDuty = !!(myUnit && activeDepartment && myUnit.department_id === activeDepartment.id);
  const onOtherDeptDuty = !!(myUnit && activeDepartment && myUnit.department_id !== activeDepartment.id);

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
        <div className="flex items-center gap-4">
          {activeDepartment && onDepartmentPage && (
            <>
              {onActiveDeptDuty ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                    On Duty: {myUnit.callsign}{myUnit.sub_department_short_name ? ` (${myUnit.sub_department_short_name})` : ''}
                  </span>
                  <button
                    onClick={goOffDuty}
                    disabled={offDutyLoading}
                    className="px-3 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
                  >
                    {offDutyLoading ? '...' : 'Go Off Duty'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={goOnDuty}
                  disabled={onOtherDeptDuty || onDutyLoading}
                  className="px-3 py-1.5 text-sm bg-cad-accent hover:bg-cad-accent-light text-white rounded font-medium transition-colors disabled:opacity-50"
                  title={onOtherDeptDuty ? 'You are already on duty in another department' : 'Go On Duty'}
                >
                  {onOtherDeptDuty ? 'On Duty Elsewhere' : (onDutyLoading ? '...' : 'Go On Duty')}
                </button>
              )}
            </>
          )}

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
      <GoOnDutyModal
        open={showOnDutyModal}
        onClose={() => setShowOnDutyModal(false)}
        department={activeDepartment}
        onSuccess={refreshMyUnit}
      />
    </header>
  );
}
