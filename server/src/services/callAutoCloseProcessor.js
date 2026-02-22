const { Calls } = require('../db/sqlite');
const bus = require('../utils/eventBus');

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_STALE_MINUTES = 10;
const DEFAULT_BATCH_SIZE = 100;

let timer = null;
let running = false;

function getIntervalMs() {
  const raw = Number.parseInt(process.env.CALL_AUTO_CLOSE_SWEEP_MS || `${DEFAULT_INTERVAL_MS}`, 10);
  return Number.isFinite(raw) ? Math.max(10_000, raw) : DEFAULT_INTERVAL_MS;
}

function getStaleMinutes() {
  const raw = Number.parseInt(process.env.CALL_AUTO_CLOSE_STALE_MINUTES || `${DEFAULT_STALE_MINUTES}`, 10);
  return Number.isFinite(raw) ? Math.max(1, raw) : DEFAULT_STALE_MINUTES;
}

function getBatchSize() {
  const raw = Number.parseInt(process.env.CALL_AUTO_CLOSE_BATCH_SIZE || `${DEFAULT_BATCH_SIZE}`, 10);
  return Number.isFinite(raw) ? Math.max(1, raw) : DEFAULT_BATCH_SIZE;
}

function isEnabled() {
  const raw = String(process.env.CALL_AUTO_CLOSE_ENABLED || 'true').trim().toLowerCase();
  return raw !== 'false' && raw !== '0' && raw !== 'off' && raw !== 'no';
}

function emitCallClose(call) {
  if (!call || !call.id) return;
  bus.emit('call:close', {
    departmentId: call.department_id,
    call,
    auto_closed: true,
    auto_close_reason: 'unassigned_timeout',
  });
}

function processStaleCalls() {
  if (running) return 0;
  if (!isEnabled()) return 0;

  running = true;
  try {
    const staleMinutes = getStaleMinutes();
    const batchSize = getBatchSize();
    const closedCalls = Calls.autoCloseStaleUnassigned({
      staleMinutes,
      limit: batchSize,
    });

    for (const call of closedCalls) {
      emitCallClose(call);
    }

    if (closedCalls.length > 0) {
      console.log(
        `[CallAutoClose] Auto-closed ${closedCalls.length} unassigned call(s) older than ${staleMinutes} minute(s)`
      );
    }
    return closedCalls.length;
  } catch (error) {
    console.error('[CallAutoClose] Sweep failed:', error?.message || error);
    return 0;
  } finally {
    running = false;
  }
}

function startCallAutoCloseProcessor() {
  if (timer) return;
  const intervalMs = getIntervalMs();
  processStaleCalls();
  timer = setInterval(processStaleCalls, intervalMs);
}

function stopCallAutoCloseProcessor() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  processStaleCalls,
  startCallAutoCloseProcessor,
  stopCallAutoCloseProcessor,
};
