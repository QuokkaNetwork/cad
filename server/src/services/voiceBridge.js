const Mumble = require('mumble');
const SimplePeer = require('simple-peer');
const wrtc = require('wrtc');
const { PassThrough } = require('stream');

class VoiceBridgeServer {
  constructor() {
    this.mumbleClients = new Map(); // dispatcherId -> mumble connection
    this.webrtcPeers = new Map();   // dispatcherId -> webrtc peer
    this.activeChannels = new Map(); // dispatcherId -> { channelNumber, channelObj }
    this.audioStreams = new Map();   // dispatcherId -> audio stream
    this.config = {
      mumbleHost: process.env.MUMBLE_HOST || '127.0.0.1',
      mumblePort: process.env.MUMBLE_PORT || 64738,
      sampleRate: 48000,
      frameSize: 960, // 20ms at 48kHz
    };
  }

  /**
   * Connect a dispatcher to the Mumble server as a virtual client
   */
  async connectDispatcherToMumble(dispatcherId, userName = null) {
    if (this.mumbleClients.has(dispatcherId)) {
      console.log(`[VoiceBridge] Dispatcher ${dispatcherId} already connected to Mumble`);
      return this.mumbleClients.get(dispatcherId);
    }

    try {
      const username = userName || `VoiceBridge_Dispatcher${dispatcherId}`;
      const url = `mumble://${this.config.mumbleHost}:${this.config.mumblePort}`;

      console.log(`[VoiceBridge] Connecting ${username} to Mumble at ${url}...`);

      const client = await new Promise((resolve, reject) => {
        Mumble.connect(url, {
          name: username,
          rejectUnauthorized: false, // Allow self-signed certificates
        }, (error, client) => {
          if (error) {
            reject(error);
          } else {
            resolve(client);
          }
        });
      });

      console.log(`[VoiceBridge] ${username} connected to Mumble successfully`);

      // Store client
      this.mumbleClients.set(dispatcherId, client);

      // Handle disconnection
      client.on('disconnect', () => {
        console.log(`[VoiceBridge] ${username} disconnected from Mumble`);
        this.handleMumbleDisconnect(dispatcherId);
      });

      // Create audio input stream for this dispatcher
      const audioStream = new PassThrough();
      this.audioStreams.set(dispatcherId, audioStream);

      // Pipe audio stream to Mumble
      audioStream.on('data', (chunk) => {
        try {
          if (client && client.connection) {
            client.connection.sendVoice(chunk);
          }
        } catch (err) {
          console.error(`[VoiceBridge] Error sending voice for dispatcher ${dispatcherId}:`, err.message);
        }
      });

      return client;
    } catch (error) {
      console.error(`[VoiceBridge] Failed to connect dispatcher ${dispatcherId} to Mumble:`, error);
      throw error;
    }
  }

  /**
   * Move a dispatcher to a specific channel/radio frequency
   */
  async joinChannel(dispatcherId, channelNumber) {
    const client = this.mumbleClients.get(dispatcherId);
    if (!client) {
      throw new Error('Dispatcher not connected to Mumble');
    }

    try {
      // In FiveM with pma-voice, channels are numeric
      // We need to find or create the channel
      const channelName = `Channel_${channelNumber}`;

      // Get root channel
      let targetChannel = client.rootChannel;

      // Try to find existing channel
      const existingChannel = Object.values(client.channels).find(
        ch => ch.name === channelName
      );

      if (existingChannel) {
        targetChannel = existingChannel;
      } else {
        // FiveM manages channels automatically, so if it doesn't exist yet,
        // we'll use root channel and rely on pma-voice to handle the channel setup
        console.log(`[VoiceBridge] Channel ${channelName} not found, using root channel`);
      }

      // Move to channel
      client.user.moveToChannel(targetChannel);

      this.activeChannels.set(dispatcherId, {
        channelNumber,
        channelObj: targetChannel,
      });

      console.log(`[VoiceBridge] Dispatcher ${dispatcherId} moved to channel ${channelNumber}`);
    } catch (error) {
      console.error(`[VoiceBridge] Failed to join channel ${channelNumber}:`, error);
      throw error;
    }
  }

  /**
   * Remove a dispatcher from their current channel
   */
  async leaveChannel(dispatcherId) {
    const client = this.mumbleClients.get(dispatcherId);
    if (!client) {
      return;
    }

    try {
      // Move back to root channel
      client.user.moveToChannel(client.rootChannel);
      this.activeChannels.delete(dispatcherId);
      console.log(`[VoiceBridge] Dispatcher ${dispatcherId} left channel`);
    } catch (error) {
      console.error(`[VoiceBridge] Error leaving channel for dispatcher ${dispatcherId}:`, error);
    }
  }

