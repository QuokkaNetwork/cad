import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import GoOnDutyModal from '../../components/GoOnDutyModal';
import OffDutySummaryModal from '../../components/OffDutySummaryModal';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';
import { formatDateAU, formatTimeAU } from '../../utils/dateTime';

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

function colorWithAlpha(color, alpha, fallback = `rgba(0,82,194,${alpha})`) {
  const value = String(color || '').trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return fallback;
  const raw = hex[1];
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function WatermarkPanel({ logo, accent, className = '', children }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-cad-card ${className}`}
      style={{ borderColor: colorWithAlpha(accent, 0.22, 'rgba(255,255,255,0.1)') }}
    >
      <div
        className="absolute inset-0 opacity-70"
        style={{ background: `linear-gradient(135deg, ${colorWithAlpha(accent, 0.08)}, transparent 55%)` }}
      />
      <div className="relative">{children}</div>
    </div>
  );
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
  const [offDutySummary, setOffDutySummary] = useState(null);
  const [onDutyLoading, setOnDutyLoading] = useState(false);
  const [offDutyLoading, setOffDutyLoading] = useState(false);
  const refreshTimerRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isPoliceDepartment = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
  const isFireDepartment = layoutType === DEPARTMENT_LAYOUT.FIRE;
  const isEmsDepartment = layoutType === DEPARTMENT_LAYOUT.PARAMEDICS;
  const slogan = String(activeDepartment?.slogan || '').trim() || getDefaultSlogan(activeDepartment, layoutType);
  const deptColor = String(activeDepartment?.color || '#0052C2').trim() || '#0052C2';
  const deptLogo = String(activeDepartment?.icon || '').trim();
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
      const warrantsRequest = isPoliceDepartment
        ? api.get(`/api/warrants?department_id=${deptId}`)
        : Promise.resolve([]);

      const [callsPayload, unitsPayload, bolosPayload, warrantsPayload] = await Promise.all([
        callsRequest,
        unitsRequest,
        bolosRequest,
        warrantsRequest,
      ]);
      const calls = normalizeCallsPayload(callsPayload);
      const units = normalizeUnitsPayload(unitsPayload);
      const bolos = normalizeBolosPayload(bolosPayload);
      const warrants = Array.isArray(warrantsPayload) ? warrantsPayload : [];

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
        active_bolos: bolos.length,
        active_warrants: warrants.length,
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
    'warrant:create': scheduleRefresh,
    'warrant:serve': scheduleRefresh,
    'warrant:cancel': scheduleRefresh,
    'sync:department': handleUnitEvent,
  });

  async function goOffDuty() {
    setOffDutyLoading(true);
    try {
      const response = await api.delete('/api/units/me');
      setMyUnit(null);
      setOffDutySummary(response?.summary || null);
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

  const clockDateLabel = useMemo(() => formatDateAU(now, '-'), [now]);
  const clockTimeLabel = useMemo(() => formatTimeAU(now, '-', true), [now]);

  const statCards = [
    { label: isFireDepartment ? 'Active Incidents' : 'Active Calls', value: stats.active_calls, tone: 'text-cad-accent-light' },
    { label: 'Urgent / 000', value: stats.urgent_calls, tone: 'text-red-400' },
    { label: isFireDepartment ? 'Crews On Duty' : 'Units On Duty', value: stats.on_duty_units, tone: 'text-emerald-400' },
    { label: isFireDepartment ? 'Crews Available' : 'Units Available', value: stats.available_units, tone: 'text-sky-400' },
    { label: isFireDepartment ? 'Crews Assigned' : 'Units Assigned', value: stats.assigned_units, tone: 'text-amber-300' },
  ];

  return (
    <div className="space-y-5 relative">
      <section
        className="relative overflow-hidden rounded-3xl border p-6"
        style={{
          borderColor: colorWithAlpha(deptColor, 0.24, 'rgba(255,255,255,0.1)'),
          background:
            `radial-gradient(circle at 15% 18%, ${colorWithAlpha(deptColor, 0.2)}, transparent 48%),` +
            `linear-gradient(180deg, rgba(18,24,36,0.96), rgba(13,17,27,0.96))`,
          boxShadow: `0 18px 44px ${colorWithAlpha(deptColor, 0.13)}`,
        }}
      >
        <div className="absolute inset-0 cad-ambient-grid opacity-50" />
        <div className="cad-ambient-orb cad-orb-float-a -top-12 -left-10 w-44 h-44" style={{ backgroundColor: colorWithAlpha(deptColor, 0.26) }} />
        <div className="cad-ambient-orb cad-orb-float-b bottom-0 right-8 w-56 h-56 bg-cad-gold/10" />
        {deptLogo ? (
          <div className="absolute right-4 top-4 bottom-4 w-[36%] hidden lg:block cad-watermark-fade">
            <img src={deptLogo} alt="" className="w-full h-full object-contain cad-watermark-image" />
          </div>
        ) : null}

        <div className="relative flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="px-3 py-1 rounded-full border border-cad-border bg-cad-surface/60 text-xs uppercase tracking-[0.16em] text-cad-muted">
                {isDispatch ? 'Dispatch' : (isFireDepartment ? 'Fire & Rescue' : (isEmsDepartment ? 'Paramedic' : 'Law Enforcement'))}
              </span>
              <span
                className="px-3 py-1 rounded-full border text-xs"
                style={{
                  borderColor: colorWithAlpha(deptColor, 0.28),
                  backgroundColor: colorWithAlpha(deptColor, 0.08),
                  color: '#d9e7ff',
                }}
              >
                {loading ? 'Syncing stats…' : `Live overview • ${stats.on_duty_units} on duty`}
              </span>
              {lastUpdated && (
                <span className="text-xs text-cad-muted">
                  Updated {formatTimeAU(lastUpdated, '-', true)}
                </span>
              )}
            </div>

            <div className="flex items-start gap-4 min-w-0">
              {deptLogo ? (
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl p-2 border bg-cad-surface/70 flex-shrink-0"
                  style={{ borderColor: colorWithAlpha(deptColor, 0.25) }}
                >
                  <img src={deptLogo} alt="" className="w-full h-full object-contain" />
                </div>
              ) : (
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border bg-cad-surface/70 flex items-center justify-center text-lg text-cad-muted flex-shrink-0"
                  style={{ borderColor: colorWithAlpha(deptColor, 0.25) }}
                >
                  {activeDepartment?.short_name?.slice(0, 3) || 'DEP'}
                </div>
              )}
              <div className="min-w-0">
                <h2 className="text-3xl sm:text-4xl font-bold text-cad-ink truncate">
                  {activeDepartment?.name || 'Department'}
                </h2>
                <p className="text-base sm:text-lg text-cad-muted mt-2 max-w-2xl">{slogan}</p>
              </div>
            </div>
          </div>

          <div className="w-full lg:w-[360px] space-y-3">
            <WatermarkPanel logo={deptLogo} accent={deptColor} className="px-4 py-3">
              <p className="text-xs text-cad-muted uppercase tracking-wider">Local Time</p>
              <p className="text-2xl font-semibold mt-1 tabular-nums">{clockTimeLabel}</p>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-sm text-cad-muted">{clockDateLabel}</p>
                {lastUpdated && (
                  <p className="text-xs text-cad-muted">
                    Refreshed {formatTimeAU(lastUpdated, '-', true)}
                  </p>
                )}
              </div>
            </WatermarkPanel>

            <WatermarkPanel logo={deptLogo} accent={deptColor} className="px-4 py-3">
              <p className="text-xs text-cad-muted uppercase tracking-wider mb-2">Duty Status</p>
              {onActiveDeptDuty ? (
                <button
                  onClick={goOffDuty}
                  disabled={offDutyLoading}
                  className="w-full px-3 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                >
                  {offDutyLoading ? '...' : 'Go Off Duty'}
                </button>
              ) : (
                <>
                  <button
                    onClick={goOnDuty}
                    disabled={onOtherDeptDuty || onDutyLoading}
                    className="w-full px-3 py-2 text-sm text-white rounded font-medium transition-colors disabled:opacity-50"
                    style={{ backgroundColor: deptColor }}
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
            </WatermarkPanel>
          </div>
        </div>
      </section>

      <div className="relative isolate">
        {deptLogo ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 bottom-0 hidden sm:flex items-center justify-center">
            <div className="w-[520px] h-[520px] cad-page-watermark-mask">
              <img src={deptLogo} alt="" className="w-full h-full object-contain cad-page-watermark-image" />
            </div>
          </div>
        ) : null}

        <div className="relative space-y-5">
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            {statCards.map((card) => (
              <WatermarkPanel key={card.label} logo={deptLogo} accent={deptColor} className="p-4 backdrop-blur-[1px]">
                <p className="text-xs text-cad-muted uppercase tracking-wider">{card.label}</p>
                <p className={`text-2xl font-semibold mt-2 ${card.tone}`}>{loading ? '...' : card.value}</p>
              </WatermarkPanel>
            ))}
          </section>

          {!isFireDepartment && !isPoliceDepartment && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <WatermarkPanel logo={deptLogo} accent={deptColor} className="p-4 backdrop-blur-[1px]">
                <p className="text-xs text-cad-muted uppercase tracking-wider">Quick Actions</p>
                <h3 className="text-lg font-semibold mt-2">Open your response workflow</h3>
                <p className="text-sm text-cad-muted mt-2">
                  Use the department tabs to manage live calls, search people or vehicles, and document outcomes as incidents progress.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/units')}
                    className="px-3 py-1.5 rounded text-white text-sm font-medium transition-colors"
                    style={{ backgroundColor: deptColor }}
                  >
                    Response Board
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/search')}
                    className="px-3 py-1.5 rounded bg-cad-surface border border-cad-border text-cad-ink text-sm hover:border-cad-accent/50 transition-colors"
                  >
                    Lookup
                  </button>
                </div>
              </WatermarkPanel>

              <WatermarkPanel logo={deptLogo} accent={deptColor} className="p-4 backdrop-blur-[1px]">
                <p className="text-xs text-cad-muted uppercase tracking-wider">Shift Snapshot</p>
                <p className="text-sm text-cad-muted mt-2">
                  {isDispatch
                    ? 'Dispatch can use this page for a live overview, then move into the dispatch board for call triage, macros, and pursuit tracking.'
                    : 'Keep this page as a quick visual snapshot of staffing, urgent work, and current activity before moving into deeper task tabs.'}
                </p>
              </WatermarkPanel>
            </section>
          )}

          {isPoliceDepartment && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <WatermarkPanel logo={deptLogo} accent={deptColor} className="p-4 backdrop-blur-[1px]">
                <p className="text-xs text-cad-muted uppercase tracking-wider">Active Warrants</p>
                <p className="text-3xl font-semibold text-amber-300 mt-2">{loading ? '...' : stats.active_warrants}</p>
                <p className="text-sm text-cad-muted mt-2">
                  Track outstanding warrants and create new entries from this department.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => navigate('/warrants?new=1')}
                    className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors"
                  >
                    + New Warrant
                  </button>
                  <button
                    onClick={() => navigate('/warrants')}
                    className="px-3 py-1.5 rounded bg-cad-surface border border-cad-border hover:border-amber-500/50 text-cad-ink text-xs transition-colors"
                  >
                    View Warrants
                  </button>
                </div>
              </WatermarkPanel>

              <WatermarkPanel logo={deptLogo} accent={deptColor} className="p-4 backdrop-blur-[1px]">
                <p className="text-xs text-cad-muted uppercase tracking-wider">Active POIs</p>
                <p className="text-3xl font-semibold text-cad-accent-light mt-2">{loading ? '...' : stats.active_bolos}</p>
                <p className="text-sm text-cad-muted mt-2">
                  Create and manage person or vehicle interest notices linked to ongoing investigations.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => navigate('/bolos?new=1')}
                    className="px-3 py-1.5 rounded bg-cad-accent hover:bg-cad-accent-light text-white text-xs font-medium transition-colors"
                  >
                    + New POI
                  </button>
                  <button
                    onClick={() => navigate('/bolos')}
                    className="px-3 py-1.5 rounded bg-cad-surface border border-cad-border hover:border-cad-accent/50 text-cad-ink text-xs transition-colors"
                  >
                    View POIs
                  </button>
                </div>
              </WatermarkPanel>
            </section>
          )}

          {isFireDepartment && (
            <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-3">
              <WatermarkPanel logo={deptLogo} accent={deptColor} className="p-4 backdrop-blur-[1px]">
                <p className="text-xs text-cad-muted uppercase tracking-wider">Fire Workflow</p>
                <h3 className="text-lg font-semibold mt-2">Respond, report, then pre-plan.</h3>
                <p className="text-sm text-cad-muted mt-2">
                  Use the Response Board for live incidents, Incident Reports for post-incident documentation, and Lookup for people/vehicle context tied to incidents.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/units')}
                    className="px-3 py-1.5 rounded text-white text-sm font-medium transition-colors"
                    style={{ backgroundColor: deptColor }}
                  >
                    Open Response Board
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/records')}
                    className="px-3 py-1.5 rounded bg-cad-surface border border-cad-border hover:border-cad-accent/50 text-cad-ink text-sm transition-colors"
                  >
                    Incident Reports
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/search')}
                    className="px-3 py-1.5 rounded bg-cad-surface border border-cad-border hover:border-cad-accent/50 text-cad-ink text-sm transition-colors"
                  >
                    Lookup
                  </button>
                </div>
              </WatermarkPanel>

              <WatermarkPanel logo={deptLogo} accent={deptColor} className="p-4 backdrop-blur-[1px]">
                <p className="text-xs text-cad-muted uppercase tracking-wider">Planning Tabs</p>
                <p className="text-sm text-cad-muted mt-2">
                  Apparatus and Pre-Plans are available as dedicated fire tabs and currently act as guided workflow hubs while the full backend modules are being built.
                </p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/fire-apparatus')}
                    className="px-3 py-1.5 rounded border border-cad-border text-sm hover:bg-cad-surface"
                  >
                    Apparatus
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/fire-preplans')}
                    className="px-3 py-1.5 rounded border border-cad-border text-sm hover:bg-cad-surface"
                  >
                    Pre-Plans
                  </button>
                </div>
              </WatermarkPanel>
            </section>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 whitespace-pre-wrap">{error}</p>
      )}

      <GoOnDutyModal
        open={showOnDutyModal}
        onClose={() => setShowOnDutyModal(false)}
        department={activeDepartment}
        onSuccess={async () => {
          await refreshMyUnit();
          scheduleRefresh();
        }}
      />

      <OffDutySummaryModal
        open={!!offDutySummary}
        summary={offDutySummary}
        onClose={() => setOffDutySummary(null)}
      />
    </div>
  );
}
