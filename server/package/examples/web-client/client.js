// Mumble Web Client with WebRTC
const SAMPLE_RATE = 48000;

let ws = null;
let pc = null; // WebRTC peer connection
let localStream = null;
let isTalking = false;
let state = { channels: [], users: [], self: null };
let speakingUsers = new Set();

// Connect to server
function connect() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    console.log('WebSocket connected');
    updateStatus('connected', 'Connected');
    setupWebRTC();
  };

  ws.onclose = () => {
    console.log('Disconnected from server');
    updateStatus('disconnected', 'Disconnected');
    if (pc) {
      pc.close();
      pc = null;
    }
    // Reconnect after 3 seconds
    setTimeout(connect, 3000);
  };

  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    handleMessage(msg);
  };
}

async function setupWebRTC() {
  console.log('Setting up WebRTC...');

  pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
  });

  // Handle incoming audio track from server
  pc.ontrack = (event) => {
    console.log('Received audio track from server:', event.track.kind, event.track.readyState);

    // Create a MediaStream from the track (streams array may be empty)
    const stream = event.streams[0] || new MediaStream([event.track]);

    const audio = new Audio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.volume = 1.0;

    // Store reference to keep it alive and allow debugging
    window.remoteAudio = audio;

    audio.play().then(() => {
      console.log('Audio playback started');
    }).catch(err => console.error('Audio play error:', err));

    // Monitor the track
    event.track.onmute = () => console.log('Track muted');
    event.track.onunmute = () => console.log('Track unmuted');
    event.track.onended = () => console.log('Track ended');
  };

  pc.onicecandidate = (event) => {
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

  pc.onsignalingstatechange = () => {
    console.log('Signaling state:', pc.signalingState);
  };

  // Add a transceiver for bidirectional audio
  pc.addTransceiver('audio', { direction: 'sendrecv' });

  // Create and send offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log('Sending offer:', pc.localDescription);
  ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
}

function handleMessage(msg) {
  switch (msg.type) {
    case 'answer':
      console.log('Received WebRTC answer');
      pc.setRemoteDescription(new RTCSessionDescription(msg.sdp))
        .then(() => console.log('Remote description set successfully'))
        .catch(err => console.error('Error setting remote description:', err));
      break;

    case 'ice-candidate':
      if (msg.candidate) {
        pc.addIceCandidate(msg.candidate);
      }
      break;

    case 'state':
      state = msg;
      renderChannelTree();
      break;

    case 'userJoin':
      console.log('User joined:', msg.user.name);
      break;

    case 'userLeave':
      console.log('User left:', msg.session);
      speakingUsers.delete(msg.session);
      break;

    case 'userStartSpeaking':
      speakingUsers.add(msg.session);
      renderChannelTree();
      break;

    case 'userStopSpeaking':
      speakingUsers.delete(msg.session);
      renderChannelTree();
      break;

    case 'disconnected':
      updateStatus('disconnected', `Disconnected: ${msg.reason}`);
      break;
  }
}

function updateStatus(type, text) {
  const el = document.getElementById('status');
  el.className = `status ${type}`;
  el.textContent = text;
}

function renderChannelTree() {
  const container = document.getElementById('channel-tree');

  // Build tree structure
  const channelMap = new Map();
  state.channels.forEach(ch => channelMap.set(ch.id, { ...ch, children: [], users: [] }));

  // Assign users to channels
  state.users.forEach(user => {
    const ch = channelMap.get(user.channelId);
    if (ch) ch.users.push(user);
  });

  // Build parent-child relationships
  const roots = [];
  channelMap.forEach(ch => {
    if (ch.parent === undefined || ch.parent === ch.id) {
      roots.push(ch);
    } else {
      const parent = channelMap.get(ch.parent);
      if (parent) parent.children.push(ch);
    }
  });

  // Sort children by position
  const sortChildren = (ch) => {
    ch.children.sort((a, b) => a.position - b.position);
    ch.children.forEach(sortChildren);
  };
  roots.forEach(sortChildren);

  // Render
  let html = '';
  const renderChannel = (ch, depth = 0) => {
    const isCurrent = state.self && state.self.channelId === ch.id;
    const indent = depth * 20;

    html += `<div class="channel ${isCurrent ? 'current' : ''}"
                  style="margin-left: ${indent}px"
                  data-channel-id="${ch.id}">
      <span class="channel-name">${escapeHtml(ch.name)}</span>
    </div>`;

    // Users in channel
    ch.users.forEach(user => {
      const isSelf = state.self && state.self.session === user.session;
      const isSpeaking = speakingUsers.has(user.session);
      let status = '';
      if (user.deaf) status = '(deaf)';
      else if (user.mute) status = '(muted)';

      html += `<div class="user ${isSelf ? 'self' : ''} ${isSpeaking ? 'speaking' : ''}"
                    style="margin-left: ${indent + 20}px">
        ${escapeHtml(user.name)}${isSelf ? ' (you)' : ''}
        <span class="user-status">${status}</span>
      </div>`;
    });

    // Child channels
    ch.children.forEach(child => renderChannel(child, depth + 1));
  };

  roots.forEach(ch => renderChannel(ch));
  container.innerHTML = html || 'No channels';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function joinChannel(channelId) {
  console.log('joinChannel called with:', channelId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'joinChannel', channelId }));
  }
}

