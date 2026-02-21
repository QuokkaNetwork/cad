import { useCallback, useMemo } from 'react';

const LIVE_MAP_INTERFACE_URL = '/live-map-interface/index.html';

export default function LiveMap({ isPopout = false }) {
  const interfaceUrl = useMemo(() => LIVE_MAP_INTERFACE_URL, []);

  const mapViewportClass = isPopout
    ? 'relative h-[calc(100vh-180px)] min-h-[420px] bg-[#0b1525]'
    : 'relative h-[72vh] min-h-[500px] bg-[#0b1525]';

  const openMapPopout = useCallback(() => {
    const next = window.open(
      '/map/popout',
      'cad_live_map_popout',
      'popup=yes,width=1600,height=980,resizable=yes,scrollbars=yes'
    );
    if (next && typeof next.focus === 'function') {
      next.focus();
    }
  }, []);

  const openMainMap = useCallback(() => {
    window.location.assign('/map');
  }, []);

  const openStandaloneInterface = useCallback(() => {
    window.open(interfaceUrl, '_blank', 'noopener,noreferrer');
  }, [interfaceUrl]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Unit Map</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isPopout && (
            <button
              onClick={openMapPopout}
              className="px-3 py-1.5 text-xs bg-cad-accent text-white border border-cad-accent/40 rounded hover:bg-cad-accent-light transition-colors"
            >
              Popout Map
            </button>
          )}
          {isPopout && (
            <button
              onClick={openMainMap}
              className="px-3 py-1.5 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Open In CAD
            </button>
          )}
          <button
            onClick={openStandaloneInterface}
            className="px-3 py-1.5 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
          >
            Open Standalone
          </button>
        </div>
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-cad-border flex flex-wrap items-center justify-between gap-2 text-xs text-cad-muted">
          <span>Using live_map-interface (official frontend)</span>
          <span className="font-mono">{interfaceUrl}</span>
        </div>

        <div className={mapViewportClass}>
          <iframe
            title="Live Map Interface"
            src={interfaceUrl}
            className="w-full h-full border-0"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>

      <p className="text-xs text-cad-muted">
        Interface config file: <span className="font-mono">web/public/live-map-interface/config.json</span>
      </p>
    </div>
  );
}
