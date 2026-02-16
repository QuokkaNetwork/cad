/**
 * mumble.js - Node.js TypeScript library for Mumble voice chat servers
 *
 * @packageDocumentation
 *
 * @example Basic usage
 * ```typescript
 * import { MumbleClient } from 'mumble.js';
 *
 * const client = new MumbleClient({
 *   host: 'mumble.example.com',
 *   port: 64738,
 *   username: 'MyBot',
 * });
 *
 * client.on('ready', () => {
 *   console.log('Connected!');
 *   console.log('Users:', client.users.size);
 *   console.log('Channels:', client.channels.size);
 * });
 *
 * client.on('userJoin', (user) => {
 *   console.log(`${user.name} joined`);
 * });
 *
 * client.on('audio', (session, opusData) => {
 *   // Handle incoming Opus audio data
 * });
 *
 * await client.connect();
 * ```
 */

export { MumbleClient } from './lib/client';
export {
  MumbleUser,
  MumbleChannel,
  ServerInfo,
  MumbleClientOptions,
  MessageType,
  RejectType,
  MumbleEvents,
  TextMessage,
} from './lib/types';
