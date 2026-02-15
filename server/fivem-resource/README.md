# cad_bridge (Draft)

This resource links FiveM/QBox to CAD for:
- Steam identifier to in-game source mapping
- Unit position heartbeat updates into CAD
- CAD fine queue polling (for QBox billing integration)

## Install
1. In CAD Admin > System Settings > FiveM CAD Bridge:
- Set `FiveM Resources Directory`
- Set `Shared Bridge Token`
- Click `Install / Update Resource`

2. Add to your FiveM `server.cfg` manually:
- `ensure cad_bridge`

3. Add convars in `server.cfg`:
- `set cad_bridge_base_url http://YOUR_CAD_HOST:3030`
- `set cad_bridge_token YOUR_SHARED_TOKEN`

Optional:
- `set cad_bridge_heartbeat_ms 5000`
- `set cad_bridge_fine_poll_ms 7000`
- `set cad_bridge_fine_adapter command`
- `set cad_bridge_fine_command qbx_fine {citizenid} {amount} {reason}`

## QBox fine adapter
The default adapter runs a server command using `cad_bridge_fine_command`.
You should point this to a command/resource in your server that actually creates invoices/fines in your QBox setup.

## Notes
- Steam identifiers are required for CAD user matching.
- CAD must have the same Steam IDs for logged-in users.
- This is a first-draft bridge and may require adapter tweaks for your billing stack.
