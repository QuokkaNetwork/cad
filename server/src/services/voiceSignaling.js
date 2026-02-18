const { Server: WebSocketServer } = require('ws');
const { verifyToken } = require('../auth/jwt');
const config = require('../config');
const {
  VoiceChannels,
  VoiceParticipants,
  VoiceCallSessions,
  Users,
  Units,
  Departments,
  UserDepartments,
} = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const { handleParticipantJoin, handleParticipantLeave } = require('./voiceBridgeSync');

// Call channel numbers are 10000 + call.id — above this threshold means it's a 000 call
const CALL_CHANNEL_THRESHOLD = 10000;
const SIGNALING_DIAG_LOG_INTERVAL_MS = Math.max(
  5_000,
  Number.parseInt(process.env.VOICE_SIGNALING_LOG_INTERVAL_MS || '15000', 10) || 15_000
);

function isWsOpen(ws) {
  return Number(ws?.readyState) === 1;
}

function decodeBase64ToBuffer(value) {
  const text = String(value || '').trim();
  if (!text) return Buffer.alloc(0);
  return Buffer.from(text, 'base64');
}

function toSafeErrorMessage(error) {
  const text = String(error?.message || error || '').trim();
  return text || 'Unknown error';
}

function formatIso(ms) {
  if (!ms) return 'never';
  try {
    return new Date(ms).toISOString();
  } catch {
    return 'invalid';
  }
}

function getRemoteAddress(request) {
  const forwarded = String(request?.headers?.['x-forwarded-for'] || '')
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
  if (forwarded.length > 0) return forwarded[0];
  return String(
    request?.socket?.remoteAddress
    || request?.connection?.remoteAddress
    || 'unknown'
  );
}

