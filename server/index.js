const path = require('path');
const fs = require('fs');
const express = require('express');
const config = require('../shared/config');
const {
  initDb,
  getUnitByUserId,
  listUnits,
  upsertUnit,
  updateUnitByUserId,
  setUnitOffDuty,
  listCalls,
  createCall,
  updateCall,
  assignUnitToCall,
  unassignUnitFromCall,
  listBolos,
  createBolo,
  cancelBolo,
  listEmergencyCalls,
  createEmergencyCall,
  acceptEmergencyCall,
  completeEmergencyCall,
  listUsers,
  createUser,
  deleteUser,
  updateUserRole,
  resetUserPassword,
  getUserDepartments,
  setUserDepartments,
  getAllUserDepartments,
  listJobSyncMappings,
  upsertJobSyncMapping,
  deleteJobSyncMapping,
  getJobSyncMappingByJob,
  listAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  addAuditLog,
  listAuditLog,
  listCustomJobCodes,
  createCustomJobCode,
  updateCustomJobCode,
  deleteCustomJobCode,
  listCustomStatusCodes,
  createCustomStatusCode,
  updateCustomStatusCode,
  deleteCustomStatusCode,
  getCmsSetting,
  setCmsSetting,
  getAllCmsSettings,
  deleteCmsSetting,
  listCmsServices,
  getCmsService,
  createCmsService,
  updateCmsService,
  deleteCmsService,
  addCmsDepartment,
  removeCmsDepartment,
  updateCmsDepartment,
} = require('./db');
const { login, authMiddleware } = require('./auth');
const { searchCharacters, getCoordsByCitizenId, getSourceByCitizenId, searchVehicles } = require('./qbox');

const app = express();
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Missing credentials' });
    return;
  }

  const result = login(username, password);
  if (!result) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  res.json(result);
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/characters', authMiddleware, async (req, res) => {
  const term = (req.query.search || '').trim();
  if (!term) {
    res.json([]);
    return;
  }

  try {
    const data = await searchCharacters(term);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to query QBox' });
  }
});

app.get('/api/vehicles', authMiddleware, async (req, res) => {
  const term = (req.query.search || '').trim();
  if (!term) {
    res.json([]);
    return;
  }

  try {
    const data = await searchVehicles(term);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to query vehicles' });
  }
});

app.get('/api/units', authMiddleware, (req, res) => {
  res.json(listUnits());
});

app.get('/api/units/me', authMiddleware, (req, res) => {
  const unit = getUnitByUserId(req.user.id);
  res.json(unit || null);
});

app.post('/api/units/me', authMiddleware, (req, res) => {
  const { callsign, name, department, citizenid } = req.body || {};
  if (!callsign || !String(callsign).trim()) {
    res.status(400).json({ error: 'Callsign required' });
    return;
  }

  const unit = upsertUnit({
    user_id: req.user.id,
    citizenid: String(citizenid || '').trim(),
    callsign: String(callsign).trim(),
    name: String(name || req.user.username).trim(),
    department: String(department || '').trim(),
    status: '1',
    location: '',
    note: '',
  });

  res.json(unit);
});

app.patch('/api/units/me', authMiddleware, (req, res) => {
  const { status, location, note, citizenid } = req.body || {};
  if (!status && !location && !note && !citizenid) {
    res.status(400).json({ error: 'No updates provided' });
    return;
  }

  const updated = updateUnitByUserId(req.user.id, {
    status: status ? String(status).trim() : undefined,
    location: location ? String(location).trim() : undefined,
    note: note ? String(note).trim() : undefined,
    citizenid: citizenid ? String(citizenid).trim() : undefined,
  });

  if (!updated) {
    res.status(404).json({ error: 'Unit not on duty' });
    return;
  }

  res.json(updated);
});

app.post('/api/units/me/offduty', authMiddleware, (req, res) => {
  setUnitOffDuty(req.user.id);
  res.json({ status: 'ok' });
});

