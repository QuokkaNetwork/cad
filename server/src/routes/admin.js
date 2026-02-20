const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const sharp = require('sharp');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const {
  LIVE_MAP_TILE_NAMES,
  ensureLiveMapTilesDir,
  normalizeTileBaseName,
  getLiveMapTilePath,
  listMissingLiveMapTiles,
} = require('../services/liveMapTiles');
const {
  Users, Departments, UserDepartments, DiscordRoleMappings,
  Settings, AuditLog, Announcements, Units, FiveMPlayerLinks, FiveMFineJobs, SubDepartments, OffenceCatalog,
  DriverLicenses, VehicleRegistrations,
  FieldMappingCategories, FieldMappings,
} = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const qbox = require('../db/qbox');
const { processPendingFineJobs } = require('../services/fivemFineProcessor');
const {
  installOrUpdateResource,
  getStatus: getFiveMResourceStatus,
  startFiveMResourceAutoSync,
} = require('../services/fivemResourceManager');

const router = express.Router();
router.use(requireAuth, requireAdmin);
const ACTIVE_LINK_MAX_AGE_MS = 5 * 60 * 1000;
const OFFENCE_CATEGORIES = new Set(['infringement', 'summary', 'indictment']);
const FIELD_MAPPING_ENTITY_TYPES = new Set(['person', 'vehicle']);
const FIELD_MAPPING_TYPES = new Set(['text', 'number', 'date', 'image', 'phone', 'email', 'boolean', 'select', 'badge']);
const IDENTIFIER_RE = /^[A-Za-z0-9_]+$/;
const LIVE_MAP_TILE_NAMES_SET = new Set(LIVE_MAP_TILE_NAMES);

function parseSqliteUtc(value) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  const base = text.replace(' ', 'T');
  const normalized = base.endsWith('Z') ? base : `${base}Z`;
  return Date.parse(normalized);
}

function isActiveFiveMLink(link) {
  const ts = parseSqliteUtc(link?.updated_at);
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) <= ACTIVE_LINK_MAX_AGE_MS;
}

function parseFiveMLinkKey(value) {
  const key = String(value || '').trim();
  if (!key) return { type: 'unknown', value: '' };
  if (key.startsWith('discord:')) {
    return { type: 'discord', value: key.slice('discord:'.length) };
  }
  if (key.startsWith('license:')) {
    return { type: 'license', value: key.slice('license:'.length) };
  }
  return { type: 'steam', value: key };
}

function normalizeOffenceCategory(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (OFFENCE_CATEGORIES.has(normalized)) return normalized;
  return 'infringement';
}

function parseOffenceIsActive(value) {
  if (value === undefined || value === null || value === '') return 1;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const text = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'active', 'on'].includes(text)) return 1;
  if (['0', 'false', 'no', 'n', 'inactive', 'off'].includes(text)) return 0;
  return 1;
}

function parseOrderedIds(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map(id => Number(id))
      .filter(id => Number.isInteger(id) && id > 0)
  ));
}

function normalizeFieldMappingEntityType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (FIELD_MAPPING_ENTITY_TYPES.has(normalized)) return normalized;
  return '';
}

function parseSortOrder(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.trunc(parsed));
}

function parseFlagInt(value, fallback = 0) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const text = String(value || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(text)) return 1;
  if (['0', 'false', 'no', 'n', 'off'].includes(text)) return 0;
  return fallback;
}

function normalizeFieldKey(value, fallbackLabel = '') {
  let normalized = String(value || '').trim().toLowerCase();
  if (!normalized && fallbackLabel) {
    normalized = String(fallbackLabel || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
  if (!normalized) return '';
  if (!/^[a-z0-9_]+$/.test(normalized)) {
    throw new Error('field_key contains invalid characters');
  }
  return normalized;
}

function normalizeFieldType(value, fallback = 'text') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (!FIELD_MAPPING_TYPES.has(normalized)) {
    throw new Error(`field_type must be one of: ${Array.from(FIELD_MAPPING_TYPES).join(', ')}`);
  }
  return normalized;
}

function parsePreviewWidth(value, fallback = 1) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(4, Math.trunc(parsed)));
}

