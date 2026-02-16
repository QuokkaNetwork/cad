import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';

const DEFAULT_STATS = Object.freeze({
  active_calls: 0,
  urgent_calls: 0,
  on_duty_units: 0,
  available_units: 0,
  assigned_units: 0,
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

export default function DepartmentHome() {
  const navigate = useNavigate();
  const { activeDepartment } = useDepartment();
  const [stats, setStats] = useState(DEFAULT_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const refreshTimerRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const slogan = String(activeDepartment?.slogan || '').trim() || getDefaultSlogan(activeDepartment, layoutType);

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

      const [callsPayload, unitsPayload] = await Promise.all([callsRequest, unitsRequest]);
      const calls = normalizeCallsPayload(callsPayload);
      const units = normalizeUnitsPayload(unitsPayload);

      const activeCalls = calls.filter(call => String(call?.status || '').toLowerCase() !== 'closed');
      const urgentCalls = activeCalls.filter((call) => {
        if (String(call?.priority || '') === '1') return true;
        return /000/i.test(String(call?.job_code || '')) || /000/i.test(String(call?.title || ''));
      });
      const availableUnits = units.filter(unit => String(unit?.status || '').toLowerCase() === 'available');
      const assignedUnits = activeCalls.reduce((total, call) => (
        total + (Array.isArray(call?.assigned_units) ? call.assigned_units.length : 0)
      ), 0);

      setStats({
        active_calls: activeCalls.length,
        urgent_calls: urgentCalls.length,
        on_duty_units: units.length,
        available_units: availableUnits.length,
        assigned_units: assignedUnits,
      });
      setLastUpdated(new Date());
    } catch (err) {
      setError(err?.message || 'Failed to load department stats');
    } finally {
      requestInFlightRef.current = false;
      setLoading(false);
    }
  }, [deptId, isDispatch]);

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
  }, [fetchStats]);

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

  useEventSource({
    'unit:online': scheduleRefresh,
    'unit:offline': scheduleRefresh,
    'unit:update': scheduleRefresh,
    'call:create': scheduleRefresh,
    'call:update': scheduleRefresh,
    'call:close': scheduleRefresh,
    'call:assign': scheduleRefresh,
    'call:unassign': scheduleRefresh,
  });

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
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
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

          <div className="bg-cad-surface border border-cad-border rounded-xl px-4 py-3 min-w-[220px]">
            <p className="text-xs text-cad-muted uppercase tracking-wider">Local Time</p>
            <p className="text-2xl font-semibold mt-1 tabular-nums">{clockTimeLabel}</p>
            <p className="text-sm text-cad-muted mt-1">{clockDateLabel}</p>
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

      <section className="bg-cad-card border border-cad-border rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => navigate(isDispatch ? '/dispatch' : '/units')}
            className="px-4 py-2 rounded-lg bg-cad-accent hover:bg-cad-accent-light text-white text-sm font-medium transition-colors"
          >
            Open Dispatch
          </button>
          <button
            onClick={() => navigate('/map')}
            className="px-4 py-2 rounded-lg bg-cad-surface border border-cad-border hover:border-cad-accent/50 text-cad-ink text-sm transition-colors"
          >
            Open Live Map
          </button>
          <button
            onClick={() => navigate('/search')}
            className="px-4 py-2 rounded-lg bg-cad-surface border border-cad-border hover:border-cad-accent/50 text-cad-ink text-sm transition-colors"
          >
            Search
          </button>
        </div>
        {error && (
          <p className="text-xs text-red-400 mt-3">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
