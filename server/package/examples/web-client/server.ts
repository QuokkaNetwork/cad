#!/usr/bin/env npx ts-node
/**
 * Web-based Mumble Client Server with WebRTC
 *
 * Node.js server that bridges a web browser to a Mumble server.
 * Uses WebRTC for low-latency audio streaming.
 *
 * Usage: npx ts-node examples/web-client/server.ts <host> [username] [password]
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { MumbleClient, MumbleChannel, MumbleUser } from '../../src';

// WebRTC
const wrtc = require('@roamhq/wrtc');
const { RTCPeerConnection, RTCSessionDescription, nonstandard } = wrtc;
const { RTCAudioSink, RTCAudioSource } = nonstandard;

// Opus codec
const { Encoder: OpusEncoder, Decoder: OpusDecoder } = require('@evan/opus');

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: npx ts-node examples/web-client/server.ts <host[:port]> [username] [password]');
  process.exit(1);
}

const [hostPort, username = 'WebClient', password] = args;
const [host, portStr] = hostPort.split(':');
const mumblePort = portStr ? parseInt(portStr, 10) : 64738;

const HTTP_PORT = 3000;
const SAMPLE_RATE = 48000;
const CHANNELS = 1;
// Use 20ms frames like the official Mumble client (50 packets/sec)
const FRAME_SIZE = 960; // 20ms at 48kHz - matches default Mumble client settings

// Mumble client
let mumbleClient: MumbleClient;

// Connected web clients
const webClients = new Map<WebSocket, {
  pc: any;
  audioSink: any;
  audioSource: any;
  encoder: any;
  decoder: any;
  audioBuffer: Int16Array;
}>();

// Opus decoder for incoming Mumble audio (shared)
let mumbleDecoder: any;

// Create HTTP server for static files
const httpServer = http.createServer((req, res) => {
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url!);

  const ext = path.extname(filePath);
  const contentTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(data);
  });
});

// Create WebSocket server (for signaling only)
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  console.log('Web client connected from:', req.socket.remoteAddress);

  // Create WebRTC peer connection
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // Create audio source for sending audio to browser (will be added after offer)
  const audioSource = new RTCAudioSource();

  // Create encoder/decoder for this client
  // Match official Mumble client settings: 40kbps with 20ms frames
  const encoder = new OpusEncoder({
    sample_rate: SAMPLE_RATE,
    channels: CHANNELS,
    application: 'voip',  // Optimized for voice (vs 'audio' for music)
  });
  // Opus encoder settings to match Mumble client
  encoder.bitrate = 24000;      // 24kbps - reduced for lower bandwidth usage
  encoder.complexity = 10;       // Max quality (0-10), Mumble uses high complexity
  encoder.signal = 'voice';      // Optimize for voice signals
  encoder.vbr = true;            // Variable bitrate - more efficient
  encoder.vbr_constraint = true; // Constrained VBR - keeps bitrate more stable
  encoder.packet_loss = 5;       // Expect ~5% packet loss, adds resilience
  encoder.dtx = false;           // Disable DTX - can cause issues with silence detection

  const decoder = new OpusDecoder({
    sample_rate: SAMPLE_RATE,
    channels: CHANNELS,
  });

  const clientData = {
    pc,
    audioSink: null as any,
    audioSource,
    encoder,
    decoder,
    audioBuffer: new Int16Array(0),
    isTalking: false, // Track PTT state
    talkStartTime: 0,
    encodedFrameCount: 0,
    totalBytesSent: 0,
    sendTimer: null as NodeJS.Timeout | null, // Drift-compensated send timer
  };
  webClients.set(ws, clientData);

  // Handle incoming audio track from browser
  pc.ontrack = (event: any) => {
    console.log('Received audio track from browser:', event.track.kind, 'readyState:', event.track.readyState);
    const audioSink = new RTCAudioSink(event.track);
    clientData.audioSink = audioSink;
    console.log('Created RTCAudioSink for track');

    let browserAudioCount = 0;
    let lastAudioTime = Date.now();
    // Max buffer = 150ms of audio (prevents latency buildup, must be > FRAME_SIZE)
    const MAX_BUFFER_SAMPLES = SAMPLE_RATE * 0.15; // 7200 samples

    // Log if no audio received for a while
    const audioCheckInterval = setInterval(() => {
      if (clientData.isTalking) {
        const elapsed = Date.now() - lastAudioTime;
        if (elapsed > 1000) {
          console.log(`WARNING: No browser audio received for ${elapsed}ms while talking`);
        }
      }
    }, 2000);

    // Clean up interval when connection closes
    ws.on('close', () => clearInterval(audioCheckInterval));

    audioSink.ondata = (data: { samples: Int16Array; sampleRate: number; bitsPerSample: number; channelCount: number }) => {
      lastAudioTime = Date.now();
      if (!mumbleClient || !clientData.isTalking) return;

      // Skip audio that's not at expected sample rate
      if (data.sampleRate !== SAMPLE_RATE) {
        console.log(`Skipping audio with wrong sample rate: ${data.sampleRate}Hz (expected ${SAMPLE_RATE}Hz)`);
        return;
      }

      // Log occasionally
      if (browserAudioCount++ % 50 === 0) {
        console.log(`Received browser audio: ${data.samples.length} samples, buffer: ${clientData.audioBuffer.length}`);
      }

      // Accumulate samples - the send timer will consume them
      const newBuffer = new Int16Array(clientData.audioBuffer.length + data.samples.length);
      newBuffer.set(clientData.audioBuffer);
      newBuffer.set(data.samples, clientData.audioBuffer.length);
      clientData.audioBuffer = newBuffer;

      // Prevent buffer buildup - drop oldest samples if buffer too large
      if (clientData.audioBuffer.length > MAX_BUFFER_SAMPLES) {
        const excess = clientData.audioBuffer.length - MAX_BUFFER_SAMPLES;
        clientData.audioBuffer = clientData.audioBuffer.slice(excess);
        console.log(`Buffer overflow, dropped ${excess} samples`);
      }
    };
  };

  pc.onicecandidate = (event: any) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
    }
  };

  pc.onconnectionstatechange = () => {
    console.log('WebRTC connection state:', pc.connectionState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log('ICE connection state:', pc.iceConnectionState);
  };

  pc.onnegotiationneeded = () => {
    console.log('Negotiation needed');
  };

  // Send current state to new client
  if (mumbleClient) {
    sendState(ws);
  }

  ws.on('message', async (data, isBinary) => {
    if (isBinary) return; // Ignore binary messages now (audio goes via WebRTC)

    try {
      const msg = JSON.parse(data.toString());
      await handleCommand(ws, msg, clientData);
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    console.log('Web client disconnected');
    const client = webClients.get(ws);
    if (client) {
      if (client.audioSink) client.audioSink.stop();
      client.pc.close();
    }
    webClients.delete(ws);
  });
});

// Frame duration in milliseconds (20ms for FRAME_SIZE=960 at 48kHz)
const FRAME_DURATION_MS = (FRAME_SIZE / SAMPLE_RATE) * 1000;

/**
 * Drift-compensated send timer.
 * Uses absolute time to schedule frames, preventing cumulative drift from setTimeout inaccuracy.
 */
