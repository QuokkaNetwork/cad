import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../../api/client';
import { useDepartment } from '../../context/DepartmentContext';

const DEFAULT_MAP_IMAGE_URL = '/maps/FullMap.png';
const MAP_WIDTH = 2048;
const MAP_HEIGHT = 3072;
const MAP_POLL_INTERVAL_MS = 1500;
const MAP_ACTIVE_MAX_AGE_MS = 30_000;
const MAP_MIN_WIDTH = MAP_WIDTH * 0.2;
const MAP_MAX_WIDTH = MAP_WIDTH * 3.5;

const SNAILY_GAME_BOUNDS = {
  x1: -4230,
  y1: 8420,
  x2: 370,
  y2: -640,
};

function createInitialViewBox() {
  return {
    x: 0,
    y: 0,
    width: 1024,
    height: 2048,
  };
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

function convertToMapPoint(rawX, rawY) {
  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const xRange = SNAILY_GAME_BOUNDS.x2 - SNAILY_GAME_BOUNDS.x1;
  const yRange = SNAILY_GAME_BOUNDS.y2 - SNAILY_GAME_BOUNDS.y1;
  if (!xRange || !yRange) return null;

  // Match SnailyCAD's calibration constants against a static map surface.
  const px = ((x - SNAILY_GAME_BOUNDS.x1) * 1024) / xRange;
  const py = ((y - SNAILY_GAME_BOUNDS.y1) * 2048) / yRange;
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
  const { activeDepartment } = useDepartment();
  const deptId = Number(activeDepartment?.id || 0);
  const isDispatchDepartment = !!activeDepartment?.is_dispatch;
  const [viewBox, setViewBox] = useState(createInitialViewBox);
  const [players, setPlayers] = useState([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshAt, setLastRefreshAt] = useState(0);

  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const fetchPlayers = useCallback(async () => {
    if (!deptId) {
      setPlayers([]);
      setError('No active department selected.');
      setLoading(false);
      return;
    }

    try {
      const dispatchQuery = isDispatchDepartment ? 'true' : 'false';
      const data = await api.get(
        `/api/units/live-map/players?department_id=${deptId}&dispatch=${dispatchQuery}&max_age_ms=${MAP_ACTIVE_MAX_AGE_MS}`
      );
      const nextPlayers = normalizePlayers(data?.payload || []);
      setPlayers(nextPlayers);
      setError('');
      setLastRefreshAt(Date.now());
    } catch (err) {
      setError(err?.message || 'Failed to load live map players');
    } finally {
      setLoading(false);
    }
  }, [deptId, isDispatchDepartment]);

  useEffect(() => {
    setLoading(true);
    fetchPlayers();
  }, [fetchPlayers, locationKey]);

  useEffect(() => {
    const id = setInterval(fetchPlayers, MAP_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchPlayers]);

  const markers = useMemo(() => {
    return players
      .map((player) => {
        const point = convertToMapPoint(player.pos.x, player.pos.y);
        if (!point) return null;
        return { player, point };
      })
      .filter(Boolean);
  }, [players]);

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

  const clampViewBox = useCallback((next) => {
    const width = Math.min(MAP_MAX_WIDTH, Math.max(MAP_MIN_WIDTH, next.width));
    const height = width * (MAP_HEIGHT / MAP_WIDTH);
    const maxX = Math.max(0, MAP_WIDTH - width);
    const maxY = Math.max(0, MAP_HEIGHT - height);
    return {
      x: Math.max(0, Math.min(maxX, next.x)),
      y: Math.max(0, Math.min(maxY, next.y)),
      width,
      height,
    };
  }, []);

  const screenToMap = useCallback((clientX, clientY, currentViewBox = viewBox) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return {
      x: currentViewBox.x + (px * currentViewBox.width),
      y: currentViewBox.y + (py * currentViewBox.height),
    };
  }, [viewBox]);

  const zoomAt = useCallback((factor, clientX, clientY) => {
    setViewBox((current) => {
      const pivot = screenToMap(clientX, clientY, current);
      if (!pivot) return current;
      const width = current.width * factor;
      const height = current.height * factor;
      const next = {
        x: pivot.x - ((pivot.x - current.x) * (width / current.width)),
        y: pivot.y - ((pivot.y - current.y) * (height / current.height)),
        width,
        height,
      };
      return clampViewBox(next);
    });
  }, [clampViewBox, screenToMap]);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 0.88 : 1.14;
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
            Snaily-style fixed mapping from resource heartbeat data (no manual calibration).
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
            onClick={fetchPlayers}
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
                href={DEFAULT_MAP_IMAGE_URL}
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
            <p>Data source: <span className="font-mono">/api/units/live-map/players</span></p>
            <p>Refresh interval: {MAP_POLL_INTERVAL_MS}ms</p>
            <p>Max age window: {Math.round(MAP_ACTIVE_MAX_AGE_MS / 1000)}s</p>
            <p>
              Mapping profile: X1 {SNAILY_GAME_BOUNDS.x1}, Y1 {SNAILY_GAME_BOUNDS.y1}, X2 {SNAILY_GAME_BOUNDS.x2}, Y2 {SNAILY_GAME_BOUNDS.y2}
            </p>
            {error && <p className="text-red-400 whitespace-pre-wrap">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
