import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setToken } from '../api/client';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      setToken(token);
      navigate('/home', { replace: true });
    } else {
      navigate('/login?error=no_token', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-cad-bg flex items-center justify-center">
      <div className="text-cad-muted">Authenticating...</div>
    </div>
  );
}
