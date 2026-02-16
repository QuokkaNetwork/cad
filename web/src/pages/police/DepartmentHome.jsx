import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import Modal from '../../components/Modal';
import GoOnDutyModal from '../../components/GoOnDutyModal';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';

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
  const [showBoloModal, setShowBoloModal] = useState(false);
  const [savingBolo, setSavingBolo] = useState(false);
  const [boloForm, setBoloForm] = useState({
    type: 'person',
    title: '',
    description: '',
  });
  const [showWarrantModal, setShowWarrantModal] = useState(false);
  const [savingWarrant, setSavingWarrant] = useState(false);
  const [warrantForm, setWarrantForm] = useState({
    citizen_id: '',
    title: '',
    description: '',
  });
  const refreshTimerRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;
  const layoutType = getDepartmentLayoutType(activeDepartment);
  const isPoliceDepartment = layoutType === DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
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

  async function createWarrant(e) {
    e.preventDefault();
    if (!deptId) return;

    const citizenId = String(warrantForm.citizen_id || '').trim();
    const title = String(warrantForm.title || '').trim();
    if (!citizenId || !title) return;

    setSavingWarrant(true);
    try {
      await api.post('/api/warrants', {
        department_id: deptId,
        citizen_id: citizenId,
        title,
        description: String(warrantForm.description || '').trim(),
        details: {},
      });
      setShowWarrantModal(false);
      setWarrantForm({ citizen_id: '', title: '', description: '' });
      scheduleRefresh();
    } catch (err) {
      alert('Failed to create warrant: ' + err.message);
    } finally {
      setSavingWarrant(false);
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
        <div className="flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
          <div className="flex items-center gap-6 min-w-0 flex-1">
            {activeDepartment?.icon ? (
              <img
                src={activeDepartment.icon}
                alt=""
                className="w-24 h-24 rounded-2xl object-contain p-2 border border-cad-border bg-cad-surface flex-shrink-0"
              />
            ) : (
              <div className="w-24 h-24 rounded-2xl border border-cad-border bg-cad-surface flex items-center justify-center text-lg text-cad-muted flex-shrink-0">
                {activeDepartment?.short_name?.slice(0, 3) || 'DEP'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-4xl font-bold text-cad-ink truncate">
                {activeDepartment?.name || 'Department'}
              </h2>
              <p className="text-lg text-cad-muted mt-2">{slogan}</p>
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
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => setShowWarrantModal(true)}
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

      <Modal open={showWarrantModal} onClose={() => setShowWarrantModal(false)} title="Create Warrant">
        <form onSubmit={createWarrant} className="space-y-3">
          <div>
            <label className="block text-sm text-cad-muted mb-1">Citizen ID *</label>
            <input
              type="text"
              required
              value={warrantForm.citizen_id}
              onChange={(e) => setWarrantForm(f => ({ ...f, citizen_id: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cad-accent"
              placeholder="e.g. ABC12345"
            />
          </div>

          <div>
            <label className="block text-sm text-cad-muted mb-1">Title *</label>
            <input
              type="text"
              required
              value={warrantForm.title}
              onChange={(e) => setWarrantForm(f => ({ ...f, title: e.target.value }))}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
              placeholder="e.g. Warrant for arrest - Armed robbery"
            />
          </div>

          <div>
            <label className="block text-sm text-cad-muted mb-1">Description</label>
            <textarea
              value={warrantForm.description}
              onChange={(e) => setWarrantForm(f => ({ ...f, description: e.target.value }))}
              className="w-full h-24 bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent resize-none"
              placeholder="Additional details..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              disabled={savingWarrant}
              type="submit"
              className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
            >
              {savingWarrant ? 'Saving...' : 'Create Warrant'}
            </button>
            <button
              type="button"
              onClick={() => setShowWarrantModal(false)}
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
