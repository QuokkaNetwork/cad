import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requireAdmin = false, requireAnnouncementManager = false }) {
  const { isAuthenticated, isAdmin, canManageAnnouncements, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-cad-bg">
        <div className="text-cad-muted">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/settings" replace />;
  }

  if (requireAnnouncementManager && !canManageAnnouncements) {
    return <Navigate to="/home" replace />;
  }

  return children;
}
