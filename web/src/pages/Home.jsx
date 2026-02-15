import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';

function DepartmentCard({ dept, onSelect }) {
  const logo = dept.icon && dept.icon.trim();

  return (
    <button
      onClick={() => onSelect(dept)}
      className="w-full text-left bg-cad-card border border-cad-border rounded-2xl p-5 hover:border-cad-accent/60 hover:bg-cad-surface transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {logo ? (
            <img src={logo} alt="" className="w-10 h-10 rounded-xl object-cover bg-cad-surface border border-cad-border" />
          ) : (
            <div className="w-10 h-10 rounded-xl border border-cad-border bg-cad-surface flex items-center justify-center text-xs text-cad-muted">
              {dept.short_name?.slice(0, 3) || 'DEP'}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold truncate">{dept.name}</h3>
            <p className="text-sm text-cad-muted truncate">{dept.short_name || 'Department'}</p>
          </div>
        </div>
        <span className="w-3 h-3 rounded-full mt-1.5" style={{ backgroundColor: dept.color || '#0052C2' }} />
      </div>
      <p className="text-xs text-cad-muted mt-4">Open department workspace</p>
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { departments, isAdmin } = useAuth();
  const { setActiveDepartment, activeDepartment } = useDepartment();

  function selectDepartment(dept) {
    setActiveDepartment(dept);
    navigate('/dispatch');
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Home</h2>
        <p className="text-sm text-cad-muted mt-1">Select a department to enter the CAD tools.</p>
      </div>

      {activeDepartment && (
        <div className="mb-5 text-sm text-cad-muted">
          Active department:
          <span className="ml-2 px-2 py-0.5 rounded" style={{ backgroundColor: `${activeDepartment.color || '#0052C2'}30`, color: activeDepartment.color || '#0052C2' }}>
            {activeDepartment.short_name || activeDepartment.name}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {departments.map(dept => (
          <DepartmentCard key={dept.id} dept={dept} onSelect={selectDepartment} />
        ))}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin/users')}
            className="w-full text-left bg-cad-card border border-cad-border rounded-2xl p-5 hover:border-cad-gold/60 hover:bg-cad-surface transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Administration</h3>
                <p className="text-sm text-cad-muted">Admin Panel</p>
              </div>
              <span className="w-3 h-3 rounded-full mt-1.5 bg-cad-gold" />
            </div>
            <p className="text-xs text-cad-muted mt-4">Manage users, departments and system settings</p>
          </button>
        )}
      </div>

      {departments.length === 0 && !isAdmin && (
        <div className="bg-cad-card border border-cad-border rounded-2xl p-6 mt-4">
          <p className="text-cad-muted">No department access yet. Link Discord in your profile settings to sync your roles.</p>
        </div>
      )}
    </div>
  );
}
