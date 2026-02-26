import { useState } from 'react';
import { CATEGORY_COLORS, formatStatusLabel } from './constants';

export default function TreatmentTimelineEntry({ entry, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(!entry.name);

  const categoryColor = CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.treatment;
  const timeStr = entry.timestamp
    ? new Date(entry.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '--:--';

  if (expanded) {
    return (
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-1">
          <span className="text-[11px] font-mono text-cad-muted w-12 text-right">{timeStr}</span>
          <div className="w-3 h-3 rounded-full bg-cad-accent border-2 border-cad-bg mt-1.5 shrink-0" />
          <div className="w-0.5 flex-1 bg-cad-border mt-1" />
        </div>
        <div className="flex-1 bg-cad-card border border-cad-border rounded-lg p-3 space-y-2 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Category</label>
              <select
                value={entry.category || 'treatment'}
                onChange={(e) => onUpdate(entry.id, 'category', e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
              >
                <option value="treatment">Treatment</option>
                <option value="medication">Medication</option>
                <option value="procedure">Procedure</option>
                <option value="transport">Transport</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Timestamp</label>
              <input
                type="datetime-local"
                value={String(entry.timestamp || '').slice(0, 16)}
                onChange={(e) => onUpdate(entry.id, 'timestamp', e.target.value)}
                className="w-full bg-cad-surface border border-cad-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Name</label>
              <input
                value={entry.name || ''}
                onChange={(e) => onUpdate(entry.id, 'name', e.target.value)}
                placeholder="Medication / procedure name"
                className="w-full bg-cad-surface border border-cad-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Dose</label>
              <input
                value={entry.dose || ''}
                onChange={(e) => onUpdate(entry.id, 'dose', e.target.value)}
                placeholder="Dose / quantity"
                className="w-full bg-cad-surface border border-cad-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Route</label>
              <input
                value={entry.route || ''}
                onChange={(e) => onUpdate(entry.id, 'route', e.target.value)}
                placeholder="PO / IV / IM / etc"
                className="w-full bg-cad-surface border border-cad-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Status</label>
              <input
                value={entry.status || ''}
                onChange={(e) => onUpdate(entry.id, 'status', e.target.value)}
                placeholder="Status"
                className="w-full bg-cad-surface border border-cad-border rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-cad-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Notes</label>
            <textarea
              value={entry.notes || ''}
              onChange={(e) => onUpdate(entry.id, 'notes', e.target.value)}
              placeholder="Notes"
              rows={2}
              className="w-full bg-cad-surface border border-cad-border rounded px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="px-3 py-1.5 text-xs rounded border border-cad-border text-cad-muted hover:text-cad-ink transition-colors"
            >
              Collapse
            </button>
            <button
              type="button"
              onClick={() => onRemove(entry.id)}
              className="px-3 py-1.5 text-xs rounded border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center pt-1">
        <span className="text-[11px] font-mono text-cad-muted w-12 text-right">{timeStr}</span>
        <div className="w-3 h-3 rounded-full bg-cad-accent border-2 border-cad-bg mt-1.5 shrink-0" />
        <div className="w-0.5 flex-1 bg-cad-border mt-1" />
      </div>
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex-1 bg-cad-card border border-cad-border rounded-lg px-3 py-2.5 mb-3 text-left hover:border-cad-accent/40 transition-colors group"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`px-2 py-0.5 rounded border text-[11px] font-semibold shrink-0 ${categoryColor}`}>
              {formatStatusLabel(entry.category)}
            </span>
            <span className="text-sm text-cad-ink truncate">
              {entry.name || 'Unnamed'}
              {entry.dose ? ` ${entry.dose}` : ''}
              {entry.route ? ` (${entry.route})` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {entry.status && (
              <span className="text-[11px] text-cad-muted">{formatStatusLabel(entry.status)}</span>
            )}
            <span className="text-[11px] text-cad-muted opacity-0 group-hover:opacity-100 transition-opacity">Edit</span>
          </div>
        </div>
        {entry.notes && (
          <p className="text-xs text-cad-muted mt-1 truncate">{entry.notes}</p>
        )}
      </button>
    </div>
  );
}
