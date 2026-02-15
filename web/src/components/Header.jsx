import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';

export default function Header() {
  const { user, logout } = useAuth();
  const { activeDepartment } = useDepartment();

  return (
    <header>
      <div className="sillitoe-bar" />
      <div className="bg-cad-surface border-b border-cad-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-cad-gold tracking-wide">
            Emergency Services CAD
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
          {user && (
            <div className="flex items-center gap-2">
              {user.avatar_url && (
                <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
              )}
              <span className="text-sm text-cad-muted">{user.steam_name}</span>
            </div>
          )}
          <button
            onClick={logout}
            className="text-xs text-cad-muted hover:text-cad-ink transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
