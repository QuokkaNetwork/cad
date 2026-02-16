import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';

const LIVE_MAP_SOCKET_ENV_URL = String(import.meta.env.VITE_LIVEMAP_SOCKET_URL || '').trim();
const LIVE_MAP_DIRECT_ENV_URL = String(import.meta.env.VITE_LIVEMAP_DIRECT_URL || '').trim();
const LIVE_MAP_SOCKET_PORT = Number(import.meta.env.VITE_LIVEMAP_SOCKET_PORT ?? 30121);

function normalizeSocketUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('ws://') || text.startsWith('wss://')) return text;
  if (text.startsWith('http://')) return `ws://${text.slice('http://'.length)}`;
  if (text.startsWith('https://')) return `wss://${text.slice('https://'.length)}`;
  if (text.startsWith('//')) {
    const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
    return `${protocol}${text}`;
  }
  if (text.includes('://')) return '';
  const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss://' : 'ws://';
  return `${protocol}${text}`;
}

function normalizeHttpUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('http://') || text.startsWith('https://')) return text;
  if (text.startsWith('ws://') || text.startsWith('wss://')) {
    try {
      const parsed = new URL(text);
      const protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
      return `${protocol}//${parsed.host}${parsed.pathname || ''}${parsed.search || ''}`;
    } catch {
      return '';
    }
  }
  if (text.startsWith('//')) {
    const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https:' : 'http:';
    return `${protocol}${text}`;
  }
  if (text.includes('://')) return '';
  const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'https://' : 'http://';
  return `${protocol}${text}`;
}

function deriveDirectUrlFromSocket(socketUrl) {
  const normalized = normalizeSocketUrl(socketUrl);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const protocol = parsed.protocol === 'wss:' ? 'https:' : 'http:';
    return `${protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

function buildFallbackSocketUrl() {
  const envSocket = normalizeSocketUrl(LIVE_MAP_SOCKET_ENV_URL);
  if (envSocket) return envSocket;
  if (typeof window === 'undefined') return '';

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || '127.0.0.1';
  const port = Number.isFinite(LIVE_MAP_SOCKET_PORT) && LIVE_MAP_SOCKET_PORT > 0
    ? LIVE_MAP_SOCKET_PORT
    : 30121;
  return `${protocol}//${host}:${port}`;
}

function getMixedContentWarning(url) {
  if (!url || typeof window === 'undefined') return '';
  if (window.location.protocol === 'https:' && String(url).startsWith('http://')) {
    return 'CAD is running over HTTPS while LiveMap is HTTP. Browsers will block this until LiveMap is served over HTTPS.';
  }
  return '';
}

export default function LiveMap() {
  const { key: locationKey } = useLocation();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [socketUrl, setSocketUrl] = useState(buildFallbackSocketUrl);
  const [liveMapUrl, setLiveMapUrl] = useState(() => {
    const envDirect = normalizeHttpUrl(LIVE_MAP_DIRECT_ENV_URL);
    if (envDirect) return envDirect;
    return deriveDirectUrlFromSocket(buildFallbackSocketUrl());
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [lastConfigRefreshAt, setLastConfigRefreshAt] = useState(0);

  const refreshConfig = useCallback(async () => {
    setLoadingConfig(true);
    try {
      const config = await api.get('/api/units/map-config');
      const configuredSocketUrl = normalizeSocketUrl(config?.live_map_socket_url);
      const configuredDirectUrl = normalizeHttpUrl(config?.live_map_url);
      const fallbackSocketUrl = buildFallbackSocketUrl();
      const resolvedSocketUrl = configuredSocketUrl || fallbackSocketUrl;
      const envDirectUrl = normalizeHttpUrl(LIVE_MAP_DIRECT_ENV_URL);
      const resolvedDirectUrl = configuredDirectUrl || envDirectUrl || deriveDirectUrlFromSocket(resolvedSocketUrl);

      setSocketUrl(resolvedSocketUrl);
      setLiveMapUrl(resolvedDirectUrl);
      setErrorMessage(
        resolvedDirectUrl
          ? ''
          : 'Configure LiveMap Direct URL or LiveMap Socket URL in Admin > System Settings.'
      );
      setLastConfigRefreshAt(Date.now());
    } catch {
      const fallbackSocketUrl = buildFallbackSocketUrl();
      const envDirectUrl = normalizeHttpUrl(LIVE_MAP_DIRECT_ENV_URL);
      const fallbackDirectUrl = envDirectUrl || deriveDirectUrlFromSocket(fallbackSocketUrl);
      setSocketUrl(fallbackSocketUrl);
      setLiveMapUrl(fallbackDirectUrl);
      setErrorMessage(
        fallbackDirectUrl
          ? 'Unable to load LiveMap settings from CAD. Using fallback URL.'
          : 'Unable to resolve a LiveMap URL. Configure Admin > System Settings.'
      );
      setLastConfigRefreshAt(Date.now());
    } finally {
      setLoadingConfig(false);
    }
  }, []);

  useEffect(() => {
    refreshConfig();
  }, [refreshConfig, locationKey]);

  useEffect(() => {
    const id = setInterval(refreshConfig, 30000);
    return () => clearInterval(id);
  }, [refreshConfig]);

  const mixedContentWarning = useMemo(
    () => getMixedContentWarning(liveMapUrl),
    [liveMapUrl]
  );

  const openLiveMap = useCallback(() => {
    if (!liveMapUrl || typeof window === 'undefined') return;
    window.open(liveMapUrl, '_blank', 'noopener,noreferrer');
  }, [liveMapUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Unit Map</h2>
          <p className="text-sm text-cad-muted">
            Direct embed from <span className="font-mono">live_map-3.2.1</span> (no CAD-side calibration).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshConfig}
            className="px-3 py-1.5 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
          >
            {loadingConfig ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={openLiveMap}
            disabled={!liveMapUrl}
            className="px-3 py-1.5 text-xs bg-cad-accent/20 text-cad-accent-light border border-cad-accent/40 rounded hover:bg-cad-accent/30 transition-colors disabled:opacity-50"
          >
            Open LiveMap
          </button>
        </div>
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg p-3 text-xs text-cad-muted space-y-1">
        <p>
          LiveMap URL: <span className="font-mono break-all">{liveMapUrl || 'Not configured'}</span>
        </p>
        <p>
          Socket URL (for auto-derivation): <span className="font-mono break-all">{socketUrl || 'Not configured'}</span>
        </p>
        {lastConfigRefreshAt > 0 && (
          <p>
            Last config refresh: {new Date(lastConfigRefreshAt).toLocaleTimeString()}
          </p>
        )}
        {mixedContentWarning && (
          <p className="text-amber-300">{mixedContentWarning}</p>
        )}
        {errorMessage && (
          <p className="text-amber-300">{errorMessage}</p>
        )}
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
        {liveMapUrl ? (
          <>
            <iframe
              title="live_map_direct"
              src={liveMapUrl}
              className="w-full h-[76vh] min-h-[520px] bg-black"
            />
            <div className="px-3 py-2 border-t border-cad-border text-xs text-cad-muted">
              If the frame is blank because of browser frame restrictions, use <span className="font-semibold">Open LiveMap</span>.
            </div>
          </>
        ) : (
          <div className="h-[60vh] min-h-[420px] flex items-center justify-center p-6 text-center text-sm text-cad-muted">
            LiveMap URL is not configured.
          </div>
        )}
      </div>
    </div>
  );
}
