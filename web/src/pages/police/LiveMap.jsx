import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CRS, latLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { api } from '../../api/client';
import { useDepartment } from '../../context/DepartmentContext';
import { formatTimeAU } from '../../utils/dateTime';

const MAP_POLL_INTERVAL_MS = 500;
const MAP_ACTIVE_MAX_AGE_MS = 5_000;
const MAP_RECOVERY_MAX_AGE_MS = 30_000;
const MAP_STALE_THRESHOLD_MS = 4_000;
const MAP_STALE_CHECK_INTERVAL_MS = 2_000;
const MAP_RECOVERY_COOLDOWN_MS = 8_000;

const TILE_SIZE = 1024;
const TILE_ROWS = 3;
const TILE_COLUMNS = 2;
const TILE_URL_TEMPLATE = '/tiles/minimap_sea_{y}_{x}.webp';
const MIN_ZOOM = -2;
const MAX_ZOOM = 2;
const NATIVE_ZOOM = 0;

// GTA V game-world bounds — matches SnailyCAD exactly.
const GAME = Object.freeze({
  x1: -4000.0 - 230,   // -4230
  y1: 8000.0 + 420,    //  8420
  x2: 400.0 - 30,      //   370
  y2: -300.0 - 340.0,  //  -640
});

function parseMapNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parsePositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.trunc(num);
  return rounded > 0 ? rounded : fallback;
}

function normalizeMapPlayer(entry) {
  const unitId = Number(entry?.unit_id || 0);
  const pos = entry?.pos || {};
  return {
    identifier: String(entry?.identifier || (unitId ? `unit:${unitId}` : '')).trim(),
    callsign: String(entry?.callsign || '').trim(),
    cadUserId: Number(entry?.cad_user_id || 0),
    unitId,
    unitStatus: String(entry?.status || '').trim().toLowerCase(),
    name: String(entry?.name || 'Unknown').trim() || 'Unknown',
    location: String(entry?.location || '').trim(),
    vehicle: String(entry?.vehicle || '').trim(),
    licensePlate: String(entry?.licensePlate || entry?.license_plate || '').trim(),
    weapon: String(entry?.weapon || '').trim(),
    icon: Number(entry?.icon || 6),
    hasSirenEnabled: entry?.hasSirenEnabled === true || entry?.has_siren_enabled === true,
    speed: Number(entry?.speed || 0),
    heading: Number(entry?.heading || 0),
    pos: {
      x: Number(pos.x || 0),
      y: Number(pos.y || 0),
      z: Number(pos.z || 0),
    },
    updatedAtMs: Number(entry?.updatedAtMs || Date.now()),
  };
}

function normalizePlayers(payload) {
  if (!Array.isArray(payload)) return [];
  const seen = new Set();
  const players = [];
  for (const raw of payload) {
    const player = normalizeMapPlayer(raw);
    if (!player.identifier || seen.has(player.identifier)) continue;
    seen.add(player.identifier);
    players.push(player);
  }
  return players;
}

function getMapBounds(map) {
  const h = TILE_SIZE * TILE_ROWS;
  const w = TILE_SIZE * TILE_COLUMNS;
  const southWest = map.unproject([0, h], 0);
  const northEast = map.unproject([w, 0], 0);
  return latLngBounds(southWest, northEast);
}

// Convert GTA V game coordinates to Leaflet lat/lng.
// Uses the same two-point linear interpolation as SnailyCAD so markers
// line up with the standard minimap_sea tile set.
function convertToMapLatLng(rawX, rawY, map) {
  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !map) return null;

  const width = TILE_SIZE * TILE_COLUMNS;
  const height = TILE_SIZE * TILE_ROWS;

  // Reference point 1 — top-left corner of tile grid (pixel 0,0).
  const latLng1 = map.unproject([0, 0], 0);
  // Reference point 2 — centre-X, bottom of second row (pixel width/2, height - TILE_SIZE).
  const latLng2 = map.unproject([width / 2, height - TILE_SIZE], 0);

  const rLng = latLng1.lng + ((x - GAME.x1) * (latLng1.lng - latLng2.lng)) / (GAME.x1 - GAME.x2);
  const rLat = latLng1.lat + ((y - GAME.y1) * (latLng1.lat - latLng2.lat)) / (GAME.y1 - GAME.y2);

  return { lat: rLat, lng: rLng };
}

function markerColor(player) {
  if (player.hasSirenEnabled) return '#ef4444';
  if (player.icon === 56) return '#3b82f6';
  if (player.icon === 64) return '#8b5cf6';
  if (player.icon === 68) return '#f59e0b';
  return '#22c55e';
}

