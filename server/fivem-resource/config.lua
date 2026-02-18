Config = {}

local function trim(value)
  return tostring(value or ''):gsub('^%s+', ''):gsub('%s+$', '')
end

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
-- 'cad-radio' -> custom CAD radio implementation (recommended/default)
-- 'none'      -> disable CAD-driven in-game radio sync
Config.RadioAdapter = GetConvar('cad_bridge_radio_adapter', 'cad-radio')

-- Built-in CAD radio UI/channel config.
Config.RadioMaxFrequency = tonumber(GetConvar('cad_bridge_radio_max_frequency', '500')) or 500
Config.RadioOverlayMode = tostring(GetConvar('cad_bridge_radio_overlay', 'default'))

-- Friendly names shown in the built-in radio UI.
Config.RadioNames = {
  ['1'] = 'DISPATCH (All Units)',
  ['1.%'] = 'DISPATCH (All Units)',
  ['2'] = 'VICPOL',
  ['2.%'] = 'VICPOL',
  ['3'] = 'AV',
  ['3.%'] = 'AV',
  ['4'] = 'FRV',
  ['4.%'] = 'FRV',
  ['420'] = 'Ballas CH#1',
  ['420.%'] = 'Ballas CH#1',
  ['421'] = 'LostMC CH#1',
  ['421.%'] = 'LostMC CH#1',
  ['422'] = 'Vagos CH#1',
  ['422.%'] = 'Vagos CH#1',
}

-- Channel ACL (optional; empty means every player can join every channel).
-- Example:
-- Config.RadioRestrictedChannels = {
--   [2] = { type = 'job', name = { 'police', 'ambulance' } },
-- }
Config.RadioRestrictedChannels = {}

-- CAD-issued driver license + vehicle registration commands/forms.
Config.DriverLicenseCommand = trim(GetConvar('cad_bridge_license_command', 'cadlicense'))
if Config.DriverLicenseCommand == '' then Config.DriverLicenseCommand = 'cadlicense' end
Config.VehicleRegistrationCommand = trim(GetConvar('cad_bridge_registration_command', 'cadrego'))
if Config.VehicleRegistrationCommand == '' then Config.VehicleRegistrationCommand = 'cadrego' end
Config.ShowIdCommand = trim(GetConvar('cad_bridge_show_id_command', 'showid'))
if Config.ShowIdCommand == '' then Config.ShowIdCommand = 'showid' end

Config.DriverLicenseDefaultExpiryDays = tonumber(GetConvar('cad_bridge_license_default_expiry_days', '35')) or 35
Config.DriverLicenseDurationOptions = { 6, 14, 35, 70 }
Config.DriverLicenseClassOptions = {
  'CAR',  -- Car
  'LR',   -- Light rigid
  'MR',   -- Medium rigid
  'HR',   -- Heavy rigid
  'HC',   -- Heavy combination
  'MC',   -- Multi combination
  'R',    -- Rider
  'L',    -- Learner
}
Config.DriverLicenseDefaultClasses = { 'CAR' }

Config.VehicleRegistrationDefaultDays = tonumber(GetConvar('cad_bridge_registration_default_days', '35')) or 35
Config.VehicleRegistrationDurationOptions = { 6, 14, 35, 70 }

-- In-game pricing for licence/rego issue or renewal (charged before CAD upsert).
-- Keys are duration in days (6d, 14d, 35d, 70d).
Config.DocumentFeeAccount = trim(GetConvar('cad_bridge_document_fee_account', 'bank'))
if Config.DocumentFeeAccount == '' then Config.DocumentFeeAccount = 'bank' end
Config.DriverLicenseFeesByDays = {
  [6] = 1500,
  [14] = 3000,
  [35] = 7500,
  [70] = 14000,
}
Config.VehicleRegistrationFeesByDays = {
  [6] = 2500,
  [14] = 5000,
  [35] = 12000,
  [70] = 22000,
}

-- Mugshot/photo provider
-- 'screenshot-basic' (recommended): high-quality portrait via scripted camera + screenshot-basic
-- 'mugshotbase64': legacy MugShotBase64 exports
-- 'auto': screenshot-basic first, then MugShotBase64 fallback
Config.MugshotProvider = trim(GetConvar('cad_bridge_mugshot_provider', 'screenshot-basic')):lower()
if Config.MugshotProvider == '' then Config.MugshotProvider = 'screenshot-basic' end

Config.ScreenshotResource = trim(GetConvar('cad_bridge_screenshot_resource', 'screenshot-basic'))
if Config.ScreenshotResource == '' then Config.ScreenshotResource = 'screenshot-basic' end
Config.ScreenshotEncoding = trim(GetConvar('cad_bridge_screenshot_encoding', 'png')):lower()
if Config.ScreenshotEncoding == '' then Config.ScreenshotEncoding = 'png' end
Config.ScreenshotQuality = tonumber(GetConvar('cad_bridge_screenshot_quality', '1.0')) or 1.0
if Config.ScreenshotQuality < 0.1 then Config.ScreenshotQuality = 0.1 end
if Config.ScreenshotQuality > 1.0 then Config.ScreenshotQuality = 1.0 end
Config.ScreenshotTimeoutMs = tonumber(GetConvar('cad_bridge_screenshot_timeout_ms', '5000')) or 5000
if Config.ScreenshotTimeoutMs < 1000 then Config.ScreenshotTimeoutMs = 1000 end

Config.MugshotResource = trim(GetConvar('cad_bridge_mugshot_resource', 'MugShotBase64'))

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
