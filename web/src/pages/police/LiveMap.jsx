import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CRS, latLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useDepartment } from '../../context/DepartmentContext';
import { formatTimeAU } from '../../utils/dateTime';

const MAP_POLL_INTERVAL_MS = 1500;
const MAP_ACTIVE_MAX_AGE_MS = 30_000;
const MAP_RECOVERY_MAX_AGE_MS = 5 * 60 * 1000;
const MAP_STALE_THRESHOLD_MS = 15_000;
const MAP_STALE_CHECK_INTERVAL_MS = 2_000;
const MAP_RECOVERY_COOLDOWN_MS = 8_000;

const DEFAULT_TILE_SIZE = 1024;
const DEFAULT_TILE_ROWS = 3;
const DEFAULT_TILE_COLUMNS = 2;
const DEFAULT_TILE_URL_TEMPLATE = '/tiles/minimap_sea_{y}_{x}.webp';
const DEFAULT_MIN_ZOOM = -2;
const DEFAULT_MAX_ZOOM = 2;
const DEFAULT_NATIVE_ZOOM = 0;
const DEFAULT_CALIBRATION_INCREMENT = 0.1;
const DEFAULT_SCALE_INCREMENT = 0.01;
const DEFAULT_GAME_BOUNDS = Object.freeze({
  // Match SnailyCAD map conversion constants exactly.
  x1: -4230,
  y1: 8420,
  x2: 370,
  y2: -640,
});

function parseMapNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function roundCalibrationValue(value) {
  return Math.round(Number(value) * 1000) / 1000;
}

function parseCalibrationIncrement(value, fallback = DEFAULT_CALIBRATION_INCREMENT) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.max(0.001, Math.min(100, num));
}

