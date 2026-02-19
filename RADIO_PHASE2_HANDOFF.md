# Radio Switch - Phase 2 (Deferred Handoff)

Status: `In progress`  
Created: `2026-02-18`
Resumed: `2026-02-19`

## Goal
Complete Phase 2 of the external radio behavior with a stable, simple flow:
- In-game player joins channel -> talks to other in-game players.
- CAD dispatcher joins same channel -> can hear/transmit to in-game players.
- Keep proximity voice separate from radio behavior.

## Current Baseline
- `RADIO_BEHAVIOR=external` mode exists and now hard-disables the legacy CAD-managed Mumble bridge.
- `VOICE_BRIDGE_ENABLED=true` only applies when `RADIO_BEHAVIOR=legacy`.
- FiveM resource has custom radio paths and does not rely on `mm_radio`.
- Voice channel membership endpoints and CAD UI wiring are present.

## Why This Is Deferred
- Avoid destabilizing currently working server voice behavior.
- Phase 2 requires coordinated CAD + resource + UX + validation changes in one rollout.

## Phase 2 Scope (when resumed)
1. Finalize one radio authority model
- Keep one canonical channel source of truth (CAD API + bridge resource state).
- Remove/avoid duplicate membership writers that can desync channels.

2. CAD Voice UX parity
- Ensure CAD Voice page uses same channel join/leave semantics as in-game radio.
- Add explicit state labels for: connected, joined, receiving, transmitting.
- Add user-facing troubleshooting text when channel has zero routable participants.

3. In-game radio behavior hardening
- Confirm `/radio`, join, leave, and PTT use only the new path.
- Keep proximity unaffected and independent.
- Confirm radio SFX/mic click lifecycle works for join, TX start, TX stop.

4. Cross-link routing correctness
- Verify dispatcher -> in-game and in-game -> dispatcher audio path for same channel (future non-Mumble transport).
- Ensure stale participant cleanup cannot drop active participants.
- Ensure channel switch is atomic (leave old before join new).

5. Config cleanup
- Keep only required radio-related config keys in `server/fivem-resource/config.cfg`.
- Keep `.env` radio keys aligned with external mode (no legacy-only leftovers).
- Document final minimal config set once complete.

6. Logging/diagnostics pass
- Keep concise periodic diagnostics (connected, channel, targets, inbound/outbound packet counters).
- Add clear per-event logs: join success, route match count, no-route reason.
- Keep debug noise bounded to avoid log spam.

## Progress (2026-02-19)
- Transport finding pass (free resource + live hosted app):
  - External stack is WebRTC-based and uses LiveKit signaling/infra (`wss://*.livekit.cloud`), not Mumble.
- Started CAD Voice UX parity work:
  - Added explicit state labels for `connected`, `joined`, `receiving`, `transmitting` on the CAD Voice page.
  - Added operator troubleshooting banner when a joined channel has zero routable in-game participants.
- Started diagnostics hardening in `cad_bridge`:
  - Added radio join/leave result logs with route target counts and no-route reasons.
  - Added transmit-start route diagnostics with no-route reason throttling.
- Began external-mode config alignment:
  - Enabled `cad_bridge_radio_channel_sync_enabled=true`.
  - Enabled `cad_bridge_voice_participant_heartbeat_enabled=true`.
- Radio authority alignment pass:
  - Stopped heartbeat-driven participant updates from re-queueing CAD `voice-events` back to FiveM (prevents duplicate membership writers/echo loop).
  - Added `cad_bridge_voice_event_poll_enabled` (default `false`) to keep one-way flow by default.
- External-mode hardening:
  - Enforced that external mode always disables CAD-managed Mumble bridge even if `VOICE_BRIDGE_ENABLED=true`.
  - Updated status/config guidance so legacy bridge is only available in `RADIO_BEHAVIOR=legacy`.
- Reference resource deep comparison (local free copy):
  - In-game radio UI bootstraps a remote standalone client (`standaloneUrl`) in CEF/NUI and sends radio state updates to it.
  - Server registers a public callback endpoint (`/events`) and periodically updates backend `pushUrl` + `roomId`.
  - Access to voice sessions is tokenized (guest/emergency tokens) via backend API calls.
  - Net result: transport is external web audio stack (WebRTC in hosted client), not CAD-managed Mumble bridging.
