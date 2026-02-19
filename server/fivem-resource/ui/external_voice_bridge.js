(function externalVoiceBridgeBootstrap() {
  const LOG_PREFIX = '[cad_bridge][external_voice_ui]';
  const LIVEKIT_CDN_URLS = [
    'https://cdn.jsdelivr.net/npm/livekit-client/dist/livekit-client.umd.min.js',
    'https://unpkg.com/livekit-client/dist/livekit-client.umd.min.js',
  ];

  const state = {
    room: null,
    localTrack: null,
    localGameId: '',
    session: null,
    connected: false,
    pttActive: false,
    livekit: null,
    connectPromise: null,
    remoteAudioByTrackSid: new Map(),
  };

  function log(message) {
    try {
      console.log(`${LOG_PREFIX} ${message}`);
    } catch (_err) {
      // Ignore logging errors.
    }
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
    element.style.display = 'none';
    element.setAttribute('data-cad-external-track', trackSid);
    document.body.appendChild(element);

    const playPromise = element.play && element.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(function ignorePlayError() {});
    }

    state.remoteAudioByTrackSid.set(trackSid, { track, element });
  }

  async function syncLocalTrackEnabled() {
    if (!state.localTrack) return;
    const shouldTransmit = state.connected && state.pttActive === true;
    try {
      await state.localTrack.setEnabled(shouldTransmit);
    } catch (_err) {
      // Ignore.
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

    for (let i = 0; i < LIVEKIT_CDN_URLS.length; i += 1) {
      const url = LIVEKIT_CDN_URLS[i];
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

    if (state.localTrack) {
      try {
        await state.localTrack.setEnabled(false);
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
  }

  async function connectWithSession(rawSession) {
    const session = normalizeSession(rawSession);
    if (!session.ok || !session.token) {
      await disconnectRoom('no_session');
      return;
    }

    if (session.provider !== 'livekit') {
      await disconnectRoom(`unsupported_provider:${session.provider || 'none'}`);
      log(`unsupported provider "${session.provider || 'none'}"`);
      return;
    }

    if (!session.url) {
      await disconnectRoom('missing_url');
      log('missing LiveKit URL in external session payload');
      return;
    }

    if (isSameSession(state.session, session) && state.connected) {
      return;
    }

    if (state.connectPromise) {
      await state.connectPromise.catch(function ignoreConnectWaitError() {});
    }

    state.connectPromise = (async function connectNow() {
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
        log(`connected room=${session.roomName || 'unknown'} channel=${session.channelNumber}`);
        try {
          await room.startAudio();
        } catch (_err) {
          // Autoplay can fail until user interaction.
        }
        await syncLocalTrackEnabled();
      });

      room.on(livekit.RoomEvent.Disconnected, function onDisconnected() {
        state.connected = false;
        state.pttActive = false;
        detachAllRemoteTracks();
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
        log(`media error: ${error && error.message ? error.message : 'unknown'}`);
      });

      await room.connect(session.url, session.token, { autoSubscribe: true });

      state.localTrack = await livekit.createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      });
      await room.localParticipant.publishTrack(state.localTrack, {
        source: livekit.Track.Source.Microphone,
      });
      await state.localTrack.setEnabled(false);
      await syncLocalTrackEnabled();
    })();

    try {
      await state.connectPromise;
    } catch (error) {
      await disconnectRoom('connect_failed');
      log(`connect failed: ${error && error.message ? error.message : 'unknown error'}`);
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
      connectWithSession(message.data).catch(function onSessionError(error) {
        log(`session handling failed: ${error && error.message ? error.message : 'unknown error'}`);
      });
      return;
    }

    if (message.action === 'updateRadioTalking') {
      updatePushToTalk(message.data).catch(function onPttError(error) {
        log(`PTT update failed: ${error && error.message ? error.message : 'unknown error'}`);
      });
    }
  });

  window.addEventListener('beforeunload', function onBeforeUnload() {
    disconnectRoom('unload').catch(function ignoreUnloadDisconnectError() {});
  });
})();
