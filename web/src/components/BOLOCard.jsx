import { formatTimeAU } from '../utils/dateTime';

function formatFlagBadgeLabel(value) {
  const text = String(value || '').trim().replace(/_/g, ' ');
  if (!text) return '';
  return text.replace(/\b([a-z])/g, (char) => char.toUpperCase());
}

export default function BOLOCard({ bolo, onResolve, onCancel }) {
  const isVehicle = bolo.type === 'vehicle';
  let details = {};
  try {
    details = typeof bolo.details_json === 'string' ? JSON.parse(bolo.details_json) : bolo.details_json || {};
  } catch { /* ignore */ }
  const flags = Array.isArray(details?.flags)
    ? details.flags.map((value) => String(value || '').trim()).filter(Boolean)
    : [];
  const plate = String(details?.plate || details?.registration_plate || details?.rego || '').trim();

  return (
    <div className={`bg-cad-card border rounded-lg p-4 ${isVehicle ? 'border-blue-500/30' : 'border-amber-500/30'}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
            isVehicle ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
          }`}>
            {isVehicle ? 'Vehicle' : 'Person'}
          </span>
          <span className="text-xs text-cad-muted">#{bolo.id}</span>
        </div>
        <div className="flex gap-1">
          {onResolve && (
            <button
              onClick={(e) => { e.stopPropagation(); onResolve(bolo.id); }}
              className="text-xs px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20 transition-colors"
            >
              Resolve
            </button>
          )}
          {onCancel && (
            <button
              onClick={(e) => { e.stopPropagation(); onCancel(bolo.id); }}
              className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      <h3 className="font-medium mb-1">{bolo.title}</h3>
      {bolo.description && <p className="text-sm text-cad-muted mb-2">{bolo.description}</p>}

      {/* Details */}
      {Object.keys(details).length > 0 && (
        <div className="bg-cad-surface rounded p-2 mt-2 space-y-1">
          {isVehicle && plate ? (
            <div className="flex gap-2 text-xs">
              <span className="text-cad-muted">Plate:</span>
              <span className="text-cad-ink font-mono">{plate}</span>
            </div>
          ) : null}
          {isVehicle && flags.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {flags.map((flag) => (
                <span
                  key={flag}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] border border-red-500/40 bg-red-500/10 text-red-300"
                >
                  {formatFlagBadgeLabel(flag)}
                </span>
              ))}
            </div>
          ) : null}
          {Object.entries(details).map(([key, value]) => (
            value && key !== 'flags' && key !== 'plate' && key !== 'registration_plate' && key !== 'rego' && (
              <div key={key} className="flex gap-2 text-xs">
                <span className="text-cad-muted capitalize">{key.replace(/_/g, ' ')}:</span>
                <span className="text-cad-ink">{Array.isArray(value) ? value.join(', ') : String(value)}</span>
              </div>
            )
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-3 text-xs text-cad-muted">
        <span>{bolo.creator_name && `by ${bolo.creator_name}`}</span>
        <span>{formatTimeAU(bolo.created_at ? `${bolo.created_at}Z` : '', '-')}</span>
      </div>
    </div>
  );
}
