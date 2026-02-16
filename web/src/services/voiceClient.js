import SimplePeer from 'simple-peer';

/**
 * Voice client for web dispatchers to connect to voice bridge
 */
class DispatcherVoiceClient {
  constructor() {
    this.ws = null;
    this.peer = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentChannel = null;
    this.isConnected = false;
    this.isPTTActive = false;

    // Event callbacks
    this.onConnectionChange = null;
    this.onChannelChange = null;
    this.onError = null;
    this.onTalkingChange = null;
  }

  /**
   * Connect to voice bridge WebSocket server
   * @param {string} authToken - JWT authentication token
   * @returns {Promise<void>}
   */
  async connect(authToken) {
    if (this.isConnected) {
      console.log('[VoiceClient] Already connected');
      return;
    }

    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/voice-bridge?token=${encodeURIComponent(authToken)}`;

      console.log('[VoiceClient] Connecting to:', url);

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[VoiceClient] WebSocket connected');
        this.isConnected = true;
        if (this.onConnectionChange) {
          this.onConnectionChange(true);
        }
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('[VoiceClient] WebSocket error:', error);
        this.isConnected = false;
        if (this.onConnectionChange) {
          this.onConnectionChange(false);
        }
        if (this.onError) {
          this.onError('WebSocket connection failed');
        }
        reject(error);
      };

      this.ws.onclose = () => {
        console.log('[VoiceClient] WebSocket closed');
        this.isConnected = false;
        if (this.onConnectionChange) {
          this.onConnectionChange(false);
        }
        this.cleanup();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[VoiceClient] Error parsing message:', error);
        }
      };

      // Connection timeout
      setTimeout(() => {
        if (!this.isConnected) {
          this.ws.close();
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Join a voice channel
   * @param {number} channelNumber - Channel number to join
   * @returns {Promise<void>}
   */
  async joinChannel(channelNumber) {
    if (!this.isConnected) {
      throw new Error('Not connected to voice bridge');
    }

    if (this.currentChannel === channelNumber) {
      console.log('[VoiceClient] Already in channel', channelNumber);
      return;
    }

    console.log('[VoiceClient] Requesting microphone access...');

    // Request microphone access
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000,
        },
        video: false,
      });

      console.log('[VoiceClient] Microphone access granted');

      // Mute by default (push-to-talk)
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });

    } catch (error) {
      console.error('[VoiceClient] Microphone access denied:', error);
      if (this.onError) {
        this.onError('Microphone access denied. Please allow microphone access in your browser settings.');
      }
      throw error;
    }

    // Create WebRTC peer
    console.log('[VoiceClient] Creating WebRTC peer...');
    this.peer = new SimplePeer({
      initiator: true, // Browser initiates the connection
      stream: this.localStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
      },
      trickle: true,
    });

    // Handle WebRTC signals
    this.peer.on('signal', (signal) => {
      console.log('[VoiceClient] Sending WebRTC signal to server');
      this.send({
        type: 'webrtc-offer',
        offer: signal,
      });
    });

    // Handle incoming stream (from Mumble/in-game players)
    this.peer.on('stream', (stream) => {
      console.log('[VoiceClient] Received remote audio stream');
      this.remoteStream = stream;
      this.playRemoteAudio(stream);
    });

    // Handle connection status
    this.peer.on('connect', () => {
      console.log('[VoiceClient] WebRTC peer connected');
    });

    this.peer.on('error', (error) => {
      console.error('[VoiceClient] WebRTC error:', error);
      if (this.onError) {
        this.onError(`WebRTC error: ${error.message}`);
      }
    });

    this.peer.on('close', () => {
      console.log('[VoiceClient] WebRTC peer closed');
    });

    // Send join channel request
    console.log('[VoiceClient] Joining channel', channelNumber);
    this.send({
      type: 'join-channel',
      channelNumber,
    });
  }

  /**
   * Leave current voice channel
   * @returns {Promise<void>}
   */
  async leaveChannel() {
    if (!this.currentChannel) {
      return;
    }

    console.log('[VoiceClient] Leaving channel', this.currentChannel);

    // Stop local audio
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    // Destroy WebRTC peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    // Notify server
    this.send({
      type: 'leave-channel',
    });

    const prevChannel = this.currentChannel;
    this.currentChannel = null;

    if (this.onChannelChange) {
      this.onChannelChange(null, prevChannel);
    }
  }

  /**
   * Enable/disable push-to-talk
   * @param {boolean} enabled - Whether PTT is active
   */
  setPushToTalk(enabled) {
    if (!this.localStream) {
      console.warn('[VoiceClient] No local stream available');
      return;
    }

    console.log('[VoiceClient] Push-to-talk:', enabled ? 'ON' : 'OFF');

    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });

    this.isPTTActive = enabled;

    if (this.onTalkingChange) {
      this.onTalkingChange(enabled);
    }
  }

  /**
   * Play remote audio stream
   * @param {MediaStream} stream
   */
  playRemoteAudio(stream) {
    const audioElement = document.createElement('audio');
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    audioElement.volume = 1.0;

    audioElement.addEventListener('loadedmetadata', () => {
      console.log('[VoiceClient] Remote audio ready to play');
    });

    audioElement.addEventListener('error', (e) => {
      console.error('[VoiceClient] Audio playback error:', e);
    });

    // Keep reference to prevent garbage collection
    this._audioElement = audioElement;
  }

  /**
   * Handle incoming WebSocket messages
   * @param {object} message
   */
  handleMessage(message) {
    console.log('[VoiceClient] Received message:', message.type);

    switch (message.type) {
      case 'connected':
        console.log('[VoiceClient] Connected as dispatcher:', message.dispatcherName);
        break;

      case 'channel-joined':
        console.log('[VoiceClient] Joined channel:', message.channelNumber, message.channelName);
        const prevChannel = this.currentChannel;
        this.currentChannel = message.channelNumber;
        if (this.onChannelChange) {
          this.onChannelChange(message.channelNumber, prevChannel);
        }
        break;

      case 'channel-left':
        console.log('[VoiceClient] Left channel');
        this.currentChannel = null;
        if (this.onChannelChange) {
          this.onChannelChange(null, this.currentChannel);
        }
        break;

      case 'webrtc-signal':
        console.log('[VoiceClient] Received WebRTC signal from server');
        if (this.peer) {
          this.peer.signal(message.signal);
        }
        break;

      case 'error':
        console.error('[VoiceClient] Server error:', message.error);
        if (this.onError) {
          this.onError(message.error);
        }
        break;

      case 'pong':
        // Keepalive response
        break;

      default:
        console.warn('[VoiceClient] Unknown message type:', message.type);
    }
  }

  /**
   * Send message to server
   * @param {object} message
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[VoiceClient] Cannot send message: WebSocket not open');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send keepalive ping
   */
  ping() {
    this.send({ type: 'ping' });
  }

  /**
   * Disconnect from voice bridge
   */
  disconnect() {
    console.log('[VoiceClient] Disconnecting...');

    this.leaveChannel();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.cleanup();
  }

  /**
   * Clean up resources
   */
  cleanup() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this._audioElement) {
      this._audioElement.pause();
      this._audioElement.srcObject = null;
      this._audioElement = null;
    }

    this.remoteStream = null;
    this.currentChannel = null;
    this.isPTTActive = false;
    this.isConnected = false;
  }

  /**
   * Get current status
   * @returns {object}
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      currentChannel: this.currentChannel,
      isPTTActive: this.isPTTActive,
      hasLocalStream: !!this.localStream,
      hasRemoteStream: !!this.remoteStream,
      hasPeer: !!this.peer,
    };
  }
}

export default DispatcherVoiceClient;
