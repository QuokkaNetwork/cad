import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useDepartment } from '../../context/DepartmentContext';

export default function LiveMap() {
  const { activeDepartment } = useDepartment();
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState('');
  const [mapUrl, setMapUrl] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setConfigError('');
    try {
      const payload = await api.get('/api/units/live-map-config');
      const resolvedUrl = String(payload?.url || '').trim();
      setMapUrl(resolvedUrl);
    } catch (err) {
      setMapUrl('');
      setConfigError(err?.message || 'Failed to load live map configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const iframeSrc = useMemo(() => {
    const base = String(mapUrl || '').trim();
    if (!base) return '';
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}cad_embed=1&t=${refreshNonce}`;
  }, [mapUrl, refreshNonce]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold">Live Map</h2>
          <p className="text-sm text-cad-muted">
            {activeDepartment?.name || 'Department'} live operational map feed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshNonce(Date.now())}
            disabled={!mapUrl}
            className="px-3 py-1.5 text-sm bg-cad-surface text-cad-muted hover:text-cad-ink rounded border border-cad-border transition-colors disabled:opacity-50"
          >
            Reload Map
          </button>
          <button
            type="button"
            onClick={fetchConfig}
            className="px-3 py-1.5 text-sm bg-cad-accent hover:bg-cad-accent-light text-white rounded border border-cad-accent/40 transition-colors"
          >
            Refresh Config
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex-1 rounded-xl border border-cad-border bg-cad-card flex items-center justify-center text-sm text-cad-muted">
          Loading live map...
        </div>
      )}

      {!loading && configError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300 whitespace-pre-wrap">
          {configError}
        </div>
      )}

      {!loading && !configError && !mapUrl && (
        <div className="rounded-xl border border-cad-border bg-cad-card p-4 text-sm text-cad-muted space-y-2">
          <p className="text-cad-ink font-medium">Live map is not configured.</p>
          <p>Set <span className="font-mono">Live Map Embed URL</span> in Admin - System Settings.</p>
        </div>
      )}

      {!loading && !configError && !!mapUrl && (
        <div className="flex-1 min-h-0 rounded-xl border border-cad-border bg-cad-card overflow-hidden">
          <iframe
            title="CAD Live Map"
            src={iframeSrc}
            className="w-full h-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
}
