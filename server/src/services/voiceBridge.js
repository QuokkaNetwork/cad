let MumbleClientCtor = null;
let OpusScript = null;

try {
  ({ MumbleClient: MumbleClientCtor } = require('mumble-node'));
} catch {
  MumbleClientCtor = null;
}

try {
  OpusScript = require('opusscript');
} catch {
  OpusScript = null;
}

const { Settings, VoiceCallSessions, FiveMPlayerLinks } = require('../db/sqlite');

const OPUS_FRAME_SIZE = 960; // 20ms @ 48kHz mono
const OPUS_FRAME_BYTES = OPUS_FRAME_SIZE * 2;
const MAX_WHISPER_TARGETS = 30;
const ACTIVE_LINK_MAX_AGE_MS = 5 * 60 * 1000;

function parseBool(value, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return !!fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return !!fallback;
}

function parseCsv(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  return text
    .split(',')
    .map(item => String(item || '').trim())
    .filter(Boolean);
}

function toBuffer(payload) {
  if (!payload) return Buffer.alloc(0);
  if (Buffer.isBuffer(payload)) return payload;
  if (payload instanceof ArrayBuffer) return Buffer.from(payload);
  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  }
  try {
    return Buffer.from(payload);
  } catch {
    return Buffer.alloc(0);
  }
}

function normalizePositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return 0;
  return parsed;
}

function parseSqliteUtc(value) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  const base = text.replace(' ', 'T');
  const normalized = base.endsWith('Z') ? base : `${base}Z`;
  return Date.parse(normalized);
}

function isActiveFiveMLink(link) {
  const ts = parseSqliteUtc(link?.updated_at);
  if (Number.isNaN(ts)) return false;
  return (Date.now() - ts) <= ACTIVE_LINK_MAX_AGE_MS;
}

function normalizeRouteMembersByChannel(rawValue) {
  const normalized = new Map();
  if (!rawValue || typeof rawValue !== 'object') return normalized;

  const entries = rawValue instanceof Map
    ? Array.from(rawValue.entries())
    : Object.entries(rawValue);

  for (const [channelKey, membersRaw] of entries) {
    const channelNumber = normalizePositiveInt(channelKey);
    if (!channelNumber) continue;

    const input = Array.isArray(membersRaw)
      ? membersRaw
      : (membersRaw instanceof Set ? Array.from(membersRaw.values()) : []);
    const seen = new Set();
    const members = [];
    for (const candidate of input) {
      const memberId = normalizePositiveInt(candidate);
      if (!memberId || seen.has(memberId)) continue;
      seen.add(memberId);
      members.push(memberId);
    }
    if (members.length > 0) {
      normalized.set(channelNumber, members);
    }
  }

  return normalized;
}

function waitForReady(client, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let timeoutId = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
      client.removeListener('ready', onReady);
      client.removeListener('error', onError);
      client.removeListener('rejected', onRejected);
      client.removeListener('disconnected', onDisconnected);
    };

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = (err) => {
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err || 'Unknown Mumble error')));
    };

    const onRejected = (type, reason) => {
      cleanup();
      const rejectType = type !== undefined ? ` (${type})` : '';
      reject(new Error(`Mumble connection rejected${rejectType}: ${String(reason || 'no reason provided')}`));
    };

    const onDisconnected = (reason) => {
      cleanup();
      reject(new Error(`Mumble disconnected before ready: ${String(reason || 'unknown reason')}`));
    };

    client.once('ready', onReady);
    client.once('error', onError);
    client.once('rejected', onRejected);
    client.once('disconnected', onDisconnected);

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for Mumble ready state'));
    }, Math.max(1000, Number(timeoutMs) || 15000));
  });
}

