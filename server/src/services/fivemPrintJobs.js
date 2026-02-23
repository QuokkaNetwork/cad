let nextPrintJobId = 1;
const printJobs = new Map();

const MAX_ERROR_LENGTH = 500;

function nowIso() {
  return new Date().toISOString();
}

function toSafeInt(value, fallback = 0) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(n) ? n : fallback;
}

function clone(value) {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function normalizeMetadata(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return clone(value);
}

function create(job = {}) {
  const id = nextPrintJobId++;
  const createdAt = nowIso();
  const row = {
    id,
    user_id: toSafeInt(job.user_id, 0) || null,
    citizen_id: String(job.citizen_id || '').trim(),
    steam_id: String(job.steam_id || '').trim(),
    discord_id: String(job.discord_id || '').trim(),
    game_id: String(job.game_id || '').trim(),
    department_id: toSafeInt(job.department_id, 0) || null,
    item_name: String(job.item_name || '').trim(),
    document_type: String(job.document_type || 'document').trim().toLowerCase(),
    document_subtype: String(job.document_subtype || '').trim().toLowerCase(),
    title: String(job.title || 'CAD Document').trim().slice(0, 120),
    description: String(job.description || '').trim().slice(0, 500),
    metadata: normalizeMetadata(job.metadata),
    status: 'pending',
    error: '',
    created_at: createdAt,
    updated_at: createdAt,
    sent_at: null,
    failed_at: null,
  };
  printJobs.set(id, row);
  return findById(id);
}

function findById(id) {
  const key = Number(id);
  const row = printJobs.get(key);
  return row ? clone(row) : null;
}

function listPending(limit = 25) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 25));
  const rows = [];
  for (const row of printJobs.values()) {
    if (row.status !== 'pending') continue;
    rows.push(clone(row));
  }
  rows.sort((a, b) => {
    if (a.id !== b.id) return a.id - b.id;
    return String(a.created_at || '').localeCompare(String(b.created_at || ''));
  });
  return rows.slice(0, safeLimit);
}

function markSent(id) {
  const key = Number(id);
  const row = printJobs.get(key);
  if (!row) return null;
  row.status = 'sent';
  row.error = '';
  row.sent_at = nowIso();
  row.failed_at = null;
  row.updated_at = row.sent_at;
  return findById(key);
}

function markFailed(id, error) {
  const key = Number(id);
  const row = printJobs.get(key);
  if (!row) return null;
  row.status = 'failed';
  row.error = String(error || 'Print job failed').slice(0, MAX_ERROR_LENGTH);
  row.failed_at = nowIso();
  row.updated_at = row.failed_at;
  return findById(key);
}

function markPending(id, error = '') {
  const key = Number(id);
  const row = printJobs.get(key);
  if (!row) return null;
  row.status = 'pending';
  row.error = String(error || '').slice(0, MAX_ERROR_LENGTH);
  row.failed_at = null;
  row.updated_at = nowIso();
  return findById(key);
}

module.exports = {
  create,
  findById,
  listPending,
  markSent,
  markFailed,
  markPending,
};
