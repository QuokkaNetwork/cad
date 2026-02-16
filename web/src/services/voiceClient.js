function decodeBase64ToInt16(data) {
  const raw = atob(String(data || ''));
  const length = raw.length;
  if (!length || length % 2 !== 0) return null;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i += 1) {
    bytes[i] = raw.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

function int16ToBase64(samples) {
  if (!samples || !samples.length) return '';
  const bytes = new Uint8Array(samples.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

class DispatcherVoiceClient {
  constructor() {
    this.ws = null;
    this.localStream = null;
    this.localMicSource = null;
    this.localMicProcessor = null;
    this.localMicSink = null;
    this.audioContext = null;
    this.playbackCursor = 0;
    this.currentChannel = null;
    this.isConnected = false;
    this.isPTTActive = false;

    this.onConnectionChange = null;
    this.onChannelChange = null;
    this.onError = null;
    this.onTalkingChange = null;
  }

  async connect(authToken) {
    if (this.isConnected) return;
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/voice-bridge?token=${encodeURIComponent(authToken)}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        if (this.onConnectionChange) this.onConnectionChange(true);
        resolve();
      };

      this.ws.onerror = (error) => {
        this.isConnected = false;
        if (this.onConnectionChange) this.onConnectionChange(false);
        if (this.onError) this.onError('WebSocket connection failed');
        reject(error);
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        if (this.onConnectionChange) this.onConnectionChange(false);
        this.cleanup();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch {
          // Ignore malformed payloads from server.
        }
      };

      setTimeout(() => {
        if (!this.isConnected && this.ws) {
          this.ws.close();
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  async ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 48000,
      });
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
    return this.audioContext;
  }

  async ensureMicrophonePipeline() {
    if (this.localMicProcessor) return;
    await this.ensureAudioContext();

    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      },
      video: false,
    });

    this.localMicSource = this.audioContext.createMediaStreamSource(this.localStream);
    this.localMicProcessor = this.audioContext.createScriptProcessor(2048, 1, 1);
    this.localMicSink = this.audioContext.createGain();
    this.localMicSink.gain.value = 0;

    this.localMicProcessor.onaudioprocess = (event) => {
      if (!this.isPTTActive || !this.currentChannel) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        pcm[i] = sample < 0 ? sample * 32768 : sample * 32767;
      }
      this.send({
        type: 'mic-audio',
        data: int16ToBase64(pcm),
      });
    };

    this.localMicSource.connect(this.localMicProcessor);
    this.localMicProcessor.connect(this.localMicSink);
    this.localMicSink.connect(this.audioContext.destination);
  }

  async joinChannel(channelNumber) {
    if (!this.isConnected) throw new Error('Not connected to voice bridge');
    if (this.currentChannel === channelNumber) return;

    await this.ensureAudioContext();
    try {
      await this.ensureMicrophonePipeline();
    } catch {
      if (this.onError) {
        this.onError('Microphone access denied. Listening still works, but transmit is disabled.');
      }
    }

    this.send({
      type: 'join-channel',
      channelNumber,
    });
  }

  async leaveChannel() {
    if (!this.currentChannel) return;
    this.send({ type: 'leave-channel' });
    const prev = this.currentChannel;
    this.currentChannel = null;
    this.isPTTActive = false;
    if (this.onChannelChange) this.onChannelChange(null, prev);
    if (this.onTalkingChange) this.onTalkingChange(false);
  }

  setPushToTalk(enabled) {
    this.isPTTActive = !!enabled && !!this.currentChannel;
    if (this.onTalkingChange) this.onTalkingChange(this.isPTTActive);
  }

  async playPcmChunk(base64Data, sampleRate = 48000) {
    const pcm = decodeBase64ToInt16(base64Data);
    if (!pcm || pcm.length === 0) return;

    await this.ensureAudioContext();
    const float32 = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i += 1) {
      float32[i] = pcm[i] / 32768;
    }

    const buffer = this.audioContext.createBuffer(1, float32.length, Number(sampleRate) || 48000);
    buffer.copyToChannel(float32, 0);

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);

    const now = this.audioContext.currentTime + 0.01;
    const startAt = Math.max(now, this.playbackCursor || 0);
    source.start(startAt);
    this.playbackCursor = startAt + buffer.duration;
  }

  handleMessage(message) {
    const type = String(message?.type || '').trim().toLowerCase();
    switch (type) {
      case 'connected':
        break;
      case 'channel-joined': {
        const prev = this.currentChannel;
        this.currentChannel = Number(message.channelNumber || 0) || null;
        this.playbackCursor = 0;
        if (this.onChannelChange) this.onChannelChange(this.currentChannel, prev);
        break;
      }
      case 'channel-left': {
        const prev = this.currentChannel;
        this.currentChannel = null;
        this.isPTTActive = false;
        if (this.onChannelChange) this.onChannelChange(null, prev);
        if (this.onTalkingChange) this.onTalkingChange(false);
        break;
      }
      case 'mumble-audio':
        this.playPcmChunk(message.data, message.sampleRate).catch(() => {});
        break;
      case 'error':
        if (this.onError) this.onError(String(message.error || 'Voice error'));
        break;
      case 'pong':
      default:
        break;
    }
  }

  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  ping() {
    this.send({ type: 'ping' });
  }

  disconnect() {
    this.leaveChannel();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  cleanup() {
    if (this.localMicSource) {
      try { this.localMicSource.disconnect(); } catch {}
      this.localMicSource = null;
    }
    if (this.localMicProcessor) {
      try { this.localMicProcessor.disconnect(); } catch {}
      this.localMicProcessor.onaudioprocess = null;
      this.localMicProcessor = null;
    }
    if (this.localMicSink) {
      try { this.localMicSink.disconnect(); } catch {}
      this.localMicSink = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    this.playbackCursor = 0;
    this.currentChannel = null;
    this.isPTTActive = false;
    this.isConnected = false;
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      currentChannel: this.currentChannel,
      isPTTActive: this.isPTTActive,
      hasLocalStream: !!this.localStream,
    };
  }
}

export default DispatcherVoiceClient;
