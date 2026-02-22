const STATUS_STYLES = {
  available: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  busy: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  enroute: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'on-scene': 'bg-red-500/20 text-red-400 border-red-500/30',
  unavailable: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'off-duty': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  // Call statuses
  dispatched: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  active: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  closed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  // BOLO statuses
  resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  // Record types
  charge: 'bg-red-500/20 text-red-400 border-red-500/30',
  fine: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const STATUS_LABELS = {
  available: 'Available',
  busy: 'Busy',
  enroute: 'En Route',
  'on-scene': 'On Scene',
  unavailable: 'Unavailable',
  'off-duty': 'Off Duty',
  dispatched: 'Dispatched',
  active: 'Active',
  closed: 'Closed',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  charge: 'Charge',
  fine: 'Fine',
  warning: 'Warning',
};

export default function StatusBadge({ status, className = '' }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES['off-duty'];
  const label = STATUS_LABELS[status] || status;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${style} ${className}`}>
      {label}
    </span>
  );
}