function MapBoundsController({ resetSignal, onMapReady }) {
  const map = useMap();
  const appliedRef = useRef('');

  useEffect(() => {
    if (!map) return;
    onMapReady(map);

    const bounds = getMapBounds(map);
    const key = `bounds:${resetSignal}`;
    if (appliedRef.current === key) return;

    map.setMaxBounds(bounds);
    map.fitBounds(bounds, { animate: false });
    map.setMinZoom(MIN_ZOOM);
    map.setMaxZoom(MAX_ZOOM);
    map.setZoom(MIN_ZOOM);

    appliedRef.current = key;
  }, [map, resetSignal, onMapReady]);

  return null;
}

export default function LiveMap({ isPopout = false }) {
  const { key: locationKey } = useLocation();
  const { activeDepartment } = useDepartment();
  const [mapAvailable, setMapAvailable] = useState(false);
  const [missingTiles, setMissingTiles] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapConfigError, setMapConfigError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState(0);
  const [staleSinceAt, setStaleSinceAt] = useState(0);
  const [recoveringStaleFeed, setRecoveringStaleFeed] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [resetSignal, setResetSignal] = useState(0);
  const staleRecoveryInFlightRef = useRef(false);
  const lastRecoveryAttemptAtRef = useRef(0);
  const latestFeedUpdateMsRef = useRef(0);
  const staleSinceAtRef = useRef(0);

  const deptId = Number(activeDepartment?.id || 0);
  const isDispatchDepartment = !!activeDepartment?.is_dispatch;

  const fetchMapConfig = useCallback(async () => {
    try {
      const cfg = await api.get('/api/units/map-config');
      const tiles = Array.isArray(cfg?.missing_tiles)
        ? cfg.missing_tiles.map((t) => String(t || '').trim()).filter(Boolean)
        : [];
      const available = cfg?.map_available === true && tiles.length === 0;
      setMapAvailable(available);
      setMissingTiles(tiles);

      if (!available) {
        const missingText = tiles.length > 0 ? ` Missing: ${tiles.join(', ')}` : '';
        setMapConfigError(`Live map tiles are not fully uploaded.${missingText}`);
      } else {
        setMapConfigError('');
      }
    } catch {
      setMapConfigError('Failed to load live map tile configuration');
    }
  }, []);

  const fetchPlayers = useCallback(async (options = {}) => {
    if (!deptId) {
      setPlayers([]);
      setLoading(false);
      latestFeedUpdateMsRef.current = 0;
      staleSinceAtRef.current = 0;
      setStaleSinceAt(0);
      setRecoveringStaleFeed(false);
      return;
    }

    const recoveryMode = options?.recovery === true;
    const maxAgeMs = recoveryMode ? MAP_RECOVERY_MAX_AGE_MS : MAP_ACTIVE_MAX_AGE_MS;
    const cacheBuster = Date.now();

    try {
      const data = await api.get(
        `/api/units/live-map/players?department_id=${deptId}&dispatch=${isDispatchDepartment ? 'true' : 'false'}&max_age_ms=${maxAgeMs}&_=${cacheBuster}`
      );
      const nextPlayers = normalizePlayers(data?.payload || []);
      setPlayers(nextPlayers);
      setPlayerError('');
      setLastRefreshAt(Date.now());
      const latestUpdatedAtMs = nextPlayers.reduce((max, player) => {
        const updatedAt = Number(player?.updatedAtMs || 0);
        if (!Number.isFinite(updatedAt)) return max;
        return Math.max(max, updatedAt);
      }, 0);
      const nextFeedUpdateMs = latestUpdatedAtMs || Date.now();
      if (nextFeedUpdateMs > latestFeedUpdateMsRef.current) {
        latestFeedUpdateMsRef.current = nextFeedUpdateMs;
        staleSinceAtRef.current = 0;
        setStaleSinceAt(0);
        setRecoveringStaleFeed(false);
      }
    } catch (err) {
      setPlayerError(err?.message || 'Failed to load live map players');
    } finally {
      setLoading(false);
    }
  }, [deptId, isDispatchDepartment]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchMapConfig(), fetchPlayers()]);
  }, [fetchMapConfig, fetchPlayers]);

  // Initial load.
  useEffect(() => {
    setLoading(true);
    latestFeedUpdateMsRef.current = 0;
    staleSinceAtRef.current = 0;
    staleRecoveryInFlightRef.current = false;
    lastRecoveryAttemptAtRef.current = 0;
    setStaleSinceAt(0);
    setRecoveringStaleFeed(false);
    refreshAll();
  }, [refreshAll, locationKey]);

  // Player polling.
  useEffect(() => {
    const id = setInterval(fetchPlayers, MAP_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPlayers]);

  // Config polling.
  useEffect(() => {
    const id = setInterval(fetchMapConfig, 30000);
    return () => clearInterval(id);
  }, [fetchMapConfig]);

  // Stale-feed recovery.
  useEffect(() => {
    const id = setInterval(() => {
      if (!deptId) return;
      const latestFeedUpdateMs = latestFeedUpdateMsRef.current;
      if (!latestFeedUpdateMs) return;

      const now = Date.now();
      const feedAgeMs = now - latestFeedUpdateMs;
      if (feedAgeMs < MAP_STALE_THRESHOLD_MS) {
        if (staleSinceAtRef.current > 0) {
          staleSinceAtRef.current = 0;
          setStaleSinceAt(0);
        }
        if (recoveringStaleFeed) {
          setRecoveringStaleFeed(false);
        }
        return;
      }

      if (!staleSinceAtRef.current) {
        staleSinceAtRef.current = now;
        setStaleSinceAt(now);
      }

      if (staleRecoveryInFlightRef.current) return;
      if ((now - lastRecoveryAttemptAtRef.current) < MAP_RECOVERY_COOLDOWN_MS) return;

      staleRecoveryInFlightRef.current = true;
      lastRecoveryAttemptAtRef.current = now;
      setRecoveringStaleFeed(true);

      Promise.all([
        fetchMapConfig(),
        fetchPlayers({ recovery: true }),
      ]).finally(() => {
        staleRecoveryInFlightRef.current = false;
      });
    }, MAP_STALE_CHECK_INTERVAL_MS);

    return () => clearInterval(id);
  }, [deptId, fetchMapConfig, fetchPlayers, recoveringStaleFeed]);

  const markers = useMemo(() => {
    if (!mapInstance) return [];
    return players
      .map((player) => {
        const latLng = convertToMapLatLng(player.pos.x, player.pos.y, mapInstance);
        if (!latLng) return null;
        return { player, latLng };
      })
      .filter(Boolean);
  }, [players, mapInstance]);

  const error = mapConfigError || playerError;
  const staleFeedAgeSeconds = staleSinceAt
    ? Math.max(0, Math.floor((Date.now() - Math.max(1, latestFeedUpdateMsRef.current)) / 1000))
    : 0;
  const mapViewportClass = isPopout
    ? 'relative h-[calc(100vh-180px)] min-h-[420px] bg-[#0b1525]'
    : 'relative h-[72vh] min-h-[500px] bg-[#0b1525]';

  const openMapPopout = useCallback(() => {
    const next = window.open(
      '/map/popout',
      'cad_live_map_popout',
      'popup=yes,width=1400,height=900,resizable=yes,scrollbars=yes'
    );
    if (next && typeof next.focus === 'function') {
      next.focus();
    }
  }, []);

  const openMainMap = useCallback(() => {
    window.location.assign('/map');
  }, []);

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
            onClick={() => setResetSignal((prev) => prev + 1)}
            className="px-3 py-1.5 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
          >
            Reset View
          </button>
          <button
            onClick={refreshAll}
            className="px-3 py-1.5 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
        <div className="px-3 py-2 border-b border-cad-border flex flex-wrap items-center justify-between gap-2 text-xs text-cad-muted">
          <span>{markers.length} live marker{markers.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-3">
            {staleSinceAt ? (
              <span className="text-amber-300">
                {recoveringStaleFeed
                  ? `Feed stale (${staleFeedAgeSeconds}s) - recovering`
                  : `Feed stale (${staleFeedAgeSeconds}s)`}
              </span>
            ) : null}
            <span>
              {loading ? 'Loading...' : `Updated ${lastRefreshAt ? formatTimeAU(lastRefreshAt, '-') : 'never'}`}
            </span>
          </div>
        </div>

        <div className={mapViewportClass}>
          <MapContainer
            crs={CRS.Simple}
            center={[0, 0]}
            zoom={MIN_ZOOM}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            zoomControl={false}
            className="w-full h-full"
          >
            <MapBoundsController
              resetSignal={resetSignal}
              onMapReady={setMapInstance}
            />
            <TileLayer
              url={TILE_URL_TEMPLATE}
              tileSize={TILE_SIZE}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              minNativeZoom={NATIVE_ZOOM}
              maxNativeZoom={NATIVE_ZOOM}
              noWrap
            />

            {markers.map(({ player, latLng }) => (
              <CircleMarker
                key={player.identifier}
                center={[latLng.lat, latLng.lng]}
                radius={7}
                pathOptions={{
                  color: '#0f172a',
                  weight: 2,
                  fillColor: markerColor(player),
                  fillOpacity: 0.95,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1} className="!bg-slate-900 !text-slate-100 !border-slate-700">
                  <div className="text-xs">
                    <p className="font-semibold">{player.name}</p>
                    {player.callsign ? <p className="font-mono text-cyan-300">{player.callsign}</p> : null}
                    {player.vehicle ? <p>{player.vehicle}</p> : null}
                    <p>{player.location || 'No location'}</p>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>

          {!mapAvailable && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-cad-surface/95 border border-cad-border rounded px-4 py-2 text-xs text-amber-300 max-w-md text-center">
                Live map tiles are missing. Upload all required files in Admin &gt; System Settings.
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 whitespace-pre-wrap">{error}</p>
      )}
      {staleSinceAt && (
        <p className="text-xs text-amber-300">
          Live map feed has not advanced for {staleFeedAgeSeconds}s. Automatic recovery is running.
        </p>
      )}
    </div>
  );
}
