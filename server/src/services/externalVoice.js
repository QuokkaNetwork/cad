const jwt = require('jsonwebtoken');

function parseIntSafe(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeProvider(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'livekit') return 'livekit';
  if (normalized === 'jwt') return 'jwt';
  return 'none';
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function normalizeRoomPrefix(value, fallback = 'radio-') {
  const prefix = String(value || '').trim();
  if (!prefix) return fallback;
  return prefix;
}

function resolveProviderConfig() {
  const provider = normalizeProvider(process.env.EXTERNAL_VOICE_PROVIDER || 'none');
  return {
    provider,
    livekit: {
      url: normalizeBaseUrl(process.env.EXTERNAL_VOICE_LIVEKIT_URL || process.env.EXTERNAL_VOICE_URL || ''),
      apiKey: String(process.env.EXTERNAL_VOICE_LIVEKIT_API_KEY || '').trim(),
      apiSecret: String(process.env.EXTERNAL_VOICE_LIVEKIT_API_SECRET || '').trim(),
      roomPrefix: normalizeRoomPrefix(process.env.EXTERNAL_VOICE_LIVEKIT_ROOM_PREFIX || 'radio-'),
      tokenTtlSeconds: parseIntSafe(process.env.EXTERNAL_VOICE_LIVEKIT_TOKEN_TTL_SECONDS, 3600, { min: 60, max: 86400 }),
    },
    genericJwt: {
      issuer: String(process.env.EXTERNAL_VOICE_JWT_ISSUER || 'cad-voice').trim() || 'cad-voice',
      audience: String(process.env.EXTERNAL_VOICE_JWT_AUDIENCE || 'external-radio').trim() || 'external-radio',
      secret: String(process.env.EXTERNAL_VOICE_JWT_SECRET || '').trim(),
      roomPrefix: normalizeRoomPrefix(process.env.EXTERNAL_VOICE_JWT_ROOM_PREFIX || 'radio-'),
      tokenTtlSeconds: parseIntSafe(process.env.EXTERNAL_VOICE_JWT_TOKEN_TTL_SECONDS, 3600, { min: 60, max: 86400 }),
    },
  };
}

function createExternalVoiceError(statusCode, message, details = {}) {
  const error = new Error(String(message || 'External voice error'));
  error.statusCode = Number(statusCode) || 500;
  error.details = details && typeof details === 'object' ? details : {};
  return error;
}

function sanitizeIdentity(value, fallback = 'cad-user') {
  const identity = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, '')
    .slice(0, 96);
  return identity || fallback;
}

function buildRoomName(channelNumber, roomPrefix = 'radio-') {
  const channel = Number.parseInt(String(channelNumber ?? '').trim(), 10);
  if (!Number.isInteger(channel) || channel <= 0) {
    throw createExternalVoiceError(400, 'Invalid channel number for external voice token');
  }
  return `${roomPrefix}${channel}`;
}

function buildLiveKitToken({
  apiKey,
  apiSecret,
  identity,
  displayName,
  roomName,
  ttlSeconds,
  metadata,
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: apiKey,
    sub: identity,
    nbf: now - 10,
    exp: now + ttlSeconds,
    name: String(displayName || identity).slice(0, 120),
    metadata: JSON.stringify(metadata || {}),
    video: {
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    },
  };
  return jwt.sign(payload, apiSecret, { algorithm: 'HS256' });
}

function buildGenericJwtToken({
  issuer,
  audience,
  secret,
  identity,
  displayName,
  roomName,
  ttlSeconds,
  metadata,
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: identity,
    name: String(displayName || identity).slice(0, 120),
    room: roomName,
    permissions: {
      join: true,
      publish: true,
      subscribe: true,
      data: true,
    },
    metadata: metadata || {},
    iat: now,
    nbf: now - 10,
    exp: now + ttlSeconds,
  };
  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    issuer,
    audience,
  });
}

