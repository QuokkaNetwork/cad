Config = {}

-- CAD base URL (no trailing slash).
-- The CAD server runs HTTPS on port 3030 (for browser mic access) but also
-- exposes a plain HTTP listener on port 3031 specifically for the FiveM bridge,
-- because PerformHttpRequest cannot verify self-signed TLS certs.
-- Leave this default unless you changed BRIDGE_HTTP_PORT in .env.
Config.CadBaseUrl = GetConvar('cad_bridge_base_url', 'http://127.0.0.1:3031')
-- Shared token must match Admin > System Settings > FiveM CAD Bridge
Config.SharedToken = GetConvar('cad_bridge_token', '')

-- Sync intervals (milliseconds)
-- Lower default keeps CAD Live Map responsive while staying light on HTTP requests.
Config.HeartbeatIntervalMs = tonumber(GetConvar('cad_bridge_heartbeat_ms', '1500')) or 1500
Config.FinePollIntervalMs = tonumber(GetConvar('cad_bridge_fine_poll_ms', '7000')) or 7000
Config.JobSyncPollIntervalMs = tonumber(GetConvar('cad_bridge_job_sync_poll_ms', '5000')) or 5000
Config.RoutePollIntervalMs = tonumber(GetConvar('cad_bridge_route_poll_ms', '4000')) or 4000

-- Voice event poll interval (milliseconds)
-- How often the bridge polls CAD for pending voice join/leave events (radio and calls).
Config.VoicePollIntervalMs = tonumber(GetConvar('cad_bridge_voice_poll_ms', '1000')) or 1000

-- If true, publish all online players.
-- If false, only players with steam/discord/license identifiers are published.
Config.PublishAllPlayers = GetConvar('cad_bridge_publish_all_players', 'true') == 'true'

-- Nearest postal integration (client-side export lookup).
-- Typical script: nearest-postal with export getPostal.
Config.UseNearestPostal = GetConvar('cad_bridge_use_nearest_postal', 'true') == 'true'
Config.NearestPostalResource = GetConvar('cad_bridge_postal_resource', 'nearest-postal')
Config.NearestPostalExport = GetConvar('cad_bridge_postal_export', 'getPostal')

-- Radio adapter for CAD-driven radio channel join/leave events:
-- 'auto'      -> detect pma-voice or mm-radio automatically (recommended)
-- 'pma-voice' -> require pma-voice to be running
-- 'mm-radio'  -> require mm_radio to be running
--               (mm-radio depends on pma-voice; both use pma-voice server exports)
-- 'none'      -> disable CAD-driven in-game radio sync
Config.RadioAdapter = GetConvar('cad_bridge_radio_adapter', 'auto')

-- Fine processing adapter
-- 'auto' -> try qbx_core/qb-core RemoveMoney on online character + notify
-- 'command' -> ExecuteCommand with template below
-- 'none' -> mark failed unless you customize server.lua
Config.FineAdapter = GetConvar('cad_bridge_fine_adapter', 'auto')

-- Tokens available: {source}, {citizenid}, {amount}, {reason}
Config.FineCommandTemplate = GetConvar('cad_bridge_fine_command', 'qbx_fine {citizenid} {amount} {reason}')

-- Job sync adapter:
-- 'auto' -> try qbx_core/qb-core player SetJob API
-- 'command' -> ExecuteCommand with template below
-- 'none' -> disable job sync applies in resource
Config.JobSyncAdapter = GetConvar('cad_bridge_job_sync_adapter', 'none')

-- Tokens available: {source}, {citizenid}, {job}, {grade}
Config.JobSyncCommandTemplate = GetConvar('cad_bridge_job_sync_command', 'qbx_setjob {source} {job} {grade}')
