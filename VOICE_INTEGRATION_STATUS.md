# Voice Integration with pma-voice - Implementation Status

## ⚠️ IMPORTANT LIMITATION

**Dispatchers CANNOT talk to in-game players from the web browser CAD interface.**

This is a fundamental limitation of FiveM's Mumble voice system - it only works for players connected to the game server. Voice transmission requires being in the FiveM server.

### What DOES Work:
- ✅ Dispatchers **in-game** (on duty as dispatch units) CAN join radio channels
- ✅ Dispatchers **in-game** CAN accept and talk on 000 phone calls
- ✅ Web UI shows real-time who's talking on what channel (visual feedback)
- ✅ Radio channels are automatically created per department
- ✅ 000 calls create unique phone channels that dispatchers can join

### What DOESN'T Work:
- ❌ Web browser-based dispatchers cannot transmit voice to in-game players
- ❌ No "click to talk" from web UI to game voice chat

---

## ✅ Completed Implementation

### 1. Database Layer
**File:** `server/src/db/migrations/019_voice_channels.js`
- Created `voice_channels` table - tracks radio channels for departments
- Created `voice_participants` table - tracks who's in which channel
- Created `voice_call_sessions` table - tracks 000 phone call sessions
- Auto-creates default radio channels (channel 100 + department_id)

**File:** `server/src/db/sqlite.js` (updated)
- Added `VoiceChannels` model with CRUD operations
- Added `VoiceParticipants` model to track channel membership
- Added `VoiceCallSessions` model to manage 000 call lifecycle
- Exported all voice models

### 2. API Layer
**File:** `server/src/routes/voice.js` (new)
- `GET /api/voice/channels` - List all voice channels with participants
- `GET /api/voice/channels/:id/participants` - Get channel participants
- `POST /api/voice/channels/:id/join` - Join a radio channel
- `POST /api/voice/channels/:id/leave` - Leave a radio channel
- `GET /api/voice/calls/pending` - List pending 000 calls
- `GET /api/voice/calls/active` - List active 000 calls
- `POST /api/voice/calls/:id/accept` - Accept a 000 call
- `POST /api/voice/calls/:id/decline` - Decline a 000 call
- `POST /api/voice/calls/:id/end` - End an active call

**File:** `server/src/index.js` (updated)
- Registered `/api/voice` router

### 3. Event Bus Integration
All voice operations emit events through the event bus for SSE real-time updates:
- `voice:join` - When someone joins a channel
- `voice:leave` - When someone leaves a channel
- `voice:call_accepted` - When a dispatcher accepts a 000 call
- `voice:call_declined` - When a dispatcher declines a 000 call
- `voice:call_ended` - When a call is ended

---

## 🚧 Remaining Work

### 4. FiveM Resource Integration (NOT STARTED)

**File:** `server/fivem-resource/server.lua` (needs updates)
```lua
-- Add voice channel management functions
-- Add pma-voice exports integration
-- Handle 000 calls creating voice sessions
-- Poll CAD for voice events and sync with pma-voice
```

**Required Functions:**
- `setPlayerToRadioChannel(source, channelNumber)` - Use `exports['pma-voice']:setPlayerRadio()`
- `setPlayerToCallChannel(source, channelNumber)` - Use `exports['pma-voice']:setPlayerCall()`
- `removePlayerFromRadio(source)` - Set radio to channel 0
- `removePlayerFromCall(source)` - Set call to channel 0
- Create voice session when 000 call is created
- Poll `/api/integration/fivem/voice-events` for dispatcher actions

**File:** `server/fivem-resource/client.lua` (needs minimal updates)
- No major client changes needed - pma-voice handles client-side voice

### 5. CAD API Extensions (NOT STARTED)

**File:** `server/src/routes/fivem.js` (needs new endpoints)
```javascript
// GET /api/integration/fivem/voice-events
// Returns pending voice channel join/leave events for FiveM to process

// POST /api/integration/fivem/voice-events/:id/sent
// Mark voice event as processed

// POST /api/integration/fivem/calls/:callId/voice-session
// Create voice session for a 000 call
```

### 6. Web UI Updates (NOT STARTED)

**Component:** Dispatcher Voice Tab (new)
- Show list of radio channels
- Show participants in each channel
- Button to join/leave channels (for dispatchers in-game only)
- Real-time talking indicator (animated mic icon)

**Component:** 000 Call Handling (update)
- Show pending 000 calls in sidebar
- "Accept Call" / "Decline Call" buttons
- Show active call with "End Call" button
- Display caller info and call details

**Integration Points:**
- Listen to SSE events for voice updates
- API calls to join/leave channels
- API calls to accept/decline/end calls

---

## 📋 Implementation Checklist

