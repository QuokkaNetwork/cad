import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { useDepartment } from '../../context/DepartmentContext';
import { useEventSource } from '../../hooks/useEventSource';

const WORLD_BOUNDS = {
  minX: -4200,
  maxX: 4300,
  minY: -4200,
  maxY: 8600,
};
const MAP_CANVAS_SIZE = 1000;
const MAP_IMAGE_SRC = '/maps/FullMap.png';

function parseNum(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toMapPoint(x, y, size = MAP_CANVAS_SIZE) {
  const px = ((x - WORLD_BOUNDS.minX) / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX)) * size;
  const py = size - (((y - WORLD_BOUNDS.minY) / (WORLD_BOUNDS.maxY - WORLD_BOUNDS.minY)) * size);
  return {
    x: Math.max(0, Math.min(size, px)),
    y: Math.max(0, Math.min(size, py)),
  };
}

function headingLineFromMapPoint(point, heading, length = 18) {
  const h = Number(heading);
  if (!point || !Number.isFinite(h)) return null;
  // GTA heading 0 is north; convert into SVG x/y vector.
  const radians = ((h - 90) * Math.PI) / 180;
  return {
    x1: point.x,
    y1: point.y,
    x2: point.x + (Math.cos(radians) * length),
    y2: point.y + (Math.sin(radians) * length),
  };
}

function statusColor(status) {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'available') return '#22c55e';
  if (key === 'enroute' || key === 'en_route') return '#38bdf8';
  if (key === 'on-scene' || key === 'on_scene') return '#f97316';
  if (key === 'busy') return '#f59e0b';
  return '#94a3b8';
}

function priorityColor(priority) {
  const p = String(priority || '').trim();
  if (p === '1') return '#fb7185';
  if (p === '2') return '#f59e0b';
  if (p === '3') return '#60a5fa';
  return '#94a3b8';
}

function labelize(value) {
  return String(value || '').trim().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '-';
}

function formatRelativeAge(value) {
  if (!value) return '-';
  const ms = Date.parse(String(value).includes('T') ? value : `${String(value).replace(' ', 'T')}Z`);
  if (Number.isNaN(ms)) return '-';
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  return `${mins}m ago`;
}

function distanceMetres(a, b) {
  if (!a || !b) return null;
  const dx = Number(a.x) - Number(b.x);
  const dy = Number(a.y) - Number(b.y);
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  return Math.sqrt((dx * dx) + (dy * dy));
}

function shapeIsPolygon(zone) {
  return String(zone?.shape || '').trim().toLowerCase() === 'polygon';
}

function zoneMatchesDepartment(zone, departmentFilter) {
  if (departmentFilter === 'all') return true;
  const target = Number(departmentFilter || 0);
  if (!target) return true;
  const primary = Number(zone?.department_id || 0);
  const backup = Number(zone?.backup_department_id || 0);
  if (!primary && !backup) return true;
  return primary === target || backup === target;
}

function ZoneOverlay({ zone, size = 1000 }) {
  if (!zone) return null;
  if (shapeIsPolygon(zone)) {
    const points = Array.isArray(zone.points) ? zone.points : [];
    const mapped = points
      .map((p) => ({ x: parseNum(p?.x), y: parseNum(p?.y) }))
      .filter((p) => p.x !== null && p.y !== null)
      .map((p) => toMapPoint(p.x, p.y, size));
    if (mapped.length < 3) return null;
    const d = mapped.map((p) => `${p.x},${p.y}`).join(' ');
    return <polygon points={d} fill="rgba(251, 191, 36, 0.08)" stroke="rgba(251, 191, 36, 0.45)" strokeWidth="2" />;
  }
  const x = parseNum(zone.x);
  const y = parseNum(zone.y);
  const radius = parseNum(zone.radius);
  if (x === null || y === null || radius === null || radius <= 0) return null;
  const center = toMapPoint(x, y, size);
  const sx = size / (WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX);
  const r = Math.max(2, radius * sx);
  return <circle cx={center.x} cy={center.y} r={r} fill="rgba(251, 191, 36, 0.08)" stroke="rgba(251, 191, 36, 0.45)" strokeWidth="2" />;
}

