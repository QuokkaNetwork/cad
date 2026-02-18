# cad_bridge (Draft)

This resource links FiveM/QBox to CAD for:
- Steam identifier to in-game source mapping
- Unit position heartbeat updates into CAD
- CAD fine queue polling (for QBox billing integration)
- `/000` in-game emergency command to create CAD calls

## Install
1. In CAD Admin > System Settings > FiveM CAD Bridge:
- Set `FiveM Resources Directory`
- Set `CAD API Base URL` (use `http://127.0.0.1:3031` — the CAD exposes a plain HTTP bridge port on 3031 for FiveM since FiveM cannot verify self-signed HTTPS certs; 3030 is HTTPS for browsers only)
- Set `Shared Bridge Token`
- Click `Install / Update Resource`

2. Add to your FiveM `server.cfg` manually:
- `ensure cad_bridge`

3. Add convars in `server.cfg`:
- `set cad_bridge_base_url http://127.0.0.1:3031` (use the HTTP bridge port, not the HTTPS 3030 port)
- `set cad_bridge_token YOUR_SHARED_TOKEN`

If those convars are missing, the installed resource now falls back to the CAD values saved in System Settings.

Optional:
- `set cad_bridge_heartbeat_ms 1500`
- `set cad_bridge_fine_poll_ms 7000`
- `set cad_bridge_job_sync_poll_ms 5000`
- `set cad_bridge_route_poll_ms 4000`
- `set cad_bridge_fine_adapter auto`
- `set cad_bridge_fine_command qbx_fine {citizenid} {amount} {reason}`
- `set cad_bridge_job_sync_adapter auto`
- `set cad_bridge_job_sync_command qbx_setjob {source} {job} {grade}`
- `set cad_bridge_use_nearest_postal true`
- `set cad_bridge_postal_resource nearest-postal`
- `set cad_bridge_postal_export getPostal`
- `set cad_bridge_npwd_resource npwd`
- `set cad_bridge_npwd_emergency_numbers 000`
- `set cad_bridge_radio_adapter cad-radio`
- `set cad_bridge_radio_ui_enabled true`
- `set cad_bridge_radio_ptt_key LMENU`
- `set cad_bridge_radio_ui_key EQUALS`
- `set cad_bridge_radio_target_id 2`
- `set cad_bridge_radio_rx_volume 0.35`
- `set cad_bridge_radio_max_frequency 500`
- `set cad_bridge_license_command cadlicense`
- `set cad_bridge_registration_command cadrego`
- `set cad_bridge_license_default_expiry_days 1095`
- `set cad_bridge_registration_default_days 365`
- `set cad_bridge_mugshot_resource MugShotBase64`

## CAD custom radio (built-in UI)
- `cad-radio` runs radio membership/routing inside `cad_bridge`.
- `mm_radio` is not used by this setup.
- In `voice.cfg`, keep `setr voice_enableRadios 0` so only `cad_bridge` handles radio keys/routing.
- Open radio UI with `cad_bridge_radio_ui_key` (default `EQUALS`).
- Transmit on radio with `cad_bridge_radio_ptt_key` (default `LMENU`).
- Use `/radio` to open UI, `/radio <channel>` to join, `/radio off` to leave.
- Restricted channels are optional and configured via `Config.RadioRestrictedChannels` in `config.lua`.

CAD-side fine delivery options:
- In Admin > System Settings, `Fine Delivery Mode = Direct QBX DB` applies fines directly in the QBX players table.
- `Fine Delivery Mode = FiveM Bridge (In-Game)` applies fines through this resource to the currently logged-in character and supports in-game notifications.

CAD-side job sync options:
- In Admin > Departments/Sub-Departments, set `FiveM Job Mapping` (`job name` + `grade`) for role targets.
- In Admin > Users, set `Preferred Character (citizenid)` if job sync should only target one character.
- In Admin > System Settings, enable `Discord Role Job Sync` and set fallback job/grade.
- During Discord role sync, CAD queues job/rank updates that this resource applies in-game.

## QBox fine adapter
Default `auto` adapter applies fines to the online character using `qbx_core`/`qb-core` money APIs.
If `ox_lib` is running, fined players receive an in-game notification.
You can switch to `command` and use `cad_bridge_fine_command` if your server uses a custom fine command flow.
If your command expects a player source, include `{source}` in the command template.
Command adapter execution now waits for the target character to be online.

## Notes
- Steam identifiers are required for CAD user matching.
- CAD must have the same Steam IDs for logged-in users.
- If nearest-postal export is unavailable, CAD falls back to street names and then XYZ.
- Assigned call routes are pushed to in-game clients by postal/coords when available.
- Heartbeat payload now includes map metadata (`weapon`, `vehicle`, `license_plate`, `icon`, siren status) used by CAD Live Map.
- This is a first-draft bridge and may require adapter tweaks for your billing stack.

## `/000` command
- Players can use `/000` with no args to open a custom in-game NUI panel (not text boxes).
- The NUI panel supports title, details, and selecting one or more required operational departments (dispatch excluded).
- Players can still use `/000 <type> | <details> | <suspects> | <vehicle> | <hazards/injuries>` in chat.
- Use `/000 help` to show usage in chat.
- The bridge sends a high-priority CAD call with current street/postal location (when available).
- CAD creates the call in an active dispatch-visible department so units can self-attach.

## Driver license + registration commands
- Use `/cadlicense` (configurable with `cad_bridge_license_command`) to open the in-game driver license form.
- Use `/cadrego` (configurable with `cad_bridge_registration_command`) to open the vehicle registration form.
- Driver license captures name, DOB, gender, classes, optional conditions/mugshot URL, and expiry.
- Vehicle registration captures owner name, plate, model, colour, duration, and expiry.
- Records are stored in CAD with status workflows:
  `Driver license`: `valid`, `suspended`, `disqualified`, `expired`
  `Registration`: `valid`, `suspended`, `revoked`, `expired`
- CAD auto-marks licenses/registrations as `expired` when expiry date is reached.

## NPWD 000 phone hook (no NPWD edits)
- `cad_bridge` now registers NPWD emergency handlers directly via NPWD exports (`onCall`).
- This means NPWD source files do not need to be patched/replaced for 000->CAD call creation.
- Set `cad_bridge_npwd_resource` if your phone resource name is not `npwd`.
- Set `cad_bridge_npwd_emergency_numbers` to a comma-separated list if you use additional emergency numbers.
