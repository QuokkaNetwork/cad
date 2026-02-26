import TreatmentTimelineEntry from './TreatmentTimelineEntry';

export default function TreatmentLogTab({ draft, addTreatmentLogItem, updateTreatmentLogItem, removeTreatmentLogItem }) {
  const entries = Array.isArray(draft.treatment_log) ? draft.treatment_log : [];

  return (
    <div className="bg-cad-surface border border-cad-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">
          Treatment Log
          {entries.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-cad-accent/20 text-cad-accent-light text-[11px] font-bold">
              {entries.length}
            </span>
          )}
        </h4>
        <button
          type="button"
          onClick={addTreatmentLogItem}
          className="px-3 py-1.5 text-xs rounded-lg border border-cad-border text-cad-muted hover:text-cad-ink hover:border-cad-accent/40 transition-colors"
        >
          + Add Entry
        </button>
      </div>

      {entries.length > 0 ? (
        <div className="pt-1">
          {entries.map((entry) => (
            <TreatmentTimelineEntry
              key={entry.id}
              entry={entry}
              onUpdate={updateTreatmentLogItem}
              onRemove={removeTreatmentLogItem}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 text-cad-muted">
          <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <p className="text-sm">No treatments logged yet.</p>
          <p className="text-xs mt-1">Click <span className="text-cad-ink font-medium">+ Add Entry</span> to begin.</p>
        </div>
      )}
    </div>
  );
}