class VoiceBridgeServer {
  constructor() {
    this.available = !!MumbleClientCtor && !!OpusScript;
    this.mumbleClients = new Map();             // dispatcherId -> mumble-node client
    this.activeChannels = new Map();            // dispatcherId -> { channelNumber, channelName }
    this.audioListeners = new Map();            // dispatcherId -> Set(listener)
    this.dispatcherEncoders = new Map();        // dispatcherId -> Opus encoder
    this.dispatcherPcmBuffers = new Map();      // dispatcherId -> Buffer remainder
    this.dispatcherDecoders = new Map();        // dispatcherId -> Map<sessionId, Opus decoder>
    this.routeMembersByChannel = new Map();     // channelNumber -> Array<gameId/channelId>
    this.dispatcherWhisperTargets = new Map();  // dispatcherId -> { signature, targets }
    this.clientAudioHandlers = new Map();       // dispatcherId -> fn
    this.clientDisconnectHandlers = new Map();  // dispatcherId -> fn
    this.clientErrorHandlers = new Map();       // dispatcherId -> fn
    this.missingDependencies = [
      ...(MumbleClientCtor ? [] : ['mumble-node']),
      ...(OpusScript ? [] : ['opusscript']),
    ];
    // .env MUMBLE_HOST/PORT always takes priority (the CAD and Mumble run on the same machine).
    // The DB values are populated by FiveM auto-detect (the public IP) which is correct for
    // pma-voice clients connecting from outside, but the CAD server must connect via localhost.
    const envHost = String(process.env.MUMBLE_HOST || '').trim();
    const envPort = String(process.env.MUMBLE_PORT || '').trim();
    const dbHost = String(Settings.get('mumble_host') || '').trim();
    const dbPort = String(Settings.get('mumble_port') || '').trim();
    const voiceSystem = String(Settings.get('mumble_voice_system') || '').trim();

    this.config = {
      mumbleHost: envHost || dbHost || '127.0.0.1',
      mumblePort: Number(envPort || dbPort || 64738) || 64738,
      mumblePassword: String(process.env.MUMBLE_PASSWORD || '').trim(),
      mumbleTokens: parseCsv(process.env.MUMBLE_TOKENS),
      mumbleRejectUnauthorized: parseBool(process.env.MUMBLE_REJECT_UNAUTHORIZED, false),
      // Hard-force TCP tunnel mode for dispatcher bridge clients.
      // rust-mumble can aggressively request CryptSetup resets when dispatcher
      // bridge UDP state drifts; disabling UDP here avoids that path entirely.
      mumbleDisableUdp: true,
      dispatcherNamePrefix: String(process.env.MUMBLE_DISPATCHER_NAME_PREFIX || 'CAD_Dispatcher').trim() || 'CAD_Dispatcher',
      sampleRate: 48000,
      channels: 1,
      bitsPerSample: 16,
      voiceSystem: voiceSystem || 'unknown',
    };

    const hostSource = envHost ? '.env' : (dbHost ? 'auto-detect' : 'default');
    console.log(
      `[VoiceBridge] Mumble config: ${this.config.mumbleHost}:${this.config.mumblePort} ` +
      `(source: ${hostSource}, voice: ${this.config.voiceSystem || 'unknown'}, disableUdp: ${this.config.mumbleDisableUdp})`
    );
  }

  assertAvailable() {
    if (this.available) return;
    throw new Error(`Voice bridge dependencies missing: ${this.missingDependencies.join(', ')}`);
  }

  buildDispatcherName(dispatcherId, preferredName = null) {
    // Always prefix dispatcher names so they NEVER collide with in-game player
    // names on the Mumble server. Without the prefix, if a dispatcher's Steam
    // name matches their FiveM character name, Murmur treats the CAD bridge
    // connection as a duplicate and "ghost-kicks" the player's proximity voice
    // session, breaking voice for that player.
    const byName = String(preferredName || '').trim();
    const prefix = this.config.dispatcherNamePrefix;
    if (byName) return `${prefix}${byName}`.slice(0, 80);
    return `${prefix}${dispatcherId}`;
  }

  buildClientOptions(dispatcherId, preferredName = null) {
    const options = {
      host: this.config.mumbleHost,
      port: this.config.mumblePort,
      username: this.buildDispatcherName(dispatcherId, preferredName),
      rejectUnauthorized: this.config.mumbleRejectUnauthorized,
      disableUdp: this.config.mumbleDisableUdp,
    };
    if (this.config.mumblePassword) {
      options.password = this.config.mumblePassword;
    }
    if (this.config.mumbleTokens.length > 0) {
      options.tokens = this.config.mumbleTokens;
    }
    return options;
  }

  createEncoder() {
    return new OpusScript(this.config.sampleRate, this.config.channels, OpusScript.Application.VOIP);
  }

  createDecoder() {
    return new OpusScript(this.config.sampleRate, this.config.channels, OpusScript.Application.VOIP);
  }