function startSendTimer(clientData: any) {
  const startTime = Date.now();

  function sendNextFrame() {
    if (!clientData.isTalking || !mumbleClient) {
      clientData.sendTimer = null;
      return;
    }

    // Calculate expected time for this frame based on frame count
    const expectedTime = startTime + (clientData.encodedFrameCount * FRAME_DURATION_MS);
    const now = Date.now();

    // Check if we have enough audio in the buffer
    if (clientData.audioBuffer.length >= FRAME_SIZE) {
      const frame = clientData.audioBuffer.slice(0, FRAME_SIZE);
      clientData.audioBuffer = clientData.audioBuffer.slice(FRAME_SIZE);

      try {
        const encoded = clientData.encoder.encode(frame);
        if (encoded && encoded.length > 0) {
          clientData.encodedFrameCount++;
          if (clientData.encodedFrameCount % 50 === 0) {
            const drift = now - expectedTime;
            console.log(`Encoded frame ${clientData.encodedFrameCount}, ${encoded.length} bytes, drift: ${drift}ms`);
          }
          try {
            mumbleClient.sendAudio(Buffer.from(encoded), false, 1);
            clientData.totalBytesSent += encoded.length;
          } catch (sendErr) {
            console.error('sendAudio error:', sendErr);
          }
        }
      } catch (err) {
        console.error('Encode error:', err);
      }
    }

    // Calculate delay until next frame should be sent
    // Use the NEXT expected time, compensating for any drift
    const nextExpectedTime = startTime + ((clientData.encodedFrameCount) * FRAME_DURATION_MS);
    const delay = Math.max(1, nextExpectedTime - Date.now());

    // Schedule next frame
    clientData.sendTimer = setTimeout(sendNextFrame, delay);
  }

  // Start immediately
  sendNextFrame();
}

