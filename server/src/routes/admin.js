const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const {
  Users, Departments, UserDepartments, DiscordRoleMappings,
  Settings, AuditLog, Announcements, Units, FiveMPlayerLinks, FiveMFineJobs,
} = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const qbox = require('../db/qbox');
const {
  installOrUpdateResource,
  getStatus: getFiveMResourceStatus,
  startFiveMResourceAutoSync,
} = require('../services/fivemResourceManager');

const router = express.Router();
router.use(requireAuth, requireAdmin);

const uploadRoot = path.resolve(__dirname, '../../data/uploads/department-icons');
fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPG, WEBP, or GIF images are allowed'));
  },
});

router.post('/departments/upload-icon', upload.single('icon'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'icon file is required' });
  try {
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.webp`;
    const outputPath = path.join(uploadRoot, fileName);

    await sharp(req.file.buffer)
      .rotate()
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 88 })
      .toFile(outputPath);

    res.json({ icon: `/uploads/department-icons/${fileName}` });
  } catch (err) {
    next(err);
  }
});

// --- Users ---
router.get('/users', (req, res) => {
  const users = Users.list().map(u => {
    u.departments = UserDepartments.getForUser(u.id);
    return u;
  });
  res.json(users);
});

router.patch('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = Users.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { is_admin, is_banned } = req.body;
  const updates = {};
  if (is_admin !== undefined) updates.is_admin = is_admin ? 1 : 0;
  if (is_banned !== undefined) updates.is_banned = is_banned ? 1 : 0;

  Users.update(userId, updates);
  audit(req.user.id, 'user_updated', { targetUserId: userId, updates });

  if (is_banned) {
    Units.removeByUserId(userId);
  }

  res.json(Users.findById(userId));
});

// --- Departments ---
router.get('/departments', (req, res) => {
  res.json(Departments.list());
});

router.post('/departments', (req, res) => {
  const { name, short_name, color, icon } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const dept = Departments.create({ name, short_name, color, icon });
  audit(req.user.id, 'department_created', { departmentId: dept.id, name });
  res.status(201).json(dept);
});

router.patch('/departments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const dept = Departments.findById(id);
  if (!dept) return res.status(404).json({ error: 'Department not found' });

  Departments.update(id, req.body);
  audit(req.user.id, 'department_updated', { departmentId: id });
  res.json(Departments.findById(id));
});

router.delete('/departments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  Departments.delete(id);
  audit(req.user.id, 'department_deleted', { departmentId: id });
  res.json({ success: true });
});

// --- Discord Role Mappings ---
router.get('/role-mappings', (req, res) => {
  res.json(DiscordRoleMappings.list());
});

router.post('/role-mappings', (req, res) => {
  const { discord_role_id, discord_role_name, department_id } = req.body;
  if (!discord_role_id || !department_id) {
    return res.status(400).json({ error: 'discord_role_id and department_id are required' });
  }

  try {
    const mapping = DiscordRoleMappings.create({
      discord_role_id,
      discord_role_name: discord_role_name || '',
      department_id: parseInt(department_id, 10),
    });
    audit(req.user.id, 'role_mapping_created', { mapping });
    res.status(201).json(mapping);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'This Discord role is already mapped' });
    }
    throw err;
  }
});

router.delete('/role-mappings/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  DiscordRoleMappings.delete(id);
  audit(req.user.id, 'role_mapping_deleted', { mappingId: id });
  res.json({ success: true });
});

// Discord guild roles (from bot)
router.get('/discord/roles', async (req, res) => {
  try {
    const { getGuildRoles } = require('../discord/bot');
    const roles = await getGuildRoles();
    res.json(roles);
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch Discord roles', message: err.message });
  }
});

// Trigger full role sync
router.post('/discord/sync', async (req, res) => {
  try {
    const { syncAllMembers } = require('../discord/bot');
    const result = await syncAllMembers();
    audit(req.user.id, 'discord_full_sync', result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Sync failed', message: err.message });
  }
});

// --- QBox diagnostics ---
router.get('/qbox/test', async (req, res) => {
  try {
    const result = await qbox.testConnection();
    if (!result.success) {
      return res.status(400).json({ error: 'QBox connection failed', message: result.message });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'QBox connection failed', message: err.message });
  }
});

router.get('/qbox/schema', async (req, res) => {
  try {
    const report = await qbox.inspectConfiguredSchema();
    if (!report.success) {
      return res.status(400).json({ error: 'QBox schema validation failed', message: report.message, details: report });
    }
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'QBox schema validation failed', message: err.message });
  }
});

// --- Settings ---
router.get('/settings', (req, res) => {
  res.json(Settings.getAll());
});

router.put('/settings', (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings object is required' });
  }
  for (const [key, value] of Object.entries(settings)) {
    Settings.set(key, String(value));
  }
  startFiveMResourceAutoSync();
  audit(req.user.id, 'settings_updated', { keys: Object.keys(settings) });
  res.json(Settings.getAll());
});

// --- FiveM resource management ---
router.get('/fivem-resource/status', (_req, res) => {
  res.json(getFiveMResourceStatus());
});

router.post('/fivem-resource/install', (req, res) => {
  try {
    const result = installOrUpdateResource();
    audit(req.user.id, 'fivem_resource_installed', {
      targetDir: result.targetDir,
      version: result.version,
    });
    startFiveMResourceAutoSync();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/fivem/links', (_req, res) => {
  res.json(FiveMPlayerLinks.list());
});

router.get('/fivem/fine-jobs', (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  res.json(FiveMFineJobs.listRecent(limit));
});

// --- Audit Log ---
router.get('/audit-log', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 100;
  const offset = parseInt(req.query.offset, 10) || 0;
  res.json(AuditLog.list(limit, offset));
});

// --- Announcements ---
router.get('/announcements', (req, res) => {
  res.json(Announcements.list());
});

router.post('/announcements', (req, res) => {
  const { title, content, expires_at } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const announcement = Announcements.create({
    title,
    content: content || '',
    created_by: req.user.id,
    expires_at: expires_at || null,
  });

  bus.emit('announcement:new', { announcement });
  audit(req.user.id, 'announcement_created', { announcementId: announcement.id });
  res.status(201).json(announcement);
});

router.delete('/announcements/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  Announcements.delete(id);
  audit(req.user.id, 'announcement_deleted', { announcementId: id });
  res.json({ success: true });
});

// --- Admin unit management ---
router.patch('/units/:id/status', (req, res) => {
  const { Units: U } = require('../db/sqlite');
  const unit = U.findById(parseInt(req.params.id, 10));
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  const { status } = req.body;
  if (status) {
    U.update(unit.id, { status });
    bus.emit('unit:update', { departmentId: unit.department_id, unit: U.findById(unit.id) });
  }
  res.json(U.findById(unit.id));
});

router.delete('/units/:id', (req, res) => {
  const { Units: U } = require('../db/sqlite');
  const unit = U.findById(parseInt(req.params.id, 10));
  if (!unit) return res.status(404).json({ error: 'Unit not found' });

  U.remove(unit.id);
  bus.emit('unit:offline', { departmentId: unit.department_id, unit });
  audit(req.user.id, 'admin_unit_removed', { unitId: unit.id, callsign: unit.callsign });
  res.json({ success: true });
});

module.exports = router;
