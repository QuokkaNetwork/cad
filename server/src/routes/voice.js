const express = require('express');
const config = require('../config');
const { requireAuth, requireAdmin } = require('../auth/middleware');
const {
  VoiceChannels,
  VoiceParticipants,
  VoiceCallSessions,
  Departments,
  Units,
  FiveMPlayerLinks,
} = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const { getVoiceBridge } = require('../services/voiceBridge');
const { handleParticipantJoin, handleParticipantLeave, getRoutingStatus } = require('../services/voiceBridgeSync');
const { getExternalVoiceService } = require('../services/externalVoice');

const router = express.Router();
const ACTIVE_LINK_MAX_AGE_MS = 5 * 60 * 1000;

function isLegacyVoiceBridgeEnabled(behavior) {
  const bridgeRequested = String(process.env.VOICE_BRIDGE_ENABLED || '').trim().toLowerCase() === 'true';
  return behavior === 'legacy' && bridgeRequested;
}

// Get voice bridge status
router.get('/bridge/status', requireAuth, (req, res) => {
  const behavior = String(config?.radio?.behavior || 'external');
  const externalMode = behavior === 'external';
  const bridgeEnabled = isLegacyVoiceBridgeEnabled(behavior);
  const externalTransportStatus = getExternalVoiceService().getStatus();

  if (externalMode) {
    return res.json({
      mode: 'external',
      available: false,
      intentionally_disabled: true,
      message: 'External radio behavior mode enabled; CAD legacy voice bridge is intentionally disabled.',
      signaling: null,
      external_transport: externalTransportStatus,
    });
  }

  if (!bridgeEnabled) {
    return res.json({
      mode: behavior,
      available: false,
      intentionally_disabled: true,
      message: 'Legacy voice bridge is disabled by VOICE_BRIDGE_ENABLED=false.',
      signaling: null,
      external_transport: externalTransportStatus,
    });
  }

  try {
    const voiceBridge = getVoiceBridge();
    const status = voiceBridge.getStatus();
    const signalingStatus = req.app?.locals?.voiceSignalingServer?.getStatus?.() || null;
    res.json({
      mode: behavior,
      intentionally_disabled: false,
      ...status,
      signaling: signalingStatus,
      external_transport: externalTransportStatus,
    });
  } catch (error) {
    res.json({
      mode: behavior,
      available: false,
      intentionally_disabled: false,
      error: 'Voice bridge not initialized',
      external_transport: externalTransportStatus,
    });
  }
});

router.get('/external/status', requireAuth, (_req, res) => {
  const behavior = String(config?.radio?.behavior || 'external');
  const externalMode = behavior === 'external';
  const status = getExternalVoiceService().getStatus();
  return res.json({
    mode: behavior,
    external_mode: externalMode,
    ...status,
  });
});

// Get voice bridge routing debug info
router.get('/bridge/routing', requireAuth, (req, res) => {
  try {
    const routingStatus = getRoutingStatus();
    res.json(routingStatus);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get routing status',
      message: error.message,
    });
  }
});

function isUserInDispatchDepartment(user) {
  const dispatchDepts = Departments.list().filter(d => d.is_dispatch);
  if (!dispatchDepts.length) return false;
  const dispatchIds = dispatchDepts.map(d => d.id);
  return user.departments.some(d => dispatchIds.includes(d.id));
}

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

function resolveActiveLinkForUser(user) {
  if (!user) return null;
  const candidates = [];

  const steamId = String(user.steam_id || '').trim();
  const discordId = String(user.discord_id || '').trim();

  if (steamId) {
    const bySteam = FiveMPlayerLinks.findBySteamId(steamId);
    if (bySteam) candidates.push(bySteam);
  }
  if (discordId) {
    const byDiscord = FiveMPlayerLinks.findBySteamId(`discord:${discordId}`);
    if (byDiscord) candidates.push(byDiscord);
  }

  const active = candidates.filter(isActiveFiveMLink);
  if (active.length > 0) {
    active.sort((a, b) => parseSqliteUtc(b.updated_at) - parseSqliteUtc(a.updated_at));
    return active[0];
  }
  return candidates[0] || null;
}

