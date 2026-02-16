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
];

const EMS_NAV = [
  { to: '/department', label: 'Home', icon: 'M3 12l9-9 9 9M4 10v10h5v-6h6v6h5V10' },
  { to: '/units', label: 'Dispatch', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm11 4l-4.35 4.35M17 11h4m-2-2v4' },
  { to: '/map', label: 'Live Map', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2' },
  { to: '/search', label: 'Patient Lookup', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
];

const FIRE_NAV = [
  { to: '/department', label: 'Home', icon: 'M3 12l9-9 9 9M4 10v10h5v-6h6v6h5V10' },
  { to: '/units', label: 'Dispatch', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm11 4l-4.35 4.35M17 11h4m-2-2v4' },
  { to: '/map', label: 'Live Map', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 01.553-.894L9 2m0 18l6-3m-6 3V2m6 15l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 2' },
  { to: '/search', label: 'Lookup', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
];

function getNavItemsForLayout(layoutType) {
  if (layoutType === DEPARTMENT_LAYOUT.PARAMEDICS) return EMS_NAV;
  if (layoutType === DEPARTMENT_LAYOUT.FIRE) return FIRE_NAV;
  return LAW_NAV;
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
  const prevDispatcherOnlineRef = useRef(null);

  const deptId = activeDepartment?.id;
  const layoutType = getDepartmentLayoutType(activeDepartment);

  const fetchDispatcherStatus = useCallback(async () => {
    if (!deptId) {
      setDispatcherOnline(false);
      setIsDispatchDepartment(false);
      prevDispatcherOnlineRef.current = null;
      return;
    }

    try {
      const status = await api.get(`/api/units/dispatcher-status?department_id=${deptId}`);
      const nextOnline = !!status?.dispatcher_online;
      const nextIsDispatchDepartment = !!status?.is_dispatch_department;

      setDispatcherOnline(nextOnline);
      setIsDispatchDepartment(nextIsDispatchDepartment);

      const prevOnline = prevDispatcherOnlineRef.current;
      prevDispatcherOnlineRef.current = nextOnline;

      // If a dispatcher just came online, reload so department layouts/tabs refresh immediately.
      if (!nextIsDispatchDepartment && prevOnline === false && nextOnline) {
        window.location.reload();
      }
    } catch {
      // Keep sidebar usable even if dispatcher status lookup fails.
    }
  }, [deptId]);

  const fetchOnDutyStatus = useCallback(async () => {
    try {
      await api.get('/api/units/me');
      setIsOnDuty(true);
    } catch {
      setIsOnDuty(false);
    }
  }, []);

  useEffect(() => {
    fetchDispatcherStatus();
    fetchOnDutyStatus();
  }, [fetchDispatcherStatus, fetchOnDutyStatus]);

  useEventSource({
    'unit:online': () => {
      fetchDispatcherStatus();
      fetchOnDutyStatus();
    },
    'unit:offline': () => {
      fetchDispatcherStatus();
      fetchOnDutyStatus();
    },
    'unit:update': () => {
      fetchOnDutyStatus();
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
    return true;
  });

  return (
    <aside className="w-56 bg-cad-surface border-r border-cad-border flex flex-col h-full">
      {/* Main navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {activeDepartment ? (
          <>
            <div className="text-xs text-cad-muted uppercase tracking-wider mb-2 px-3">
              {activeDepartment.short_name}
            </div>
            {navItems.map(item => (
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
