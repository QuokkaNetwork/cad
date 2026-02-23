import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';

function getInitials(text, fallback = 'DEP') {
  const value = String(text || '').trim();
  if (!value) return fallback;
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function colorWithAlpha(color, alpha, fallback = `rgba(0,82,194,${alpha})`) {
  const value = String(color || '').trim();
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return fallback;
  const raw = hex[1];
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const int = Number.parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getDepartmentKindLabel(dept) {
  if (dept?.is_dispatch) return 'Dispatch';
  const layout = String(dept?.layout_type || dept?.department_layout_type || '').toLowerCase();
  if (layout.includes('fire')) return 'Fire';
  if (layout.includes('ems') || layout.includes('paramedic') || layout.includes('medical')) return 'EMS';
  if (layout.includes('law') || layout.includes('police')) return 'Police';
  return 'Department';
}

function DepartmentCard({ dept, onSelect, index = 0 }) {
  const logo = String(dept?.icon || '').trim();
  const accent = dept?.color || '#0052C2';
  const subtitle = String(dept?.slogan || '').trim() || `${getDepartmentKindLabel(dept)} workspace`;

  return (
    <button
      onClick={() => onSelect(dept)}
      className="relative w-full text-left rounded-2xl border overflow-hidden min-h-[176px] p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl bg-cad-card/95"
      style={{
        borderColor: colorWithAlpha(accent, 0.28, 'rgba(255,255,255,0.12)'),
        boxShadow: `0 10px 28px ${colorWithAlpha(accent, 0.14)}`,
        animationDelay: `${Math.min(index * 60, 300)}ms`,
      }}
    >
      <div
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-200"
        style={{ background: `linear-gradient(135deg, ${colorWithAlpha(accent, 0.12)}, transparent 60%)` }}
      />
      {logo && (
        <div className="absolute -right-4 -bottom-5 w-28 h-28 cad-watermark-fade">
          <img src={logo} alt="" className="w-full h-full object-contain cad-watermark-image" />
        </div>
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {logo ? (
              <div
                className="w-12 h-12 rounded-xl border flex items-center justify-center bg-cad-surface overflow-hidden flex-shrink-0"
                style={{ borderColor: colorWithAlpha(accent, 0.28) }}
              >
                <img src={logo} alt="" className="w-10 h-10 object-contain" />
              </div>
            ) : (
              <div
                className="w-12 h-12 rounded-xl border flex items-center justify-center text-xs font-semibold flex-shrink-0"
                style={{
                  borderColor: colorWithAlpha(accent, 0.28),
                  backgroundColor: colorWithAlpha(accent, 0.12),
                  color: '#e5edff',
                }}
              >
                {getInitials(dept?.short_name || dept?.name)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-semibold text-base truncate">{dept?.name || 'Department'}</h3>
              <p className="text-xs text-cad-muted truncate">{dept?.short_name || 'Department'}</p>
            </div>
          </div>
          <span
            className="w-3 h-3 rounded-full mt-1.5 shadow"
            style={{
              backgroundColor: accent,
              boxShadow: `0 0 12px ${colorWithAlpha(accent, 0.55)}`,
            }}
          />
        </div>

        <p className="text-sm text-cad-muted mt-4 line-clamp-2 min-h-[40px]">
          {subtitle || 'Open department workspace'}
        </p>

        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.16em] text-cad-muted">{getDepartmentKindLabel(dept)}</div>
          <div
            className="px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5"
            style={{
              borderColor: colorWithAlpha(accent, 0.32),
              backgroundColor: colorWithAlpha(accent, 0.08),
              color: '#dce8ff',
            }}
          >
            Launch
            <span aria-hidden="true">→</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function LandingHero({ user, departments, isAdmin }) {
  const linked = !!user?.discord_id;
  const cards = departments.slice(0, 4);
  const primaryLogo = cards.find((d) => String(d?.icon || '').trim())?.icon || '';

  return (
    <section className="relative overflow-hidden rounded-3xl border border-cad-border bg-cad-card/90 p-5 sm:p-7 mb-6">
      <div className="absolute inset-0 cad-ambient-grid opacity-50" />
      <div className="cad-ambient-orb cad-orb-float-a -top-10 -left-10 w-48 h-48 bg-cad-accent/30" />
      <div className="cad-ambient-orb cad-orb-float-b top-8 right-4 w-56 h-56 bg-cad-gold/12" />

      <div className="relative grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-5">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-cad-border bg-cad-surface/70 text-xs text-cad-muted">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Secure CAD Access
          </div>

          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-cad-ink">
              {user?.name ? `${user.name}, select a workspace` : 'Select a department workspace'}
            </h1>
            <p className="text-cad-muted mt-2 max-w-2xl">
              Open the department you are rostered to and continue into dispatch, records, search, and incident workflows.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <HeroStat label="Workspaces" value={departments.length} tone="cad" />
            <HeroStat label="Discord Access" value={linked ? 'Verified' : 'Pending'} tone={linked ? 'ok' : 'warn'} />
            <HeroStat label="Profile" value={isAdmin ? 'Administrator' : 'Operator'} tone={isAdmin ? 'gold' : 'cad'} />
          </div>

          <div className="rounded-2xl border border-cad-border bg-cad-surface/55 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cad-muted">Operational Guidance</p>
                <p className="text-sm text-cad-ink mt-1">Choose the correct department before going on duty to ensure permissions, unit status, and reports are routed correctly.</p>
              </div>
              <div className="text-xs text-cad-muted sm:text-right">
                {isAdmin ? 'Admin tools remain available after department selection.' : 'Department access is controlled by your linked Discord roles.'}
              </div>
            </div>
          </div>
        </div>

        <div className="relative">
          {primaryLogo ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="w-56 h-56 cad-page-watermark-mask opacity-80">
                <img src={primaryLogo} alt="" className="w-full h-full object-contain cad-page-watermark-image" />
              </div>
            </div>
          ) : null}
          <div className="relative rounded-2xl border border-cad-border bg-cad-surface/65 p-4 sm:p-5 overflow-hidden">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-cad-muted">Available Workspaces</p>
                <h3 className="font-semibold mt-1">Department Access</h3>
              </div>
              <div className="text-xs px-2.5 py-1 rounded-full border border-cad-border bg-cad-card/70 text-cad-muted">
                {departments.length} total
              </div>
            </div>

            <div className="space-y-2.5">
              {cards.map((dept) => (
                <div
                  key={`hero-${dept.id}`}
                  className="flex items-center gap-3 rounded-xl border border-cad-border bg-cad-card/85 px-3 py-2.5"
                >
                  {dept.icon ? (
                    <img src={dept.icon} alt="" className="w-8 h-8 object-contain rounded-lg bg-cad-surface border border-cad-border p-0.5" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg border border-cad-border bg-cad-surface flex items-center justify-center text-[10px] text-cad-muted">
                      {getInitials(dept.short_name || dept.name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{dept.name}</p>
                    <p className="text-xs text-cad-muted truncate">{dept.short_name || getDepartmentKindLabel(dept)}</p>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded border text-[10px] uppercase tracking-wider"
                    style={{
                      borderColor: colorWithAlpha(dept.color || '#0052C2', 0.25),
                      backgroundColor: colorWithAlpha(dept.color || '#0052C2', 0.08),
                      color: '#dce8ff',
                    }}
                  >
                    {getDepartmentKindLabel(dept)}
                  </span>
                </div>
              ))}
              {departments.length > cards.length && (
                <div className="text-xs text-cad-muted pt-1">
                  +{departments.length - cards.length} more department{departments.length - cards.length === 1 ? '' : 's'} available below
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-cad-border/70 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="rounded-xl border border-cad-border bg-cad-card/70 px-3 py-2">
                <p className="text-xs uppercase tracking-wider text-cad-muted">Session</p>
                <p className="text-xs mt-1 text-cad-ink">{linked ? 'Discord-linked session active' : 'Link Discord to unlock department access'}</p>
              </div>
              <div className="rounded-xl border border-cad-border bg-cad-card/70 px-3 py-2">
                <p className="text-xs uppercase tracking-wider text-cad-muted">Next Step</p>
                <p className="text-xs mt-1 text-cad-ink">Select a department card below to enter the operational dashboard.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroStat({ label, value, tone = 'cad' }) {
  const toneClasses = {
    cad: 'text-cad-accent-light border-cad-accent/20 bg-cad-accent/5',
    ok: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5',
    warn: 'text-amber-300 border-amber-500/20 bg-amber-500/5',
    gold: 'text-cad-gold border-cad-gold/20 bg-cad-gold/5',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClasses[tone] || toneClasses.cad}`}>
      <p className="text-xs uppercase tracking-[0.16em] text-cad-muted">{label}</p>
      <p className="text-lg font-semibold mt-1 truncate">{value}</p>
    </div>
  );
}

function SetupPrompt({ user }) {
  const [linking, setLinking] = useState(false);
  const hasDiscord = !!user?.discord_id;

  async function linkDiscord() {
    setLinking(true);
    try {
      const { url } = await api.post('/api/auth/link-discord');
      window.location.href = url;
    } catch (err) {
      alert('Failed to start Discord linking: ' + err.message);
      setLinking(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-cad-border bg-cad-card/90">
      <div className="absolute inset-0 cad-ambient-grid opacity-60" />
      <div className="cad-ambient-orb cad-orb-float-a -top-6 -left-8 w-44 h-44 bg-[#5865F2]/30" />
      <div className="cad-ambient-orb cad-orb-float-b top-6 right-6 w-52 h-52 bg-cad-gold/15" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 p-6 sm:p-8">
        <div className="flex flex-col justify-center">
          <div className="w-16 h-16 rounded-2xl bg-cad-surface border border-cad-border flex items-center justify-center mb-4">
            {!hasDiscord ? (
              <svg className="w-9 h-9 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
              </svg>
            ) : (
              <svg className="w-9 h-9 text-cad-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
            )}
          </div>

          <h2 className="text-3xl font-bold tracking-tight">
            {!hasDiscord ? 'Link Discord To Start' : 'No Department Access Yet'}
          </h2>
          <p className="text-cad-muted mt-2 max-w-xl">
            {!hasDiscord
              ? 'Link your Discord account to unlock department access. Your Discord roles are used to determine which CAD workspaces you can enter.'
              : 'Your Discord account is linked, but no departments are assigned yet. Ask an administrator to map your Discord roles to CAD departments.'}
          </p>

          {!hasDiscord && (
            <button
              onClick={linkDiscord}
              disabled={linking}
              className="mt-5 inline-flex items-center gap-3 px-5 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-xl font-medium transition-colors disabled:opacity-50 self-start"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
              </svg>
              {linking ? 'Redirecting to Discord...' : 'Link Discord Account'}
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-cad-border bg-cad-surface/65 p-5">
          <p className="text-xs uppercase tracking-[0.16em] text-cad-muted mb-3">Access Setup</p>
          <div className="space-y-3">
            <StepRow number="1" text="Link your Discord account to your CAD user." done={hasDiscord} />
            <StepRow number="2" text="Ensure your Discord roles are mapped to departments in Admin." />
            <StepRow number="3" text="Return here and pick a department to open its workspace." />
          </div>
          {hasDiscord && (
            <div className="mt-4 rounded-xl border border-cad-border bg-cad-card/70 p-3">
              <p className="text-sm font-medium">{user?.discord_name || 'Discord Account Linked'}</p>
              <p className="text-xs text-cad-muted mt-1">Linked successfully. Waiting for department role mappings.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRow({ number, text, done = false }) {
  return (
    <div className="flex gap-3 items-start rounded-xl border border-cad-border bg-cad-card/70 p-3">
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-[#5865F2]/20 text-[#9ca8ff]'}`}>
        {done ? '✓' : number}
      </span>
      <p className="text-sm text-cad-muted leading-relaxed">{text}</p>
    </div>
  );
}

function AdminCard({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="relative w-full text-left rounded-2xl border border-cad-gold/30 bg-cad-card min-h-[176px] p-5 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl"
      style={{ boxShadow: '0 10px 28px rgba(245, 197, 66, 0.1)' }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cad-gold/10 to-transparent" />
      <div className="relative flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-cad-ink">Administration</h3>
          <p className="text-sm text-cad-muted mt-1">System settings, roles, integrations</p>
        </div>
        <span className="w-3 h-3 rounded-full mt-1.5 bg-cad-gold shadow-[0_0_12px_rgba(245,197,66,0.5)]" />
      </div>
      <div className="relative mt-4 space-y-2 text-xs text-cad-muted">
        <p>Manage departments, Discord role sync, alarm zones, and system configuration.</p>
        <p className="uppercase tracking-[0.16em] text-cad-gold">Open Admin Dashboard</p>
      </div>
    </button>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user, departments, isAdmin } = useAuth();
  const { setActiveDepartment } = useDepartment();

  const departmentList = useMemo(() => (Array.isArray(departments) ? departments : []), [departments]);

  function selectDepartment(dept) {
    setActiveDepartment(dept);
    navigate('/department');
  }

  const needsSetup = !user?.discord_id || departmentList.length === 0;

  if (needsSetup && !isAdmin) {
    return (
      <div className="w-full">
        <div className="max-w-6xl mx-auto">
          <SetupPrompt user={user} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto">
        {needsSetup && isAdmin && <SetupBanner user={user} />}

        <LandingHero user={user} departments={departmentList} isAdmin={isAdmin} />

        <section className="bg-cad-card/80 border border-cad-border rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
            <div>
          <h2 className="text-xl font-bold">Department Workspaces</h2>
          <p className="text-sm text-cad-muted">Choose a department to open its operational dashboard and tools.</p>
        </div>
        <div className="text-xs text-cad-muted uppercase tracking-[0.16em]">
          {departmentList.length} available
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {departmentList.map((dept, idx) => (
              <DepartmentCard key={dept.id} dept={dept} onSelect={selectDepartment} index={idx} />
            ))}
            {isAdmin && <AdminCard onOpen={() => navigate('/admin')} />}
          </div>
        </section>
      </div>
    </div>
  );
}

function SetupBanner({ user }) {
  const [linking, setLinking] = useState(false);
  const hasDiscord = !!user?.discord_id;

  async function linkDiscord() {
    setLinking(true);
    try {
      const { url } = await api.post('/api/auth/link-discord');
      window.location.href = url;
    } catch (err) {
      alert('Failed to start Discord linking: ' + err.message);
      setLinking(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#5865F2]/25 bg-[#5865F2]/8 p-4 mb-6">
      <div className="absolute inset-0 bg-gradient-to-r from-[#5865F2]/10 to-transparent" />
      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#5865F2]/15 border border-[#5865F2]/25 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#9ca8ff]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
            </svg>
          </div>
          <p className="text-sm text-[#cdd4ff]">
            {!hasDiscord
              ? 'Link your Discord account to access departments.'
              : 'No department access yet. Ensure your Discord roles are mapped.'}
          </p>
        </div>
        {!hasDiscord && (
          <button
            onClick={linkDiscord}
            disabled={linking}
            className="flex-shrink-0 px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {linking ? 'Redirecting...' : 'Link Discord'}
          </button>
        )}
      </div>
    </div>
  );
}