function normalizeFriendlyValuesMap(value) {
  if (value === undefined) return undefined;
  if (value === null) return '';

  let parsed = null;
  if (typeof value === 'string') {
    const text = String(value || '').trim();
    if (!text) return '';
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      throw new Error(`friendly_values_json must be valid JSON: ${err.message}`);
    }
  } else if (typeof value === 'object') {
    parsed = value;
  } else {
    throw new Error('friendly_values_json must be a JSON object');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('friendly_values_json must be a JSON object');
  }

  const normalized = {};
  for (const [rawKey, rawLabel] of Object.entries(parsed)) {
    const key = String(rawKey || '').trim();
    if (!key) continue;
    normalized[key] = rawLabel === null || rawLabel === undefined
      ? ''
      : String(rawLabel);
  }

  return Object.keys(normalized).length > 0 ? JSON.stringify(normalized) : '';
}

function normalizeIdentifier(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (!IDENTIFIER_RE.test(normalized)) {
    throw new Error(`${label} contains invalid characters`);
  }
  return normalized;
}

const uploadRoot = path.resolve(__dirname, '../../data/uploads/department-icons');
fs.mkdirSync(uploadRoot, { recursive: true });
ensureLiveMapTilesDir();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only PNG, JPG, WEBP, or GIF images are allowed'));
  },
});

const mapTilesUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 40 * 1024 * 1024,
    files: LIVE_MAP_TILE_NAMES.length,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (allowed.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only image tile files are allowed'));
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

router.post('/live-map/tiles', mapTilesUpload.array('tiles', LIVE_MAP_TILE_NAMES.length), async (req, res, next) => {
  const files = Array.isArray(req.files) ? req.files : [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'tiles files are required' });
  }

  try {
    const filesByName = new Map();
    const invalidNames = [];
    const duplicateNames = [];

    for (const file of files) {
      const baseName = normalizeTileBaseName(file?.originalname || '').toLowerCase();
      if (!LIVE_MAP_TILE_NAMES_SET.has(baseName)) {
        invalidNames.push(String(file?.originalname || '').trim());
        continue;
      }
      if (filesByName.has(baseName)) {
        duplicateNames.push(baseName);
        continue;
      }
      filesByName.set(baseName, file);
    }

    if (invalidNames.length > 0) {
      return res.status(400).json({
        error: 'Invalid tile file names',
        details: {
          invalid_names: invalidNames,
          expected_names: LIVE_MAP_TILE_NAMES,
        },
      });
    }

    if (duplicateNames.length > 0) {
      return res.status(400).json({
        error: 'Duplicate tile file names',
        details: { duplicates: duplicateNames },
      });
    }

    const missing = LIVE_MAP_TILE_NAMES.filter((name) => !filesByName.has(name));
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required map tile files',
        details: { missing, expected_names: LIVE_MAP_TILE_NAMES },
      });
    }

    const invalidDimensions = [];
    let detectedTileSize = 0;
    for (const tileName of LIVE_MAP_TILE_NAMES) {
      const file = filesByName.get(tileName);
      if (!file) continue;
      const metadata = await sharp(file.buffer).metadata();
      const width = Number(metadata?.width || 0);
      const height = Number(metadata?.height || 0);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width !== height) {
        invalidDimensions.push({
          tile: tileName,
          width,
          height,
          reason: 'tiles must be square and non-zero',
        });
        continue;
      }
      if (detectedTileSize === 0) {
        detectedTileSize = width;
      } else if (width !== detectedTileSize) {
        invalidDimensions.push({
          tile: tileName,
          width,
          height,
          reason: `all tiles must match the same dimensions (${detectedTileSize}x${detectedTileSize})`,
        });
      }
    }
    if (invalidDimensions.length > 0) {
      return res.status(400).json({
        error: 'Invalid tile dimensions',
        details: {
          note: 'All tiles must be the same square dimensions (e.g. 1024x1024 or 3072x3072).',
          invalid: invalidDimensions,
        },
      });
    }
    if (!detectedTileSize || !Number.isFinite(detectedTileSize)) {
      return res.status(400).json({ error: 'Unable to determine tile dimensions' });
    }

    for (const tileName of LIVE_MAP_TILE_NAMES) {
      const file = filesByName.get(tileName);
      if (!file) continue;
      await sharp(file.buffer)
        .rotate()
        .webp({ quality: 80 })
        .toFile(getLiveMapTilePath(tileName));
    }

    const missingAfterUpload = listMissingLiveMapTiles();
    Settings.set('live_map_tile_size', String(Math.round(detectedTileSize)));
    audit(req.user.id, 'live_map_tiles_uploaded', {
      tile_count: LIVE_MAP_TILE_NAMES.length,
      tile_names: LIVE_MAP_TILE_NAMES,
      tile_size: detectedTileSize,
      missing_after_upload: missingAfterUpload,
      total_size_bytes: files.reduce((acc, file) => acc + Number(file?.size || 0), 0),
    });

    res.json({
      success: true,
      uploaded: LIVE_MAP_TILE_NAMES.length,
      tile_names: LIVE_MAP_TILE_NAMES,
      tile_size: detectedTileSize,
      missing: missingAfterUpload,
      map_available: missingAfterUpload.length === 0,
    });
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

  const { is_admin, is_banned, preferred_citizen_id } = req.body;
  const updates = {};
  if (is_admin !== undefined) updates.is_admin = is_admin ? 1 : 0;
  if (is_banned !== undefined) updates.is_banned = is_banned ? 1 : 0;
  if (preferred_citizen_id !== undefined) updates.preferred_citizen_id = String(preferred_citizen_id || '').trim();

  Users.update(userId, updates);
  audit(req.user.id, 'user_updated', { targetUserId: userId, updates });

  if (is_banned) {
    Units.removeByUserId(userId);
  }

  res.json(Users.findById(userId));
});

