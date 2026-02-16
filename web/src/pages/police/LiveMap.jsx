import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';

const DEFAULT_MAP_IMAGE_URL = '/maps/FullMap.png';
const MAP_WIDTH = 2048;
const MAP_HEIGHT = 3072;
const MAP_POLL_INTERVAL_MS = 1500;
const MAP_ACTIVE_MAX_AGE_MS = 30_000;
const MAP_MIN_WIDTH = MAP_WIDTH * 0.02;
const MAP_MAX_WIDTH = MAP_WIDTH * 3.5;

const SNAILY_GAME_BOUNDS = {
  x1: -4230,
  y1: 8420,
  x2: 370,
  y2: -640,
};

function createInitialViewBox() {
  const width = MAP_WIDTH * 0.5;
  const height = width * (MAP_HEIGHT / MAP_WIDTH);
  return {
    x: (MAP_WIDTH - width) / 2,
    y: (MAP_HEIGHT - height) / 2,
    width,
    height,
  };
}

function parseMapNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeMapPlayer(entry) {
  const pos = entry?.pos || {};
  return {
    identifier: String(entry?.identifier || '').trim(),
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
    if (!player.identifier) continue;
    if (seen.has(player.identifier)) continue;
    seen.add(player.identifier);
    players.push(player);
  }
  return players;
}

function convertToMapPoint(rawX, rawY, calibration) {
  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const xRange = SNAILY_GAME_BOUNDS.x2 - SNAILY_GAME_BOUNDS.x1;
  const yRange = SNAILY_GAME_BOUNDS.y2 - SNAILY_GAME_BOUNDS.y1;
  if (!xRange || !yRange) return null;

  const basePx = ((x - SNAILY_GAME_BOUNDS.x1) * MAP_WIDTH) / xRange;
  const basePy = ((y - SNAILY_GAME_BOUNDS.y1) * MAP_HEIGHT) / yRange;
  const px = (basePx * calibration.scaleX) + calibration.offsetX;
  const py = (basePy * calibration.scaleY) + calibration.offsetY;
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

  return { x: px, y: py };
}

function formatSpeedMph(value) {
  const speed = Number(value || 0);
  if (!Number.isFinite(speed) || speed <= 0) return '0 mph';
  return `${Math.round(speed * 2.23694)} mph`;
}

function markerColor(player) {
  if (player.hasSirenEnabled) return '#ef4444';
  if (player.icon === 56) return '#3b82f6';
  if (player.icon === 64) return '#8b5cf6';
  if (player.icon === 68) return '#f59e0b';
  return '#22c55e';
}

