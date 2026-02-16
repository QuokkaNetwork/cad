import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';
import { api } from '../../api/client';

const WORLD_BOUNDS = {
  minX: Number(import.meta.env.VITE_CAD_MAP_MIN_X ?? -4000),
  maxX: Number(import.meta.env.VITE_CAD_MAP_MAX_X ?? 4500),
  minY: Number(import.meta.env.VITE_CAD_MAP_MIN_Y ?? -4500),
  maxY: Number(import.meta.env.VITE_CAD_MAP_MAX_Y ?? 8000),
};

const WORLD_WIDTH = WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX;
const WORLD_HEIGHT = WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY;
const DEFAULT_MAP_BACKGROUND_URL = '/maps/FullMap.png';
const MAP_BACKGROUND_ENV_URL = String(import.meta.env.VITE_CAD_MAP_IMAGE || '').trim();
const INITIAL_MAP_BACKGROUND_URL = MAP_BACKGROUND_ENV_URL || DEFAULT_MAP_BACKGROUND_URL;

const LIVE_MAP_SOCKET_ENV_URL = String(import.meta.env.VITE_LIVEMAP_SOCKET_URL || '').trim();
const LIVE_MAP_SOCKET_PORT = Number(import.meta.env.VITE_LIVEMAP_SOCKET_PORT ?? 30121);
const LIVE_MAP_STALE_MS = Math.max(5000, Number(import.meta.env.VITE_LIVEMAP_STALE_MS ?? 15000) || 15000);

const DEFAULT_MAP_TRANSFORM = {
  scaleX: 1,
  scaleY: 1,
  offsetX: 0,
  offsetY: 0,
};

const STATUS_COLORS = {
  available: '#22c55e',
  busy: '#f59e0b',
  enroute: '#3b82f6',
  'on-scene': '#a855f7',
};

function createInitialViewBox() {
  return {
    x: WORLD_BOUNDS.minX,
    y: -WORLD_BOUNDS.maxY,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  };
}

function normalizeIdentityToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function formatSpeedMph(value) {
  const speed = Number(value || 0);
  if (!Number.isFinite(speed) || speed <= 0) return '0 mph';
  return `${Math.round(speed * 2.23694)} mph`;
}

function formatStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return 'LiveMap';
  if (raw === 'on-scene') return 'On Scene';
  if (raw === 'enroute') return 'En Route';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function parseMapNumber(value, fallback) {
  const text = String(value ?? '').trim();
  if (!text) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function isDispatchUnit(unit) {
  const callsign = String(unit?.callsign || '').trim().toUpperCase();
  if (callsign === 'DISPATCH') return true;
  if (unit?.is_dispatch) return true;
  const short = String(unit?.department_short_name || '').trim().toUpperCase();
  return short === 'DISPATCH';
}

function parseLiveMapIdentifier(entry) {
  return String(
    entry?.identifier
    || entry?.identifer
    || entry?.steam_id
    || entry?.steam
    || ''
  ).trim();
}

function parseLiveMapPosition(entry) {
  const x = Number(entry?.pos?.x);
  const y = Number(entry?.pos?.y);
  const z = Number(entry?.pos?.z);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return {
    x,
    y,
    z: Number.isFinite(z) ? z : 0,
  };
}

function toSocketUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('http://')) return `ws://${text.slice('http://'.length)}`;
  if (text.startsWith('https://')) return `wss://${text.slice('https://'.length)}`;
  return text;
}

function buildFallbackSocketUrl() {
  const envUrl = toSocketUrl(LIVE_MAP_SOCKET_ENV_URL);
  if (envUrl) return envUrl;
  if (typeof window === 'undefined') return '';

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || '127.0.0.1';
  const port = Number.isFinite(LIVE_MAP_SOCKET_PORT) && LIVE_MAP_SOCKET_PORT > 0
    ? LIVE_MAP_SOCKET_PORT
    : 30121;
  return `${protocol}//${host}:${port}`;
}

function formatSocketState(state) {
  if (state === 'connected') return 'Connected';
  if (state === 'connecting') return 'Connecting';
  if (state === 'error') return 'Error';
  if (state === 'missing') return 'Not Configured';
  return 'Disconnected';
}

