const { FiveMFineJobs, Settings } = require('../db/sqlite');
const qbox = require('../db/qbox');

const DEFAULT_INTERVAL_MS = 5000;
let timer = null;
let running = false;

function getFineDeliveryMode() {
  return String(Settings.get('fivem_bridge_qbox_fines_delivery_mode') || 'bridge')
    .trim()
    .toLowerCase();
}

function isFineQueueEnabled() {
  return String(Settings.get('fivem_bridge_qbox_fines_enabled') || 'true')
    .trim()
    .toLowerCase() === 'true';
}

function getFineAccountKey() {
  return String(Settings.get('qbox_fine_account_key') || 'bank').trim() || 'bank';
}

async function processPendingFineJobs(limit = 25) {
  if (running) return;
  running = true;
  try {
    if (!isFineQueueEnabled()) return;
    if (getFineDeliveryMode() !== 'direct_db') return;

    const jobs = FiveMFineJobs.listPending(limit);
    for (const job of jobs) {
      try {
        await qbox.applyFineByCitizenId({
          citizenId: job.citizen_id,
          amount: Number(job.amount || 0),
          account: getFineAccountKey(),
        });
        FiveMFineJobs.markSent(job.id);
      } catch (err) {
        FiveMFineJobs.markFailed(job.id, String(err?.message || err || 'Direct QBX fine failed'));
      }
    }
  } finally {
    running = false;
  }
}

function startFineProcessor() {
  if (timer) return;
  timer = setInterval(() => {
    processPendingFineJobs().catch((err) => {
      console.error('[FineProcessor] Failed:', err?.message || err);
    });
  }, DEFAULT_INTERVAL_MS);
  processPendingFineJobs().catch((err) => {
    console.error('[FineProcessor] Initial run failed:', err?.message || err);
  });
}

function stopFineProcessor() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = {
  startFineProcessor,
  stopFineProcessor,
  processPendingFineJobs,
};