app.get('/api/units/positions', authMiddleware, async (req, res) => {
  const units = listUnits();
  const enriched = await Promise.all(
    units.map(async (unit) => {
      if (!unit.citizenid) {
        return { ...unit, coords: null };
      }

      const coords = await getCoordsByCitizenId(unit.citizenid);
      return { ...unit, coords: coords || null };
    })
  );

  res.json(enriched);
});

app.get('/api/calls', authMiddleware, (req, res) => {
  res.json(listCalls());
});

app.post('/api/calls', authMiddleware, (req, res) => {
  const { job_code, title, description, location, priority } = req.body || {};
  if (!title || !String(title).trim()) {
    res.status(400).json({ error: 'Title required' });
    return;
  }

  const call = createCall({
    job_code: String(job_code || '').trim(),
    title: String(title).trim(),
    description: String(description || '').trim(),
    location: String(location || '').trim(),
    priority: String(priority || '3').trim(),
    status: 'dispatched',
  });

  res.json(call);
});

app.patch('/api/calls/:id', authMiddleware, (req, res) => {
  const callId = Number(req.params.id);
  if (!Number.isFinite(callId)) {
    res.status(400).json({ error: 'Invalid call id' });
    return;
  }

  const { job_code, title, description, location, priority, status } = req.body || {};
  const updated = updateCall(callId, {
    job_code: job_code ? String(job_code).trim() : undefined,
    title: title ? String(title).trim() : undefined,
    description: description ? String(description).trim() : undefined,
    location: location ? String(location).trim() : undefined,
    priority: priority ? String(priority).trim() : undefined,
    status: status ? String(status).trim() : undefined,
  });

  if (!updated) {
    res.status(404).json({ error: 'Call not found' });
    return;
  }

  res.json(updated);
});

app.post('/api/calls/:id/assign', authMiddleware, (req, res) => {
  const callId = Number(req.params.id);
  const { unitId } = req.body || {};
  if (!Number.isFinite(callId) || !Number.isFinite(Number(unitId))) {
    res.status(400).json({ error: 'Invalid assignment' });
    return;
  }

  assignUnitToCall(callId, Number(unitId));
  res.json({ status: 'ok' });
});

app.post('/api/calls/:id/unassign', authMiddleware, (req, res) => {
  const callId = Number(req.params.id);
  const { unitId } = req.body || {};
  if (!Number.isFinite(callId) || !Number.isFinite(Number(unitId))) {
    res.status(400).json({ error: 'Invalid unassign' });
    return;
  }

  unassignUnitFromCall(callId, Number(unitId));
  res.json({ status: 'ok' });
});

app.get('/api/bolos', authMiddleware, (req, res) => {
  res.json(listBolos());
});

app.post('/api/bolos', authMiddleware, (req, res) => {
  const { type, title, description } = req.body || {};
  if (!title || !String(title).trim()) {
    res.status(400).json({ error: 'Title required' });
    return;
  }

  const bolo = createBolo({
    type: String(type || 'person').trim(),
    title: String(title).trim(),
    description: String(description || '').trim(),
    created_by: req.user.username,
  });

  res.json(bolo);
});

app.post('/api/bolos/:id/cancel', authMiddleware, (req, res) => {
  const boloId = Number(req.params.id);
  if (!Number.isFinite(boloId)) {
    res.status(400).json({ error: 'Invalid BOLO id' });
    return;
  }

  const updated = cancelBolo(boloId);
  if (!updated) {
    res.status(404).json({ error: 'BOLO not found' });
    return;
  }

  res.json(updated);
});

// ===== Admin Middleware =====
function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// ===== User Department Routes =====

app.get('/api/me/departments', authMiddleware, (req, res) => {
  const departments = getUserDepartments(req.user.id);
  res.json(departments);
});

// ===== Admin Routes =====

app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const users = listUsers();
  const allDepts = getAllUserDepartments();
  const deptMap = new Map();
  allDepts.forEach((row) => {
    if (!deptMap.has(row.user_id)) deptMap.set(row.user_id, []);
    deptMap.get(row.user_id).push(row.department);
  });
  res.json(users.map((u) => ({ ...u, departments: deptMap.get(u.id) || [] })));
});

