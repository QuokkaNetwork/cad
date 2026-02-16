import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const DepartmentContext = createContext(null);
const ACTIVE_DEPT_STORAGE_KEY = 'cad_active_department_id';

export function DepartmentProvider({ children }) {
  const { departments } = useAuth();
  const [activeDepartment, setActiveDepartment] = useState(null);

  useEffect(() => {
    if (departments.length === 0) {
      setActiveDepartment(null);
      return;
    }

    setActiveDepartment((prev) => {
      if (prev) {
        const matchingDepartment = departments.find(d => d.id === prev.id);
        if (matchingDepartment) return matchingDepartment;
      }

      let nextDepartment = null;
      try {
        const storedId = parseInt(localStorage.getItem(ACTIVE_DEPT_STORAGE_KEY) || '', 10);
        if (storedId) {
          nextDepartment = departments.find(d => d.id === storedId) || null;
        }
      } catch {
        // Ignore storage access errors and fall back to first available department.
      }

      return nextDepartment || departments[0] || null;
    });
  }, [departments]);

  useEffect(() => {
    try {
      if (activeDepartment?.id) {
        localStorage.setItem(ACTIVE_DEPT_STORAGE_KEY, String(activeDepartment.id));
      }
    } catch {
      // Ignore storage access errors.
    }
  }, [activeDepartment?.id]);

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
