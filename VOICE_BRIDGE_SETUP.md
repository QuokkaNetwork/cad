# Voice Bridge Setup Guide

## 🎯 Overview

This guide will help you set up the WebRTC Voice Bridge so web dispatchers can talk to in-game players through FiveM's Mumble voice system.

## 📋 Prerequisites

- FiveM server with **pma-voice** installed and working
- Node.js 16+ installed on CAD server
- CAD server and FiveM server on same machine (or network with Mumble port accessible)
- **Windows**: Visual Studio Build Tools (for native modules)

## 🔧 Installation Steps

### Step 1: Install Dependencies

```bash
cd server
npm install ws wrtc node-opus mumble simple-peer
```

**Note for Windows users:**
The `wrtc` and `node-opus` packages require native compilation. If you encounter errors:

```bash
# Install Windows Build Tools (run as Administrator)
npm install --global windows-build-tools

# Then retry
npm install ws wrtc node-opus mumble simple-peer
```

**Alternative for Windows:** If native modules fail, you may need to use WSL (Windows Subsystem for Linux) or Docker.

### Step 2: Configure FiveM Mumble

In your FiveM `server.cfg`, ensure Mumble is properly configured:

```cfg
# Enable voice
set voice_useNativeAudio true
set voice_useSendingRangeOnly false  # IMPORTANT: Allow external connections

# Mumble server settings (optional, defaults work fine)
# set voice_externalAddress "127.0.0.1"
# set voice_externalPort 64738
```

### Step 3: Configure Environment Variables

Add to your CAD server `.env` file:

```env
# Voice Bridge Configuration
MUMBLE_HOST=127.0.0.1
MUMBLE_PORT=64738
```

**If FiveM is on a different server:**
```env
MUMBLE_HOST=your-fivem-server-ip
MUMBLE_PORT=64738
```

### Step 4: Start the Server

```bash
cd server
npm start
```

**Check for successful initialization:**
```
[VoiceBridge] Voice bridge initialized successfully
[VoiceBridge] WebSocket signaling available at /voice-bridge
```

**If you see warnings:**
```
[VoiceBridge] Voice bridge not available: Cannot find module 'mumble'
[VoiceBridge] Install dependencies: npm install ws wrtc node-opus mumble simple-peer
```
This means dependencies aren't installed. Go back to Step 1.

## 🧪 Testing the Voice Bridge

### Test 1: Check Voice Bridge Status

```bash
# Using curl (or Postman)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/voice/bridge/status
```

**Expected response:**
```json
{
  "available": true,
  "connectedDispatchers": 0,
  "activeWebRTCPeers": 0,
  "dispatchers": []
}
```

### Test 2: Connect as Dispatcher (Web UI)

1. Log in to CAD as dispatcher
2. Open browser console (F12)
3. Run test connection:

```javascript
const ws = new WebSocket('ws://localhost:3000/voice-bridge?token=YOUR_JWT_TOKEN');

ws.onopen = () => console.log('Connected to voice bridge!');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.onerror = (e) => console.error('Error:', e);
```

**Expected output:**
```
Connected to voice bridge!
Message: {type: "connected", dispatcherId: 1, dispatcherName: "YourName"}
```

### Test 3: Join a Channel

```javascript
// After connecting (Step 2)
ws.send(JSON.stringify({
  type: 'join-channel',
  channelNumber: 101  // LSPD channel
}));
```

**Expected output:**
```
Message: {type: "channel-joined", channelNumber: 101, channelName: "LSPD Radio"}
Message: {type: "webrtc-signal", signal: {...}}
```

## 🐛 Troubleshooting

### Issue: "Cannot find module 'mumble'"

**Solution:** Dependencies not installed properly.
```bash
cd server
npm install mumble
```

### Issue: "Error: Cannot find module 'node-gyp'"

**Solution:** Native modules need build tools.
```bash
# Windows
npm install --global windows-build-tools

# Linux
sudo apt-get install build-essential

# Mac
xcode-select --install
```

### Issue: "ECONNREFUSED connecting to Mumble"

**Possible causes:**
1. FiveM server not running
2. Mumble port blocked by firewall
3. Wrong MUMBLE_HOST or MUMBLE_PORT

**Solution:**
```bash
# Check if Mumble is listening
netstat -an | grep 64738

# Test connection
telnet 127.0.0.1 64738
```

### Issue: "WebRTC connection fails"

**Possible causes:**
1. Browser doesn't support WebRTC
2. Microphone permission denied
3. HTTPS required (browsers block WebRTC on HTTP in production)

**Solution:**
- Use Chrome/Firefox/Edge (Safari has limited support)
- Grant microphone permission when prompted
- For production, use HTTPS with SSL certificate

### Issue: "Voice bridge initialized but dispatchers can't hear in-game players"

**Possible causes:**
1. Dispatcher not in correct channel
2. pma-voice channel mismatch
3. FiveM using different channel system

**Solution:**
- Check FiveM server logs for voice channel activity
- Verify pma-voice is using numeric channels (not names)
- Check if `voice_useSendingRangeOnly` is false in FiveM

