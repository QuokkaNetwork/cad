function getBorderColor(value, normalRange) {
  if (!normalRange || !value) return 'border-l-cad-border';
  const num = parseFloat(value);
  if (isNaN(num)) return 'border-l-cad-border';
  if (num < normalRange.min || num > normalRange.max) return 'border-l-red-500';
  if (normalRange.warnMin != null && normalRange.warnMax != null) {
    if (num < normalRange.warnMin || num > normalRange.warnMax) return 'border-l-amber-500';
  }
  return 'border-l-emerald-500';
}

export default function VitalCard({ label, value, unit, placeholder, onChange, normalRange }) {
  const borderColor = getBorderColor(value, normalRange);
  const displayValue = value || '--';

  return (
    <div className={`bg-cad-card border border-cad-border rounded-lg p-3 border-l-4 ${borderColor} transition-colors`}>
      <p className="text-[11px] uppercase tracking-wider text-cad-muted mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5 mb-2">
        <span className="text-2xl font-bold font-mono text-cad-ink">{displayValue}</span>
        {unit && <span className="text-xs text-cad-muted">{unit}</span>}
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        className="w-full bg-cad-surface border border-cad-border rounded px-2.5 py-1.5 text-sm text-cad-ink focus:outline-none focus:border-cad-accent"
      />
    </div>
  );
}