  decodeIncomingAudio(dispatcherId, sessionId, opusChunk) {
    const rawChunk = toBuffer(opusChunk);
    if (!rawChunk.length) return;

    let decoderMap = this.dispatcherDecoders.get(dispatcherId);
    if (!decoderMap) {
      decoderMap = new Map();
      this.dispatcherDecoders.set(dispatcherId, decoderMap);
    }

    const key = Number(sessionId || 0) || 0;
    let decoder = decoderMap.get(key);
    if (!decoder) {
      decoder = this.createDecoder();
      decoderMap.set(key, decoder);
    }

    try {
      const decoded = decoder.decode(rawChunk, OPUS_FRAME_SIZE);
      const pcm = toBuffer(decoded);
      if (!pcm.length) return;
      this.emitAudio(dispatcherId, pcm);
    } catch {
      // Corrupt or partial Opus packets should be ignored.
    }
  }

  async connectDispatcherToMumble(dispatcherId, userName = null) {
    this.assertAvailable();

    const existing = this.mumbleClients.get(dispatcherId);
    if (existing?.isReady) {
      return existing;
    }
    if (existing && !existing.isReady) {
      try { existing.disconnect(); } catch {}
      this.handleMumbleDisconnect(dispatcherId);
    }

    const client = new MumbleClientCtor(this.buildClientOptions(dispatcherId, userName));
    const audioHandler = (sessionId, opusData) => {
      this.decodeIncomingAudio(dispatcherId, sessionId, opusData);
    };
    const disconnectHandler = () => {
      this.handleMumbleDisconnect(dispatcherId);
    };
    const errorHandler = (err) => {
      console.warn('[VoiceBridge] Mumble client error:', err?.message || err);
    };

    client.on('audio', audioHandler);
    client.on('disconnected', disconnectHandler);
    client.on('error', errorHandler);

    try {
      await client.connect();
      if (!client.isReady) {
        await waitForReady(client, 15000);
      }
    } catch (error) {
      try {
        client.removeListener('audio', audioHandler);
        client.removeListener('disconnected', disconnectHandler);
        client.removeListener('error', errorHandler);
      } catch {}
      throw error;
    }

    this.mumbleClients.set(dispatcherId, client);
    this.clientAudioHandlers.set(dispatcherId, audioHandler);
    this.clientDisconnectHandlers.set(dispatcherId, disconnectHandler);
    this.clientErrorHandlers.set(dispatcherId, errorHandler);
    this.dispatcherEncoders.set(dispatcherId, this.createEncoder());
    this.dispatcherPcmBuffers.set(dispatcherId, Buffer.alloc(0));
    this.dispatcherDecoders.set(dispatcherId, new Map());
    return client;
  }

  resolveTargetChannel(client, numericChannel) {
    if (!client || !client.isReady) return null;

    const allChannels = Array.from(client.channels.values());
    if (!allChannels.length) return null;

    if (numericChannel <= 0) {
      return client.getRootChannel() || allChannels[0];
    }

    const exactById = client.getChannel(numericChannel);
    if (exactById) return exactById;

    const candidates = [
      String(numericChannel),
      `Channel_${numericChannel}`,
      `Radio ${numericChannel}`,
      `radio-${numericChannel}`,
      `radio_${numericChannel}`,
    ].map(name => name.toLowerCase());

    for (const candidate of candidates) {
      const hit = allChannels.find((channel) => String(channel?.name || '').trim().toLowerCase() === candidate);
      if (hit) return hit;
    }

    return null;
  }

  async joinChannel(dispatcherId, channelNumber) {
    const client = this.mumbleClients.get(dispatcherId);
    if (!client) throw new Error('Dispatcher not connected to voice backend');
    if (!client.isReady) throw new Error('Voice backend is still initializing for this dispatcher');

    const numericChannel = Number(channelNumber || 0);

    // pma-voice keeps ALL players in the Mumble root channel and uses
    // voice whisper targets for radio channel isolation.  The dispatcher
    // must therefore also sit in the root channel — not a named sub-channel.
    // We always move to root; the routing map + setVoiceTarget() handles
    // who hears whom.
    const rootChannel = client.getRootChannel
      ? client.getRootChannel()
      : Array.from(client.channels?.values?.() ?? [])[0] ?? null;

    if (!rootChannel) {
      throw new Error('No usable Mumble channel found (root channel missing)');
    }

    client.moveToChannel(Number(rootChannel.channelId || 0));

    // Clear any stale whisper targets; per-member targets are set dynamically
    // in refreshDispatcherWhisperTargets() each time the dispatcher transmits.
    this.dispatcherWhisperTargets.delete(dispatcherId);

    this.activeChannels.set(dispatcherId, {
      channelNumber: Number.isInteger(numericChannel) && numericChannel > 0 ? numericChannel : null,
      channelName: String(rootChannel.name || 'Root'),
    });
    this.dispatcherWhisperTargets.delete(dispatcherId);
  }

