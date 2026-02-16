const express = require('express');
const { requireAuth } = require('../auth/middleware');
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

const router = express.Router();
const ACTIVE_LINK_MAX_AGE_MS = 5 * 60 * 1000;

// Get voice bridge status
router.get('/bridge/status', requireAuth, (req, res) => {
  try {
    const voiceBridge = getVoiceBridge();
    const status = voiceBridge.getStatus();
    res.json(status);
  } catch (error) {
    res.json({
      available: false,
      error: 'Voice bridge not initialized',
    });
  }
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

// List all voice channels
router.get('/channels', requireAuth, (req, res) => {
  const channels = VoiceChannels.list();
  const channelsWithParticipants = channels.map(channel => {
    const participants = VoiceParticipants.listByChannel(channel.id);
    return { ...channel, participants, participant_count: participants.length };
  });
  res.json(channelsWithParticipants);
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

  const bridgeStatus = getVoiceBridge().getStatus();
  if (!bridgeStatus.available) {
    return res.status(503).json({ error: 'Voice bridge is not available on this server' });
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

  bus.emit('voice:call_accepted', {
    callSessionId,
    callId: callSession.call_id,
    callChannelNumber: callSession.call_channel_number,
    acceptedByUserId: req.user.id,
    callerCitizenId: callSession.caller_citizen_id,
    callerGameId: callSession.caller_game_id,
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

  bus.emit('voice:call_declined', {
    callSessionId,
    callId: callSession.call_id,
    callChannelNumber: callSession.call_channel_number,
    callerCitizenId: callSession.caller_citizen_id,
    callerGameId: callSession.caller_game_id,
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

  bus.emit('voice:call_ended', {
    callSessionId,
    callId: callSession.call_id,
    callChannelNumber: callSession.call_channel_number,
    callerCitizenId: callSession.caller_citizen_id,
    callerGameId: callSession.caller_game_id,
  });

  audit(req.user.id, 'voice_call_ended', {
    callSessionId,
    callId: callSession.call_id,
    callerName: callSession.caller_name,
  });

  res.json({ ok: true });
});

module.exports = router;
