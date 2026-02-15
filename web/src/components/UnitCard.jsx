import StatusBadge from './StatusBadge';

export default function UnitCard({ unit, onStatusChange, compact = false }) {
  const statuses = ['available', 'busy', 'enroute', 'on-scene'];

  if (compact) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 bg-cad-surface rounded text-sm">
        <span className="font-mono font-medium text-cad-accent-light">{unit.callsign}</span>
        <StatusBadge status={unit.status} />
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
          <span className="font-mono font-bold text-cad-accent-light">{unit.callsign}</span>
        </div>
        <StatusBadge status={unit.status} />
      </div>
      <p className="text-sm text-cad-muted">{unit.user_name}</p>
      {unit.location && (
        <p className="text-xs text-cad-muted mt-1">
          <span className="text-cad-muted/60">Location:</span> {unit.location}
        </p>
      )}
      {unit.note && (
        <p className="text-xs text-cad-muted mt-1 italic">{unit.note}</p>
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