async function handleCommand(ws: WebSocket, msg: any, clientData: any) {
  console.log('Received command:', msg.type);

  switch (msg.type) {
    case 'offer':
      // Handle WebRTC offer from browser
      console.log('Setting remote description (offer)');
      await clientData.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));

      // Find the audio transceiver and add our track to it for sending
      const transceivers = clientData.pc.getTransceivers();
      console.log('Transceivers after setRemoteDescription:', transceivers.map((t: any) => ({
        mid: t.mid,
        direction: t.direction,
        currentDirection: t.currentDirection
      })));

      // Find the audio transceiver (should be the one from browser's offer)
      const audioTransceiver = transceivers.find((t: any) => t.receiver?.track?.kind === 'audio');
      if (audioTransceiver) {
        // Create and set our audio track for sending to browser
        const audioTrack = clientData.audioSource.createTrack();
        await audioTransceiver.sender.replaceTrack(audioTrack);
        // Change direction to sendrecv so we can both send and receive
        audioTransceiver.direction = 'sendrecv';
        console.log('Set up audio transceiver for sending, direction:', audioTransceiver.direction);
      }

      const answer = await clientData.pc.createAnswer();
      await clientData.pc.setLocalDescription(answer);
      console.log('Sending answer');
      ws.send(JSON.stringify({ type: 'answer', sdp: clientData.pc.localDescription }));
      break;

    case 'ice-candidate':
      if (msg.candidate) {
        await clientData.pc.addIceCandidate(msg.candidate);
      }
      break;

    case 'joinChannel':
      console.log('Join channel request:', msg.channelId);
      if (mumbleClient && msg.channelId !== undefined) {
        mumbleClient.moveToChannel(msg.channelId);
      }
      break;

    case 'startTalking':
      console.log('Client started talking');
      // Ensure VoiceTarget 1 is set up before sending audio
      if (mumbleClient) {
        mumbleClient.setupWhisperToCurrentChannel();
      }
      clientData.isTalking = true;
      clientData.audioBuffer = new Int16Array(0); // Clear any stale audio
      clientData.talkStartTime = Date.now();
      clientData.encodedFrameCount = 0;
      clientData.totalBytesSent = 0;
      // Start drift-compensated send timer
      startSendTimer(clientData);
      break;

    case 'stopTalking':
      console.log('Client stopped talking');
      clientData.isTalking = false;

      // Stop the send timer
      if (clientData.sendTimer) {
        clearTimeout(clientData.sendTimer);
        clientData.sendTimer = null;
      }

      // Send terminator frame
      if (mumbleClient) {
        try {
          const silence = new Int16Array(FRAME_SIZE);
          const encoded = clientData.encoder.encode(silence);
          mumbleClient.sendAudio(Buffer.from(encoded), true, 1);
        } catch (err) {
          console.error('Error sending terminator:', err);
        }
      }
      break;
  }
}

function sendState(ws: WebSocket) {
  // Send channel tree
  const channels: any[] = [];
  mumbleClient.channels.forEach((channel) => {
    channels.push({
      id: channel.channelId,
      name: channel.name,
      parent: channel.parent,
      position: channel.position,
    });
  });

  // Send users
  const users: any[] = [];
  mumbleClient.users.forEach((user) => {
    users.push({
      session: user.session,
      name: user.name,
      channelId: user.channelId,
      mute: user.mute || user.selfMute,
      deaf: user.deaf || user.selfDeaf,
    });
  });

  ws.send(JSON.stringify({
    type: 'state',
    channels,
    users,
    self: mumbleClient.self ? {
      session: mumbleClient.self.session,
      channelId: mumbleClient.self.channelId,
    } : null,
  }));
}