app.post('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  try {
    const user = createUser(String(username).trim(), String(password), String(role || 'dispatcher'));
    addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'create_user', detail: `Created user: ${username} (${role || 'dispatcher'})` });
    res.json(user);
  } catch (err) {
    res.status(409).json({ error: 'Username already exists' });
  }
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  if (userId === req.user.id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }
  deleteUser(userId);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'delete_user', detail: `Deleted user #${userId}` });
  res.json({ status: 'ok' });
});

app.patch('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  const { role } = req.body || {};
  if (!role) {
    res.status(400).json({ error: 'Role required' });
    return;
  }
  const user = updateUserRole(userId, String(role));
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(user);
});

app.post('/api/admin/users/:id/reset-password', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  const { password } = req.body || {};
  if (!password) {
    res.status(400).json({ error: 'Password required' });
    return;
  }
  resetUserPassword(userId, String(password));
  res.json({ status: 'ok' });
});

app.get('/api/admin/users/:id/departments', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  res.json(getUserDepartments(userId));
});

app.put('/api/admin/users/:id/departments', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.id);
  const { departments } = req.body || {};
  if (!Array.isArray(departments)) {
    res.status(400).json({ error: 'departments array required' });
    return;
  }
  const result = setUserDepartments(userId, departments.map((d) => String(d).trim()));
  res.json(result);
});

// ===== Job Sync Mapping Routes =====

app.get('/api/admin/job-sync', authMiddleware, adminMiddleware, (req, res) => {
  res.json(listJobSyncMappings());
});

app.post('/api/admin/job-sync', authMiddleware, adminMiddleware, (req, res) => {
  const { job_name, department } = req.body || {};
  if (!job_name || !department) {
    res.status(400).json({ error: 'job_name and department required' });
    return;
  }
  const mapping = upsertJobSyncMapping(String(job_name).trim(), String(department).trim());
  res.json(mapping);
});

app.delete('/api/admin/job-sync/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  deleteJobSyncMapping(id);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'delete_job_sync', detail: `Deleted job sync mapping #${id}` });
  res.json({ status: 'ok' });
});

// ===== Announcements Routes =====

app.get('/api/announcements', authMiddleware, (req, res) => {
  res.json(listAnnouncements(true));
});

app.get('/api/admin/announcements', authMiddleware, adminMiddleware, (req, res) => {
  res.json(listAnnouncements(false));
});

app.post('/api/admin/announcements', authMiddleware, adminMiddleware, (req, res) => {
  const { title, body } = req.body || {};
  if (!title) {
    res.status(400).json({ error: 'Title required' });
    return;
  }
  const announcement = createAnnouncement({ title: String(title).trim(), body: String(body || '').trim(), created_by: req.user.username });
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'create_announcement', detail: `Created announcement: ${title}` });
  res.json(announcement);
});

app.delete('/api/admin/announcements/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  deleteAnnouncement(id);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'delete_announcement', detail: `Deleted announcement #${id}` });
  res.json({ status: 'ok' });
});

// ===== Audit Log Routes =====

app.get('/api/admin/audit-log', authMiddleware, adminMiddleware, (req, res) => {
  const limit = Number(req.query.limit) || 200;
  res.json(listAuditLog(limit));
});

// ===== Custom Job Codes Routes =====

app.get('/api/job-codes', authMiddleware, (req, res) => {
  res.json(listCustomJobCodes());
});

app.post('/api/admin/job-codes', authMiddleware, adminMiddleware, (req, res) => {
  const { code, label, sort_order } = req.body || {};
  if (!code || !label) {
    res.status(400).json({ error: 'Code and label required' });
    return;
  }
  try {
    const jc = createCustomJobCode(String(code).trim(), String(label).trim(), Number(sort_order) || 0);
    addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'create_job_code', detail: `${code} - ${label}` });
    res.json(jc);
  } catch (err) {
    res.status(409).json({ error: 'Job code already exists' });
  }
});