function resolveLatestCallerGameId(callSession) {
  const existing = String(callSession?.caller_game_id || '').trim();
  const callerCitizenId = String(callSession?.caller_citizen_id || '').trim();
  if (!callerCitizenId) return existing;

  const byCitizen = FiveMPlayerLinks.findByCitizenId(callerCitizenId);
  if (byCitizen && isActiveFiveMLink(byCitizen)) {
    const gameId = String(byCitizen.game_id || '').trim();
    if (gameId) return gameId;
  }
  return existing;
}

function resolveChannelFromRequest(payload = {}) {
  const channelId = parseInt(payload?.channel_id ?? payload?.channelId, 10);
  if (Number.isInteger(channelId) && channelId > 0) {
    const byId = VoiceChannels.findById(channelId);
    if (byId) return byId;
  }
  const channelNumber = parseInt(payload?.channel_number ?? payload?.channelNumber, 10);
  if (Number.isInteger(channelNumber) && channelNumber > 0) {
    const byNumber = VoiceChannels.findByChannelNumber(channelNumber);
    if (byNumber) return byNumber;
  }
  return null;
}

function parsePositiveInt(value) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function resolveAcceptedCallSessionForUser(user, payload = {}, channel = null) {
  if (!user || typeof user !== 'object') return null;

  const requestedCallSessionId = parsePositiveInt(payload?.call_session_id ?? payload?.callSessionId);
  const requestedChannelNumber = parsePositiveInt(payload?.channel_number ?? payload?.channelNumber);
  const channelNumber = parsePositiveInt(channel?.channel_number) || requestedChannelNumber;

  let callSession = null;
  if (requestedCallSessionId > 0) {
    callSession = VoiceCallSessions.findById(requestedCallSessionId);
  }
  if (!callSession && channelNumber > 0) {
    callSession = VoiceCallSessions.findByChannelNumber(channelNumber);
  }
  if (!callSession) return null;
  if (String(callSession.status || '').toLowerCase() !== 'active') return null;

  const acceptedByUserId = parsePositiveInt(callSession.accepted_by_user_id);
  if (!user.is_admin) {
    const requesterId = parsePositiveInt(user.id);
    if (acceptedByUserId <= 0 || acceptedByUserId !== requesterId) {
      return null;
    }
  }

  return callSession;
}

router.post('/external/token', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Dispatch access required' });
  }

  const behavior = String(config?.radio?.behavior || 'external');
  if (behavior !== 'external') {
    return res.status(409).json({
      error: 'External voice token flow is only available in RADIO_BEHAVIOR=external',
    });
  }

  const payload = req.body || {};
  const channel = resolveChannelFromRequest(payload);
  const callSession = resolveAcceptedCallSessionForUser(req.user, payload, channel);
  if (!channel && !callSession) {
    return res.status(404).json({ error: 'Voice channel or accepted call channel not found' });
  }

  const participant = channel ? VoiceParticipants.findByUserAndChannel(req.user.id, channel.id) : null;
  if (channel && !participant && !callSession) {
    return res.status(409).json({
      error: 'Join the selected channel in CAD before requesting an external voice token (or use an accepted call channel)',
    });
  }

  const channelNumber = parsePositiveInt(channel?.channel_number) || parsePositiveInt(callSession?.call_channel_number);
  if (channelNumber <= 0) {
    return res.status(409).json({ error: 'Unable to resolve a valid channel number for external voice token' });
  }

  const channelName = channel
    ? String(channel.name || `Channel ${channelNumber}`).trim() || `Channel ${channelNumber}`
    : `000 Call #${parsePositiveInt(callSession?.call_id) || parsePositiveInt(callSession?.id) || channelNumber}`;
  const channelType = callSession ? 'call' : 'radio';

  try {
    const externalVoice = getExternalVoiceService();
    const status = externalVoice.getStatus();
    if (!status.available) {
      return res.status(503).json({
        error: 'External voice transport is not configured',
        provider: status.provider,
        missing: status.missing,
      });
    }

    const tokenData = externalVoice.issueDispatcherToken({
      user: req.user,
      channelNumber,
      channelName,
    });

    audit(req.user.id, 'external_voice_dispatch_token_issued', {
      provider: tokenData.provider,
      channel_id: channel?.id || null,
      channel_number: channelNumber,
      channel_type: channelType,
      call_session_id: callSession?.id || null,
    });

    return res.json({
      ok: true,
      channel_id: channel?.id || null,
      channel_number: channelNumber,
      channel_type: channelType,
      call_session_id: callSession?.id || null,
      ...tokenData,
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode || 500) || 500;
    return res.status(statusCode).json({
      error: error?.message || 'Failed to issue external voice token',
      details: error?.details || null,
    });
  }
});