export default function LiveMap() {
  const { key: locationKey } = useLocation();
  const [viewBox, setViewBox] = useState(createInitialViewBox);
  const [mapImageUrl, setMapImageUrl] = useState(DEFAULT_MAP_IMAGE_URL);
  const [mapScaleX, setMapScaleX] = useState(1);
  const [mapScaleY, setMapScaleY] = useState(1);
  const [mapOffsetX, setMapOffsetX] = useState(0);
  const [mapOffsetY, setMapOffsetY] = useState(0);
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState(0);

  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const fetchMapConfig = useCallback(async () => {
    try {
      const cfg = await api.get('/api/units/map-config');
      const url = String(cfg?.map_image_url || '').trim();
      setMapImageUrl(url || DEFAULT_MAP_IMAGE_URL);
      setMapScaleX(parseMapNumber(cfg?.map_scale_x, 1));
      setMapScaleY(parseMapNumber(cfg?.map_scale_y, 1));
      setMapOffsetX(parseMapNumber(cfg?.map_offset_x, 0));
      setMapOffsetY(parseMapNumber(cfg?.map_offset_y, 0));
    } catch {
      setMapImageUrl(DEFAULT_MAP_IMAGE_URL);
      setMapScaleX(1);
      setMapScaleY(1);
      setMapOffsetX(0);
      setMapOffsetY(0);
    }
  }, []);

  const fetchPlayers = useCallback(async () => {
    try {
      const data = await api.get(`/api/units/live-map/players?max_age_ms=${MAP_ACTIVE_MAX_AGE_MS}`);
      const nextPlayers = normalizePlayers(data?.payload || []);
      setPlayers(nextPlayers);
      setError('');
      setLastRefreshAt(Date.now());
    } catch (err) {
      setError(err?.message || 'Failed to load live map players');
    } finally {
      setLoading(false);
    }
  }, []);

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

  const markers = useMemo(() => {
    const calibration = {
      scaleX: mapScaleX,
      scaleY: mapScaleY,
      offsetX: mapOffsetX,
      offsetY: mapOffsetY,
    };

    return players
      .map((player) => {
        const point = convertToMapPoint(player.pos.x, player.pos.y, calibration);
        if (!point) return null;
        return { player, point };
      })
      .filter(Boolean);
  }, [mapOffsetX, mapOffsetY, mapScaleX, mapScaleY, players]);

  const selectedMarker = useMemo(() => {
    const byId = markers.find(marker => marker.player.identifier === selectedPlayerId);
    return byId || markers[0] || null;
  }, [markers, selectedPlayerId]);

  useEffect(() => {
    if (!selectedPlayerId) return;
    if (!markers.some(marker => marker.player.identifier === selectedPlayerId)) {
      setSelectedPlayerId(null);
    }
  }, [markers, selectedPlayerId]);

  const clampWidth = useCallback((value) => {
    return Math.min(MAP_MAX_WIDTH, Math.max(MAP_MIN_WIDTH, value));
  }, []);

  const clampViewBox = useCallback((next) => {
    const width = clampWidth(next.width);
    const height = width * (MAP_HEIGHT / MAP_WIDTH);
    const maxX = Math.max(0, MAP_WIDTH - width);
    const maxY = Math.max(0, MAP_HEIGHT - height);
    return {
      x: Math.max(0, Math.min(maxX, next.x)),
      y: Math.max(0, Math.min(maxY, next.y)),
      width,
      height,
    };
  }, [clampWidth]);

  const screenToMap = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;

    try {
      const screenPoint = svg.createSVGPoint();
      screenPoint.x = clientX;
      screenPoint.y = clientY;
      const mapPoint = screenPoint.matrixTransform(ctm.inverse());
      return {
        x: mapPoint.x,
        y: mapPoint.y,
      };
    } catch {
      return null;
    }
  }, []);

  const zoomAt = useCallback((factor, clientX, clientY) => {
    setViewBox((current) => {
      const pivot = screenToMap(clientX, clientY);
      if (!pivot) return current;

      const width = clampWidth(current.width * factor);
      const ratio = width / current.width;
      if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.000001) return current;

      const height = width * (MAP_HEIGHT / MAP_WIDTH);
      const next = {
        x: pivot.x - ((pivot.x - current.x) * ratio),
        y: pivot.y - ((pivot.y - current.y) * ratio),
        width,
        height,
      };
      return clampViewBox(next);
    });
  }, [clampViewBox, clampWidth, screenToMap]);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 0.9 : 1.1;
    zoomAt(factor, event.clientX, event.clientY);
  }, [zoomAt]);

  const handlePointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    const svg = svgRef.current;
    if (!svg) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startViewBox: { ...viewBox },
    };
    svg.setPointerCapture(event.pointerId);
  }, [viewBox]);

  const handlePointerMove = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg || !dragRef.current) return;
    if (dragRef.current.pointerId !== event.pointerId) return;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const deltaX = event.clientX - dragRef.current.startClientX;
    const deltaY = event.clientY - dragRef.current.startClientY;
    const worldDx = deltaX * (dragRef.current.startViewBox.width / rect.width);
    const worldDy = deltaY * (dragRef.current.startViewBox.height / rect.height);

    setViewBox(clampViewBox({
      x: dragRef.current.startViewBox.x - worldDx,
      y: dragRef.current.startViewBox.y - worldDy,
      width: dragRef.current.startViewBox.width,
      height: dragRef.current.startViewBox.height,
    }));
  }, [clampViewBox]);

  const handlePointerUp = useCallback((event) => {
    const svg = svgRef.current;
    if (!svg || !dragRef.current) return;
    if (dragRef.current.pointerId !== event.pointerId) return;
    svg.releasePointerCapture(event.pointerId);
    dragRef.current = null;
  }, []);

  const markerRadius = viewBox.width * 0.006;
  const labelSize = Math.max(8, markerRadius * 2.2);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Unit Map</h2>
          <p className="text-sm text-cad-muted">
            CAD bridge heartbeat mapped onto the repo map resource with live calibration support.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewBox(createInitialViewBox())}
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

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-cad-border flex flex-wrap items-center justify-between gap-2 text-xs text-cad-muted">
            <span>{markers.length} live marker{markers.length !== 1 ? 's' : ''}</span>
            <span>
              {loading ? 'Loading...' : `Updated ${lastRefreshAt ? new Date(lastRefreshAt).toLocaleTimeString() : 'never'}`}
            </span>
          </div>

          <div className="relative h-[72vh] min-h-[500px] bg-[#0b1525]">
            <svg
              ref={svgRef}
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              className="w-full h-full touch-none cursor-grab active:cursor-grabbing"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              <rect x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} fill="#09111d" />

              <image
                href={mapImageUrl}
                x={0}
                y={0}
                width={MAP_WIDTH}
                height={MAP_HEIGHT}
                preserveAspectRatio="none"
                opacity="0.94"
              />

              {markers.map(({ player, point }) => {
                const selected = selectedMarker?.player.identifier === player.identifier;
                const color = markerColor(player);
                return (
                  <g
                    key={player.identifier}
                    transform={`translate(${point.x} ${point.y})`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedPlayerId(player.identifier)}
                  >
                    <circle
                      r={selected ? markerRadius * 1.35 : markerRadius}
                      fill={color}
                      stroke={selected ? '#ffffff' : '#0b1320'}
                      strokeWidth={selected ? markerRadius * 0.24 : markerRadius * 0.18}
                    />
                    <text
                      x={markerRadius * 1.2}
                      y={-markerRadius * 1.1}
                      fill="#e2e8f0"
                      fontSize={labelSize}
                      fontWeight="700"
                    >
                      {player.name}
                    </text>
                    {player.vehicle && (
                      <text
                        x={markerRadius * 1.2}
                        y={markerRadius * 1.35}
                        fill="#94a3b8"
                        fontSize={Math.max(7, labelSize * 0.68)}
                      >
                        {player.vehicle}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="absolute left-3 bottom-3 bg-cad-surface/90 border border-cad-border rounded px-2 py-1 text-[11px] text-cad-muted">
              Mouse wheel to zoom | Drag to pan
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-cad-card border border-cad-border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Selected Marker</h3>
            {selectedMarker ? (
              <div className="space-y-1 text-sm">
                <p className="font-mono text-cad-accent-light">{selectedMarker.player.name}</p>
                {selectedMarker.player.location && (
                  <p className="text-cad-muted break-words">Location: {selectedMarker.player.location}</p>
                )}
                <p className="text-cad-muted">Speed: {formatSpeedMph(selectedMarker.player.speed)}</p>
                <p className="text-cad-muted">
                  X {Number(selectedMarker.player.pos.x || 0).toFixed(1)} | Y {Number(selectedMarker.player.pos.y || 0).toFixed(1)}
                </p>
                {selectedMarker.player.vehicle ? (
                  <p className="text-cad-muted">Vehicle: {selectedMarker.player.vehicle}</p>
                ) : (
                  <p className="text-cad-muted">Vehicle: On Foot</p>
                )}
                {selectedMarker.player.licensePlate && (
                  <p className="text-cad-muted">Plate: {selectedMarker.player.licensePlate}</p>
                )}
                {selectedMarker.player.weapon && (
                  <p className="text-cad-muted">Weapon: {selectedMarker.player.weapon}</p>
                )}
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
            <p>Data source: <span className="font-mono">cad_bridge heartbeat</span></p>
            <p>Refresh interval: {MAP_POLL_INTERVAL_MS}ms</p>
            <p>Max age window: {Math.round(MAP_ACTIVE_MAX_AGE_MS / 1000)}s</p>
            <p>
              Mapping profile: X1 {SNAILY_GAME_BOUNDS.x1}, Y1 {SNAILY_GAME_BOUNDS.y1}, X2 {SNAILY_GAME_BOUNDS.x2}, Y2 {SNAILY_GAME_BOUNDS.y2}
            </p>
            <p>
              Calibration: ScaleX {mapScaleX}, ScaleY {mapScaleY}, OffsetX {mapOffsetX}, OffsetY {mapOffsetY}
            </p>
            {error && <p className="text-red-400 whitespace-pre-wrap">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