// --- Departments ---
router.get('/departments', (req, res) => {
  const depts = Departments.list();
  const allSubs = SubDepartments.list();
  const withCounts = depts.map(d => ({
    ...d,
    sub_department_count: allSubs.filter(sd => sd.department_id === d.id).length,
  }));
  res.json(withCounts);
});

router.post('/departments', (req, res) => {
  const {
    name,
    short_name,
    color,
    icon,
    slogan,
    layout_type,
    fivem_job_name,
    fivem_job_grade,
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const dept = Departments.create({
    name,
    short_name,
    color,
    icon,
    slogan,
    layout_type,
    fivem_job_name: String(fivem_job_name || '').trim(),
    fivem_job_grade: Number.isFinite(Number(fivem_job_grade)) ? Number(fivem_job_grade) : 0,
  });
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

router.post('/departments/reorder', (req, res) => {
  const orderedIds = parseOrderedIds(req.body?.ordered_ids);
  if (!orderedIds.length) {
    return res.status(400).json({ error: 'ordered_ids is required' });
  }

  const departments = Departments.list();
  const existingIds = new Set(departments.map(d => d.id));
  if (orderedIds.some(id => !existingIds.has(id))) {
    return res.status(400).json({ error: 'ordered_ids contains unknown department id(s)' });
  }

  const provided = new Set(orderedIds);
  const remaining = departments
    .filter(d => !provided.has(d.id))
    .map(d => d.id);
  const finalOrder = [...orderedIds, ...remaining];

  Departments.reorder(finalOrder);
  audit(req.user.id, 'department_reordered', { ordered_ids: finalOrder });
  res.json(Departments.list());
});

router.delete('/departments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const dept = Departments.findById(id);
  if (!dept) return res.status(404).json({ error: 'Department not found' });
  try {
    Departments.delete(id);
    audit(req.user.id, 'department_deleted', { departmentId: id });
    res.json({ success: true });
  } catch (err) {
    if (String(err.message).includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'Cannot delete department while records/units/mappings still reference it' });
    }
    throw err;
  }
});

// --- Sub Departments ---
router.get('/sub-departments', (req, res) => {
  const deptId = parseInt(req.query.department_id, 10);
  if (deptId) {
    return res.json(SubDepartments.listByDepartment(deptId));
  }
  res.json(SubDepartments.list());
});

router.post('/sub-departments', (req, res) => {
  const {
    department_id,
    name,
    short_name,
    color,
    is_active,
    fivem_job_name,
    fivem_job_grade,
  } = req.body;
  const deptId = parseInt(department_id, 10);
  if (!deptId || !name || !short_name) {
    return res.status(400).json({ error: 'department_id, name and short_name are required' });
  }
  const parent = Departments.findById(deptId);
  if (!parent) return res.status(400).json({ error: 'Parent department not found' });

  try {
    const sub = SubDepartments.create({
      department_id: deptId,
      name: String(name).trim(),
      short_name: String(short_name).trim(),
      color: color || parent.color || '#0052C2',
      is_active: is_active === undefined ? 1 : (is_active ? 1 : 0),
      fivem_job_name: String(fivem_job_name || '').trim(),
      fivem_job_grade: Number.isFinite(Number(fivem_job_grade)) ? Number(fivem_job_grade) : 0,
    });
    audit(req.user.id, 'sub_department_created', { subDepartmentId: sub.id, departmentId: deptId });
    res.status(201).json(sub);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Sub-department name or short name already exists for this department' });
    }
    throw err;
  }
});

