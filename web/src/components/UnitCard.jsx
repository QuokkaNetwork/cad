import StatusBadge from './StatusBadge';
import { getHighContrastBadgeStyle } from '../utils/color';

export default function UnitCard({ unit, onStatusChange, compact = false, showDepartment = false }) {
  const statuses = ['available', 'busy', 'enroute', 'on-scene'];
  const unitNote = String(unit.note || '').trim();
  const showNote = !!unitNote && !/^in-game\s*#\d+\b/i.test(unitNote);
  const departmentBadgeStyle = getHighContrastBadgeStyle(unit.department_color, '#64748b');
  const subDepartmentBadgeStyle = getHighContrastBadgeStyle(
    unit.sub_department_color || unit.department_color,
    '#64748b'
  );

  if (compact) {
    return (
      <div className="px-2 py-1.5 bg-cad-surface rounded">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-medium" style={{ color: unit.department_color || '#7dd3fc' }}>{unit.callsign}</span>
          {showDepartment && unit.department_short_name && (
            <span
              className="text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide"
              style={departmentBadgeStyle}
            >
              {unit.department_short_name}
            </span>
          )}
          {unit.sub_department_short_name && (
            <span
              className="text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide"
              style={subDepartmentBadgeStyle}
            >
              {unit.sub_department_short_name}
            </span>
          )}
          <StatusBadge status={unit.status} />
        </div>
        {unit.location && (
          <p className="text-[11px] text-cad-muted mt-1 truncate" title={unit.location}>
            <span className="text-cad-muted/60">Location:</span> {unit.location}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-cad-card border border-cad-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {unit.user_avatar && (
            <img src={unit.user_avatar} alt="" className="w-6 h-6 rounded-full" />
          )}
          <span className="font-mono font-bold" style={{ color: unit.department_color || '#7dd3fc' }}>{unit.callsign}</span>
          {unit.sub_department_short_name && (
            <span
              className="text-[10px] px-2 py-0.5 rounded font-semibold tracking-wide"
              style={subDepartmentBadgeStyle}
              title={unit.sub_department_name || unit.sub_department_short_name}
            >
              {unit.sub_department_short_name}
            </span>
          )}
        </div>
        <StatusBadge status={unit.status} />
      </div>
      <p className="text-sm text-cad-muted">{unit.user_name}</p>
      {unit.location && (
        <p className="text-xs text-cad-muted mt-1">
          <span className="text-cad-muted/60">Location:</span> {unit.location}
        </p>
      )}
      {showNote && (
        <p className="text-xs text-cad-muted mt-1 italic">{unitNote}</p>
      )}
      {onStatusChange && (
        <div className="flex gap-1 mt-2 flex-wrap">
          {statuses.map(s => (
            <button
              key={s}
              disabled={unit.status === s}
              onClick={() => onStatusChange(s)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                unit.status === s
                  ? 'bg-cad-accent/20 text-cad-accent-light cursor-default'
                  : 'bg-cad-surface text-cad-muted hover:text-cad-ink hover:bg-cad-card'
              }`}
            >
              {s === 'on-scene' ? 'On Scene' : s === 'enroute' ? 'En Route' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
