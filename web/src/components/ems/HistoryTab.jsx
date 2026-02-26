import { formatDateAU } from '../../utils/dateTime';
import { formatStatusLabel } from './constants';

export default function HistoryTab({ history, selectedAnalysisId, loading, loadHistoryItem, startNewAnalysis }) {
  return (
    <div className="bg-cad-surface border border-cad-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Analysis History</h4>
        <button
          type="button"
          onClick={startNewAnalysis}
          className="px-3 py-1.5 text-xs rounded-lg border border-cad-border text-cad-muted hover:text-cad-ink hover:border-cad-accent/40 transition-colors"
        >
          + New Analysis
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-cad-muted">
          <p className="text-sm">Loading analyses...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-cad-muted">
          <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="text-sm">No prior analyses for this patient.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[calc(100vh-20rem)] overflow-y-auto">
          {history.map((item) => {
            const isSelected = Number(item.id) === Number(selectedAnalysisId);
            const txCount = Array.isArray(item.treatment_log) ? item.treatment_log.length : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => loadHistoryItem(item)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                  isSelected
                    ? 'border-cad-accent bg-cad-accent/10 text-cad-ink'
                    : 'border-cad-border bg-cad-card text-cad-muted hover:text-cad-ink hover:border-cad-accent/30'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">#{item.id}</span>
                  <span className="text-xs">{formatDateAU(item.updated_at || item.created_at || '', '-')}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs">{formatStatusLabel(item.triage_category)}</span>
                  {txCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-cad-surface text-[11px]">{txCount} tx</span>
                  )}
                  {item?.mci_tag && (
                    <span className="px-1.5 py-0.5 rounded bg-cad-surface text-[11px]">MCI {String(item.mci_tag).toUpperCase()}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
