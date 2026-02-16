# Voice Bridge Solution - Web Dispatchers to FiveM

## 🎯 Goal
Enable web browser dispatchers to talk to in-game players through FiveM's Mumble voice system without being in the server.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CAD Web UI                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │ Radio Channel  │  │ Accept 000     │  │ Push-to-Talk   │   │
│  │ Selector       │  │ Call           │  │ Button         │   │
│  └────────────────┘  └────────────────┘  └────────────────┘   │
│                              │                                   │
│                              │ WebRTC Audio Stream              │
│                              ▼                                   │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ WSS (Secure WebSocket)
                               │ + WebRTC Signaling
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Node.js Voice Bridge Server                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  WebRTC Peer (receives browser audio)                    │  │
│  │  ┌─────────────────────────────────────────────────┐     │  │
│  │  │ Audio Processor (Opus decode → PCM → Opus)      │     │  │
│  │  └─────────────────────────────────────────────────┘     │  │
│  │  Mumble Client (sends to FiveM as virtual player)        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Mumble Protocol (UDP + TCP)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              FiveM Server Mumble                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Channel 101 (LSPD Radio)                                 │  │
│  │    - Unit 1-A-1 (John Doe)                               │  │
│  │    - Unit 1-A-2 (Jane Smith)                             │  │
│  │    - VoiceBridge_Dispatcher1 ← Virtual Player            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Channel 10001 (000 Call)                                 │  │
│  │    - John_Civilian (#123)                                │  │
│  │    - VoiceBridge_Dispatcher2 ← Virtual Player            │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Required Dependencies

```json
{
  "dependencies": {
    "ws": "^8.16.0",              // WebSocket server for signaling
    "wrtc": "^0.4.7",             // WebRTC for Node.js
    "node-opus": "^0.3.3",        // Opus audio codec
    "mumble": "^0.4.1",           // Mumble client for Node.js
    "simple-peer": "^9.11.1"      // Simplified WebRTC peer connections
  }
}
```

## 🔧 Implementation Components

### 1. Voice Bridge Server (`server/src/services/voiceBridge.js`)

```javascript
const Mumble = require('mumble');
const { Server: WebSocketServer } = require('ws');
const wrtc = require('wrtc');
const SimplePeer = require('simple-peer');
const opus = require('node-opus');

class VoiceBridgeServer {
  constructor() {
    this.mumbleClients = new Map(); // dispatcher_id -> mumble connection
    this.webrtcPeers = new Map();   // dispatcher_id -> webrtc peer
    this.activeChannels = new Map(); // dispatcher_id -> channel_number
  }

  async connectDispatcherToMumble(dispatcherId, channelNumber) {
    // Create virtual Mumble client for this dispatcher
    const mumbleClient = await Mumble.connect(
      `mumble://127.0.0.1:64738?username=VoiceBridge_Dispatcher${dispatcherId}`
    );

    // Join the specified channel
    const channel = mumbleClient.channelByName(`Channel_${channelNumber}`);
    mumbleClient.user.moveToChannel(channel);

    this.mumbleClients.set(dispatcherId, mumbleClient);
    this.activeChannels.set(dispatcherId, channelNumber);
  }

  createWebRTCPeer(dispatcherId) {
    const peer = new SimplePeer({
      initiator: false, // Server is not initiator
      wrtc: wrtc,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    });

    // Receive audio from browser
    peer.on('stream', (stream) => {
      this.handleBrowserAudioStream(dispatcherId, stream);
    });

    this.webrtcPeers.set(dispatcherId, peer);
    return peer;
  }

  handleBrowserAudioStream(dispatcherId, stream) {
    const mumbleClient = this.mumbleClients.get(dispatcherId);
    if (!mumbleClient) return;

    // Audio pipeline: WebRTC → Opus Decode → PCM → Opus Encode → Mumble
    const audioTrack = stream.getAudioTracks()[0];

    // Create Opus encoder for Mumble
    const encoder = new opus.Encoder(48000, 1); // 48kHz, mono

    // Process audio chunks and send to Mumble
    audioTrack.on('data', (chunk) => {
      const encoded = encoder.encode(chunk, 480); // Frame size: 480 samples
      mumbleClient.connection.sendVoice(encoded);
    });
  }

  async disconnectDispatcher(dispatcherId) {
    const mumbleClient = this.mumbleClients.get(dispatcherId);
    if (mumbleClient) {
      mumbleClient.disconnect();
      this.mumbleClients.delete(dispatcherId);
    }

    const peer = this.webrtcPeers.get(dispatcherId);
    if (peer) {
      peer.destroy();
      this.webrtcPeers.delete(dispatcherId);
    }

    this.activeChannels.delete(dispatcherId);
  }
}