  setRouteMembersByChannel(rawValue) {
    this.routeMembersByChannel = normalizeRouteMembersByChannel(rawValue);
    this.dispatcherWhisperTargets.clear();
  }

  getDispatcherSessionsByChannel() {
    const byChannel = new Map();
    for (const [dispatcherId, active] of this.activeChannels.entries()) {
      const channelNumber = normalizePositiveInt(active?.channelNumber);
      if (!channelNumber) continue;
      const client = this.mumbleClients.get(dispatcherId);
      const sessionId = normalizePositiveInt(client?.session);
      if (!sessionId) continue;

      const bucket = byChannel.get(channelNumber) || [];
      bucket.push({
        dispatcherId: normalizePositiveInt(dispatcherId),
        session: sessionId,
      });
      byChannel.set(channelNumber, bucket);
    }
    return byChannel;
  }

  getRouteMembersForDispatcher(dispatcherId) {
    const active = this.activeChannels.get(dispatcherId);
    const channelNumber = normalizePositiveInt(active?.channelNumber);
    if (!channelNumber) return [];
    const radioMembers = this.routeMembersByChannel.get(channelNumber) || [];
    if (radioMembers.length > 0) return radioMembers;

    // Call channels (10000+) are not tracked in VoiceParticipants heartbeat.
    // Use the stored call session caller game_id as the member target.
    if (channelNumber >= 10000) {
      try {
        const callSession = VoiceCallSessions.findByChannelNumber(channelNumber);
        const callerCitizenId = String(callSession?.caller_citizen_id || '').trim();
        if (callerCitizenId) {
          const liveLink = FiveMPlayerLinks.findByCitizenId(callerCitizenId);
          const liveGameId = normalizePositiveInt(liveLink?.game_id);
          if (liveGameId > 0 && isActiveFiveMLink(liveLink)) {
            return [liveGameId];
          }
        }
        const callerGameId = normalizePositiveInt(callSession?.caller_game_id);
        if (callerGameId > 0) return [callerGameId];
      } catch {
        // Best-effort fallback only.
      }
    }

    return [];
  }

  buildWhisperTargetSignature(dispatcherId, members) {
    const active = this.activeChannels.get(dispatcherId);
    const channelNumber = normalizePositiveInt(active?.channelNumber);
    if (!channelNumber || !Array.isArray(members) || members.length === 0) {
      return `${channelNumber}:none`;
    }
    return `${channelNumber}:${members.join(',')}`;
  }

  /**
   * Refresh per-dispatcher voice whisper targets.
   *
   * pma-voice architecture (key insight):
   *   - Each FiveM player's Mumble channel = their server source ID.
   *     `MumbleSetVoiceChannel(playerServerId)` puts them in that channel.
   *   - Radio routing uses `MumbleAddVoiceTargetChannel(voiceTarget, serverId)`
   *     where serverId is another player's FiveM source — used as a channel ID.
   *   - Therefore: to whisper to a player, we call
   *     `setVoiceTarget(targetId, sourceId, {links:false, children:false})`
   *     where sourceId is that player's FiveM server source number.
   *
   * mumble-node API: setVoiceTarget(targetId, channelId, opts)
   *   targetId 1-30 = whisper targets; 0 = normal talk (everyone in same channel).
   *   channelId = the Mumble channel to whisper to.
   *   For pma-voice, channelId == FiveM source number of the target player.
   *
   * We set one target slot per route member (up to MAX_WHISPER_TARGETS).
   * Targets are re-used across frames if the member list hasn't changed
   * (checked via a cheap string signature comparison).
   */
  refreshDispatcherWhisperTargets(dispatcherId) {
    const client = this.mumbleClients.get(dispatcherId);
    if (!client || !client.isReady) return [];

    const members = this.getRouteMembersForDispatcher(dispatcherId)
      .map(m => normalizePositiveInt(m))
      .filter(id => id > 0)
      .slice(0, MAX_WHISPER_TARGETS);

    const active = this.activeChannels.get(dispatcherId);
    const channelNumber = normalizePositiveInt(active?.channelNumber);
    const signature = `${channelNumber}:${members.join(',')}`;

    const existing = this.dispatcherWhisperTargets.get(dispatcherId);
    if (existing && existing.signature === signature) return existing.targets;

    const targets = [];
    for (let i = 0; i < members.length; i++) {
      const sourceId = members[i]; // FiveM source ID == pma-voice Mumble channel for that player
      const targetId = i + 1;
      try {
        client.setVoiceTarget(targetId, sourceId, { links: false, children: false });
        targets.push({ targetId, sourceId });
      } catch (err) {
        console.warn(`[VoiceBridge] setVoiceTarget(${targetId}, src${sourceId}) failed:`, err?.message || err);
      }
    }

    if (targets.length > 0) {
      console.log(
        `[VoiceBridge] Dispatcher ${dispatcherId} -> ${targets.length} radio targets: ` +
        targets.map(t => `src${t.sourceId}(slot${t.targetId})`).join(', ')
      );
    }

    this.dispatcherWhisperTargets.set(dispatcherId, { signature, targets });
    return targets;
  }

