import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import GoOnDutyModal from '../../components/GoOnDutyModal';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';

const UNIT_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'enroute', label: 'En Route' },
  { value: 'on-scene', label: 'On Scene' },
];

const DEFAULT_STATS = Object.freeze({
  active_calls: 0,
  urgent_calls: 0,
  on_duty_units: 0,
  available_units: 0,
  assigned_units: 0,
  active_bolos: 0,
  active_warrants: 0,
});
const REFRESH_DEBOUNCE_MS = 350;

function getDefaultSlogan(department, layoutType) {
  if (department?.is_dispatch) return 'Coordinating every response in real time.';
  if (layoutType === DEPARTMENT_LAYOUT.PARAMEDICS) return 'Care when every second counts.';
  if (layoutType === DEPARTMENT_LAYOUT.FIRE) return 'Ready to respond, built to protect.';
  return 'Protecting the community with professionalism and integrity.';
}

function normalizeUnitsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.units)) return payload.units;
  return [];
}

function normalizeCallsPayload(payload) {
  if (Array.isArray(payload)) return payload;
  return [];
}

function normalizeBolosPayload(payload) {
  if (Array.isArray(payload)) return payload;
  return [];
}

export default function DepartmentHome() {
  const navigate = useNavigate();
  const { activeDepartment } = useDepartment();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [myUnit, setMyUnit] = useState(null);
  const [showOnDutyModal, setShowOnDutyModal] = useState(false);
  const [onDutyLoading, setOnDutyLoading] = useState(false);
  const [offDutyLoading, setOffDutyLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState('');
  const [showBoloModal, setShowBoloModal] = useState(false);
  const [savingBolo, setSavingBolo] = useState(false);
  const [boloForm, setBoloForm] = useState({
    type: 'person',
    title: '',
    description: '',
  });
  const refreshTimerRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isPoliceDepartment = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT && !isDispatch;
  const slogan = String(activeDepartment?.slogan || '').trim() || getDefaultSlogan(activeDepartment, layoutType);
  const onActiveDeptDuty = !!(myUnit && activeDepartment && myUnit.department_id === activeDepartment.id);
  const onOtherDeptDuty = !!(myUnit && activeDepartment && myUnit.department_id !== activeDepartment.id);

  const refreshMyUnit = useCallback(async () => {
    try {
      const unit = await api.get('/api/units/me');
      setMyUnit(unit);
    } catch {
      setMyUnit(null);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    if (!deptId || requestInFlightRef.current) return;

    requestInFlightRef.current = true;
    setError('');
    try {
      const callsRequest = isDispatch
        ? api.get(`/api/calls?department_id=${deptId}&dispatch=true`)
        : api.get(`/api/calls?department_id=${deptId}`);
      const unitsRequest = isDispatch
        ? api.get('/api/units/dispatchable')
        : api.get(`/api/units?department_id=${deptId}`);
      const bolosRequest = isPoliceDepartment
        ? api.get(`/api/bolos?department_id=${deptId}`)
        : Promise.resolve([]);

      const [callsPayload, unitsPayload, bolosPayload] = await Promise.all([
        callsRequest,
        unitsRequest,
        bolosRequest,
      ]);
      const calls = normalizeCallsPayload(callsPayload);
      const units = normalizeUnitsPayload(unitsPayload);
      const bolos = normalizeBolosPayload(bolosPayload);

      const activeCalls = calls.filter(call => String(call?.status || '').toLowerCase() !== 'closed');
      const urgentCalls = activeCalls.filter((call) => {
        if (String(call?.priority || '') === '1') return true;
        return /000/i.test(String(call?.job_code || '')) || /000/i.test(String(call?.title || ''));
      });
      const availableUnits = units.filter(unit => String(unit?.status || '').toLowerCase() === 'available');
      const assignedUnits = activeCalls.reduce((total, call) => (
        total + (Array.isArray(call?.assigned_units) ? call.assigned_units.length : 0)
      ), 0);
      const activeWarrants = bolos.filter(
        bolo => String(bolo?.type || '').toLowerCase() === 'person'
      ).length;

      setStats({
        active_calls: activeCalls.length,
        urgent_calls: urgentCalls.length,
        on_duty_units: units.length,
        available_units: availableUnits.length,
        assigned_units: assignedUnits,
        active_bolos: bolos.length,
        active_warrants: activeWarrants,
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to load department stats');
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [deptId, isDispatch, isPoliceDepartment]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      fetchStats();
    }, REFRESH_DEBOUNCE_MS);
  }, [fetchStats]);

  useEffect(() => {
    setLoading(true);
    setStats(DEFAULT_STATS);
    setLastUpdated(null);
    fetchStats();
    refreshMyUnit();
  }, [fetchStats, refreshMyUnit]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const handleUnitEvent = useCallback(() => {
    refreshMyUnit();
    scheduleRefresh();
  }, [refreshMyUnit, scheduleRefresh]);

  useEventSource({
    'unit:online': handleUnitEvent,
    'unit:offline': handleUnitEvent,
    'unit:update': handleUnitEvent,
    'call:create': scheduleRefresh,
    'call:update': scheduleRefresh,
    'call:close': scheduleRefresh,
    'call:assign': scheduleRefresh,
    'call:unassign': scheduleRefresh,
    'bolo:create': scheduleRefresh,
    'bolo:resolve': scheduleRefresh,
    'bolo:cancel': scheduleRefresh,
    'sync:department': handleUnitEvent,
  });

  async function goOffDuty() {
    setOffDutyLoading(true);
    try {
      await api.delete('/api/units/me');
      setMyUnit(null);
      scheduleRefresh();
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
      scheduleRefresh();
    } catch (err) {
      alert('Failed to go on duty: ' + err.message);
    } finally {
      setOnDutyLoading(false);
    }
  }

  async function updateStatus(status) {
    if (!status || !myUnit) return;
    setStatusLoading(status);
    try {
      await api.patch('/api/units/me', { status });
      await refreshMyUnit();
      scheduleRefresh();
    } catch (err) {
      alert('Failed to update status: ' + err.message);
    } finally {
      setStatusLoading('');
    }
  }

  async function createBolo(e) {
    e.preventDefault();
    if (!deptId) return;

    const title = String(boloForm.title || '').trim();
    if (!title) return;

    setSavingBolo(true);
    try {
      await api.post('/api/bolos', {
        department_id: deptId,
        type: boloForm.type,
        title,
        description: String(boloForm.description || '').trim(),
        details: {},
      });
      setShowBoloModal(false);
      setBoloForm({ type: 'person', title: '', description: '' });
      scheduleRefresh();
    } catch (err) {
      alert('Failed to create BOLO: ' + err.message);
    } finally {
      setSavingBolo(false);
    }
  }

  const clockDateLabel = useMemo(() => now.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }), [now]);
  const clockTimeLabel = useMemo(() => now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }), [now]);

  const statCards = [
    { label: 'Active Calls', value: stats.active_calls, tone: 'text-cad-accent-light' },
    { label: 'Urgent / 000', value: stats.urgent_calls, tone: 'text-red-400' },
    { label: 'Units On Duty', value: stats.on_duty_units, tone: 'text-emerald-400' },
    { label: 'Units Available', value: stats.available_units, tone: 'text-sky-400' },
    { label: 'Units Assigned', value: stats.assigned_units, tone: 'text-amber-300' },
  ];

  return (
    <div className="space-y-5">
      <section className="bg-cad-card border border-cad-border rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row gap-6 lg:items-start lg:justify-between">
          <div className="flex items-start gap-4 min-w-0">
            {activeDepartment?.icon ? (
              <img
                src={activeDepartment.icon}
                alt=""
                className="w-16 h-16 rounded-2xl object-contain p-1.5 border border-cad-border bg-cad-surface flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl border border-cad-border bg-cad-surface flex items-center justify-center text-sm text-cad-muted flex-shrink-0">
                {activeDepartment?.short_name?.slice(0, 3) || 'DEP'}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-cad-ink truncate">
                {activeDepartment?.name || 'Department'}
              </h2>
              <p className="text-sm text-cad-muted mt-1">{slogan}</p>
              <div className="flex items-center gap-2 mt-3">
                <span
                  className="text-xs px-2 py-1 rounded font-mono"
                  style={{
                    backgroundColor: `${activeDepartment?.color || '#0052C2'}2a`,
                    color: activeDepartment?.color || '#0052C2',
                    border: `1px solid ${(activeDepartment?.color || '#0052C2')}55`,
                  }}
                >
                  {activeDepartment?.short_name || 'Department'}
                </span>
                {lastUpdated && (
                  <span className="text-xs text-cad-muted">
                    Updated {lastUpdated.toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[340px] space-y-3">
            <div className="bg-cad-surface border border-cad-border rounded-xl px-4 py-3">
              <p className="text-xs text-cad-muted uppercase tracking-wider">Local Time</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">{clockTimeLabel}</p>
              <p className="text-sm text-cad-muted mt-1">{clockDateLabel}</p>
            </div>

            <div className="bg-cad-surface border border-cad-border rounded-xl px-4 py-3">
              <p className="text-xs text-cad-muted uppercase tracking-wider mb-2">Duty</p>
              {onActiveDeptDuty ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
                      On Duty: {myUnit.callsign}{myUnit.sub_department_short_name ? ` (${myUnit.sub_department_short_name})` : ''}
                    </span>
                    <button
                      onClick={goOffDuty}
                      disabled={offDutyLoading}
                      className="px-2.5 py-1 text-xs bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {offDutyLoading ? '...' : 'Go Off Duty'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {UNIT_STATUSES.map((status) => {
                      const selected = myUnit.status === status.value;
                      const disabled = selected || !!statusLoading;
                      return (
                        <button
                          key={status.value}
                          onClick={() => updateStatus(status.value)}
                          disabled={disabled}
                          className={`text-xs px-2 py-1 rounded transition-colors ${
                            selected
                              ? 'bg-cad-accent/20 text-cad-accent-light cursor-default'
                              : 'bg-cad-card text-cad-muted hover:text-cad-ink hover:bg-cad-border'
                          } ${statusLoading && !selected ? 'opacity-60' : ''}`}
                        >
                          {statusLoading === status.value ? '...' : status.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={goOnDuty}
                    disabled={onOtherDeptDuty || onDutyLoading}
                    className="w-full px-3 py-2 text-sm bg-cad-accent hover:bg-cad-accent-light text-white rounded font-medium transition-colors disabled:opacity-50"
                    title={onOtherDeptDuty ? 'You are already on duty in another department' : 'Go On Duty'}
                  >
                    {onOtherDeptDuty ? 'On Duty Elsewhere' : (onDutyLoading ? '...' : 'Go On Duty')}
                  </button>
                  {onOtherDeptDuty && (
                    <p className="text-xs text-cad-muted mt-2">
                      You are on duty in another department.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        {statCards.map((card) => (
          <div key={card.label} className="bg-cad-card border border-cad-border rounded-xl p-4">
            <p className="text-xs text-cad-muted uppercase tracking-wider">{card.label}</p>
            <p className={`text-2xl font-semibold mt-2 ${card.tone}`}>{loading ? '...' : card.value}</p>
          </div>
        ))}
      </section>

      {isPoliceDepartment && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-cad-card border border-cad-border rounded-xl p-4">
            <p className="text-xs text-cad-muted uppercase tracking-wider">Active Warrants</p>
            <p className="text-3xl font-semibold text-amber-300 mt-2">{loading ? '...' : stats.active_warrants}</p>
            <p className="text-xs text-cad-muted mt-2">Derived from active person BOLO entries.</p>
          </div>

          <div className="bg-cad-card border border-cad-border rounded-xl p-4">
            <p className="text-xs text-cad-muted uppercase tracking-wider">Active BOLOs</p>
            <p className="text-3xl font-semibold text-cad-accent-light mt-2">{loading ? '...' : stats.active_bolos}</p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setShowBoloModal(true)}
                className="px-3 py-1.5 rounded bg-cad-accent hover:bg-cad-accent-light text-white text-xs font-medium transition-colors"
              >
                + New BOLO
              </button>
              <button
                onClick={() => navigate('/bolos')}
                className="px-3 py-1.5 rounded bg-cad-surface border border-cad-border hover:border-cad-accent/50 text-cad-ink text-xs transition-colors"
              >
                View BOLOs
              </button>
            </div>
          </div>
        </section>
      )}

      {error && (
        <p className="text-xs text-red-400 whitespace-pre-wrap">{error}</p>
      )}

      <Modal open={showBoloModal} onClose={() => setShowBoloModal(false)} title="Create BOLO">
        <form onSubmit={createBolo} className="space-y-3">
          <div className="flex bg-cad-surface rounded-lg border border-cad-border overflow-hidden">
            <button
              type="button"
              onClick={() => setBoloForm(f => ({ ...f, type: 'person' }))}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                boloForm.type === 'person' ? 'bg-amber-500/20 text-amber-300' : 'text-cad-muted'
              }`}
            >
              Person
            </button>
            <button
              type="button"
              onClick={() => setBoloForm(f => ({ ...f, type: 'vehicle' }))}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                boloForm.type === 'vehicle' ? 'bg-blue-500/20 text-blue-300' : 'text-cad-muted'
              }`}
            >
              Vehicle
            </button>
          </div>

          <div>
            <label className="block text-sm text-cad-muted mb-1">Title *</label>
            <input
              type="text"
              required
              value={boloForm.title}
              onChange={(e) => setBoloForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder={boloForm.type === 'person' ? 'e.g. Wanted male in red hoodie' : 'e.g. Stolen black Sultan'}
            />
          </div>

          <div>
            <label className="block text-sm text-cad-muted mb-1">Description</label>
            <textarea
              value={boloForm.description}
              onChange={(e) => setBoloForm(f => ({ ...f, description: e.target.value }))}
              className="w-full h-24 bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
              placeholder="Additional details..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              disabled={savingBolo}
              type="submit"
              className="flex-1 px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {savingBolo ? 'Saving...' : 'Create BOLO'}
            </button>
            <button
              type="button"
              onClick={() => setShowBoloModal(false)}
              className="px-4 py-2 bg-cad-card hover:bg-cad-border text-cad-muted rounded text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <GoOnDutyModal
        open={showOnDutyModal}
        onClose={() => setShowOnDutyModal(false)}
        department={activeDepartment}
        onSuccess={async () => {
          await refreshMyUnit();
          scheduleRefresh();
        }}
      />
    </div>
  );
}