## 📊 Monitoring

### Check Connected Dispatchers

```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/voice/bridge/status
```

### View Server Logs

```bash
# Filter voice bridge logs
npm start | grep VoiceBridge
```

### Monitor Mumble Connections

On FiveM server, watch for connections from `VoiceBridge_Dispatcher*` users.

## 🔐 Security Considerations

### 1. Authentication
- ✅ WebSocket connections require valid JWT token
- ✅ Only dispatchers (is_dispatch=true or is_admin=true) can connect
- ✅ Rate limiting applies to voice bridge connections

### 2. Network Security
- 🔒 Use WSS (WebSocket Secure) in production
- 🔒 Firewall Mumble port (64738) - only allow CAD server IP
- 🔒 Consider VPN if FiveM and CAD are on different networks

### 3. Resource Limits
- Each dispatcher = 1 Mumble connection
- Limit: ~20-30 simultaneous dispatchers (depends on server resources)
- Monitor CPU and bandwidth usage

## 🚀 Production Deployment

### 1. Use HTTPS/WSS

```nginx
# Nginx reverse proxy config
server {
    listen 443 ssl;
    server_name your-cad-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # WebSocket upgrade
    location /voice-bridge {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Regular HTTP traffic
    location / {
        proxy_pass http://localhost:3000;
    }
}
```

### 2. Process Management

Use PM2 to keep server running:

```bash
npm install -g pm2
pm2 start server/src/index.js --name cad-server
pm2 save
pm2 startup
```

### 3. Monitoring

```bash
# PM2 monitoring
pm2 monit

# Voice bridge status endpoint
curl https://your-cad-domain.com/api/voice/bridge/status
```

## 📈 Performance Optimization

### Audio Quality vs Bandwidth

Edit `server/src/services/voiceBridge.js`:

```javascript
this.config = {
  mumbleHost: process.env.MUMBLE_HOST || '127.0.0.1',
  mumblePort: process.env.MUMBLE_PORT || 64738,
  sampleRate: 48000,  // Lower to 24000 for less bandwidth
  frameSize: 960,     // Adjust based on latency requirements
};
```

### Reduce Latency

- Host FiveM and CAD on same server
- Use wired network connections
- Allocate sufficient server resources (CPU/RAM)

### Scale for Multiple Dispatchers

For 10+ dispatchers:
- Consider clustering Node.js processes
- Use Redis for session sharing
- Load balance WebSocket connections

## 📚 API Reference

### WebSocket Messages

**Client → Server:**

```javascript
// Join channel
{
  type: 'join-channel',
  channelNumber: 101
}

// Leave channel
{
  type: 'leave-channel'
}

// WebRTC Offer
{
  type: 'webrtc-offer',
  offer: { /* SDP offer */ }
}

// ICE Candidate
{
  type: 'webrtc-ice-candidate',
  candidate: { /* ICE candidate */ }
}

// Ping (keepalive)
{
  type: 'ping'
}
```

**Server → Client:**

```javascript
// Connected
{
  type: 'connected',
  dispatcherId: 1,
  dispatcherName: 'John Doe'
}

// Channel joined
{
  type: 'channel-joined',
  channelNumber: 101,
  channelName: 'LSPD Radio'
}

// WebRTC Signal
{
  type: 'webrtc-signal',
  signal: { /* SDP answer or ICE candidate */ }
}

// Error
{
  type: 'error',
  error: 'Error message'
}

// Pong (response to ping)
{
  type: 'pong'
}
```

## 🎉 Success Criteria

You know everything is working when:

1. ✅ Server starts without voice bridge warnings
2. ✅ `/api/voice/bridge/status` returns `"available": true`
3. ✅ Dispatcher can connect via WebSocket
4. ✅ WebRTC peer connection establishes
5. ✅ Dispatcher appears in Mumble as `VoiceBridge_Dispatcher*`
6. ✅ In-game players can hear dispatcher voice
7. ✅ Dispatcher can hear in-game players (may require additional audio pipeline)

## 🆘 Getting Help

If you're stuck:

1. Check server logs: `npm start` output
2. Check browser console: F12 → Console tab
3. Verify dependencies: `npm list ws wrtc node-opus mumble simple-peer`
4. Test Mumble connection: `telnet 127.0.0.1 64738`
5. Check FiveM logs for voice activity

## 📝 Notes

- The current implementation focuses on **dispatcher → players** audio
- **Players → dispatcher** audio requires additional audio processing (not yet implemented)
- For two-way audio, you'll need to add audio decoding from Mumble streams
- Consider using SaltyChat or TokoVOIP for production-ready solutions if budget allows

---

## Next Steps

After setup is complete:
1. Create web UI components for voice controls
2. Update FiveM integration to sync voice events
3. Add push-to-talk functionality
4. Implement two-way audio (receive audio from Mumble)
5. Add audio indicators (who's talking)
6. Test with multiple dispatchers simultaneously
