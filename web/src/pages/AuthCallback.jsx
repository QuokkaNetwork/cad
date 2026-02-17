import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { clearToken } from '../api/client';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    clearToken();

    const error = searchParams.get('error');
    if (error) {
      navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
      return;
    }

    // Steam auth callback on port 3031 passes the JWT as ?token= so we can
    // set the httpOnly cookie on this origin (the HTTPS SPA, port 3030).
    const token = searchParams.get('token');
    if (token) {
      fetch('/api/auth/set-cookie', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      })
        .then(() => {
          // Use a full page reload instead of React Router navigate so that
          // AuthProvider re-mounts fresh with the cookie already in place.
          // Without this, ProtectedRoute sees the pre-cookie auth state
          // (user=null) and redirects back to /login before the cookie lands.
          window.location.replace('/home');
        })
        .catch(() => navigate('/login?error=auth_failed', { replace: true }));
      return;
    }

    // No token in URL — already on the right origin, cookie was set server-side.
    navigate('/home', { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-cad-bg flex items-center justify-center">
      <div className="text-cad-muted">Authenticating...</div>
    </div>
  );
}