router.patch('/sub-departments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sub = SubDepartments.findById(id);
  if (!sub) return res.status(404).json({ error: 'Sub department not found' });

  try {
    SubDepartments.update(id, req.body || {});
    audit(req.user.id, 'sub_department_updated', { subDepartmentId: id });
    res.json(SubDepartments.findById(id));
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(400).json({ error: 'Sub-department name or short name already exists for this department' });
    }
    throw err;
  }
});

router.post('/sub-departments/reorder', (req, res) => {
  const departmentId = parseInt(req.body?.department_id, 10);
  if (!departmentId) return res.status(400).json({ error: 'department_id is required' });
  if (!Departments.findById(departmentId)) return res.status(404).json({ error: 'Department not found' });

  const orderedIds = parseOrderedIds(req.body?.ordered_ids);
  if (!orderedIds.length) return res.status(400).json({ error: 'ordered_ids is required' });

  const subs = SubDepartments.listByDepartment(departmentId);
  const existingIds = new Set(subs.map(s => s.id));
  if (orderedIds.some(id => !existingIds.has(id))) {
    return res.status(400).json({ error: 'ordered_ids contains unknown sub-department id(s) for that department' });
  }

  const provided = new Set(orderedIds);
  const remaining = subs.filter(s => !provided.has(s.id)).map(s => s.id);
  const finalOrder = [...orderedIds, ...remaining];

  SubDepartments.reorderForDepartment(departmentId, finalOrder);
  audit(req.user.id, 'sub_department_reordered', { departmentId, ordered_ids: finalOrder });
  res.json(SubDepartments.listByDepartment(departmentId));
});

router.delete('/sub-departments/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const sub = SubDepartments.findById(id);
  if (!sub) return res.status(404).json({ error: 'Sub department not found' });
  try {
    SubDepartments.delete(id);
    audit(req.user.id, 'sub_department_deleted', { subDepartmentId: id });
    res.json({ success: true });
  } catch (err) {
    if (String(err.message).includes('FOREIGN KEY')) {
      return res.status(400).json({ error: 'Cannot delete sub department while units still reference it' });
    }
    throw err;
  }
});

// --- Discord Role Mappings ---
router.get('/role-mappings', (req, res) => {
  res.json(DiscordRoleMappings.list());
});

router.post('/role-mappings', (req, res) => {
  const {
    discord_role_id,
    discord_role_name,
    target_type,
    target_id,
    department_id,
    job_name,
    job_grade,
  } = req.body;

  // Backward compatibility: treat department_id as department target.
  const resolvedType = target_type || (department_id ? 'department' : '');
  if (!discord_role_id || !resolvedType) {
    return res.status(400).json({ error: 'discord_role_id and target_type are required' });
  }
  if (!['department', 'sub_department', 'job'].includes(resolvedType)) {
    return res.status(400).json({ error: 'target_type must be department, sub_department, or job' });
  }

  let resolvedTargetId = 0;
  let resolvedJobName = '';
  let resolvedJobGrade = 0;

  if (resolvedType === 'department' || resolvedType === 'sub_department') {
    resolvedTargetId = parseInt(target_id || department_id, 10);
    if (!resolvedTargetId) {
      return res.status(400).json({ error: 'target_id is required for department/sub_department mappings' });
    }
  }
  if (resolvedType === 'department' && !Departments.findById(resolvedTargetId)) {
    return res.status(400).json({ error: 'Department target not found' });
  }
  if (resolvedType === 'sub_department' && !SubDepartments.findById(resolvedTargetId)) {
    return res.status(400).json({ error: 'Sub-department target not found' });
  }
  if (resolvedType === 'job') {
    resolvedJobName = String(job_name || '').trim();
    if (!resolvedJobName) {
      return res.status(400).json({ error: 'job_name is required for job mappings' });
    }
    const parsedGrade = Number(job_grade || 0);
    if (!Number.isFinite(parsedGrade) || parsedGrade < 0) {
      return res.status(400).json({ error: 'job_grade must be a non-negative number' });
    }
    resolvedJobGrade = Math.max(0, Math.trunc(parsedGrade));
  }

  try {
    const mapping = DiscordRoleMappings.create({
      discord_role_id,
      discord_role_name: discord_role_name || '',
      target_type: resolvedType,
      target_id: resolvedTargetId,
      job_name: resolvedJobName,
      job_grade: resolvedJobGrade,
    });
    audit(req.user.id, 'role_mapping_created', { mapping });
    res.status(201).json(mapping);
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'This Discord role is already mapped to that target' });
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

// --- Offence catalog ---
router.get('/offence-catalog', (req, res) => {
  const includeInactive = String(req.query.include_inactive || '').toLowerCase() === 'true';
  const offences = OffenceCatalog.list(!includeInactive);
  res.json(offences);
});

router.post('/offence-catalog', (req, res) => {
  const {
    category,
    code,
    title,
    description,
    fine_amount,
    jail_minutes,
    sort_order,
    is_active,
  } = req.body || {};

  const normalizedTitle = String(title || '').trim();
  if (!normalizedTitle) {
    return res.status(400).json({ error: 'title is required' });
  }

  const fineAmount = Number(fine_amount || 0);
  if (!Number.isFinite(fineAmount) || fineAmount < 0) {
    return res.status(400).json({ error: 'fine_amount must be a non-negative number' });
  }
  const jailMinutes = Number(jail_minutes || 0);
  if (!Number.isFinite(jailMinutes) || jailMinutes < 0) {
    return res.status(400).json({ error: 'jail_minutes must be a non-negative number' });
  }

  try {
    const offence = OffenceCatalog.create({
      category: normalizeOffenceCategory(category),
      code: String(code || '').trim(),
      title: normalizedTitle,
      description: String(description || '').trim(),
      fine_amount: fineAmount,
      jail_minutes: jailMinutes,
      sort_order: Number.isFinite(Number(sort_order)) ? Number(sort_order) : 0,
      is_active: is_active === undefined ? 1 : (is_active ? 1 : 0),
    });
    audit(req.user.id, 'offence_catalog_created', { offenceId: offence.id, category: offence.category });
    res.status(201).json(offence);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'An offence with that category/code already exists' });
    }
    throw err;
  }
});

