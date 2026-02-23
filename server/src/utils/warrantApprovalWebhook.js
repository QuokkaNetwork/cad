const config = require('../config');
const { Settings } = require('../db/sqlite');

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  const text = String(value || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function extractChargeTitles(warrant, max = 3) {
  const details = parseJsonObject(warrant?.details_json || warrant?.details);
  const lists = [details.charges, details.offence_items, details.offences];
  const out = [];
  const seen = new Set();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const row of list) {
      const title = typeof row === 'string'
        ? String(row || '').trim()
        : String(row?.title || row?.name || row?.offence_title || '').trim();
      if (!title) continue;
      const key = title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(title);
      if (out.length >= max) return out;
    }
  }
  return out;
}

function getApprovalWebhookSettings() {
  const webhookUrl = String(Settings.get('discord_warrant_approval_webhook_url') || '').trim();
  const username = String(Settings.get('discord_warrant_approval_webhook_username') || 'Warrant Approval Queue').trim() || 'Warrant Approval Queue';
  const avatarUrl = String(Settings.get('discord_warrant_approval_webhook_avatar_url') || '').trim();
  const enabled = webhookUrl.length > 0;
  return { enabled, webhookUrl, username, avatarUrl };
}

function shouldRequireSupervisorApproval() {
  return String(Settings.get('warrant_supervisor_approval_required') || 'false').trim().toLowerCase() === 'true';
}

function buildWarrantApprovalContent(warrant, { isTest = false } = {}) {
  const subjectName = String(warrant?.subject_name || '').trim() || 'Unknown Person';
  const citizenId = String(warrant?.citizen_id || '').trim() || 'Unknown';
  const title = String(warrant?.title || '').trim() || 'Untitled Warrant';
  const charges = extractChargeTitles(warrant, 3);
  const chargeLine = charges.length > 0 ? `Charges: ${charges.join(', ')}` : '';
  const warrantId = Number(warrant?.id || 0) || null;
  const link = warrantId ? `${String(config.webUrl || '').replace(/\/+$/, '')}/warrants` : '';
  const lines = [
    isTest ? 'Test notification: warrant awaiting supervisor approval.' : 'Warrant awaiting supervisor approval.',
    `Subject: ${subjectName} (${citizenId})`,
    `Title: ${title}`,
    chargeLine,
    warrantId ? `Warrant ID: #${warrantId}` : '',
    link ? `CAD: ${link}` : '',
  ].filter(Boolean);
  return lines.join('\n').slice(0, 1900);
}

async function postWebhook({ webhookUrl, username, avatarUrl, content }) {
  const payload = {
    content: String(content || '').trim().slice(0, 1900),
    username: String(username || 'Warrant Approval Queue').trim() || 'Warrant Approval Queue',
  };
  if (String(avatarUrl || '').trim()) {
    payload.avatar_url = String(avatarUrl).trim();
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Discord webhook failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`);
  }
  return true;
}

async function notifyWarrantApprovalPending(warrant) {
  const settings = getApprovalWebhookSettings();
  if (!settings.enabled) {
    return { skipped: true, reason: 'webhook_not_configured' };
  }
  const content = buildWarrantApprovalContent(warrant);
  await postWebhook({
    webhookUrl: settings.webhookUrl,
    username: settings.username,
    avatarUrl: settings.avatarUrl,
    content,
  });
  return { ok: true };
}

async function sendTestWarrantApprovalWebhook() {
  const settings = getApprovalWebhookSettings();
  if (!settings.enabled) {
    return { skipped: true, reason: 'webhook_not_configured' };
  }
  await postWebhook({
    webhookUrl: settings.webhookUrl,
    username: settings.username,
    avatarUrl: settings.avatarUrl,
    content: buildWarrantApprovalContent({
      id: 0,
      subject_name: 'Test Character',
      citizen_id: 'TESTCID01',
      title: 'Test Warrant Approval',
      details_json: JSON.stringify({
        charges: [
          { title: 'Unlawful Assault' },
          { title: 'Resist Police' },
        ],
      }),
    }, { isTest: true }),
  });
  return { ok: true };
}

module.exports = {
  shouldRequireSupervisorApproval,
  notifyWarrantApprovalPending,
  sendTestWarrantApprovalWebhook,
};

