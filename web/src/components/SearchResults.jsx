function normalizeLookupFields(item) {
  const fields = Array.isArray(item?.lookup_fields) ? item.lookup_fields : [];
  return [...fields]
    .filter((field) => String(field?.display_value || '').trim().length > 0)
    .sort((a, b) => {
      const aSort = Number(a?.sort_order || 0);
      const bSort = Number(b?.sort_order || 0);
      if (aSort !== bSort) return aSort - bSort;
      return String(a?.label || '').localeCompare(String(b?.label || ''));
    });
}

function primaryTitle(type, item) {
  if (type === 'person') {
    const full = `${String(item?.firstname || '').trim()} ${String(item?.lastname || '').trim()}`.trim();
    return full || String(item?.citizenid || 'Unknown Person');
  }
  return String(item?.plate || '').trim() || String(item?.vehicle || 'Unknown Vehicle');
}

function secondaryText(type, item) {
  if (type === 'person') {
    return String(item?.citizenid || '').trim();
  }
  const model = String(item?.vehicle || '').trim();
  const owner = String(item?.owner || '').trim();
  if (model && owner) return `${model} | Owner ${owner}`;
  return model || owner || '';
}

export default function SearchResults({ type, results, onSelect }) {
  if (results.length === 0) {
    return <p className="text-sm text-cad-muted py-4 text-center">No results found</p>;
  }

  return (
    <div className="divide-y divide-cad-border/40">
      {results.map((item, i) => {
        const lookupFields = normalizeLookupFields(item).slice(0, 8);
        const title = primaryTitle(type, item);
        const sub = secondaryText(type, item);
        const key = type === 'person'
          ? (item?.citizenid || `p-${i}`)
          : (item?.plate || `v-${i}`);

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
              <span className="text-[11px] text-cad-muted uppercase tracking-wider">
                {type === 'person' ? 'Character' : 'Vehicle'}
              </span>
            </div>

            {lookupFields.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lookupFields.map((field, idx) => (
                  <span
                    key={`${key}-field-${idx}`}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-cad-border bg-cad-surface text-xs"
                  >
                    <span className="text-cad-muted">{field.label}:</span>
                    <span className="text-cad-ink">{field.display_value}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-cad-muted">No lookup fields mapped for this result.</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
