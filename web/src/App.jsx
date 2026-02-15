import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DepartmentProvider } from './context/DepartmentContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Settings from './pages/Settings';
import Dispatch from './pages/police/Dispatch';
import Units from './pages/police/Units';
import Search from './pages/police/Search';
import BOLOs from './pages/police/BOLOs';
import Records from './pages/police/Records';
import AdminUsers from './pages/admin/Users';
import AdminDepartments from './pages/admin/Departments';
import AdminRoleMappings from './pages/admin/RoleMappings';
import AdminAuditLog from './pages/admin/AuditLog';
import AdminSystemSettings from './pages/admin/SystemSettings';

export default function App() {
  return (
    <AuthProvider>
      <DepartmentProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* Settings */}
            <Route path="/settings" element={<Settings />} />

            {/* Police MDT */}
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/units" element={<Units />} />
            <Route path="/search" element={<Search />} />
            <Route path="/bolos" element={<BOLOs />} />
            <Route path="/records" element={<Records />} />

            {/* Admin */}
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/departments" element={<ProtectedRoute requireAdmin><AdminDepartments /></ProtectedRoute>} />
            <Route path="/admin/role-mappings" element={<ProtectedRoute requireAdmin><AdminRoleMappings /></ProtectedRoute>} />
            <Route path="/admin/audit-log" element={<ProtectedRoute requireAdmin><AdminAuditLog /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSystemSettings /></ProtectedRoute>} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dispatch" replace />} />
        </Routes>
      </DepartmentProvider>
    </AuthProvider>
  );
}
