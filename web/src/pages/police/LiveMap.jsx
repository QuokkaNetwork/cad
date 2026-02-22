import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CRS, LatLngBounds, icon as leafletIcon } from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { api } from '../../api/client';
import { useDepartment } from '../../context/DepartmentContext';
import { blipTypes } from './liveMap/blips';

const DEFAULT_TILE_SIZE = 1024;
const DEFAULT_TILE_ROWS = 3;
const DEFAULT_TILE_COLUMNS = 2;
const TILES_URL = '/tiles/minimap_sea_{y}_{x}.webp';
const BLIPS_URL = '/api/units/live-map/blips';
const BLIPS_FALLBACK_URLS = [
  '/live-map-interface/proxy/blips.json',
  '/blips.json',
];
const MAP_POLL_INTERVAL_MS = 1500;
const BLIPS_POLL_INTERVAL_MS = 2_000;
const ACTIVE_MAX_AGE_MS = 30_000;
const DEFAULT_ZOOM = -2;
const MIN_ZOOM = -2;
const MAX_ZOOM = 2;
const BLIP_SIZES = { width: 32, height: 32 };

// SnailyCAD's canonical GTA coordinate bounds for map projection.
const DEFAULT_GAME_BOUNDS = {
  x_1: -4000.0 - 230,
  y_1: 8000.0 + 420,
  x_2: 400.0 - 30,
  y_2: -300.0 - 340.0,
};
const DEFAULT_MAP_CONFIG = Object.freeze({
  tileSize: DEFAULT_TILE_SIZE,
  tileRows: DEFAULT_TILE_ROWS,
  tileColumns: DEFAULT_TILE_COLUMNS,
  gameBounds: { ...DEFAULT_GAME_BOUNDS },
});

const PLAYER_ICON = leafletIcon({
  iconUrl: '/map/ped.png',
  iconSize: [40, 40],
  popupAnchor: [0, -20],
  iconAnchor: [20, 20],
  tooltipAnchor: [0, -20],
});

const UNIT_FOOT_ICON = leafletIcon({
  iconUrl: '/map/unit_ped.png',
  iconSize: [20, 43],
  iconAnchor: [10, 22],
  popupAnchor: [0, -15],
  tooltipAnchor: [0, -15],
});

const PANIC_ICON = leafletIcon({
  iconUrl: '/map/panic.gif',
  iconSize: [25, 25],
  iconAnchor: [12.5, 12.5],
  popupAnchor: [0, -10],
  tooltipAnchor: [0, -10],
});

const SIREN_ICON = leafletIcon({
  iconUrl: '/map/siren.gif',
  iconSize: [35, 35],
  iconAnchor: [17.5, 17.5],
  popupAnchor: [0, 0],
});

const TRANSPARENT_PIXEL_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAFElEQVR4XgXAAQ0AAABAMP1L30IDCPwC/o5WcS4AAAAASUVORK5CYII=';
const MARKER_TYPE_CACHE = new Map();
const LEAFLET_ICON_CACHE = new Map();

function MapInitializer({ onReady }) {
  const map = useMap();

  useEffect(() => {
    onReady(map);
  }, [map, onReady]);

  return null;
}

