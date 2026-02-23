import { Link } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { DEPARTMENT_LAYOUT, getDepartmentLayoutType } from '../../utils/departmentLayout';

function FireOnlyNotice() {
  return (
    <div className="bg-cad-card border border-cad-border rounded-lg p-5">
      <h2 className="text-xl font-bold mb-2">Apparatus Management</h2>
      <p className="text-sm text-cad-muted">
        This page is intended for fire departments only.
      </p>
    </div>
  );
}

export default function FireApparatus() {
  const { activeDepartment } = useDepartment();
  const isFire = getDepartmentLayoutType(activeDepartment) === DEPARTMENT_LAYOUT.FIRE;
  const responseBoardPath = activeDepartment?.is_dispatch ? '/dispatch' : '/units';

  if (!isFire) return <FireOnlyNotice />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">Apparatus Management</h2>
        <p className="text-sm text-cad-muted mt-1">
          Fire apparatus tracking tab is now available in the sidebar. Backend inventory/crew assignment management is the next module.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-cad-card border border-cad-border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Current Operations</h3>
          <p className="text-sm text-cad-muted mb-3">
            Use the existing response board to manage crews and incident assignments while apparatus tools are expanded.
          </p>
          <Link
            to={responseBoardPath}
            className="inline-flex px-3 py-2 rounded bg-cad-accent hover:bg-cad-accent-light text-white text-sm font-medium"
          >
            Open Response Board
          </Link>
        </div>

        <div className="bg-cad-card border border-cad-border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Planned Fields</h3>
          <ul className="text-sm text-cad-muted space-y-1">
            <li>Apparatus roster (engine, ladder, rescue, command)</li>
            <li>Crew assignments by seat/role</li>
            <li>Equipment readiness / out-of-service status</li>
            <li>Maintenance notes / availability tags</li>
          </ul>
        </div>

        <div className="bg-cad-card border border-cad-border rounded-xl p-4">
          <h3 className="font-semibold mb-2">Related Tabs</h3>
          <div className="flex flex-wrap gap-2">
            <Link to="/records" className="px-3 py-1.5 rounded border border-cad-border text-sm hover:bg-cad-surface">Incident Reports</Link>
            <Link to="/search" className="px-3 py-1.5 rounded border border-cad-border text-sm hover:bg-cad-surface">Lookup</Link>
            <Link to="/fire-preplans" className="px-3 py-1.5 rounded border border-cad-border text-sm hover:bg-cad-surface">Pre-Plans</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
