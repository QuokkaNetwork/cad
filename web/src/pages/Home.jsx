import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString();
}

function normalizeAnnouncements(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.slice(0, 6).map((row) => ({
    id: row?.id,
    title: String(row?.title || 'Announcement'),
    content: String(row?.content || ''),
    created_at: row?.created_at || null,
    expires_at: row?.expires_at || null,
  }));
}

function Carousel({ images }) {
  const slides = Array.isArray(images) && images.length > 0 ? images : ['/1080.png', '/96.png'];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const current = slides[index] || slides[0];

  return (
    <section className="rounded-2xl border border-cad-border overflow-hidden bg-cad-card">
      <div className="px-4 py-3 border-b border-cad-border flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-cad-muted">Gallery</p>
          <p className="text-sm font-semibold text-cad-ink">Community Image Carousel</p>
        </div>
        {slides.length > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev - 1 + slides.length) % slides.length)}
              className="w-8 h-8 rounded-lg border border-cad-border bg-cad-surface hover:bg-cad-card text-cad-muted hover:text-cad-ink transition-colors"
              aria-label="Previous image"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
              className="w-8 h-8 rounded-lg border border-cad-border bg-cad-surface hover:bg-cad-card text-cad-muted hover:text-cad-ink transition-colors"
              aria-label="Next image"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="relative bg-cad-surface">
        <img
          src={current}
          alt="CAD home carousel"
          className="w-full h-[260px] sm:h-[340px] object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-cad-bg/70 via-transparent to-transparent pointer-events-none" />
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {slides.map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`Go to image ${dotIndex + 1}`}
                className={`h-2 rounded-full transition-all ${dotIndex === index ? 'w-6 bg-cad-gold' : 'w-2 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function RuleUpdatePopup({ rules, onClose }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] flex items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-2xl border border-cad-border bg-cad-card shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-cad-border bg-red-500/8">
          <p className="text-[10px] uppercase tracking-[0.18em] text-red-300">Important</p>
          <h2 className="text-lg font-semibold text-cad-ink mt-1">Rule amendments/changes/additions</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-cad-muted">
            Rules version <span className="text-cad-ink font-semibold">{rules?.version || 'Current'}</span> requires your acknowledgement before Discord access is kept/granted.
          </p>
          <div className="rounded-xl border border-cad-border bg-cad-surface/60 p-3">
            <p className="text-xs text-cad-muted whitespace-pre-wrap leading-5">
              {String(rules?.changes_summary || '').trim() || 'Review the updated rules page for the latest amendments, changes, and additions.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-cad-border bg-cad-surface text-cad-muted hover:text-cad-ink transition-colors text-sm"
            >
              Dismiss
            </button>
            <Link
              to="/rules"
              className="px-3 py-1.5 rounded-lg bg-cad-accent hover:bg-cad-accent-light text-white text-sm font-medium transition-colors"
            >
              Review Rules
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cms, setCms] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dismissedRulesVersion, setDismissedRulesVersion] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError('');
      const [cmsRes, annRes] = await Promise.allSettled([
        api.get('/api/cms/content'),
        api.get('/api/announcements'),
      ]);

      if (!active) return;

      if (cmsRes.status === 'fulfilled') {
        setCms(cmsRes.value);
      } else {
        setError(cmsRes.reason?.message || 'Failed to load home content');
      }

      if (annRes.status === 'fulfilled') {
        setAnnouncements(normalizeAnnouncements(annRes.value));
      } else {
        setAnnouncements([]);
      }

      setLoading(false);
    }

    load();
    return () => { active = false; };
  }, []);

  const homeContent = cms?.home || {};
  const rulesContent = cms?.rules || {};
  const currentRulesVersion = String(rulesContent?.version || '').trim();
  const agreedRulesVersion = String(user?.rules_agreed_version || '').trim();
  const rulesOutdated = !!currentRulesVersion && agreedRulesVersion !== currentRulesVersion;

  useEffect(() => {
    setDismissedRulesVersion('');
  }, [currentRulesVersion]);

  const showRulesPopup = rulesOutdated && dismissedRulesVersion !== currentRulesVersion;
  const greetingName = useMemo(() => {
    const raw = String(user?.steam_name || user?.name || '').trim();
    if (!raw) return 'Operator';
    return raw.split(' ')[0];
  }, [user?.steam_name, user?.name]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-6">
      {showRulesPopup && (
        <RuleUpdatePopup
          rules={rulesContent}
          onClose={() => setDismissedRulesVersion(currentRulesVersion)}
        />
      )}

      <section className="relative overflow-hidden rounded-2xl border border-cad-border bg-cad-card">
        <div className="absolute inset-0 cad-ambient-grid opacity-30 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_8%,rgba(0,82,194,0.22),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(216,180,108,0.14),transparent_34%)]" />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cad-muted">CAD Home</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-cad-ink mt-2">
                {String(homeContent.title || '').trim() || `Welcome, ${greetingName}`}
              </h1>
              <p className="text-sm text-cad-muted mt-2">
                {String(homeContent.subtitle || '').trim() || 'Use CAD as a community home page, rules hub, and department launcher.'}
              </p>
              <p className="text-sm text-cad-muted/90 mt-3 whitespace-pre-wrap leading-6">
                {String(homeContent.body || '').trim() || 'Open Rules to review policy updates, then use Departments to enter your assigned workspaces.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-[260px]">
              <button
                type="button"
                onClick={() => navigate('/departments')}
                className="rounded-xl border border-cad-border bg-cad-surface hover:bg-cad-card p-3 text-left transition-colors"
              >
                <p className="text-xs uppercase tracking-wider text-cad-muted">Departments</p>
                <p className="text-sm font-semibold text-cad-ink mt-1">Open CAD workspaces</p>
              </button>
              <button
                type="button"
                onClick={() => navigate('/rules')}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  rulesOutdated
                    ? 'border-red-500/30 bg-red-500/8 hover:bg-red-500/12'
                    : 'border-cad-border bg-cad-surface hover:bg-cad-card'
                }`}
              >
                <p className="text-xs uppercase tracking-wider text-cad-muted">Rules</p>
                <p className="text-sm font-semibold text-cad-ink mt-1">
                  {rulesOutdated ? 'Review latest amendments' : 'View community rules'}
                </p>
              </button>
              <div className="rounded-xl border border-cad-border bg-cad-surface/60 p-3">
                <p className="text-xs uppercase tracking-wider text-cad-muted">Rules Status</p>
                <p className={`text-sm font-semibold mt-1 ${rulesOutdated ? 'text-red-300' : 'text-emerald-300'}`}>
                  {rulesOutdated ? `Action required (v${currentRulesVersion || '?'})` : 'Current'}
                </p>
                <p className="text-xs text-cad-muted mt-1">
                  {user?.rules_agreed_at ? `Last agreed ${formatDateTime(user.rules_agreed_at)}` : 'No recorded agreement yet'}
                </p>
              </div>
              <div className="rounded-xl border border-cad-border bg-cad-surface/60 p-3">
                <p className="text-xs uppercase tracking-wider text-cad-muted">Discord</p>
                <p className="text-sm font-semibold text-cad-ink mt-1">
                  {user?.discord_name ? user.discord_name : 'Not linked'}
                </p>
                <p className="text-xs text-cad-muted mt-1">
                  {user?.discord_id ? 'Rules agreement can grant the Discord access role.' : 'Link Discord in Settings to receive access role.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {rulesOutdated && (
        <section className="rounded-2xl border border-red-500/25 bg-red-500/6 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-red-300">Rule amendments/changes/additions</p>
              <p className="text-sm text-red-100 mt-1">
                Rules version <span className="font-semibold">{currentRulesVersion}</span> is waiting for your agreement.
              </p>
              <p className="text-xs text-cad-muted mt-1 whitespace-pre-wrap">
                {String(rulesContent?.changes_summary || '').trim() || 'Open the rules page to review the latest changes.'}
              </p>
            </div>
            <Link
              to="/rules"
              className="px-3 py-1.5 rounded-lg bg-cad-accent hover:bg-cad-accent-light text-white text-sm font-medium transition-colors"
            >
              Open Rules
            </Link>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-6">
        <Carousel images={homeContent.carousel_images} />

        <section className="rounded-2xl border border-cad-border bg-cad-card p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-cad-muted">Updates</p>
              <h2 className="text-lg font-semibold text-cad-ink">Announcements</h2>
            </div>
            <Link to="/departments" className="text-xs text-cad-muted hover:text-cad-ink transition-colors">
              Go to Departments
            </Link>
          </div>

          {loading && (
            <p className="text-sm text-cad-muted mt-4">Loading home content...</p>
          )}

          {!loading && error && (
            <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/6 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && announcements.length === 0 && (
            <div className="mt-4 rounded-xl border border-cad-border bg-cad-surface/60 p-4">
              <p className="text-sm font-medium text-cad-ink">No active announcements</p>
              <p className="text-xs text-cad-muted mt-1">Admins can post announcements from the admin panel.</p>
            </div>
          )}

          {!loading && announcements.length > 0 && (
            <div className="mt-4 space-y-3 max-h-[360px] overflow-auto pr-1">
              {announcements.map((item) => (
                <article key={item.id} className="rounded-xl border border-cad-border bg-cad-surface/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-cad-ink">{item.title}</h3>
                    <span className="text-[10px] text-cad-muted whitespace-nowrap">
                      {formatDateTime(item.created_at)}
                    </span>
                  </div>
                  {item.content && (
                    <p className="text-xs text-cad-muted mt-2 whitespace-pre-wrap leading-5">{item.content}</p>
                  )}
                  {item.expires_at && (
                    <p className="text-[10px] text-cad-muted mt-2">
                      Expires: {formatDateTime(item.expires_at)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