function toFloat(value) {
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function toFiniteNumberOrNull(value) {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeGameBounds(rawBounds) {
  if (!rawBounds || typeof rawBounds !== 'object') return null;

  const x1 = toFiniteNumberOrNull(rawBounds?.x_1 ?? rawBounds?.x1);
  const y1 = toFiniteNumberOrNull(rawBounds?.y_1 ?? rawBounds?.y1);
  const x2 = toFiniteNumberOrNull(rawBounds?.x_2 ?? rawBounds?.x2);
  const y2 = toFiniteNumberOrNull(rawBounds?.y_2 ?? rawBounds?.y2);
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return null;
  if (!(x2 > x1) || !(y1 > y2)) return null;

  return { x_1: x1, y_1: y1, x_2: x2, y_2: y2 };
}

function normalizeMapConfig(payload) {
  const tileSize = toPositiveInt(payload?.tile_size, DEFAULT_TILE_SIZE);
  const tileRows = toPositiveInt(payload?.tile_rows, DEFAULT_TILE_ROWS);
  const tileColumns = toPositiveInt(payload?.tile_columns, DEFAULT_TILE_COLUMNS);
  const gameBounds = normalizeGameBounds(payload?.transform?.game_bounds)
    || normalizeGameBounds(payload?.game_bounds)
    || { ...DEFAULT_GAME_BOUNDS };

  return { tileSize, tileRows, tileColumns, gameBounds };
}

function getMapDimensions(mapConfig) {
  const config = mapConfig || DEFAULT_MAP_CONFIG;
  const height = config.tileSize * config.tileRows;
  const width = config.tileSize * config.tileColumns;
  return { height, width };
}

function getMapBounds(map, mapConfig) {
  const { height, width } = getMapDimensions(mapConfig);
  const southWest = map.unproject([0, height], 0);
  const northEast = map.unproject([width, 0], 0);
  return new LatLngBounds(southWest, northEast);
}

function convertToMap(rawX, rawY, map, mapConfig) {
  const x = toFloat(rawX);
  const y = toFloat(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const config = mapConfig || DEFAULT_MAP_CONFIG;
  const bounds = config.gameBounds || DEFAULT_GAME_BOUNDS;
  const { height, width } = getMapDimensions(config);
  const playableWidth = width / 2;
  const playableHeight = height - config.tileSize;
  const xRange = bounds.x_2 - bounds.x_1;
  const yRange = bounds.y_1 - bounds.y_2;
  if (xRange <= 0 || yRange <= 0 || playableWidth <= 0 || playableHeight <= 0) return null;

  const mapX = ((x - bounds.x_1) * playableWidth) / xRange;
  const mapY = ((bounds.y_1 - y) * playableHeight) / yRange;
  const latLng = map.unproject([mapX, mapY], 0);
  return { lat: latLng.lat, lng: latLng.lng };
}

function normalizeMapPlayer(entry) {
  const pos = entry?.pos || {};
  return {
    identifier: String(entry?.identifier || '').trim(),
    name: String(entry?.name || 'Unknown').trim() || 'Unknown',
    callsign: String(entry?.callsign || '').trim(),
    location: String(entry?.location || '').trim(),
    vehicle: String(entry?.vehicle || '').trim(),
    licensePlate: String(entry?.licensePlate || entry?.license_plate || '').trim(),
    weapon: String(entry?.weapon || '').trim(),
    icon: Number(entry?.icon || 6),
    hasSirenEnabled: entry?.hasSirenEnabled === true || entry?.has_siren_enabled === true,
    speed: Number(entry?.speed || 0),
    heading: Number(entry?.heading || 0),
    status: String(entry?.status || '').trim(),
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
    if (!player.identifier) continue;
    if (seen.has(player.identifier)) continue;
    seen.add(player.identifier);
    players.push(player);
  }
  return players;
}

function normalizeBlipsPayload(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const list = [];
  for (const [rawBlipId, rawEntries] of Object.entries(payload)) {
    const blipId = Number.parseInt(rawBlipId, 10);
    if (!Number.isFinite(blipId)) continue;
    if (!Array.isArray(rawEntries)) continue;

    for (const rawEntry of rawEntries) {
      const sourcePos = rawEntry && typeof rawEntry === 'object' && rawEntry.pos && typeof rawEntry.pos === 'object'
        ? rawEntry.pos
        : rawEntry;
      const x = Number(sourcePos?.x);
      const y = Number(sourcePos?.y);
      const z = Number(sourcePos?.z || 0);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      list.push({ blipId, x, y, z });
    }
  }
  return list;
}

function formatSpeedMph(value) {
  const speed = Number(value || 0);
  if (!Number.isFinite(speed) || speed <= 0) return '0 mph';
  return `${Math.round(speed * 2.23694)} mph`;
}

function makeLabel(player) {
  const callsign = String(player?.callsign || '').trim();
  const name = String(player?.name || '').trim();
  return `${callsign} ${name}`.trim() || name || callsign || 'Unknown';
}

function generateMarkerTypes() {
  if (MARKER_TYPE_CACHE.size > 0) {
    return Object.fromEntries(MARKER_TYPE_CACHE);
  }

  const markerTypes = {};
  let blipCss = `.blip {
    background: url("/map/blips_texturesheet.png");
    background-size: ${1024 / 2}px ${2000 / 2}px;
    display: inline-block;
    width: ${BLIP_SIZES.width}px;
    height: ${BLIP_SIZES.height}px;
  }`;

  const current = {
    x: 0,
    y: 0,
    id: 0,
  };

  for (const blipName in blipTypes) {
    const blip = blipTypes[blipName];

    if (!blip.id) {
      current.id += 1;
    } else {
      current.id = blip.id;
    }

    if (!blip.x) {
      current.x += 1;
    } else {
      current.x = blip.x;
    }

    if (blip.y) {
      current.y = blip.y;
    }

    markerTypes[current.id] = {
      name: blipName.replace(/([A-Z0-9])/g, ' $1').trim(),
      className: `blip blip-${blipName}`,
      iconUrl: TRANSPARENT_PIXEL_DATA_URL,
      iconSize: [BLIP_SIZES.width, BLIP_SIZES.height],
      iconAnchor: [BLIP_SIZES.width / 2, 0],
      popupAnchor: [0, 0],
    };

    const left = current.x * BLIP_SIZES.width;
    const top = current.y * BLIP_SIZES.height;
    blipCss += `.blip-${blipName} { background-position: -${left}px -${top}px }`;
  }

  if (typeof document !== 'undefined' && !document.getElementById('cad-live-map-blips-style')) {
    const style = document.createElement('style');
    style.id = 'cad-live-map-blips-style';
    style.innerHTML = blipCss;
    document.head.appendChild(style);
  }

  for (const [id, marker] of Object.entries(markerTypes)) {
    MARKER_TYPE_CACHE.set(Number(id), marker);
  }

  return markerTypes;
}

function getBlipIcon(blipId, markerTypes) {
  const numericId = Number(blipId);
  if (!Number.isFinite(numericId)) return null;
  const markerData = markerTypes[numericId];
  if (!markerData) return null;
  const cacheKey = `blip:${numericId}`;
  if (!LEAFLET_ICON_CACHE.has(cacheKey)) {
    LEAFLET_ICON_CACHE.set(cacheKey, leafletIcon(markerData));
  }
  return LEAFLET_ICON_CACHE.get(cacheKey);
}

function getPlayerIcon(player, markerTypes) {
  const iconId = Number.parseInt(String(player?.icon || 0), 10);
  if (iconId === 56 && player?.hasSirenEnabled) {
    return SIREN_ICON;
  }

  const blipIcon = getBlipIcon(iconId, markerTypes);
  if (blipIcon) return blipIcon;

  if (String(player?.status || '').trim().toLowerCase() === 'panic') {
    return PANIC_ICON;
  }

  if (!String(player?.vehicle || '').trim()) {
    return UNIT_FOOT_ICON;
  }

  return PLAYER_ICON;
}

function parseJsonSafely(rawText) {
  if (!rawText || !String(rawText).trim()) return {};
  try {
    return JSON.parse(rawText);
  } catch {
    return null;
  }
}

async function fetchJsonOrThrow(url) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });

  const text = await response.text();
  const parsed = parseJsonSafely(text);
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const looksLikeJsonContent = contentType.includes('application/json')
    || contentType.includes('+json')
    || contentType.includes('text/json');

  // Some fallback endpoints can return HTML/text (e.g. 404 pages). Skip those.
  if (parsed === null) {
    if (response.ok || looksLikeJsonContent) {
      throw new Error(`Live map blips endpoint returned invalid JSON (${url})`);
    }
    throw new Error(`Blips source not available (${url}, status ${response.status})`);
  }

  if (!response.ok) {
    const message = parsed && typeof parsed.error === 'string'
      ? parsed.error
      : `Failed to load blips (${response.status})`;
    throw new Error(message);
  }

  return parsed;
}