  sendAudioToDispatcherTargets(dispatcherId, client, opusData, isLastFrame = false) {
    const targets = this.refreshDispatcherWhisperTargets(dispatcherId);

    // No route members known yet → fall back to normal talk (target 0).
    // In pma-voice everyone in the same channel hears normal talk, so this
    // acts as an unfiltered broadcast until the routing table is populated.
    if (!targets || targets.length === 0) {
      try {
        client.sendAudio(Buffer.from(opusData), isLastFrame, 0);
        return true;
      } catch {
        return false;
      }
    }

    // Send one audio packet per whisper-target slot.
    // Each slot is configured to reach exactly one in-game player's channel.
    let sent = false;
    for (const target of targets) {
      try {
        client.sendAudio(Buffer.from(opusData), isLastFrame, Number(target.targetId));
        sent = true;
      } catch {
        // Continue trying remaining targets even if one fails.
      }
    }
    return sent;
  }

  sendTerminatorFrame(dispatcherId) {
    const client = this.mumbleClients.get(dispatcherId);
    const encoder = this.dispatcherEncoders.get(dispatcherId);
    if (!client || !client.isReady || !encoder) return;

    try {
      const silencePcm = Buffer.alloc(OPUS_FRAME_BYTES);
      const opus = encoder.encode(silencePcm, OPUS_FRAME_SIZE);
      if (opus && opus.length) {
        this.sendAudioToDispatcherTargets(dispatcherId, client, Buffer.from(opus), true);
      }
    } catch {
      // Best effort to end transmission cleanly.
    }
  }

  async leaveChannel(dispatcherId) {
    const client = this.mumbleClients.get(dispatcherId);
    if (!client) return;

    this.sendTerminatorFrame(dispatcherId);
    this.dispatcherPcmBuffers.set(dispatcherId, Buffer.alloc(0));

    try {
      const root = client.getRootChannel();
      if (root) {
        client.moveToChannel(Number(root.channelId || 0));
      }
    } catch {
      // Move-to-root is best effort.
    }

    this.activeChannels.delete(dispatcherId);
    this.dispatcherWhisperTargets.delete(dispatcherId);
  }

  sendDispatcherAudio(dispatcherId, pcmChunk) {
    const client = this.mumbleClients.get(dispatcherId);
    const encoder = this.dispatcherEncoders.get(dispatcherId);
    if (!client || !encoder || !client.isReady) return false;

    let chunk = toBuffer(pcmChunk);
    if (!chunk.length) return false;
    if (chunk.length % 2 !== 0) {
      chunk = chunk.subarray(0, chunk.length - 1);
      if (!chunk.length) return false;
    }

    const previous = this.dispatcherPcmBuffers.get(dispatcherId) || Buffer.alloc(0);
    let pending = previous.length ? Buffer.concat([previous, chunk]) : chunk;
    let sentAny = false;

    while (pending.length >= OPUS_FRAME_BYTES) {
      const frame = pending.subarray(0, OPUS_FRAME_BYTES);
      pending = pending.subarray(OPUS_FRAME_BYTES);

      try {
        const opus = encoder.encode(frame, OPUS_FRAME_SIZE);
        if (!opus || !opus.length) continue;
        sentAny = this.sendAudioToDispatcherTargets(dispatcherId, client, Buffer.from(opus), false) || sentAny;
      } catch {
        // Skip malformed frame, continue.
      }
    }

    this.dispatcherPcmBuffers.set(dispatcherId, Buffer.from(pending));
    return sentAny || pending.length > 0;
  }

