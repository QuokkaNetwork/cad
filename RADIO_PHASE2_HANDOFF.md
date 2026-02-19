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

## Immediate Phase 2 Build Order (No-Mumble Path)
1. Add an external media transport service (self-hosted WebRTC SFU) and token issuance API in CAD.
2. Add CAD web client transport (join/leave/PTT) for dispatchers using that external service.
3. Add FiveM NUI transport client for in-game radio TX/RX using the same channel IDs.
4. Keep existing CAD channel membership + heartbeat flow as signaling/authorization source of truth.
5. Remove legacy Mumble-root assumptions from the in-game TX path once external media path is verified.

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
