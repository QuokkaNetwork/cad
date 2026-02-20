Config = {}

local function trim(value)
  return (tostring(value or ''):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function unquote(value)
  local text = trim(value)
  if #text >= 2 then
    local first = text:sub(1, 1)
    local last = text:sub(-1)
    if (first == '"' and last == '"') or (first == "'" and last == "'") then
      text = text:sub(2, -2)
    end
  end
  text = text:gsub('\\"', '"')
  text = text:gsub("\\'", "'")
  return text
end

local function stripInlineComment(line)
  local inSingle = false
  local inDouble = false
  local escaped = false

  for i = 1, #line do
    local char = line:sub(i, i)
    if escaped then
      escaped = false
    elseif char == '\\' then
      escaped = true
    elseif char == "'" and not inDouble then
      inSingle = not inSingle
    elseif char == '"' and not inSingle then
      inDouble = not inDouble
    elseif char == '#' and not inSingle and not inDouble then
      local prev = i > 1 and line:sub(i - 1, i - 1) or ''
      if prev == '' or prev:match('%s') then
        return line:sub(1, i - 1)
      end
    end
  end

  return line
end

local function parseConfigLine(line)
  local raw = trim(stripInlineComment(line or ''))
  if raw == '' then return nil, nil end
  if raw:match('^;') or raw:match('^%-%-') or raw:match('^#') then
    return nil, nil
  end

  local _cmd, keySet, valueSet = raw:match('^([Ss][Ee][Tt][RrSs]?)%s+([^%s]+)%s*(.-)%s*$')
  if keySet then
    return keySet, unquote(valueSet)
  end

  local keyEq, valueEq = raw:match('^([^=%s]+)%s*=%s*(.-)%s*$')
  if keyEq then
    return keyEq, unquote(valueEq)
  end

  local keySpace, valueSpace = raw:match('^([^%s]+)%s+(.+)$')
  if keySpace then
    return keySpace, unquote(valueSpace)
  end

  return nil, nil
end

local function loadResourceConfig()
  local values = {}
  local hasKey = {}
  local content = LoadResourceFile(GetCurrentResourceName(), 'config.cfg')
  if not content or content == '' then
    return values, hasKey
  end

  for line in tostring(content):gmatch('[^\r\n]+') do
    local key, value = parseConfigLine(line)
    if key then
      local normalized = trim(key)
      if normalized ~= '' then
        values[normalized] = value
        hasKey[normalized] = true
      end
    end
  end

  return values, hasKey
end

local ResourceConfigValues, ResourceConfigHasKey = loadResourceConfig()

local function getString(key, fallback)
  local lookup = trim(key)
  if lookup ~= '' and ResourceConfigHasKey[lookup] then
    return tostring(ResourceConfigValues[lookup] or '')
  end
  return GetConvar(lookup, tostring(fallback or ''))
end

local function getNumber(key, fallback)
  local value = tonumber(trim(getString(key, '')))
  if value ~= nil then return value end
  return tonumber(fallback) or 0
end

local function getBoolean(key, fallback)
  local value = trim(getString(key, ''))
  if value == '' then return fallback == true end
  local lowered = value:lower()
  if lowered == '1' or lowered == 'true' or lowered == 'yes' or lowered == 'on' then return true end
  if lowered == '0' or lowered == 'false' or lowered == 'no' or lowered == 'off' then return false end
  return fallback == true
end

local function decodeJsonTable(raw)
  local text = trim(raw)
  if text == '' then return nil end
  local ok, parsed = pcall(function()
    return json.decode(text)
  end)
  if not ok or type(parsed) ~= 'table' then
    return nil
  end
  return parsed
end

local function getJsonTable(key)
  return decodeJsonTable(getString(key, ''))
end

local function parseCsvList(rawValue, transform)
  local raw = trim(rawValue)
  local out = {}
  local seen = {}
  if raw == '' then return out end

  for token in raw:gmatch('([^,]+)') do
    local item = trim(token)
    if item ~= '' then
      if type(transform) == 'function' then
        item = transform(item)
      end
      if item ~= '' and not seen[item] then
        seen[item] = true
        out[#out + 1] = item
      end
    end
  end

  return out
end

local function parseCsvIntegerList(rawValue)
  local values = parseCsvList(rawValue, function(item)
    local numeric = tonumber(item)
    if not numeric then return '' end
    numeric = math.floor(numeric)
    if numeric < 1 then return '' end
    return tostring(numeric)
  end)

  local out = {}
  for _, entry in ipairs(values) do
    out[#out + 1] = tonumber(entry)
  end
  return out
end

local function firstNonEmptyList(...)
  for i = 1, select('#', ...) do
    local candidate = select(i, ...)
    if type(candidate) == 'table' and #candidate > 0 then
      return candidate
    end
  end
  return {}
end

local function parseVec4String(rawValue, fallback)
  if type(fallback) ~= 'table' then
    fallback = { x = 0.0, y = 0.0, z = 0.0, w = 0.0 }
  end
  local raw = trim(rawValue)
  if raw == '' then
    return {
      x = tonumber(fallback.x) or 0.0,
      y = tonumber(fallback.y) or 0.0,
      z = tonumber(fallback.z) or 0.0,
      w = tonumber(fallback.w) or 0.0,
    }
  end

  local numbers = {}
  for token in raw:gmatch('([^,%s]+)') do
    local numeric = tonumber(token)
    if numeric then
      numbers[#numbers + 1] = numeric
    end
  end
  if #numbers < 4 then
    return {
      x = tonumber(fallback.x) or 0.0,
      y = tonumber(fallback.y) or 0.0,
      z = tonumber(fallback.z) or 0.0,
      w = tonumber(fallback.w) or 0.0,
    }
  end

  return {
    x = tonumber(numbers[1]) or 0.0,
    y = tonumber(numbers[2]) or 0.0,
    z = tonumber(numbers[3]) or 0.0,
    w = tonumber(numbers[4]) or 0.0,
  }
end

local DEFAULT_RADIO_NAMES = {
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

local DEFAULT_DRIVER_LICENSE_CLASS_OPTIONS = {
  'CAR',
  'LR',
  'MR',
  'HR',
  'HC',
  'MC',
  'R',
  'L',
}

local DEFAULT_DRIVER_LICENSE_DEFAULT_CLASSES = { 'CAR' }
local DEFAULT_DURATION_OPTIONS = { 6, 14, 35, 70 }
local DEFAULT_DRIVER_LICENSE_PED_COORDS = { x = 240.87, y = -1378.69, z = 32.74, w = 140.89 }
local DEFAULT_VEHICLE_REGISTRATION_PED_COORDS = { x = -30.67, y = -1096.12, z = 26.27, w = 65.43 }
local DEFAULT_DOCUMENT_INTERACTION_PEDS = {
  {
    id = 'city_hall',
    model = 's_m_m_dockwork_01',
    coords = { x = -542.52, y = -197.15, z = 37.24, w = 76.49 },
    scenario = 'WORLD_HUMAN_CLIPBOARD',
    allows_license = true,
    allows_registration = false,
  },
  {
    id = 'pdm',
    model = 's_m_y_dealer_01',
    coords = { x = -30.67, y = -1096.12, z = 26.27, w = 65.43 },
    scenario = 'WORLD_HUMAN_CLIPBOARD',
    allows_license = false,
    allows_registration = true,
    registration_duration_options = { 1 },
  },
  {
    id = 'driving_school',
    model = 's_m_m_dockwork_01',
    coords = { x = 240.87, y = -1378.69, z = 32.74, w = 140.89 },
    scenario = 'WORLD_HUMAN_CLIPBOARD',
    allows_license = true,
    allows_registration = true,
    registration_parking_coords = { x = 222.96, y = -1387.89, z = 29.54 },
    registration_parking_radius = 20.0,
  },
  {
    id = 'sandy_pd',
    model = 's_m_y_cop_01',
    coords = { x = 1833.16, y = 3679.28, z = 33.19, w = 207.3 },
    scenario = 'WORLD_HUMAN_CLIPBOARD',
    allows_license = true,
    allows_registration = false,
  },
  {
    id = 'paleto_pd',
    model = 's_m_y_cop_01',
    coords = { x = -448.35, y = 6014.05, z = 31.29, w = 223.5 },
    scenario = 'WORLD_HUMAN_CLIPBOARD',
    allows_license = true,
    allows_registration = false,
  },
}

local DEFAULT_DRIVER_LICENSE_FEES_BY_DAYS = {
  [6] = 1500,
  [14] = 3000,
  [35] = 7500,
  [70] = 14000,
}

local DEFAULT_REGISTRATION_FEES_BY_DAYS = {
  [6] = 2500,
  [14] = 5000,
  [35] = 12000,
  [70] = 22000,
}

-- CAD bridge endpoint/token.
Config.CadBaseUrl = getString('cad_bridge_base_url', 'http://127.0.0.1:3031')
Config.SharedToken = getString('cad_bridge_token', '')

-- Sync intervals (milliseconds).
Config.HeartbeatIntervalMs = math.max(250, math.floor(getNumber('cad_bridge_heartbeat_ms', 1500)))
Config.FinePollIntervalMs = math.max(1000, math.floor(getNumber('cad_bridge_fine_poll_ms', 7000)))
Config.JobSyncPollIntervalMs = math.max(1000, math.floor(getNumber('cad_bridge_job_sync_poll_ms', 5000)))
Config.RoutePollIntervalMs = math.max(1000, math.floor(getNumber('cad_bridge_route_poll_ms', 4000)))
Config.VoicePollIntervalMs = math.max(250, math.floor(getNumber('cad_bridge_voice_poll_ms', 1000)))
Config.JailPollIntervalMs = math.max(1000, math.floor(getNumber('cad_bridge_jail_poll_ms', 7000)))

Config.PublishAllPlayers = getBoolean('cad_bridge_publish_all_players', true)

-- Postal integration.
Config.UseNearestPostal = getBoolean('cad_bridge_use_nearest_postal', true)
Config.NearestPostalResource = getString('cad_bridge_postal_resource', 'nearest-postal')
Config.NearestPostalExport = getString('cad_bridge_postal_export', 'getPostal')

-- NPWD integration.
Config.NpwdResource = trim(getString('cad_bridge_npwd_resource', 'npwd'))
if Config.NpwdResource == '' then Config.NpwdResource = 'npwd' end
Config.NpwdEmergencyNumbers = trim(getString('cad_bridge_npwd_emergency_numbers', '000'))
if Config.NpwdEmergencyNumbers == '' then Config.NpwdEmergencyNumbers = '000' end

-- ox_lib notifications.
Config.ForceOxNotifyPosition = getBoolean('cad_bridge_force_ox_notify_position', true)
Config.OxNotifyPosition = trim(getString('cad_bridge_ox_notify_position', 'center-right'))
if Config.OxNotifyPosition == '' then Config.OxNotifyPosition = 'center-right' end
Config.OxNotifyForceIntervalMs = math.max(5000, math.floor(getNumber('cad_bridge_ox_notify_force_interval_ms', 60000)))

-- Radio settings.
Config.RadioAdapter = trim(getString('cad_bridge_radio_adapter', 'cad-radio'))
if Config.RadioAdapter == '' then Config.RadioAdapter = 'cad-radio' end
Config.RadioEnabled = getBoolean('cad_bridge_radio_enabled', true)
Config.RadioTargetId = math.floor(getNumber('cad_bridge_radio_target_id', 2))
Config.ProximityTargetId = math.floor(getNumber('cad_bridge_proximity_target_id', 1))
Config.RadioRxVolume = getNumber('cad_bridge_radio_rx_volume', 0.35)
if Config.RadioRxVolume < 0.0 then Config.RadioRxVolume = 0.0 end
if Config.RadioRxVolume > 1.0 then Config.RadioRxVolume = 1.0 end
Config.RadioPttKey = trim(getString('cad_bridge_radio_ptt_key', 'LMENU'))
if Config.RadioPttKey == '' then Config.RadioPttKey = 'LMENU' end
Config.RadioFollowNativePtt = getBoolean('cad_bridge_radio_follow_native_ptt', true)
Config.RadioForwardRoot = getBoolean('cad_bridge_radio_forward_root', false)
Config.RadioUiEnabled = getBoolean('cad_bridge_radio_ui_enabled', true)
Config.RadioUiKey = trim(getString('cad_bridge_radio_ui_key', 'EQUALS'))
if Config.RadioUiKey == '' then Config.RadioUiKey = 'EQUALS' end
Config.RadioMaxFrequency = math.max(1, math.floor(getNumber('cad_bridge_radio_max_frequency', 500)))
Config.RadioOverlayMode = trim(getString('cad_bridge_radio_overlay', 'default'))
if Config.RadioOverlayMode == '' then Config.RadioOverlayMode = 'default' end
Config.RadioChannelSyncEnabled = getBoolean('cad_bridge_radio_channel_sync_enabled', true)
Config.VoiceParticipantHeartbeatEnabled = getBoolean('cad_bridge_voice_participant_heartbeat_enabled', true)
Config.VoiceEventPollEnabled = getBoolean('cad_bridge_voice_event_poll_enabled', false)
Config.ExternalVoiceTokenEnabled = getBoolean('cad_bridge_external_voice_token_enabled', false)

Config.RadioNames = DEFAULT_RADIO_NAMES
local radioNamesOverride = getJsonTable('cad_bridge_radio_names_json')
if type(radioNamesOverride) == 'table' then
  Config.RadioNames = radioNamesOverride
end

Config.RadioRestrictedChannels = {}
local radioRestrictedOverride = getJsonTable('cad_bridge_radio_restricted_channels_json')
if type(radioRestrictedOverride) == 'table' then
  Config.RadioRestrictedChannels = radioRestrictedOverride
end

-- Driver license + registration documents.
Config.EnableDocumentCommands = getBoolean('cad_bridge_enable_document_commands', false)
Config.DriverLicenseCommand = trim(getString('cad_bridge_license_command', 'cadlicense'))
if Config.DriverLicenseCommand == '' then Config.DriverLicenseCommand = 'cadlicense' end
Config.VehicleRegistrationCommand = trim(getString('cad_bridge_registration_command', 'cadrego'))
if Config.VehicleRegistrationCommand == '' then Config.VehicleRegistrationCommand = 'cadrego' end
Config.ShowIdCommand = trim(getString('cad_bridge_show_id_command', 'showid'))
if Config.ShowIdCommand == '' then Config.ShowIdCommand = 'showid' end
Config.ShowIdKey = trim(getString('cad_bridge_show_id_key', 'PAGEDOWN'))
if Config.ShowIdKey == '' then Config.ShowIdKey = 'PAGEDOWN' end
Config.ShowIdTargetDistance = getNumber('cad_bridge_show_id_target_distance', 4.0)
if Config.ShowIdTargetDistance < 0.5 then Config.ShowIdTargetDistance = 0.5 end
Config.ShowIdNearbyDistance = getNumber('cad_bridge_show_id_nearby_distance', Config.ShowIdTargetDistance)
if Config.ShowIdNearbyDistance < 1.0 then Config.ShowIdNearbyDistance = 1.0 end
Config.LiveMapCalibrationEnabled = getBoolean('cad_bridge_live_map_calibration_enabled', true)
Config.LiveMapCalibrationCommand = trim(getString('cad_bridge_live_map_calibration_command', 'calibrate'))
if Config.LiveMapCalibrationCommand == '' then Config.LiveMapCalibrationCommand = 'calibrate' end
Config.LiveMapCalibrationPadding = getNumber('cad_bridge_live_map_calibration_padding', 250.0)
if Config.LiveMapCalibrationPadding < 0.0 then Config.LiveMapCalibrationPadding = 0.0 end
Config.LiveMapCalibrationAce = trim(getString('cad_bridge_live_map_calibration_ace', 'cad_bridge.calibrate'))
if Config.LiveMapCalibrationAce == '' then Config.LiveMapCalibrationAce = 'cad_bridge.calibrate' end

Config.DriverLicenseDefaultExpiryDays = math.max(1, math.floor(getNumber('cad_bridge_license_default_expiry_days', 35)))
Config.VehicleRegistrationDefaultDays = math.max(1, math.floor(getNumber('cad_bridge_registration_default_days', 35)))
Config.DriverLicenseQuizPassPercent = math.max(1, math.min(100, math.floor(getNumber('cad_bridge_license_quiz_pass_percent', 80))))
Config.DriverLicenseQuizExpiryDays = math.max(1, math.floor(getNumber('cad_bridge_license_quiz_expiry_days', 30)))
Config.DocumentPedInteractionDistance = getNumber('cad_bridge_document_ped_interaction_distance', 2.2)
if Config.DocumentPedInteractionDistance < 1.0 then Config.DocumentPedInteractionDistance = 1.0 end
Config.DocumentPedPromptDistance = getNumber('cad_bridge_document_ped_prompt_distance', 12.0)
if Config.DocumentPedPromptDistance < Config.DocumentPedInteractionDistance then
  Config.DocumentPedPromptDistance = Config.DocumentPedInteractionDistance + 2.0
end

local driverDurationFromCsv = parseCsvIntegerList(getString('cad_bridge_license_duration_options', ''))
local regoDurationFromCsv = parseCsvIntegerList(getString('cad_bridge_registration_duration_options', ''))
Config.DriverLicenseDurationOptions = firstNonEmptyList(driverDurationFromCsv, DEFAULT_DURATION_OPTIONS)
Config.VehicleRegistrationDurationOptions = firstNonEmptyList(regoDurationFromCsv, DEFAULT_DURATION_OPTIONS)

local classOptionsFromCsv = parseCsvList(getString('cad_bridge_license_class_options', ''), function(item)
  return item:upper()
end)
local classDefaultsFromCsv = parseCsvList(getString('cad_bridge_license_default_classes', ''), function(item)
  return item:upper()
end)
Config.DriverLicenseClassOptions = firstNonEmptyList(classOptionsFromCsv, DEFAULT_DRIVER_LICENSE_CLASS_OPTIONS)
Config.DriverLicenseDefaultClasses = firstNonEmptyList(classDefaultsFromCsv, DEFAULT_DRIVER_LICENSE_DEFAULT_CLASSES)
Config.DriverLicenseQuizClasses = firstNonEmptyList(
  parseCsvList(getString('cad_bridge_license_quiz_classes', 'CAR'), function(item)
    return item:upper()
  end),
  DEFAULT_DRIVER_LICENSE_DEFAULT_CLASSES
)

Config.DriverLicensePed = {
  enabled = getBoolean('cad_bridge_license_ped_enabled', true),
  model = trim(getString('cad_bridge_license_ped_model', 's_m_m_dockwork_01')),
  coords = parseVec4String(getString('cad_bridge_license_ped_coords', ''), DEFAULT_DRIVER_LICENSE_PED_COORDS),
  scenario = trim(getString('cad_bridge_license_ped_scenario', 'WORLD_HUMAN_CLIPBOARD')),
  label = trim(getString('cad_bridge_license_ped_label', 'Press ~INPUT_CONTEXT~ to take the licence quiz')),
}
if Config.DriverLicensePed.model == '' then Config.DriverLicensePed.model = 's_m_m_dockwork_01' end

Config.VehicleRegistrationPed = {
  enabled = getBoolean('cad_bridge_registration_ped_enabled', true),
  model = trim(getString('cad_bridge_registration_ped_model', 's_m_y_dealer_01')),
  coords = parseVec4String(getString('cad_bridge_registration_ped_coords', ''), DEFAULT_VEHICLE_REGISTRATION_PED_COORDS),
  scenario = trim(getString('cad_bridge_registration_ped_scenario', 'WORLD_HUMAN_CLIPBOARD')),
  label = trim(getString('cad_bridge_registration_ped_label', 'Press ~INPUT_CONTEXT~ to manage vehicle rego')),
}
if Config.VehicleRegistrationPed.model == '' then Config.VehicleRegistrationPed.model = 's_m_y_dealer_01' end

Config.DocumentInteractionPeds = DEFAULT_DOCUMENT_INTERACTION_PEDS

Config.DocumentFeeAccount = trim(getString('cad_bridge_document_fee_account', 'bank'))
if Config.DocumentFeeAccount == '' then Config.DocumentFeeAccount = 'bank' end
Config.RequireDocumentFeePayment = getBoolean('cad_bridge_document_fee_required', false)
Config.DocumentDebugLogs = getBoolean('cad_bridge_document_debug_logs', true)

Config.DriverLicenseFeesByDays = DEFAULT_DRIVER_LICENSE_FEES_BY_DAYS
local licenseFeesOverride = getJsonTable('cad_bridge_license_fees_json')
if type(licenseFeesOverride) == 'table' then
  Config.DriverLicenseFeesByDays = licenseFeesOverride
end

Config.VehicleRegistrationFeesByDays = DEFAULT_REGISTRATION_FEES_BY_DAYS
local registrationFeesOverride = getJsonTable('cad_bridge_registration_fees_json')
if type(registrationFeesOverride) == 'table' then
  Config.VehicleRegistrationFeesByDays = registrationFeesOverride
end

-- Mugshot/photo capture.
Config.MugshotProvider = trim(getString('cad_bridge_mugshot_provider', 'auto')):lower()
if Config.MugshotProvider == '' then Config.MugshotProvider = 'auto' end
Config.ScreenshotResource = trim(getString('cad_bridge_screenshot_resource', 'screencapture'))
if Config.ScreenshotResource == '' then Config.ScreenshotResource = 'screencapture' end
Config.ScreenshotEncoding = trim(getString('cad_bridge_screenshot_encoding', 'jpg')):lower()
if Config.ScreenshotEncoding == '' then Config.ScreenshotEncoding = 'jpg' end
Config.ScreenshotQuality = getNumber('cad_bridge_screenshot_quality', 0.7)
if Config.ScreenshotQuality < 0.1 then Config.ScreenshotQuality = 0.1 end
if Config.ScreenshotQuality > 1.0 then Config.ScreenshotQuality = 1.0 end
Config.ScreenshotTimeoutMs = math.max(1000, math.floor(getNumber('cad_bridge_screenshot_timeout_ms', 5000)))
Config.ScreenshotChromaKeyEnabled = getBoolean('cad_bridge_screenshot_chroma_key_enabled', false)
Config.MugshotResource = trim(getString('cad_bridge_mugshot_resource', 'MugShotBase64'))

-- Fine/job/jail adapters.
Config.FineAdapter = trim(getString('cad_bridge_fine_adapter', 'auto'))
if Config.FineAdapter == '' then Config.FineAdapter = 'auto' end
Config.FineCommandTemplate = getString('cad_bridge_fine_command', 'qbx_fine {citizenid} {amount} {reason}')

Config.JobSyncAdapter = trim(getString('cad_bridge_job_sync_adapter', 'none'))
if Config.JobSyncAdapter == '' then Config.JobSyncAdapter = 'none' end
Config.JobSyncCommandTemplate = getString('cad_bridge_job_sync_command', 'qbx_setjob {source} {job} {grade}')

Config.JailAdapter = trim(getString('cad_bridge_jail_adapter', 'wasabi'))
if Config.JailAdapter == '' then Config.JailAdapter = 'wasabi' end
Config.JailCommandTemplate = getString('cad_bridge_jail_command', 'jail {source} {minutes} {reason}')

-- Wraith integration.
Config.WraithCadLookupEnabled = getBoolean('cad_bridge_wraith_lookup_enabled', true)
Config.WraithLookupCooldownMs = math.max(250, math.floor(getNumber('cad_bridge_wraith_lookup_cooldown_ms', 8000)))
