/**
 * Mumble Client
 *
 * Main client class for interacting with Mumble servers.
 */

import { EventEmitter } from 'events';
import * as os from 'os';
import { MumbleConnection } from './connection';
import { MumbleUdp } from './udp';
import {
  decodeMessage,
  encodeVersion,
  encodeAuthenticate,
  encodePing,
  encodeTextMessage,
  encodeUserState,
  MumbleProto,
} from './protocol';
import { MumbleUDP } from '../proto/mumbleudp';
import {
  MumbleUser,
  MumbleChannel,
  ServerInfo,
  MumbleClientOptions,
  MessageType,
  RejectType,
  MumbleEvents,
  TextMessage,
} from './types';

const DEFAULT_PORT = 64738;
const PING_INTERVAL = 15000;
const VOICE_TIMEOUT = 300; // ms to consider user as "stopped speaking"

function getMessageTypeName(type: MessageType): string {
  return MessageType[type] || `Unknown(${type})`;
}

/**
 * Main client class for connecting to and interacting with Mumble servers.
 *
 * Handles the Mumble protocol including:
 * - TLS connection and authentication
 * - User and channel state management
 * - Voice transmission (UDP with OCB2-AES128 encryption)
 * - Automatic TCP tunnel fallback for voice
 * - Text messaging
 *
 * @example
 * ```typescript
 * const client = new MumbleClient({
 *   host: 'mumble.example.com',
 *   username: 'MyBot',
 * });
 *
 * client.on('ready', () => {
 *   console.log('Connected!');
 *   client.sendMessage('Hello from bot!');
 * });
 *
 * client.on('audio', (session, opusData) => {
 *   // Handle incoming audio
 * });
 *
 * await client.connect();
 * ```
 *
 * @fires MumbleClient#connected - When TLS connection is established
 * @fires MumbleClient#ready - When fully synced and ready to use
 * @fires MumbleClient#disconnected - When disconnected from server
 * @fires MumbleClient#error - When an error occurs
 * @fires MumbleClient#userJoin - When a user joins the server
 * @fires MumbleClient#userLeave - When a user leaves the server
 * @fires MumbleClient#userUpdate - When a user's state changes
 * @fires MumbleClient#channelCreate - When a channel is created
 * @fires MumbleClient#channelRemove - When a channel is removed
 * @fires MumbleClient#channelUpdate - When a channel's state changes
 * @fires MumbleClient#textMessage - When a text message is received
 * @fires MumbleClient#audio - When audio data is received
 * @fires MumbleClient#userStartSpeaking - When a user starts speaking
 * @fires MumbleClient#userStopSpeaking - When a user stops speaking
 */
export class MumbleClient extends EventEmitter {
  private connection: MumbleConnection;
  private udp: MumbleUdp | null = null;
  private options: MumbleClientOptions;
  private debug: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private udpPingInterval: NodeJS.Timeout | null = null;

  // State
  private _session: number = 0;
  private _users: Map<number, MumbleUser> = new Map();
  private _channels: Map<number, MumbleChannel> = new Map();
  private _serverInfo: ServerInfo = {};
  private _ready = false;
  private _syncComplete = false;
  private _speakingUsers: Map<number, NodeJS.Timeout> = new Map();
  private _lastPingTime: number = 0;
  private _lastPongTime: number = 0;
  private _voiceSequence: number = 0;
  private _serverVersion: bigint = 0n;

  // Voice stats tracking
  private _voicePacketsSent: number = 0;

