Config = {}

-- CAD base URL (no trailing slash)
Config.CadBaseUrl = GetConvar('cad_bridge_base_url', 'http://127.0.0.1:3030')
-- Shared token must match Admin > System Settings > FiveM CAD Bridge
Config.SharedToken = GetConvar('cad_bridge_token', '')

-- Sync intervals (milliseconds)
Config.HeartbeatIntervalMs = tonumber(GetConvar('cad_bridge_heartbeat_ms', '5000')) or 5000
Config.FinePollIntervalMs = tonumber(GetConvar('cad_bridge_fine_poll_ms', '7000')) or 7000

-- If true, publish all online players. If false, only players with steam identifiers are published.
Config.PublishAllPlayers = false

-- Fine processing adapter
-- 'command' -> ExecuteCommand with template below
-- 'none' -> mark failed unless you customize server.lua
Config.FineAdapter = GetConvar('cad_bridge_fine_adapter', 'command')

-- Tokens available: {citizenid}, {amount}, {reason}
Config.FineCommandTemplate = GetConvar('cad_bridge_fine_command', 'qbx_fine {citizenid} {amount} {reason}')
