# mumble-node

A Node.js TypeScript library for interacting with [Mumble](https://www.mumble.info/) voice chat servers.

## Features

- Full Mumble protocol support (TCP control + UDP voice)
- Voice transmission and reception with Opus codec
- OCB2-AES128 encryption for UDP voice packets
- Automatic TCP tunnel fallback when UDP is unavailable
- Client certificate authentication
- Channel and user management
- Text messaging
- Voice targets (whisper mode)
- TypeScript with full type definitions
- Event-driven API

## Installation

```bash
npm install mumble-node
```

## Quick Start

```typescript
import { MumbleClient } from 'mumble-node';

const client = new MumbleClient({
  host: 'mumble.example.com',
  username: 'MyBot',
});

client.on('ready', () => {
  console.log(`Connected as ${client.self?.name}`);
  console.log(`Users: ${client.users.size}`);
  console.log(`Channels: ${client.channels.size}`);
});

client.on('textMessage', (message) => {
  console.log(`Message: ${message.message}`);
});

await client.connect();
```

## Certificate Authentication

Mumble uses client certificates to identify registered users. To authenticate as a registered user, provide your certificate and private key:

```typescript
import * as fs from 'fs';
import { MumbleClient } from 'mumble-node';

const client = new MumbleClient({
  host: 'mumble.example.com',
  username: 'MyRegisteredUser',
  key: fs.readFileSync('client-key.pem'),
  cert: fs.readFileSync('client-cert.pem'),
});
```

### Generating a Certificate

To generate a self-signed certificate for Mumble:

```bash
# Generate private key and certificate
openssl req -x509 -newkey rsa:2048 -keyout client-key.pem -out client-cert.pem -days 365 -nodes -subj "/CN=MumbleUser"
```

Then register the certificate with the Mumble server by connecting with the official Mumble client and using "Self > Register".

### Using PKCS#12 Files

If you have a `.p12` or `.pfx` file (exported from Mumble client):

```bash
# Extract private key
openssl pkcs12 -in mumble-cert.p12 -nocerts -nodes -out client-key.pem

# Extract certificate
openssl pkcs12 -in mumble-cert.p12 -clcerts -nokeys -out client-cert.pem
```

## API Reference

### MumbleClient

The main client class for connecting to Mumble servers.

#### Constructor Options

```typescript
interface MumbleClientOptions {
  host: string;              // Server hostname or IP
  port?: number;             // Server port (default: 64738)
  username: string;          // Username to connect with
  password?: string;         // Server password (if required)
  tokens?: string[];         // Access tokens for channel permissions
  rejectUnauthorized?: boolean; // Reject invalid TLS certs (default: false)
  key?: string | Buffer;     // Client TLS private key
  cert?: string | Buffer;    // Client TLS certificate
  debug?: boolean;           // Enable debug logging
  logger?: (msg: string) => void; // Custom logger function
  disableUdp?: boolean;      // Force TCP tunnel for voice
}
```

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `session` | `number` | Client's session ID |
| `users` | `Map<number, MumbleUser>` | All users (keyed by session) |
| `channels` | `Map<number, MumbleChannel>` | All channels (keyed by ID) |
| `serverInfo` | `ServerInfo` | Server configuration |
| `isReady` | `boolean` | Whether client is connected and synced |
| `self` | `MumbleUser \| undefined` | This client's user object |
| `speakingUsers` | `number[]` | Session IDs of users currently speaking |

#### Methods

##### Connection

```typescript
// Connect to the server
await client.connect(): Promise<void>

// Disconnect from the server
client.disconnect(): void
```

##### Users & Channels

```typescript
// Get a user by session ID
client.getUser(session: number): MumbleUser | undefined

// Get a channel by ID
client.getChannel(channelId: number): MumbleChannel | undefined

// Get all users in a channel
client.getUsersInChannel(channelId: number): MumbleUser[]

// Get direct sub-channels of a channel
client.getSubChannels(channelId: number): MumbleChannel[]

// Get the root channel (ID 0)
client.getRootChannel(): MumbleChannel | undefined

// Check if a user is currently speaking
client.isUserSpeaking(session: number): boolean
```

##### Actions

```typescript
// Move to a channel
client.moveToChannel(channelId: number): void

// Set self-mute state
client.setSelfMute(mute: boolean): void

// Set self-deaf state
client.setSelfDeaf(deaf: boolean): void

// Send a message to a channel
client.sendMessage(message: string, channelId?: number): void

// Send a private message to a user
client.sendPrivateMessage(message: string, session: number): void
```

##### Voice

```typescript
// Send Opus-encoded audio
// target: 0 = normal, 1-30 = voice target, 31 = server loopback
client.sendAudio(opusData: Buffer, isLastFrame?: boolean, target?: number): void

// Set up a voice target for whispering
client.setVoiceTarget(targetId: number, channelId: number, options?: {
  links?: boolean;    // Include linked channels
  children?: boolean; // Include child channels
}): void

// Set up whisper to current channel (target 1)
client.setupWhisperToCurrentChannel(): void
```

#### Events

```typescript
client.on('connected', () => void)           // TLS connected
client.on('ready', () => void)               // Fully synced, safe to use API
client.on('disconnected', (reason?) => void) // Disconnected
client.on('error', (error) => void)          // Error occurred
client.on('rejected', (type, reason?) => void) // Connection rejected

client.on('userJoin', (user) => void)        // User joined server
client.on('userLeave', (user, reason?) => void) // User left server
client.on('userUpdate', (user, oldUser) => void) // User state changed

client.on('channelCreate', (channel) => void)  // Channel created
client.on('channelRemove', (channel) => void)  // Channel removed
client.on('channelUpdate', (channel, oldChannel) => void) // Channel changed

client.on('textMessage', (message) => void)  // Text message received

client.on('userStartSpeaking', (session) => void) // User started talking
client.on('userStopSpeaking', (session) => void)  // User stopped talking
client.on('audio', (session, opusData) => void)   // Audio data received
```

### Types

#### MumbleUser

```typescript
interface MumbleUser {
  session: number;        // Unique session ID
  userId?: number;        // Permanent ID (registered users only)
  name: string;           // Display name
  channelId: number;      // Current channel ID
  mute: boolean;          // Muted by admin
  deaf: boolean;          // Deafened by admin
  suppress: boolean;      // Cannot transmit
  selfMute: boolean;      // Self-muted
  selfDeaf: boolean;      // Self-deafened
  prioritySpeaker: boolean;
  recording: boolean;
  comment?: string;
  hash?: string;          // Certificate hash
}
```

#### MumbleChannel

```typescript
interface MumbleChannel {
  channelId: number;      // Unique ID (root = 0)
  parent?: number;        // Parent channel ID
  name: string;           // Display name
  description?: string;   // May contain HTML
  temporary: boolean;
  position: number;       // Sort order
  maxUsers: number;       // 0 = unlimited
  links: number[];        // Linked channel IDs
  isEnterRestricted: boolean;
  canEnter: boolean;
}
```

## Examples

### Channel Tree CLI (`examples/channel-tree.ts`)

Interactive TUI showing the channel tree with user list. Supports:

- Channel navigation with keyboard (j/k, arrow keys)
- Channel search (/)
- Discord bridge mode

```bash
# Basic usage
npx ts-node examples/channel-tree.ts mumble.example.com MyBot

# With password
npx ts-node examples/channel-tree.ts mumble.example.com MyBot secretpassword

# With Discord bridge
npx ts-node examples/channel-tree.ts mumble.example.com MyBot --discord BOT_TOKEN GUILD_ID CHANNEL_ID
```

### Web Client (`examples/web-client/`)

Browser-based Mumble client using WebRTC for audio.

```bash
npx ts-node examples/web-client/server.ts mumble.example.com MyBot
# Open http://localhost:3000
```

## Voice Transmission

### Sending Audio

Audio must be Opus-encoded before sending:

```typescript
import { Encoder } from '@evan/opus';

const encoder = new Encoder({
  sample_rate: 48000,
  channels: 1,
  application: 'voip',
});
encoder.bitrate = 24000;

// Encode 20ms of audio (960 samples at 48kHz mono)
const pcmFrame = new Int16Array(960);
const opusData = encoder.encode(pcmFrame);

// Send to server (target 1 = whisper to voice target 1)
client.sendAudio(Buffer.from(opusData), false, 1);

// Send final frame with terminator flag
client.sendAudio(Buffer.from(lastFrame), true, 1);
```

### Receiving Audio

Audio arrives as Opus packets per user:

```typescript
import OpusScript from 'opusscript';

// Create one decoder per user (Opus is stateful)
const decoders = new Map();

client.on('audio', (session, opusData) => {
  let decoder = decoders.get(session);
  if (!decoder) {
    decoder = new OpusScript(48000, 1); // 48kHz mono
    decoders.set(session, decoder);
  }

  const pcm = decoder.decode(opusData);
  // pcm is Int16Array, 48kHz mono
});
```

## Protocol Notes

- Mumble uses TLS for the control channel (TCP port 64738)
- Voice uses UDP with OCB2-AES128 encryption
- Falls back to TCP tunnel if UDP fails
- Server version 1.5.0+ uses protobuf for voice packets
- Older servers use legacy varint-based format

## License

MIT