// List all voice channels
router.get('/channels', requireAuth, (req, res) => {
  const channels = VoiceChannels.list();
  const channelsWithParticipants = channels.map(channel => {
    const participants = VoiceParticipants.listByChannel(channel.id);
    return { ...channel, participants, participant_count: participants.length };
  });
  res.json(channelsWithParticipants);
});

// List ALL voice channels including inactive (admin management view)
router.get('/channels/admin', requireAuth, requireAdmin, (req, res) => {
  const channels = VoiceChannels.listAll();
  res.json(channels);
});

// Create a new voice channel (admin only)
router.post('/channels', requireAuth, requireAdmin, (req, res) => {
  const { channel_number, name, description, department_id } = req.body || {};
  const num = parseInt(channel_number, 10);
  if (!num || num < 1) {
    return res.status(400).json({ error: 'channel_number must be a positive integer' });
  }
  const trimmedName = String(name || '').trim();
  if (!trimmedName) {
    return res.status(400).json({ error: 'name is required' });
  }
  const existing = VoiceChannels.findByChannelNumber(num);
  if (existing) {
    return res.status(409).json({ error: `Channel number ${num} already exists` });
  }
  const channel = VoiceChannels.create({
    channel_number: num,
    department_id: department_id ? parseInt(department_id, 10) : null,
    name: trimmedName,
    description: String(description || '').trim(),
  });
  audit(req.user.id, 'voice_channel_create', { channel_id: channel.id, channel_number: num, name: trimmedName });
  res.status(201).json(channel);
});

// Update a voice channel name/description/active (admin only)
router.put('/channels/:id', requireAuth, requireAdmin, (req, res) => {
  const channelId = parseInt(req.params.id, 10);
  const channel = VoiceChannels.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const updates = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: 'name cannot be empty' });
    updates.name = name;
  }
  if (req.body.description !== undefined) {
    updates.description = String(req.body.description).trim();
  }
  if (req.body.is_active !== undefined) {
    updates.is_active = req.body.is_active ? 1 : 0;
  }

  VoiceChannels.update(channelId, updates);
  const updated = VoiceChannels.findById(channelId);
  audit(req.user.id, 'voice_channel_update', { channel_id: channelId, updates });
  res.json(updated);
});

// Delete (deactivate) a voice channel (admin only)
router.delete('/channels/:id', requireAuth, requireAdmin, (req, res) => {
  const channelId = parseInt(req.params.id, 10);
  const channel = VoiceChannels.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  VoiceChannels.update(channelId, { is_active: 0 });
  audit(req.user.id, 'voice_channel_delete', { channel_id: channelId, channel_number: channel.channel_number });
  res.json({ success: true });
});

// Get channel participants
router.get('/channels/:id/participants', requireAuth, (req, res) => {
  const channelId = parseInt(req.params.id, 10);
  const channel = VoiceChannels.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const participants = VoiceParticipants.listByChannel(channelId);
  res.json(participants);
});

// Join a voice channel
router.post('/channels/:id/join', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Dispatch access required' });
  }

  const behavior = String(config?.radio?.behavior || 'external');
  const bridgeEnabled = isLegacyVoiceBridgeEnabled(behavior);
  if (bridgeEnabled) {
    const bridgeStatus = getVoiceBridge().getStatus();
    if (!bridgeStatus.available) {
      return res.status(503).json({ error: 'Voice bridge is not available on this server' });
    }
  }

  const channelId = parseInt(req.params.id, 10);
  const channel = VoiceChannels.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  // Check if user has a unit on duty
  const unit = Units.findByUserId(req.user.id);

  // Dispatchers joining via CAD don't need game_id/citizen_id (they're not in-game)
  // Only in-game players will have these fields populated via FiveM bridge
  const participant = VoiceParticipants.add({
    channel_id: channelId,
    user_id: req.user.id,
    unit_id: unit?.id || null,
    citizen_id: '',
    game_id: '',
  });

  bus.emit('voice:join', {
    channelId,
    channelNumber: channel.channel_number,
    userId: req.user.id,
    unitId: unit?.id || null,
    gameId: '',
    citizenId: '',
    participant,
  });

  // Update voice bridge routing
  handleParticipantJoin(channel.channel_number);

  audit(req.user.id, 'voice_channel_joined', {
    channelId,
    channelNumber: channel.channel_number,
    channelName: channel.name,
  });

  res.json(participant);
});