  /**
   * Creates a new MumbleClient instance.
   *
   * @param options - Configuration options for the client
   * @param options.host - Server hostname or IP address
   * @param options.port - Server port (default: 64738)
   * @param options.username - Username to connect with
   * @param options.password - Server password if required
   * @param options.tokens - Access tokens for channel permissions
   * @param options.rejectUnauthorized - Reject invalid TLS certificates (default: false)
   * @param options.key - Client TLS private key for certificate auth
   * @param options.cert - Client TLS certificate for certificate auth
   * @param options.debug - Enable debug logging
   * @param options.logger - Custom logger function
   * @param options.disableUdp - Force TCP tunnel for voice (useful for debugging)
   */
  constructor(options: MumbleClientOptions) {
    super();
    this.options = {
      port: DEFAULT_PORT,
      rejectUnauthorized: false,
      ...options,
    };
    this.debug = options.debug ?? false;
    this.connection = new MumbleConnection();
    this.setupConnectionHandlers();
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
      if (this.options.logger) {
        this.options.logger(`[MumbleClient] ${new Date().toISOString()} ${message}`);
      } else {
        console.log('[MumbleClient]', new Date().toISOString(), ...args);
      }
    }
  }

  private setupConnectionHandlers(): void {
    this.connection.on('connected', () => {
      this.log('TLS connected, sending Version and Authenticate');
      this.sendVersion();
      this.sendAuthenticate();
      this.startPing();
    });

    this.connection.on('disconnected', (reason?: string) => {
      const timeSinceLastPing = this._lastPingTime ? Date.now() - this._lastPingTime : 0;
      const timeSinceLastPong = this._lastPongTime ? Date.now() - this._lastPongTime : 0;
      this.log(`Connection closed: ${reason}. Last ping: ${timeSinceLastPing}ms ago, Last pong: ${timeSinceLastPong}ms ago`);
      this.stopPing();
      this._ready = false;
      this._syncComplete = false;
      this.emit('disconnected', reason);
    });

    this.connection.on('error', (error: Error) => {
      this.log('Connection error:', error.message);
      this.emit('error', error);
    });

    this.connection.on('message', (type: MessageType, data: Buffer) => {
      this.log(`<- Received: ${getMessageTypeName(type)} (${data.length} bytes)`);
      try {
        this.handleMessage(type, data);
      } catch (err) {
        this.emit('error', err as Error);
      }
    });
  }

  /**
   * Connect to the Mumble server.
   * @throws Error if already connected
   */
  async connect(): Promise<void> {
    if (this.connection.isConnected()) {
      throw new Error('Already connected');
    }

    this.log(`Connecting to ${this.options.host}:${this.options.port}`);
    await this.connection.connect({
      host: this.options.host,
      port: this.options.port!,
      rejectUnauthorized: this.options.rejectUnauthorized,
      key: this.options.key,
      cert: this.options.cert,
    });
    this.emit('connected');
  }

  /**
   * Disconnect from the Mumble server.
   * Cleans up all resources including UDP and ping intervals.
   */
  disconnect(): void {
    this.stopPing();
    if (this.udpPingInterval) {
      clearInterval(this.udpPingInterval);
      this.udpPingInterval = null;
    }
    if (this.udp) {
      this.udp.disconnect();
      this.udp = null;
    }
    this.connection.disconnect();
  }

  private sendVersion(): void {
    const payload = encodeVersion({
      release: 'mumble.js 0.1.0',
      os: os.platform(),
      osVersion: os.release(),
    });
    this.log(`-> Sending: Version (${payload.length} bytes)`);
    this.connection.send(MessageType.Version, payload);
  }

  private sendAuthenticate(): void {
    const payload = encodeAuthenticate({
      username: this.options.username,
      password: this.options.password,
      tokens: this.options.tokens,
      opus: true,
    });
    this.log(`-> Sending: Authenticate as "${this.options.username}" (${payload.length} bytes)`);
    this.connection.send(MessageType.Authenticate, payload);
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this._lastPingTime = Date.now();
      const payload = encodePing(this._lastPingTime);
      this.connection.send(MessageType.Ping, payload);
      this.log(`-> Sent ping at ${this._lastPingTime}, last pong was ${this._lastPongTime ? Date.now() - this._lastPongTime : 'never'}ms ago`);
    }, PING_INTERVAL);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleMessage(type: MessageType, data: Buffer): void {
    try {
      const message = decodeMessage(type, data);

      switch (type) {
        case MessageType.Version:
          this.handleServerVersion(message as MumbleProto.IVersion);
          break;

        case MessageType.Reject:
          this.log('  Rejected:', message);
          this.handleReject(message as MumbleProto.IReject);
          break;

        case MessageType.ServerSync:
          this.log('  ServerSync - session:', (message as MumbleProto.IServerSync).session);
          this.handleServerSync(message as MumbleProto.IServerSync);
          break;

        case MessageType.ChannelState:
          this.handleChannelState(message as MumbleProto.IChannelState);
          break;

        case MessageType.ChannelRemove:
          this.handleChannelRemove(message as MumbleProto.IChannelRemove);
          break;

        case MessageType.UserState:
          this.handleUserState(message as MumbleProto.IUserState);
          break;

        case MessageType.UserRemove:
          this.handleUserRemove(message as MumbleProto.IUserRemove);
          break;

        case MessageType.TextMessage:
          this.handleTextMessage(message as MumbleProto.ITextMessage);
          break;

        case MessageType.ServerConfig:
          this.handleServerConfig(message as MumbleProto.IServerConfig);
          break;

        case MessageType.Ping:
          // Respond to server ping to keep connection alive
          this.handlePing(message as MumbleProto.IPing);
          break;

        case MessageType.UDPTunnel:
          // Voice data tunneled over TCP - extract speaker session
          this.handleVoiceData(data);
          break;

        case MessageType.CryptSetup:
          // UDP encryption setup - log raw data for debugging
          this.log(`  CryptSetup raw data: ${data.length} bytes, hex: ${data.slice(0, 20).toString('hex')}${data.length > 20 ? '...' : ''}`);
          this.handleCryptSetup(message as MumbleProto.ICryptSetup);
          break;

        case MessageType.CodecVersion:
          // Codec negotiation - not implementing audio for this library
          break;

        case MessageType.PermissionQuery:
          // Permission information
          break;

        case MessageType.PermissionDenied:
          this.handlePermissionDenied(message as MumbleProto.IPermissionDenied);
          break;

        default:
          // Unhandled message type
          break;
      }
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  private handleServerVersion(message: MumbleProto.IVersion): void {
    // Extract server version - prefer v2 format, fall back to v1
    if (message.versionV2) {
      // versionV2 might be a Long object
      const v2 = message.versionV2;
      if (typeof v2 === 'object' && 'toNumber' in v2) {
        this._serverVersion = BigInt(v2.toString());
      } else {
        this._serverVersion = BigInt(v2);
      }
    } else if (message.versionV1) {
      // Convert v1 format to v2: (major << 48) | (minor << 32) | (patch << 16)
      const v1 = message.versionV1;
      const major = (v1 >> 16) & 0xFFFF;
      const minor = (v1 >> 8) & 0xFF;
      const patch = v1 & 0xFF;
      this._serverVersion = (BigInt(major) << 48n) | (BigInt(minor) << 32n) | (BigInt(patch) << 16n);
    }

    // Log server info
    const major = Number(this._serverVersion >> 48n);
    const minor = Number((this._serverVersion >> 32n) & 0xFFFFn);
    const patch = Number((this._serverVersion >> 16n) & 0xFFFFn);
    const useProtobuf = this._serverVersion >= MumbleClient.PROTOBUF_INTRODUCTION_VERSION;
    this.log(`  Server version: ${major}.${minor}.${patch} (release: ${message.release}, os: ${message.os})`);
    this.log(`  Audio format: ${useProtobuf ? 'PROTOBUF (1.5.0+)' : 'LEGACY (pre-1.5.0)'}`);
  }

  private handleReject(message: MumbleProto.IReject): void {
    const rejectType = (message.type ?? 0) as RejectType;
    this.emit('rejected', rejectType, message.reason ?? undefined);
    this.disconnect();
  }

  private handleServerSync(message: MumbleProto.IServerSync): void {
    this._session = message.session ?? 0;
    this._serverInfo.welcomeText = message.welcomeText ?? undefined;
    this._serverInfo.maxBandwidth = message.maxBandwidth ?? undefined;

    this._syncComplete = true;
    this._ready = true;
    this.emit('ready');
  }

  private handleChannelState(message: MumbleProto.IChannelState): void {
    const channelId = message.channelId ?? 0;
    const existing = this._channels.get(channelId);

    // Helper to check if field is explicitly set (not just default value)
    const hasField = (obj: object, key: string): boolean =>
      Object.prototype.hasOwnProperty.call(obj, key) &&
      (obj as Record<string, unknown>)[key] !== null &&
      (obj as Record<string, unknown>)[key] !== undefined;

    // For root channel (ID 0), parent should be undefined
    let parent: number | undefined;
    if (hasField(message, 'parent')) {
      parent = message.parent!;
    } else {
      parent = existing?.parent;
    }

    const channel: MumbleChannel = {
      channelId,
      parent,
      name: hasField(message, 'name') ? message.name! : (existing?.name ?? ''),
      description: hasField(message, 'description') ? message.description! : existing?.description,
      temporary: hasField(message, 'temporary') ? message.temporary! : (existing?.temporary ?? false),
      position: hasField(message, 'position') ? message.position! : (existing?.position ?? 0),
      maxUsers: hasField(message, 'maxUsers') ? message.maxUsers! : (existing?.maxUsers ?? 0),
      links: (message.links && message.links.length > 0) ? message.links : (existing?.links ?? []),
      isEnterRestricted: hasField(message, 'isEnterRestricted') ? message.isEnterRestricted! : (existing?.isEnterRestricted ?? false),
      canEnter: hasField(message, 'canEnter') ? message.canEnter! : (existing?.canEnter ?? true),
    };

    this._channels.set(channelId, channel);

    if (existing) {
      this.emit('channelUpdate', channel, existing);
    } else {
      this.emit('channelCreate', channel);
    }
  }

  private handleChannelRemove(message: MumbleProto.IChannelRemove): void {
    const channelId = message.channelId;
    const channel = this._channels.get(channelId);
    if (channel) {
      this._channels.delete(channelId);
      this.emit('channelRemove', channel);
    }
  }

  private handleUserState(message: MumbleProto.IUserState): void {
    const session = message.session ?? 0;
    const existing = this._users.get(session);

    // Helper to check if field is explicitly set
    const hasField = (obj: object, key: string): boolean =>
      Object.prototype.hasOwnProperty.call(obj, key) &&
      (obj as Record<string, unknown>)[key] !== null &&
      (obj as Record<string, unknown>)[key] !== undefined;

    const user: MumbleUser = {
      session,
      userId: hasField(message, 'userId') ? message.userId! : existing?.userId,
      name: hasField(message, 'name') ? message.name! : (existing?.name ?? ''),
      channelId: hasField(message, 'channelId') ? message.channelId! : (existing?.channelId ?? 0),
      mute: hasField(message, 'mute') ? message.mute! : (existing?.mute ?? false),
      deaf: hasField(message, 'deaf') ? message.deaf! : (existing?.deaf ?? false),
      suppress: hasField(message, 'suppress') ? message.suppress! : (existing?.suppress ?? false),
      selfMute: hasField(message, 'selfMute') ? message.selfMute! : (existing?.selfMute ?? false),
      selfDeaf: hasField(message, 'selfDeaf') ? message.selfDeaf! : (existing?.selfDeaf ?? false),
      prioritySpeaker: hasField(message, 'prioritySpeaker') ? message.prioritySpeaker! : (existing?.prioritySpeaker ?? false),
      recording: hasField(message, 'recording') ? message.recording! : (existing?.recording ?? false),
      comment: hasField(message, 'comment') ? message.comment! : existing?.comment,
      hash: hasField(message, 'hash') ? message.hash! : existing?.hash,
    };

    this._users.set(session, user);

    if (existing) {
      this.emit('userUpdate', user, existing);
    } else {
      this.emit('userJoin', user);
    }
  }

  private handleUserRemove(message: MumbleProto.IUserRemove): void {
    const session = message.session;
    const user = this._users.get(session);
    this.log(`  UserRemove: session=${session}, reason="${message.reason}", actor=${message.actor}, ban=${message.ban}`);
    if (user) {
      this._users.delete(session);
      this.emit('userLeave', user, message.reason ?? undefined);
    }
    // Check if we were kicked
    if (session === this._session) {
      this.log(`  WE WERE KICKED! Reason: ${message.reason}`);
    }
  }

  private handleTextMessage(message: MumbleProto.ITextMessage): void {
    const textMessage: TextMessage = {
      actor: message.actor ?? undefined,
      session: message.session ?? [],
      channelId: message.channelId ?? [],
      treeId: message.treeId ?? [],
      message: message.message ?? '',
    };
    this.emit('textMessage', textMessage);
  }

  private handleServerConfig(message: MumbleProto.IServerConfig): void {
    this._serverInfo = {
      ...this._serverInfo,
      maxBandwidth: message.maxBandwidth ?? this._serverInfo.maxBandwidth,
      welcomeText: message.welcomeText ?? this._serverInfo.welcomeText,
      allowHtml: message.allowHtml ?? this._serverInfo.allowHtml,
      messageLength: message.messageLength ?? this._serverInfo.messageLength,
      imageMessageLength: message.imageMessageLength ?? this._serverInfo.imageMessageLength,
      maxUsers: message.maxUsers ?? this._serverInfo.maxUsers,
      recordingAllowed: message.recordingAllowed ?? this._serverInfo.recordingAllowed,
    };
  }

  private handlePermissionDenied(message: MumbleProto.IPermissionDenied): void {
    this.emit('error', new Error(`Permission denied: ${message.reason ?? 'Unknown reason'}`));
  }

  private handlePing(message: MumbleProto.IPing): void {
    // Server ping received - just track it for stats, don't respond
    // The client sends its own periodic pings to keep connection alive
    this._lastPongTime = Date.now();
    this.log(`  Server ping received, timestamp: ${message.timestamp}`);
  }

  private handleCryptSetup(message: MumbleProto.ICryptSetup): void {
    // Log what we received for debugging
    const keyLen = message.key?.length ?? 0;
    const clientNonceLen = message.clientNonce?.length ?? 0;
    const serverNonceLen = message.serverNonce?.length ?? 0;
    this.log(`  CryptSetup: key=${keyLen}b, clientNonce=${clientNonceLen}b, serverNonce=${serverNonceLen}b, udp=${this.udp ? 'exists' : 'null'}`);

    // Empty CryptSetup = server requesting our encrypt IV for resync
    if (keyLen === 0 && clientNonceLen === 0 && serverNonceLen === 0) {
      if (this.udp) {
        const encryptIV = this.udp.getEncryptIV();
        if (encryptIV) {
          this.log('  CryptSetup: Server requested resync, sending our encrypt IV');
          const resync = MumbleProto.CryptSetup.create({
            clientNonce: encryptIV,
          });
          const payload = MumbleProto.CryptSetup.encode(resync).finish();
          this.connection.send(MessageType.CryptSetup, payload);
        } else {
          this.log('  CryptSetup: Resync request but no encrypt IV available');
        }
      } else {
        this.log('  CryptSetup: Nonce resync request but no UDP initialized yet');
      }
      return;
    }

    // Server sent only server_nonce = resync response with new decrypt IV
    if (keyLen === 0 && clientNonceLen === 0 && serverNonceLen === 16) {
      if (this.udp && message.serverNonce) {
        this.log('  CryptSetup: Server sent resync with new decrypt IV');
        const success = this.udp.setDecryptIV(Buffer.from(message.serverNonce));
        this.log(`  CryptSetup: setDecryptIV ${success ? 'succeeded' : 'failed'}`);
      }
      return;
    }

    // Server sent UDP encryption setup
    if (!message.key || !message.clientNonce || !message.serverNonce) {
      this.log('  CryptSetup received but missing keys, skipping UDP setup');
      return;
    }

    // Validate key sizes (must be 16 bytes for AES-128)
    if (message.key.length !== 16 || message.clientNonce.length !== 16 || message.serverNonce.length !== 16) {
      this.log(`  CryptSetup received but invalid key sizes (key=${message.key.length}, clientNonce=${message.clientNonce.length}, serverNonce=${message.serverNonce.length}), skipping UDP setup`);
      return;
    }

    // Check if UDP is disabled (force TCP tunnel)
    if (this.options.disableUdp) {
      this.log('  CryptSetup received but UDP disabled, using TCP tunnel only');
      return;
    }

    this.log('  CryptSetup received with valid keys, initializing UDP');

    // Initialize UDP with encryption keys
    const key = Buffer.from(message.key);
    const clientNonce = Buffer.from(message.clientNonce);
    const serverNonce = Buffer.from(message.serverNonce);

    this.udp = new MumbleUdp({
      host: this.options.host,
      port: this.options.port!,
    });

    this.udp.setupCrypto(key, clientNonce, serverNonce);

    this.udp.on('voice', (data: { session: number; type: number; data: Buffer }) => {
      this.log(`  UDP voice from session ${data.session}`);
      this.handleVoiceData(data.data);
    });

    this.udp.on('error', (err: Error) => {
      this.log(`  UDP error: ${err.message}`);
    });

    this.udp.on('established', () => {
      this.log('  UDP connection established - server responded');
    });

    // Connect UDP
    this.udp.connect()
      .then(() => {
        this.log('  UDP connected, starting UDP ping');
        // Send periodic UDP pings to keep NAT mapping alive
        this.udpPingInterval = setInterval(() => {
          this.udp?.sendPing();
        }, 5000);
      })
      .catch((err) => {
        this.log(`  UDP connection failed: ${err.message}`);
        // Will fall back to TCP tunneling
      });
  }

  private handleVoiceData(data: Buffer): void {
    if (data.length < 2) return;

    const messageType = data[0];

    // Check if this is the new protobuf format (1.5.0+)
    // Type 0 = Audio, Type 1 = Ping in new format
    // In legacy format, first byte has type in upper 3 bits (so Opus = 4 << 5 = 128)
    if (messageType < 32) {
      // New protobuf format
      this.handleVoiceDataProtobuf(data);
    } else {
      // Legacy format
      this.handleVoiceDataLegacy(data);
    }
  }

  private handleVoiceDataProtobuf(data: Buffer): void {
    const messageType = data[0];

    if (messageType === 1) {
      // Ping packet, ignore
      return;
    }

    if (messageType !== 0) {
      this.log(`Unknown UDP message type: ${messageType}`);
      return;
    }

    try {
      const audioMessage = MumbleUDP.Audio.decode(data.slice(1));
      const session = audioMessage.senderSession || 0;

      this.log(`Voice (protobuf): session=${session}, frame=${audioMessage.frameNumber}, opus=${audioMessage.opusData?.length || 0}`);

      if (session > 0) {
        this.markUserSpeaking(session);

        if (audioMessage.opusData && audioMessage.opusData.length > 0) {
          const opusData = Buffer.from(audioMessage.opusData);
          this.log(`  Emitting audio: ${opusData.length} bytes`);
          this.emit('audio', session, opusData);
        }
      }
    } catch (err) {
      this.log(`Failed to decode protobuf audio: ${err}`);
    }
  }

  private handleVoiceDataLegacy(data: Buffer): void {
    // Legacy voice packet format: [type+target:1] [session:varint] [sequence:varint] [opus_header:varint] [audio...]
    // Type is in upper 3 bits of first byte, target is lower 5 bits
    const typeTarget = data[0];
    const type = (typeTarget >> 5) & 0x07;

    // Types: 0=CELT Alpha, 1=Ping, 2=Speex, 3=CELT Beta, 4=Opus
    if (type === 1) return; // Ping packet, ignore

    // Parse Mumble varint for session ID (starts at byte 1)
    // Mumble uses custom MSB-first varint encoding
    let offset = 1;
    const { value: session, bytesRead: sessionBytes } = this.readMumbleVarint(data, offset);
    offset += sessionBytes;

    // Parse sequence number
    const { value: _sequence, bytesRead: seqBytes } = this.readMumbleVarint(data, offset);
    offset += seqBytes;

    this.log(`Voice (legacy): type=${type}, session=${session}, offset=${offset}, datalen=${data.length}`);

    if (session > 0) {
      this.markUserSpeaking(session);

      // For Opus (type 4), extract audio data
      if (type === 4 && offset < data.length) {
        // Read opus header (contains length and termination flag)
        const { value: opusHeader, bytesRead: headerBytes } = this.readMumbleVarint(data, offset);
        offset += headerBytes;

        // Length is in lower 13 bits, termination flag in bit 13
        const opusLength = opusHeader & 0x1FFF;

        this.log(`  Opus: header=${opusHeader}, length=${opusLength}, remaining=${data.length - offset}`);

        if (opusLength > 0 && offset + opusLength <= data.length) {
          const opusData = data.slice(offset, offset + opusLength);
          this.log(`  Emitting audio: ${opusData.length} bytes`);
          this.emit('audio', session, opusData);
        }
      }
    }
  }

  private readMumbleVarint(data: Buffer, offset: number): { value: number; bytesRead: number } {
    // Mumble custom varint encoding (MSB-first):
    // 0xxxxxxx - 7 bit positive
    // 10xxxxxx + 1 byte - 14 bit positive
    // 110xxxxx + 2 bytes - 21 bit positive
    // 1110xxxx + 3 bytes - 28 bit positive
    // 11110xxx + 4 bytes - 32 bit positive
    // 111110__ + 4 bytes - 32 bit negative (recursive)
    // 111111xx - special: byte count or negative recursive

    if (offset >= data.length) return { value: 0, bytesRead: 0 };

    const v = data[offset];

    if ((v & 0x80) === 0x00) {
      // 0xxxxxxx - 7 bit value
      return { value: v & 0x7F, bytesRead: 1 };
    } else if ((v & 0xC0) === 0x80) {
      // 10xxxxxx - 14 bit value
      if (offset + 1 >= data.length) return { value: 0, bytesRead: 1 };
      return { value: ((v & 0x3F) << 8) | data[offset + 1], bytesRead: 2 };
    } else if ((v & 0xE0) === 0xC0) {
      // 110xxxxx - 21 bit value
      if (offset + 2 >= data.length) return { value: 0, bytesRead: 1 };
      return {
        value: ((v & 0x1F) << 16) | (data[offset + 1] << 8) | data[offset + 2],
        bytesRead: 3,
      };
    } else if ((v & 0xF0) === 0xE0) {
      // 1110xxxx - 28 bit value
      if (offset + 3 >= data.length) return { value: 0, bytesRead: 1 };
      return {
        value: ((v & 0x0F) << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3],
        bytesRead: 4,
      };
    } else if ((v & 0xF8) === 0xF0) {
      // 11110xxx - 32 bit value
      if (offset + 4 >= data.length) return { value: 0, bytesRead: 1 };
      return {
        value: (data[offset + 1] << 24) | (data[offset + 2] << 16) | (data[offset + 3] << 8) | data[offset + 4],
        bytesRead: 5,
      };
    }

    // Fallback for negative or special values
    return { value: 0, bytesRead: 1 };
  }

  private markUserSpeaking(session: number): void {
    const wasSpeaking = this._speakingUsers.has(session);

    // Clear existing timeout
    const existingTimeout = this._speakingUsers.get(session);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this._speakingUsers.delete(session);
      this.emit('userStopSpeaking', session);
    }, VOICE_TIMEOUT);

    this._speakingUsers.set(session, timeout);

    if (!wasSpeaking) {
      this.emit('userStartSpeaking', session);
    }
  }

  // ============================================
  // Public API
  // ============================================

  /** The session ID assigned by the server for this client. */
  get session(): number {
    return this._session;
  }

  /** Map of all users on the server, keyed by session ID. Returns a copy. */
  get users(): Map<number, MumbleUser> {
    return new Map(this._users);
  }

  /** Map of all channels on the server, keyed by channel ID. Returns a copy. */
  get channels(): Map<number, MumbleChannel> {
    return new Map(this._channels);
  }

  /** Server configuration and information. */
  get serverInfo(): ServerInfo {
    return { ...this._serverInfo };
  }

  /** Whether the client has completed initial sync and is ready for use. */
  get isReady(): boolean {
    return this._ready;
  }

  /** The current user (this client's user object), or undefined if not yet synced. */
  get self(): MumbleUser | undefined {
    return this._users.get(this._session);
  }

  /**
   * Get a user by their session ID.
   * @param session - The user's session ID
   * @returns The user object or undefined if not found
   */
  getUser(session: number): MumbleUser | undefined {
    return this._users.get(session);
  }

  /**
   * Get a channel by its ID.
   * @param channelId - The channel ID
   * @returns The channel object or undefined if not found
   */
  getChannel(channelId: number): MumbleChannel | undefined {
    return this._channels.get(channelId);
  }

  /**
   * Get all users in a specific channel.
   * @param channelId - The channel ID
   * @returns Array of users in the channel
   */
  getUsersInChannel(channelId: number): MumbleUser[] {
    return Array.from(this._users.values()).filter((u) => u.channelId === channelId);
  }

  /**
   * Get all direct sub-channels of a channel.
   * @param channelId - The parent channel ID
   * @returns Array of child channels
   */
  getSubChannels(channelId: number): MumbleChannel[] {
    return Array.from(this._channels.values()).filter((c) => {
      // Don't include channel as its own child
      if (c.channelId === channelId) return false;
      // Match parent
      return c.parent === channelId;
    });
  }

  /**
   * Get the root channel (channel ID 0).
   * @returns The root channel or undefined if not yet loaded
   */
  getRootChannel(): MumbleChannel | undefined {
    return this._channels.get(0);
  }

  /**
   * Send a text message to a channel.
   * @param message - The message content
   * @param channelId - Optional channel ID. If omitted, sends to current channel.
   */
  sendMessage(message: string, channelId?: number): void {
    const channels = channelId !== undefined ? [channelId] : [];
    const payload = encodeTextMessage(message, channels);
    this.connection.send(MessageType.TextMessage, payload);
  }

  /**
   * Send a private message to a specific user.
   * @param message - The message content
   * @param session - The target user's session ID
   */
  sendPrivateMessage(message: string, session: number): void {
    const payload = encodeTextMessage(message, [], [session]);
    this.connection.send(MessageType.TextMessage, payload);
  }

  /**
   * Move this client to a different channel.
   * @param channelId - The target channel ID
   */
  moveToChannel(channelId: number): void {
    const payload = encodeUserState({
      session: this._session,
      channelId,
    });
    this.connection.send(MessageType.UserState, payload);
  }

  /**
   * Set this client's self-mute state.
   * @param mute - Whether to mute
   */
  setSelfMute(mute: boolean): void {
    const payload = encodeUserState({
      session: this._session,
      selfMute: mute,
    });
    this.connection.send(MessageType.UserState, payload);
  }

  /**
   * Set this client's self-deaf state.
   * @param deaf - Whether to deafen
   */
  setSelfDeaf(deaf: boolean): void {
    const payload = encodeUserState({
      session: this._session,
      selfDeaf: deaf,
    });
    this.connection.send(MessageType.UserState, payload);
  }

  /**
   * Set up a voice target for whispering to specific channels/users.
   * @param targetId - Voice target ID (1-30). Use this ID in sendAudio() to send to this target.
   * @param channelId - Channel to whisper to
   * @param options - Additional options
   * @param options.links - If true, also send to linked channels (default: false)
   * @param options.children - If true, also send to child channels (default: false)
   */
  setVoiceTarget(
    targetId: number,
    channelId: number,
    options: { links?: boolean; children?: boolean } = {}
  ): void {
    if (targetId < 1 || targetId > 30) {
      throw new Error('Voice target ID must be between 1 and 30');
    }

    const target = MumbleProto.VoiceTarget.Target.create({
      channelId: channelId,
      links: options.links ?? false,
      children: options.children ?? false,
    });

    const voiceTarget = MumbleProto.VoiceTarget.create({
      id: targetId,
      targets: [target],
    });

    const payload = MumbleProto.VoiceTarget.encode(voiceTarget).finish();
    this.connection.send(MessageType.VoiceTarget, payload);
    this.log(`[setVoiceTarget] Set target ${targetId} to channel ${channelId} (links: ${options.links ?? false}, children: ${options.children ?? false})`);
  }

  /**
   * Set up voice target 1 to whisper to the current channel only (no linked channels).
   * Call this after joining a channel to enable whisper mode.
   */
  setupWhisperToCurrentChannel(): void {
    const self = this.self;
    if (!self) {
      this.log('[setupWhisperToCurrentChannel] Not connected yet');
      return;
    }
    this.setVoiceTarget(1, self.channelId, { links: false, children: false });
  }

  /**
   * Check if a user is currently speaking.
   * @param session - The user's session ID
   * @returns True if the user is currently speaking
   */
  isUserSpeaking(session: number): boolean {
    return this._speakingUsers.has(session);
  }

  /** Array of session IDs of users currently speaking. */
  get speakingUsers(): number[] {
    return Array.from(this._speakingUsers.keys());
  }

  // Mumble 1.5.0 version in v2 format: (1 << 48) | (5 << 32) | (0 << 16)
  private static readonly PROTOBUF_INTRODUCTION_VERSION = 281496451547136n;

  /**
   * Send Opus audio data to the server.
   * Automatically uses protobuf format for servers >= 1.5.0, legacy format otherwise.
   * @param opusData - Encoded Opus frame (should be 10-60ms of audio)
   * @param isLastFrame - Set to true for the final frame in a transmission
   * @param target - Voice target (0 = normal talking, 31 = server loopback)
   */
  sendAudio(opusData: Buffer, isLastFrame: boolean = false, target: number = 0): void {
    if (!this._ready) {
      this.log('[sendAudio] Not ready, skipping');
      return;
    }

    const useUdp = this.udp?.isConnected() ?? false;

    // TCP backpressure handling: skip audio frames when buffer is full
    // Always send terminator frames to properly end the transmission
    if (!useUdp && !isLastFrame && this.connection.isBackpressured()) {
      this.log('[sendAudio] TCP backpressure, dropping frame');
      return;
    }

    // Check server version to determine format
    const useProtobuf = this._serverVersion >= MumbleClient.PROTOBUF_INTRODUCTION_VERSION;

    // Increment sequence only after all checks pass (prevents gaps on dropped frames)
    const sequence = this._voiceSequence++;
    this._voicePacketsSent++;

    let packet: Buffer;

    if (useProtobuf) {
      // Protobuf audio format (Mumble 1.5.0+)
      const audioMessage = MumbleUDP.Audio.create({
        target: target,
        frameNumber: sequence,
        opusData: opusData,
        isTerminator: isLastFrame,
      });

      const audioPayload = MumbleUDP.Audio.encode(audioMessage).finish();

      // UDP packet format: [type:1] [protobuf data]
      // Type 0 = Audio, Type 1 = Ping
      packet = Buffer.alloc(1 + audioPayload.length);
      packet[0] = 0; // Audio message type
      Buffer.from(audioPayload).copy(packet, 1);

      const transport = useUdp ? 'UDP' : 'TCP';
      this.log(`[sendAudio] Sending ${packet.length} bytes PROTOBUF via ${transport} (opus: ${opusData.length}, seq: ${sequence}, last: ${isLastFrame})`);
    } else {
      // Legacy audio format (Mumble < 1.5.0)
      packet = this.buildLegacyAudioPacketWithSeq(opusData, isLastFrame, target, sequence);
      const transport = useUdp ? 'UDP' : 'TCP';
      this.log(`[sendAudio] Sending ${packet.length} bytes LEGACY via ${transport} (opus: ${opusData.length}, seq: ${sequence}, last: ${isLastFrame})`);
    }

    // Prefer UDP if available, fall back to TCP tunnel
    if (useUdp) {
      this.udp!.send(packet);
    } else {
      // Fall back to TCP tunnel (UDPTunnel message type)
      this.connection.send(MessageType.UDPTunnel, packet);
    }
  }

  /**
   * Build a legacy format audio packet (pre-1.5.0).
   * Format: [header:1] [sequence:varint] [opus_header:varint] [opus_data]
   */
  private buildLegacyAudioPacketWithSeq(opusData: Buffer, isLastFrame: boolean, target: number, sequence: number): Buffer {
    // Header byte: type (3 bits) | target (5 bits)
    // Type 4 = Opus
    const headerByte = (4 << 5) | (target & 0x1F);

    // Sequence number as varint
    const seqVarint = this.writeMumbleVarint(sequence);

    // Opus header: length with terminator bit at bit 13, as varint
    let opusHeader = opusData.length;
    if (isLastFrame) {
      opusHeader |= 0x2000; // Set terminator bit (bit 13)
    }
    const opusHeaderVarint = this.writeMumbleVarint(opusHeader);

    // Combine: header + sequence + opus header + opus data
    return Buffer.concat([
      Buffer.from([headerByte]),
      seqVarint,
      opusHeaderVarint,
      opusData,
    ]);
  }

  /**
   * Write a value as Mumble's MSB-first varint encoding.
   */
  private writeMumbleVarint(value: number): Buffer {
    if (value < 0x80) {
      // 7 bits: 0xxxxxxx
      return Buffer.from([value]);
    } else if (value < 0x4000) {
      // 14 bits: 10xxxxxx xxxxxxxx
      return Buffer.from([
        0x80 | ((value >> 8) & 0x3F),
        value & 0xFF,
      ]);
    } else if (value < 0x200000) {
      // 21 bits: 110xxxxx xxxxxxxx xxxxxxxx
      return Buffer.from([
        0xC0 | ((value >> 16) & 0x1F),
        (value >> 8) & 0xFF,
        value & 0xFF,
      ]);
    } else if (value < 0x10000000) {
      // 28 bits: 1110xxxx xxxxxxxx xxxxxxxx xxxxxxxx
      return Buffer.from([
        0xE0 | ((value >> 24) & 0x0F),
        (value >> 16) & 0xFF,
        (value >> 8) & 0xFF,
        value & 0xFF,
      ]);
    } else {
      // 32 bits: 11110xxx xxxxxxxx xxxxxxxx xxxxxxxx xxxxxxxx
      return Buffer.from([
        0xF0,
        (value >> 24) & 0xFF,
        (value >> 16) & 0xFF,
        (value >> 8) & 0xFF,
        value & 0xFF,
      ]);
    }
  }

  // Type-safe event emitter
  on<K extends keyof MumbleEvents>(event: K, listener: MumbleEvents[K]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof MumbleEvents>(event: K, listener: MumbleEvents[K]): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  emit<K extends keyof MumbleEvents>(event: K, ...args: Parameters<MumbleEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