export default function LiveMap() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;

  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [showStale, setShowStale] = useState(true);
  const [selectedMarkerId, setSelectedMarkerId] = useState(null);

  const [viewBox, setViewBox] = useState(createInitialViewBox);
  const [mapBackgroundUrl, setMapBackgroundUrl] = useState(INITIAL_MAP_BACKGROUND_URL);
  const [mapTransform, setMapTransform] = useState(DEFAULT_MAP_TRANSFORM);
  const [socketUrl, setSocketUrl] = useState(buildFallbackSocketUrl);

  const [socketState, setSocketState] = useState('idle');
  const [socketError, setSocketError] = useState('');
  const [lastSocketMessageAt, setLastSocketMessageAt] = useState(0);
  const [livePlayersById, setLivePlayersById] = useState({});

  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const fetchUnits = useCallback(async () => {
    if (!deptId) return;
    setLoadingUnits(true);
    try {
      let incoming = [];
      if (isDispatch) {
        const payload = await api.get('/api/units/dispatchable');
        incoming = Array.isArray(payload?.units) ? payload.units : [];
      } else {
        const payload = await api.get(`/api/units?department_id=${deptId}`);
        incoming = Array.isArray(payload) ? payload : [];
      }
      setUnits(incoming.filter(unit => !isDispatchUnit(unit)));
    } catch (err) {
      console.error('Failed to load unit metadata for live map:', err);
    } finally {
      setLoadingUnits(false);
    }
  }, [deptId, isDispatch]);

  const fetchMapConfig = useCallback(async () => {
    try {
      const config = await api.get('/api/units/map-config');
      const configuredImage = String(config?.map_image_url || '').trim();
      const configuredSocket = toSocketUrl(config?.live_map_socket_url);
      setMapBackgroundUrl(configuredImage || INITIAL_MAP_BACKGROUND_URL);
      setMapTransform({
        scaleX: parseMapNumber(config?.map_scale_x, DEFAULT_MAP_TRANSFORM.scaleX),
        scaleY: parseMapNumber(config?.map_scale_y, DEFAULT_MAP_TRANSFORM.scaleY),
        offsetX: parseMapNumber(config?.map_offset_x, DEFAULT_MAP_TRANSFORM.offsetX),
        offsetY: parseMapNumber(config?.map_offset_y, DEFAULT_MAP_TRANSFORM.offsetY),
      });
      setSocketUrl(configuredSocket || buildFallbackSocketUrl());
    } catch {
      setMapBackgroundUrl(INITIAL_MAP_BACKGROUND_URL);
      setMapTransform(DEFAULT_MAP_TRANSFORM);
      setSocketUrl(buildFallbackSocketUrl());
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchUnits();
    fetchMapConfig();
  }, [fetchUnits, fetchMapConfig]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll, locationKey]);

  useEventSource({
    'unit:online': () => fetchUnits(),
    'unit:offline': () => fetchUnits(),
    'unit:update': () => fetchUnits(),
    'sync:department': () => fetchUnits(),
  });

  useEffect(() => {
    const id = setInterval(fetchUnits, 7000);
    return () => clearInterval(id);
  }, [fetchUnits]);

  useEffect(() => {
    const id = setInterval(fetchMapConfig, 30000);
    return () => clearInterval(id);
  }, [fetchMapConfig]);

  useEffect(() => {
    const targetSocketUrl = toSocketUrl(socketUrl);
    if (!targetSocketUrl) {
      setSocketState('missing');
      setSocketError('Configure live_map websocket URL in Admin > System Settings.');
      return undefined;
    }

    let closed = false;
    let socket = null;
    let reconnectTimer = null;

    const connect = () => {
      if (closed) return;
      setSocketState('connecting');
      setSocketError('');

      try {
        socket = new WebSocket(targetSocketUrl);
      } catch (err) {
        setSocketState('error');
        setSocketError(err?.message || 'Unable to open websocket');
        reconnectTimer = setTimeout(connect, 3000);
        return;
      }

      socket.onopen = () => {
        if (closed) return;
        setSocketState('connected');
        setSocketError('');
      };

      socket.onmessage = (event) => {
        if (closed) return;
        let message = null;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (!message || typeof message !== 'object') return;

        if (message.type === 'playerData') {
          const payload = Array.isArray(message.payload) ? message.payload : [];
          const now = Date.now();
          const next = {};
          for (const row of payload) {
            const identifier = parseLiveMapIdentifier(row);
            if (!identifier) continue;
            next[identifier] = {
              identifier,
              row,
              updatedAtMs: now,
            };
          }
          setLivePlayersById(next);
          setLastSocketMessageAt(now);
          return;
        }

        if (message.type === 'playerLeft') {
          const identifier = String(message.payload || '').trim();
          if (!identifier) return;
          setLivePlayersById((prev) => {
            if (!prev[identifier]) return prev;
            const next = { ...prev };
            delete next[identifier];
            return next;
          });
        }
      };

      socket.onerror = () => {
        if (closed) return;
        setSocketState('error');
        setSocketError('Unable to read live_map websocket stream.');
      };

      socket.onclose = () => {
        if (closed) return;
        setSocketState('disconnected');
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) {
        socket.close();
      }
    };
  }, [socketUrl]);

  const livePlayers = useMemo(() => Object.values(livePlayersById), [livePlayersById]);

  const markerSnapshot = useMemo(() => {
    const nameBuckets = new Map();
    for (const unit of units) {
      const key = normalizeIdentityToken(unit.user_name);
      if (!key) continue;
      const bucket = nameBuckets.get(key) || [];
      bucket.push(unit);
      nameBuckets.set(key, bucket);
    }

    const now = Date.now();
    const matchedUnitIds = new Set();
    const markers = [];
    let unmatchedLivePlayers = 0;

    for (const livePlayer of livePlayers) {
      const pos = parseLiveMapPosition(livePlayer.row);
      if (!pos) continue;

      const nameKey = normalizeIdentityToken(livePlayer.row?.name);
      let matchedUnit = null;
      if (nameKey) {
        const candidates = nameBuckets.get(nameKey) || [];
        matchedUnit = candidates.find(unit => !matchedUnitIds.has(unit.id)) || null;
      }
      if (!matchedUnit) {
        unmatchedLivePlayers += 1;
        continue;
      }
      matchedUnitIds.add(matchedUnit.id);

      const status = String(matchedUnit.status || '').trim().toLowerCase();
      markers.push({
        id: livePlayer.identifier,
        identifier: livePlayer.identifier,
        unit: matchedUnit,
        label: matchedUnit.callsign || String(livePlayer.row?.name || '').trim() || livePlayer.identifier,
        displayName: matchedUnit.user_name || String(livePlayer.row?.name || '').trim() || 'Unknown',
        status,
        location: String(livePlayer.row?.Location || livePlayer.row?.location || '').trim(),
        speed: Number(livePlayer.row?.speed ?? livePlayer.row?.Speed ?? 0),
        position_x: pos.x,
        position_y: pos.y,
        position_z: pos.z,
        stale: (now - Number(livePlayer.updatedAtMs || 0)) > LIVE_MAP_STALE_MS,
        updatedAtMs: Number(livePlayer.updatedAtMs || 0),
      });
    }

    const unitsWithoutPosition = units.filter(unit => !matchedUnitIds.has(unit.id));
    return {
      markers,
      unitsWithoutPosition,
      unmatchedLivePlayers,
      matchedUnits: units.length - unitsWithoutPosition.length,
    };
  }, [livePlayers, units]);

  const allMarkers = markerSnapshot.markers;
  const visibleMarkers = useMemo(
    () => allMarkers.filter(marker => (showStale ? true : !marker.stale)),
    [allMarkers, showStale]
  );

  const selectedMarker = useMemo(
    () => allMarkers.find(marker => marker.id === selectedMarkerId) || visibleMarkers[0] || null,
    [allMarkers, visibleMarkers, selectedMarkerId]
  );

  useEffect(() => {
    if (!selectedMarkerId) return;
    if (!allMarkers.find(marker => marker.id === selectedMarkerId)) {
      setSelectedMarkerId(null);
    }
  }, [selectedMarkerId, allMarkers]);

  const clampViewBox = useCallback((next) => {
    const minWidth = WORLD_WIDTH * 0.12;
    const maxWidth = WORLD_WIDTH * 4;
    const width = Math.min(maxWidth, Math.max(minWidth, next.width));
    const height = width * (WORLD_HEIGHT / WORLD_WIDTH);

    const extraX = Math.max(0, width - WORLD_WIDTH) * 0.5;
    const extraY = Math.max(0, height - WORLD_HEIGHT) * 0.5;
    const minX = WORLD_BOUNDS.minX - extraX;
    const maxX = WORLD_BOUNDS.maxX - width + extraX;
    const worldMinY = -WORLD_BOUNDS.maxY;
    const worldMaxY = -WORLD_BOUNDS.minY;
    const minY = worldMinY - extraY;
    const maxY = worldMaxY - height + extraY;

    return {
      x: Math.min(maxX, Math.max(minX, next.x)),
      y: Math.min(maxY, Math.max(minY, next.y)),
      width,
      height,
    };
  }, []);

  const screenToWorld = useCallback((clientX, clientY, targetViewBox = viewBox) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    return {
      x: targetViewBox.x + (px * targetViewBox.width),
      y: targetViewBox.y + (py * targetViewBox.height),
    };
  }, [viewBox]);

  const zoomAt = useCallback((factor, clientX, clientY) => {
    setViewBox((current) => {
      const pivot = screenToWorld(clientX, clientY, current);
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
  }, [clampViewBox, screenToWorld]);

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

  const translateToMapPoint = useCallback((rawX, rawY) => {
    const unitX = Number(rawX);
    const unitY = Number(rawY);
    if (!Number.isFinite(unitX) || !Number.isFinite(unitY)) return null;
    return {
      x: (unitX * mapTransform.scaleX) + mapTransform.offsetX,
      y: ((-unitY) * mapTransform.scaleY) + mapTransform.offsetY,
    };
  }, [mapTransform]);

  const markerRadius = viewBox.width * 0.006;
  const labelSize = markerRadius * 2.2;
  const socketStatus = formatSocketState(socketState);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Unit Map</h2>
          <p className="text-sm text-cad-muted">
            Position stream from <span className="font-mono">live_map-3.2.1</span> websocket data.
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
            onClick={() => setShowStale(v => !v)}
            className={`px-3 py-1.5 text-xs border rounded transition-colors ${
              showStale
                ? 'bg-cad-accent/20 text-cad-accent-light border-cad-accent/40'
                : 'bg-cad-surface text-cad-muted border-cad-border hover:text-cad-ink'
            }`}
          >
            {showStale ? 'Hide Stale' : 'Show Stale'}
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
            <span>
              {visibleMarkers.length} visible marker{visibleMarkers.length !== 1 ? 's' : ''} / {allMarkers.length} matched unit marker{allMarkers.length !== 1 ? 's' : ''}
            </span>
            <span>
              Socket: {socketStatus} | CAD Units: {loadingUnits ? 'Updating...' : `${markerSnapshot.matchedUnits}/${units.length} matched`}
            </span>
          </div>
          <div className="relative h-[68vh] min-h-[480px] bg-[#0b1525]">
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
              <defs>
                <pattern id="map-grid" width="500" height="500" patternUnits="userSpaceOnUse">
                  <path d="M 500 0 L 0 0 0 500" fill="none" stroke="#163352" strokeWidth="14" />
                </pattern>
              </defs>

              <rect
                x={WORLD_BOUNDS.minX}
                y={-WORLD_BOUNDS.maxY}
                width={WORLD_WIDTH}
                height={WORLD_HEIGHT}
                fill="#09111d"
              />

              {mapBackgroundUrl && (
                <image
                  href={mapBackgroundUrl}
                  x={WORLD_BOUNDS.minX}
                  y={-WORLD_BOUNDS.maxY}
                  width={WORLD_WIDTH}
                  height={WORLD_HEIGHT}
                  preserveAspectRatio="none"
                  opacity="0.9"
                />
              )}

              <rect
                x={WORLD_BOUNDS.minX}
                y={-WORLD_BOUNDS.maxY}
                width={WORLD_WIDTH}
                height={WORLD_HEIGHT}
                fill="url(#map-grid)"
                opacity="0.45"
              />

              {visibleMarkers.map((marker) => {
                const mapPoint = translateToMapPoint(marker.position_x, marker.position_y);
                if (!mapPoint) return null;

                const selected = marker.id === selectedMarker?.id;
                const stale = !!marker.stale;
                const color = STATUS_COLORS[marker.status] || '#94a3b8';

                return (
                  <g
                    key={marker.id}
                    transform={`translate(${mapPoint.x} ${mapPoint.y})`}
                    onClick={() => setSelectedMarkerId(marker.id)}
                    style={{ cursor: 'pointer' }}
                    opacity={stale ? 0.5 : 1}
                  >
                    <circle
                      r={selected ? markerRadius * 1.35 : markerRadius}
                      fill={color}
                      stroke={selected ? '#ffffff' : '#0b1320'}
                      strokeWidth={selected ? markerRadius * 0.23 : markerRadius * 0.18}
                    />
                    <text
                      x={markerRadius * 1.3}
                      y={-markerRadius * 1.1}
                      fill="#e2e8f0"
                      fontSize={labelSize}
                      fontWeight="700"
                    >
                      {marker.label}
                    </text>
                    <text
                      x={markerRadius * 1.3}
                      y={markerRadius * 1.35}
                      fill="#94a3b8"
                      fontSize={Math.max(50, labelSize * 0.72)}
                    >
                      {formatStatus(marker.status)}
                    </text>
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
                <p className="font-mono text-cad-accent-light">{selectedMarker.label}</p>
                <p className="text-cad-muted">{selectedMarker.displayName}</p>
                <p>
                  <span className="text-cad-muted">Status:</span>{' '}
                  <span style={{ color: STATUS_COLORS[selectedMarker.status] || '#94a3b8' }}>
                    {formatStatus(selectedMarker.status)}
                  </span>
                </p>
                <p className="text-cad-muted">Speed: {formatSpeedMph(selectedMarker.speed)}</p>
                <p className="text-cad-muted">
                  X {Number(selectedMarker.position_x || 0).toFixed(1)} | Y {Number(selectedMarker.position_y || 0).toFixed(1)}
                </p>
                {selectedMarker.location && (
                  <p className="text-cad-muted break-words">Location: {selectedMarker.location}</p>
                )}
                <p className="text-xs text-cad-muted break-all">Identifier: {selectedMarker.identifier}</p>
                {selectedMarker.updatedAtMs > 0 && (
                  <p className="text-xs text-cad-muted">
                    Last update: {new Date(selectedMarker.updatedAtMs).toLocaleTimeString()}
                  </p>
                )}
                {selectedMarker.stale && (
                  <p className="text-xs text-amber-300">
                    Location is stale (older than {Math.round(LIVE_MAP_STALE_MS / 1000)} seconds).
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-cad-muted">
                {markerSnapshot.unmatchedLivePlayers > 0
                  ? `No on-duty unit matches yet (${markerSnapshot.unmatchedLivePlayers} unmatched live_map player${markerSnapshot.unmatchedLivePlayers !== 1 ? 's' : ''}).`
                  : 'No live markers received from live_map yet.'}
              </p>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">CAD Units Missing Live Position</h3>
            {markerSnapshot.unitsWithoutPosition.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {markerSnapshot.unitsWithoutPosition.map(unit => (
                  <div key={unit.id} className="text-xs bg-cad-surface border border-cad-border rounded px-2 py-1">
                    <p className="font-mono text-cad-accent-light">{unit.callsign}</p>
                    <p className="text-cad-muted truncate">{unit.user_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-cad-muted">All on-duty CAD units are currently matched to live_map data.</p>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-3 text-xs text-cad-muted space-y-1">
            <p>
              Data source: <span className="font-mono">live_map-3.2.1</span> websocket stream.
            </p>
            <p className="break-all">
              Socket URL: <span className="font-mono">{socketUrl || 'Not configured'}</span>
            </p>
            <p>
              Socket status: <span className={socketState === 'connected' ? 'text-emerald-400' : 'text-amber-300'}>{socketStatus}</span>
              {lastSocketMessageAt > 0 ? ` (last packet ${new Date(lastSocketMessageAt).toLocaleTimeString()})` : ''}
            </p>
            <p>
              Unmatched live_map players: {markerSnapshot.unmatchedLivePlayers}
            </p>
            <p>
              Calibration: X = (gameX * {mapTransform.scaleX}) + {mapTransform.offsetX}, Y = ((-gameY) * {mapTransform.scaleY}) + {mapTransform.offsetY}
            </p>
            {socketError && (
              <p className="text-red-400 whitespace-pre-wrap">{socketError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
