export const DEPARTMENT_LAYOUT = {
  LAW_ENFORCEMENT: 'law_enforcement',
  PARAMEDICS: 'paramedics',
  FIRE: 'fire',
};

export const DEPARTMENT_LAYOUT_OPTIONS = [
  { value: DEPARTMENT_LAYOUT.LAW_ENFORCEMENT, label: 'Law Enforcement' },
  { value: DEPARTMENT_LAYOUT.PARAMEDICS, label: 'Paramedics' },
  { value: DEPARTMENT_LAYOUT.FIRE, label: 'Fire' },
];

export function normalizeDepartmentLayoutType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === DEPARTMENT_LAYOUT.PARAMEDICS) return DEPARTMENT_LAYOUT.PARAMEDICS;
  if (normalized === DEPARTMENT_LAYOUT.FIRE) return DEPARTMENT_LAYOUT.FIRE;
  return DEPARTMENT_LAYOUT.LAW_ENFORCEMENT;
}

export function getDepartmentLayoutType(department) {
  return normalizeDepartmentLayoutType(department?.layout_type);
}

export function getDepartmentLayoutLabel(layoutType) {
  const normalized = normalizeDepartmentLayoutType(layoutType);
  const option = DEPARTMENT_LAYOUT_OPTIONS.find(o => o.value === normalized);
  return option?.label || 'Law Enforcement';
}

