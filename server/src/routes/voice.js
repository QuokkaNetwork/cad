const express = require('express');
const { requireAuth } = require('../auth/middleware');
const { VoiceChannels, VoiceParticipants, VoiceCallSessions, Departments, Units, Users } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const { getVoiceBridge } = require('../services/voiceBridge');

const router = express.Router();

// Get voice bridge status
router.get('/bridge/status', requireAuth, (req, res) => {
  try {
    const voiceBridge = getVoiceBridge();
    const status = voiceBridge.getStatus();
    res.json({
      available: true,
      ...status,
    });
  } catch (error) {
    res.json({
      available: false,
      error: 'Voice bridge not initialized',
    });
  }
});

function isUserInDispatchDepartment(user) {
  const dispatchDepts = Departments.list().filter(d => d.is_dispatch);
  if (!dispatchDepts.length) return false;
  const dispatchIds = dispatchDepts.map(d => d.id);
  return user.departments.some(d => dispatchIds.includes(d.id));
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
  const channelId = parseInt(req.params.id, 10);
  const channel = VoiceChannels.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  // Check if user has a unit on duty
  const unit = Units.findByUserId(req.user.id);

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
    participant,
  });

  audit(req.user.id, 'voice_channel_joined', {
    channelId,
    channelNumber: channel.channel_number,
    channelName: channel.name,
  });

  res.json(participant);
});

// Leave a voice channel
router.post('/channels/:id/leave', requireAuth, (req, res) => {
  const channelId = parseInt(req.params.id, 10);
  const channel = VoiceChannels.findById(channelId);
  if (!channel) return res.status(404).json({ error: 'Channel not found' });

  VoiceParticipants.removeByUser(req.user.id, channelId);

  bus.emit('voice:leave', {
    channelId,
    channelNumber: channel.channel_number,
    userId: req.user.id,
  });

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
