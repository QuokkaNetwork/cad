(function externalVoiceBridgeBootstrap() {
  const LOG_PREFIX = '[cad_bridge][external_voice_ui]';
  const LIVEKIT_SCRIPT_URLS = [
    'livekit-client.umd.min.js',
    'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js',
    'https://unpkg.com/livekit-client/dist/livekit-client.umd.min.js',
  ];

  const state = {
    room: null,
    localTrack: null,
    localGameId: '',
    session: null,
    connected: false,
    audioStarted: false,
    pttActive: false,
    livekit: null,
    connectPromise: null,
    remoteAudioByTrackSid: new Map(),
    lastRefreshRequestAt: 0,
    reconnectAttempts: 0,
  };

  function log(message) {
    try {
      console.log(`${LOG_PREFIX} ${message}`);
    } catch (_err) {
      // Ignore logging errors.
    }
  }

  function getResourceName() {
    try {
      return GetParentResourceName();
    } catch (_err) {
      return 'nui-resource';
    }
  }

  async function postNui(endpoint, payload) {
    try {
      await fetch(`https://${getResourceName()}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify(payload || {}),
      });
    } catch (_err) {
      // Ignore status-forwarding errors.
    }
  }

  function emitStatus(status, message) {
    const safeStatus = String(status || '').trim();
    if (!safeStatus) return;
    const session = state.session || {};
    const payload = {
      status: safeStatus,
      message: String(message || '').trim(),
      channel_number: Number(session.channelNumber || 0) || 0,
      provider: String(session.provider || '').trim(),
      connected: state.connected === true,
      remote_tracks: Number(state.remoteAudioByTrackSid.size || 0) || 0,
      ptt_active: state.pttActive === true,
    };
    postNui('cadBridgeExternalVoiceStatus', payload).catch(function ignoreStatusPostError() {});
  }

  function requestRefresh(reason) {
    const nowMs = Date.now();
    if ((nowMs - state.lastRefreshRequestAt) < 5000) return;
    state.lastRefreshRequestAt = nowMs;
    postNui('cadBridgeExternalVoiceRefresh', {
      reason: String(reason || 'requested_by_ui'),
    }).catch(function ignoreRefreshError() {});
  }

  function parseNumber(value, fallback) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeSession(raw) {
    const payload = raw && typeof raw === 'object' ? raw : {};
    const identity = String(payload.identity || '').trim();
    const gameIdFromIdentity = identity.startsWith('fivem:')
      ? String(identity.slice(6)).trim()
      : '';

    return {
      ok: payload.ok === true,
      provider: String(payload.provider || '').trim().toLowerCase(),
      url: String(payload.url || '').trim(),
      token: String(payload.token || '').trim(),
      roomName: String(payload.room_name || payload.roomName || '').trim(),
      identity,
      gameId: String(payload.game_id || gameIdFromIdentity || '').trim(),
      channelNumber: parseNumber(payload.channel_number, 0) || 0,
      channelType: String(payload.channel_type || 'radio').trim().toLowerCase() || 'radio',
    };
  }

  function isSameSession(a, b) {
    if (!a || !b) return false;
    return (
      a.provider === b.provider
      && a.url === b.url
      && a.token === b.token
      && a.roomName === b.roomName
      && a.identity === b.identity
      && a.channelNumber === b.channelNumber
      && a.channelType === b.channelType
    );
  }

  function removeAudioElement(element) {
    if (!element) return;
    try {
      element.pause();
    } catch (_err) {
      // Ignore.
    }
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  function detachRemoteTrackBySid(trackSid) {
    if (!trackSid) return;
    const entry = state.remoteAudioByTrackSid.get(trackSid);
    if (!entry) return;
    try {
      if (entry.track && typeof entry.track.detach === 'function') {
        entry.track.detach(entry.element);
      }
    } catch (_err) {
      // Ignore.
    }
    removeAudioElement(entry.element);
    state.remoteAudioByTrackSid.delete(trackSid);
  }

  function detachAllRemoteTracks() {
    for (const trackSid of state.remoteAudioByTrackSid.keys()) {
      detachRemoteTrackBySid(trackSid);
    }
  }

  function attachRemoteTrack(track) {
    if (!track) return;
    const trackSid = String(track.sid || '').trim();
    if (!trackSid) return;
    detachRemoteTrackBySid(trackSid);

    let element = null;
    try {
      element = track.attach();
    } catch (_err) {
      return;
    }
    if (!element) return;

    element.autoplay = true;
    element.muted = false;
    element.volume = 1.0;
    element.playsInline = true;
    element.style.display = 'none';
    element.setAttribute('data-cad-external-track', trackSid);
    document.body.appendChild(element);

    const playPromise = element.play && element.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function ignorePlayError() {});
    }

    state.remoteAudioByTrackSid.set(trackSid, { track, element });
    ensureRoomAudioStarted('track_subscribed').catch(function ignoreStartAudioRetryError() {});
  }

  async function setTrackTransmitState(track, shouldTransmit) {
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
    throw new Error('Local track does not support setEnabled or mute/unmute');
  }

  async function ensureLocalTrackPublished() {
    if (state.localTrack) return;
    if (!state.room || !state.connected) return;

    const livekit = await ensureLivekitLoaded();
    const localTrack = await livekit.createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    });
    await state.room.localParticipant.publishTrack(localTrack, {
      source: livekit.Track.Source.Microphone,
    });
    await setTrackTransmitState(localTrack, false);
    state.localTrack = localTrack;
  }

  async function ensureRoomAudioStarted(reason) {
    if (!state.room || !state.connected) return;
    try {
      await state.room.startAudio();
      state.audioStarted = true;
    } catch (err) {
      state.audioStarted = false;
      const message = err && err.message ? err.message : 'audio output blocked until user interaction';
      log(`startAudio failed (${reason || 'unknown'}): ${message}`);
      emitStatus('audio_waiting_interaction', message);
    }
  }

  async function syncLocalTrackEnabled() {
    const shouldTransmit = state.connected && state.pttActive === true;
    if (shouldTransmit) {
      await ensureRoomAudioStarted('ptt');
    }
    if (shouldTransmit && !state.localTrack) {
      try {
        await ensureLocalTrackPublished();
      } catch (err) {
        state.pttActive = false;
        const message = err && err.message ? err.message : 'microphone access required for transmit';
        log(`local track init failed: ${message}`);
        emitStatus('ptt_error', message);
        return;
      }
    }
    if (!state.localTrack) return;
    try {
      await setTrackTransmitState(state.localTrack, shouldTransmit);
    } catch (err) {
      state.pttActive = false;
      const message = err && err.message ? err.message : 'unable to toggle local track';
      log(`local track state sync failed: ${message}`);
      emitStatus('ptt_error', message);
    }
  }

  async function loadExternalScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(script);
    });
  }

  async function ensureLivekitLoaded() {
    if (state.livekit) return state.livekit;
    if (window.LivekitClient) {
      state.livekit = window.LivekitClient;
      return state.livekit;
    }

    for (let i = 0; i < LIVEKIT_SCRIPT_URLS.length; i += 1) {
      const url = LIVEKIT_SCRIPT_URLS[i];
      try {
        await loadExternalScript(url);
      } catch (_err) {
        continue;
      }
      if (window.LivekitClient) {
        state.livekit = window.LivekitClient;
        return state.livekit;
      }
    }

    throw new Error('LiveKit browser SDK could not be loaded');
  }

  async function disconnectRoom(reason) {
    state.pttActive = false;
    state.audioStarted = false;

    if (state.localTrack) {
      try {
        await setTrackTransmitState(state.localTrack, false);
      } catch (_err) {
        // Ignore.
      }
      try {
        state.room && state.room.localParticipant && state.room.localParticipant.unpublishTrack(state.localTrack);
      } catch (_err) {
        // Ignore.
      }
      try {
        state.localTrack.stop();
      } catch (_err) {
        // Ignore.
      }
      state.localTrack = null;
    }

    if (state.room) {
      try {
        await state.room.disconnect();
      } catch (_err) {
        // Ignore.
      }
      state.room = null;
    }

    detachAllRemoteTracks();
    state.session = null;
    state.localGameId = '';
    state.connected = false;

    if (reason) {
      log(`disconnected (${reason})`);
    }
    emitStatus('disconnected', reason || 'disconnected');
  }

  async function connectWithSession(rawSession) {
    const session = normalizeSession(rawSession);
    if (!session.ok || !session.token) {
      await disconnectRoom('no_session');
      emitStatus('session_cleared', 'no active external voice session');
      return;
    }

    if (session.provider !== 'livekit') {
      await disconnectRoom(`unsupported_provider:${session.provider || 'none'}`);
      log(`unsupported provider "${session.provider || 'none'}"`);
      emitStatus('unsupported_provider', session.provider || 'none');
      return;
    }

    if (!session.url) {
      await disconnectRoom('missing_url');
      log('missing LiveKit URL in external session payload');
      emitStatus('missing_url', 'missing LiveKit URL in session payload');
      return;
    }

    if (isSameSession(state.session, session) && state.connected) {
      return;
    }

    if (state.connectPromise) {
      await state.connectPromise.catch(function ignoreConnectWaitError() {});
    }

    state.connectPromise = (async function connectNow() {
      state.reconnectAttempts += 1;
      emitStatus('connecting', `attempt ${state.reconnectAttempts} channel ${session.channelNumber}`);
      const livekit = await ensureLivekitLoaded();
      await disconnectRoom('session_refresh');

      const room = new livekit.Room({
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: true,
      });
      state.room = room;
      state.session = session;
      state.localGameId = session.gameId;

      room.on(livekit.RoomEvent.Connected, async function onConnected() {
        state.connected = true;
        state.audioStarted = false;
        state.reconnectAttempts = 0;
        log(`connected room=${session.roomName || 'unknown'} channel=${session.channelNumber}`);
        emitStatus('connected', `room ${session.roomName || 'unknown'} channel ${session.channelNumber}`);
        await ensureRoomAudioStarted('connected');
        await syncLocalTrackEnabled();
      });

      room.on(livekit.RoomEvent.Disconnected, function onDisconnected() {
        state.connected = false;
        state.pttActive = false;
        detachAllRemoteTracks();
        emitStatus('room_disconnected', `channel ${session.channelNumber}`);
        requestRefresh('room_disconnected');
      });

      room.on(livekit.RoomEvent.TrackSubscribed, function onTrackSubscribed(track) {
        if (!track || track.kind !== livekit.Track.Kind.Audio) return;
        attachRemoteTrack(track);
      });

      room.on(livekit.RoomEvent.TrackUnsubscribed, function onTrackUnsubscribed(track) {
        const trackSid = String(track && track.sid ? track.sid : '').trim();
        detachRemoteTrackBySid(trackSid);
      });

      room.on(livekit.RoomEvent.MediaDevicesError, function onMediaError(error) {
        const message = error && error.message ? error.message : 'unknown';
        log(`media error: ${message}`);
        emitStatus('media_error', message);
      });

      await room.connect(session.url, session.token, { autoSubscribe: true });

      await syncLocalTrackEnabled();
      emitStatus('ready', `session ready channel ${session.channelNumber} (mic on first transmit)`);
    })();

    try {
      await state.connectPromise;
    } catch (error) {
      await disconnectRoom('connect_failed');
      const message = error && error.message ? error.message : 'unknown error';
      log(`connect failed: ${message}`);
      emitStatus('connect_failed', message);
      requestRefresh('connect_failed');
    } finally {
      state.connectPromise = null;
    }
  }

  async function updatePushToTalk(rawData) {
    const data = rawData && typeof rawData === 'object' ? rawData : {};
    if (!state.session) return;

    const localGameId = String(state.localGameId || '').trim();
    const radioId = String(data.radioId || '').trim();
    if (localGameId && radioId && radioId !== localGameId) return;

    state.pttActive = data.radioTalking === true;
    await syncLocalTrackEnabled();
  }

  window.addEventListener('message', function onNuiMessage(event) {
    const message = event && event.data && typeof event.data === 'object' ? event.data : null;
    if (!message) return;

    if (message.action === 'externalVoiceSession') {
      const incoming = normalizeSession(message.data);
      emitStatus('session_update', `channel ${incoming.channelNumber} provider ${incoming.provider || 'unknown'}`);
      connectWithSession(message.data).catch(function onSessionError(error) {
        const details = error && error.message ? error.message : 'unknown error';
        log(`session handling failed: ${details}`);
        emitStatus('session_error', details);
        requestRefresh('session_error');
      });
      return;
    }

    if (message.action === 'updateRadioTalking') {
      updatePushToTalk(message.data).catch(function onPttError(error) {
        const details = error && error.message ? error.message : 'unknown error';
        log(`PTT update failed: ${details}`);
        emitStatus('ptt_error', details);
      });
    }
  });

  setInterval(function externalVoiceDiagnosticsTick() {
    if (!state.session) return;
    const remoteCount = Number(state.remoteAudioByTrackSid.size || 0) || 0;
    log(
      `diag connected=${state.connected ? 1 : 0} channel=${state.session.channelNumber || 0} ` +
      `remote_tracks=${remoteCount} ptt=${state.pttActive ? 1 : 0}`
    );
  }, 30000);

  window.addEventListener('beforeunload', function onBeforeUnload() {
    disconnectRoom('unload').catch(function ignoreUnloadDisconnectError() {});
  });
})();
