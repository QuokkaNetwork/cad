import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DepartmentProvider } from './context/DepartmentContext';
import ProtectedRoute from './components/ProtectedRoute';
import RequireDepartment from './components/RequireDepartment';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Home from './pages/Home';
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
import AdminHome from './pages/admin/Home';

export default function App() {
  return (
    <AuthProvider>
      <DepartmentProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          <Route
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            {/* General */}
            <Route path="/home" element={<Home />} />
            <Route path="/settings" element={<Settings />} />

            {/* Police MDT */}
            <Route path="/dispatch" element={<RequireDepartment><Dispatch /></RequireDepartment>} />
            <Route path="/units" element={<RequireDepartment><Units /></RequireDepartment>} />
            <Route path="/search" element={<RequireDepartment><Search /></RequireDepartment>} />
            <Route path="/bolos" element={<RequireDepartment><BOLOs /></RequireDepartment>} />
            <Route path="/records" element={<RequireDepartment><Records /></RequireDepartment>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><AdminHome /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin><AdminUsers /></ProtectedRoute>} />
            <Route path="/admin/departments" element={<ProtectedRoute requireAdmin><AdminDepartments /></ProtectedRoute>} />
            <Route path="/admin/role-mappings" element={<ProtectedRoute requireAdmin><AdminRoleMappings /></ProtectedRoute>} />
            <Route path="/admin/audit-log" element={<ProtectedRoute requireAdmin><AdminAuditLog /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute requireAdmin><AdminSystemSettings /></ProtectedRoute>} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </DepartmentProvider>
    </AuthProvider>
  );
}