async function fetchBlipsFromProxy() {
  const sources = [BLIPS_URL, ...BLIPS_FALLBACK_URLS];
  let primaryError = null;
  let lastError = null;

  for (const source of sources) {
    try {
      return await fetchJsonOrThrow(source);
    } catch (error) {
      if (source === BLIPS_URL && !primaryError) {
        primaryError = error;
      }
      lastError = error;
    }
  }

  throw primaryError || lastError || new Error('Failed to load blips from all configured sources');
}

export default function LiveMap() {
  const { key: locationKey } = useLocation();
  const { activeDepartment } = useDepartment();
  const deptId = Number(activeDepartment?.id || 0);
  const isDispatchDepartment = !!activeDepartment?.is_dispatch;

  const [map, setMap] = useState(null);
  const [mapConfig, setMapConfig] = useState(DEFAULT_MAP_CONFIG);
  const [mapBounds, setMapBounds] = useState(null);
  const [players, setPlayers] = useState([]);
  const [blips, setBlips] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [mapConfigError, setMapConfigError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [blipError, setBlipError] = useState('');
  const [lastPlayersRefreshAt, setLastPlayersRefreshAt] = useState(0);
  const [lastBlipsRefreshAt, setLastBlipsRefreshAt] = useState(0);
  const [lastConfigRefreshAt, setLastConfigRefreshAt] = useState(0);

  const initializedMapRef = useRef(null);
  const markerTypes = useMemo(() => generateMarkerTypes(), []);
  const mapConfigKey = useMemo(() => {
    const bounds = mapConfig?.gameBounds || DEFAULT_GAME_BOUNDS;
    return [
      mapConfig?.tileSize || DEFAULT_TILE_SIZE,
      mapConfig?.tileRows || DEFAULT_TILE_ROWS,
      mapConfig?.tileColumns || DEFAULT_TILE_COLUMNS,
      bounds.x_1,
      bounds.y_1,
      bounds.x_2,
      bounds.y_2,
    ].join(':');
  }, [mapConfig]);

  const onMapReady = useCallback((nextMap) => {
    setMap(nextMap);
  }, []);

  const fetchMapConfig = useCallback(async () => {
    try {
      const data = await api.get('/api/units/map-config');
      setMapConfig(normalizeMapConfig(data || {}));
      setMapConfigError('');
      setLastConfigRefreshAt(Date.now());
    } catch (error) {
      setMapConfig({ ...DEFAULT_MAP_CONFIG, gameBounds: { ...DEFAULT_GAME_BOUNDS } });
      setMapConfigError(error?.message || 'Failed to load live map config');
    }
  }, []);

  useEffect(() => {
    if (!map) return;
    if (initializedMapRef.current?.map === map && initializedMapRef.current?.key === mapConfigKey) return;

    const bounds = getMapBounds(map, mapConfig);
    map.setMaxBounds(bounds);
    map.fitBounds(bounds);
    map.setMinZoom(MIN_ZOOM);
    map.setMaxZoom(MAX_ZOOM);
    map.setZoom(DEFAULT_ZOOM);
    setMapBounds(bounds);
    initializedMapRef.current = { map, key: mapConfigKey };
  }, [map, mapConfig, mapConfigKey]);

  useEffect(() => {
    fetchMapConfig();
  }, [fetchMapConfig, locationKey]);

  const fetchPlayers = useCallback(async () => {
    if (!deptId) {
      setPlayers([]);
      setPlayerError('No active department selected.');
      setLoadingPlayers(false);
      return;
    }

    try {
      const dispatchQuery = isDispatchDepartment ? 'true' : 'false';
      const data = await api.get(
        `/api/units/live-map/players?department_id=${deptId}&dispatch=${dispatchQuery}&max_age_ms=${ACTIVE_MAX_AGE_MS}`
      );
      setPlayers(normalizePlayers(data?.payload));
      setPlayerError('');
      setLastPlayersRefreshAt(Date.now());
    } catch (error) {
      setPlayerError(error?.message || 'Failed to load live map players');
    } finally {
      setLoadingPlayers(false);
    }
  }, [deptId, isDispatchDepartment]);

  const fetchBlips = useCallback(async () => {
    if (!map) return;
    try {
      const data = await fetchBlipsFromProxy();
      setBlips(normalizeBlipsPayload(data));
      setBlipError('');
      setLastBlipsRefreshAt(Date.now());
    } catch (error) {
      setBlipError(error?.message || 'Failed to load map blips');
    }
  }, [map]);

  useEffect(() => {
    setLoadingPlayers(true);
    fetchPlayers();
  }, [fetchPlayers, locationKey]);

  useEffect(() => {
    const id = window.setInterval(fetchPlayers, MAP_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fetchPlayers]);

  useEffect(() => {
    if (!map) return undefined;
    fetchBlips();
    const id = window.setInterval(fetchBlips, BLIPS_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [map, fetchBlips]);

  const playerMarkers = useMemo(() => {
    if (!map) return [];
    return players
      .map((player) => {
        const position = convertToMap(player.pos?.x, player.pos?.y, map, mapConfig);
        if (!position) return null;
        return {
          player,
          position,
          icon: getPlayerIcon(player, markerTypes),
          label: makeLabel(player),
        };
      })
      .filter(Boolean);
  }, [players, map, mapConfig, markerTypes]);

  const blipMarkers = useMemo(() => {
    if (!map) return [];
    return blips
      .map((blip, idx) => {
        const position = convertToMap(blip.x, blip.y, map, mapConfig);
        if (!position) return null;
        const icon = getBlipIcon(blip.blipId, markerTypes);
        if (!icon) return null;
        return {
          id: `${blip.blipId}:${blip.x}:${blip.y}:${idx}`,
          position,
          icon,
          name: markerTypes[blip.blipId]?.name || String(blip.blipId),
          blipId: blip.blipId,
        };
      })
      .filter(Boolean);
  }, [blips, map, mapConfig, markerTypes]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    const stillExists = playerMarkers.some((marker) => marker.player.identifier === selectedPlayerId);
    if (!stillExists) {
      setSelectedPlayerId(null);
    }
  }, [selectedPlayerId, playerMarkers]);

  const selectedMarker = useMemo(() => {
    const byId = playerMarkers.find((marker) => marker.player.identifier === selectedPlayerId);
    return byId || playerMarkers[0] || null;
  }, [playerMarkers, selectedPlayerId]);

  const handleResetView = useCallback(() => {
    if (!map) return;
    const bounds = mapBounds || getMapBounds(map, mapConfig);
    map.fitBounds(bounds);
    map.setZoom(DEFAULT_ZOOM);
  }, [map, mapBounds, mapConfig]);

  const handleRefresh = useCallback(() => {
    fetchMapConfig();
    fetchPlayers();
    fetchBlips();
  }, [fetchMapConfig, fetchPlayers, fetchBlips]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Unit Map</h2>
          <p className="text-sm text-cad-muted">
            Snaily-style tile map with native GTA bounds projection and no manual calibration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetView}
            className="px-3 py-1.5 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
          >
            Reset View
          </button>
          <button
            onClick={handleRefresh}
            className="px-3 py-1.5 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-cad-border flex flex-wrap items-center justify-between gap-2 text-xs text-cad-muted">
            <span>{playerMarkers.length} live unit marker{playerMarkers.length !== 1 ? 's' : ''}</span>
            <span>{blipMarkers.length} static blip{blipMarkers.length !== 1 ? 's' : ''}</span>
            <span>
              {loadingPlayers
                ? 'Loading...'
                : `Players ${lastPlayersRefreshAt ? new Date(lastPlayersRefreshAt).toLocaleTimeString() : 'never'}`}
            </span>
          </div>

          <div className="relative h-[72vh] min-h-[500px] bg-[#09111d]">
            <MapContainer
              className="w-full h-full"
              style={{ zIndex: 1 }}
              crs={CRS.Simple}
              center={[0, 0]}
              zoom={DEFAULT_ZOOM}
              zoomControl={false}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
            >
              <MapInitializer onReady={onMapReady} />

              <TileLayer
                key={`tiles:${mapConfig.tileSize}:${mapConfig.tileRows}:${mapConfig.tileColumns}`}
                url={TILES_URL}
                minZoom={MIN_ZOOM}
                maxZoom={MAX_ZOOM}
                tileSize={mapConfig.tileSize}
                maxNativeZoom={0}
                minNativeZoom={0}
              />

              {blipMarkers.map((blip) => (
                <Marker key={blip.id} draggable={false} icon={blip.icon} position={blip.position}>
                  <Tooltip direction="top">{blip.name}</Tooltip>
                </Marker>
              ))}

              {playerMarkers.map((marker) => (
                <Marker
                  key={marker.player.identifier}
                  icon={marker.icon}
                  position={marker.position}
                  eventHandlers={{
                    click: () => setSelectedPlayerId(marker.player.identifier),
                  }}
                >
                  <Tooltip direction="top">{marker.label}</Tooltip>
                  <Popup minWidth={320}>
                    <p><strong>Unit:</strong> {marker.label}</p>
                    <p><strong>Status:</strong> {marker.player.status || 'unknown'}</p>
                    <p><strong>Location:</strong> {marker.player.location || 'Unknown'}</p>
                    <p><strong>Vehicle:</strong> {marker.player.vehicle || 'On Foot'}</p>
                    {marker.player.licensePlate ? (
                      <p><strong>Plate:</strong> {marker.player.licensePlate}</p>
                    ) : null}
                    {marker.player.weapon ? (
                      <p><strong>Weapon:</strong> {marker.player.weapon}</p>
                    ) : null}
                    <p><strong>Speed:</strong> {formatSpeedMph(marker.player.speed)}</p>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            <div className="absolute left-3 bottom-3 bg-cad-surface/90 border border-cad-border rounded px-2 py-1 text-[11px] text-cad-muted">
              Mouse wheel to zoom | Drag to pan
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-cad-card border border-cad-border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Selected Unit</h3>
            {selectedMarker ? (
              <div className="space-y-1 text-sm">
                <p className="font-mono text-cad-accent-light">{selectedMarker.label}</p>
                <p className="text-cad-muted">Status: {selectedMarker.player.status || 'unknown'}</p>
                {selectedMarker.player.location ? (
                  <p className="text-cad-muted break-words">Location: {selectedMarker.player.location}</p>
                ) : null}
                <p className="text-cad-muted">Speed: {formatSpeedMph(selectedMarker.player.speed)}</p>
                <p className="text-cad-muted">
                  X {Number(selectedMarker.player.pos.x || 0).toFixed(1)} | Y {Number(selectedMarker.player.pos.y || 0).toFixed(1)}
                </p>
                <p className="text-cad-muted">
                  Vehicle: {selectedMarker.player.vehicle || 'On Foot'}
                </p>
                {selectedMarker.player.licensePlate ? (
                  <p className="text-cad-muted">Plate: {selectedMarker.player.licensePlate}</p>
                ) : null}
                {selectedMarker.player.weapon ? (
                  <p className="text-cad-muted">Weapon: {selectedMarker.player.weapon}</p>
                ) : null}
                <p className="text-xs text-cad-muted break-all">Identifier: {selectedMarker.player.identifier}</p>
                <p className="text-xs text-cad-muted">
                  Last update: {new Date(selectedMarker.player.updatedAtMs).toLocaleTimeString()}
                </p>
              </div>
            ) : (
              <p className="text-sm text-cad-muted">No active players on the live map yet.</p>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-3 text-xs text-cad-muted space-y-1">
            <p>Tile source: <span className="font-mono">/tiles/minimap_sea_&#123;y&#125;_&#123;x&#125;.webp</span></p>
            <p>Tile size: <span className="font-mono">{mapConfig.tileSize}</span> px</p>
            <p>Grid: <span className="font-mono">{mapConfig.tileRows}</span> rows x <span className="font-mono">{mapConfig.tileColumns}</span> columns</p>
            <p>Players source: <span className="font-mono">/api/units/live-map/players</span></p>
            <p>Blips source: <span className="font-mono">{BLIPS_URL}</span></p>
            <p>Player refresh: {MAP_POLL_INTERVAL_MS}ms</p>
            <p>Blip refresh: {Math.round(BLIPS_POLL_INTERVAL_MS / 1000)}s</p>
            <p>Latest blips update: {lastBlipsRefreshAt ? new Date(lastBlipsRefreshAt).toLocaleTimeString() : 'never'}</p>
            <p>Latest map config: {lastConfigRefreshAt ? new Date(lastConfigRefreshAt).toLocaleTimeString() : 'never'}</p>
            {mapConfigError ? <p className="text-red-400 whitespace-pre-wrap">{mapConfigError}</p> : null}
            {playerError ? <p className="text-red-400 whitespace-pre-wrap">{playerError}</p> : null}
            {blipError ? <p className="text-red-400 whitespace-pre-wrap">{blipError}</p> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