export default function DispatchMap() {
  const { activeDepartment } = useDepartment();
  const departmentId = Number(activeDepartment?.id || 0) || null;
  const isDispatch = !!activeDepartment?.is_dispatch;

  const [units, setUnits] = useState([]);
  const [calls, setCalls] = useState([]);
  const [zones, setZones] = useState([]);
  const [visibleDepartments, setVisibleDepartments] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedCallId, setSelectedCallId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastLoadedAt, setLastLoadedAt] = useState('');
  const [mapZoom, setMapZoom] = useState(1);
  const [layerVisibility, setLayerVisibility] = useState({
    basemap: true,
    grid: true,
    zones: true,
    pursuits: true,
    recommendations: true,
    labels: true,
  });

  const loadMapData = useCallback(async () => {
    if (!departmentId) return;
    setLoading(true);
    setError('');
    try {
      if (isDispatch) {
        const [callsData, unitsData, dispatchableData, alarmData] = await Promise.all([
          api.get(`/api/calls?department_id=${departmentId}&dispatch=true`),
          api.get(`/api/units/map?department_id=${departmentId}&dispatch=true`),
          api.get('/api/units/dispatchable').catch(() => ({ departments: [], units: [] })),
          api.get(`/api/alarm-zones?department_id=${departmentId}&dispatch=true`).catch(() => ({ zones: [] })),
        ]);
        setCalls(Array.isArray(callsData) ? callsData : []);
        setUnits(Array.isArray(unitsData) ? unitsData : []);
        setVisibleDepartments(Array.isArray(dispatchableData?.departments) ? dispatchableData.departments : []);
        setZones(Array.isArray(alarmData?.zones) ? alarmData.zones : []);
      } else {
        const [callsData, unitsData, alarmData] = await Promise.all([
          api.get(`/api/calls?department_id=${departmentId}`),
          api.get(`/api/units/map?department_id=${departmentId}`),
          api.get(`/api/alarm-zones?department_id=${departmentId}`).catch(() => ({ zones: [] })),
        ]);
        setCalls(Array.isArray(callsData) ? callsData : []);
        setUnits(Array.isArray(unitsData) ? unitsData : []);
        setVisibleDepartments(activeDepartment ? [activeDepartment] : []);
        setZones(Array.isArray(alarmData?.zones) ? alarmData.zones : []);
      }
      setLastLoadedAt(new Date().toISOString());
    } catch (err) {
      setError(err?.message || 'Failed to load AVL map');
      setUnits([]);
      setCalls([]);
      setZones([]);
    } finally {
      setLoading(false);
    }
  }, [activeDepartment, departmentId, isDispatch]);

  useEffect(() => {
    loadMapData();
  }, [loadMapData]);

  useEffect(() => {
    const id = setInterval(() => loadMapData(), 5000);
    return () => clearInterval(id);
  }, [loadMapData]);

  useEventSource({
    'call:create': () => loadMapData(),
    'call:update': () => loadMapData(),
    'call:close': () => loadMapData(),
    'call:assign': () => loadMapData(),
    'call:unassign': () => loadMapData(),
    'unit:online': () => loadMapData(),
    'unit:offline': () => loadMapData(),
    'unit:update': () => loadMapData(),
    'pursuit:update': () => loadMapData(),
  });

  useEffect(() => {
    if (!isDispatch) {
      setDepartmentFilter('all');
    }
  }, [isDispatch]);

  const departmentOptions = useMemo(() => {
    const rows = Array.isArray(visibleDepartments) ? visibleDepartments : [];
    return rows.filter(Boolean).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [visibleDepartments]);

  const filteredUnits = useMemo(() => {
    const target = Number(departmentFilter || 0);
    return (Array.isArray(units) ? units : []).filter((u) => {
      if (String(departmentFilter) === 'all' || !target) return true;
      return Number(u.department_id || 0) === target;
    });
  }, [units, departmentFilter]);

  const filteredCalls = useMemo(() => {
    const target = Number(departmentFilter || 0);
    return (Array.isArray(calls) ? calls : []).filter((c) => {
      if (String(departmentFilter) === 'all' || !target) return true;
      return Number(c.department_id || 0) === target || (Array.isArray(c.requested_department_ids) && c.requested_department_ids.includes(target));
    });
  }, [calls, departmentFilter]);

  const filteredZones = useMemo(() => {
    return (Array.isArray(zones) ? zones : []).filter((zone) => zoneMatchesDepartment(zone, departmentFilter));
  }, [zones, departmentFilter]);

  const unitMarkers = useMemo(() => {
    return filteredUnits
      .map((u) => {
        const x = parseNum(u.position_x);
        const y = parseNum(u.position_y);
        if (x === null || y === null) return null;
        return { ...u, __map: toMapPoint(x, y) };
      })
      .filter(Boolean);
  }, [filteredUnits]);

  const unitPositionById = useMemo(() => {
    const map = new Map();
    for (const unit of unitMarkers) map.set(Number(unit.id), unit.__map);
    return map;
  }, [unitMarkers]);

  const callMarkers = useMemo(() => {
    return filteredCalls
      .map((c) => {
        const x = parseNum(c.position_x);
        const y = parseNum(c.position_y);
        if (x === null || y === null) return null;
        return { ...c, __map: toMapPoint(x, y) };
      })
      .filter(Boolean);
  }, [filteredCalls]);

  const pursuitLines = useMemo(() => {
    const lines = [];
    for (const call of filteredCalls) {
      if (!call?.pursuit_mode_enabled) continue;
      const primaryId = Number(call?.pursuit_primary_unit_id || 0);
      if (!primaryId) continue;
      const primaryPos = unitPositionById.get(primaryId);
      if (!primaryPos) continue;
      const assigned = Array.isArray(call?.assigned_units) ? call.assigned_units : [];
      for (const unit of assigned) {
        const id = Number(unit?.id || 0);
        if (!id || id === primaryId) continue;
        const followerPos = unitPositionById.get(id);
        if (!followerPos) continue;
        lines.push({ callId: Number(call.id), primaryPos, followerPos });
      }
    }
    return lines;
  }, [filteredCalls, unitPositionById]);

  const selectedCall = useMemo(
    () => filteredCalls.find((c) => Number(c.id) === Number(selectedCallId)) || null,
    [filteredCalls, selectedCallId],
  );
  const selectedUnit = useMemo(
    () => filteredUnits.find((u) => Number(u.id) === Number(selectedUnitId)) || null,
    [filteredUnits, selectedUnitId],
  );

  const closestUnitRecommendations = useMemo(() => {
    if (!selectedCall) return [];
    const callPos = {
      x: parseNum(selectedCall.position_x),
      y: parseNum(selectedCall.position_y),
    };
    if (callPos.x === null || callPos.y === null) return [];
    const assignedIds = new Set(
      (Array.isArray(selectedCall.assigned_units) ? selectedCall.assigned_units : [])
        .map((u) => Number(u?.id))
        .filter((id) => Number.isInteger(id) && id > 0),
    );

    return filteredUnits
      .map((unit) => {
        const ux = parseNum(unit.position_x);
        const uy = parseNum(unit.position_y);
        if (ux === null || uy === null) return null;
        const metres = distanceMetres(callPos, { x: ux, y: uy });
        if (metres === null) return null;
        const status = String(unit.status || '').trim().toLowerCase();
        const available = status === 'available';
        return { unit, metres, available, assigned: assignedIds.has(Number(unit.id)) };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.assigned !== b.assigned) return a.assigned ? 1 : -1;
        if (a.available !== b.available) return a.available ? -1 : 1;
        return a.metres - b.metres;
      })
      .slice(0, 5);
  }, [filteredUnits, selectedCall]);

  const closestRecommendationLines = useMemo(() => {
    if (!selectedCall || closestUnitRecommendations.length === 0) return [];
    const cx = parseNum(selectedCall.position_x);
    const cy = parseNum(selectedCall.position_y);
    if (cx === null || cy === null) return [];
    const callMap = toMapPoint(cx, cy);
    return closestUnitRecommendations
      .filter((item) => item.available && !item.assigned)
      .map((item) => {
        const u = item.unit;
        const ux = parseNum(u.position_x);
        const uy = parseNum(u.position_y);
        if (ux === null || uy === null) return null;
        return {
          unitId: Number(u.id),
          callMap,
          unitMap: toMapPoint(ux, uy),
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  }, [selectedCall, closestUnitRecommendations]);

  const unmappedCallsCount = Math.max(0, filteredCalls.length - callMarkers.length);
  const selectedCallMarker = useMemo(
    () => callMarkers.find((call) => Number(call.id) === Number(selectedCallId)) || null,
    [callMarkers, selectedCallId],
  );
  const selectedUnitMarker = useMemo(
    () => unitMarkers.find((unit) => Number(unit.id) === Number(selectedUnitId)) || null,
    [unitMarkers, selectedUnitId],
  );

  useEffect(() => {
    if (selectedCallId && !filteredCalls.some((c) => Number(c.id) === Number(selectedCallId))) {
      setSelectedCallId(null);
    }
  }, [filteredCalls, selectedCallId]);

  useEffect(() => {
    if (selectedUnitId && !filteredUnits.some((u) => Number(u.id) === Number(selectedUnitId))) {
      setSelectedUnitId(null);
    }
  }, [filteredUnits, selectedUnitId]);

  const toggleLayer = (key) => {
    setLayerVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  function zoomIn() {
    setMapZoom((prev) => Math.min(2.5, Math.round((prev + 0.25) * 100) / 100));
  }

  function zoomOut() {
    setMapZoom((prev) => Math.max(1, Math.round((prev - 0.25) * 100) / 100));
  }

  function resetMapView() {
    setMapZoom(1);
  }

  return (
    <div className="space-y-5">
      <div className="bg-cad-card border border-cad-border rounded-lg p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-cad-muted">Dispatch Operations</div>
            <h1 className="text-2xl font-bold mt-1">AVL Map</h1>
            <p className="text-sm text-cad-muted mt-2 max-w-3xl">
              Live unit positions, call pins, pursuit overlays, and alarm zones for dispatch coordination.
              {isDispatch ? '' : ' This view is primarily intended for dispatch centres.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDispatch && departmentOptions.length > 0 ? (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="rounded-md border border-cad-border bg-cad-surface px-3 py-2"
              >
                <option value="all">All Visible Departments</option>
                {departmentOptions.map((dept) => (
                  <option key={dept.id} value={String(dept.id)}>
                    {dept.short_name ? `${dept.short_name} - ${dept.name}` : dept.name}
                  </option>
                ))}
              </select>
            ) : null}
            <button type="button" onClick={loadMapData} className="px-4 py-2 rounded-md border border-cad-border bg-cad-surface hover:border-cad-accent/40 transition">
              Refresh
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="rounded-md border border-cad-border bg-cad-surface px-3 py-2">
            <div className="text-xs text-cad-muted uppercase tracking-wide">Units on Map</div>
            <div className="text-xl font-semibold mt-1">{unitMarkers.length}</div>
          </div>
          <div className="rounded-md border border-cad-border bg-cad-surface px-3 py-2">
            <div className="text-xs text-cad-muted uppercase tracking-wide">Active Calls</div>
            <div className="text-xl font-semibold mt-1">{filteredCalls.length}</div>
          </div>
          <div className="rounded-md border border-cad-border bg-cad-surface px-3 py-2">
            <div className="text-xs text-cad-muted uppercase tracking-wide">Alarm Zones</div>
            <div className="text-xl font-semibold mt-1">{filteredZones.length}</div>
          </div>
          <div className="rounded-md border border-cad-border bg-cad-surface px-3 py-2">
            <div className="text-xs text-cad-muted uppercase tracking-wide">Last Refresh</div>
            <div className="text-sm font-medium mt-1">{lastLoadedAt ? formatRelativeAge(lastLoadedAt) : (loading ? 'Loading...' : '-')}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1.65fr)_420px] gap-5">
        <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-cad-border flex items-center justify-between gap-3">
            <div className="font-semibold">Dispatch Area Map</div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1 text-cad-muted"><span className="h-2 w-2 rounded-full bg-emerald-400" />Unit</span>
              <span className="inline-flex items-center gap-1 text-cad-muted"><span className="h-2 w-2 rotate-45 bg-amber-400" />Call</span>
              <span className="inline-flex items-center gap-1 text-cad-muted"><span className="h-2 w-2 rounded-full border border-amber-300" />Alarm Zone</span>
              <span className="inline-flex items-center gap-1 text-cad-muted"><span className="h-px w-4 bg-fuchsia-300" />Pursuit Route</span>
            </div>
          </div>
          {error ? <div className="px-4 pt-4 text-sm text-rose-300">{error}</div> : null}
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  ['basemap', 'Map'],
                  ['grid', 'Grid'],
                  ['zones', 'Zones'],
                  ['pursuits', 'Pursuits'],
                  ['recommendations', 'Closest'],
                  ['labels', 'Labels'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleLayer(key)}
                    className={`px-2.5 py-1 rounded-md border text-xs transition-colors ${
                      layerVisibility[key]
                        ? 'border-cad-accent/30 bg-cad-accent/10 text-cad-accent-light'
                        : 'border-cad-border bg-cad-surface text-cad-muted hover:text-cad-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={zoomOut} disabled={mapZoom <= 1} className="px-2.5 py-1 rounded-md border border-cad-border bg-cad-surface text-xs disabled:opacity-40">-</button>
                <div className="min-w-[60px] text-center text-xs text-cad-muted">{Math.round(mapZoom * 100)}%</div>
                <button type="button" onClick={zoomIn} disabled={mapZoom >= 2.5} className="px-2.5 py-1 rounded-md border border-cad-border bg-cad-surface text-xs disabled:opacity-40">+</button>
                <button type="button" onClick={resetMapView} disabled={mapZoom === 1} className="px-2.5 py-1 rounded-md border border-cad-border bg-cad-surface text-xs disabled:opacity-40">Reset</button>
              </div>
            </div>

            <div className="relative rounded-lg border border-cad-border bg-gradient-to-b from-slate-950 to-slate-900 overflow-hidden">
              <div className="absolute left-4 top-3 z-20 text-xs tracking-wide uppercase text-cad-muted bg-black/30 border border-white/10 rounded px-2 py-1">
                Blaine County / Los Santos
              </div>
              <div className="relative w-full max-w-full aspect-square mx-auto overflow-hidden">
                <div
                  className="absolute inset-0 origin-center transition-transform duration-200"
                  style={{ transform: `scale(${mapZoom})` }}
                >
                  {layerVisibility.basemap ? (
                    <img
                      src={MAP_IMAGE_SRC}
                      alt="Los Santos dispatch map"
                      className="absolute inset-0 w-full h-full object-cover opacity-90 pointer-events-none select-none"
                      draggable={false}
                    />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-950/20 via-transparent to-slate-950/35 pointer-events-none" />
                  {layerVisibility.grid ? (
                    <div
                      className="absolute inset-0 opacity-25 pointer-events-none"
                      style={{
                        backgroundImage: 'linear-gradient(to right, rgba(148,163,184,.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,.18) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                      }}
                    />
                  ) : null}
                  <svg viewBox="0 0 1000 1000" className="absolute inset-0 w-full h-full">
                {layerVisibility.zones && filteredZones.map((zone, idx) => (
                  <ZoneOverlay key={`zone-${String(zone.id || idx)}`} zone={zone} />
                ))}
                {layerVisibility.pursuits && pursuitLines.map((line, idx) => (
                  <line
                    key={`${line.callId}-${idx}`}
                    x1={line.primaryPos.x}
                    y1={line.primaryPos.y}
                    x2={line.followerPos.x}
                    y2={line.followerPos.y}
                    stroke="rgba(232,121,249,0.65)"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                ))}
                {layerVisibility.recommendations && closestRecommendationLines.map((line) => (
                  <line
                    key={`closest-${line.unitId}`}
                    x1={line.callMap.x}
                    y1={line.callMap.y}
                    x2={line.unitMap.x}
                    y2={line.unitMap.y}
                    stroke="rgba(34, 197, 94, 0.55)"
                    strokeWidth="2"
                    strokeDasharray="4 5"
                  />
                ))}
                {callMarkers.map((call) => {
                  const p = call.__map;
                  const selected = Number(selectedCallId) === Number(call.id);
                  const size = selected ? 14 : 10;
                  const color = priorityColor(call.priority);
                  return (
                    <g key={`call-${call.id}`} onClick={() => setSelectedCallId(Number(call.id))} style={{ cursor: 'pointer' }}>
                      <rect x={p.x - (size / 2)} y={p.y - (size / 2)} width={size} height={size} fill={color} transform={`rotate(45 ${p.x} ${p.y})`} opacity={0.95} />
                      {selected ? <circle cx={p.x} cy={p.y} r={16} fill="none" stroke={color} strokeWidth="2" opacity="0.85" /> : null}
                      {layerVisibility.labels ? (
                        <text x={p.x + 9} y={p.y + 4} fill="#f8fafc" fontSize="12" fontWeight="700" stroke="rgba(2,6,23,0.9)" strokeWidth="3" paintOrder="stroke">
                          {String(call.job_code || `C${call.id}`).slice(0, 10)}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {unitMarkers.map((unit) => {
                  const p = unit.__map;
                  const selected = Number(selectedUnitId) === Number(unit.id);
                  const color = statusColor(unit.status);
                  const headingLine = headingLineFromMapPoint(p, unit.position_heading, selected ? 22 : 16);
                  return (
                    <g key={`unit-${unit.id}`} onClick={() => setSelectedUnitId(Number(unit.id))} style={{ cursor: 'pointer' }}>
                      {headingLine ? (
                        <line
                          x1={headingLine.x1}
                          y1={headingLine.y1}
                          x2={headingLine.x2}
                          y2={headingLine.y2}
                          stroke="rgba(226,232,240,0.7)"
                          strokeWidth={selected ? 2.4 : 1.8}
                          strokeLinecap="round"
                        />
                      ) : null}
                      <circle cx={p.x} cy={p.y} r={selected ? 8 : 6} fill={color} stroke="rgba(15,23,42,0.85)" strokeWidth="2" />
                      {layerVisibility.labels ? (
                        <text x={p.x + 10} y={p.y - 8} fill="#e2e8f0" fontSize="13" fontWeight="600" stroke="rgba(2,6,23,0.9)" strokeWidth="3" paintOrder="stroke">
                          {String(unit.callsign || '').toUpperCase()}
                        </text>
                      ) : null}
                    </g>
                  );
                })}
                {selectedCallMarker ? (
                  <circle cx={selectedCallMarker.__map.x} cy={selectedCallMarker.__map.y} r="26" fill="none" stroke="rgba(251,191,36,0.7)" strokeWidth="2" strokeDasharray="5 4" />
                ) : null}
                {selectedUnitMarker ? (
                  <circle cx={selectedUnitMarker.__map.x} cy={selectedUnitMarker.__map.y} r="22" fill="none" stroke="rgba(34,197,94,0.7)" strokeWidth="2" strokeDasharray="4 4" />
                ) : null}
                  </svg>
                </div>
              </div>
              <div className="absolute right-3 bottom-3 text-xs text-cad-muted bg-black/35 border border-white/10 rounded px-2 py-1">
                {loading ? 'Refreshing...' : `Calls without coordinates: ${unmappedCallsCount}`}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-cad-border flex items-center justify-between">
              <div className="font-semibold">Active Calls</div>
              <div className="text-xs text-cad-muted">{filteredCalls.length}</div>
            </div>
            <div className="max-h-[36vh] overflow-y-auto p-3 space-y-2">
              {filteredCalls.length === 0 ? <div className="text-sm text-cad-muted px-1 py-2">No active calls in view.</div> : null}
              {filteredCalls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => setSelectedCallId(Number(call.id))}
                  className={`w-full text-left rounded-md border px-3 py-2 transition ${Number(selectedCallId) === Number(call.id) ? 'border-cad-accent bg-cad-accent/10' : 'border-cad-border bg-cad-surface hover:border-cad-accent/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{call.title || `Call #${call.id}`}</div>
                      <div className="text-xs text-cad-muted mt-1">{call.job_code || 'No code'} | {call.location || 'No location'}</div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded border border-transparent" style={{ color: priorityColor(call.priority), backgroundColor: 'rgba(15,23,42,.55)' }}>
                      P{call.priority || '3'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-cad-muted mt-2">
                    <span>{Array.isArray(call.assigned_units) ? call.assigned_units.length : 0} assigned</span>
                    {call.pursuit_mode_enabled ? <span className="text-fuchsia-300">Pursuit</span> : null}
                    {call.postal ? <span>Postal {call.postal}</span> : null}
                    {call.position_x != null && call.position_y != null ? <span>Mapped</span> : <span>Unmapped</span>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-cad-card border border-cad-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-cad-border flex items-center justify-between">
              <div className="font-semibold">Units</div>
              <div className="text-xs text-cad-muted">{filteredUnits.length}</div>
            </div>
            <div className="max-h-[36vh] overflow-y-auto p-3 space-y-2">
              {filteredUnits.length === 0 ? <div className="text-sm text-cad-muted px-1 py-2">No units in view.</div> : null}
              {filteredUnits.map((unit) => (
                <button
                  key={unit.id}
                  type="button"
                  onClick={() => setSelectedUnitId(Number(unit.id))}
                  className={`w-full text-left rounded-md border px-3 py-2 transition ${Number(selectedUnitId) === Number(unit.id) ? 'border-cad-accent bg-cad-accent/10' : 'border-cad-border bg-cad-surface hover:border-cad-accent/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">{String(unit.callsign || '').toUpperCase()} {unit.user_name ? `- ${unit.user_name}` : ''}</div>
                      <div className="text-xs text-cad-muted mt-1">{labelize(unit.status)} | {unit.department_short_name || unit.department_name || 'Dept'}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: statusColor(unit.status) }} />
                      <span className="text-cad-muted">{formatRelativeAge(unit.position_updated_at)}</span>
                    </span>
                  </div>
                  <div className="text-xs text-cad-muted mt-2">
                    {unit.position_stale ? 'Position stale' : 'Live position'}
                    {Number.isFinite(Number(unit.position_speed)) ? ` | ${Math.round(Number(unit.position_speed))} km/h` : ''}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {(selectedCall || selectedUnit) ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Selected Call</h3>
              {selectedCall ? <span className="text-xs text-cad-muted">#{selectedCall.id}</span> : null}
            </div>
            {!selectedCall ? <div className="text-sm text-cad-muted mt-2">Select a call marker or call list item.</div> : (
              <div className="text-sm mt-3 space-y-2">
                <div><span className="text-cad-muted">Title:</span> {selectedCall.title || '-'}</div>
                <div><span className="text-cad-muted">Job Code:</span> {selectedCall.job_code || '-'}</div>
                <div><span className="text-cad-muted">Location:</span> {selectedCall.location || '-'}</div>
                <div><span className="text-cad-muted">Postal:</span> {selectedCall.postal || '-'}</div>
                <div><span className="text-cad-muted">Priority:</span> P{selectedCall.priority || '3'}</div>
                <div><span className="text-cad-muted">Pursuit:</span> {selectedCall.pursuit_mode_enabled ? 'Active' : 'No'}</div>
                <div><span className="text-cad-muted">Assigned Units:</span> {(selectedCall.assigned_units || []).map((u) => String(u.callsign || '').toUpperCase()).filter(Boolean).join(', ') || '-'}</div>
                {closestUnitRecommendations.length > 0 ? (
                  <div>
                    <div className="text-cad-muted mb-1">Closest Units (Visual Recommendation)</div>
                    <div className="space-y-1">
                      {closestUnitRecommendations.map((entry) => (
                        <button
                          key={`rec-${entry.unit.id}`}
                          type="button"
                          onClick={() => setSelectedUnitId(Number(entry.unit.id))}
                          className="w-full text-left rounded border border-cad-border bg-cad-surface px-2 py-1 hover:border-cad-accent/40"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-medium text-cad-ink">
                              {String(entry.unit.callsign || '').toUpperCase()} {entry.unit.user_name ? `- ${entry.unit.user_name}` : ''}
                            </span>
                            <span className="text-cad-muted">{Math.round(entry.metres)}m</span>
                          </div>
                          <div className="text-[11px] mt-0.5">
                            <span className={entry.available ? 'text-emerald-300' : 'text-amber-300'}>
                              {labelize(entry.unit.status)}
                            </span>
                            {entry.assigned ? <span className="text-cad-muted"> | Already assigned</span> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div><span className="text-cad-muted">Closest Units:</span> {selectedCall.position_x != null && selectedCall.position_y != null ? 'No unit positions available' : 'Call has no map coordinates'}</div>
                )}
              </div>
            )}
          </div>
          <div className="bg-cad-card border border-cad-border rounded-lg p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold">Selected Unit</h3>
              {selectedUnit ? <span className="text-xs text-cad-muted">#{selectedUnit.id}</span> : null}
            </div>
            {!selectedUnit ? <div className="text-sm text-cad-muted mt-2">Select a unit marker or unit list item.</div> : (
              <div className="text-sm mt-3 space-y-2">
                <div><span className="text-cad-muted">Unit:</span> {String(selectedUnit.callsign || '').toUpperCase()}</div>
                <div><span className="text-cad-muted">Officer:</span> {selectedUnit.user_name || '-'}</div>
                <div><span className="text-cad-muted">Department:</span> {selectedUnit.department_name || selectedUnit.department_short_name || '-'}</div>
                <div><span className="text-cad-muted">Status:</span> {labelize(selectedUnit.status)}</div>
                <div><span className="text-cad-muted">Speed:</span> {Number.isFinite(Number(selectedUnit.position_speed)) ? `${Math.round(Number(selectedUnit.position_speed))} km/h` : '-'}</div>
                <div><span className="text-cad-muted">Position Update:</span> {selectedUnit.position_updated_at ? formatRelativeAge(selectedUnit.position_updated_at) : '-'}</div>
                <div><span className="text-cad-muted">Coords:</span> {Number.isFinite(Number(selectedUnit.position_x)) && Number.isFinite(Number(selectedUnit.position_y)) ? `${Number(selectedUnit.position_x).toFixed(1)}, ${Number(selectedUnit.position_y).toFixed(1)}` : '-'}</div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