router.post('/offence-catalog/import', (req, res) => {
  const rows = Array.isArray(req.body?.offences) ? req.body.offences : [];
  if (!rows.length) {
    return res.status(400).json({ error: 'offences array is required' });
  }
  if (rows.length > 5000) {
    return res.status(400).json({ error: 'Too many offences in one import (max 5000)' });
  }

  const errors = [];
  const createdIds = [];

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] || {};
    const rowNumber = i + 1;
    try {
      const normalizedTitle = String(row.title || '').trim();
      if (!normalizedTitle) {
        throw new Error('title is required');
      }

      const fineAmount = Number(row.fine_amount ?? 0);
      if (!Number.isFinite(fineAmount) || fineAmount < 0) {
        throw new Error('fine_amount must be a non-negative number');
      }
      const jailMinutes = Number(row.jail_minutes ?? 0);
      if (!Number.isFinite(jailMinutes) || jailMinutes < 0) {
        throw new Error('jail_minutes must be a non-negative number');
      }

      const offence = OffenceCatalog.create({
        category: normalizeOffenceCategory(row.category),
        code: String(row.code || '').trim(),
        title: normalizedTitle,
        description: String(row.description || '').trim(),
        fine_amount: fineAmount,
        jail_minutes: jailMinutes,
        sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
        is_active: parseOffenceIsActive(row.is_active),
      });
      createdIds.push(offence.id);
    } catch (err) {
      const message = String(err?.message || 'Import row failed');
      if (message.includes('UNIQUE')) {
        errors.push({ index: rowNumber, error: 'An offence with that category/code already exists' });
      } else {
        errors.push({ index: rowNumber, error: message });
      }
    }
  }

  audit(req.user.id, 'offence_catalog_imported', {
    total: rows.length,
    imported: createdIds.length,
    failed: errors.length,
  });

  res.json({
    success: errors.length === 0,
    total: rows.length,
    imported: createdIds.length,
    failed: errors.length,
    created_ids: createdIds,
    errors,
  });
});