module.exports = VoiceBridgeServer;
```

### 2. WebSocket Signaling Server (`server/src/services/voiceSignaling.js`)

```javascript
const { Server: WebSocketServer } = require('ws');
const { VoiceChannels, Users } = require('../db/sqlite');

class VoiceSignalingServer {
  constructor(httpServer, voiceBridge) {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/voice-bridge'
    });
    this.voiceBridge = voiceBridge;
    this.connections = new Map(); // userId -> ws connection

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  handleConnection(ws, req) {
    // Authenticate via token from query string
    const token = new URL(req.url, 'ws://localhost').searchParams.get('token');
    const user = this.authenticateToken(token);

    if (!user) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    this.connections.set(user.id, ws);

    ws.on('message', async (data) => {
      const message = JSON.parse(data);
      await this.handleMessage(user, message, ws);
    });

    ws.on('close', () => {
      this.voiceBridge.disconnectDispatcher(user.id);
      this.connections.delete(user.id);
    });
  }

  async handleMessage(user, message, ws) {
    switch (message.type) {
      case 'join-channel':
        await this.handleJoinChannel(user, message.channelNumber, ws);
        break;

      case 'leave-channel':
        await this.handleLeaveChannel(user, ws);
        break;

      case 'webrtc-offer':
        await this.handleWebRTCOffer(user, message.offer, ws);
        break;

      case 'webrtc-ice-candidate':
        await this.handleICECandidate(user, message.candidate);
        break;
    }
  }

  async handleJoinChannel(user, channelNumber, ws) {
    try {
      // Connect dispatcher to Mumble
      await this.voiceBridge.connectDispatcherToMumble(user.id, channelNumber);

      // Create WebRTC peer for browser connection
      const peer = this.voiceBridge.createWebRTCPeer(user.id);

      // Wait for peer to generate offer
      peer.on('signal', (data) => {
        ws.send(JSON.stringify({
          type: 'webrtc-answer',
          answer: data
        }));
      });

      ws.send(JSON.stringify({
        type: 'channel-joined',
        channelNumber
      }));
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  }

  async handleLeaveChannel(user, ws) {
    await this.voiceBridge.disconnectDispatcher(user.id);
    ws.send(JSON.stringify({ type: 'channel-left' }));
  }

  async handleWebRTCOffer(user, offer, ws) {
    const peer = this.voiceBridge.webrtcPeers.get(user.id);
    if (peer) {
      peer.signal(offer);
    }
  }

  async handleICECandidate(user, candidate) {
    const peer = this.voiceBridge.webrtcPeers.get(user.id);
    if (peer) {
      peer.signal({ candidate });
    }
  }
}

module.exports = VoiceSignalingServer;
```

### 3. Web UI Voice Client (`web/src/services/voiceClient.js`)

```javascript
import SimplePeer from 'simple-peer';

class DispatcherVoiceClient {
  constructor() {
    this.ws = null;
    this.peer = null;
    this.localStream = null;
    this.currentChannel = null;
    this.isTalking = false;
  }