class ExternalVoiceService {
  getStatus() {
    const cfg = resolveProviderConfig();
    if (cfg.provider === 'livekit') {
      const missing = [];
      if (!cfg.livekit.url) missing.push('EXTERNAL_VOICE_LIVEKIT_URL');
      if (!cfg.livekit.apiKey) missing.push('EXTERNAL_VOICE_LIVEKIT_API_KEY');
      if (!cfg.livekit.apiSecret) missing.push('EXTERNAL_VOICE_LIVEKIT_API_SECRET');
      return {
        provider: 'livekit',
        available: missing.length === 0,
        url: cfg.livekit.url,
        room_prefix: cfg.livekit.roomPrefix,
        token_ttl_seconds: cfg.livekit.tokenTtlSeconds,
        missing,
      };
    }
    if (cfg.provider === 'jwt') {
      const missing = [];
      if (!cfg.genericJwt.secret) missing.push('EXTERNAL_VOICE_JWT_SECRET');
      return {
        provider: 'jwt',
        available: missing.length === 0,
        url: '',
        room_prefix: cfg.genericJwt.roomPrefix,
        token_ttl_seconds: cfg.genericJwt.tokenTtlSeconds,
        missing,
      };
    }
    return {
      provider: 'none',
      available: false,
      url: '',
      room_prefix: 'radio-',
      token_ttl_seconds: 0,
      missing: ['EXTERNAL_VOICE_PROVIDER'],
    };
  }

  issueToken({
    identity,
    displayName,
    channelNumber,
    channelName = '',
    metadata = {},
  }) {
    const status = this.getStatus();
    if (!status.available) {
      throw createExternalVoiceError(503, 'External voice transport is not configured', {
        provider: status.provider,
        missing: status.missing,
      });
    }

    const cfg = resolveProviderConfig();
    const safeIdentity = sanitizeIdentity(identity, 'cad-user:unknown');
    const safeDisplayName = String(displayName || safeIdentity).trim() || safeIdentity;
    const roomName = buildRoomName(channelNumber, status.room_prefix);
    const safeMetadata = {
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
      channel_name: String(channelName || '').trim(),
    };

    if (cfg.provider === 'livekit') {
      const token = buildLiveKitToken({
        apiKey: cfg.livekit.apiKey,
        apiSecret: cfg.livekit.apiSecret,
        identity: safeIdentity,
        displayName: safeDisplayName,
        roomName,
        ttlSeconds: cfg.livekit.tokenTtlSeconds,
        metadata: safeMetadata,
      });
      return {
        provider: 'livekit',
        url: cfg.livekit.url,
        room_name: roomName,
        identity: safeIdentity,
        expires_in_seconds: cfg.livekit.tokenTtlSeconds,
        token,
      };
    }

    if (cfg.provider === 'jwt') {
      const token = buildGenericJwtToken({
        issuer: cfg.genericJwt.issuer,
        audience: cfg.genericJwt.audience,
        secret: cfg.genericJwt.secret,
        identity: safeIdentity,
        displayName: safeDisplayName,
        roomName,
        ttlSeconds: cfg.genericJwt.tokenTtlSeconds,
        metadata: safeMetadata,
      });
      return {
        provider: 'jwt',
        url: '',
        room_name: roomName,
        identity: safeIdentity,
        expires_in_seconds: cfg.genericJwt.tokenTtlSeconds,
        token,
      };
    }

    throw createExternalVoiceError(503, 'Unsupported external voice provider');
  }

  issueDispatcherToken({ user, channelNumber, channelName = '' }) {
    const identity = `cad-dispatch:${user?.id || 0}`;
    const displayName = String(user?.steam_name || user?.discord_name || user?.name || identity).trim() || identity;
    const metadata = {
      source: 'cad',
      role: 'dispatcher',
      user_id: Number(user?.id || 0) || 0,
    };
    return this.issueToken({
      identity,
      displayName,
      channelNumber,
      channelName,
      metadata,
    });
  }

  issueFieldUnitToken({ gameId, citizenId = '', playerName = '', channelNumber, channelName = '' }) {
    const identity = `fivem:${String(gameId || '').trim()}`;
    const displayName = String(playerName || citizenId || identity).trim() || identity;
    const metadata = {
      source: 'fivem',
      role: 'field_unit',
      game_id: String(gameId || '').trim(),
      citizen_id: String(citizenId || '').trim(),
    };
    return this.issueToken({
      identity,
      displayName,
      channelNumber,
      channelName,
      metadata,
    });
  }
}

let externalVoiceServiceInstance = null;

function getExternalVoiceService() {
  if (!externalVoiceServiceInstance) {
    externalVoiceServiceInstance = new ExternalVoiceService();
  }
  return externalVoiceServiceInstance;
}

module.exports = {
  getExternalVoiceService,
  createExternalVoiceError,
};
