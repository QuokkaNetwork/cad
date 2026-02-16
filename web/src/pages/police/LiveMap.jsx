import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CRS, latLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { api } from '../../api/client';
import { useDepartment } from '../../context/DepartmentContext';

const MAP_POLL_INTERVAL_MS = 1500;
const MAP_ACTIVE_MAX_AGE_MS = 30_000;

const DEFAULT_TILE_SIZE = 1024;
const DEFAULT_TILE_ROWS = 3;
const DEFAULT_TILE_COLUMNS = 2;
const DEFAULT_TILE_URL_TEMPLATE = '/tiles/minimap_sea_{y}_{x}.webp';
const DEFAULT_MIN_ZOOM = -2;
const DEFAULT_MAX_ZOOM = 4;
const DEFAULT_NATIVE_ZOOM = 0;
const DEFAULT_GAME_BOUNDS = Object.freeze({
  x1: -4230,
  y1: 8420,
  x2: 370,
  y2: -640,
});

function parseMapNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
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

function getMapBounds(map, tileConfig) {
  const height = tileConfig.tileSize * tileConfig.tileRows;
  const width = tileConfig.tileSize * tileConfig.tileColumns;
  const southWest = map.unproject([0, height], 0);
  const northEast = map.unproject([width, 0], 0);
  return latLngBounds(southWest, northEast);
}

function convertToMapLatLng(rawX, rawY, map, tileConfig, calibration, gameBounds) {
  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !map) return null;

  const width = tileConfig.tileSize * tileConfig.tileColumns;
  const height = tileConfig.tileSize * tileConfig.tileRows;

  const latLng1 = map.unproject([0, 0], 0);
  const latLng2 = map.unproject([width / 2, height - tileConfig.tileSize], 0);

  let lng = latLng1.lng + ((x - gameBounds.x1) * (latLng1.lng - latLng2.lng)) / (gameBounds.x1 - gameBounds.x2);
  let lat = latLng1.lat + ((y - gameBounds.y1) * (latLng1.lat - latLng2.lat)) / (gameBounds.y1 - gameBounds.y2);

  const hasCalibration = calibration.scaleX !== 1
    || calibration.scaleY !== 1
    || calibration.offsetX !== 0
    || calibration.offsetY !== 0;

  if (hasCalibration) {
    const projected = map.project([lat, lng], 0);
    const adjustedX = (projected.x * calibration.scaleX) + calibration.offsetX;
    const adjustedY = (projected.y * calibration.scaleY) + calibration.offsetY;
    const adjustedLatLng = map.unproject([adjustedX, adjustedY], 0);
    lat = adjustedLatLng.lat;
    lng = adjustedLatLng.lng;
  }

  return { lat, lng };
}

function markerColor(player) {
  if (player.hasSirenEnabled) return '#ef4444';
  if (player.icon === 56) return '#3b82f6';
  if (player.icon === 64) return '#8b5cf6';
  if (player.icon === 68) return '#f59e0b';
  return '#22c55e';
}

function MapBoundsController({ tileConfig, resetSignal, onMapReady }) {
  const map = useMap();
  const appliedRef = useRef('');

  useEffect(() => {
    if (!map) return;
    onMapReady(map);

    const bounds = getMapBounds(map, tileConfig);
    const key = `${tileConfig.tileSize}:${tileConfig.tileRows}:${tileConfig.tileColumns}:${resetSignal}`;
    if (appliedRef.current === key) return;

    map.setMaxBounds(bounds);
    map.fitBounds(bounds, { animate: false });
    map.setMinZoom(tileConfig.minZoom);
    map.setMaxZoom(tileConfig.maxZoom);
    if (map.getZoom() < tileConfig.minZoom || map.getZoom() > tileConfig.maxZoom) {
      map.setZoom(Math.max(tileConfig.minZoom, Math.min(0, tileConfig.maxZoom)));
    }

    appliedRef.current = key;
  }, [map, tileConfig, resetSignal, onMapReady]);

  return null;
}

