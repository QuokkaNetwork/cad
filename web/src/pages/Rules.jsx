import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatDate(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleString();
}

export default function Rules() {
  const { user, refreshUser } = useAuth();
  const [cms, setCms] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resultMessage, setResultMessage] = useState('');
  const [resultTone, setResultTone] = useState('muted');

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await api.get('/api/cms/content');
        if (!active) return;
        setCms(data);
      } catch (err) {
        if (!active) return;
        setError(err.message || 'Failed to load rules');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const rules = cms?.rules || {};
  const currentVersion = String(rules?.version || '').trim();
  const agreedVersion = String(user?.rules_agreed_version || '').trim();
  const isCurrent = !!currentVersion && currentVersion === agreedVersion;
  const discordLinked = !!user?.discord_id;
  const changesSummary = String(rules?.changes_summary || '').trim();
  const rulesText = String(rules?.content || '').trim();

  const statusLabel = useMemo(() => {
    if (!currentVersion) return 'Unknown';
    return isCurrent ? `Agreed (v${currentVersion})` : `Action Required (v${currentVersion})`;
  }, [isCurrent, currentVersion]);

  async function agreeToRules() {
    setSaving(true);
    setResultMessage('');
    setError('');
    try {
      const data = await api.post('/api/cms/rules/agree', {});
      await refreshUser();
      const sync = data?.discord_role_sync || {};
      if (!discordLinked) {
        setResultTone('amber');
        setResultMessage('Rules recorded. Discord is not linked yet, so no Discord role was assigned. Link Discord in Profile Settings.');
      } else if (sync.success) {
        setResultTone('green');
        setResultMessage('Rules recorded and Discord access role sync was triggered successfully.');
      } else {
        setResultTone('amber');
        setResultMessage(`Rules recorded, but Discord role sync did not complete (${sync.reason || 'unknown'}).`);
      }

      try {
        const freshCms = await api.get('/api/cms/content');
        setCms(freshCms);
      } catch {
        // Non-fatal after successful agreement.
      }
    } catch (err) {
      setResultTone('red');
      setError(err.message || 'Failed to record rules agreement');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-6">
      <section className="rounded-2xl border border-cad-border bg-cad-card overflow-hidden">
        <div className="px-5 py-4 border-b border-cad-border">
          <p className="text-[10px] uppercase tracking-[0.18em] text-cad-muted">Rules</p>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-1">
            <h1 className="text-2xl font-bold text-cad-ink">
              {String(rules?.title || '').trim() || 'Community Rules'}
            </h1>
            <div className={`text-xs px-3 py-1 rounded-full border ${
              isCurrent
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                : 'border-red-500/20 bg-red-500/10 text-red-300'
            }`}>
              {statusLabel}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-cad-muted">
            <span>Current version: {currentVersion || 'Not set'}</span>
            <span>Your agreed version: {agreedVersion || 'None'}</span>
            {user?.rules_agreed_at && <span>Last agreed: {formatDate(user.rules_agreed_at)}</span>}
            {rules?.updated_at && <span>Rules updated: {formatDate(rules.updated_at)}</span>}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {!discordLinked && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/6 p-4">
              <p className="text-sm font-medium text-amber-200">Discord not linked</p>
              <p className="text-xs text-cad-muted mt-1">
                You can still record agreement, but CAD cannot assign the Discord access role until your account is linked.
                <Link to="/settings" className="ml-1 text-cad-accent hover:text-cad-accent-light">Open Profile Settings</Link>
              </p>
            </div>
          )}

          {!isCurrent && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/6 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-red-300">Rule amendments/changes/additions</p>
              <p className="text-xs text-cad-muted mt-2 whitespace-pre-wrap leading-5">
                {changesSummary || 'Review the updated rules below and confirm agreement to restore/receive Discord access role permissions.'}
              </p>
            </div>
          )}

          <div className="rounded-xl border border-cad-border bg-cad-surface/50 p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-sm font-semibold text-cad-ink">Rules Text</p>
              {loading && <span className="text-xs text-cad-muted">Loading...</span>}
            </div>

            {error && (
              <div className="mb-3 rounded-lg border border-red-500/25 bg-red-500/6 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            )}

            {!loading && !error && (
              <div className="max-h-[50vh] overflow-auto rounded-lg border border-cad-border bg-cad-bg/40 px-4 py-3">
                <pre className="whitespace-pre-wrap text-sm text-cad-muted leading-6 font-sans">
                  {rulesText || 'No rules content has been configured yet. An admin can add this in Admin > System Settings.'}
                </pre>
              </div>
            )}
          </div>

          {(resultMessage || (!isCurrent && !loading)) && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${
              resultTone === 'green'
                ? 'border-emerald-500/20 bg-emerald-500/8 text-emerald-200'
                : resultTone === 'red'
                  ? 'border-red-500/20 bg-red-500/8 text-red-200'
                  : resultTone === 'amber'
                    ? 'border-amber-500/20 bg-amber-500/8 text-amber-100'
                    : 'border-cad-border bg-cad-surface text-cad-muted'
            }`}>
              {resultMessage || 'Read the current rules and confirm agreement to record acknowledgement in CAD.'}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/departments"
              className="text-sm text-cad-muted hover:text-cad-ink transition-colors"
            >
              Go to Departments
            </Link>
            <button
              type="button"
              onClick={agreeToRules}
              disabled={saving || loading || !currentVersion}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                isCurrent
                  ? 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
                  : 'bg-cad-accent hover:bg-cad-accent-light text-white'
              }`}
            >
              {saving ? 'Saving Agreement...' : isCurrent ? 'Agree Again (Refresh Ack)' : 'Agree To Current Rules'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