// Leave a voice channel
router.post('/channels/:id/leave', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Dispatch access required' });
  }

  const channelId = parseInt(req.params.id, 10);
  const channel = VoiceChannels.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  const participant = VoiceParticipants.findByUserAndChannel(req.user.id, channelId) || null;
  VoiceParticipants.removeByUser(req.user.id, channelId);

  bus.emit('voice:leave', {
    channelId,
    channelNumber: channel.channel_number,
    userId: req.user.id,
    gameId: String(participant?.game_id || '').trim(),
    citizenId: String(participant?.citizen_id || '').trim(),
  });

  // Update voice bridge routing
  handleParticipantLeave(channel.channel_number);

  audit(req.user.id, 'voice_channel_left', {
    channelId,
    channelNumber: channel.channel_number,
    channelName: channel.name,
  });

  res.json({ ok: true });
});

// List pending 000 calls
router.get('/calls/pending', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Dispatch access required' });
  }

  const pendingCalls = VoiceCallSessions.listPending();
  res.json(pendingCalls);
});

// List active 000 calls
router.get('/calls/active', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Dispatch access required' });
  }

  const activeCalls = VoiceCallSessions.listActive();
  res.json(activeCalls);
});

// Accept a 000 call
router.post('/calls/:id/accept', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Dispatch access required' });
  }

  const callSessionId = parseInt(req.params.id, 10);
  const callSession = VoiceCallSessions.findById(callSessionId);
  if (!callSession) return res.status(404).json({ error: 'Call session not found' });
  if (callSession.status !== 'pending') {
    return res.status(400).json({ error: 'Call is no longer pending' });
  }

  VoiceCallSessions.accept(callSessionId, req.user.id);
  const updated = VoiceCallSessions.findById(callSessionId);
  const callerGameId = resolveLatestCallerGameId(updated || callSession);

  bus.emit('voice:call_accepted', {
    callSessionId,
    callId: callSession.call_id,
    callChannelNumber: callSession.call_channel_number,
    acceptedByUserId: req.user.id,
    callerCitizenId: callSession.caller_citizen_id,
    callerGameId,
    callerPhoneNumber: callSession.caller_phone_number || '',
  });

  audit(req.user.id, 'voice_call_accepted', {
    callSessionId,
    callId: callSession.call_id,
    callerName: callSession.caller_name,
  });

  res.json(updated);
});

// Decline a 000 call
router.post('/calls/:id/decline', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Dispatch access required' });
  }

  const callSessionId = parseInt(req.params.id, 10);
  const callSession = VoiceCallSessions.findById(callSessionId);
  if (!callSession) return res.status(404).json({ error: 'Call session not found' });
  if (callSession.status !== 'pending') {
    return res.status(400).json({ error: 'Call is no longer pending' });
  }

  VoiceCallSessions.decline(callSessionId);
  const callerGameId = resolveLatestCallerGameId(callSession);

  bus.emit('voice:call_declined', {
    callSessionId,
    callId: callSession.call_id,
    callChannelNumber: callSession.call_channel_number,
    callerCitizenId: callSession.caller_citizen_id,
    callerGameId,
  });

  audit(req.user.id, 'voice_call_declined', {
    callSessionId,
    callId: callSession.call_id,
    callerName: callSession.caller_name,
  });

  res.json({ ok: true });
});

// End an active 000 call
router.post('/calls/:id/end', requireAuth, (req, res) => {
  if (!req.user.is_admin && !isUserInDispatchDepartment(req.user)) {
    return res.status(403).json({ error: 'Dispatch access required' });
  }

  const callSessionId = parseInt(req.params.id, 10);
  const callSession = VoiceCallSessions.findById(callSessionId);
  if (!callSession) return res.status(404).json({ error: 'Call session not found' });

  VoiceCallSessions.end(callSessionId);
  const callerGameId = resolveLatestCallerGameId(callSession);

  bus.emit('voice:call_ended', {
    callSessionId,
    callId: callSession.call_id,
    callChannelNumber: callSession.call_channel_number,
    callerCitizenId: callSession.caller_citizen_id,
    callerGameId,
  });

  audit(req.user.id, 'voice_call_ended', {
    callSessionId,
    callId: callSession.call_id,
    callerName: callSession.caller_name,
  });

  res.json({ ok: true });
});

module.exports = router;
