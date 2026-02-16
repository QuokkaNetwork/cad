import { Navigate } from 'react-router-dom';
import { useDepartment } from '../context/DepartmentContext';

export default function RequireDepartment({
  children,
  allowDispatch = true,
  dispatchRedirectTo = '/dispatch',
}) {
  const { activeDepartment, departments } = useDepartment();

  if (!activeDepartment && departments.length > 0) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <div className="text-cad-muted text-sm">Loading department...</div>
      </div>
    );
  }

  if (!activeDepartment) {
    return <Navigate to="/home" replace />;
  }

  if (!allowDispatch && activeDepartment.is_dispatch) {
    return <Navigate to={dispatchRedirectTo} replace />;
  }

  return children;
}
