function buildDefaultLiveMapUrl() {
  if (typeof window === 'undefined') return 'http://127.0.0.1:30121/map/';

  const port = String(import.meta.env.VITE_LIVEMAP_PORT || '30121').trim() || '30121';
  const { hostname, protocol } = window.location;
  const nextProtocol = protocol === 'https:' ? 'https:' : 'http:';
  return `${nextProtocol}//${hostname}:${port}/map/`;
}

function resolveLiveMapUrl() {
  if (typeof window === 'undefined') return buildDefaultLiveMapUrl();

  const params = new URLSearchParams(window.location.search);
  const queryValue = String(params.get('livemap') || params.get('livemap_url') || '').trim();
  if (queryValue) return queryValue;

  const configured = String(import.meta.env.VITE_LIVEMAP_URL || '').trim();
  if (configured) return configured;

  return buildDefaultLiveMapUrl();
}

export default function MapPage() {
  const liveMapUrl = resolveLiveMapUrl();

  return (
    <div className="-m-6 flex min-h-[calc(100vh-52px)] flex-col bg-cad-bg">
      <div className="flex items-center justify-between gap-3 border-b border-cad-border bg-cad-surface/80 px-4 py-2 backdrop-blur">
        <div>
          <h1 className="text-sm font-semibold text-cad-ink">Live Map</h1>
          <p className="text-xs text-cad-muted">
            Source: <span className="font-mono">{liveMapUrl}</span>
          </p>
        </div>
        <a
          href={liveMapUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center rounded border border-cad-border bg-cad-card px-3 py-1.5 text-xs text-cad-muted hover:text-cad-ink"
        >
          Open Standalone
        </a>
      </div>

      <div className="flex-1 bg-cad-card">
        <iframe
          title="Quokka Live Map"
          src={liveMapUrl}
          className="h-full w-full border-0"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
