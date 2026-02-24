const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { Announcements } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const { requireAnnouncementManager } = require('../utils/announcementPermissions');

const router = express.Router();
router.use(requireAuth, requireAnnouncementManager);

function sanitizeAnnouncementPayload(body = {}) {
  const title = String(body.title || '').trim();
  const content = String(body.content || '');
  const expiresAtRaw = String(body.expires_at || '').trim();
  let expires_at = null;
  if (expiresAtRaw) {
    const parsed = Date.parse(expiresAtRaw);
    if (Number.isNaN(parsed)) {
      const err = new Error('expires_at must be a valid date/time');
      err.status = 400;
      throw err;
    }
    expires_at = new Date(parsed).toISOString();
  }
  if (!title) {
    const err = new Error('title is required');
    err.status = 400;
    throw err;
  }
  return {
    title: title.slice(0, 200),
    content: content.slice(0, 8000),
    expires_at,
  };
}

router.get('/', (req, res) => {
  res.json({
    can_manage_announcements: true,
    permission: req.announcementPermission || null,
    announcements: Announcements.list(),
  });
});

router.post('/', (req, res, next) => {
  try {
    const payload = sanitizeAnnouncementPayload(req.body || {});
    const announcement = Announcements.create({
      ...payload,
      created_by: req.user.id,
    });
    bus.emit('announcement:new', { announcement });
    audit(req.user.id, 'announcement_created', {
      announcementId: announcement.id,
      source: req.announcementPermission?.source || '',
    });
    res.status(201).json(announcement);
  } catch (err) {
    if (err?.status) {
      return res.status(err.status).json({ error: err.message || 'Invalid announcement payload' });
    }
    next(err);
  }
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid announcement id' });
  Announcements.delete(id);
  audit(req.user.id, 'announcement_deleted', {
    announcementId: id,
    source: req.announcementPermission?.source || '',
  });
  bus.emit('announcement:delete', { announcementId: id });
  res.json({ success: true });
});

module.exports = router;

