const { Server: WebSocketServer } = require('ws');
const { verifyToken } = require('../auth/jwt');
const { VoiceChannels, VoiceParticipants, Users, Units } = require('../db/sqlite');
const { audit } = require('../utils/audit');
const bus = require('../utils/eventBus');

class VoiceSignalingServer {
  constructor(httpServer, voiceBridge) {
    this.voiceBridge = voiceBridge;
    this.connections = new Map(); // userId -> { ws, user }

    this.wss = new WebSocketServer({
      noServer: true, // We'll handle upgrade manually
    });

    // Handle HTTP upgrade for WebSocket
    httpServer.on('upgrade', (request, socket, head) => {
      if (request.url.startsWith('/voice-bridge')) {
        this.handleUpgrade(request, socket, head);
      }
    });

    this.wss.on('connection', (ws, request, user) => {
      this.handleConnection(ws, request, user);
    });

    console.log('[VoiceSignaling] Voice signaling server initialized');
  }

  /**
   * Handle WebSocket upgrade with authentication
   */
  handleUpgrade(request, socket, head) {
    try {
      // Parse query parameters from URL
      const url = new URL(request.url, 'ws://localhost');
      const token = url.searchParams.get('token');

      if (!token) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = verifyToken(token);
      } catch (err) {
        console.error('[VoiceSignaling] Invalid token:', err.message);
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Get user from database
      const user = Users.findById(decoded.userId);
      if (!user || user.is_banned) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      // Complete the WebSocket handshake
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request, user);
      });
    } catch (error) {
      console.error('[VoiceSignaling] Upgrade error:', error);
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
      socket.destroy();
    }
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, request, user) {
    console.log(`[VoiceSignaling] Dispatcher ${user.id} (${user.steam_name}) connected`);

    // Check if user already has a connection
    if (this.connections.has(user.id)) {
      console.log(`[VoiceSignaling] Closing previous connection for dispatcher ${user.id}`);
      const oldConn = this.connections.get(user.id);
      oldConn.ws.close(4000, 'New connection established');
    }

    // Store connection
    this.connections.set(user.id, { ws, user });

    // Send initial status
    ws.send(JSON.stringify({
      type: 'connected',
      dispatcherId: user.id,
      dispatcherName: user.steam_name,
    }));

    // Handle messages from dispatcher
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(user, message, ws);
      } catch (error) {
        console.error(`[VoiceSignaling] Error handling message from dispatcher ${user.id}:`, error);
        this.sendError(ws, error.message);
      }
    });

    // Handle disconnection
    ws.on('close', async () => {
      console.log(`[VoiceSignaling] Dispatcher ${user.id} disconnected`);
      await this.handleDisconnection(user);
    });

    ws.on('error', (error) => {
      console.error(`[VoiceSignaling] WebSocket error for dispatcher ${user.id}:`, error);
    });
  }

  /**
   * Handle messages from dispatcher
   */
  async handleMessage(user, message, ws) {
    console.log(`[VoiceSignaling] Message from dispatcher ${user.id}: ${message.type}`);

    switch (message.type) {
      case 'join-channel':
        await this.handleJoinChannel(user, message.channelNumber, ws);
        break;

      case 'leave-channel':
        await this.handleLeaveChannel(user, ws);
        break;

      case 'webrtc-offer':
        await this.handleWebRTCOffer(user, message.offer, ws);
        break;

      case 'webrtc-ice-candidate':
        await this.handleICECandidate(user, message.candidate, ws);
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      default:
        console.warn(`[VoiceSignaling] Unknown message type: ${message.type}`);
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle dispatcher joining a voice channel
   */
  async handleJoinChannel(user, channelNumber, ws) {
    try {
      console.log(`[VoiceSignaling] Dispatcher ${user.id} joining channel ${channelNumber}`);

      // Validate channel exists
      const channel = VoiceChannels.findByChannelNumber(channelNumber);
      if (!channel) {
        throw new Error(`Channel ${channelNumber} not found`);
      }

      // Check permissions (only dispatch or admin can join any channel)
      const isDispatch = user.departments.some(d =>
        d.is_dispatch || user.is_admin
      );

      if (!isDispatch) {
        throw new Error('Only dispatchers can join voice channels');
      }

      // Connect to Mumble
      await this.voiceBridge.connectDispatcherToMumble(user.id, user.steam_name);

      // Join the specific channel
      await this.voiceBridge.joinChannel(user.id, channelNumber);

      // Create WebRTC peer for audio
      const peer = this.voiceBridge.createWebRTCPeer(user.id);

      // Wait for WebRTC offer from peer
      peer.on('signal', (signal) => {
        console.log(`[VoiceSignaling] Sending WebRTC signal to dispatcher ${user.id}`);
        ws.send(JSON.stringify({
          type: 'webrtc-signal',
          signal,
        }));
      });

      // Add to participants in database
      const unit = Units.findByUserId(user.id);
      VoiceParticipants.add({
        channel_id: channel.id,
        user_id: user.id,
        unit_id: unit?.id || null,
        citizen_id: '',
        game_id: '',
      });

      // Notify via event bus
      bus.emit('voice:dispatcher_joined', {
        channelId: channel.id,
        channelNumber,
        userId: user.id,
        userName: user.steam_name,
      });

      // Audit log
      audit(user.id, 'voice_bridge_joined_channel', {
        channelNumber,
        channelName: channel.name,
      });

      // Send success response
      ws.send(JSON.stringify({
        type: 'channel-joined',
        channelNumber,
        channelName: channel.name,
      }));

      console.log(`[VoiceSignaling] Dispatcher ${user.id} successfully joined channel ${channelNumber}`);
    } catch (error) {
      console.error(`[VoiceSignaling] Error joining channel:`, error);
      this.sendError(ws, error.message);
    }
  }

  /**
   * Handle dispatcher leaving voice channel
   */
  async handleLeaveChannel(user, ws) {
    try {
      console.log(`[VoiceSignaling] Dispatcher ${user.id} leaving channel`);

      // Get current channel
      const channelInfo = this.voiceBridge.activeChannels.get(user.id);

      // Leave channel in voice bridge
      await this.voiceBridge.leaveChannel(user.id);

      // Remove from participants
      if (channelInfo) {
        const channel = VoiceChannels.findByChannelNumber(channelInfo.channelNumber);
        if (channel) {
          VoiceParticipants.removeByUser(user.id, channel.id);

          // Notify via event bus
          bus.emit('voice:dispatcher_left', {
            channelId: channel.id,
            channelNumber: channelInfo.channelNumber,
            userId: user.id,
          });

          audit(user.id, 'voice_bridge_left_channel', {
            channelNumber: channelInfo.channelNumber,
          });
        }
      }

      ws.send(JSON.stringify({
        type: 'channel-left',
      }));

      console.log(`[VoiceSignaling] Dispatcher ${user.id} successfully left channel`);
    } catch (error) {
      console.error(`[VoiceSignaling] Error leaving channel:`, error);
      this.sendError(ws, error.message);
    }
  }

  /**
   * Handle WebRTC offer from dispatcher
   */
  async handleWebRTCOffer(user, offer, ws) {
    try {
      console.log(`[VoiceSignaling] Received WebRTC offer from dispatcher ${user.id}`);

      const peer = this.voiceBridge.webrtcPeers.get(user.id);
      if (!peer) {
        throw new Error('No WebRTC peer found. Join a channel first.');
      }

      // Signal the offer to the peer
      peer.signal(offer);

      console.log(`[VoiceSignaling] WebRTC offer processed for dispatcher ${user.id}`);
    } catch (error) {
      console.error(`[VoiceSignaling] Error processing WebRTC offer:`, error);
      this.sendError(ws, error.message);
    }
  }

  /**
   * Handle ICE candidate from dispatcher
   */
  async handleICECandidate(user, candidate, ws) {
    try {
      const peer = this.voiceBridge.webrtcPeers.get(user.id);
      if (!peer) {
        console.warn(`[VoiceSignaling] No peer found for ICE candidate from dispatcher ${user.id}`);
        return;
      }

      peer.signal({ candidate });
      console.log(`[VoiceSignaling] ICE candidate processed for dispatcher ${user.id}`);
    } catch (error) {
      console.error(`[VoiceSignaling] Error processing ICE candidate:`, error);
    }
  }

  /**
   * Handle dispatcher disconnection
   */
  async handleDisconnection(user) {
    try {
      // Disconnect from voice bridge
      await this.voiceBridge.disconnectDispatcher(user.id);

      // Remove from connections
      this.connections.delete(user.id);

      // Audit log
      audit(user.id, 'voice_bridge_disconnected', {});

      console.log(`[VoiceSignaling] Dispatcher ${user.id} fully disconnected`);
    } catch (error) {
      console.error(`[VoiceSignaling] Error handling disconnection:`, error);
    }
  }

  /**
   * Send error message to dispatcher
   */
  sendError(ws, message) {
    ws.send(JSON.stringify({
      type: 'error',
      error: message,
    }));
  }

  /**
   * Broadcast message to all connected dispatchers
   */
  broadcast(message) {
    const data = JSON.stringify(message);
    for (const [userId, { ws }] of this.connections) {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Get status of signaling server
   */
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
