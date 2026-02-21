import { Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client';

function normalizeSession(input) {
  const session = input && typeof input === 'object' ? input : {};
  return {
    provider: String(session.provider || '').trim().toLowerCase(),
    url: String(session.url || '').trim(),
    token: String(session.token || '').trim(),
    roomName: String(session.roomName || session.room_name || '').trim(),
    identity: String(session.identity || '').trim(),
  };
}

class ExternalVoiceClient {
  constructor() {
    this.room = null;
    this.localTrack = null;
    this.remoteElements = new Map();
    this.session = null;
    this.isConnected = false;
    this.audioStarted = false;
    this.isPTTActive = false;
    this.connectingPromise = null;

    this.onConnectionChange = null;
    this.onError = null;
    this.onTalkingChange = null;
  }

  async setTrackTransmitState(track, shouldTransmit) {
    if (!track) return;
    if (typeof track.setEnabled === 'function') {
      await track.setEnabled(shouldTransmit);
      return;
    }
    if (shouldTransmit) {
      if (typeof track.unmute === 'function') {
        await track.unmute();
        return;
      }
      if (typeof track.enable === 'function') {
        await track.enable();
        return;
      }
    } else {
      if (typeof track.mute === 'function') {
        await track.mute();
        return;
      }
      if (typeof track.disable === 'function') {
        await track.disable();
        return;
      }
    }
    throw new Error('External voice local track does not support setEnabled or mute/unmute');
  }

  async ensureLocalTrackPublished() {
    if (this.localTrack) return;
    if (!this.room || !this.isConnected) {
      throw new Error('External voice is not connected');
    }
    const track = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    });
    await this.room.localParticipant.publishTrack(track, {
      source: Track.Source.Microphone,
    });
    await this.setTrackTransmitState(track, false);
    this.localTrack = track;
  }

  async ensureAudioStarted() {
    if (!this.room || !this.isConnected) return;
    try {
      await this.room.startAudio();
      this.audioStarted = true;
    } catch (error) {
      this.audioStarted = false;
      if (typeof this.onError === 'function') {
        this.onError(error?.message || 'Audio output is blocked until user interaction');
      }
    }
  }

  async connect(rawSession) {
    const session = normalizeSession(rawSession);
    if (session.provider !== 'livekit') {
      throw new Error(`Unsupported external voice provider: ${session.provider || 'unknown'}`);
    }
    if (!session.url || !session.token) {
      throw new Error('External voice session is missing URL or token');
    }

    const isSameSession = this.session
      && this.session.provider === session.provider
      && this.session.url === session.url
      && this.session.roomName === session.roomName
      && this.session.identity === session.identity
      && this.session.token === session.token
      && this.isConnected;
    if (isSameSession) return;

    if (this.connectingPromise) {
      await this.connectingPromise.catch(() => {});
    }

    this.connectingPromise = this.connectInternal(session);
    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  async connectInternal(session) {
    await this.disconnect();

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      stopLocalTrackOnUnpublish: true,
    });
    this.room = room;
    this.session = session;

    room.on(RoomEvent.Connected, async () => {
      this.isConnected = true;
      this.audioStarted = false;
      if (typeof this.onConnectionChange === 'function') this.onConnectionChange(true);
      await this.ensureAudioStarted();
    });

    room.on(RoomEvent.Disconnected, () => {
      this.isConnected = false;
      this.isPTTActive = false;
      if (typeof this.onTalkingChange === 'function') this.onTalkingChange(false);
      if (typeof this.onConnectionChange === 'function') this.onConnectionChange(false);
      this.detachRemoteTracks();
    });

    room.on(RoomEvent.MediaDevicesError, (error) => {
      if (typeof this.onError === 'function') {
        this.onError(error?.message || 'External voice media device error');
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (!track || track.kind !== Track.Kind.Audio) return;
      this.attachRemoteTrack(track);
    });

    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      this.detachRemoteTrack(track);
    });

    room.on(RoomEvent.TrackSubscriptionFailed, (_trackSid, _participant, error) => {
      if (typeof this.onError === 'function') {
        this.onError(error?.message || 'External voice track subscription failed');
      }
    });

    try {
      await room.connect(session.url, session.token, { autoSubscribe: true });
      this.isPTTActive = false;
      if (typeof this.onTalkingChange === 'function') this.onTalkingChange(false);
    } catch (error) {
      if (typeof this.onError === 'function') {
        this.onError(error?.message || 'Failed to connect to external voice transport');
      }
      throw error;
    }
  }

  attachRemoteTrack(track) {
    const key = String(track.sid || `${Date.now()}-${Math.random()}`);
    this.detachRemoteTrack(track);
    const element = track.attach();
    element.autoplay = true;
    element.muted = false;
    element.volume = 1.0;
    element.playsInline = true;
    element.style.display = 'none';
    element.dataset.externalVoiceTrackSid = key;
    document.body.appendChild(element);
    const maybePromise = element.play?.();
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {});
    }
    this.remoteElements.set(key, { track, element });
    this.ensureAudioStarted().catch(() => {});
  }

  detachRemoteTrack(track) {
    if (!track) return;
    const trackSid = String(track.sid || '');
    for (const [key, value] of this.remoteElements.entries()) {
      if (!value || value.track !== track) continue;
      try {
        value.track.detach(value.element);
      } catch {
        // Ignore detach errors.
      }
      if (value.element && value.element.parentNode) {
        value.element.parentNode.removeChild(value.element);
      }
      this.remoteElements.delete(key);
    }
    if (!trackSid) return;
    const value = this.remoteElements.get(trackSid);
    if (!value) return;
    try {
      value.track.detach(value.element);
    } catch {
      // Ignore detach errors.
    }
    if (value.element && value.element.parentNode) {
      value.element.parentNode.removeChild(value.element);
    }
    this.remoteElements.delete(trackSid);
  }

  detachRemoteTracks() {
    for (const [key, value] of this.remoteElements.entries()) {
      if (!value) continue;
      try {
        value.track?.detach?.(value.element);
      } catch {
        // Ignore detach errors.
      }
      if (value.element && value.element.parentNode) {
        value.element.parentNode.removeChild(value.element);
      }
      this.remoteElements.delete(key);
    }
  }

  async setPushToTalk(enabled) {
    const wantsTransmit = !!enabled && this.isConnected;
    if (wantsTransmit) {
      await this.ensureAudioStarted();
    }
    if (wantsTransmit && !this.localTrack) {
      try {
        await this.ensureLocalTrackPublished();
      } catch (error) {
        this.isPTTActive = false;
        if (typeof this.onTalkingChange === 'function') this.onTalkingChange(false);
        if (typeof this.onError === 'function') {
          this.onError(error?.message || 'Microphone permission is required to transmit');
        }
        throw error;
      }
    }
    const next = wantsTransmit && !!this.localTrack;
    if (this.isPTTActive === next) return;
    try {
      await this.setTrackTransmitState(this.localTrack, next);
      this.isPTTActive = next;
    } catch (error) {
      this.isPTTActive = false;
      if (typeof this.onError === 'function') {
        this.onError(error?.message || 'Failed to update external push-to-talk state');
      }
      throw error;
    }
    if (typeof this.onTalkingChange === 'function') this.onTalkingChange(this.isPTTActive);
  }

  async disconnect() {
    if (this.localTrack) {
      try {
        await this.setTrackTransmitState(this.localTrack, false);
      } catch {
        // Ignore.
      }
      try {
        this.room?.localParticipant?.unpublishTrack?.(this.localTrack);
      } catch {
        // Ignore.
      }
      try {
        this.localTrack.stop();
      } catch {
        // Ignore.
      }
      this.localTrack = null;
    }

    if (this.room) {
      try {
        await this.room.disconnect();
      } catch {
        // Ignore.
      }
      this.room = null;
    }

    this.detachRemoteTracks();
    this.isConnected = false;
    this.audioStarted = false;
    this.isPTTActive = false;
    this.session = null;
    if (typeof this.onTalkingChange === 'function') this.onTalkingChange(false);
    if (typeof this.onConnectionChange === 'function') this.onConnectionChange(false);
  }
}

export default ExternalVoiceClient;
