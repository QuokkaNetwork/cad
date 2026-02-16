# cad_bridge (Draft)

This resource links FiveM/QBox to CAD for:
- Steam identifier to in-game source mapping
- Unit position heartbeat updates into CAD
- CAD fine queue polling (for QBox billing integration)
- `/000` in-game emergency command to create CAD calls

## Install
1. In CAD Admin > System Settings > FiveM CAD Bridge:
- Set `FiveM Resources Directory`
- Set `CAD API Base URL` (usually `http://127.0.0.1:3030` if CAD is on the same host)
- Set `Shared Bridge Token`
- Click `Install / Update Resource`

2. Add to your FiveM `server.cfg` manually:
- `ensure cad_bridge`

3. Add convars in `server.cfg`:
- `set cad_bridge_base_url http://YOUR_CAD_HOST:3030`
- `set cad_bridge_token YOUR_SHARED_TOKEN`

If those convars are missing, the installed resource now falls back to the CAD values saved in System Settings.

Optional:
- `set cad_bridge_heartbeat_ms 5000`
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
- This is a first-draft bridge and may require adapter tweaks for your billing stack.

## `/000` command
- Players can use `/000 <type> | <details> | <suspects> | <vehicle> | <hazards/injuries>` in-game.
- Quick form is also supported: `/000 <details>`.
- Use `/000 help` to show usage in chat.
- The bridge sends a high-priority CAD call with current street/postal location (when available).
- CAD creates the call in an active dispatch-visible department so units can self-attach.
