import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RequireRulesAgreement({ children }) {
  const location = useLocation();
  const { loading, isAuthenticated, currentRulesVersion, hasAcceptedCurrentRules } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-8">
        <div className="text-cad-muted text-sm">Checking rules agreement...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const rulesVersionConfigured = String(currentRulesVersion || '').trim() !== '';
  if (rulesVersionConfigured && !hasAcceptedCurrentRules) {
    return <Navigate to="/rules" replace state={{ from: location.pathname }} />;
  }

  return children ?? <Outlet />;
}