app.patch('/api/admin/job-codes/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const { code, label, sort_order } = req.body || {};
  if (!code || !label) {
    res.status(400).json({ error: 'Code and label required' });
    return;
  }
  const jc = updateCustomJobCode(id, String(code).trim(), String(label).trim(), Number(sort_order) || 0);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'update_job_code', detail: `${code} - ${label}` });
  res.json(jc);
});

app.delete('/api/admin/job-codes/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  deleteCustomJobCode(id);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'delete_job_code', detail: `Deleted job code #${id}` });
  res.json({ status: 'ok' });
});

// ===== Custom Status Codes Routes =====

app.get('/api/status-codes', authMiddleware, (req, res) => {
  res.json(listCustomStatusCodes());
});

app.post('/api/admin/status-codes', authMiddleware, adminMiddleware, (req, res) => {
  const { code, label, sort_order } = req.body || {};
  if (!code || !label) {
    res.status(400).json({ error: 'Code and label required' });
    return;
  }
  try {
    const sc = createCustomStatusCode(String(code).trim(), String(label).trim(), Number(sort_order) || 0);
    addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'create_status_code', detail: `${code} - ${label}` });
    res.json(sc);
  } catch (err) {
    res.status(409).json({ error: 'Status code already exists' });
  }
});

app.patch('/api/admin/status-codes/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const { code, label, sort_order } = req.body || {};
  if (!code || !label) {
    res.status(400).json({ error: 'Code and label required' });
    return;
  }
  const sc = updateCustomStatusCode(id, String(code).trim(), String(label).trim(), Number(sort_order) || 0);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'update_status_code', detail: `${code} - ${label}` });
  res.json(sc);
});

app.delete('/api/admin/status-codes/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  deleteCustomStatusCode(id);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'delete_status_code', detail: `Deleted status code #${id}` });
  res.json({ status: 'ok' });
});

// ===== Admin: Active Units Oversight =====

app.patch('/api/admin/units/:userId/status', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  const { status } = req.body || {};
  if (!status) {
    res.status(400).json({ error: 'Status required' });
    return;
  }
  const updated = updateUnitByUserId(userId, { status: String(status).trim() });
  if (!updated) {
    res.status(404).json({ error: 'Unit not found' });
    return;
  }
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'admin_set_unit_status', detail: `Set user ${userId} unit to status ${status}` });
  res.json(updated);
});

app.post('/api/admin/units/:userId/kick', authMiddleware, adminMiddleware, (req, res) => {
  const userId = Number(req.params.userId);
  setUnitOffDuty(userId);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'admin_kick_unit', detail: `Kicked user ${userId} off duty` });
  res.json({ status: 'ok' });
});

function resolveTargetId({ serverId, citizenid }) {
  if (Number.isFinite(Number(serverId))) {
    return Number(serverId);
  }

  if (citizenid) {
    return getSourceByCitizenId(String(citizenid).trim());
  }

  return null;
}

function ensureFxServer(req, res) {
  if (typeof emitNet !== 'function') {
    res.status(501).json({ error: 'Radio bridge requires FiveM server runtime' });
    return false;
  }

  return true;
}

app.post('/api/radio/join', authMiddleware, async (req, res) => {
  if (!ensureFxServer(req, res)) {
    return;
  }

  const { channel, citizenid, serverId } = req.body || {};
  if (!channel) {
    res.status(400).json({ error: 'Channel required' });
    return;
  }

  const targetId = await resolveTargetId({ serverId, citizenid });
  if (!targetId) {
    res.status(404).json({ error: 'Target not found' });
    return;
  }

  emitNet('cad:radio:join', targetId, Number(channel));
  res.json({ status: 'ok', targetId });
});

app.post('/api/radio/leave', authMiddleware, async (req, res) => {
  if (!ensureFxServer(req, res)) {
    return;
  }

  const { citizenid, serverId } = req.body || {};
  const targetId = await resolveTargetId({ serverId, citizenid });
  if (!targetId) {
    res.status(404).json({ error: 'Target not found' });
    return;
  }

  emitNet('cad:radio:leave', targetId);
  res.json({ status: 'ok', targetId });
});

