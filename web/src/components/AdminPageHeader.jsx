import { Link, useNavigate } from 'react-router-dom';

export default function AdminPageHeader({ title, subtitle = '', links = [], actions = null }) {
  const navigate = useNavigate();

  return (
    <div className="mb-6 space-y-4">
      <div className="cad-admin-header-shell rounded-2xl border border-cad-border bg-cad-card/85 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate('/admin')}
                className="px-3 py-1.5 text-sm bg-cad-surface border border-cad-border text-cad-muted hover:text-cad-ink hover:bg-cad-card rounded transition-colors"
              >
                Back to Admin Menu
              </button>
              <span className="text-[11px] uppercase tracking-[0.16em] text-cad-muted rounded-full border border-cad-border bg-cad-surface/60 px-2.5 py-1">
                Admin Page
              </span>
            </div>

            <div className="mt-3">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h2>
              {subtitle ? <p className="text-sm text-cad-muted mt-1 max-w-3xl leading-6">{subtitle}</p> : null}
            </div>
          </div>

          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </div>

      {Array.isArray(links) && links.length > 0 ? (
        <div className="rounded-xl border border-cad-border bg-cad-card/70 p-3 sm:p-4">
          <p className="text-[11px] uppercase tracking-wider text-cad-muted mb-2">Related Tools</p>
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Link
                key={`${link.to}-${link.label}`}
                to={link.to}
                className="px-3 py-1.5 text-xs rounded border border-cad-border bg-cad-surface text-cad-muted hover:text-cad-ink hover:bg-cad-card transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
