/**
 * Mumble Protocol Types
 *
 * Type definitions for Mumble protocol entities.
 */

/**
 * Represents a user connected to the Mumble server.
 */
export interface MumbleUser {
  /** Unique session ID assigned by the server (changes on reconnect). */
  session: number;
  /** Permanent user ID (only set for registered users). */
  userId?: number;
  /** Display name of the user. */
  name: string;
  /** ID of the channel the user is currently in. */
  channelId: number;
  /** Whether the user is muted by an admin. */
  mute: boolean;
  /** Whether the user is deafened by an admin. */
  deaf: boolean;
  /** Whether the user is suppressed (cannot transmit). */
  suppress: boolean;
  /** Whether the user has self-muted. */
  selfMute: boolean;
  /** Whether the user has self-deafened. */
  selfDeaf: boolean;
  /** Whether the user has priority speaker status. */
  prioritySpeaker: boolean;
  /** Whether the user is recording. */
  recording: boolean;
  /** User's comment/description. */
  comment?: string;
  /** SHA-1 hash of the user's certificate (for identification). */
  hash?: string;
}

/**
 * Represents a channel on the Mumble server.
 */
export interface MumbleChannel {
  /** Unique channel ID. Root channel is always 0. */
  channelId: number;
  /** Parent channel ID. Undefined for root channel. */
  parent?: number;
  /** Display name of the channel. */
  name: string;
  /** Channel description (may contain HTML). */
  description?: string;
  /** Whether this is a temporary channel. */
  temporary: boolean;
  /** Sort position relative to siblings. */
  position: number;
  /** Maximum number of users allowed (0 = unlimited). */
  maxUsers: number;
  /** Array of linked channel IDs. */
  links: number[];
  /** Whether entering requires permission. */
  isEnterRestricted: boolean;
  /** Whether the current user can enter this channel. */
  canEnter: boolean;
}

/**
 * Server configuration and information.
 */
export interface ServerInfo {
  /** Welcome message displayed on connect (may contain HTML). */
  welcomeText?: string;
  /** Maximum bandwidth per user in bits/second. */
  maxBandwidth?: number;
  /** Whether HTML is allowed in messages. */
  allowHtml?: boolean;
  /** Maximum text message length. */
  messageLength?: number;
  /** Maximum image message length. */
  imageMessageLength?: number;
  /** Maximum number of users on the server. */
  maxUsers?: number;
  /** Whether recording is allowed. */
  recordingAllowed?: boolean;
}

/**
 * Options for creating a MumbleClient.
 */
export interface MumbleClientOptions {
  /** Server hostname or IP address. */
  host: string;
  /** Server port (default: 64738). */
  port?: number;
  /** Username to connect with. */
  username: string;
  /** Server password (if required). */
  password?: string;
  /** Access tokens for channel permissions. */
  tokens?: string[];
  /** Whether to reject unauthorized TLS certificates (default: false). */
  rejectUnauthorized?: boolean;
  /** Client TLS private key for certificate authentication. */
  key?: string | Buffer;
  /** Client TLS certificate for certificate authentication. */
  cert?: string | Buffer;
  /** Enable debug logging. */
  debug?: boolean;
  /** Custom logger function. */
  logger?: (message: string) => void;
  /** Disable UDP and force TCP tunnel for voice (useful for debugging). */
  disableUdp?: boolean;
}

export enum MessageType {
  Version = 0,
  UDPTunnel = 1,
  Authenticate = 2,
  Ping = 3,
  Reject = 4,
  ServerSync = 5,
  ChannelRemove = 6,
  ChannelState = 7,
  UserRemove = 8,
  UserState = 9,
  BanList = 10,
  TextMessage = 11,
  PermissionDenied = 12,
  ACL = 13,
  QueryUsers = 14,
  CryptSetup = 15,
  ContextActionModify = 16,
  ContextAction = 17,
  UserList = 18,
  VoiceTarget = 19,
  PermissionQuery = 20,
  CodecVersion = 21,
  UserStats = 22,
  RequestBlob = 23,
  ServerConfig = 24,
  SuggestConfig = 25,
  PluginDataTransmission = 26,
}

export enum RejectType {
  None = 0,
  WrongVersion = 1,
  InvalidUsername = 2,
  WrongUserPW = 3,
  WrongServerPW = 4,
  UsernameInUse = 5,
  ServerFull = 6,
  NoCertificate = 7,
  AuthenticatorFail = 8,
  NoNewConnections = 9,
}

/**
 * Event signatures for MumbleClient.
 * Use with client.on() and client.once().
 */
export interface MumbleEvents {
  /** Emitted when TLS connection is established (before authentication). */
  connected: () => void;
  /** Emitted when disconnected from server. */
  disconnected: (reason?: string) => void;
  /** Emitted on connection or protocol errors. */
  error: (error: Error) => void;
  /** Emitted when fully connected and synced (safe to use API). */
  ready: () => void;
  /** Emitted when a user joins the server. */
  userJoin: (user: MumbleUser) => void;
  /** Emitted when a user leaves the server. */
  userLeave: (user: MumbleUser, reason?: string) => void;
  /** Emitted when a user's state changes (channel, mute, etc.). */
  userUpdate: (user: MumbleUser, oldUser: MumbleUser) => void;
  /** Emitted when a channel is created. */
  channelCreate: (channel: MumbleChannel) => void;
  /** Emitted when a channel is removed. */
  channelRemove: (channel: MumbleChannel) => void;
  /** Emitted when a channel's state changes. */
  channelUpdate: (channel: MumbleChannel, oldChannel: MumbleChannel) => void;
  /** Emitted when a text message is received. */
  textMessage: (message: TextMessage) => void;
  /** Emitted when connection is rejected by server. */
  rejected: (type: RejectType, reason?: string) => void;
  /** Emitted when a user starts speaking. */
  userStartSpeaking: (session: number) => void;
  /** Emitted when a user stops speaking. */
  userStopSpeaking: (session: number) => void;
  /** Emitted when audio data is received (Opus encoded). */
  audio: (session: number, opusData: Buffer) => void;
}

/**
 * A text message received from the server.
 */
export interface TextMessage {
  /** Session ID of the sender. */
  actor?: number;
  /** Target session IDs (for private messages). */
  session: number[];
  /** Target channel IDs. */
  channelId: number[];
  /** Target tree IDs (channel and all sub-channels). */
  treeId: number[];
  /** Message content (may contain HTML if allowed). */
  message: string;
}