// ===== Radio Activity Buffer =====
const radioActivityBuffer = [];
const RADIO_BUFFER_SIZE = config.radio ? config.radio.activityBufferSize || 100 : 100;

function pushRadioActivity(entry) {
  radioActivityBuffer.push({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
  while (radioActivityBuffer.length > RADIO_BUFFER_SIZE) {
    radioActivityBuffer.shift();
  }
}

// ===== Emergency Channel Allocator =====
let nextEmergencyChannel = 900;
function allocateEmergencyChannel() {
  const ch = nextEmergencyChannel;
  nextEmergencyChannel = nextEmergencyChannel >= 999 ? 900 : nextEmergencyChannel + 1;
  return ch;
}

// ===== Emergency 000 Call Routes =====

app.get('/api/emergency-calls', authMiddleware, (req, res) => {
  res.json(listEmergencyCalls());
});

app.post('/api/emergency-calls', authMiddleware, (req, res) => {
  const { caller_citizenid, caller_name, caller_source, location } = req.body || {};
  const channel = allocateEmergencyChannel();

  const call = createEmergencyCall({
    caller_citizenid: caller_citizenid || null,
    caller_name: caller_name || 'Unknown Caller',
    caller_source: caller_source || null,
    location: location || 'Unknown',
    channel,
  });

  if (!call) {
    res.status(500).json({ error: 'Failed to create emergency call' });
    return;
  }

  pushRadioActivity({
    callsign: '000',
    channel: 'EMERGENCY',
    action: `Incoming 000 call from ${call.caller_name} at ${call.location}`,
  });

  res.json(call);
});

app.patch('/api/emergency-calls/:id/accept', authMiddleware, async (req, res) => {
  const callId = Number(req.params.id);
  if (!Number.isFinite(callId)) {
    res.status(400).json({ error: 'Invalid call id' });
    return;
  }

  const call = acceptEmergencyCall(callId, req.user.id);
  if (!call) {
    res.status(404).json({ error: 'Call not found or already accepted' });
    return;
  }

  pushRadioActivity({
    callsign: req.user.username,
    channel: 'EMERGENCY',
    action: `Accepted 000 call #${callId} from ${call.caller_name}`,
  });

  // If running on FiveM, bridge caller into voice channel via pma-voice
  if (typeof global !== 'undefined' && typeof global.exports !== 'undefined' && call.caller_source && call.channel) {
    try {
      const pmaVoice = global.exports['pma-voice'];
      if (pmaVoice && typeof pmaVoice.setPlayerCall === 'function') {
        pmaVoice.setPlayerCall(call.caller_source, call.channel);
      }
    } catch (_) {
      // pma-voice not available, skip voice bridge
    }
  }

  res.json(call);
});

app.patch('/api/emergency-calls/:id/complete', authMiddleware, async (req, res) => {
  const callId = Number(req.params.id);
  if (!Number.isFinite(callId)) {
    res.status(400).json({ error: 'Invalid call id' });
    return;
  }

  // Get call before completing so we have caller_source
  const existing = listEmergencyCalls().find((c) => c.id === callId);
  const call = completeEmergencyCall(callId);
  if (!call) {
    res.status(404).json({ error: 'Call not found' });
    return;
  }

  pushRadioActivity({
    callsign: req.user.username,
    channel: 'EMERGENCY',
    action: `Completed 000 call #${callId}`,
  });

  // End the pma-voice call channel for the caller
  if (typeof global !== 'undefined' && typeof global.exports !== 'undefined' && existing && existing.caller_source) {
    try {
      const pmaVoice = global.exports['pma-voice'];
      if (pmaVoice && typeof pmaVoice.setPlayerCall === 'function') {
        pmaVoice.setPlayerCall(existing.caller_source, 0);
      }
    } catch (_) {
      // pma-voice not available
    }
  }

  res.json(call);
});

// ===== Radio Activity & Channel Routes =====

app.get('/api/radio/activity', authMiddleware, (req, res) => {
  const since = req.query.since;
  if (since) {
    const filtered = radioActivityBuffer.filter((e) => e.timestamp > since);
    res.json(filtered);
  } else {
    res.json(radioActivityBuffer);
  }
});

app.get('/api/radio/channels/:id/players', authMiddleware, (req, res) => {
  const channelId = Number(req.params.id);
  if (!Number.isFinite(channelId)) {
    res.status(400).json({ error: 'Invalid channel id' });
    return;
  }

  // Use pma-voice export if available
  if (typeof global !== 'undefined' && typeof global.exports !== 'undefined') {
    try {
      const pmaVoice = global.exports['pma-voice'];
      if (pmaVoice && typeof pmaVoice.getPlayersInRadioChannel === 'function') {
        const players = pmaVoice.getPlayersInRadioChannel(channelId);
        res.json(players || []);
        return;
      }
    } catch (_) {
      // pma-voice not available
    }
  }

  res.json([]);
});

app.get('/api/radio/mumble-config', authMiddleware, (req, res) => {
  const mumbleConfig = config.mumble || { enabled: false, url: '' };
  res.json(mumbleConfig);
});

// ===== CMS Settings Routes =====

app.get('/api/cms/settings', authMiddleware, (req, res) => {
  res.json(getAllCmsSettings());
});

app.put('/api/admin/cms/settings', authMiddleware, adminMiddleware, (req, res) => {
  const { settings } = req.body || {};
  if (!settings || typeof settings !== 'object') {
    res.status(400).json({ error: 'Settings object required' });
    return;
  }
  for (const [key, value] of Object.entries(settings)) {
    setCmsSetting(String(key), String(value));
  }
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'update_cms_settings', detail: `Updated: ${Object.keys(settings).join(', ')}` });
  res.json(getAllCmsSettings());
});