router.patch('/offence-catalog/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid offence id' });
  const existing = OffenceCatalog.findById(id);
  if (!existing) return res.status(404).json({ error: 'Offence not found' });

  const updates = {};
  if (req.body?.category !== undefined) updates.category = normalizeOffenceCategory(req.body.category);
  if (req.body?.code !== undefined) updates.code = String(req.body.code || '').trim();
  if (req.body?.title !== undefined) {
    const normalizedTitle = String(req.body.title || '').trim();
    if (!normalizedTitle) return res.status(400).json({ error: 'title is required' });
    updates.title = normalizedTitle;
  }
  if (req.body?.description !== undefined) updates.description = String(req.body.description || '').trim();
  if (req.body?.sort_order !== undefined) updates.sort_order = Number.isFinite(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;
  if (req.body?.is_active !== undefined) updates.is_active = req.body.is_active ? 1 : 0;
  if (req.body?.fine_amount !== undefined) {
    const fineAmount = Number(req.body.fine_amount);
    if (!Number.isFinite(fineAmount) || fineAmount < 0) {
      return res.status(400).json({ error: 'fine_amount must be a non-negative number' });
    }
    updates.fine_amount = fineAmount;
  }
  if (req.body?.jail_minutes !== undefined) {
    const jailMinutes = Number(req.body.jail_minutes);
    if (!Number.isFinite(jailMinutes) || jailMinutes < 0) {
      return res.status(400).json({ error: 'jail_minutes must be a non-negative number' });
    }
    updates.jail_minutes = Math.trunc(jailMinutes);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields supplied' });
  }

  try {
    OffenceCatalog.update(id, updates);
    const updated = OffenceCatalog.findById(id);
    audit(req.user.id, 'offence_catalog_updated', { offenceId: id, updates: Object.keys(updates) });
    res.json(updated);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'An offence with that category/code already exists' });
    }
    throw err;
  }
});

router.delete('/offence-catalog', (req, res) => {
  const cleared = OffenceCatalog.clearAll();
  audit(req.user.id, 'offence_catalog_cleared', { cleared });
  res.json({ success: true, cleared });
});

router.delete('/offence-catalog/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid offence id' });
  const existing = OffenceCatalog.findById(id);
  if (!existing) return res.status(404).json({ error: 'Offence not found' });
  OffenceCatalog.delete(id);
  audit(req.user.id, 'offence_catalog_deleted', { offenceId: id });
  res.json({ success: true });
});

// --- CAD records maintenance ---
router.delete('/cad-records/licenses', (req, res) => {
  const cleared = DriverLicenses.clearAll();
  audit(req.user.id, 'driver_licenses_cleared', { cleared });
  res.json({ success: true, cleared });
});

router.delete('/cad-records/registrations', (req, res) => {
  const cleared = VehicleRegistrations.clearAll();
  audit(req.user.id, 'vehicle_registrations_cleared', { cleared });
  res.json({ success: true, cleared });
});

// --- Field Mapping Categories ---
router.get('/field-mapping-categories', (req, res) => {
  const requestedType = String(req.query.entity_type || '').trim();
  if (!requestedType) {
    return res.json({
      person: FieldMappingCategories.list('person'),
      vehicle: FieldMappingCategories.list('vehicle'),
    });
  }

  const entityType = normalizeFieldMappingEntityType(requestedType);
  if (!entityType) {
    return res.status(400).json({ error: 'entity_type must be person or vehicle' });
  }
  res.json(FieldMappingCategories.list(entityType));
});

router.post('/field-mapping-categories', (req, res) => {
  const entityType = normalizeFieldMappingEntityType(req.body?.entity_type);
  if (!entityType) {
    return res.status(400).json({ error: 'entity_type must be person or vehicle' });
  }

  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  const sortOrder = parseSortOrder(req.body?.sort_order, 0);

  try {
    const category = FieldMappingCategories.create({
      name,
      entity_type: entityType,
      sort_order: sortOrder,
    });
    audit(req.user.id, 'field_mapping_category_created', {
      category_id: category.id,
      entity_type: entityType,
      name,
    });
    res.status(201).json(category);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'A category with that name already exists for this entity type' });
    }
    throw err;
  }
});

router.patch('/field-mapping-categories/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid category id' });
  const existing = FieldMappingCategories.findById(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  const updates = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body?.sort_order !== undefined) {
    updates.sort_order = parseSortOrder(req.body.sort_order, Number(existing.sort_order || 0));
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields supplied' });
  }

  try {
    FieldMappingCategories.update(id, updates);
    const updated = FieldMappingCategories.findById(id);
    audit(req.user.id, 'field_mapping_category_updated', {
      category_id: id,
      updates: Object.keys(updates),
    });
    res.json(updated);
  } catch (err) {
    if (String(err?.message || '').includes('UNIQUE')) {
      return res.status(400).json({ error: 'A category with that name already exists for this entity type' });
    }
    throw err;
  }
});

router.delete('/field-mapping-categories/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid category id' });
  const existing = FieldMappingCategories.findById(id);
  if (!existing) return res.status(404).json({ error: 'Category not found' });

  FieldMappingCategories.delete(id);
  audit(req.user.id, 'field_mapping_category_deleted', {
    category_id: id,
    entity_type: existing.entity_type,
    name: existing.name,
  });
  res.json({ success: true });
});