  /**
   * Create a WebRTC peer connection for browser audio
   */
  createWebRTCPeer(dispatcherId) {
    if (this.webrtcPeers.has(dispatcherId)) {
      console.log(`[VoiceBridge] WebRTC peer already exists for dispatcher ${dispatcherId}`);
      return this.webrtcPeers.get(dispatcherId);
    }

    console.log(`[VoiceBridge] Creating WebRTC peer for dispatcher ${dispatcherId}`);

    const peer = new SimplePeer({
      initiator: false, // Server receives connection from browser
      wrtc: wrtc,
      trickle: true,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });

    // Handle incoming audio stream from browser
    peer.on('stream', (stream) => {
      console.log(`[VoiceBridge] Received audio stream from dispatcher ${dispatcherId}`);
      this.handleBrowserAudioStream(dispatcherId, stream);
    });

    peer.on('error', (err) => {
      console.error(`[VoiceBridge] WebRTC error for dispatcher ${dispatcherId}:`, err.message);
    });

    peer.on('close', () => {
      console.log(`[VoiceBridge] WebRTC peer closed for dispatcher ${dispatcherId}`);
      this.webrtcPeers.delete(dispatcherId);
    });

    this.webrtcPeers.set(dispatcherId, peer);
    return peer;
  }

  /**
   * Process audio from browser and send to Mumble
   */
  handleBrowserAudioStream(dispatcherId, stream) {
    const audioStream = this.audioStreams.get(dispatcherId);
    if (!audioStream) {
      console.error(`[VoiceBridge] No audio stream found for dispatcher ${dispatcherId}`);
      return;
    }

    console.log(`[VoiceBridge] Setting up audio pipeline for dispatcher ${dispatcherId}`);

    // Get audio track from stream
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.error(`[VoiceBridge] No audio tracks in stream for dispatcher ${dispatcherId}`);
      return;
    }

    const audioTrack = audioTracks[0];
    console.log(`[VoiceBridge] Audio track settings:`, audioTrack.getSettings());

    // Create a MediaStreamAudioSourceNode using Web Audio API
    // Note: This is a simplified version. In production, you'd need proper audio processing
    // to convert WebRTC audio to Opus-encoded packets for Mumble.

    // For now, we'll handle the raw audio data
    // In a full implementation, you would:
    // 1. Use Web Audio API to process the stream
    // 2. Encode to Opus using node-opus
    // 3. Send Opus packets to Mumble

    console.log(`[VoiceBridge] Audio pipeline ready for dispatcher ${dispatcherId}`);
  }

  /**
   * Handle Mumble client disconnection
   */
  handleMumbleDisconnect(dispatcherId) {
    this.mumbleClients.delete(dispatcherId);
    this.activeChannels.delete(dispatcherId);
    this.audioStreams.delete(dispatcherId);
    console.log(`[VoiceBridge] Cleaned up Mumble resources for dispatcher ${dispatcherId}`);
  }

  /**
   * Disconnect a dispatcher completely
   */
  async disconnectDispatcher(dispatcherId) {
    console.log(`[VoiceBridge] Disconnecting dispatcher ${dispatcherId}`);

    // Close WebRTC peer
    const peer = this.webrtcPeers.get(dispatcherId);
    if (peer) {
      peer.destroy();
      this.webrtcPeers.delete(dispatcherId);
    }

    // Disconnect from Mumble
    const client = this.mumbleClients.get(dispatcherId);
    if (client) {
      try {
        client.disconnect();
      } catch (err) {
        console.error(`[VoiceBridge] Error disconnecting Mumble client:`, err);
      }
      this.mumbleClients.delete(dispatcherId);
    }

    // Clean up streams
    const audioStream = this.audioStreams.get(dispatcherId);
    if (audioStream) {
      audioStream.end();
      this.audioStreams.delete(dispatcherId);
    }

    this.activeChannels.delete(dispatcherId);
    console.log(`[VoiceBridge] Dispatcher ${dispatcherId} fully disconnected`);
  }

  /**
   * Get status of all connected dispatchers
   */
  getStatus() {
    return {
      connectedDispatchers: this.mumbleClients.size,
      activeWebRTCPeers: this.webrtcPeers.size,
      dispatchers: Array.from(this.mumbleClients.keys()).map(id => ({
        dispatcherId: id,
        hasWebRTC: this.webrtcPeers.has(id),
        channel: this.activeChannels.get(id)?.channelNumber || null,
      })),
    };
  }
}

// Singleton instance
let voiceBridgeInstance = null;

function getVoiceBridge() {
  if (!voiceBridgeInstance) {
    voiceBridgeInstance = new VoiceBridgeServer();
  }
  return voiceBridgeInstance;
}

module.exports = { VoiceBridgeServer, getVoiceBridge };