app.delete('/api/admin/cms/settings/:key', authMiddleware, adminMiddleware, (req, res) => {
  deleteCmsSetting(req.params.key);
  res.json({ status: 'ok' });
});

// ===== CMS Services Routes =====

app.get('/api/cms/services', authMiddleware, (req, res) => {
  res.json(listCmsServices());
});

app.get('/api/cms/services/:serviceId', authMiddleware, (req, res) => {
  const svc = getCmsService(req.params.serviceId);
  if (!svc) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }
  res.json(svc);
});

app.post('/api/admin/cms/services', authMiddleware, adminMiddleware, (req, res) => {
  const { service_id, name, short_name, color, logo_path, sort_order, enabled } = req.body || {};
  if (!service_id || !name) {
    res.status(400).json({ error: 'service_id and name required' });
    return;
  }
  try {
    const svc = createCmsService({
      service_id: String(service_id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      name: String(name).trim(),
      short_name: String(short_name || '').trim(),
      color: String(color || '#444444').trim(),
      logo_path: String(logo_path || '').trim(),
      sort_order: Number(sort_order) || 0,
      enabled: enabled !== false,
    });
    addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'create_cms_service', detail: `Created service: ${name} (${service_id})` });
    res.json(svc);
  } catch (err) {
    res.status(409).json({ error: 'Service ID already exists' });
  }
});

app.patch('/api/admin/cms/services/:serviceId', authMiddleware, adminMiddleware, (req, res) => {
  const { name, short_name, color, logo_path, sort_order, enabled } = req.body || {};
  const svc = updateCmsService(req.params.serviceId, { name, short_name, color, logo_path, sort_order, enabled });
  if (!svc) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'update_cms_service', detail: `Updated service: ${svc.name} (${svc.service_id})` });
  res.json(svc);
});

