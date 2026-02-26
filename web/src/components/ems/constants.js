export const TRIAGE_OPTIONS = [
  { value: 'undetermined', label: 'Undetermined' },
  { value: 'immediate', label: 'Immediate' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'minor', label: 'Minor' },
  { value: 'deceased', label: 'Deceased' },
];

export const MARK_TYPES = [
  'pain',
  'wound',
  'bleeding',
  'fracture',
  'burn',
  'swelling',
  'other',
];

export const MARK_SEVERITY = ['minor', 'moderate', 'severe', 'critical'];

export const MCI_TAG_OPTIONS = [
  { value: '', label: 'Not MCI-tagged' },
  { value: 'green', label: 'Green (Minor)' },
  { value: 'yellow', label: 'Yellow (Delayed)' },
  { value: 'red', label: 'Red (Immediate)' },
  { value: 'black', label: 'Black (Deceased/Expectant)' },
];

export const TRANSPORT_STATUS_OPTIONS = [
  { value: '', label: 'Not transporting' },
  { value: 'pending', label: 'Pending transport' },
  { value: 'enroute', label: 'En route to hospital' },
  { value: 'arrived', label: 'Arrived at hospital' },
  { value: 'handover_complete', label: 'Handover complete' },
];

export const TRIAGE_COLORS = {
  immediate: 'bg-red-500/20 text-red-400 border-red-500/30',
  urgent: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  delayed: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  minor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  deceased: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  undetermined: 'bg-cad-card text-cad-muted border-cad-border',
};

export const CATEGORY_COLORS = {
  treatment: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  medication: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  procedure: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
  transport: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

export function resolvePersonName(person) {
  const fullName = String(person?.full_name || '').trim();
  if (fullName) return fullName;
  const fallback = `${String(person?.firstname || '').trim()} ${String(person?.lastname || '').trim()}`.trim();
  if (fallback) return fallback;
  return String(person?.citizenid || 'Unknown Patient');
}

export function formatStatusLabel(value) {
  return String(value || '')
    .trim()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getSeverityColor(severity) {
  const s = String(severity || '').trim().toLowerCase();
  if (s === 'critical') return '#ef4444';
  if (s === 'severe') return '#f97316';
  if (s === 'moderate') return '#facc15';
  return '#60a5fa';
}