// --- Field Mappings ---
router.get('/field-mappings', (req, res) => {
  const categoryId = parseInt(req.query.category_id, 10);
  if (categoryId) {
    return res.json(FieldMappings.listByCategory(categoryId));
  }

  const entityType = normalizeFieldMappingEntityType(req.query.entity_type || 'person');
  if (!entityType) {
    return res.status(400).json({ error: 'entity_type must be person or vehicle' });
  }
  res.json(FieldMappings.listAll(entityType));
});

router.post('/field-mappings', (req, res) => {
  const categoryId = parseInt(req.body?.category_id, 10);
  if (!categoryId) return res.status(400).json({ error: 'category_id is required' });
  const category = FieldMappingCategories.findById(categoryId);
  if (!category) return res.status(404).json({ error: 'Category not found' });

  const label = String(req.body?.label || '').trim();
  if (!label) return res.status(400).json({ error: 'label is required' });

  let tableName = '';
  let columnName = '';
  let joinColumn = '';
  try {
    tableName = normalizeIdentifier(req.body?.table_name, 'table_name');
    columnName = normalizeIdentifier(req.body?.column_name, 'column_name');
    joinColumn = normalizeIdentifier(req.body?.character_join_column, 'character_join_column');
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (!tableName || !columnName || !joinColumn) {
    return res.status(400).json({ error: 'table_name, column_name, and character_join_column are required' });
  }

  const isJson = parseFlagInt(req.body?.is_json, 0);
  const jsonKey = String(req.body?.json_key || '').trim();
  const sortOrder = parseSortOrder(req.body?.sort_order, 0);
  const isSearchColumn = parseFlagInt(req.body?.is_search_column, 0);
  let friendlyValuesJson = '';
  let fieldKey = '';
  let fieldType = 'text';
  try {
    fieldKey = normalizeFieldKey(req.body?.field_key, label);
    fieldType = normalizeFieldType(req.body?.field_type, 'text');
    friendlyValuesJson = normalizeFriendlyValuesMap(
      req.body?.friendly_values_json !== undefined
        ? req.body.friendly_values_json
        : req.body?.friendly_values_map
    ) || '';
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const previewWidth = parsePreviewWidth(req.body?.preview_width, 1);

  const mapping = FieldMappings.create({
    category_id: categoryId,
    label,
    table_name: tableName,
    column_name: columnName,
    is_json: isJson,
    json_key: jsonKey,
    character_join_column: joinColumn,
    sort_order: sortOrder,
    is_search_column: isSearchColumn,
    field_key: fieldKey,
    field_type: fieldType,
    preview_width: previewWidth,
    friendly_values_json: friendlyValuesJson,
  });

  audit(req.user.id, 'field_mapping_created', {
    mapping_id: mapping.id,
    category_id: categoryId,
    entity_type: category.entity_type,
    label,
  });
  res.status(201).json(mapping);
});

router.patch('/field-mappings/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid mapping id' });
  const existing = FieldMappings.findById(id);
  if (!existing) return res.status(404).json({ error: 'Mapping not found' });

  const updates = {};

  if (req.body?.category_id !== undefined) {
    const categoryId = parseInt(req.body.category_id, 10);
    if (!categoryId) return res.status(400).json({ error: 'category_id must be a positive number' });
    const category = FieldMappingCategories.findById(categoryId);
    if (!category) return res.status(404).json({ error: 'Target category not found' });
    updates.category_id = categoryId;
  }
  if (req.body?.label !== undefined) {
    const label = String(req.body.label || '').trim();
    if (!label) return res.status(400).json({ error: 'label cannot be empty' });
    updates.label = label;
  }
  try {
    if (req.body?.table_name !== undefined) {
      const tableName = normalizeIdentifier(req.body.table_name, 'table_name');
      if (!tableName) return res.status(400).json({ error: 'table_name cannot be empty' });
      updates.table_name = tableName;
    }
    if (req.body?.column_name !== undefined) {
      const columnName = normalizeIdentifier(req.body.column_name, 'column_name');
      if (!columnName) return res.status(400).json({ error: 'column_name cannot be empty' });
      updates.column_name = columnName;
    }
    if (req.body?.character_join_column !== undefined) {
      const joinColumn = normalizeIdentifier(req.body.character_join_column, 'character_join_column');
      if (!joinColumn) return res.status(400).json({ error: 'character_join_column cannot be empty' });
      updates.character_join_column = joinColumn;
    }
    if (req.body?.field_key !== undefined) {
      const fallbackLabel = req.body?.label !== undefined ? String(req.body.label || '').trim() : String(existing.label || '');
      updates.field_key = normalizeFieldKey(req.body.field_key, fallbackLabel);
      if (!updates.field_key) return res.status(400).json({ error: 'field_key cannot be empty' });
    }
    if (req.body?.field_type !== undefined) {
      updates.field_type = normalizeFieldType(req.body.field_type, String(existing.field_type || 'text').trim().toLowerCase() || 'text');
    }
    if (req.body?.friendly_values_json !== undefined || req.body?.friendly_values_map !== undefined) {
      updates.friendly_values_json = normalizeFriendlyValuesMap(
        req.body?.friendly_values_json !== undefined
          ? req.body.friendly_values_json
          : req.body?.friendly_values_map
      );
    }
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  if (req.body?.is_json !== undefined) updates.is_json = parseFlagInt(req.body.is_json, existing.is_json ? 1 : 0);
  if (req.body?.json_key !== undefined) updates.json_key = String(req.body.json_key || '').trim();
  if (req.body?.sort_order !== undefined) updates.sort_order = parseSortOrder(req.body.sort_order, Number(existing.sort_order || 0));
  if (req.body?.is_search_column !== undefined) updates.is_search_column = parseFlagInt(req.body.is_search_column, existing.is_search_column ? 1 : 0);
  if (req.body?.preview_width !== undefined) {
    updates.preview_width = parsePreviewWidth(req.body.preview_width, Number(existing.preview_width || 1) || 1);
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields supplied' });
  }

  FieldMappings.update(id, updates);
  const updated = FieldMappings.findById(id);
  audit(req.user.id, 'field_mapping_updated', {
    mapping_id: id,
    updates: Object.keys(updates),
  });
  res.json(updated);
});