- Gap confirmed in current `cad_bridge` external mode:
  - Channel membership/state sync is in place.
  - Actual dispatcher media path is missing in external mode (CAD page currently only has legacy websocket + Mumble media client).
  - In-game radio TX/RX path is still Mumble-target based; this conflicts with the no-Mumble end goal.
- Phase 2 implementation started (token/auth foundation):
  - Added external voice provider service in CAD (`none`, `livekit`, `jwt` modes) with status reporting and token minting.
  - Added `GET /api/voice/external/status` and `POST /api/voice/external/token`.
  - Token endpoint enforces dispatch/admin auth + external mode + joined-channel membership before minting.
  - Extended `GET /api/voice/bridge/status` to include `external_transport` status.
  - Updated CAD Voice page to request an external token when joining a channel in external mode and show transport/session readiness.
  - Added env scaffolding in `.env.example` for external provider config.
  - Added bridge-auth external token endpoints for in-game units:
    - `GET /api/integration/fivem/external-voice/status`
    - `POST /api/integration/fivem/external-voice/token`
  - Added FiveM bridge-side external token session lifecycle:
    - requests token on radio channel join/switch
    - clears token on leave/disconnect
    - periodic pre-expiry refresh while player remains in channel
    - startup provider-status check log
  - Added `cad_bridge_external_voice_token_enabled` config toggle (`config.lua` + `config.cfg`).
  - Added client event hook `cad_bridge:external_voice:session` and NUI message forwarding (`externalVoiceSession`) so the in-game UI path can consume issued tokens.
- Phase 2 implementation continued (media path wired):
  - Updated dispatcher token issuance route to allow accepted `000` call channels (active call session context) even when no `voice_participants` row exists.
  - Added CAD web external media client (`livekit-client`) and wired Voice page join/leave/PTT to real external transport connect/publish/subscribe.
  - Added in-game NUI external media bridge (`ui/external_voice_bridge.js`) that consumes `externalVoiceSession` + `updateRadioTalking` and joins/publishes/subscribes via LiveKit.
  - Updated in-game Lua radio path to bypass CAD radio Mumble routing when external transport session is active (no Mumble radio routing while external session is healthy).
  - Wired new NUI script in `ui/index.html` and `fxmanifest.lua`.

## Immediate Phase 2 Build Order (No-Mumble Path)
1. Validate end-to-end with two in-game units + one dispatcher on the same channel (RX/TX both directions).
2. Validate accepted `000` call-channel flow in CAD external mode (token issuance + audio path).
3. Decide whether to vendor LiveKit browser SDK locally for NUI (remove runtime CDN dependency if desired).
4. Add production diagnostics for external transport state transitions (connect/disconnect/reconnect and token refresh outcomes).

## Acceptance Criteria
- Two in-game players on same channel can hear each other consistently.
- Dispatcher in CAD joins same channel and:
  - hears both in-game players,
  - can transmit to both in-game players.
- No repeated transport error loop in normal operation.
- Channel switch does not require reconnect to recover audio.
- Restart of CAD and resource recovers to working state without manual DB cleanup.

## Test Plan Template (Phase 2 execution day)
1. Start CAD + FiveM with `RADIO_BEHAVIOR=external`.
2. Join two in-game players to channel `1`; verify two-way radio.
3. Join CAD dispatcher to channel `1`; verify receive + transmit both directions.
4. Switch CAD to channel `2` (empty); verify “no route targets” state.
5. Move one in-game player to channel `2`; verify CAD receives/transmits.
6. Restart CAD only; retest steps 3-5.
7. Restart resource only; retest steps 2-5.

## Rollback Plan
- Revert to previously known-good radio behavior commit.
- Restore prior `.env` and `config.cfg` radio settings.
- Restart CAD + FiveM and validate in-game radio first, then CAD bridge.

## Notes
- Do not execute this phase until explicitly approved.
- When resumed, implement in a dedicated branch and validate with the test plan above before VPS deployment.
