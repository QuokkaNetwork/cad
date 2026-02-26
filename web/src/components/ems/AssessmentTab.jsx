import { TRIAGE_OPTIONS, TRIAGE_COLORS } from './constants';

function PainScoreBar({ value, onChange }) {
  const num = Number(value || 0);
  let color = 'bg-emerald-500';
  if (num >= 7) color = 'bg-red-500';
  else if (num >= 4) color = 'bg-amber-500';

  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Pain Score</label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="10"
          step="1"
          value={num}
          onChange={(e) => onChange(Number(e.target.value || 0))}
          className="flex-1"
        />
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white ${color} transition-colors`}>
          {num}
        </span>
      </div>
    </div>
  );
}

export default function AssessmentTab({ draft, setDraftField, updateQuestionnaire }) {
  const triageKey = String(draft.triage_category || 'undetermined').toLowerCase();
  const triageColor = TRIAGE_COLORS[triageKey] || TRIAGE_COLORS.undetermined;

  return (
    <div className="space-y-4">
      {/* Primary Assessment */}
      <div className="bg-cad-surface border border-cad-border rounded-lg p-4 space-y-4">
        <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Primary Assessment</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Triage Category</label>
            <div className="relative">
              <select
                value={draft.triage_category}
                onChange={(e) => setDraftField('triage_category', e.target.value)}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm font-medium focus:outline-none focus:border-cad-accent ${triageColor}`}
              >
                {TRIAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <PainScoreBar
            value={draft.pain_score}
            onChange={(val) => setDraftField('pain_score', val)}
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Chief Complaint</label>
          <input
            type="text"
            value={draft.chief_complaint}
            onChange={(e) => setDraftField('chief_complaint', e.target.value)}
            placeholder="Primary complaint / reason for attendance"
            className="w-full bg-cad-card border border-cad-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-cad-accent"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-cad-card/50 border border-cad-border/60 rounded-lg p-3">
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1.5">Conscious State (AVPU)</label>
            <select
              value={draft.questionnaire?.conscious_state || ''}
              onChange={(e) => updateQuestionnaire('conscious_state', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="">Select...</option>
              <option value="alert">Alert</option>
              <option value="verbal">Responds To Verbal</option>
              <option value="pain">Responds To Pain</option>
              <option value="unresponsive">Unresponsive</option>
            </select>
          </div>
          <div className="bg-cad-card/50 border border-cad-border/60 rounded-lg p-3">
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1.5">Airway</label>
            <select
              value={draft.questionnaire?.airway_state || ''}
              onChange={(e) => updateQuestionnaire('airway_state', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="">Select...</option>
              <option value="clear">Clear</option>
              <option value="compromised">Compromised</option>
              <option value="obstructed">Obstructed</option>
            </select>
          </div>
          <div className="bg-cad-card/50 border border-cad-border/60 rounded-lg p-3">
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1.5">Breathing</label>
            <select
              value={draft.questionnaire?.breathing_state || ''}
              onChange={(e) => updateQuestionnaire('breathing_state', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="">Select...</option>
              <option value="normal">Normal</option>
              <option value="laboured">Laboured</option>
              <option value="assisted">Assisted</option>
              <option value="apnoea">Apnoea</option>
            </select>
          </div>
          <div className="bg-cad-card/50 border border-cad-border/60 rounded-lg p-3">
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1.5">Circulation</label>
            <select
              value={draft.questionnaire?.circulation_state || ''}
              onChange={(e) => updateQuestionnaire('circulation_state', e.target.value)}
              className="w-full bg-cad-surface border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            >
              <option value="">Select...</option>
              <option value="stable">Stable</option>
              <option value="bleeding">Bleeding</option>
              <option value="shock">Shock</option>
              <option value="arrest">Cardiac Arrest</option>
            </select>
          </div>
        </div>
      </div>

      {/* Secondary Questions */}
      <div className="bg-cad-surface border border-cad-border rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold text-cad-muted uppercase tracking-wider">Secondary Questions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Mechanism of Injury</label>
            <input
              value={draft.questionnaire?.mechanism || ''}
              onChange={(e) => updateQuestionnaire('mechanism', e.target.value)}
              placeholder="Mechanism of injury / illness"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Onset / Timeline</label>
            <input
              value={draft.questionnaire?.onset || ''}
              onChange={(e) => updateQuestionnaire('onset', e.target.value)}
              placeholder="Onset / timeline"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Allergies</label>
            <input
              value={draft.questionnaire?.allergies || ''}
              onChange={(e) => updateQuestionnaire('allergies', e.target.value)}
              placeholder="Known allergies"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Current Medications</label>
            <input
              value={draft.questionnaire?.medications || ''}
              onChange={(e) => updateQuestionnaire('medications', e.target.value)}
              placeholder="Current medications"
              className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm focus:outline-none focus:border-cad-accent"
            />
          </div>
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Treatment Provided</label>
          <textarea
            value={draft.questionnaire?.treatment_given || ''}
            onChange={(e) => updateQuestionnaire('treatment_given', e.target.value)}
            placeholder="Treatment provided prior to arrival"
            rows={3}
            className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-cad-accent"
          />
        </div>
        <div>
          <label className="block text-[11px] uppercase tracking-wider text-cad-muted mb-1">Clinical Notes</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraftField('notes', e.target.value)}
            placeholder="Clinical notes..."
            rows={4}
            className="w-full bg-cad-card border border-cad-border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-cad-accent"
          />
        </div>
      </div>
    </div>
  );
}
