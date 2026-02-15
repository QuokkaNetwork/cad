import { useNavigate } from 'react-router-dom';

export default function AdminPageHeader({ title, subtitle = '' }) {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      <button
        onClick={() => navigate('/admin')}
        className="px-3 py-1.5 text-sm bg-cad-card border border-cad-border text-cad-muted hover:text-cad-ink hover:bg-cad-surface rounded transition-colors"
      >
        Back to Admin Menu
      </button>
      <div className="mt-3">
        <h2 className="text-xl font-bold">{title}</h2>
        {subtitle ? <p className="text-sm text-cad-muted mt-1">{subtitle}</p> : null}
      </div>
    </div>
  );
}
