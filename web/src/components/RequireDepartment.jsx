import { Navigate } from 'react-router-dom';
import { useDepartment } from '../context/DepartmentContext';

export default function RequireDepartment({ children }) {
  const { activeDepartment } = useDepartment();

  if (!activeDepartment) {
    return <Navigate to="/home" replace />;
  }

  return children;
}

