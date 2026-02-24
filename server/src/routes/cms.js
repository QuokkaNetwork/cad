const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Users, Settings } = require('../db/sqlite');
const { audit } = require('../utils/audit');

const router = express.Router();

function readSetting(key, fallback = '') {
  const value = Settings.get(key);
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function readTrimmedSetting(key, fallback = '') {
  return readSetting(key, fallback).trim() || fallback;
}

function getCurrentRulesVersion() {
  return readTrimmedSetting('cms_rules_version', '1') || '1';
}

function parseCarouselImages(raw) {
  const fallback = ['/1080.png', '/96.png'];
  const text = String(raw || '').trim();
  if (!text) return fallback;
  const normalizeList = (items) => {
    const seen = new Set();
    const urls = [];
    for (const item of Array.isArray(items) ? items : []) {
      const value = (typeof item === 'string' ? item : String(item?.url || '')).trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      urls.push(value);
      if (urls.length >= 12) break;
    }
    return urls;
  };
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return fallback;
    const urls = normalizeList(parsed);
    return urls.length > 0 ? urls : fallback;
  } catch {
    // Also support simple admin input with one URL/path per line.
    const lineUrls = normalizeList(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
    );
    return lineUrls.length > 0 ? lineUrls : fallback;
  }
}

function buildCmsContentPayload() {
  const rulesVersion = getCurrentRulesVersion();
  const rulesRoleId = readTrimmedSetting('cms_discord_rules_accepted_role_id', '');
  return {
    home: {
      title: readTrimmedSetting('cms_home_title', 'Community Home'),
      subtitle: readTrimmedSetting(
        'cms_home_subtitle',
        'News, rule updates, and department access in one place.'
      ),
      body: readSetting(
        'cms_home_body',
        'Welcome to the CAD home page. Use the header to review rules, check amendments, and launch your assigned departments.'
      ),
      carousel_images: parseCarouselImages(readSetting('cms_home_carousel_images_json', '')),
    },
    rules: {
      title: readTrimmedSetting('cms_rules_title', 'Community Rules'),
      version: rulesVersion,
      content: readSetting(
        'cms_rules_content',
        'Add your community rules in Admin > System Settings.\n\nUsers must agree to the current rule version before receiving the Discord access role.'
      ),
      changes_summary: readSetting(
        'cms_rules_changes_summary',
        'Use this field to list rule amendments/changes/additions for the latest update.'
      ),
      updated_at: readTrimmedSetting('cms_rules_updated_at', '') || null,
      discord_access_role_configured: !!rulesRoleId,
    },
  };
}

router.get('/content', requireAuth, (_req, res) => {
  res.json(buildCmsContentPayload());
});

router.post('/rules/agree', requireAuth, async (req, res) => {
  const rulesVersion = getCurrentRulesVersion();
  const agreedAt = new Date().toISOString();

  Users.update(req.user.id, {
    rules_agreed_version: rulesVersion,
    rules_agreed_at: agreedAt,
  });

  let discordRoleSync = {
    attempted: false,
    success: false,
    reason: '',
  };

  const latestUser = Users.findById(req.user.id);
  const discordId = String(latestUser?.discord_id || '').trim();
  if (!discordId) {
    discordRoleSync = {
      attempted: false,
      success: false,
      reason: 'discord_not_linked',
    };
  } else {
    try {
      const { syncUserRoles } = require('../discord/bot');
      const result = await syncUserRoles(discordId);
      discordRoleSync = {
        attempted: true,
        success: !!result?.synced,
        reason: result?.reason || (result?.synced ? 'synced' : 'not_synced'),
        result,
      };
    } catch (err) {
      discordRoleSync = {
        attempted: true,
        success: false,
        reason: 'sync_failed',
        error: String(err?.message || err || 'Unknown Discord sync error'),
      };
    }
  }

  audit(req.user.id, 'cms_rules_agreed', {
    rules_version: rulesVersion,
    discord_id: discordId || '',
    discord_role_sync_attempted: !!discordRoleSync.attempted,
    discord_role_sync_success: !!discordRoleSync.success,
    discord_role_sync_reason: discordRoleSync.reason || '',
  });

  const refreshedUser = Users.findById(req.user.id);
  res.json({
    success: true,
    rules_agreed_version: String(refreshedUser?.rules_agreed_version || '').trim(),
    rules_agreed_at: refreshedUser?.rules_agreed_at || null,
    discord_role_sync: discordRoleSync,
    cms: buildCmsContentPayload(),
  });
});

module.exports = router;
