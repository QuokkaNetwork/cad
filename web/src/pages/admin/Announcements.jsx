import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';

function toInputDateTimeLocal(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function formatDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return '-';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return parsed.toLocaleString();
}

function normalizeExpiryForApi(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default function AnnouncementManagerPage() {
  const { isAdmin, isDepartmentLeader } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [permissionInfo, setPermissionInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    content: '',
    expires_at: '',
  });

  const activeCount = useMemo(() => {
    const now = Date.now();
    return announcements.filter((item) => {
      const expiry = String(item?.expires_at || '').trim();
      if (!expiry) return true;
      const ts = Date.parse(expiry);
      return Number.isNaN(ts) ? true : ts > now;
    }).length;
  }, [announcements]);

  async function fetchAnnouncements() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/announcements/manage');
      setAnnouncements(Array.isArray(data?.announcements) ? data.announcements : []);
      setPermissionInfo(data?.permission || null);
    } catch (err) {
      setError(err.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function submitAnnouncement(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/api/announcements/manage', {
        title: String(form.title || '').trim(),
        content: String(form.content || ''),
        expires_at: normalizeExpiryForApi(form.expires_at),
      });
      setForm({ title: '', content: '', expires_at: '' });
      await fetchAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to create announcement');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnnouncement(row) {
    const ok = window.confirm(`Delete announcement "${row?.title || 'Announcement'}"?`);
    if (!ok) return;
    setDeletingId(row.id);
    setError('');
    try {
      await api.delete(`/api/announcements/manage/${row.id}`);
      await fetchAnnouncements();
    } catch (err) {
      setError(err.message || 'Failed to delete announcement');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="rounded-2xl border border-cad-border bg-cad-card/85 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to={isAdmin ? '/admin' : '/home'}
                  className="px-3 py-1.5 text-sm bg-cad-surface border border-cad-border text-cad-muted hover:text-cad-ink hover:bg-cad-card rounded transition-colors"
                >
                  {isAdmin ? 'Back to Admin Menu' : 'Back to Home'}
                </Link>
                <span className="text-[11px] uppercase tracking-[0.16em] text-cad-muted rounded-full border border-cad-border bg-cad-surface/60 px-2.5 py-1">
                  {isAdmin ? 'Admin / Leader Tool' : 'Department Leader Tool'}
                </span>
              </div>

              <div className="mt-3">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Home Announcements</h2>
                <p className="text-sm text-cad-muted mt-1 max-w-3xl leading-6">
                  Create and remove announcements shown on the Home page. Access is available to admins and configured department leader Discord roles.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 min-w-[220px]">
              <div className="rounded-xl border border-cad-border bg-cad-surface/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-cad-muted">Total</p>
                <p className="text-lg font-semibold mt-1">{announcements.length}</p>
              </div>
              <div className="rounded-xl border border-cad-border bg-cad-surface/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-cad-muted">Active</p>
                <p className="text-lg font-semibold mt-1">{activeCount}</p>
              </div>
            </div>
          </div>

          {permissionInfo ? (
            <div className="mt-4 text-xs text-cad-muted">
              Permission source: <span className="text-cad-ink font-medium">{permissionInfo.source || 'unknown'}</span>
              {!isAdmin && isDepartmentLeader && permissionInfo.matched_role_id ? (
                <span> | Matched leader role ID: <span className="font-mono text-cad-ink">{permissionInfo.matched_role_id}</span></span>
              ) : null}
            </div>
          ) : null}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-5">
          <section className="rounded-2xl border border-cad-border bg-cad-card overflow-hidden">
            <div className="px-4 py-3 border-b border-cad-border bg-cad-surface/40 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] text-cad-muted">Live Feed</p>
                <h3 className="text-base font-semibold text-cad-ink mt-1">Existing Announcements</h3>
              </div>
              <button
                type="button"
                onClick={fetchAnnouncements}
                disabled={loading}
                className="px-3 py-1.5 text-xs rounded border border-cad-border bg-cad-card text-cad-muted hover:text-cad-ink transition-colors disabled:opacity-50"
              >
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="p-4 space-y-3 max-h-[70vh] overflow-auto">
              {error ? (
                <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200 whitespace-pre-wrap">
                  {error}
                </div>
              ) : null}
              {loading && announcements.length === 0 ? <p className="text-sm text-cad-muted">Loading announcements...</p> : null}
              {!loading && announcements.length === 0 ? <p className="text-sm text-cad-muted">No announcements created yet.</p> : null}

              {announcements.map((row) => {
                const expiryTs = row?.expires_at ? Date.parse(row.expires_at) : NaN;
                const expired = Number.isFinite(expiryTs) ? expiryTs <= Date.now() : false;
                return (
                  <article key={row.id} className={`rounded-xl border p-4 ${expired ? 'border-slate-500/25 bg-slate-500/5' : 'border-cad-border bg-cad-surface/35'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-semibold text-cad-ink truncate">{row.title || 'Announcement'}</h4>
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${expired ? 'border-slate-500/25 bg-slate-500/10 text-slate-300' : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'}`}>
                            {expired ? 'Expired' : 'Active'}
                          </span>
                        </div>
                        <p className="text-[11px] text-cad-muted mt-1">
                          Created {formatDateTime(row.created_at)}{row.creator_name ? ` by ${row.creator_name}` : ''}
                        </p>
                        {row.expires_at ? (
                          <p className="text-[11px] text-cad-muted mt-1">Expires {formatDateTime(row.expires_at)}</p>
                        ) : (
                          <p className="text-[11px] text-cad-muted mt-1">No expiry (stays active)</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteAnnouncement(row)}
                        disabled={deletingId === row.id}
                        className="px-2.5 py-1.5 text-xs rounded border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        {deletingId === row.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                    {row.content ? (
                      <p className="text-sm text-cad-muted mt-3 whitespace-pre-wrap leading-6">{row.content}</p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-cad-border bg-cad-card overflow-hidden">
            <div className="px-4 py-3 border-b border-cad-border bg-cad-surface/40">
              <p className="text-[10px] uppercase tracking-[0.18em] text-cad-muted">Composer</p>
              <h3 className="text-base font-semibold text-cad-ink mt-1">Create Announcement</h3>
            </div>

            <form onSubmit={submitAnnouncement} className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-cad-muted mb-1">Title *</label>
                <input
                  type="text"
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Server maintenance, recruitment, training, update..."
                />
              </div>

              <div>
                <label className="block text-xs text-cad-muted mb-1">Content</label>
                <textarea
                  rows={8}
                  maxLength={8000}
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                  placeholder="Announcement text shown on the Home page."
                />
                <p className="text-[11px] text-cad-muted mt-1">{form.content.length}/8000</p>
              </div>

              <div>
                <label className="block text-xs text-cad-muted mb-1">Expiry (optional)</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                  className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
                />
                <p className="text-[11px] text-cad-muted mt-1">
                  Leave blank to keep the announcement active until manually deleted.
                </p>
              </div>

              <div className="rounded-xl border border-cad-border bg-cad-surface/35 p-3">
                <p className="text-[10px] uppercase tracking-wider text-cad-muted">Preview</p>
                <p className="text-sm font-semibold text-cad-ink mt-2">{form.title.trim() || 'Announcement title'}</p>
                <p className="text-xs text-cad-muted mt-2 whitespace-pre-wrap leading-5">
                  {form.content.trim() || 'Announcement content preview will appear here.'}
                </p>
                <p className="text-[11px] text-cad-muted mt-2">
                  {form.expires_at ? `Expires ${formatDateTime(form.expires_at)}` : 'No expiry set'}
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ title: '', content: '', expires_at: '' })}
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded border border-cad-border bg-cad-surface text-cad-muted hover:text-cad-ink transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm rounded bg-cad-accent hover:bg-cad-accent-light text-white font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? 'Posting...' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

