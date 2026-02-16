import StatusBadge from './StatusBadge';

const PRIORITY_LABELS = {
  '1': 'P1',
  '2': 'P2',
  '3': 'P3',
  '4': 'P4',
};

const PRIORITY_COLORS = {
  '1': 'bg-red-500/20 text-red-400 border-red-500/30',
  '2': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  '3': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  '4': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export default function CallCard({ call, onClick, onAssign, onClose, units = [], showDepartment = false }) {
  const priorityStyle = PRIORITY_COLORS[call.priority] || PRIORITY_COLORS['3'];
  const isEmergency000 = String(call?.job_code || '').trim() === '000';

  return (
    <div
      className={`bg-cad-card border border-cad-border rounded-lg overflow-hidden cursor-pointer hover:border-cad-accent/40 transition-colors priority-stripe-${call.priority}`}
      onClick={onClick}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border ${priorityStyle}`}>
              {PRIORITY_LABELS[call.priority] || 'P3'}
            </span>
            {showDepartment && call.department_short_name && (
              <span
                className="text-xs px-1.5 py-0.5 rounded font-semibold"
                style={{
                  backgroundColor: `${call.department_color || '#64748b'}22`,
                  color: call.department_color || '#cbd5e1',
                  border: `1px solid ${call.department_color || '#64748b'}44`,
                }}
              >
                {call.department_short_name}
              </span>
            )}
            {isEmergency000 ? (
              <span className="text-[11px] px-1.5 py-0.5 rounded border border-red-500/35 bg-red-500/15 text-red-300 font-semibold">
                000 Emergency
              </span>
            ) : call.job_code ? (
              <span className="text-xs text-cad-muted font-mono">{call.job_code}</span>
            ) : null}
            <StatusBadge status={call.status} />
          </div>
          <span className="text-xs text-cad-muted">
            #{call.id}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-medium text-sm mb-1">{call.title}</h3>

        {/* Location */}
        {call.location && (
          <p className="text-xs text-cad-muted mb-1">
            <span className="text-cad-muted/60">Location:</span> {call.location}
          </p>
        )}

        {/* Description */}
        {call.description && (
          <p className="text-xs text-cad-muted mb-2 line-clamp-2">{call.description}</p>
        )}

        {/* Assigned units */}
        {call.assigned_units && call.assigned_units.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {call.assigned_units.map(u => (
              <span key={u.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cad-surface rounded text-xs font-mono text-cad-accent-light">
                {u.callsign}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-cad-border/50">
          <span className="text-xs text-cad-muted">
            {call.creator_name && `by ${call.creator_name}`}
          </span>
          <span className="text-xs text-cad-muted">
            {new Date(call.created_at + 'Z').toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
}