app.delete('/api/admin/cms/services/:serviceId', authMiddleware, adminMiddleware, (req, res) => {
  const svc = getCmsService(req.params.serviceId);
  if (!svc) {
    res.status(404).json({ error: 'Service not found' });
    return;
  }
  deleteCmsService(req.params.serviceId);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'delete_cms_service', detail: `Deleted service: ${svc.name} (${req.params.serviceId})` });
  res.json({ status: 'ok' });
});

// ===== CMS Department Routes =====

app.post('/api/admin/cms/services/:serviceId/departments', authMiddleware, adminMiddleware, (req, res) => {
  const { name, sort_order } = req.body || {};
  if (!name) {
    res.status(400).json({ error: 'Department name required' });
    return;
  }
  const dept = addCmsDepartment(req.params.serviceId, String(name).trim(), Number(sort_order) || 0);
  if (!dept) {
    res.status(409).json({ error: 'Department already exists for this service' });
    return;
  }
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'add_cms_department', detail: `Added dept "${name}" to ${req.params.serviceId}` });
  res.json(dept);
});

app.patch('/api/admin/cms/departments/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  const { name, sort_order, enabled } = req.body || {};
  const dept = updateCmsDepartment(id, { name, sort_order, enabled });
  if (!dept) {
    res.status(404).json({ error: 'Department not found' });
    return;
  }
  res.json(dept);
});

app.delete('/api/admin/cms/departments/:id', authMiddleware, adminMiddleware, (req, res) => {
  const id = Number(req.params.id);
  removeCmsDepartment(id);
  addAuditLog({ user_id: req.user.id, username: req.user.username, action: 'delete_cms_department', detail: `Deleted department #${id}` });
  res.json({ status: 'ok' });
});

// ===== FiveM Event Handlers =====
// Wrapped in typeof guards so Express works standalone outside FiveM.

if (typeof onNet === 'function') {
  // In-game player dials 000
  onNet('cad:000call', (data) => {
    const source = typeof global !== 'undefined' && typeof global.source !== 'undefined' ? global.source : null;
    const channel = allocateEmergencyChannel();

    createEmergencyCall({
      caller_citizenid: data.citizenid || null,
      caller_name: data.caller_name || 'Unknown Caller',
      caller_source: source,
      location: data.location || 'Unknown',
      channel,
    });

    pushRadioActivity({
      callsign: '000',
      channel: 'EMERGENCY',
      action: `Incoming 000 call from ${data.caller_name || 'Unknown'} at ${data.location || 'Unknown'}`,
    });
  });

  // Job sync: when a player's job changes in FiveM, auto-update their department
  onNet('cad:jobsync', (data) => {
    const source = typeof global !== 'undefined' && typeof global.source !== 'undefined' ? global.source : null;
    if (!data || !data.job_name) return;

    const mapping = getJobSyncMappingByJob(String(data.job_name).trim());
    if (!mapping) return;

    // Find the unit on duty with this citizenid or source
    const units = listUnits();
    const unit = units.find((u) =>
      (data.citizenid && u.citizenid === data.citizenid) ||
      (source && u.user_id === source)
    );

    if (unit) {
      updateUnitByUserId(unit.user_id, { department: mapping.department });
    }

    pushRadioActivity({
      callsign: 'SYSTEM',
      channel: 'SYNC',
      action: `Job sync: ${data.job_name} -> ${mapping.department}`,
    });
  });

  // Client radio activity reports
  onNet('cad:radio:activity', (data) => {
    const source = typeof global !== 'undefined' && typeof global.source !== 'undefined' ? global.source : null;
    pushRadioActivity({
      callsign: data.callsign || `Player ${source || '?'}`,
      channel: data.channel || '?',
      action: data.action || 'transmit',
      source,
    });
  });
}

const webDist = path.resolve(__dirname, '..', 'web', 'dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

initDb().then(() => {
  const server = app.listen(config.http.port, config.http.host, () => {
    console.log(`CAD web panel listening on ${config.http.host}:${config.http.port}`);
  });

  if (typeof on === 'function') {
    on('onResourceStop', (resourceName) => {
      if (resourceName === GetCurrentResourceName()) {
        server.close();
      }
    });
  }
});
