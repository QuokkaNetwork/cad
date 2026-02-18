function primaryTitle(type, item) {
  if (type === 'person') {
    const full = String(item?.full_name || '').trim();
    const fallback = `${String(item?.firstname || '').trim()} ${String(item?.lastname || '').trim()}`.trim();
    return full || fallback || String(item?.citizenid || 'Unknown Person');
  }
  return String(item?.plate || '').trim() || String(item?.vehicle_model || item?.vehicle || 'Unknown Vehicle');
}

function secondaryText(type, item) {
  if (type === 'person') {
    const citizen = String(item?.citizenid || '').trim();
    const license = String(item?.cad_driver_license?.license_number || item?.license_number || '').trim();
    if (citizen && license) return `${citizen} | Licence ${license}`;
    return citizen || license || '';
  }
  const model = String(item?.vehicle_model || item?.vehicle || '').trim();
  const owner = String(item?.owner_name || item?.owner || '').trim();
  if (model && owner) return `${model} | ${owner}`;
  return model || owner || '';
}

export default function SearchResults({ type, results, onSelect }) {
  if (results.length === 0) {
    return <p className="text-sm text-cad-muted py-4 text-center">No results found</p>;
  }

  return (
    <div className="divide-y divide-cad-border/40">
      {results.map((item, i) => {
        const title = primaryTitle(type, item);
        const sub = secondaryText(type, item);
        const key = type === 'person'
          ? (item?.citizenid || `p-${i}`)
          : (item?.plate || `v-${i}`);
        const status = type === 'person'
          ? String(item?.cad_driver_license?.status || item?.status || '').trim()
          : String(item?.cad_registration?.status || item?.status || '').trim();
        const expiry = type === 'person'
          ? String(item?.cad_driver_license?.expiry_at || item?.expiry_at || '').trim()
          : String(item?.cad_registration?.expiry_at || item?.expiry_at || '').trim();

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect?.(item)}
            className="w-full text-left px-4 py-3 hover:bg-cad-card transition-colors"
          >
            <div className="flex items-center justify-between gap-3 mb-2">
              <div>
                <p className={`font-medium ${type === 'vehicle' ? 'font-mono' : ''}`}>{title}</p>
                {sub ? <p className="text-xs text-cad-muted">{sub}</p> : null}
              </div>
              <div className="text-right">
                <p className="text-[11px] text-cad-muted uppercase tracking-wider">
                  {type === 'person' ? 'Licence' : 'Registration'}
                </p>
                {status ? <p className="text-xs text-cad-ink">{status}</p> : null}
              </div>
            </div>

            <p className="text-xs text-cad-muted">
              {expiry ? `Expiry: ${expiry}` : 'No expiry recorded'}
            </p>
          </button>
        );
      })}
    </div>
  );
}