  async connect(authToken) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`wss://your-cad-server.com/voice-bridge?token=${authToken}`);

      this.ws.onopen = () => {
        console.log('Voice bridge connected');
        resolve();
      };

      this.ws.onerror = (error) => {
        console.error('Voice bridge error:', error);
        reject(error);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };
    });
  }

  async joinChannel(channelNumber) {
    if (this.currentChannel === channelNumber) return;

    // Request microphone access
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    // Create WebRTC peer
    this.peer = new SimplePeer({
      initiator: true, // Browser initiates
      stream: this.localStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      }
    });

    // Send WebRTC offer to server
    this.peer.on('signal', (data) => {
      this.ws.send(JSON.stringify({
        type: 'webrtc-offer',
        offer: data
      }));
    });

    this.peer.on('error', (error) => {
      console.error('WebRTC error:', error);
    });

    // Request to join channel
    this.ws.send(JSON.stringify({
      type: 'join-channel',
      channelNumber
    }));

    this.currentChannel = channelNumber;
  }

  async leaveChannel() {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.ws.send(JSON.stringify({ type: 'leave-channel' }));
    this.currentChannel = null;
  }

  handleMessage(message) {
    switch (message.type) {
      case 'webrtc-answer':
        if (this.peer) {
          this.peer.signal(message.answer);
        }
        break;

      case 'channel-joined':
        console.log('Joined channel:', message.channelNumber);
        break;

      case 'channel-left':
        console.log('Left channel');
        break;

      case 'error':
        console.error('Voice bridge error:', message.message);
        break;
    }
  }

  setPushToTalk(enabled) {
    if (!this.localStream) return;

    this.localStream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });

    this.isTalking = enabled;
  }

  disconnect() {
    this.leaveChannel();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export default DispatcherVoiceClient;
```

### 4. FiveM Integration (Auto-detect voice bridge clients)

Update `server/fivem-resource/server.lua`:

```lua
-- Voice bridge clients connect as special usernames
-- Pattern: VoiceBridge_Dispatcher{userId}
-- These should NOT be tracked as normal players

function isVoiceBridgeClient(playerName)
  return string.match(playerName, "^VoiceBridge_Dispatcher%d+$") ~= nil
end

-- In heartbeat processing, filter out voice bridge clients
for _, src in ipairs(GetPlayers()) do
  local playerName = GetPlayerName(src)
  if not isVoiceBridgeClient(playerName) then
    -- Process normal player...
  end
end
```

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install ws wrtc node-opus mumble simple-peer
```

### 2. Configure FiveM Mumble

Ensure FiveM server has Mumble enabled and accessible:

```cfg
# server.cfg
set voice_useNativeAudio true
set voice_useSendingRangeOnly false  # Allow voice bridge to connect
```

### 3. Start Voice Bridge

In `server/src/index.js`:

```javascript
const http = require('http');
const VoiceBridgeServer = require('./services/voiceBridge');
const VoiceSignalingServer = require('./services/voiceSignaling');

// Create HTTP server for Express and WebSocket
const httpServer = http.createServer(app);

// Initialize voice bridge
const voiceBridge = new VoiceBridgeServer();
const voiceSignaling = new VoiceSignalingServer(httpServer, voiceBridge);

// Use HTTP server instead of app.listen
httpServer.listen(config.port, () => {
  console.log(`CAD server running on port ${config.port}`);
  console.log('Voice bridge enabled');
});
```

### 4. Web UI Integration

```jsx
// React component example
import DispatcherVoiceClient from '../services/voiceClient';

function RadioPanel() {
  const [voiceClient] = useState(() => new DispatcherVoiceClient());
  const [currentChannel, setCurrentChannel] = useState(null);
  const [isPTTActive, setIsPTTActive] = useState(false);

  useEffect(() => {
    voiceClient.connect(authToken);
    return () => voiceClient.disconnect();
  }, []);

  const handleJoinChannel = async (channelNumber) => {
    await voiceClient.joinChannel(channelNumber);
    setCurrentChannel(channelNumber);
  };

  const handleLeaveChannel = async () => {
    await voiceClient.leaveChannel();
    setCurrentChannel(null);
  };

  const handlePTTDown = () => {
    voiceClient.setPushToTalk(true);
    setIsPTTActive(true);
  };

  const handlePTTUp = () => {
    voiceClient.setPushToTalk(false);
    setIsPTTActive(false);
  };

  return (
    <div>
      <button onClick={() => handleJoinChannel(101)}>
        Join LSPD Radio
      </button>
      <button
        onMouseDown={handlePTTDown}
        onMouseUp={handlePTTUp}
        disabled={!currentChannel}
      >
        {isPTTActive ? '🎙️ Talking...' : 'Press to Talk'}
      </button>
    </div>
  );
}
```

## ⚠️ Important Considerations

### Security
- ✅ Authenticate WebSocket connections with JWT tokens
- ✅ Rate limit voice bridge connections (max 1 per dispatcher)
- ✅ Validate channel access (only dispatch can join channels)

### Performance
- 🎯 Each dispatcher = 1 Mumble connection
- 🎯 Audio processing happens on Node.js server (not browser)
- 🎯 Use Opus codec (low bandwidth, high quality)

### Scalability
- For 5-10 dispatchers: Single Node.js server is fine
- For 10+ dispatchers: Consider clustering or load balancing

### Reliability
- Implement reconnection logic for dropped connections
- Monitor Mumble connection health
- Fallback to "dispatcher offline" if bridge fails

## 🧪 Testing Checklist

- [ ] Dispatcher can connect to voice bridge
- [ ] Dispatcher can hear in-game players
- [ ] In-game players can hear dispatcher
- [ ] Push-to-talk works correctly
- [ ] Multiple dispatchers can connect simultaneously
- [ ] Graceful handling of network interruptions
- [ ] No audio delay/lag (< 200ms latency)
- [ ] Audio quality is clear (no distortion/crackling)

## 💰 Cost Analysis

**Pros:**
- ✅ No third-party services required
- ✅ Full control over audio routing
- ✅ Integrated with CAD system
- ✅ No monthly fees

**Cons:**
- ❌ Complex implementation (audio processing, WebRTC, Mumble protocol)
- ❌ Requires additional server resources
- ❌ Maintenance overhead
- ❌ Potential audio quality/latency issues

## 🔄 Alternative: Dedicated VOIP Server

If the above is too complex, consider:

1. **Teamspeak** with BOT integration (easier, proven)
2. **Discord** bot that bridges channels (easiest, but against TOS)
3. **SaltyChat** plugin (commercial, but designed for this)

Would you like me to implement the Voice Bridge solution?