  addAudioListener(dispatcherId, listener) {
    if (typeof listener !== 'function') return;
    let listeners = this.audioListeners.get(dispatcherId);
    if (!listeners) {
      listeners = new Set();
      this.audioListeners.set(dispatcherId, listeners);
    }
    listeners.add(listener);
  }

  removeAudioListeners(dispatcherId) {
    this.audioListeners.delete(dispatcherId);
  }

  emitAudio(dispatcherId, chunk) {
    const listeners = this.audioListeners.get(dispatcherId);
    if (!listeners || listeners.size === 0) return;

    const payload = {
      pcm: chunk,
      sampleRate: this.config.sampleRate,
      channels: this.config.channels,
      bitsPerSample: this.config.bitsPerSample,
    };
    for (const listener of listeners) {
      try {
        listener(payload);
      } catch {
        // Listener errors should not break the voice loop.
      }
    }
  }

  handleMumbleDisconnect(dispatcherId) {
    const client = this.mumbleClients.get(dispatcherId);
    if (client) {
      const audioHandler = this.clientAudioHandlers.get(dispatcherId);
      const disconnectHandler = this.clientDisconnectHandlers.get(dispatcherId);
      const errorHandler = this.clientErrorHandlers.get(dispatcherId);
      if (audioHandler) client.removeListener('audio', audioHandler);
      if (disconnectHandler) client.removeListener('disconnected', disconnectHandler);
      if (errorHandler) client.removeListener('error', errorHandler);
    }

    this.clientAudioHandlers.delete(dispatcherId);
    this.clientDisconnectHandlers.delete(dispatcherId);
    this.clientErrorHandlers.delete(dispatcherId);
    this.mumbleClients.delete(dispatcherId);
    this.dispatcherEncoders.delete(dispatcherId);
    this.dispatcherPcmBuffers.delete(dispatcherId);
    this.dispatcherDecoders.delete(dispatcherId);
    this.activeChannels.delete(dispatcherId);
    this.dispatcherWhisperTargets.delete(dispatcherId);
    this.audioListeners.delete(dispatcherId);
  }

  async disconnectDispatcher(dispatcherId) {
    this.sendTerminatorFrame(dispatcherId);
    this.removeAudioListeners(dispatcherId);
    this.activeChannels.delete(dispatcherId);

    const client = this.mumbleClients.get(dispatcherId);
    if (client) {
      const audioHandler = this.clientAudioHandlers.get(dispatcherId);
      const disconnectHandler = this.clientDisconnectHandlers.get(dispatcherId);
      const errorHandler = this.clientErrorHandlers.get(dispatcherId);
      if (audioHandler) client.removeListener('audio', audioHandler);
      if (disconnectHandler) client.removeListener('disconnected', disconnectHandler);
      if (errorHandler) client.removeListener('error', errorHandler);
      try { client.disconnect(); } catch {}
    }

    this.clientAudioHandlers.delete(dispatcherId);
    this.clientDisconnectHandlers.delete(dispatcherId);
    this.clientErrorHandlers.delete(dispatcherId);
    this.mumbleClients.delete(dispatcherId);
    this.dispatcherEncoders.delete(dispatcherId);
    this.dispatcherPcmBuffers.delete(dispatcherId);
    this.dispatcherDecoders.delete(dispatcherId);
    this.dispatcherWhisperTargets.delete(dispatcherId);
  }

  getStatus() {
    return {
      available: this.available,
      backend: this.available ? 'mumble-node' : null,
      connectedDispatchers: this.mumbleClients.size,
      dispatchers: Array.from(this.mumbleClients.keys()).map((id) => ({
        dispatcherId: id,
        channel: this.activeChannels.get(id)?.channelNumber ?? null,
      })),
      dependency_missing: this.available ? null : this.missingDependencies.join(', '),
    };
  }
}

let voiceBridgeInstance = null;
function getVoiceBridge() {
  if (!voiceBridgeInstance) {
    voiceBridgeInstance = new VoiceBridgeServer();
  }
  return voiceBridgeInstance;
}

module.exports = { VoiceBridgeServer, getVoiceBridge };
