import { TRIAGE_COLORS, TRIAGE_OPTIONS } from './constants';

export default function TriageBadge({ category }) {
  const key = String(category || 'undetermined').trim().toLowerCase();
  const colorClass = TRIAGE_COLORS[key] || TRIAGE_COLORS.undetermined;
  const option = TRIAGE_OPTIONS.find((o) => o.value === key);
  const label = option ? option.label : 'Undetermined';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold tracking-wide ${colorClass}`}>
      <span className="w-2 h-2 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
