export const OFFENCE_CATEGORY = {
  INFRINGEMENT: 'infringement',
  SUMMARY: 'summary',
  INDICTMENT: 'indictment',
};

export const OFFENCE_CATEGORY_ORDER = [
  OFFENCE_CATEGORY.INFRINGEMENT,
  OFFENCE_CATEGORY.SUMMARY,
  OFFENCE_CATEGORY.INDICTMENT,
];

export const OFFENCE_CATEGORY_LABEL = {
  [OFFENCE_CATEGORY.INFRINGEMENT]: 'Infringements',
  [OFFENCE_CATEGORY.SUMMARY]: 'Summary',
  [OFFENCE_CATEGORY.INDICTMENT]: 'Indictments',
};

export function normalizeOffenceCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (OFFENCE_CATEGORY_ORDER.includes(normalized)) return normalized;
  return OFFENCE_CATEGORY.INFRINGEMENT;
}

export function getOffenceCategoryLabel(category) {
  return OFFENCE_CATEGORY_LABEL[normalizeOffenceCategory(category)] || 'Infringements';
}

export function parseRecordOffenceItems(record) {
  const raw = String(record?.offence_items_json || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(item => ({
        offence_id: Number(item?.offence_id || 0),
        category: normalizeOffenceCategory(item?.category),
        code: String(item?.code || '').trim(),
        title: String(item?.title || '').trim(),
        fine_amount: Number.isFinite(Number(item?.fine_amount)) ? Number(item.fine_amount) : 0,
        quantity: Number.isFinite(Number(item?.quantity)) ? Math.max(1, Math.trunc(Number(item.quantity))) : 1,
        line_total: Number.isFinite(Number(item?.line_total)) ? Number(item.line_total) : 0,
      }))
      .filter(item => item.offence_id > 0 && item.title);
  } catch {
    return [];
  }
}

export function normalizeOffenceSelections(selectionById) {
  return Object.entries(selectionById || {})
    .map(([id, quantity]) => ({
      offence_id: Number(id),
      quantity: Number.isFinite(Number(quantity)) ? Math.max(1, Math.min(20, Math.trunc(Number(quantity)))) : 1,
    }))
    .filter(item => Number.isInteger(item.offence_id) && item.offence_id > 0 && item.quantity > 0);
}

export function calculateSelectionTotal(catalog, selectionById) {
  const byId = new Map((catalog || []).map(item => [Number(item.id), item]));
  return normalizeOffenceSelections(selectionById).reduce((sum, row) => {
    const offence = byId.get(row.offence_id);
    if (!offence) return sum;
    const fine = Math.max(0, Number(offence.fine_amount || 0));
    return sum + (fine * row.quantity);
  }, 0);
}