- [x] Database migrations for voice tables
- [x] Database models (VoiceChannels, VoiceParticipants, VoiceCallSessions)
- [x] API routes for voice management
- [x] Event bus integration
- [ ] FiveM server.lua voice integration
- [ ] FiveM bridge endpoints for voice events
- [ ] Voice session creation on 000 calls
- [ ] Web UI - Radio Channels Tab
- [ ] Web UI - 000 Call Answer Interface
- [ ] Web UI - Real-time voice indicators
- [ ] Testing with pma-voice

---

## 🎯 How It Will Work (Once Complete)

### Radio Channels
1. **Department channels are auto-created** (e.g., Police on channel 101, Fire on channel 102)
2. **Dispatcher clicks "Join Channel 101"** in CAD web UI
3. **CAD sends API request** to join channel
4. **FiveM bridge polls CAD** and sees join request
5. **FiveM calls pma-voice export:** `exports['pma-voice']:setPlayerRadio(dispatcherSource, 101)`
6. **Dispatcher in-game can now hear/talk** on that radio channel

### 000 Calls
1. **Civilian calls /000** in-game
2. **CAD creates call + voice session** with unique channel (e.g., 10001)
3. **Civilian is added to channel 10001** automatically
4. **Dispatcher sees pending call** in CAD UI
5. **Dispatcher clicks "Accept Call"**
6. **FiveM bridge detects acceptance** and adds dispatcher to channel 10001
7. **Dispatcher and civilian can now talk** on the call channel
8. **Dispatcher clicks "End Call"** when done
9. **Both parties removed from voice channel**

---

## 🔧 pma-voice Exports Reference

### Server-Side Exports
```lua
-- Set player radio channel
exports['pma-voice']:setPlayerRadio(source, channelNumber)

-- Set player call channel
exports['pma-voice']:setPlayerCall(source, channelNumber)

-- Get players in radio channel
local players = exports['pma-voice']:getPlayersInRadioChannel(channelNumber)
```

### Client-Side Exports
```lua
-- Set local player radio channel
exports['pma-voice']:setRadioChannel(channelNumber)

-- Set local player call channel
exports['pma-voice']:setCallChannel(channelNumber)
```

### State Bags (Read-Only)
```lua
-- Get player's current radio channel
local radioChannel = Player(source).state.radioChannel

-- Get player's current call channel
local callChannel = Player(source).state.callChannel
```

### Events
```lua
-- Triggered when player starts/stops talking on radio
RegisterNetEvent('pma-voice:setTalkingOnRadio', function(source, talking) end)

-- Triggered when player starts/stops talking on call
RegisterNetEvent('pma-voice:setTalkingOnCall', function(source, talking) end)
```

---

## 📝 Notes

- Voice channels use numeric IDs (not strings)
- Radio channels: 100-999 (100 + department_id)
- Call channels: 10000+ (incremental)
- pma-voice must be started BEFORE cad_bridge
- Check `GetResourceState('pma-voice')` before calling exports
- Dispatch department units can join any channel
- Non-dispatch units automatically join their department radio

---

## 🎨 UI Mockup (Radio Tab)

```
┌─ Radio Channels ─────────────────────────────────┐
│                                                    │
│  🔊 Channel 101 - LSPD Radio            [Join]    │
│     👤 Unit 1-A-1 (John Doe) 🎙️ Talking          │
│     👤 Unit 1-A-2 (Jane Smith)                    │
│     👤 Dispatcher (You)                           │
│                                                    │
│  🔊 Channel 102 - LSFD Radio            [Join]    │
│     👤 Fire-1 (Bob Jones)                         │
│                                                    │
│  🔊 Channel 103 - EMS Radio             [Join]    │
│     (No participants)                             │
│                                                    │
└───────────────────────────────────────────────────┘

┌─ Active 000 Calls ────────────────────────────────┐
│                                                    │
│  📞 Call #45 - Armed Robbery                      │
│     Caller: John_Doe (#123)                       │
│     Location: Legion Square (A4B2)                │
│     [Accept Call] [Decline]                       │
│                                                    │
│  📞 Call #46 - Traffic Accident                   │
│     Caller: Jane_Smith (#456)                     │
│     Location: Vinewood Blvd (B3C4)                │
│     [Accept Call] [Decline]                       │
│                                                    │
└───────────────────────────────────────────────────┘

┌─ Your Active Call ─────────────────────────────────┐
│                                                    │
│  📞 Call #45 - Armed Robbery              [End]   │
│     🎙️ Talking with John_Doe                      │
│     Duration: 00:02:34                            │
│                                                    │
└───────────────────────────────────────────────────┘
```

---

## 🚀 Next Steps

1. **Complete FiveM server.lua integration** with pma-voice exports
2. **Add voice event polling** to FiveM bridge
3. **Update 000 call creation** to create voice sessions
4. **Build web UI components** for radio and call management
5. **Test with live pma-voice installation**
6. **Document usage for server admins**
