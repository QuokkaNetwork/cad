import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const DepartmentContext = createContext(null);

export function DepartmentProvider({ children }) {
  const { departments } = useAuth();
  const [activeDepartment, setActiveDepartment] = useState(null);

  useEffect(() => {
    if (departments.length > 0 && !activeDepartment) {
      setActiveDepartment(departments[0]);
    }
    // If active dept was removed from user's departments, reset
    if (activeDepartment && !departments.find(d => d.id === activeDepartment.id)) {
      setActiveDepartment(departments[0] || null);
    }
  }, [departments, activeDepartment]);

  return (
    <DepartmentContext.Provider value={{ activeDepartment, setActiveDepartment, departments }}>
      {children}
    </DepartmentContext.Provider>
  );
}

export function useDepartment() {
  const ctx = useContext(DepartmentContext);
  if (!ctx) throw new Error('useDepartment must be used within DepartmentProvider');
  return ctx;
}