export default function LiveMap() {
  const { key: locationKey } = useLocation();
  const { activeDepartment } = useDepartment();
  const [tileConfig, setTileConfig] = useState({
    mapAvailable: false,
    tileUrlTemplate: DEFAULT_TILE_URL_TEMPLATE,
    tileSize: DEFAULT_TILE_SIZE,
    tileRows: DEFAULT_TILE_ROWS,
    tileColumns: DEFAULT_TILE_COLUMNS,
    minZoom: DEFAULT_MIN_ZOOM,
    maxZoom: DEFAULT_MAX_ZOOM,
    minNativeZoom: DEFAULT_NATIVE_ZOOM,
    maxNativeZoom: DEFAULT_NATIVE_ZOOM,
    missingTiles: [],
  });
  const [mapScaleX, setMapScaleX] = useState(1);
  const [mapScaleY, setMapScaleY] = useState(1);
  const [mapOffsetX, setMapOffsetX] = useState(0);
  const [mapOffsetY, setMapOffsetY] = useState(0);
  const [gameBounds, setGameBounds] = useState(DEFAULT_GAME_BOUNDS);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapConfigError, setMapConfigError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState(0);
  const [mapInstance, setMapInstance] = useState(null);
  const [resetSignal, setResetSignal] = useState(0);

  const deptId = Number(activeDepartment?.id || 0);
  const isDispatchDepartment = !!activeDepartment?.is_dispatch;

  const fetchMapConfig = useCallback(async () => {
    try {
      const cfg = await api.get('/api/units/map-config');
      const missingTiles = Array.isArray(cfg?.missing_tiles)
        ? cfg.missing_tiles.map((tile) => String(tile || '').trim()).filter(Boolean)
        : [];
      const mapAvailable = cfg?.map_available === true && missingTiles.length === 0;

      setTileConfig({
        mapAvailable,
        tileUrlTemplate: String(cfg?.tile_url_template || DEFAULT_TILE_URL_TEMPLATE).trim() || DEFAULT_TILE_URL_TEMPLATE,
        tileSize: Math.max(128, Math.round(parseMapNumber(cfg?.tile_size, DEFAULT_TILE_SIZE))),
        tileRows: Math.max(1, Math.round(parseMapNumber(cfg?.tile_rows, DEFAULT_TILE_ROWS))),
        tileColumns: Math.max(1, Math.round(parseMapNumber(cfg?.tile_columns, DEFAULT_TILE_COLUMNS))),
        minZoom: parseMapNumber(cfg?.min_zoom, DEFAULT_MIN_ZOOM),
        maxZoom: parseMapNumber(cfg?.max_zoom, DEFAULT_MAX_ZOOM),
        minNativeZoom: parseMapNumber(cfg?.min_native_zoom, DEFAULT_NATIVE_ZOOM),
        maxNativeZoom: parseMapNumber(cfg?.max_native_zoom, DEFAULT_NATIVE_ZOOM),
        missingTiles,
      });

      setMapScaleX(parseMapNumber(cfg?.map_scale_x, 1));
      setMapScaleY(parseMapNumber(cfg?.map_scale_y, 1));
      setMapOffsetX(parseMapNumber(cfg?.map_offset_x, 0));
      setMapOffsetY(parseMapNumber(cfg?.map_offset_y, 0));

      const cfgBounds = cfg?.map_game_bounds || {};
      const nextGameBounds = {
        x1: parseMapNumber(cfgBounds?.x1 ?? cfg?.map_game_x1, DEFAULT_GAME_BOUNDS.x1),
        y1: parseMapNumber(cfgBounds?.y1 ?? cfg?.map_game_y1, DEFAULT_GAME_BOUNDS.y1),
        x2: parseMapNumber(cfgBounds?.x2 ?? cfg?.map_game_x2, DEFAULT_GAME_BOUNDS.x2),
        y2: parseMapNumber(cfgBounds?.y2 ?? cfg?.map_game_y2, DEFAULT_GAME_BOUNDS.y2),
      };
      setGameBounds(nextGameBounds);

      if (!mapAvailable) {
        const missingText = missingTiles.length > 0 ? ` Missing: ${missingTiles.join(', ')}` : '';
        setMapConfigError(`Live map tiles are not fully uploaded.${missingText}`);
      } else {
        setMapConfigError('');
      }
    } catch {
      setMapConfigError('Failed to load live map tile configuration');
    }
  }, []);

  const fetchPlayers = useCallback(async () => {
    if (!deptId) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    try {
      const data = await api.get(
        `/api/units/live-map/players?department_id=${deptId}&dispatch=${isDispatchDepartment ? 'true' : 'false'}&max_age_ms=${MAP_ACTIVE_MAX_AGE_MS}`
      );
      const nextPlayers = normalizePlayers(data?.payload || []);
      setPlayers(nextPlayers);
      setPlayerError('');
      setLastRefreshAt(Date.now());
    } catch (err) {
      setPlayerError(err?.message || 'Failed to load live map players');
    } finally {
      setLoading(false);
    }
  }, [deptId, isDispatchDepartment]);

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchMapConfig(), fetchPlayers()]);
  }, [fetchMapConfig, fetchPlayers]);

  useEffect(() => {
    setLoading(true);
    refreshAll();
  }, [refreshAll, locationKey]);

  useEffect(() => {
    const id = setInterval(fetchPlayers, MAP_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPlayers]);

  useEffect(() => {
    const id = setInterval(fetchMapConfig, 30000);
    return () => clearInterval(id);
  }, [fetchMapConfig]);

  const calibration = useMemo(() => ({
    scaleX: mapScaleX,
    scaleY: mapScaleY,
    offsetX: mapOffsetX,
    offsetY: mapOffsetY,
  }), [mapOffsetX, mapOffsetY, mapScaleX, mapScaleY]);

  const markers = useMemo(() => {
    if (!mapInstance) return [];
    return players
      .map((player) => {
        const latLng = convertToMapLatLng(player.pos.x, player.pos.y, mapInstance, tileConfig, calibration, gameBounds);
        if (!latLng) return null;
        return { player, latLng };
      })
      .filter(Boolean);
  }, [players, mapInstance, tileConfig, calibration, gameBounds]);

  const mapKey = `${tileConfig.tileUrlTemplate}|${tileConfig.tileSize}|${tileConfig.tileRows}|${tileConfig.tileColumns}`;
  const error = mapConfigError || playerError;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Unit Map</h2>
          <p className="text-sm text-cad-muted">
            Snaily-style tile map fed by CAD bridge heartbeat data.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <span>
            {loading ? 'Loading...' : `Updated ${lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : 'never'}`}
          </span>
        </div>

        <div className="relative h-[72vh] min-h-[500px] bg-[#0b1525]">
          <MapContainer
            key={mapKey}
            crs={CRS.Simple}
            center={[0, 0]}
            zoom={tileConfig.minZoom}
            minZoom={tileConfig.minZoom}
            maxZoom={tileConfig.maxZoom}
            zoomControl
            className="w-full h-full"
          >
            <MapBoundsController
              tileConfig={tileConfig}
              resetSignal={resetSignal}
              onMapReady={setMapInstance}
            />
            <TileLayer
              url={tileConfig.tileUrlTemplate}
              tileSize={tileConfig.tileSize}
              minZoom={tileConfig.minZoom}
              maxZoom={tileConfig.maxZoom}
              minNativeZoom={tileConfig.minNativeZoom}
              maxNativeZoom={tileConfig.maxNativeZoom}
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

          {!tileConfig.mapAvailable && (
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
    </div>
  );
}
