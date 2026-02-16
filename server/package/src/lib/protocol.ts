/**
 * Mumble Protocol Message Handling
 *
 * Handles encoding/decoding of protobuf messages.
 */

import { MumbleProto } from '../proto/mumble';
import { MessageType } from './types';

// Mumble protocol version: 1.5.0
// v1 format (legacy): (major << 16) | (minor << 8) | patch - fits in uint32
// v2 format (new): (major << 48) | (minor << 32) | (patch << 16) - requires uint64
const PROTOCOL_VERSION_V1 = (1 << 16) | (5 << 8) | 0;  // 1.5.0

// For v2, we need to use BigInt since JS can't do 64-bit bitwise ops
// v2 = (1n << 48n) | (5n << 32n) | (0n << 16n) = 281492156579840
import Long from 'long';
const PROTOCOL_VERSION_V2 = Long.fromString('281496451547136'); // 1.5.0 in v2 format

export interface VersionInfo {
  release: string;
  os: string;
  osVersion: string;
}

export type MessagePayload =
  | MumbleProto.IVersion
  | MumbleProto.IAuthenticate
  | MumbleProto.IPing
  | MumbleProto.IReject
  | MumbleProto.IServerSync
  | MumbleProto.IChannelRemove
  | MumbleProto.IChannelState
  | MumbleProto.IUserRemove
  | MumbleProto.IUserState
  | MumbleProto.ITextMessage
  | MumbleProto.IServerConfig
  | MumbleProto.ICryptSetup
  | MumbleProto.ICodecVersion
  | MumbleProto.IPermissionQuery
  | MumbleProto.IPermissionDenied
  | MumbleProto.IBanList
  | MumbleProto.IACL
  | MumbleProto.IQueryUsers
  | MumbleProto.IContextActionModify
  | MumbleProto.IContextAction
  | MumbleProto.IUserList
  | MumbleProto.IVoiceTarget
  | MumbleProto.IUserStats
  | MumbleProto.IRequestBlob
  | MumbleProto.ISuggestConfig
  | MumbleProto.IPluginDataTransmission;

const messageDecoders: Record<MessageType, (data: Uint8Array) => MessagePayload> = {
  [MessageType.Version]: (data) => MumbleProto.Version.decode(data),
  [MessageType.UDPTunnel]: () => ({}),
  [MessageType.Authenticate]: (data) => MumbleProto.Authenticate.decode(data),
  [MessageType.Ping]: (data) => MumbleProto.Ping.decode(data),
  [MessageType.Reject]: (data) => MumbleProto.Reject.decode(data),
  [MessageType.ServerSync]: (data) => MumbleProto.ServerSync.decode(data),
  [MessageType.ChannelRemove]: (data) => MumbleProto.ChannelRemove.decode(data),
  [MessageType.ChannelState]: (data) => MumbleProto.ChannelState.decode(data),
  [MessageType.UserRemove]: (data) => MumbleProto.UserRemove.decode(data),
  [MessageType.UserState]: (data) => MumbleProto.UserState.decode(data),
  [MessageType.BanList]: (data) => MumbleProto.BanList.decode(data),
  [MessageType.TextMessage]: (data) => MumbleProto.TextMessage.decode(data),
  [MessageType.PermissionDenied]: (data) => MumbleProto.PermissionDenied.decode(data),
  [MessageType.ACL]: (data) => MumbleProto.ACL.decode(data),
  [MessageType.QueryUsers]: (data) => MumbleProto.QueryUsers.decode(data),
  [MessageType.CryptSetup]: (data) => MumbleProto.CryptSetup.decode(data),
  [MessageType.ContextActionModify]: (data) => MumbleProto.ContextActionModify.decode(data),
  [MessageType.ContextAction]: (data) => MumbleProto.ContextAction.decode(data),
  [MessageType.UserList]: (data) => MumbleProto.UserList.decode(data),
  [MessageType.VoiceTarget]: (data) => MumbleProto.VoiceTarget.decode(data),
  [MessageType.PermissionQuery]: (data) => MumbleProto.PermissionQuery.decode(data),
  [MessageType.CodecVersion]: (data) => MumbleProto.CodecVersion.decode(data),
  [MessageType.UserStats]: (data) => MumbleProto.UserStats.decode(data),
  [MessageType.RequestBlob]: (data) => MumbleProto.RequestBlob.decode(data),
  [MessageType.ServerConfig]: (data) => MumbleProto.ServerConfig.decode(data),
  [MessageType.SuggestConfig]: (data) => MumbleProto.SuggestConfig.decode(data),
  [MessageType.PluginDataTransmission]: (data) => MumbleProto.PluginDataTransmission.decode(data),
};

export function decodeMessage(type: MessageType, data: Uint8Array): MessagePayload {
  const decoder = messageDecoders[type];
  if (!decoder) {
    throw new Error(`Unknown message type: ${type}`);
  }
  return decoder(data);
}

export function encodeVersion(info: VersionInfo): Uint8Array {
  const message = MumbleProto.Version.create({
    versionV1: PROTOCOL_VERSION_V1,
    versionV2: PROTOCOL_VERSION_V2,
    release: info.release,
    os: info.os,
    osVersion: info.osVersion,
  });
  return MumbleProto.Version.encode(message).finish();
}

export interface AuthenticateOptions {
  username: string;
  password?: string;
  tokens?: string[];
  opus?: boolean;
  clientType?: number;
}

export function encodeAuthenticate(options: AuthenticateOptions): Uint8Array {
  const message = MumbleProto.Authenticate.create({
    username: options.username,
    password: options.password || '',
    tokens: options.tokens || [],
    opus: options.opus ?? true,
    clientType: options.clientType ?? 0,
  });
  return MumbleProto.Authenticate.encode(message).finish();
}

export function encodePing(timestamp?: number): Uint8Array {
  // Timestamp is uint64 in protobuf - use Long for proper encoding
  const ts = timestamp ?? Date.now();
  const message = MumbleProto.Ping.create({
    timestamp: Long.fromNumber(ts),
  });
  return MumbleProto.Ping.encode(message).finish();
}

export function encodeTextMessage(
  message: string,
  channelId?: number[],
  session?: number[],
  treeId?: number[]
): Uint8Array {
  const msg = MumbleProto.TextMessage.create({
    message,
    channelId: channelId || [],
    session: session || [],
    treeId: treeId || [],
  });
  return MumbleProto.TextMessage.encode(msg).finish();
}

export function encodeUserState(state: MumbleProto.IUserState): Uint8Array {
  const message = MumbleProto.UserState.create(state);
  return MumbleProto.UserState.encode(message).finish();
}

export { MumbleProto };
