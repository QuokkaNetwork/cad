import TriageBadge from './TriageBadge';
import { resolvePersonName } from './constants';

export default function PatientStatusBar({ person, draft, selectedAnalysisId, saving, onSave, mode }) {
  const painScore = Number(draft.pain_score || 0);
  let painColor = 'text-emerald-400';
  if (painScore >= 7) painColor = 'text-red-400';
  else if (painScore >= 4) painColor = 'text-amber-400';

  const isTransportMode = mode === 'transport';
  const saveLabel = saving
    ? (isTransportMode ? 'Saving...' : 'Saving...')
    : (selectedAnalysisId
      ? (isTransportMode ? 'Update Transport' : 'Update Analysis')
      : (isTransportMode ? 'Save Transport' : 'Save Analysis'));

  return (
    <div className="bg-cad-surface border border-cad-border rounded-lg px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <TriageBadge category={draft.triage_category} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cad-ink truncate">{resolvePersonName(person)}</p>
            <p className="text-xs text-cad-muted font-mono">{person?.citizenid || '-'}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-cad-muted">Pain:</span>
            <span className={`font-bold font-mono ${painColor}`}>{painScore}/10</span>
          </div>

          <span className="px-2 py-1 rounded border border-cad-border bg-cad-card text-xs text-cad-muted">
            {selectedAnalysisId ? `#${selectedAnalysisId}` : 'New'}
          </span>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 bg-cad-accent hover:bg-cad-accent-light text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