async function startTalking() {
  if (isTalking || !pc) return;

  try {
    console.log('Starting microphone...');
    // Get microphone
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }
    });
    console.log('Got microphone stream:', localStream.getAudioTracks());

    // Add audio track to peer connection
    const audioTrack = localStream.getAudioTracks()[0];

    // Find the audio transceiver and replace its track
    const transceivers = pc.getTransceivers();
    console.log('Transceivers:', transceivers.map(t => ({ mid: t.mid, direction: t.direction, currentDirection: t.currentDirection })));

    const audioTransceiver = transceivers.find(t => t.receiver.track.kind === 'audio');
    if (audioTransceiver && audioTransceiver.sender) {
      console.log('Replacing track on existing transceiver');
      await audioTransceiver.sender.replaceTrack(audioTrack);
    } else {
      // Fallback: try senders
      const senders = pc.getSenders();
      const audioSender = senders.find(s => s.track?.kind === 'audio' || !s.track);

      if (audioSender) {
        console.log('Replacing track on existing sender');
        await audioSender.replaceTrack(audioTrack);
      } else {
        console.log('Adding new track, will need renegotiation');
        pc.addTrack(audioTrack, localStream);

        // Need to renegotiate
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(JSON.stringify({ type: 'offer', sdp: pc.localDescription }));
      }
    }

    isTalking = true;
    document.getElementById('ptt-button').classList.add('active');
    document.getElementById('audio-indicator').style.display = 'flex';

    // Monitor the mic track
    const micTrack = localStream.getAudioTracks()[0];
    micTrack.onmute = () => console.log('Mic track MUTED');
    micTrack.onunmute = () => console.log('Mic track unmuted');
    micTrack.onended = () => console.log('Mic track ENDED');

    // Notify server that we're talking
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'startTalking' }));
    }
    console.log('Started talking, mic track state:', micTrack.readyState, 'enabled:', micTrack.enabled);
  } catch (err) {
    console.error('Error starting microphone:', err);
  }
}

function stopTalking() {
  if (!isTalking) return;

  isTalking = false;

  // Stop the audio track
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  // Remove the track from peer connection
  const senders = pc.getSenders();
  const audioSender = senders.find(s => s.track?.kind === 'audio');
  if (audioSender) {
    audioSender.replaceTrack(null);
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'stopTalking' }));
  }

  document.getElementById('ptt-button').classList.remove('active');
  document.getElementById('audio-indicator').style.display = 'none';
  console.log('Stopped talking');
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  const pttButton = document.getElementById('ptt-button');

  // Mouse events
  pttButton.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startTalking();
  });

  pttButton.addEventListener('mouseup', stopTalking);
  pttButton.addEventListener('mouseleave', stopTalking);

  // Touch events
  pttButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startTalking();
  });

  pttButton.addEventListener('touchend', stopTalking);

  // Keyboard events (SPACE)
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      startTalking();
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      stopTalking();
    }
  });

  // Channel double-click handler (event delegation)
  document.getElementById('channel-tree').addEventListener('dblclick', (e) => {
    const channelEl = e.target.closest('.channel');
    if (channelEl) {
      const channelId = parseInt(channelEl.dataset.channelId, 10);
      console.log('Double-click on channel:', channelId);
      joinChannel(channelId);
    }
  });

  // Connect to server
  connect();
});
