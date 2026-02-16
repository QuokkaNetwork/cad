# cad_bridge (Draft)

This resource links FiveM/QBox to CAD for:
- Steam identifier to in-game source mapping
- Unit position heartbeat updates into CAD
- CAD fine queue polling (for QBox billing integration)

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
- `set cad_bridge_fine_adapter command`
- `set cad_bridge_fine_command qbx_fine {citizenid} {amount} {reason}`
- `set cad_bridge_use_nearest_postal true`
- `set cad_bridge_postal_resource nearest-postal`
- `set cad_bridge_postal_export getPostal`

## QBox fine adapter
The default adapter runs a server command using `cad_bridge_fine_command`.
You should point this to a command/resource in your server that actually creates invoices/fines in your QBox setup.
If the configured command is not registered, CAD fine jobs will now fail with a clear error instead of being marked sent.

## Notes
- Steam identifiers are required for CAD user matching.
- CAD must have the same Steam IDs for logged-in users.
- If nearest-postal export is unavailable, CAD falls back to street names and then XYZ.
- This is a first-draft bridge and may require adapter tweaks for your billing stack.
