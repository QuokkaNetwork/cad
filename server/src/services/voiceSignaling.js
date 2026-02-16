const { Server: WebSocketServer } = require('ws');
const { verifyToken } = require('../auth/jwt');
const {
  VoiceChannels,
  VoiceParticipants,
  Users,
  Units,
  Departments,
  UserDepartments,
} = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');
const { handleParticipantJoin, handleParticipantLeave } = require('./voiceBridgeSync');

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
  }

  handleUpgrade(request, socket, head) {
    try {
      const url = new URL(request.url, 'ws://localhost');
      const token = url.searchParams.get('token');
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
    } catch {
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

      const channel = VoiceChannels.findByChannelNumber(parsedChannelNumber);
      if (!channel || !channel.is_active) {
        throw new Error(`Channel ${parsedChannelNumber} not found`);
      }

      const isDispatch = !!(user.is_admin || user.departments.some(d => d.is_dispatch));
      if (!isDispatch) {
        throw new Error('Only dispatchers can join voice channels');
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

      const unit = Units.findByUserId(user.id);
      const existingParticipant = VoiceParticipants.findByUserAndChannel(user.id, channel.id);
      if (!existingParticipant) {
        VoiceParticipants.add({
          channel_id: channel.id,
          user_id: user.id,
          unit_id: unit?.id || null,
          citizen_id: '',
          game_id: '',
        });
      }

      bus.emit('voice:join', {
        channelId: channel.id,
        channelNumber: parsedChannelNumber,
        userId: user.id,
        unitId: unit?.id || null,
      });

      // Update voice bridge routing
      handleParticipantJoin(parsedChannelNumber);

      audit(user.id, 'voice_bridge_joined_channel', {
        channelNumber: parsedChannelNumber,
        channelName: channel.name,
      });

      if (isWsOpen(ws)) {
        ws.send(JSON.stringify({
          type: 'channel-joined',
          channelNumber: parsedChannelNumber,
          channelName: channel.name,
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
        const channel = VoiceChannels.findByChannelNumber(Number(channelInfo.channelNumber));
        if (channel) {
          VoiceParticipants.removeByUser(user.id, channel.id);
          bus.emit('voice:leave', {
            channelId: channel.id,
            channelNumber: Number(channelInfo.channelNumber),
            userId: user.id,
          });

          // Update voice bridge routing
          handleParticipantLeave(Number(channelInfo.channelNumber));

          audit(user.id, 'voice_bridge_left_channel', {
            channelNumber: Number(channelInfo.channelNumber),
            channelName: channel.name,
          });
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
