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
const MAP_BACKGROUND_URL = import.meta.env.VITE_CAD_MAP_IMAGE || '';

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

function formatSpeedMph(value) {
  const speed = Number(value || 0);
  if (!Number.isFinite(speed) || speed <= 0) return '0 mph';
  return `${Math.round(speed * 2.23694)} mph`;
}

function formatStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  if (!raw) return 'Unknown';
  if (raw === 'on-scene') return 'On Scene';
  if (raw === 'enroute') return 'En Route';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function getMarkerColor(unit) {
  return STATUS_COLORS[unit.status] || '#94a3b8';
}

export default function LiveMap() {
  const { activeDepartment } = useDepartment();
  const { key: locationKey } = useLocation();
  const deptId = activeDepartment?.id;
  const isDispatch = !!activeDepartment?.is_dispatch;

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showStale, setShowStale] = useState(true);
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [viewBox, setViewBox] = useState(createInitialViewBox);

  const svgRef = useRef(null);
  const dragRef = useRef(null);

  const fetchData = useCallback(async () => {
    if (!deptId) return;
    setLoading(true);
    try {
      const query = isDispatch ? '&dispatch=true' : '';
      const data = await api.get(`/api/units/map?department_id=${deptId}${query}`);
      setUnits(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load live map units:', err);
    } finally {
      setLoading(false);
    }
  }, [deptId, isDispatch]);

  useEffect(() => {
    fetchData();
  }, [fetchData, locationKey]);

  useEventSource({
    'unit:online': () => fetchData(),
    'unit:offline': () => fetchData(),
    'unit:update': () => fetchData(),
    'sync:department': () => fetchData(),
  });

  useEffect(() => {
    const id = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    if (!selectedUnitId) return;
    if (!units.find(u => u.id === selectedUnitId)) {
      setSelectedUnitId(null);
    }
  }, [selectedUnitId, units]);

  const clampViewBox = useCallback((next) => {
    const minWidth = WORLD_WIDTH * 0.12;
    const maxWidth = WORLD_WIDTH * 4;
    const width = Math.min(maxWidth, Math.max(minWidth, next.width));
    const height = width * (WORLD_HEIGHT / WORLD_WIDTH);

    const minX = WORLD_BOUNDS.minX - ((width - WORLD_WIDTH) * 0.5);
    const maxX = WORLD_BOUNDS.maxX - width + ((width - WORLD_WIDTH) * 0.5);
    const minY = -WORLD_BOUNDS.maxY - ((height - WORLD_HEIGHT) * 0.5);
    const maxY = -WORLD_BOUNDS.minY - height + ((height - WORLD_HEIGHT) * 0.5);

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

  const visibleUnits = useMemo(() => {
    return units.filter((unit) => {
      if (!showStale && unit.position_stale) return false;
      const x = Number(unit.position_x);
      const y = Number(unit.position_y);
      return Number.isFinite(x) && Number.isFinite(y);
    });
  }, [units, showStale]);

  const unitsWithoutPosition = useMemo(() => {
    return units.filter((unit) => {
      const x = Number(unit.position_x);
      const y = Number(unit.position_y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
      return unit.position_stale;
    });
  }, [units]);

  const selectedUnit = useMemo(
    () => units.find(u => u.id === selectedUnitId) || visibleUnits[0] || null,
    [units, visibleUnits, selectedUnitId]
  );

  const markerRadius = Math.max(24, viewBox.width * 0.0042);
  const labelSize = Math.max(58, markerRadius * 2.1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Live Unit Map</h2>
          <p className="text-sm text-cad-muted">
            Real-time unit positions from FiveM bridge heartbeat data.
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
            onClick={fetchData}
            className="px-3 py-1.5 text-xs bg-cad-surface border border-cad-border rounded hover:bg-cad-card transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
        <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-cad-border flex items-center justify-between text-xs text-cad-muted">
            <span>{visibleUnits.length} tracked unit{visibleUnits.length !== 1 ? 's' : ''}</span>
            <span>{loading ? 'Updating...' : 'Live'}</span>
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

              {MAP_BACKGROUND_URL && (
                <image
                  href={MAP_BACKGROUND_URL}
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

              {visibleUnits.map((unit) => {
                const x = Number(unit.position_x);
                const y = Number(unit.position_y);
                const mapY = -y;
                const selected = unit.id === selectedUnit?.id;
                const stale = !!unit.position_stale;
                return (
                  <g
                    key={unit.id}
                    transform={`translate(${x} ${mapY})`}
                    onClick={() => setSelectedUnitId(unit.id)}
                    style={{ cursor: 'pointer' }}
                    opacity={stale ? 0.5 : 1}
                  >
                    <circle
                      r={selected ? markerRadius * 1.35 : markerRadius}
                      fill={getMarkerColor(unit)}
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
                      {unit.callsign}
                    </text>
                    <text
                      x={markerRadius * 1.3}
                      y={markerRadius * 1.35}
                      fill="#94a3b8"
                      fontSize={Math.max(50, labelSize * 0.72)}
                    >
                      {formatStatus(unit.status)}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="absolute left-3 bottom-3 bg-cad-surface/90 border border-cad-border rounded px-2 py-1 text-[11px] text-cad-muted">
              Drag to pan | Mouse wheel to zoom
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="bg-cad-card border border-cad-border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">Selected Unit</h3>
            {selectedUnit ? (
              <div className="space-y-1 text-sm">
                <p className="font-mono text-cad-accent-light">{selectedUnit.callsign}</p>
                <p className="text-cad-muted">{selectedUnit.user_name}</p>
                <p>
                  <span className="text-cad-muted">Status:</span>{' '}
                  <span style={{ color: getMarkerColor(selectedUnit) }}>{formatStatus(selectedUnit.status)}</span>
                </p>
                <p className="text-cad-muted">Speed: {formatSpeedMph(selectedUnit.position_speed)}</p>
                <p className="text-cad-muted">
                  X {Number(selectedUnit.position_x || 0).toFixed(1)} | Y {Number(selectedUnit.position_y || 0).toFixed(1)}
                </p>
                {selectedUnit.position_updated_at && (
                  <p className="text-xs text-cad-muted">Last update: {selectedUnit.position_updated_at} UTC</p>
                )}
                {selectedUnit.position_stale && (
                  <p className="text-xs text-amber-300">Location is stale (older than 5 minutes).</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-cad-muted">No live unit positions yet.</p>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-3">
            <h3 className="text-sm font-semibold text-cad-muted uppercase tracking-wider mb-2">No Live Position</h3>
            {unitsWithoutPosition.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {unitsWithoutPosition.map(unit => (
                  <div key={unit.id} className="text-xs bg-cad-surface border border-cad-border rounded px-2 py-1">
                    <p className="font-mono text-cad-accent-light">{unit.callsign}</p>
                    <p className="text-cad-muted truncate">{unit.user_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-cad-muted">All tracked units currently have live positions.</p>
            )}
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg p-3 text-xs text-cad-muted">
            <p>
              If you want your own map artwork, convert GTA `.ydd` assets into a single web image
              (`.png`/`.webp`) and set `VITE_CAD_MAP_IMAGE` in your web environment.
            </p>
            <p className="mt-1">
              Optional calibration vars: `VITE_CAD_MAP_MIN_X`, `VITE_CAD_MAP_MAX_X`, `VITE_CAD_MAP_MIN_Y`, `VITE_CAD_MAP_MAX_Y`.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