router.delete('/field-mappings/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid mapping id' });
  const existing = FieldMappings.findById(id);
  if (!existing) return res.status(404).json({ error: 'Mapping not found' });

  FieldMappings.delete(id);
  audit(req.user.id, 'field_mapping_deleted', {
    mapping_id: id,
    category_id: existing.category_id,
    label: existing.label,
  });
  res.json({ success: true });
});

router.get('/qbox/table-columns', async (req, res) => {
  const tableName = String(req.query.table_name || '').trim();
  if (!tableName) {
    return res.status(400).json({ error: 'table_name is required' });
  }

  try {
    const columns = await qbox.listTableColumns(tableName);
    res.json(columns);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Failed to inspect table columns' });
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
  const activeOnly = String(_req.query.active || '').toLowerCase() === 'true';
  const links = FiveMPlayerLinks.list();
  const filtered = activeOnly ? links.filter(isActiveFiveMLink) : links;
  const enriched = filtered.map((link) => {
    const parsed = parseFiveMLinkKey(link.steam_id);
    const cadUser = parsed.type === 'discord'
      ? (Users.findByDiscordId(parsed.value) || null)
      : (parsed.type === 'steam' ? (Users.findBySteamId(parsed.value) || null) : null);
    return {
      ...link,
      identifier_type: parsed.type,
      steam_id_resolved: parsed.type === 'steam' ? parsed.value : '',
      discord_id_resolved: parsed.type === 'discord' ? parsed.value : (cadUser?.discord_id || ''),
      license_id_resolved: parsed.type === 'license' ? parsed.value : '',
      cad_user_id: cadUser?.id || null,
      cad_user_name: cadUser?.steam_name || '',
    };
  });
  res.json(enriched);
});

router.get('/fivem/fine-jobs', (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  res.json(FiveMFineJobs.listRecent(limit));
});

router.post('/fivem/fine-jobs/:id/retry', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid job id' });
  const job = FiveMFineJobs.findById(id);
  if (!job) return res.status(404).json({ error: 'Fine job not found' });

  FiveMFineJobs.markPending(id);
  processPendingFineJobs().catch((err) => {
    console.error('[FineProcessor] Retry run failed:', err?.message || err);
  });
  res.json({ ok: true });
});

router.post('/fivem/fine-jobs/:id/cancel', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.status(400).json({ error: 'Invalid job id' });
  const job = FiveMFineJobs.findById(id);
  if (!job) return res.status(404).json({ error: 'Fine job not found' });

  FiveMFineJobs.markCancelled(id, 'Cancelled by admin');
  audit(req.user.id, 'fivem_fine_job_cancelled', { fineJobId: id });
  res.json({ ok: true });
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
