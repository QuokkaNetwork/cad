const MEDICAL_PREFIX = '__CAD_MEDICAL__';
const FIRE_PREFIX = '__CAD_FIRE__';

export const BODY_REGION_OPTIONS = [
  { key: 'head', label: 'Head', top: '8%', left: '50%' },
  { key: 'neck', label: 'Neck', top: '16%', left: '50%' },
  { key: 'chest', label: 'Chest', top: '24%', left: '50%' },
  { key: 'abdomen', label: 'Abdomen', top: '34%', left: '50%' },
  { key: 'left_arm', label: 'Left Arm', top: '26%', left: '24%' },
  { key: 'right_arm', label: 'Right Arm', top: '26%', left: '76%' },
  { key: 'left_hand', label: 'Left Hand', top: '41%', left: '18%' },
  { key: 'right_hand', label: 'Right Hand', top: '41%', left: '82%' },
  { key: 'pelvis', label: 'Pelvis', top: '44%', left: '50%' },
  { key: 'left_leg', label: 'Left Leg', top: '58%', left: '44%' },
  { key: 'right_leg', label: 'Right Leg', top: '58%', left: '56%' },
  { key: 'left_foot', label: 'Left Foot', top: '80%', left: '44%' },
  { key: 'right_foot', label: 'Right Foot', top: '80%', left: '56%' },
  { key: 'back', label: 'Back', top: '30%', left: '65%' },
];

function parsePrefixedJson(text, prefix) {
  const value = String(text || '');
  if (!value.startsWith(prefix)) return null;
  try {
    return JSON.parse(value.slice(prefix.length));
  } catch {
    return null;
  }
}

export function encodeMedicalDescription(payload) {
  return `${MEDICAL_PREFIX}${JSON.stringify(payload || {})}`;
}

export function encodeFireDescription(payload) {
  return `${FIRE_PREFIX}${JSON.stringify(payload || {})}`;
}

export function parseMedicalRecord(record) {
  const parsed = parsePrefixedJson(record?.description, MEDICAL_PREFIX);
  if (!parsed) return null;
  return {
    complaint: String(parsed.complaint || ''),
    pain: Number.isFinite(Number(parsed.pain)) ? Number(parsed.pain) : 0,
    severity: String(parsed.severity || 'minor'),
    body_regions: Array.isArray(parsed.body_regions) ? parsed.body_regions.map(v => String(v)) : [],
    treatment: String(parsed.treatment || ''),
    transport_to: String(parsed.transport_to || ''),
    notes: String(parsed.notes || ''),
    report_type: String(parsed.report_type || 'assessment'),
  };
}

export function parseFireRecord(record) {
  const parsed = parsePrefixedJson(record?.description, FIRE_PREFIX);
  if (!parsed) return null;
  return {
    incident_type: String(parsed.incident_type || 'structure_fire'),
    severity: String(parsed.severity || 'moderate'),
    hazard_notes: String(parsed.hazard_notes || ''),
    suppression_used: String(parsed.suppression_used || ''),
    casualties: Number.isFinite(Number(parsed.casualties)) ? Number(parsed.casualties) : 0,
    notes: String(parsed.notes || ''),
    action_taken: String(parsed.action_taken || ''),
  };
}