function broadcast(msg: any) {
  const data = JSON.stringify(msg);
  webClients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

const WEBRTC_FRAME_SIZE = 480; // 10ms at 48kHz - what RTCAudioSource expects

function broadcastAudio(pcmData: Int16Array) {
  // RTCAudioSource expects 10ms frames (480 samples)
  // Split the incoming audio into chunks
  for (let offset = 0; offset < pcmData.length; offset += WEBRTC_FRAME_SIZE) {
    const chunk = pcmData.slice(offset, offset + WEBRTC_FRAME_SIZE);
    if (chunk.length < WEBRTC_FRAME_SIZE) {
      // Pad with silence if needed
      const padded = new Int16Array(WEBRTC_FRAME_SIZE);
      padded.set(chunk);
      sendAudioChunk(padded);
    } else {
      sendAudioChunk(chunk);
    }
  }
}

function sendAudioChunk(samples: Int16Array) {
  webClients.forEach((client) => {
    if (client.audioSource) {
      try {
        client.audioSource.onData({
          samples,
          sampleRate: SAMPLE_RATE,
          bitsPerSample: 16,
          channelCount: CHANNELS,
        });
      } catch (err) {
        console.error('Error sending audio to client:', err);
      }
    }
  });
}

// Initialize Mumble client
mumbleClient = new MumbleClient({
  host,
  port: mumblePort,
  username,
  password,
  debug: true,
  logger: (msg: string) => {
    // Log sendAudio, UDP, and error messages
    if (msg.includes('sendAudio') || msg.includes('UDP') || msg.includes('error') || msg.includes('Error') || msg.includes('Not ready')) {
      console.log(msg);
    }
  }
});

// Opus decoder for Mumble audio
mumbleDecoder = new OpusDecoder({
  sample_rate: SAMPLE_RATE,
  channels: CHANNELS,
});

mumbleClient.on('ready', () => {
  console.log(`Connected to Mumble as "${username}"`);
  console.log(`Self session: ${mumbleClient.session}, channel: ${mumbleClient.self?.channelId}`);

  // Setup whisper to current channel
  mumbleClient.setupWhisperToCurrentChannel();

  // Send state to all connected web clients
  webClients.forEach((client, ws) => sendState(ws));
});

mumbleClient.on('channelCreate', () => {
  webClients.forEach((client, ws) => sendState(ws));
});

mumbleClient.on('channelRemove', () => {
  webClients.forEach((client, ws) => sendState(ws));
});

mumbleClient.on('channelUpdate', () => {
  webClients.forEach((client, ws) => sendState(ws));
});

mumbleClient.on('userJoin', (user) => {
  broadcast({ type: 'userJoin', user: { session: user.session, name: user.name, channelId: user.channelId } });
  webClients.forEach((client, ws) => sendState(ws));
});

mumbleClient.on('userLeave', (user) => {
  broadcast({ type: 'userLeave', session: user.session });
  webClients.forEach((client, ws) => sendState(ws));
});

mumbleClient.on('userUpdate', (user, oldUser) => {
  webClients.forEach((client, ws) => sendState(ws));

  // If we moved channels, update whisper target
  if (user.session === mumbleClient.session && user.channelId !== oldUser.channelId) {
    mumbleClient.setupWhisperToCurrentChannel();
  }
});

mumbleClient.on('userStartSpeaking', (session) => {
  console.log(`User ${session} started speaking`);
  broadcast({ type: 'userStartSpeaking', session });
});

mumbleClient.on('userStopSpeaking', (session) => {
  console.log(`User ${session} stopped speaking`);
  broadcast({ type: 'userStopSpeaking', session });
});

let audioPacketCount = 0;
mumbleClient.on('audio', (session, opusData) => {
  try {
    // Decode Opus to PCM
    const pcm = mumbleDecoder.decode(opusData);
    if (pcm && pcm.length > 0) {
      // Convert Uint8Array to Int16Array
      const int16 = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2);
      // Log occasionally to avoid spam
      if (audioPacketCount++ % 50 === 0) {
        console.log(`Received Mumble audio from session ${session}, ${int16.length} samples, broadcasting to ${webClients.size} clients`);
      }
      broadcastAudio(int16);
    }
  } catch (err) {
    console.error('Decode error:', err);
  }
});

mumbleClient.on('error', (err) => {
  console.error('Mumble error:', err);
});

mumbleClient.on('disconnected', (reason) => {
  console.log('Disconnected from Mumble:', reason);
  broadcast({ type: 'disconnected', reason });
});

// Start servers
httpServer.listen(HTTP_PORT, () => {
  console.log(`Web server running at http://localhost:${HTTP_PORT}`);
  console.log(`Connecting to Mumble server ${host}:${mumblePort}...`);

  mumbleClient.connect().catch((err) => {
    console.error('Failed to connect:', err);
    process.exit(1);
  });
});
