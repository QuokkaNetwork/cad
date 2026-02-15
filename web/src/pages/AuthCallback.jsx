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
    navigate('/home', { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-cad-bg flex items-center justify-center">
      <div className="text-cad-muted">Authenticating...</div>
    </div>
  );
}
