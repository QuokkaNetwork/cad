import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';
import { useEventSource } from '../hooks/useEventSource';
import { api } from '../api/client';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../utils/departmentLayout';

const LAW_NAV = [
  { to: '/department', label: 'Home', icon: 'M3 12l9-9 9 9M4 10v10h5v-6h6v6h5V10' },
  { to: '/units', label: 'Dispatch', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm11 4l-4.35 4.35M17 11h4m-2-2v4' },
  { to: '/map', label: 'Live Map', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2' },
  { to: '/search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { to: '/voice', label: 'Voice Radio', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', dispatchOnly: true },
];

const EMS_NAV = [
  { to: '/department', label: 'Home', icon: 'M3 12l9-9 9 9M4 10v10h5v-6h6v6h5V10' },
  { to: '/units', label: 'Dispatch', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm11 4l-4.35 4.35M17 11h4m-2-2v4' },
  { to: '/map', label: 'Live Map', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2' },
  { to: '/search', label: 'Patient Analysis', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { to: '/voice', label: 'Voice Radio', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', dispatchOnly: true },
];

const FIRE_NAV = [
  { to: '/department', label: 'Home', icon: 'M3 12l9-9 9 9M4 10v10h5v-6h6v6h5V10' },
  { to: '/units', label: 'Dispatch', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm11 4l-4.35 4.35M17 11h4m-2-2v4' },
  { to: '/map', label: 'Live Map', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2' },
  { to: '/search', label: 'Lookup', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { to: '/voice', label: 'Voice Radio', icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0', dispatchOnly: true },
];

const CALL_DETAILS_NAV_ITEM = {
  to: '/call-details',
  label: 'Call Details',
  icon: 'M9 12h6m-6 4h6M8 2h8a2 2 0 012 2v16l-6-3-6 3V4a2 2 0 012-2z',
};

function getNavItemsForLayout(layoutType) {
  if (layoutType === DEPARTMENT_LAYOUT.PARAMEDICS) return EMS_NAV;
  if (layoutType === DEPARTMENT_LAYOUT.FIRE) return FIRE_NAV;
  return LAW_NAV;
}

function isEmergency000CallEvent(payload) {
  return String(payload?.call?.job_code || '').trim() === '000';
}

function SidebarLink({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? 'bg-cad-accent/20 text-cad-accent-light font-medium'
            : 'text-cad-muted hover:text-cad-ink hover:bg-cad-card'
        }`
      }
    >
      {icon && (
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      )}
      <span>{label}</span>
    </NavLink>
  );
}

export default function Sidebar() {
  const { departments } = useAuth();
  const { activeDepartment } = useDepartment();
  const [dispatcherOnline, setDispatcherOnline] = useState(false);
  const [isDispatchDepartment, setIsDispatchDepartment] = useState(false);
  const [isOnDuty, setIsOnDuty] = useState(false);
  const [hasActiveCall, setHasActiveCall] = useState(false);
  const callAssignAudioRef = useRef(null);
  const emergencyCallAudioRef = useRef(null);

  const deptId = activeDepartment?.id;
  const layoutType = getDepartmentLayoutType(activeDepartment);

  useEffect(() => {
    const callAssignAudio = new Audio('/sounds/cad-added-call.mp3');
    callAssignAudio.preload = 'auto';
    callAssignAudioRef.current = callAssignAudio;

    const emergencyCallAudio = new Audio('/sounds/000call.mp3');
    emergencyCallAudio.preload = 'auto';
    emergencyCallAudioRef.current = emergencyCallAudio;

    return () => {
      if (callAssignAudioRef.current) {
        callAssignAudioRef.current.pause();
        callAssignAudioRef.current = null;
      }
      if (emergencyCallAudioRef.current) {
        emergencyCallAudioRef.current.pause();
        emergencyCallAudioRef.current = null;
      }
    };
  }, []);

  const playCallAssignSound = useCallback(() => {
    const audio = callAssignAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const maybePromise = audio.play();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore autoplay/user gesture restrictions.
    }
  }, []);

  const playEmergencyCallSound = useCallback(() => {
    const audio = emergencyCallAudioRef.current;
    if (!audio) return;
    try {
      audio.currentTime = 0;
      const maybePromise = audio.play();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore autoplay/user gesture restrictions.
    }
  }, []);

  const fetchDispatcherStatus = useCallback(async () => {
    if (!deptId) {
      setDispatcherOnline(false);
      setIsDispatchDepartment(false);
      return;
    }

    try {
      const status = await api.get(`/api/units/dispatcher-status?department_id=${deptId}`);
      setDispatcherOnline(!!status?.dispatcher_online);
      setIsDispatchDepartment(!!status?.is_dispatch_department);
    } catch {
      // Keep sidebar usable even if dispatcher status lookup fails.
    }
  }, [deptId]);

  const fetchOnDutyStatus = useCallback(async () => {
    try {
      await api.get('/api/units/me');
      setIsOnDuty(true);
    } catch (err) {
      if (err?.status === 404 || err?.status === 401) {
        setIsOnDuty(false);
        setHasActiveCall(false);
      }
    }
  }, []);

  const fetchActiveCallStatus = useCallback(async () => {
    if (!deptId) {
      setHasActiveCall(false);
      return;
    }

    try {
      const activeCall = await api.get('/api/units/me/active-call');
      setHasActiveCall(!!activeCall?.id);
    } catch (err) {
      if (err?.status === 404 || err?.status === 401) {
        setHasActiveCall(false);
      }
    }
  }, [deptId]);

  useEffect(() => {
    fetchDispatcherStatus();
    fetchOnDutyStatus();
    fetchActiveCallStatus();
  }, [fetchDispatcherStatus, fetchOnDutyStatus, fetchActiveCallStatus]);

  useEventSource({
    'call:create': (payload) => {
      if (!isOnDuty) return;
      if (isEmergency000CallEvent(payload)) {
        playEmergencyCallSound();
      }
    },
    'unit:online': () => {
      fetchDispatcherStatus();
      fetchOnDutyStatus();
      fetchActiveCallStatus();
    },
    'unit:offline': () => {
      fetchDispatcherStatus();
      fetchOnDutyStatus();
      fetchActiveCallStatus();
    },
    'call:assign': () => {
      fetchActiveCallStatus();
      if (isOnDuty) {
        playCallAssignSound();
      }
    },
    'call:unassign': () => {
      fetchActiveCallStatus();
    },
    'call:close': () => {
      fetchActiveCallStatus();
    },
  });

  const hideUnitsTab = !!(activeDepartment && !isDispatchDepartment && dispatcherOnline);
  const baseNavItems = getNavItemsForLayout(layoutType);
  const departmentNavItems = activeDepartment?.is_dispatch
    ? baseNavItems.map(item => (item.to === '/units'
      ? { ...item, to: '/dispatch' }
      : item))
    : baseNavItems;
  const navItems = departmentNavItems.filter((item) => {
    const isDispatchTab = item.to === '/units' || item.to === '/dispatch';
    if (!isOnDuty && isDispatchTab) return false;
    if (hideUnitsTab && item.to === '/units') return false;
    // Only show voice tab for dispatch departments
    if (item.dispatchOnly && !activeDepartment?.is_dispatch) return false;
    return true;
  });

  const navWithCallDetails = hasActiveCall
    ? [...navItems, CALL_DETAILS_NAV_ITEM]
    : navItems;

  return (
    <aside className="w-56 bg-cad-surface border-r border-cad-border flex flex-col h-full">
      {/* Main navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {activeDepartment ? (
          <>
            <div className="text-xs text-cad-muted uppercase tracking-wider mb-2 px-3">
              {activeDepartment.short_name}
            </div>
            {navWithCallDetails.map(item => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </>
        ) : (
          <>
            <SidebarLink to="/home" label="Home" icon="M3 12l9-9 9 9M4 10v10h5v-6h6v6h5V10" />
          </>
        )}

        {!activeDepartment && departments.length === 0 && (
          <div className="px-3 py-4 text-sm text-cad-muted">
            <p className="mb-2">No department access.</p>
            <p>Link your Discord account in Profile Settings to get access.</p>
          </div>
        )}
      </nav>
    </aside>
  );
}
