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

function isWsOpen(ws) {
  return Number(ws?.readyState) === 1;
}

function decodeBase64ToBuffer(value) {
  const text = String(value || '').trim();
  if (!text) return Buffer.alloc(0);
  return Buffer.from(text, 'base64');
}

class VoiceSignalingServer {
  constructor(httpServer, voiceBridge) {
    this.voiceBridge = voiceBridge;
    this.connections = new Map(); // userId -> { ws, user }

    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
      if (request.url.startsWith('/voice-bridge')) {
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

  handleUpgrade(request, socket, head) {
    try {
      // Try to get token from URL parameter (legacy) or from cookies (current)
      const url = new URL(request.url, 'ws://localhost');
      let token = url.searchParams.get('token');

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
      }

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      let decoded = null;
      try {
        decoded = verifyToken(token);
      } catch {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      const user = Users.findById(decoded.userId);
      if (!user || user.is_banned) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      user.departments = user.is_admin ? Departments.list() : UserDepartments.getForUser(user.id);

      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request, user);
      });
    } catch (err) {
      console.error('WebSocket upgrade error:', err);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  }

  handleConnection(ws, _request, user) {
    if (this.connections.has(user.id)) {
      const oldConn = this.connections.get(user.id);
      try { oldConn.ws.close(4000, 'New connection established'); } catch {}
    }
    this.connections.set(user.id, { ws, user });

    if (isWsOpen(ws)) {
      ws.send(JSON.stringify({
        type: 'connected',
        dispatcherId: user.id,
        dispatcherName: user.steam_name,
      }));
    }

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(user, message, ws);
      } catch (error) {
        this.sendError(ws, error?.message || 'Invalid message');
      }
    });

    ws.on('close', async () => {
      await this.handleDisconnection(user);
    });

    ws.on('error', () => {
      // Connection-specific errors are handled by close/disconnect cleanup.
    });
  }

  async handleMessage(user, message, ws) {
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
        this.sendError(ws, `Unknown message type: ${type || 'empty'}`);
        break;
    }
  }

  async handleJoinChannel(user, channelNumber, ws) {
    try {
      const parsedChannelNumber = Number(channelNumber || 0);
      if (!Number.isInteger(parsedChannelNumber) || parsedChannelNumber <= 0) {
        throw new Error('Invalid channel number');
      }

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
        const channel = VoiceChannels.findByChannelNumber(parsedChannelNumber);
        if (!channel || !channel.is_active) {
          throw new Error(`Channel ${parsedChannelNumber} not found`);
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

      audit(user.id, 'voice_bridge_joined_channel', {
        channelNumber: parsedChannelNumber,
        channelName,
        isCallChannel,
      });

      if (isWsOpen(ws)) {
        ws.send(JSON.stringify({
          type: 'channel-joined',
          channelNumber: parsedChannelNumber,
          channelName,
          isCallChannel,
        }));
      }
    } catch (error) {
      this.sendError(ws, error?.message || 'Failed to join channel');
    }
  }

  async handleLeaveChannel(user, ws) {
    try {
      const channelInfo = this.voiceBridge.activeChannels.get(user.id);
      await this.voiceBridge.leaveChannel(user.id);
      this.voiceBridge.removeAudioListeners(user.id);

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
          if (channel) {
            VoiceParticipants.removeByUser(user.id, channel.id);
            bus.emit('voice:leave', {
              channelId: channel.id,
              channelNumber: chNum,
              userId: user.id,
            });
            handleParticipantLeave(chNum);
            audit(user.id, 'voice_bridge_left_channel', {
              channelNumber: chNum,
              channelName: channel.name,
            });
          }
        }
      }

      if (isWsOpen(ws)) ws.send(JSON.stringify({ type: 'channel-left' }));
    } catch (error) {
      this.sendError(ws, error?.message || 'Failed to leave channel');
    }
  }

  handleMicAudio(user, message) {
    const raw = decodeBase64ToBuffer(message?.data);
    if (!raw.length) return;
    this.voiceBridge.sendDispatcherAudio(user.id, raw);
  }

  async handleDisconnection(user) {
    try {
      await this.voiceBridge.disconnectDispatcher(user.id);
    } catch {
      // Disconnect best-effort.
    }
    this.connections.delete(user.id);
    audit(user.id, 'voice_bridge_disconnected', {});
  }

  // Auto-join dispatcher into the call's Mumble channel when they accept a 000 call.
  // The dispatcher must already have a WebSocket connection open (i.e. be in the CAD voice tab).
  async handleCallAccepted(userId, callChannelNumber, callerName, callerPhoneNumber) {
    const conn = this.connections.get(userId);
    if (!conn || !isWsOpen(conn.ws)) return; // dispatcher not connected to voice tab

    const chNum = Number(callChannelNumber || 0);
    if (!chNum || chNum < CALL_CHANNEL_THRESHOLD) return;

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

      if (isWsOpen(conn.ws)) {
        conn.ws.send(JSON.stringify({
          type: 'channel-joined',
          channelNumber: chNum,
          channelName,
          isCallChannel: true,
        }));
      }
    } catch (err) {
      console.warn('[VoiceSignaling] Failed to auto-join dispatcher into call channel:', err?.message || err);
      if (isWsOpen(conn.ws)) {
        conn.ws.send(JSON.stringify({
          type: 'error',
          error: `Could not connect to call audio: ${err?.message || 'Unknown error'}`,
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
    return {
      connectedDispatchers: this.connections.size,
      dispatchers: Array.from(this.connections.entries()).map(([userId, { user }]) => ({
        userId,
        userName: user.steam_name,
      })),
    };
  }
}

module.exports = VoiceSignalingServer;
