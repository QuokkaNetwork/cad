import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';

const POLICE_NAV = [
  { to: '/home', label: 'Home', icon: 'M3 12l9-9 9 9M4 10v10h5v-6h6v6h5V10' },
  { to: '/dispatch', label: 'Dispatch', icon: 'M3 5h12M9 3v2m1.048 3.5A3.5 3.5 0 0116 9.5M5 21l1-4.5M19 21l-1-4.5M12 21H7l.5-2h9l.5 2h-5z' },
  { to: '/units', label: 'Units', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8zm11 4l-4.35 4.35M17 11h4m-2-2v4' },
  { to: '/search', label: 'Search', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { to: '/bolos', label: 'BOLOs', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
  { to: '/records', label: 'Records', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
];

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

  return (
    <aside className="w-56 bg-cad-surface border-r border-cad-border flex flex-col h-full">
      {/* Main navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {activeDepartment ? (
          <>
            <div className="text-xs text-cad-muted uppercase tracking-wider mb-2 px-3">
              {activeDepartment.short_name}
            </div>
            {POLICE_NAV.map(item => (
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