function getIncrementPrecision(step) {
  const text = String(step);
  const dotIndex = text.indexOf('.');
  if (dotIndex < 0) return 0;
  const decimals = text.slice(dotIndex + 1).replace(/0+$/, '');
  return Math.min(4, decimals.length || 1);
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

  const denomX = Number(gameBounds.x1) - Number(gameBounds.x2);
  const denomY = Number(gameBounds.y1) - Number(gameBounds.y2);
  if (Math.abs(denomX) < 0.0001 || Math.abs(denomY) < 0.0001) return null;

  const projectedLng = latLng1.lng + ((x - Number(gameBounds.x1)) * (latLng1.lng - latLng2.lng)) / denomX;
  const projectedLat = latLng1.lat + ((y - Number(gameBounds.y1)) * (latLng1.lat - latLng2.lat)) / denomY;
  const baseLatLng = { lat: projectedLat, lng: projectedLng };
  const baseProjected = map.project(baseLatLng, 0);
  let projectedX = baseProjected.x;
  let projectedY = baseProjected.y;

  const hasCalibration = calibration.scaleX !== 1
    || calibration.scaleY !== 1
    || calibration.offsetX !== 0
    || calibration.offsetY !== 0;
  if (hasCalibration) {
    projectedX = (projectedX * calibration.scaleX) + calibration.offsetX;
    projectedY = (projectedY * calibration.scaleY) + calibration.offsetY;
  }

  const adjustedLatLng = map.unproject([projectedX, projectedY], 0);
  return {
    lat: adjustedLatLng.lat,
    lng: adjustedLatLng.lng,
    projectedX,
    projectedY,
    outOfBounds: projectedX < 0 || projectedY < 0 || projectedX > width || projectedY > height,
  };
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

export default function LiveMap({ isPopout = false }) {
  const { key: locationKey } = useLocation();
  const { isAdmin } = useAuth();
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
  const [calibrationStep, setCalibrationStep] = useState(DEFAULT_CALIBRATION_INCREMENT);
  const [scaleStep, setScaleStep] = useState(DEFAULT_SCALE_INCREMENT);
  const [adminCalibrationVisible, setAdminCalibrationVisible] = useState(true);
  const [gameBounds, setGameBounds] = useState(DEFAULT_GAME_BOUNDS);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapConfigError, setMapConfigError] = useState('');
  const [playerError, setPlayerError] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState(0);
  const [staleSinceAt, setStaleSinceAt] = useState(0);
  const [recoveringStaleFeed, setRecoveringStaleFeed] = useState(false);
  const [mapInstance, setMapInstance] = useState(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [calibrationDirty, setCalibrationDirty] = useState(false);
  const [calibrationSaving, setCalibrationSaving] = useState(false);
  const [calibrationNotice, setCalibrationNotice] = useState('');
  const staleRecoveryInFlightRef = useRef(false);
  const lastRecoveryAttemptAtRef = useRef(0);
  const latestFeedUpdateMsRef = useRef(0);
  const staleSinceAtRef = useRef(0);

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
        // Match SnailyCAD map configuration exactly.
        tileSize: DEFAULT_TILE_SIZE,
        tileRows: DEFAULT_TILE_ROWS,
        tileColumns: DEFAULT_TILE_COLUMNS,
        minZoom: DEFAULT_MIN_ZOOM,
        maxZoom: DEFAULT_MAX_ZOOM,
        minNativeZoom: DEFAULT_NATIVE_ZOOM,
        maxNativeZoom: DEFAULT_NATIVE_ZOOM,
        missingTiles,
      });

      if (!calibrationDirty) {
        setMapScaleX(parseMapNumber(cfg?.map_scale_x, 1));
        setMapScaleY(parseMapNumber(cfg?.map_scale_y, 1));
        setMapOffsetX(parseMapNumber(cfg?.map_offset_x, 0));
        setMapOffsetY(parseMapNumber(cfg?.map_offset_y, 0));
        setCalibrationStep(parseCalibrationIncrement(cfg?.map_calibration_increment, DEFAULT_CALIBRATION_INCREMENT));
        setScaleStep(parseCalibrationIncrement(cfg?.map_scale_increment, DEFAULT_SCALE_INCREMENT));
      }
      setAdminCalibrationVisible(false);
      const cfgBounds = cfg?.map_game_bounds || {};
      setGameBounds({
        x1: parseMapNumber(cfgBounds?.x1 ?? cfg?.map_game_x1, DEFAULT_GAME_BOUNDS.x1),
        y1: parseMapNumber(cfgBounds?.y1 ?? cfg?.map_game_y1, DEFAULT_GAME_BOUNDS.y1),
        x2: parseMapNumber(cfgBounds?.x2 ?? cfg?.map_game_x2, DEFAULT_GAME_BOUNDS.x2),
        y2: parseMapNumber(cfgBounds?.y2 ?? cfg?.map_game_y2, DEFAULT_GAME_BOUNDS.y2),
      });

      if (!mapAvailable) {
        const missingText = missingTiles.length > 0 ? ` Missing: ${missingTiles.join(', ')}` : '';
        setMapConfigError(`Live map tiles are not fully uploaded.${missingText}`);
      } else {
        setMapConfigError('');
      }
    } catch {
      setMapConfigError('Failed to load live map tile configuration');
    }
  }, [calibrationDirty]);

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

  const nudgeCalibration = useCallback((deltaX, deltaY) => {
    const step = parseCalibrationIncrement(calibrationStep, DEFAULT_CALIBRATION_INCREMENT);
    setMapOffsetX((prev) => roundCalibrationValue(prev + (deltaX * step)));
    setMapOffsetY((prev) => roundCalibrationValue(prev + (deltaY * step)));
    setCalibrationDirty(true);
    setCalibrationNotice('');
  }, [calibrationStep]);

  const updateCalibrationStep = useCallback((value) => {
    setCalibrationStep(parseCalibrationIncrement(value, DEFAULT_CALIBRATION_INCREMENT));
    setCalibrationDirty(true);
    setCalibrationNotice('');
  }, []);

  const updateScaleStep = useCallback((value) => {
    setScaleStep(parseCalibrationIncrement(value, DEFAULT_SCALE_INCREMENT));
    setCalibrationDirty(true);
    setCalibrationNotice('');
  }, []);

  const resetCalibrationOffsets = useCallback(() => {
    setMapOffsetX(0);
    setMapOffsetY(0);
    setCalibrationDirty(true);
    setCalibrationNotice('');
  }, []);

  const resetCalibrationAll = useCallback(() => {
    setMapScaleX(1);
    setMapScaleY(1);
    setMapOffsetX(0);
    setMapOffsetY(0);
    setCalibrationDirty(true);
    setCalibrationNotice('');
  }, []);

  const nudgeScale = useCallback((deltaX, deltaY) => {
    const step = parseCalibrationIncrement(scaleStep, DEFAULT_SCALE_INCREMENT);
    setMapScaleX((prev) => roundCalibrationValue(Math.max(0.2, Math.min(5, prev + (deltaX * step)))));
    setMapScaleY((prev) => roundCalibrationValue(Math.max(0.2, Math.min(5, prev + (deltaY * step)))));
    setCalibrationDirty(true);
    setCalibrationNotice('');
  }, [scaleStep]);

  const saveCalibrationOffsets = useCallback(async () => {
    if (!isAdmin || calibrationSaving) return;
    setCalibrationSaving(true);
    setCalibrationNotice('');
    try {
      await api.put('/api/admin/settings', {
        settings: {
          live_map_scale_x: String(mapScaleX),
          live_map_scale_y: String(mapScaleY),
          live_map_offset_x: String(mapOffsetX),
          live_map_offset_y: String(mapOffsetY),
          live_map_calibration_increment: String(parseCalibrationIncrement(calibrationStep, DEFAULT_CALIBRATION_INCREMENT)),
          live_map_scale_increment: String(parseCalibrationIncrement(scaleStep, DEFAULT_SCALE_INCREMENT)),
        },
      });
      setCalibrationDirty(false);
      setCalibrationNotice('Calibration saved');
      fetchMapConfig();
    } catch (err) {
      setCalibrationNotice(err?.message || 'Failed to save calibration');
    } finally {
      setCalibrationSaving(false);
    }
  }, [isAdmin, calibrationSaving, mapScaleX, mapScaleY, mapOffsetX, mapOffsetY, calibrationStep, scaleStep, fetchMapConfig]);

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

  useEffect(() => {
    const id = setInterval(fetchPlayers, MAP_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPlayers]);

  useEffect(() => {
    const id = setInterval(fetchMapConfig, 30000);
    return () => clearInterval(id);
  }, [fetchMapConfig]);

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
  const outOfBoundsCount = useMemo(() => markers.filter((m) => m?.latLng?.outOfBounds === true).length, [markers]);

  const mapKey = `${tileConfig.tileUrlTemplate}|${tileConfig.tileSize}|${tileConfig.tileRows}|${tileConfig.tileColumns}`;
  const error = mapConfigError || playerError;
  const calibrationPrecision = Math.max(1, getIncrementPrecision(calibrationStep));
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

      {isAdmin && adminCalibrationVisible && (
        <div className="bg-cad-card border border-cad-border rounded-lg px-3 py-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-cad-muted">Calibration</span>
            <label className="inline-flex items-center gap-1 text-cad-muted">
              Move Step
              <input
                type="number"
                min="0.001"
                step="0.1"
                value={calibrationStep}
                onChange={(e) => updateCalibrationStep(e.target.value)}
                className="w-20 bg-cad-surface border border-cad-border rounded px-2 py-1 text-xs text-cad-ink focus:outline-none focus:border-cad-accent"
              />
            </label>
            <label className="inline-flex items-center gap-1 text-cad-muted">
              Scale Step
              <input
                type="number"
                min="0.001"
                step="0.01"
                value={scaleStep}
                onChange={(e) => updateScaleStep(e.target.value)}
                className="w-20 bg-cad-surface border border-cad-border rounded px-2 py-1 text-xs text-cad-ink focus:outline-none focus:border-cad-accent"
              />
            </label>
            <button
              type="button"
              onClick={() => nudgeCalibration(0, -1)}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => nudgeCalibration(0, 1)}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => nudgeCalibration(-1, 0)}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Left
            </button>
            <button
              type="button"
              onClick={() => nudgeCalibration(1, 0)}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Right
            </button>
            <button
              type="button"
              onClick={() => nudgeScale(1, 0)}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Scale X+
            </button>
            <button
              type="button"
              onClick={() => nudgeScale(-1, 0)}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Scale X-
            </button>
            <button
              type="button"
              onClick={() => nudgeScale(0, 1)}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Scale Y+
            </button>
            <button
              type="button"
              onClick={() => nudgeScale(0, -1)}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Scale Y-
            </button>
            <button
              type="button"
              onClick={resetCalibrationOffsets}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Reset Offsets
            </button>
            <button
              type="button"
              onClick={resetCalibrationAll}
              className="px-2 py-1 bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
            >
              Reset All
            </button>
            <button
              type="button"
              onClick={saveCalibrationOffsets}
              disabled={!calibrationDirty || calibrationSaving}
              className="px-2 py-1 bg-cad-accent text-white border border-cad-accent/40 rounded hover:bg-cad-accent-light transition-colors disabled:opacity-50"
            >
              {calibrationSaving ? 'Saving...' : 'Save'}
            </button>
            <span className="font-mono text-cad-muted">
              scaleX {mapScaleX.toFixed(3)} | scaleY {mapScaleY.toFixed(3)} |
            </span>
            <span className="font-mono text-cad-muted">
              offsetX {mapOffsetX.toFixed(calibrationPrecision)} | offsetY {mapOffsetY.toFixed(calibrationPrecision)}
            </span>
            {calibrationDirty && (
              <span className="text-amber-300">Unsaved changes</span>
            )}
            {calibrationNotice && (
              <span className={calibrationNotice === 'Calibration saved' ? 'text-emerald-400' : 'text-red-400'}>
                {calibrationNotice}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-cad-muted">
            If markers appear low compared to in-game, use Up. If markers appear high, use Down.
            If alignment is correct in one area but drifts in another, adjust scale (X/Y) then save.
          </p>
        </div>
      )}

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
      {!error && outOfBoundsCount > 0 && (
        <p className="text-xs text-amber-300">
          {outOfBoundsCount} marker{outOfBoundsCount !== 1 ? 's are' : ' is'} outside tile bounds. This usually means map scale/bounds need recalibration.
        </p>
      )}
      {staleSinceAt && (
        <p className="text-xs text-amber-300">
          Live map feed has not advanced for {staleFeedAgeSeconds}s. Automatic recovery is running.
        </p>
      )}
    </div>
  );
}
