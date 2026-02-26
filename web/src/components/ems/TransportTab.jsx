import { TRANSPORT_STATUS_OPTIONS, MCI_TAG_OPTIONS, formatStatusLabel } from './constants';

const MCI_BORDER_COLORS = {
  green: 'border-emerald-500/50',
  yellow: 'border-yellow-500/50',
  red: 'border-red-500/50',
  black: 'border-gray-500/50',
};

const TRANSPORT_DOT_COLORS = {
  pending: 'bg-amber-400',
  enroute: 'bg-sky-400',
  arrived: 'bg-emerald-400',
  handover_complete: 'bg-emerald-500',
};

export default function TransportTab({ draft, setDraftField, updateTransport, mode }) {
  const isTransportMode = mode === 'transport';
  const treatmentLogCount = Array.isArray(draft.treatment_log) ? draft.treatment_log.length : 0;
  const mciTag = String(draft.mci_tag || '').trim().toLowerCase();
  const mciBorderColor = MCI_BORDER_COLORS[mciTag] || 'border-cad-border';
  const transportStatus = String(draft.transport?.status || '').trim();
  const transportDotColor = TRANSPORT_DOT_COLORS[transportStatus] || 'bg-cad-muted';

  return (
    <div className="space-y-4">
      {/* Transport context summary in transport-only mode */}
      {isTransportMode && (
        <div className="bg-cad-surface border border-cad-border rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Transport Handover Context</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-cad-border/60 bg-cad-card/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-cad-muted">Chief Complaint</p>
              <p className="mt-1 text-cad-ink">{draft.chief_complaint || '-'}</p>
            </div>
            <div className="rounded-lg border border-cad-border/60 bg-cad-card/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-cad-muted">Triage</p>
              <p className="mt-1 text-cad-ink">{formatStatusLabel(draft.triage_category || 'undetermined')}</p>
            </div>
            <div className="rounded-lg border border-cad-border/60 bg-cad-card/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-cad-muted">Treatments Logged</p>
              <p className="mt-1 text-cad-ink">{treatmentLogCount}</p>
            </div>
            <div className="rounded-lg border border-cad-border/60 bg-cad-card/70 px-3 py-2.5">
              <p className="text-[11px] uppercase tracking-wider text-cad-muted">Transport Status</p>
              <p className="mt-1 text-cad-ink">{transportStatus ? formatStatusLabel(transportStatus) : 'Not transporting'}</p>
            </div>
          </div>
          <p className="text-xs text-cad-muted">
            Assessment, vitals, treatment entries, and MCI tagging are managed in the Treatment Log tab.
          </p>
        </div>
      )}

      {/* Transport Tracker */}
      <div className="bg-cad-surface border border-cad-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Transport Tracker</h4>
          {transportStatus && (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cad-card border border-cad-border text-xs text-cad-muted">
              <span className={`w-2 h-2 rounded-full ${transportDotColor}`} />
              {formatStatusLabel(transportStatus)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Destination Hospital</label>
            <input
              value={draft.transport?.destination || ''}
              onChange={(e) => updateTransport('destination', e.target.value)}
              placeholder="Destination hospital"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Transport Status</label>
            <select
              value={draft.transport?.status || ''}
              onChange={(e) => updateTransport('status', e.target.value)}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              {TRANSPORT_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">ETA (minutes)</label>
            <input
              type="number"
              min="0"
              value={draft.transport?.eta_minutes ?? ''}
              onChange={(e) => updateTransport('eta_minutes', e.target.value)}
              placeholder="ETA (minutes)"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Beds Available</label>
            <input
              type="number"
              min="0"
              value={draft.transport?.bed_availability ?? ''}
              onChange={(e) => updateTransport('bed_availability', e.target.value)}
              placeholder="Beds available (if known)"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Transport Unit Callsign</label>
            <input
              value={draft.transport?.unit_callsign || ''}
              onChange={(e) => updateTransport('unit_callsign', e.target.value)}
              placeholder="Transport unit callsign"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Transport Notes</label>
          <textarea
            value={draft.transport?.notes || ''}
            onChange={(e) => updateTransport('notes', e.target.value)}
            rows={2}
            placeholder="Transport notes / destination updates"
            className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-cad-accent"
          />
        </div>
      </div>

      {/* MCI / START Triage */}
      <div className={`bg-cad-surface border rounded-lg p-4 space-y-3 transition-colors ${mciBorderColor}`}>
        <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">MCI / START Triage</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">MCI Incident Key</label>
            <input
              value={draft.mci_incident_key || ''}
              onChange={(e) => setDraftField('mci_incident_key', e.target.value)}
              placeholder="MCI Incident Key (shared across patients)"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">MCI Tag</label>
            <select
              value={draft.mci_tag || ''}
              onChange={(e) => setDraftField('mci_tag', e.target.value)}
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              {MCI_TAG_OPTIONS.map((option) => (
                <option key={option.value || 'none'} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-cad-muted">
          Use the same incident key for all patients in a mass casualty incident to group them together.
        </p>
      </div>
    </div>
  );
}