class VoiceSignalingServer {
  constructor(httpServer, voiceBridge) {
    this.voiceBridge = voiceBridge;
    this.connections = new Map(); // userId -> { ws, user }
    this.connectionStats = new Map(); // userId -> diagnostics counters

    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
      if (String(request.url || '').startsWith('/voice-bridge')) {
        this.handleUpgrade(request, socket, head);
      }
    });

    this.wss.on('connection', (ws, request, user) => {
      this.handleConnection(ws, request, user);
    });

    // When a dispatcher accepts a 000 call, auto-join them into the call's Mumble channel
    bus.on('voice:call_accepted', ({ callChannelNumber, acceptedByUserId, callerName, callerPhoneNumber }) => {
      this.handleCallAccepted(acceptedByUserId, callChannelNumber, callerName, callerPhoneNumber);
    });
  }

  getOrCreateConnectionStats(userId, userName = '') {
    let stats = this.connectionStats.get(userId);
    if (stats) return stats;

    stats = {
      userId,
      userName: String(userName || ''),
      remoteAddress: '',
      connected: false,
      connectedAtMs: 0,
      lastSeenAtMs: 0,
      lastConnectedAtMs: 0,
      lastDisconnectedAtMs: 0,
      connectionCount: 0,
      disconnectionCount: 0,
      closeCode: null,
      closeReason: '',
      channelNumber: null,
      channelName: '',
      joinCount: 0,
      leaveCount: 0,
      micPackets: 0,
      micBytes: 0,
      micForwardFailures: 0,
      lastMicAtMs: 0,
      lastError: '',
      lastLogAtMs: 0,
    };
    this.connectionStats.set(userId, stats);
    return stats;
  }

  logConnectionDiagnostics(userId, reason = 'periodic') {
    const stats = this.connectionStats.get(userId);
    if (!stats) return;

    const now = Date.now();
    if (reason === 'periodic' && (now - Number(stats.lastLogAtMs || 0)) < SIGNALING_DIAG_LOG_INTERVAL_MS) {
      return;
    }
    stats.lastLogAtMs = now;

    console.log(
      `[VoiceSignaling][Diag] user=${userId} reason=${reason} connected=${stats.connected ? 'yes' : 'no'} ` +
      `channel=${stats.channelNumber || 'none'} joins=${stats.joinCount} leaves=${stats.leaveCount} ` +
      `micPackets=${stats.micPackets} micBytes=${stats.micBytes} micFailures=${stats.micForwardFailures} ` +
      `lastMic=${formatIso(stats.lastMicAtMs)} lastSeen=${formatIso(stats.lastSeenAtMs)} ` +
      `lastError=${stats.lastError || 'none'}`
    );
  }

  handleUpgrade(request, socket, head) {
    const remote = getRemoteAddress(request);
    try {
      // Try to get token from URL parameter (legacy) or from cookies (current)
      const url = new URL(request.url, 'ws://localhost');
      let token = url.searchParams.get('token');
      let authSource = 'query';

      // If no URL token or empty, try to parse from cookies
      if (!token || token === '') {
        const cookieHeader = request.headers.cookie || '';
        const cookies = {};
        cookieHeader.split(';').forEach(cookie => {
          const [name, ...rest] = cookie.split('=');
          const trimmedName = name?.trim();
          if (trimmedName) {
            cookies[trimmedName] = rest.join('=').trim();
          }
        });
        token = cookies[config.auth.cookieName] || '';
        authSource = 'cookie';
      }

      if (!token) {
        console.warn(`[VoiceSignaling] Rejecting upgrade from ${remote}: missing auth token`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      let decoded = null;
      try {
        decoded = verifyToken(token);
      } catch {
        console.warn(`[VoiceSignaling] Rejecting upgrade from ${remote}: invalid auth token`);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const user = Users.findById(decoded.userId);
      if (!user || user.is_banned) {
        console.warn(
          `[VoiceSignaling] Rejecting upgrade from ${remote}: forbidden user ${decoded.userId || 'unknown'}`
        );
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      user.departments = user.is_admin ? Departments.list() : UserDepartments.getForUser(user.id);
      console.log(
        `[VoiceSignaling] Upgrade accepted for user ${user.id} (${user.steam_name || 'unknown'}) ` +
        `from ${remote} via ${authSource}`
      );

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request, user);
      });
    } catch (err) {
      console.error(`[VoiceSignaling] WebSocket upgrade error from ${remote}:`, err);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  }

  handleConnection(ws, request, user) {
    const stats = this.getOrCreateConnectionStats(user.id, user.steam_name);
    stats.userName = String(user.steam_name || stats.userName || '');
    stats.remoteAddress = getRemoteAddress(request);
    stats.connected = true;
    stats.connectedAtMs = stats.connectedAtMs || Date.now();
    stats.lastConnectedAtMs = Date.now();
    stats.lastSeenAtMs = Date.now();
    stats.connectionCount += 1;
    stats.lastError = '';

    if (this.connections.has(user.id)) {
      const oldConn = this.connections.get(user.id);
      console.warn(`[VoiceSignaling] Replacing existing connection for user ${user.id}`);
      try { oldConn.ws.close(4000, 'New connection established'); } catch {}
    }
    this.connections.set(user.id, { ws, user });
    console.log(
      `[VoiceSignaling] User ${user.id} (${user.steam_name || 'unknown'}) connected from ${stats.remoteAddress}`
    );

    if (isWsOpen(ws)) {
      ws.send(JSON.stringify({
        type: 'connected',
        dispatcherId: user.id,
        dispatcherName: user.steam_name,
      }));
    }

    ws.on('message', async (data) => {
      stats.lastSeenAtMs = Date.now();
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(user, message, ws);
      } catch (error) {
        const message = toSafeErrorMessage(error);
        stats.lastError = message;
        console.warn(`[VoiceSignaling] Invalid message from user ${user.id}: ${message}`);
        this.sendError(ws, message || 'Invalid message');
      }
    });

    ws.on('close', async (code, reasonBuffer) => {
      const closeReason = Buffer.isBuffer(reasonBuffer)
        ? reasonBuffer.toString('utf8')
        : String(reasonBuffer || '');
      await this.handleDisconnection(user, code, closeReason);
    });

    ws.on('error', (error) => {
      const message = toSafeErrorMessage(error);
      stats.lastError = message;
      console.warn(`[VoiceSignaling] WebSocket error for user ${user.id}: ${message}`);
      this.logConnectionDiagnostics(user.id, 'ws_error');
    });
  }

  async handleMessage(user, message, ws) {
    const stats = this.getOrCreateConnectionStats(user.id, user.steam_name);
    stats.lastSeenAtMs = Date.now();
    const type = String(message?.type || '').trim().toLowerCase();
    switch (type) {
      case 'join-channel':
        await this.handleJoinChannel(user, Number(message?.channelNumber || 0), ws);
        break;
      case 'leave-channel':
        await this.handleLeaveChannel(user, ws);
        break;
      case 'mic-audio':
        this.handleMicAudio(user, message);
        break;
      case 'ping':
        if (isWsOpen(ws)) ws.send(JSON.stringify({ type: 'pong' }));
        break;
      default:
        stats.lastError = `Unknown message type: ${type || 'empty'}`;
        this.sendError(ws, `Unknown message type: ${type || 'empty'}`);
        break;
    }
  }

  clearUserVoiceParticipants(userId) {
    const removed = VoiceParticipants.listByUser(userId);
    if (!Array.isArray(removed) || removed.length === 0) return [];

    const affectedChannels = new Set();
    for (const participant of removed) {
      VoiceParticipants.remove(participant.id);
      const channelId = Number(participant.channel_id || 0);
      const channelNumber = Number(participant.channel_number || 0);
      bus.emit('voice:leave', {
        channelId: channelId || null,
        channelNumber: channelNumber || 0,
        userId,
      });
      if (channelNumber > 0) {
        affectedChannels.add(channelNumber);
      }
    }

    for (const channelNumber of affectedChannels) {
      handleParticipantLeave(channelNumber);
    }

    return removed;
  }

  async handleJoinChannel(user, channelNumber, ws) {
    const stats = this.getOrCreateConnectionStats(user.id, user.steam_name);
    try {
      const parsedChannelNumber = Number(channelNumber || 0);
      if (!Number.isInteger(parsedChannelNumber) || parsedChannelNumber <= 0) {
        throw new Error('Invalid channel number');
      }
      console.log(`[VoiceSignaling] User ${user.id} requested join channel ${parsedChannelNumber}`);

      const isDispatch = !!(user.is_admin || user.departments.some(d => d.is_dispatch));
      if (!isDispatch) {
        throw new Error('Only dispatchers can join voice channels');
      }

      // Call channels (10000+) are 000 phone call sessions, not radio channels
      const isCallChannel = parsedChannelNumber >= CALL_CHANNEL_THRESHOLD;

      let channelName;
      let channelId = null;

      if (isCallChannel) {
        const callSession = VoiceCallSessions.findByChannelNumber(parsedChannelNumber);
        if (!callSession) {
          throw new Error(`Call channel ${parsedChannelNumber} not found`);
        }
        if (callSession.status === 'ended' || callSession.status === 'declined') {
          throw new Error('This call has already ended');
        }
        channelName = `000 Call - ${callSession.caller_name || callSession.caller_phone_number || 'Unknown'}`;
      } else {
        let channel = VoiceChannels.findByChannelNumber(parsedChannelNumber);
        if (!channel) {
          // Auto-create channel so dispatcher can join even if no heartbeat has
          // reported it yet (e.g. dispatcher joins before any in-game players).
          try {
            channel = VoiceChannels.create({
              channel_number: parsedChannelNumber,
              department_id: null,
              name: `Channel ${parsedChannelNumber}`,
              description: `Radio channel ${parsedChannelNumber} (auto-created)`,
            });
          } catch {
            channel = VoiceChannels.findByChannelNumber(parsedChannelNumber);
          }
        }
        if (!channel) {
          throw new Error(`Channel ${parsedChannelNumber} not found`);
        }
        // Reactivate channel if it was marked inactive
        if (!channel.is_active) {
          VoiceChannels.update(channel.id, { is_active: 1 });
          channel = VoiceChannels.findByChannelNumber(parsedChannelNumber) || channel;
        }
        channelName = channel.name;
        channelId = channel.id;
      }

      await this.voiceBridge.connectDispatcherToMumble(user.id, user.steam_name);
      await this.voiceBridge.joinChannel(user.id, parsedChannelNumber);

      this.voiceBridge.removeAudioListeners(user.id);
      this.voiceBridge.addAudioListener(user.id, ({ pcm, sampleRate, channels, bitsPerSample }) => {
        if (!isWsOpen(ws)) return;
        ws.send(JSON.stringify({
          type: 'mumble-audio',
          sampleRate,
          channels,
          bitsPerSample,
          data: Buffer.from(pcm).toString('base64'),
        }));
      });

      // Keep one authoritative dispatcher participant row at most.
      // This prevents stale rows when switching channels or auto-joining calls.
      this.clearUserVoiceParticipants(user.id);

      if (!isCallChannel && channelId) {
        const unit = Units.findByUserId(user.id);
        const existingParticipant = VoiceParticipants.findByUserAndChannel(user.id, channelId);
        if (!existingParticipant) {
          VoiceParticipants.add({
            channel_id: channelId,
            user_id: user.id,
            unit_id: unit?.id || null,
            citizen_id: '',
            game_id: '',
          });
        }

        bus.emit('voice:join', {
          channelId,
          channelNumber: parsedChannelNumber,
          userId: user.id,
          unitId: unit?.id || null,
        });

        handleParticipantJoin(parsedChannelNumber);
      }

      const routeSnapshot = this.voiceBridge?.getDispatcherRouteSnapshot?.(user.id);
      if (routeSnapshot) {
        const routePreview = Array.isArray(routeSnapshot.routeMembers)
          ? routeSnapshot.routeMembers.slice(0, 10).join(',')
          : '';
        const routeSuffix = Number(routeSnapshot.routeMemberCount || 0) > 10 ? ',...' : '';
        console.log(
          `[VoiceSignaling] Join verification user=${user.id} channel=${parsedChannelNumber} ` +
          `bridgeConnected=${routeSnapshot.connected ? 'yes' : 'no'} ` +
          `session=${routeSnapshot.session || 'n/a'} ` +
          `routeMembers=${Number(routeSnapshot.routeMemberCount || 0)}` +
          `${routePreview ? ` ids=${routePreview}${routeSuffix}` : ''}`
        );
      }

      audit(user.id, 'voice_bridge_joined_channel', {
        channelNumber: parsedChannelNumber,
        channelName,
        isCallChannel,
      });
      stats.channelNumber = parsedChannelNumber;
      stats.channelName = String(channelName || '');
      stats.joinCount += 1;
      stats.lastSeenAtMs = Date.now();
      stats.lastError = '';
      this.logConnectionDiagnostics(user.id, 'joined_channel');

      if (isWsOpen(ws)) {
        ws.send(JSON.stringify({
          type: 'channel-joined',
          channelNumber: parsedChannelNumber,
          channelName,
          isCallChannel,
        }));
      }
    } catch (error) {
      const message = toSafeErrorMessage(error);
      stats.lastError = message;
      console.warn(`[VoiceSignaling] User ${user.id} failed to join channel ${channelNumber}: ${message}`);
      this.logConnectionDiagnostics(user.id, 'join_failed');
      this.sendError(ws, message || 'Failed to join channel');
    }
  }

  async handleLeaveChannel(user, ws) {
    const stats = this.getOrCreateConnectionStats(user.id, user.steam_name);
    try {
      const channelInfo = this.voiceBridge.activeChannels.get(user.id);
      await this.voiceBridge.leaveChannel(user.id);
      this.voiceBridge.removeAudioListeners(user.id);
      this.clearUserVoiceParticipants(user.id);

      if (channelInfo?.channelNumber) {
        const chNum = Number(channelInfo.channelNumber);
        const isCallChannel = chNum >= CALL_CHANNEL_THRESHOLD;

        if (isCallChannel) {
          audit(user.id, 'voice_bridge_left_channel', {
            channelNumber: chNum,
            channelName: channelInfo.channelName || `Call ${chNum}`,
            isCallChannel: true,
          });
        } else {
          const channel = VoiceChannels.findByChannelNumber(chNum);
          audit(user.id, 'voice_bridge_left_channel', {
            channelNumber: chNum,
            channelName: channel?.name || channelInfo.channelName || `Channel ${chNum}`,
          });
        }
      }

      stats.channelNumber = null;
      stats.channelName = '';
      stats.leaveCount += 1;
      stats.lastSeenAtMs = Date.now();
      stats.lastError = '';
      this.logConnectionDiagnostics(user.id, 'left_channel');

      if (isWsOpen(ws)) ws.send(JSON.stringify({ type: 'channel-left' }));
    } catch (error) {
      const message = toSafeErrorMessage(error);
      stats.lastError = message;
      console.warn(`[VoiceSignaling] User ${user.id} failed to leave channel: ${message}`);
      this.logConnectionDiagnostics(user.id, 'leave_failed');
      this.sendError(ws, message || 'Failed to leave channel');
    }
  }

  handleMicAudio(user, message) {
    const stats = this.getOrCreateConnectionStats(user.id, user.steam_name);
    const raw = decodeBase64ToBuffer(message?.data);
    if (!raw.length) return;
    stats.micPackets += 1;
    stats.micBytes += raw.length;
    stats.lastMicAtMs = Date.now();
    stats.lastSeenAtMs = Date.now();

    const forwarded = this.voiceBridge.sendDispatcherAudio(user.id, raw);
    if (!forwarded) {
      stats.micForwardFailures += 1;
      if (stats.micForwardFailures <= 5 || stats.micForwardFailures % 50 === 0) {
        console.warn(
          `[VoiceSignaling] Mic audio from user ${user.id} was not forwarded ` +
          `(failures=${stats.micForwardFailures})`
        );
      }
    }

    if (stats.micPackets % 250 === 0) {
      this.logConnectionDiagnostics(user.id, 'periodic');
    }
  }

  async handleDisconnection(user, closeCode = null, closeReason = '') {
    const stats = this.getOrCreateConnectionStats(user.id, user.steam_name);
    try {
      await this.voiceBridge.disconnectDispatcher(user.id);
    } catch {
      // Disconnect best-effort.
    }
    this.clearUserVoiceParticipants(user.id);
    this.connections.delete(user.id);
    stats.connected = false;
    stats.disconnectionCount += 1;
    stats.lastDisconnectedAtMs = Date.now();
    stats.closeCode = Number(closeCode || 0) || null;
    stats.closeReason = String(closeReason || '').trim();
    this.logConnectionDiagnostics(user.id, 'disconnect');
    console.log(
      `[VoiceSignaling] User ${user.id} disconnected ` +
      `(code=${stats.closeCode || 'n/a'}, reason=${stats.closeReason || 'none'})`
    );
    audit(user.id, 'voice_bridge_disconnected', {});
  }

  // Auto-join dispatcher into the call's Mumble channel when they accept a 000 call.
  // The dispatcher must already have a WebSocket connection open (i.e. be in the CAD voice tab).
  async handleCallAccepted(userId, callChannelNumber, callerName, callerPhoneNumber) {
    const conn = this.connections.get(userId);
    if (!conn || !isWsOpen(conn.ws)) {
      console.warn(
        `[VoiceSignaling] Skipping auto-join for user ${userId}: no active websocket connection`
      );
      return; // dispatcher not connected to voice tab
    }
    const stats = this.getOrCreateConnectionStats(userId, conn.user?.steam_name || '');

    const chNum = Number(callChannelNumber || 0);
    if (!chNum || chNum < CALL_CHANNEL_THRESHOLD) return;
    console.log(`[VoiceSignaling] Auto-joining user ${userId} into call channel ${chNum}`);

    try {
      await this.voiceBridge.connectDispatcherToMumble(userId, conn.user.steam_name);
      await this.voiceBridge.joinChannel(userId, chNum);

      this.voiceBridge.removeAudioListeners(userId);
      this.voiceBridge.addAudioListener(userId, ({ pcm, sampleRate, channels, bitsPerSample }) => {
        if (!isWsOpen(conn.ws)) return;
        conn.ws.send(JSON.stringify({
          type: 'mumble-audio',
          sampleRate,
          channels,
          bitsPerSample,
          data: Buffer.from(pcm).toString('base64'),
        }));
      });

      const channelName = `000 Call - ${callerName || callerPhoneNumber || 'Unknown'}`;
      audit(userId, 'voice_bridge_joined_call_channel', { channelNumber: chNum, channelName });
      stats.channelNumber = chNum;
      stats.channelName = channelName;
      stats.joinCount += 1;
      stats.lastSeenAtMs = Date.now();
      stats.lastError = '';
      this.logConnectionDiagnostics(userId, 'auto_join_call');

      if (isWsOpen(conn.ws)) {
        conn.ws.send(JSON.stringify({
          type: 'channel-joined',
          channelNumber: chNum,
          channelName,
          isCallChannel: true,
        }));
      }
    } catch (err) {
      const message = toSafeErrorMessage(err);
      stats.lastError = message;
      console.warn(`[VoiceSignaling] Failed to auto-join user ${userId} into call channel ${chNum}: ${message}`);
      this.logConnectionDiagnostics(userId, 'auto_join_failed');
      if (isWsOpen(conn.ws)) {
        conn.ws.send(JSON.stringify({
          type: 'error',
          error: `Could not connect to call audio: ${message || 'Unknown error'}`,
        }));
      }
    }
  }

  sendError(ws, message) {
    if (!isWsOpen(ws)) return;
    ws.send(JSON.stringify({
      type: 'error',
      error: String(message || 'Unknown error'),
    }));
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const entry of this.connections.values()) {
      if (isWsOpen(entry.ws)) {
        entry.ws.send(data);
      }
    }
  }

  getStatus() {
    const connected = Array.from(this.connections.entries()).map(([userId, { user }]) => {
      const stats = this.connectionStats.get(userId) || {};
      return {
        userId,
        userName: user.steam_name,
        remoteAddress: stats.remoteAddress || '',
        channelNumber: stats.channelNumber || null,
        channelName: stats.channelName || '',
        micPackets: Number(stats.micPackets || 0),
        micBytes: Number(stats.micBytes || 0),
        micForwardFailures: Number(stats.micForwardFailures || 0),
        lastMicAt: formatIso(stats.lastMicAtMs),
        lastSeenAt: formatIso(stats.lastSeenAtMs),
        lastError: stats.lastError || '',
      };
    });

    const recentDisconnected = Array.from(this.connectionStats.entries())
      .filter(([userId]) => !this.connections.has(userId))
      .sort((a, b) => Number(b[1]?.lastDisconnectedAtMs || 0) - Number(a[1]?.lastDisconnectedAtMs || 0))
      .slice(0, 10)
      .map(([userId, stats]) => ({
        userId,
        userName: stats.userName || '',
        remoteAddress: stats.remoteAddress || '',
        closeCode: stats.closeCode,
        closeReason: stats.closeReason || '',
        lastConnectedAt: formatIso(stats.lastConnectedAtMs),
        lastDisconnectedAt: formatIso(stats.lastDisconnectedAtMs),
        micPackets: Number(stats.micPackets || 0),
        micForwardFailures: Number(stats.micForwardFailures || 0),
        lastError: stats.lastError || '',
      }));

    return {
      connectedDispatchers: this.connections.size,
      dispatchers: connected,
      recentDisconnected,
    };
  }
}

module.exports = VoiceSignalingServer;
