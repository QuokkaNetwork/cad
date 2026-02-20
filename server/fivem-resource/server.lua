local PlayerPositions = {}

local function trim(value)
  if value == nil then return '' end
  local text = tostring(value)
  return (text:gsub('^%s+', ''):gsub('%s+$', ''))
end

local function urlEncode(value)
  local text = tostring(value or '')
  return (text:gsub('[^%w%-_%.~]', function(char)
    return string.format('%%%02X', string.byte(char))
  end))
end

local function getCadUrl(path)
  local base = trim(Config.CadBaseUrl or '')
  base = base:gsub('/+$', '')
  return base .. path
end

local function hasBridgeConfig()
  return trim(Config.CadBaseUrl or '') ~= '' and trim(Config.SharedToken or '') ~= ''
end

local function encodeJson(payload)
  return json.encode(payload or {})
end

local DEFAULT_BACKOFF_SCOPE = 'global'
local bridgeBackoffUntilMsByScope = {}
local lastBackoffLogAtMsByScope = {}

local function nowMs()
  return tonumber(GetGameTimer() or 0) or 0
end

local function normalizeBackoffScope(scope)
  local normalized = trim(scope)
  if normalized == '' then return DEFAULT_BACKOFF_SCOPE end
  return normalized
end

local function getHeaderValue(responseHeaders, keyName)
  if type(responseHeaders) ~= 'table' then return '' end
  local expected = tostring(keyName or ''):lower()
  for key, value in pairs(responseHeaders) do
    if tostring(key or ''):lower() == expected then
      return tostring(value or '')
    end
  end
  return ''
end

local function computeBackoffMs(responseHeaders, fallbackMs)
  local retryAfterRaw = trim(getHeaderValue(responseHeaders, 'retry-after'))
  local retryAfterSeconds = tonumber(retryAfterRaw)
  if retryAfterSeconds and retryAfterSeconds > 0 then
    return math.max(1000, math.floor(retryAfterSeconds * 1000))
  end
  return math.max(1000, math.floor(tonumber(fallbackMs) or 10000))
end

local function setBridgeBackoff(scope, responseHeaders, fallbackMs, reason)
  local normalizedScope = normalizeBackoffScope(scope)
  local waitMs = computeBackoffMs(responseHeaders, fallbackMs)
  local nextUntil = nowMs() + waitMs
  local currentUntil = tonumber(bridgeBackoffUntilMsByScope[normalizedScope] or 0) or 0
  if nextUntil > currentUntil then
    bridgeBackoffUntilMsByScope[normalizedScope] = nextUntil
  end

  local now = nowMs()
  local lastLogAt = tonumber(lastBackoffLogAtMsByScope[normalizedScope] or 0) or 0
  if (now - lastLogAt) >= 2000 then
    lastBackoffLogAtMsByScope[normalizedScope] = now
    local scopeSuffix = normalizedScope ~= DEFAULT_BACKOFF_SCOPE and (' [' .. normalizedScope .. ']') or ''
    print(('[cad_bridge] backing off bridge requests%s for %sms (%s)'):format(
      scopeSuffix,
      math.max(0, (tonumber(bridgeBackoffUntilMsByScope[normalizedScope] or 0) or 0) - now),
      tostring(reason or '429')
    ))
  end
end

local function getBackoffRemainingMs(scope)
  local normalizedScope = normalizeBackoffScope(scope)
  local untilMs = tonumber(bridgeBackoffUntilMsByScope[normalizedScope] or 0) or 0
  if untilMs <= 0 then return 0 end
  local now = nowMs()
  if now >= untilMs then
    bridgeBackoffUntilMsByScope[normalizedScope] = 0
    return 0
  end
  return untilMs - now
end

local function getEffectiveBackoffRemainingMs(scope)
  local normalizedScope = normalizeBackoffScope(scope)
  local globalRemaining = getBackoffRemainingMs(DEFAULT_BACKOFF_SCOPE)
  if normalizedScope == DEFAULT_BACKOFF_SCOPE then return globalRemaining end
  local scopedRemaining = getBackoffRemainingMs(normalizedScope)
  if scopedRemaining > globalRemaining then return scopedRemaining end
  return globalRemaining
end

local function isBridgeBackoffActive(scope)
  return getEffectiveBackoffRemainingMs(scope) > 0
end

local function request(method, path, payload, cb)
  if not hasBridgeConfig() then
    print(('[cad_bridge] WARNING: Bridge not configured (base_url=%q token=%s). Skipping %s %s'):format(
      trim(Config.CadBaseUrl or ''),
      trim(Config.SharedToken or '') ~= '' and 'SET' or 'EMPTY',
      method or '?',
      path or '?'
    ))
    if cb then cb(0, '{}', {}) end
    return
  end

  local headers = {
    ['Content-Type'] = 'application/json',
    ['x-cad-bridge-token'] = Config.SharedToken,
  }

  local url = getCadUrl(path)
  PerformHttpRequest(url, function(status, body, responseHeaders)
    local code = tonumber(status) or 0
    if code == 0 then
      print(('[cad_bridge] WARNING: HTTP request returned status 0 (connection refused/timeout). URL: %s %s'):format(method or '?', url or '?'))
    end
    if cb then cb(code, body or '{}', responseHeaders or {}) end
  end, method, payload and encodeJson(payload) or '', headers)
end

local function hasTrackedIdentifier(identifiers)
  for _, identifier in ipairs(identifiers) do
    if identifier:sub(1, 6) == 'steam:' then
      return true
    end
    if identifier:sub(1, 8) == 'discord:' then
      return true
    end
    if identifier:sub(1, 8) == 'license:' then
      return true
    end
    if identifier:sub(1, 9) == 'license2:' then
      return true
    end
  end
  return false
end

local function isNumericOnly(value)
  local text = trim(value)
  if text == '' then return false end
  return text:match('^%d+$') ~= nil
end

local function extractCitizenIdFromState(state)
  if type(state) ~= 'table' then
    return '', ''
  end

  -- Prefer explicit citizenid fields first.
  local directCandidates = {
    state.citizenid,
    state.citizenId,
    state.playerCitizenId,
  }
  for _, candidate in ipairs(directCandidates) do
    local value = trim(candidate)
    if value ~= '' then
      return value, ''
    end
  end

  local statePlayerData = state.PlayerData
  if type(statePlayerData) == 'table' then
    local value = trim(statePlayerData.citizenid or '')
    if value ~= '' then
      return value, ''
    end
  end

  -- Some frameworks expose `state.cid` as a character slot index (e.g. "1"),
  -- so only use it as a last fallback.
  local cidFallback = trim(state.cid or '')
  if cidFallback == '' then
    return '', ''
  end
  if isNumericOnly(cidFallback) then
    return '', cidFallback
  end
  return cidFallback, ''
end

local function getCitizenId(src)
  local player = Player(src)
  local stateCitizenId = ''
  local numericCidFallback = ''
  if player and player.state then
    stateCitizenId, numericCidFallback = extractCitizenIdFromState(player.state)
  end

  if GetResourceState('qbx_core') == 'started' then
    local ok, xPlayer = pcall(function()
      return exports.qbx_core:GetPlayer(src)
    end)
    if ok and xPlayer and xPlayer.PlayerData and xPlayer.PlayerData.citizenid then
      return tostring(xPlayer.PlayerData.citizenid)
    end
  end

  -- QBCore fallback (for compatibility on mixed setups)
  if GetResourceState('qb-core') == 'started' then
    local ok, obj = pcall(function() return exports['qb-core']:GetCoreObject() end)
    if ok and obj and obj.Functions and obj.Functions.GetPlayer then
      local player = obj.Functions.GetPlayer(src)
      if player and player.PlayerData and player.PlayerData.citizenid then
        return tostring(player.PlayerData.citizenid)
      end
    end
  end

  if stateCitizenId ~= '' then
    return stateCitizenId
  end

  if numericCidFallback ~= '' then
    return numericCidFallback
  end

  return ''
end

local function getCharacterDefaults(src)
  local fullName = trim(GetPlayerName(src) or ('Player ' .. tostring(src)))
  local dateOfBirth = ''
  local gender = ''
  local citizenId = getCitizenId(src)

  local function applyCharInfo(charinfo)
    if type(charinfo) ~= 'table' then return end
    local first = trim(charinfo.firstname or charinfo.firstName or '')
    local last = trim(charinfo.lastname or charinfo.lastName or '')
    if first ~= '' or last ~= '' then
      fullName = trim((first .. ' ' .. last))
    end
    if dateOfBirth == '' then
      dateOfBirth = trim(charinfo.birthdate or charinfo.dob or charinfo.dateOfBirth or '')
    end
    if gender == '' then
      gender = trim(charinfo.gender or '')
      if gender == '0' then gender = 'Male' end
      if gender == '1' then gender = 'Female' end
    end
  end

  local player = Player(src)
  if player and player.state then
    local state = player.state
    applyCharInfo(state.charinfo)
    if type(state.PlayerData) == 'table' then
      applyCharInfo(state.PlayerData.charinfo)
      if fullName == '' then
        fullName = trim(state.PlayerData.name or '')
      end
    end
    if fullName == '' then
      fullName = trim(state.name or '')
    end
  end

  if GetResourceState('qbx_core') == 'started' then
    local ok, xPlayer = pcall(function()
      return exports.qbx_core:GetPlayer(src)
    end)
    if ok and xPlayer and xPlayer.PlayerData then
      local pd = xPlayer.PlayerData
      applyCharInfo(pd.charinfo or {})
    end
  end

  if GetResourceState('qb-core') == 'started' and (dateOfBirth == '' or gender == '' or fullName == '') then
    local ok, obj = pcall(function() return exports['qb-core']:GetCoreObject() end)
    if ok and obj and obj.Functions and obj.Functions.GetPlayer then
      local player = obj.Functions.GetPlayer(src)
      if player and player.PlayerData then
        local pd = player.PlayerData
        applyCharInfo(pd.charinfo or {})
      end
    end
  end

  return {
    citizenid = citizenId,
    full_name = fullName,
    date_of_birth = dateOfBirth,
    gender = gender,
  }
end

local function getCharacterDisplayName(src)
  local player = Player(src)
  if player and player.state then
    local state = player.state
    local function fromCharInfo(charinfo)
      if type(charinfo) ~= 'table' then return '' end
      local first = trim(charinfo.firstname or charinfo.firstName or '')
      local last = trim(charinfo.lastname or charinfo.lastName or '')
      local full = trim(first .. ' ' .. last)
      if full ~= '' then return full end
      return ''
    end

    local fromState = fromCharInfo(state.charinfo)
    if fromState ~= '' then return fromState end

    if type(state.PlayerData) == 'table' then
      local fromPlayerData = fromCharInfo(state.PlayerData.charinfo)
      if fromPlayerData ~= '' then return fromPlayerData end
      local named = trim(state.PlayerData.name or '')
      if named ~= '' then return named end
    end

    local stateName = trim(state.name or '')
    if stateName ~= '' then return stateName end
  end

  local fallback = trim(GetPlayerName(src) or '')
  if fallback ~= '' then return fallback end
  return 'Player ' .. tostring(src)
end

RegisterNetEvent('cad_bridge:clientPosition', function(position)
  local src = source
  if type(position) ~= 'table' then return end
  PlayerPositions[src] = {
    x = tonumber(position.x) or 0.0,
    y = tonumber(position.y) or 0.0,
    z = tonumber(position.z) or 0.0,
    heading = tonumber(position.heading) or 0.0,
    speed = tonumber(position.speed) or 0.0,
    street = tostring(position.street or ''),
    crossing = tostring(position.crossing or ''),
    postal = tostring(position.postal or ''),
    location = tostring(position.location or ''),
    vehicle = tostring(position.vehicle or ''),
    license_plate = tostring(position.license_plate or ''),
    has_siren_enabled = position.has_siren_enabled == true or position.has_siren_enabled == 1,
    icon = tonumber(position.icon) or 6,
    weapon = tostring(position.weapon or ''),
  }
end)

AddEventHandler('playerDropped', function(_reason)
  local src = source
  local identifiers = GetPlayerIdentifiers(src)
  PlayerPositions[src] = nil

  request('POST', '/api/integration/fivem/offline', {
    identifiers = identifiers,
  }, function() end)
end)

local function notifyPlayer(src, message)
  if not src or src <= 0 then return end
  if GetResourceState('chat') ~= 'started' then return end
  TriggerClientEvent('chat:addMessage', src, {
    color = { 0, 170, 255 },
    args = { 'CAD', tostring(message or '') },
  })
end

local function notifyAlert(src, title, message, level)
  local s = tonumber(src) or 0
  if s <= 0 then return end
  TriggerClientEvent('cad_bridge:notifyAlert', s, {
    title = trim(title) ~= '' and title or 'CAD',
    description = tostring(message or ''),
    type = trim(level) ~= '' and tostring(level) or 'inform',
  })
end

local function registerEmergencySuggestion(target)
  if GetResourceState('chat') ~= 'started' then return end
  TriggerClientEvent('chat:addSuggestion', target, '/000', 'Send emergency call to CAD', {
    { name = 'message', help = 'Leave blank to open popup. Optional chat format: /000 <type> | <details> | <suspects> | <vehicle> | <hazards/injuries>' },
  })

  if Config.EnableDocumentCommands == true then
    local licenseCommand = trim(Config.DriverLicenseCommand or 'cadlicense')
    if licenseCommand ~= '' then
      TriggerClientEvent('chat:addSuggestion', target, '/' .. licenseCommand, 'Open CAD driver license quiz')
    end

    local regoCommand = trim(Config.VehicleRegistrationCommand or 'cadrego')
    if regoCommand ~= '' then
      TriggerClientEvent('chat:addSuggestion', target, '/' .. regoCommand, 'Open CAD vehicle registration form')
    end
  end

  local showIdCommand = trim(Config.ShowIdCommand or 'showid')
  if showIdCommand ~= '' then
    TriggerClientEvent('chat:addSuggestion', target, '/' .. showIdCommand, 'Show your driver licence to nearby players')
  end

  if Config.LiveMapCalibrationEnabled == true then
    local calibrationCommand = trim(Config.LiveMapCalibrationCommand or 'calibrate')
    if calibrationCommand ~= '' then
      TriggerClientEvent('chat:addSuggestion', target, '/' .. calibrationCommand, 'Calibrate live map (manual or auto teleport flow)')
    end
  end

  TriggerClientEvent('chat:addSuggestion', target, '/radio', 'Open CAD radio UI or join/leave channel', {
    { name = 'channel', help = 'Optional channel number. Example: /radio 1. Use /radio off to leave.' },
  })
end

local startNpwdEmergencyHandlerRegistration
local npwdEmergencyHandlersRegistered = {}

local function triggerNpwdEmergencyHandlerRegistration()
  if type(startNpwdEmergencyHandlerRegistration) ~= 'function' then
    CreateThread(function()
      Wait(1000)
      if type(startNpwdEmergencyHandlerRegistration) == 'function' then
        startNpwdEmergencyHandlerRegistration()
      end
    end)
    return
  end
  startNpwdEmergencyHandlerRegistration()
end

local function getNpwdResourceName()
  local name = trim(Config.NpwdResource or 'npwd')
  if name == '' then return 'npwd' end
  return name
end

local lastForcedOxNotifyPosition = ''
local loggedOxNotifyModernBehavior = false
local function forceOxNotifyPosition(logApplied)
  if Config.ForceOxNotifyPosition ~= true then return end

  local target = trim(Config.OxNotifyPosition or 'center-right')
  if target == '' then target = 'center-right' end

  local okReplicated, errReplicated = pcall(function()
    SetConvarReplicated('ox:notifyPosition', target)
  end)

  if not okReplicated then
    print(('[cad_bridge] Failed to force ox:notifyPosition=%s (SetConvarReplicated=%s)'):format(
      target,
      tostring(errReplicated)
    ))
    return
  end

  if logApplied == true or lastForcedOxNotifyPosition ~= target then
    print(('[cad_bridge] Forced ox:notifyPosition=%s'):format(target))
    if not loggedOxNotifyModernBehavior then
      print('[cad_bridge] Note: modern ox_lib keeps default notification position in player settings. cad_bridge notifications still force this position explicitly.')
      loggedOxNotifyModernBehavior = true
    end
  end
  lastForcedOxNotifyPosition = target
end

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  -- Log bridge configuration status on startup for diagnostics
  local baseUrl = trim(Config.CadBaseUrl or '')
  local hasToken = trim(Config.SharedToken or '') ~= ''
  if baseUrl ~= '' and hasToken then
    print(('[cad_bridge] Bridge configured: base_url=%s token=SET'):format(baseUrl))
  else
    print(('[cad_bridge] WARNING: Bridge NOT configured. base_url=%q token=%s. License/registration features will NOT work.'):format(
      baseUrl,
      hasToken and 'SET' or 'EMPTY'
    ))
  end
  CreateThread(function()
    Wait(500)
    registerEmergencySuggestion(-1)
  end)
  forceOxNotifyPosition(true)
  triggerNpwdEmergencyHandlerRegistration()
end)

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= getNpwdResourceName() then return end
  npwdEmergencyHandlersRegistered = {}
  triggerNpwdEmergencyHandlerRegistration()
end)

AddEventHandler('onResourceStop', function(resourceName)
  if resourceName ~= getNpwdResourceName() then return end
  npwdEmergencyHandlersRegistered = {}
end)

AddEventHandler('playerJoining', function()
  local src = source
  CreateThread(function()
    Wait(3000)
    registerEmergencySuggestion(src)
  end)
end)

CreateThread(function()
  while true do
    Wait(math.max(5000, tonumber(Config.OxNotifyForceIntervalMs or 60000) or 60000))
    forceOxNotifyPosition(false)
  end
end)

local function splitByPipe(text)
  local input = tostring(text or '')
  local parts = {}
  local cursor = 1
  while true do
    local sepStart, sepEnd = input:find('|', cursor, true)
    if not sepStart then
      parts[#parts + 1] = trim(input:sub(cursor))
      break
    end
    parts[#parts + 1] = trim(input:sub(cursor, sepStart - 1))
    cursor = sepEnd + 1
  end
  return parts
end

local function normalizeDepartmentIdList(value)
  local normalized = {}
  local seen = {}

  if type(value) ~= 'table' then
    return normalized
  end

  for key, raw in pairs(value) do
    local candidate = raw
    if type(key) ~= 'number' and (raw == true or raw == false or raw == nil) then
      candidate = key
    end

    local numeric = tonumber(candidate)
    if numeric and numeric > 0 then
      local id = math.floor(numeric)
      if not seen[id] then
        seen[id] = true
        normalized[#normalized + 1] = id
      end
    end
  end

  return normalized
end

local function sendEmergencyUsage(src)
  notifyPlayer(src, 'Use /000 with no text to open an in-game popup form.')
  notifyPlayer(src, 'Popup form supports selecting required departments (dispatch departments are excluded).')
  notifyPlayer(src, 'Template: /000 <type> | <details> | <suspects> | <vehicle> | <hazards/injuries>')
  notifyPlayer(src, 'Example: /000 Armed Robbery | 24/7 in Sandy | 2 masked males | Black Sultan | shots fired')
end

local function parseEmergencyReport(rawInput)
  local raw = trim(rawInput)
  if raw == '' then
    return nil, 'Emergency details are required.'
  end

  local parts = splitByPipe(raw)
  local report = {
    emergency_type = '',
    details = '',
    suspects = '',
    vehicle = '',
    hazards = '',
  }

  if #parts == 1 then
    if #parts[1] > 64 then
      report.emergency_type = 'Emergency'
      report.details = parts[1]
    else
      report.emergency_type = parts[1]
    end
  else
    report.emergency_type = parts[1]
    report.details = parts[2] or ''
    report.suspects = parts[3] or ''
    report.vehicle = parts[4] or ''
    report.hazards = parts[5] or ''
  end

  if report.emergency_type == '' then
    return nil, 'Emergency type is required.'
  end
  return report
end

local function parseEmergencyPopupReport(payload)
  if type(payload) ~= 'table' then
    return nil, 'Invalid emergency form payload.'
  end

  local emergencyType = trim(payload.title or payload.emergency_type or '')
  local details = trim(payload.details or payload.message or '')
  local requestedDepartmentIds = normalizeDepartmentIdList(
    payload.requested_department_ids or payload.requested_departments or payload.department_ids or {}
  )

  if emergencyType == '' then
    return nil, 'Emergency title is required.'
  end

  if #emergencyType > 80 then
    emergencyType = emergencyType:sub(1, 80)
  end
  if #details > 600 then
    details = details:sub(1, 600)
  end

  return {
    emergency_type = emergencyType,
    details = details,
    suspects = '',
    vehicle = '',
    hazards = '',
    requested_department_ids = requestedDepartmentIds,
  }
end

local function isValidDateOnly(year, month, day)
  local y = tonumber(year)
  local m = tonumber(month)
  local d = tonumber(day)
  if not y or not m or not d then return false end
  if y < 1900 or y > 2100 then return false end
  if m < 1 or m > 12 then return false end
  if d < 1 or d > 31 then return false end

  local stamp = os.time({
    year = math.floor(y),
    month = math.floor(m),
    day = math.floor(d),
    hour = 12,
    min = 0,
    sec = 0,
  })
  if not stamp then return false end

  local normalized = os.date('!*t', stamp)
  if not normalized then return false end
  return normalized.year == math.floor(y)
    and normalized.month == math.floor(m)
    and normalized.day == math.floor(d)
end

local function formatDateOnly(year, month, day)
  return ('%04d-%02d-%02d'):format(
    math.floor(tonumber(year) or 0),
    math.floor(tonumber(month) or 0),
    math.floor(tonumber(day) or 0)
  )
end

local function normalizeDateOnly(value)
  local text = trim(value)
  if text == '' then return '' end

  -- Accept ISO date with optional time suffix.
  local yIso, mIso, dIso = text:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)')
  if yIso and mIso and dIso and isValidDateOnly(yIso, mIso, dIso) then
    return formatDateOnly(yIso, mIso, dIso)
  end

  -- Accept common separators and both YYYY-MM-DD and DD-MM-YYYY/MM-DD-YYYY inputs.
  local p1, p2, p3 = text:match('^(%d+)[%./%-](%d+)[%./%-](%d+)$')
  if not p1 or not p2 or not p3 then
    return ''
  end

  if #p1 == 4 then
    if isValidDateOnly(p1, p2, p3) then
      return formatDateOnly(p1, p2, p3)
    end
    return ''
  end

  if #p3 == 4 then
    local first = math.floor(tonumber(p1) or 0)
    local second = math.floor(tonumber(p2) or 0)
    local year = math.floor(tonumber(p3) or 0)

    -- Prefer day-first for Australian-style DOB strings, but fallback to month-first if needed.
    local day = first
    local month = second
    if first <= 12 and second > 12 then
      month = first
      day = second
    end

    if isValidDateOnly(year, month, day) then
      return formatDateOnly(year, month, day)
    end
    if isValidDateOnly(year, first, second) then
      return formatDateOnly(year, first, second)
    end
  end

  return ''
end

local function addDaysDateOnly(days)
  local numericDays = tonumber(days) or 1
  if numericDays < 1 then numericDays = 1 end
  local when = os.time() + math.floor(numericDays) * 24 * 60 * 60
  return os.date('!%Y-%m-%d', when)
end


local function daysUntilDateOnly(value)
  local normalized = normalizeDateOnly(value)
  if normalized == '' then return nil end
  local year, month, day = normalized:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)$')
  if not year or not month or not day then return nil end
  -- Use hour=12 on both sides to avoid DST boundary issues.
  -- Use os.date('*t') (local) consistently with os.time() which expects local time.
  local target = os.time({ year = tonumber(year), month = tonumber(month), day = tonumber(day), hour = 12, min = 0, sec = 0 })
  if not target then return nil end
  local now = os.date('*t')
  local today = os.time({ year = now.year, month = now.month, day = now.day, hour = 12, min = 0, sec = 0 })
  if not today then return nil end
  return math.floor((target - today) / (24 * 60 * 60))
end

local function normalizeList(input, makeUpper)
  local out = {}
  local seen = {}
  if type(input) ~= 'table' then return out end
  for _, item in ipairs(input) do
    local value = trim(item)
    if value ~= '' then
      if makeUpper == true then
        value = value:upper()
      end
      if not seen[value] then
        seen[value] = true
        out[#out + 1] = value
      end
    end
  end
  return out
end

local function parseDriverLicenseForm(payload)
  if type(payload) ~= 'table' then
    return nil, 'Invalid driver license payload.'
  end

  local photoOnly = payload.photo_only == true or payload.photo_only == 1
  local fullName = trim(payload.full_name or payload.character_name or '')
  local dateOfBirth = normalizeDateOnly(payload.date_of_birth or payload.dob or '')
  local gender = trim(payload.gender or '')
  local quizMode = payload.quiz_mode == true or payload.quiz_mode == 1
  local classes = normalizeList(payload.license_classes or payload.classes or {}, true)
  local conditions = normalizeList(payload.conditions or {}, false)
  local mugshotData = trim(payload.mugshot_data or '')
  local mugshotUrl = trim(payload.mugshot_url or '')
  local licenseNumber = trim(payload.license_number or '')
  local expiryDays = tonumber(payload.expiry_days or payload.duration_days or Config.DriverLicenseDefaultExpiryDays or 35) or (Config.DriverLicenseDefaultExpiryDays or 35)
  if quizMode then
    expiryDays = tonumber(Config.DriverLicenseQuizExpiryDays or 30) or 30
    classes = normalizeList(Config.DriverLicenseQuizClasses or { 'CAR' }, true)
  end
  if expiryDays < 1 then expiryDays = 1 end
  local expiryAt = normalizeDateOnly(payload.expiry_at or '')
  if expiryAt == '' then
    expiryAt = addDaysDateOnly(expiryDays)
  end

  if fullName == '' then return nil, 'Character name is required.' end
  if dateOfBirth == '' then return nil, 'Date of birth is required (YYYY-MM-DD).' end
  if gender == '' then return nil, 'Gender is required.' end
  if #classes == 0 then return nil, 'At least one license class is required.' end
  if quizMode then
    local scorePercent = tonumber(payload.quiz_score_percent or 0) or 0
    local passPercent = tonumber(Config.DriverLicenseQuizPassPercent or 80) or 80
    if scorePercent < passPercent then
      return nil, ('Quiz pass mark is %s%%.'):format(tostring(passPercent))
    end
  end

  return {
    full_name = fullName,
    date_of_birth = dateOfBirth,
    gender = gender,
    license_classes = classes,
    conditions = conditions,
    mugshot_data = mugshotData,
    mugshot_url = mugshotUrl,
    license_number = licenseNumber,
    expiry_days = math.floor(expiryDays),
    expiry_at = expiryAt,
    status = 'valid',
    photo_only = photoOnly,
    quiz_mode = quizMode,
  }
end

local function parseVehicleRegistrationForm(payload)
  if type(payload) ~= 'table' then
    return nil, 'Invalid registration payload.'
  end

  local plate = trim(payload.plate or payload.license_plate or '')
  local model = trim(payload.vehicle_model or payload.model or '')
  local colour = trim(payload.vehicle_colour or payload.colour or payload.color or '')
  local ownerName = trim(payload.owner_name or payload.character_name or '')
  local durationDays = tonumber(payload.duration_days or payload.expiry_days or Config.VehicleRegistrationDefaultDays or 35) or (Config.VehicleRegistrationDefaultDays or 35)
  if durationDays < 1 then durationDays = 1 end
  local expiryAt = addDaysDateOnly(durationDays)

  if plate == '' then return nil, 'Vehicle plate is required.' end
  if model == '' then return nil, 'Vehicle model is required.' end
  if ownerName == '' then return nil, 'Owner name is required.' end

  return {
    plate = plate,
    vehicle_model = model,
    vehicle_colour = colour,
    owner_name = ownerName,
    duration_days = math.floor(durationDays),
    expiry_at = expiryAt,
    status = 'valid',
  }
end

local function resolveDocumentFeeAmount(feeMap, durationDays)
  local days = math.max(1, math.floor(tonumber(durationDays) or 0))
  if type(feeMap) ~= 'table' then return 0 end

  local exact = tonumber(feeMap[days])
  if exact and exact > 0 then
    return math.floor(exact)
  end

  local nearestFee = 0
  local nearestDistance = nil
  for rawDays, rawFee in pairs(feeMap) do
    local mappedDays = tonumber(rawDays)
    local mappedFee = tonumber(rawFee)
    if mappedDays and mappedFee and mappedFee > 0 then
      local distance = math.abs(days - math.floor(mappedDays))
      if nearestDistance == nil or distance < nearestDistance then
        nearestDistance = distance
        nearestFee = math.floor(mappedFee)
      end
    end
  end

  if nearestFee > 0 then return nearestFee end
  return 0
end

local function formatMoney(amount)
  return ('$%s'):format(tostring(math.floor(tonumber(amount) or 0)))
end

local function getDocumentMoneyBalance(sourceId, account)
  local normalizedAccount = trim(account):lower()
  if normalizedAccount == '' then normalizedAccount = 'bank' end

  if GetResourceState('qbx_core') == 'started' then
    local okAmount, amount = pcall(function()
      return exports.qbx_core:GetMoney(sourceId, normalizedAccount)
    end)
    if okAmount and tonumber(amount) then
      return tonumber(amount)
    end

    local okPlayer, xPlayer = pcall(function()
      return exports.qbx_core:GetPlayer(sourceId)
    end)
    if okPlayer and xPlayer and type(xPlayer.PlayerData) == 'table' and type(xPlayer.PlayerData.money) == 'table' then
      local fallback = tonumber(xPlayer.PlayerData.money[normalizedAccount])
      if fallback then return fallback end
    end
  end

  if GetResourceState('qb-core') == 'started' then
    local okCore, core = pcall(function()
      return exports['qb-core']:GetCoreObject()
    end)
    if okCore and core and core.Functions and core.Functions.GetPlayer then
      local player = core.Functions.GetPlayer(sourceId)
      if player and player.PlayerData and type(player.PlayerData.money) == 'table' then
        local amount = tonumber(player.PlayerData.money[normalizedAccount])
        if amount then return amount end
      end
    end
  end

  return nil
end

local function tryDocumentMoneyChange(sourceId, citizenId, account, amount, reason, mode)
  local normalizedAccount = trim(account):lower()
  if normalizedAccount == '' then normalizedAccount = 'bank' end
  local normalizedReason = trim(reason)
  if normalizedReason == '' then normalizedReason = 'CAD document fee' end

  local fnName = mode == 'add' and 'AddMoney' or 'RemoveMoney'
  local attempts = {}

  local function pushAttempt(label, fn)
    attempts[#attempts + 1] = {
      label = label,
      fn = fn,
    }
  end

  if GetResourceState('qbx_core') == 'started' then
    local okPlayer, xPlayer = pcall(function()
      return exports.qbx_core:GetPlayer(sourceId)
    end)

    if mode == 'add' then
      pushAttempt('qbx export AddMoney(source, account, amount, reason)', function()
        return exports.qbx_core:AddMoney(sourceId, normalizedAccount, amount, normalizedReason)
      end)
      pushAttempt('qbx export AddMoney(source, account, amount)', function()
        return exports.qbx_core:AddMoney(sourceId, normalizedAccount, amount)
      end)
      if citizenId ~= '' then
        pushAttempt('qbx export AddMoney(citizenid, account, amount, reason)', function()
          return exports.qbx_core:AddMoney(citizenId, normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt('qbx export AddMoney(citizenid, account, amount)', function()
          return exports.qbx_core:AddMoney(citizenId, normalizedAccount, amount)
        end)
      end
    else
      pushAttempt('qbx export RemoveMoney(source, account, amount, reason)', function()
        return exports.qbx_core:RemoveMoney(sourceId, normalizedAccount, amount, normalizedReason)
      end)
      pushAttempt('qbx export RemoveMoney(source, account, amount)', function()
        return exports.qbx_core:RemoveMoney(sourceId, normalizedAccount, amount)
      end)
      if citizenId ~= '' then
        pushAttempt('qbx export RemoveMoney(citizenid, account, amount, reason)', function()
          return exports.qbx_core:RemoveMoney(citizenId, normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt('qbx export RemoveMoney(citizenid, account, amount)', function()
          return exports.qbx_core:RemoveMoney(citizenId, normalizedAccount, amount)
        end)
      end
    end

    if okPlayer and xPlayer then
      if xPlayer.Functions and type(xPlayer.Functions[fnName]) == 'function' then
        pushAttempt(('xPlayer.Functions.%s(account, amount, reason)'):format(fnName), function()
          return xPlayer.Functions[fnName](normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt(('xPlayer.Functions.%s(account, amount)'):format(fnName), function()
          return xPlayer.Functions[fnName](normalizedAccount, amount)
        end)
      end

      if type(xPlayer[fnName]) == 'function' then
        pushAttempt(('xPlayer:%s(account, amount, reason)'):format(fnName), function()
          return xPlayer[fnName](xPlayer, normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt(('xPlayer:%s(account, amount)'):format(fnName), function()
          return xPlayer[fnName](xPlayer, normalizedAccount, amount)
        end)
      end
    end
  end

  if GetResourceState('qb-core') == 'started' then
    local okCore, core = pcall(function()
      return exports['qb-core']:GetCoreObject()
    end)
    if okCore and core and core.Functions and core.Functions.GetPlayer then
      local player = core.Functions.GetPlayer(sourceId)
      if player and player.Functions and type(player.Functions[fnName]) == 'function' then
        pushAttempt(('qb player.Functions.%s(account, amount, reason)'):format(fnName), function()
          return player.Functions[fnName](normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt(('qb player.Functions.%s(account, amount)'):format(fnName), function()
          return player.Functions[fnName](normalizedAccount, amount)
        end)
      end
    end
  end

  local attemptedLabels = {}
  for _, attempt in ipairs(attempts) do
    attemptedLabels[#attemptedLabels + 1] = attempt.label
    local callOk, result = pcall(attempt.fn)
    if callOk and result ~= false then
      return true, ''
    end
  end

  if #attemptedLabels > 0 then
    return false, ('No adapter succeeded (%s)'):format(table.concat(attemptedLabels, ', '))
  end
  return false, 'No supported money adapter found (qbx_core/qb-core)'
end

local function chargeDocumentFee(sourceId, citizenId, account, amount, reason)
  local fee = math.max(0, math.floor(tonumber(amount) or 0))
  if fee <= 0 then return true, '' end

  local balance = getDocumentMoneyBalance(sourceId, account)
  if balance ~= nil and balance < fee then
    return false, ('Insufficient funds: %s needed in %s account.'):format(formatMoney(fee), tostring(account))
  end

  return tryDocumentMoneyChange(sourceId, citizenId, account, fee, reason, 'remove')
end

local function refundDocumentFee(sourceId, citizenId, account, amount, reason)
  local fee = math.max(0, math.floor(tonumber(amount) or 0))
  if fee <= 0 then return true, '' end
  return tryDocumentMoneyChange(sourceId, citizenId, account, fee, reason, 'add')
end

local function buildEmergencyMessage(report)
  local lines = {}
  if report.details ~= '' then lines[#lines + 1] = report.details end
  if report.suspects ~= '' then lines[#lines + 1] = ('Suspects: %s'):format(report.suspects) end
  if report.vehicle ~= '' then lines[#lines + 1] = ('Vehicle: %s'):format(report.vehicle) end
  if report.hazards ~= '' then lines[#lines + 1] = ('Hazards/Injuries: %s'):format(report.hazards) end
  if #lines == 0 then return 'No additional details provided.' end
  return table.concat(lines, ' | ')
end

local function encodeLogJson(value)
  local ok, encoded = pcall(function()
    return json.encode(value)
  end)
  if ok and type(encoded) == 'string' and encoded ~= '' then
    return encoded
  end
  return tostring(value)
end

local function countList(value)
  if type(value) ~= 'table' then return 0 end
  local count = 0
  for _ in ipairs(value) do
    count = count + 1
  end
  return count
end

-- ---------------------------------------------------------------------------
-- Mugshot file persistence
-- ---------------------------------------------------------------------------
-- Saves base64 mugshot data to a local file inside the resource so a copy
-- is always retained on the server regardless of CAD upload outcome.
-- Files are stored under mugshots/<citizenid>_<timestamp>.<ext>
-- Returns the relative file path on success, or '' on failure.
-- ---------------------------------------------------------------------------

local function saveMugshotFile(citizenid, base64Data)
  if trim(base64Data) == '' then return '' end
  if trim(citizenid) == '' then return '' end

  -- Strip the data URI prefix if present to get raw base64.
  local mimeType = 'image/jpg'
  local rawBase64 = base64Data
  local dataUriPrefix = base64Data:match('^(data:image/[^;]+;base64,)')
  if dataUriPrefix then
    mimeType = dataUriPrefix:match('data:(image/[^;]+);') or mimeType
    rawBase64 = base64Data:sub(#dataUriPrefix + 1)
  end

  -- Determine file extension from mime type.
  local extMap = {
    ['image/jpeg'] = 'jpg',
    ['image/jpg'] = 'jpg',
    ['image/png'] = 'png',
    ['image/webp'] = 'webp',
  }
  local ext = extMap[mimeType:lower()] or 'jpg'

  -- Decode base64 to binary.
  -- FiveM server-side Lua does not have a built-in base64 decoder, but we
  -- can use the raw base64 string and let SaveResourceFile handle it if the
  -- data is already decoded, or we decode manually.
  local decodeOk, binaryData = pcall(function()
    -- FiveM's Lua runtime does not expose a native base64 decode. We use a
    -- pure-Lua implementation that is compatible with server-side scripting.
    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    rawBase64 = rawBase64:gsub('[^' .. b .. '=]', '')
    return (rawBase64:gsub('.', function(x)
      if x == '=' then return '' end
      local r, f = '', (b:find(x) - 1)
      for i = 6, 1, -1 do r = r .. (f % 2^i - f % 2^(i-1) > 0 and '1' or '0') end
      return r
    end):gsub('%d%d%d?%d?%d?%d?%d?%d', function(x)
      if #x ~= 8 then return '' end
      local c = 0
      for i = 1, 8 do c = c + (x:sub(i, i) == '1' and 2^(8-i) or 0) end
      return string.char(c)
    end))
  end)

  if not decodeOk or not binaryData or #binaryData == 0 then
    print(('[cad_bridge] WARNING: Failed to decode mugshot base64 for citizenid=%s'):format(citizenid))
    return ''
  end

  -- Sanitise citizenid for use in a filename.
  local safeCitizenId = citizenid:gsub('[^%w%-_]', '_')
  local timestamp = os.time()
  local fileName = ('mugshots/%s_%d.%s'):format(safeCitizenId, timestamp, ext)

  local saveOk = pcall(function()
    SaveResourceFile(GetCurrentResourceName(), fileName, binaryData, #binaryData)
  end)

  if not saveOk then
    print(('[cad_bridge] WARNING: Failed to save mugshot file %s for citizenid=%s'):format(fileName, citizenid))
    return ''
  end

  print(('[cad_bridge] Mugshot saved to file: %s (%d bytes) for citizenid=%s'):format(fileName, #binaryData, citizenid))
  return fileName
end

-- ---------------------------------------------------------------------------
-- Server-side screencapture via serverCapture export
-- ---------------------------------------------------------------------------
-- Stores pending mugshot data per source so the license submission can
-- retrieve it without sending it over TriggerServerEvent.
-- ---------------------------------------------------------------------------
local pendingMugshots = {}

RegisterNetEvent('cad_bridge:requestMugshotCapture', function()
  local src = source
  if not src or src == 0 then return end

  local resourceName = trim(Config.ScreenshotResource or 'screencapture')
  print(('[cad_bridge] [screencapture] Server capture requested by src=%s resource=%q'):format(tostring(src), resourceName))

  if GetResourceState(resourceName) ~= 'started' then
    print(('[cad_bridge] [screencapture] Resource %q not started (state=%s), aborting capture'):format(
      resourceName, tostring(GetResourceState(resourceName))))
    TriggerClientEvent('cad_bridge:mugshotCaptureResult', src, false)
    return
  end

  local captureOptions = {
    encoding = trim(Config.ScreenshotEncoding or 'jpg'):lower(),
    quality = tonumber(Config.ScreenshotQuality or 0.7) or 0.7,
    maxWidth = 512,
    maxHeight = 512,
    -- Explicitly disable chroma-key style capture so the real world stays visible.
    chromaKey = Config.ScreenshotChromaKeyEnabled == true,
    chroma = Config.ScreenshotChromaKeyEnabled == true,
    transparent = Config.ScreenshotChromaKeyEnabled == true,
    disableChromaKey = Config.ScreenshotChromaKeyEnabled ~= true,
  }

  print(('[cad_bridge] [screencapture] Calling serverCapture for src=%s encoding=%s quality=%s'):format(
    tostring(src), captureOptions.encoding, tostring(captureOptions.quality)))

  local ok, callErr = pcall(function()
    exports[resourceName]:serverCapture(src, captureOptions, function(data)
      local dataLen = 0
      if type(data) == 'string' then
        dataLen = #data
      end
      print(('[cad_bridge] [screencapture] serverCapture callback — src=%s type=%s length=%d'):format(
        tostring(src), type(data), dataLen))

      if dataLen > 0 then
        -- Encode binary data to base64 data URI for consistency with existing pipeline.
        local encoding = captureOptions.encoding
        if encoding == 'jpg' then encoding = 'jpeg' end
        local base64Data = data
        -- If the data doesn't already have a data URI prefix, it's raw base64 from serverCapture.
        if not base64Data:match('^data:image/') then
          base64Data = ('data:image/%s;base64,%s'):format(encoding, data)
        end
        pendingMugshots[src] = base64Data
        print(('[cad_bridge] [screencapture] Mugshot stored for src=%s (base64 len=%d)'):format(tostring(src), #base64Data))
        TriggerClientEvent('cad_bridge:mugshotCaptureResult', src, true)
      else
        print(('[cad_bridge] [screencapture] No data returned for src=%s'):format(tostring(src)))
        TriggerClientEvent('cad_bridge:mugshotCaptureResult', src, false)
      end
    end, 'base64')
  end)

  if not ok then
    print(('[cad_bridge] [screencapture] ERROR calling serverCapture: %s'):format(tostring(callErr)))
    TriggerClientEvent('cad_bridge:mugshotCaptureResult', src, false)
  end
end)

local function consumePendingMugshot(src)
  local data = pendingMugshots[src]
  pendingMugshots[src] = nil
  return data or ''
end

local function summarizeLicensePayloadForLog(payload)
  local data = type(payload) == 'table' and payload or {}
  local mugshotData = trim(data.mugshot_data or '')
  local mugshotUrl = trim(data.mugshot_url or '')
  return {
    source = tonumber(data.source) or 0,
    player_name = trim(data.player_name or ''),
    citizenid = trim(data.citizenid or data.citizen_id or ''),
    full_name = trim(data.full_name or data.character_name or ''),
    date_of_birth = trim(data.date_of_birth or data.dob or ''),
    gender = trim(data.gender or ''),
    license_number = trim(data.license_number or ''),
    classes_count = countList(data.license_classes or data.classes),
    conditions_count = countList(data.conditions),
    expiry_days = tonumber(data.expiry_days or data.duration_days or 0) or 0,
    expiry_at = trim(data.expiry_at or ''),
    mugshot_length = #mugshotData > 0 and #mugshotData or #mugshotUrl,
    mugshot_data_length = #mugshotData,
    mugshot_url_length = #mugshotUrl,
  }
end

local function summarizeRegistrationPayloadForLog(payload)
  local data = type(payload) == 'table' and payload or {}
  return {
    source = tonumber(data.source) or 0,
    player_name = trim(data.player_name or ''),
    citizenid = trim(data.citizenid or data.citizen_id or ''),
    owner_name = trim(data.owner_name or data.character_name or ''),
    plate = trim(data.plate or data.license_plate or ''),
    vehicle_model = trim(data.vehicle_model or data.model or ''),
    vehicle_colour = trim(data.vehicle_colour or data.colour or data.color or ''),
    duration_days = tonumber(data.duration_days or data.expiry_days or 0) or 0,
    expiry_at = trim(data.expiry_at or ''),
  }
end

local function logDocumentFailure(kind, details)
  print(('[cad_bridge][%s] %s'):format(trim(kind), encodeLogJson(details or {})))
end

local function logDocumentTrace(kind, details, force)
  if force == true or Config.DocumentDebugLogs == true then
    print(('[cad_bridge][%s] %s'):format(trim(kind), encodeLogJson(details or {})))
  end
end

local function submitEmergencyCall(src, report)
  local s = tonumber(src)
  if not s then return end
  if isBridgeBackoffActive('calls') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('calls') / 1000))
    notifyPlayer(s, ('CAD bridge is rate-limited. Try /000 again in %ss.'):format(waitSeconds))
    return
  end

  local pos = PlayerPositions[s]
  local details = buildEmergencyMessage(report)
  local payload = {
    source = s,
    player_name = getCharacterDisplayName(s),
    platform_name = trim(GetPlayerName(s) or ''),
    identifiers = GetPlayerIdentifiers(s),
    title = ('000 %s'):format(report.emergency_type),
    message = details,
    priority = '1',
    job_code = '000',
    source_type = 'command_000',
  }
  if type(report.requested_department_ids) == 'table' and #report.requested_department_ids > 0 then
    payload.requested_department_ids = report.requested_department_ids
  end

  if pos then
    payload.position = { x = pos.x, y = pos.y, z = pos.z }
    payload.heading = pos.heading
    payload.speed = pos.speed
    payload.street = pos.street
    payload.crossing = pos.crossing
    payload.postal = pos.postal
  end

  request('POST', '/api/integration/fivem/calls', payload, function(status, body, responseHeaders)
    if status >= 200 and status < 300 then
      local callId = '?'
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and type(parsed.call) == 'table' and parsed.call.id then
        callId = tostring(parsed.call.id)
      end
      print(('[cad_bridge] /000 call created by %s (#%s) as CAD call #%s [%s]')
        :format(payload.player_name, tostring(s), callId, report.emergency_type))
      notifyPlayer(s, ('000 call sent to CAD (Call #%s). Type: %s'):format(callId, report.emergency_type))
      return
    end
    if status == 429 then
      setBridgeBackoff('calls', responseHeaders, 15000, '/000 call')
    end

    local err = ('Failed to create CAD call (HTTP %s)'):format(tostring(status))
    local ok, parsed = pcall(json.decode, body or '{}')
    if ok and type(parsed) == 'table' and parsed.error then
      err = err .. ': ' .. tostring(parsed.error)
    end
    print('[cad_bridge] ' .. err)
    notifyPlayer(s, '000 call failed to send to CAD. Check server logs.')
  end)
end

local function submitDriverLicense(src, formData)
  local s = tonumber(src)
  if not s then return end
  local photoOnly = formData and formData.photo_only == true
  print(('[cad_bridge] submitDriverLicense() called for src=%s'):format(tostring(s)))
  if isBridgeBackoffActive('licenses') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('licenses') / 1000))
    print(('[cad_bridge] submitDriverLicense BLOCKED by rate-limit backoff (%ss remaining)'):format(waitSeconds))
    notifyPlayer(s, ('CAD bridge is rate-limited. Try again in %ss.'):format(waitSeconds))
    return
  end

  local defaults = getCharacterDefaults(s)
  local payload = {
    source = s,
    player_name = getCharacterDisplayName(s),
    platform_name = trim(GetPlayerName(s) or ''),
    identifiers = GetPlayerIdentifiers(s),
    citizenid = trim(getCitizenId(s) or defaults.citizenid or ''),
    full_name = trim(defaults.full_name ~= '' and defaults.full_name or formData.full_name),
    date_of_birth = normalizeDateOnly(defaults.date_of_birth ~= '' and defaults.date_of_birth or formData.date_of_birth),
    gender = trim(defaults.gender ~= '' and defaults.gender or formData.gender),
    license_number = trim(formData.license_number or ''),
    license_classes = formData.license_classes or {},
    conditions = formData.conditions or {},
    mugshot_data = trim(formData.mugshot_data or ''),
    mugshot_url = trim(formData.mugshot_url or ''),
    expiry_days = tonumber(formData.expiry_days or Config.DriverLicenseDefaultExpiryDays or 35) or (Config.DriverLicenseDefaultExpiryDays or 35),
    expiry_at = normalizeDateOnly(formData.expiry_at or ''),
    status = 'valid',
    photo_only = photoOnly,
  }

  -- Check for server-side captured mugshot (from serverCapture export).
  local serverMugshot = consumePendingMugshot(s)
  if serverMugshot ~= '' then
    print(('[cad_bridge] Using server-side captured mugshot for src=%s (len=%d)'):format(tostring(s), #serverMugshot))
    payload.mugshot_data = serverMugshot
  end

  print(('[cad_bridge] License payload: citizenid=%q name=%q dob=%q mugshot_data_len=%d mugshot_url_len=%d'):format(
    trim(payload.citizenid or ''), trim(payload.full_name or ''),
    trim(payload.date_of_birth or ''), #trim(payload.mugshot_data or ''), #trim(payload.mugshot_url or '')))

  -- Persist mugshot to a local file as a backup copy.
  if trim(payload.mugshot_data) ~= '' and trim(payload.citizenid) ~= '' then
    local savedFile = saveMugshotFile(payload.citizenid, payload.mugshot_data)
    if savedFile ~= '' then
      print(('[cad_bridge] Mugshot file persisted: %s'):format(savedFile))
    end
  end

  logDocumentTrace('license-submit-start', {
    payload = summarizeLicensePayloadForLog(payload),
    form = summarizeLicensePayloadForLog(formData),
  }, true)

  if trim(payload.citizenid) == '' then
    notifyPlayer(s, 'Unable to determine your active character (citizenid). Re-log and try again.')
    print(('[cad_bridge] Driver license submit blocked for src %s: missing citizenid'):format(tostring(s)))
    logDocumentFailure('license-create-blocked', {
      reason = 'missing_citizenid',
      payload = summarizeLicensePayloadForLog(payload),
    })
    return
  end

  print(('[cad_bridge] Checking existing license for citizenid=%s ...'):format(trim(payload.citizenid or '')))
  request('GET', '/api/integration/fivem/licenses/' .. urlEncode(payload.citizenid), nil, function(existingStatus, existingBody)
    print(('[cad_bridge] Existing license check response: HTTP %s'):format(tostring(existingStatus)))
    logDocumentTrace('license-renew-check-response', {
      http_status = tonumber(existingStatus) or 0,
      citizenid = trim(payload.citizenid or ''),
    })
    if existingStatus >= 200 and existingStatus < 300 then
      local okExisting, existingParsed = pcall(json.decode, existingBody or '{}')
      if okExisting and type(existingParsed) == 'table' and type(existingParsed.license) == 'table' then
        local existingLicense = existingParsed.license
        local daysUntilExpiry = daysUntilDateOnly(existingLicense.expiry_at)
        print(('[cad_bridge] Existing license found: expiry_at=%s daysUntilExpiry=%s status=%s'):format(
          tostring(existingLicense.expiry_at or '?'),
          tostring(daysUntilExpiry),
          tostring(existingLicense.status or '?')
        ))
        if photoOnly then
          payload.full_name = trim(existingLicense.full_name or payload.full_name)
          payload.date_of_birth = normalizeDateOnly(existingLicense.date_of_birth or payload.date_of_birth)
          payload.gender = trim(existingLicense.gender or payload.gender)
          payload.license_number = trim(existingLicense.license_number or payload.license_number)
          payload.license_classes = normalizeList(existingLicense.license_classes or payload.license_classes or {}, true)
          payload.conditions = normalizeList(existingLicense.conditions or payload.conditions or {}, false)
          payload.expiry_at = normalizeDateOnly(existingLicense.expiry_at or payload.expiry_at)
          local resolvedDays = daysUntilDateOnly(payload.expiry_at)
          payload.expiry_days = (resolvedDays and resolvedDays > 0) and resolvedDays or math.floor(payload.expiry_days or 1)
          if payload.expiry_days < 1 then payload.expiry_days = 1 end
          print('[cad_bridge] Photo-only licence update requested; skipping renewal window block and fees')
        elseif daysUntilExpiry ~= nil and daysUntilExpiry > 3 then
          print(('[cad_bridge] BLOCKED: Licence renewal unavailable — %s days until expiry (must be <=3). citizenid=%s'):format(
            tostring(daysUntilExpiry), trim(payload.citizenid or '')))
          notifyPlayer(s, ('Licence renewal unavailable. You can renew when within 3 days of expiry (current expiry: %s).'):format(tostring(existingLicense.expiry_at or 'unknown')))
          return
        end
        print('[cad_bridge] Existing license is within renewal window or expired — proceeding with upsert')
      else
        if photoOnly then
          notifyPlayer(s, 'Unable to read existing licence record for photo update.')
          return
        end
        print('[cad_bridge] Existing license response could not be parsed - proceeding with create')
      end
    else
      if photoOnly then
        notifyPlayer(s, 'No existing licence record found to update photo.')
        return
      end
      print(('[cad_bridge] No existing license found (HTTP %s) - proceeding with create'):format(tostring(existingStatus)))
    end

    local feeAccount = trim(Config.DocumentFeeAccount or 'bank'):lower()
    if feeAccount == '' then feeAccount = 'bank' end
    local feeAmount = photoOnly and 0 or resolveDocumentFeeAmount(Config.DriverLicenseFeesByDays or {}, payload.expiry_days)
    print(('[cad_bridge] Fee check: amount=%s required=%s account=%s'):format(
      tostring(feeAmount), tostring(Config.RequireDocumentFeePayment == true), feeAccount))
    local feeCharged = false
    local feeRequired = Config.RequireDocumentFeePayment == true

    if feeAmount > 0 then
      local paid, payErr = chargeDocumentFee(
        s,
        payload.citizenid,
        feeAccount,
        feeAmount,
        ('Driver licence issue/renewal (%s days)'):format(tostring(math.floor(tonumber(payload.expiry_days) or 0)))
      )
      if not paid then
        local feeError = payErr ~= '' and payErr or ('Unable to charge licence fee %s from %s account.'):format(formatMoney(feeAmount), feeAccount)
        if feeRequired then
          logDocumentFailure('license-create-blocked', {
            reason = 'fee_charge_failed_required',
            fee_account = feeAccount,
            fee_amount = feeAmount,
            fee_error = feeError,
            payload = summarizeLicensePayloadForLog(payload),
          })
          notifyPlayer(s, feeError)
          return
        end
        print(('[cad_bridge] Driver licence fee bypassed for src %s (continuing without payment): %s'):format(
          tostring(s),
          tostring(feeError)
        ))
        notifyPlayer(s, 'Licence fee could not be charged. Continuing without payment.')
      else
        feeCharged = true
      end
    end
    local hasRetriedWithoutPhoto = false
    local savedWithoutPhoto = false

    local function parseBridgeError(body)
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and parsed.error then
        return trim(parsed.error)
      end
      return ''
    end

    local function maybeRefundFee()
      if not feeCharged or feeAmount <= 0 then return end
      local refunded, refundErr = refundDocumentFee(
        s,
        payload.citizenid,
        feeAccount,
        feeAmount,
        'CAD licence refund (save failed)'
      )
      if not refunded then
        print(('[cad_bridge] WARNING: licence fee refund failed for src %s amount %s: %s'):format(
          tostring(s),
          tostring(feeAmount),
          tostring(refundErr)
        ))
      end
    end

    local function shouldRetryWithoutPhoto(status, body)
      if hasRetriedWithoutPhoto then return false end
      if trim(payload.mugshot_data or '') == '' and trim(payload.mugshot_url or '') == '' then return false end

      local code = tonumber(status) or 0
      if code == 413 then return true end
      if code ~= 400 then return false end

      local errorText = parseBridgeError(body):lower()
      if errorText:find('payload too large', 1, true) then return true end
      if errorText:find('mugshot', 1, true) and errorText:find('too large', 1, true) then return true end
      return false
    end

    local function submitLicensePost()
      print(('[cad_bridge] >>> Sending POST /api/integration/fivem/licenses for citizenid=%s'):format(trim(payload.citizenid or '')))
      logDocumentTrace('license-create-request', {
        citizenid = trim(payload.citizenid or ''),
        mugshot_length = math.max(#(trim(payload.mugshot_data or '')), #(trim(payload.mugshot_url or ''))),
        mugshot_data_length = #(trim(payload.mugshot_data or '')),
        mugshot_url_length = #(trim(payload.mugshot_url or '')),
        has_retried_without_photo = hasRetriedWithoutPhoto == true,
      })
      request('POST', '/api/integration/fivem/licenses', payload, function(status, body, responseHeaders)
        print(('[cad_bridge] <<< POST /licenses response: HTTP %s body_len=%d'):format(tostring(status), #(body or '')))
        logDocumentTrace('license-create-response', {
          http_status = tonumber(status) or 0,
          citizenid = trim(payload.citizenid or ''),
          retry_without_photo = hasRetriedWithoutPhoto == true,
        })
        if status >= 200 and status < 300 then
          local expiryAt = payload.expiry_at
          local ok, parsed = pcall(json.decode, body or '{}')
          if ok and type(parsed) == 'table' and type(parsed.license) == 'table' then
            expiryAt = tostring(parsed.license.expiry_at or expiryAt)
          end
          logDocumentTrace('license-create-success', {
            citizenid = trim(payload.citizenid or ''),
            expiry_at = trim(expiryAt or ''),
            saved_without_photo = savedWithoutPhoto == true,
          }, true)
          notifyPlayer(s, ('Driver licence saved to CAD%s%s%s%s%s%s%s'):format(
            photoOnly and ' | Photo updated' or '. Status: VALID',
            expiryAt ~= '' and ' | Expires: ' or '',
            expiryAt ~= '' and expiryAt or '',
            feeCharged and ' | Charged: ' or '',
            feeCharged and formatMoney(feeAmount) or '',
            savedWithoutPhoto and ' | Photo: ' or '',
            savedWithoutPhoto and 'omitted (payload too large)' or ''
          ))
          return
        end

        if shouldRetryWithoutPhoto(status, body) then
          hasRetriedWithoutPhoto = true
          savedWithoutPhoto = true
          payload.mugshot_data = ''
          payload.mugshot_url = ''
          print(('[cad_bridge] Driver licence save retry without mugshot for src %s (initial HTTP %s)'):format(
            tostring(s),
            tostring(status)
          ))
          submitLicensePost()
          return
        end

        if status == 409 then
          local existingExpiry = ''
          local ok, parsed = pcall(json.decode, body or '{}')
          if ok and type(parsed) == 'table' then
            existingExpiry = trim(parsed.existing_expiry_at or '')
          end
          logDocumentFailure('license-create-rejected', {
            reason = 'renewal_window_blocked',
            http_status = tonumber(status) or 0,
            existing_expiry_at = existingExpiry,
            payload = summarizeLicensePayloadForLog(payload),
          })
          notifyPlayer(s, ('Licence renewal unavailable. You can renew within 3 days of expiry%s%s.'):format(
            existingExpiry ~= '' and ' (current expiry: ' or '',
            existingExpiry ~= '' and (existingExpiry .. ')') or ''
          ))
          maybeRefundFee()
          return
        end

        if status == 413 then
          logDocumentFailure('license-create-rejected', {
            reason = 'payload_too_large',
            http_status = tonumber(status) or 0,
            payload = summarizeLicensePayloadForLog(payload),
          })
          notifyPlayer(s, 'Licence photo is too large for CAD. Try again (JPG/compressed) or contact staff.')
          maybeRefundFee()
          return
        end

        if status == 429 then
          setBridgeBackoff('licenses', responseHeaders, 15000, 'driver license create')
        end

        local err = ('Failed to create CAD driver license (HTTP %s)'):format(tostring(status))
        local parsedError = parseBridgeError(body)
        if parsedError ~= '' then
          err = err .. ': ' .. parsedError
        end
        print('[cad_bridge] ' .. err)
        logDocumentFailure('license-create-failed', {
          http_status = tonumber(status) or 0,
          api_error = parsedError,
          fee_charged = feeCharged == true,
          fee_amount = feeAmount,
          payload = summarizeLicensePayloadForLog(payload),
        })
        maybeRefundFee()
        if parsedError ~= '' then
          notifyPlayer(s, ('Driver license failed to save: %s'):format(parsedError))
        else
          notifyPlayer(s, 'Driver license failed to save to CAD. Check server logs.')
        end
      end)
    end

    submitLicensePost()
  end)
end

local function submitVehicleRegistration(src, formData)
  local s = tonumber(src)
  if not s then return end
  if isBridgeBackoffActive('registrations') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('registrations') / 1000))
    notifyPlayer(s, ('CAD bridge is rate-limited. Try again in %ss.'):format(waitSeconds))
    return
  end

  local defaults = getCharacterDefaults(s)
  local payload = {
    source = s,
    player_name = getCharacterDisplayName(s),
    platform_name = trim(GetPlayerName(s) or ''),
    identifiers = GetPlayerIdentifiers(s),
    citizenid = trim(getCitizenId(s) or defaults.citizenid or ''),
    owner_name = trim(defaults.full_name ~= '' and defaults.full_name or formData.owner_name),
    plate = trim(formData.plate or ''),
    vehicle_model = trim(formData.vehicle_model or ''),
    vehicle_colour = trim(formData.vehicle_colour or ''),
    duration_days = tonumber(formData.duration_days or Config.VehicleRegistrationDefaultDays or 35) or (Config.VehicleRegistrationDefaultDays or 35),
    expiry_at = normalizeDateOnly(formData.expiry_at or ''),
    status = 'valid',
  }
  logDocumentTrace('registration-submit-start', {
    payload = summarizeRegistrationPayloadForLog(payload),
    form = summarizeRegistrationPayloadForLog(formData),
  }, true)

  if trim(payload.citizenid) == '' then
    notifyPlayer(s, 'Unable to determine your active character (citizenid). Re-log and try again.')
    print(('[cad_bridge] Registration submit blocked for src %s: missing citizenid'):format(tostring(s)))
    logDocumentFailure('registration-create-blocked', {
      reason = 'missing_citizenid',
      payload = summarizeRegistrationPayloadForLog(payload),
    })
    return
  end

  local feeAccount = trim(Config.DocumentFeeAccount or 'bank'):lower()
  if feeAccount == '' then feeAccount = 'bank' end
  local feeAmount = resolveDocumentFeeAmount(Config.VehicleRegistrationFeesByDays or {}, payload.duration_days)
  local feeCharged = false
  local feeRequired = Config.RequireDocumentFeePayment == true

  request('GET', '/api/integration/fivem/registrations/' .. urlEncode(payload.plate), nil, function(existingStatus, existingBody)
    logDocumentTrace('registration-renew-check-response', {
      http_status = tonumber(existingStatus) or 0,
      plate = trim(payload.plate or ''),
    })
    if existingStatus >= 200 and existingStatus < 300 then
      local okExisting, existingParsed = pcall(json.decode, existingBody or '{}')
      if okExisting and type(existingParsed) == 'table' and type(existingParsed.registration) == 'table' then
        local daysUntilExpiry = daysUntilDateOnly(existingParsed.registration.expiry_at)
        if daysUntilExpiry ~= nil and daysUntilExpiry > 3 then
          notifyPlayer(s, ('Registration renewal unavailable. You can renew when within 3 days of expiry (current expiry: %s).'):format(tostring(existingParsed.registration.expiry_at or 'unknown')))
          return
        end
      end
    end

    if feeAmount > 0 then
      local paid, payErr = chargeDocumentFee(
        s,
        payload.citizenid,
        feeAccount,
        feeAmount,
        ('Vehicle registration issue/renewal (%s days)'):format(tostring(math.floor(tonumber(payload.duration_days) or 0)))
      )
      if not paid then
      local feeError = payErr ~= '' and payErr or ('Unable to charge registration fee %s from %s account.'):format(formatMoney(feeAmount), feeAccount)
      if feeRequired then
        logDocumentFailure('registration-create-blocked', {
          reason = 'fee_charge_failed_required',
          fee_account = feeAccount,
          fee_amount = feeAmount,
          fee_error = feeError,
          payload = summarizeRegistrationPayloadForLog(payload),
        })
        notifyPlayer(s, feeError)
        return
      end
        print(('[cad_bridge] Registration fee bypassed for src %s (continuing without payment): %s'):format(
          tostring(s),
          tostring(feeError)
        ))
        notifyPlayer(s, 'Registration fee could not be charged. Continuing without payment.')
      else
        feeCharged = true
      end
    end

    request('POST', '/api/integration/fivem/registrations', payload, function(status, body, responseHeaders)
      logDocumentTrace('registration-create-response', {
        http_status = tonumber(status) or 0,
        plate = trim(payload.plate or ''),
      })
      if status >= 200 and status < 300 then
        local expiryAt = payload.expiry_at
        local ok, parsed = pcall(json.decode, body or '{}')
        if ok and type(parsed) == 'table' and type(parsed.registration) == 'table' then
          expiryAt = tostring(parsed.registration.expiry_at or expiryAt)
        end
        logDocumentTrace('registration-create-success', {
          plate = trim(payload.plate or ''),
          citizenid = trim(payload.citizenid or ''),
          expiry_at = trim(expiryAt or ''),
        }, true)
        notifyPlayer(s, ('Vehicle registration saved to CAD%s%s%s%s'):format(
          expiryAt ~= '' and ' | Expires: ' or '',
          expiryAt ~= '' and expiryAt or '',
          feeCharged and ' | Charged: ' or '',
          feeCharged and formatMoney(feeAmount) or ''
        ))
        return
      end

      if status == 429 then
        setBridgeBackoff('registrations', responseHeaders, 15000, 'vehicle registration create')
      end

      local err = ('Failed to create CAD vehicle registration (HTTP %s)'):format(tostring(status))
      local ok, parsed = pcall(json.decode, body or '{}')
      local parsedError = ''
      if ok and type(parsed) == 'table' and parsed.error then
        parsedError = tostring(parsed.error)
        err = err .. ': ' .. parsedError
      end
      print('[cad_bridge] ' .. err)
      if feeCharged and feeAmount > 0 then
        local refunded, refundErr = refundDocumentFee(
          s,
          payload.citizenid,
          feeAccount,
          feeAmount,
          'CAD registration refund (save failed)'
        )
        if not refunded then
          print(('[cad_bridge] WARNING: registration fee refund failed for src %s amount %s: %s'):format(
            tostring(s),
            tostring(feeAmount),
            tostring(refundErr)
          ))
        end
      end
      if status == 409 then
        local existingExpiry = ''
        if ok and type(parsed) == 'table' then
          existingExpiry = trim(parsed.existing_expiry_at or '')
        end
        logDocumentFailure('registration-create-rejected', {
          reason = 'renewal_window_blocked',
          http_status = tonumber(status) or 0,
          existing_expiry_at = existingExpiry,
          payload = summarizeRegistrationPayloadForLog(payload),
        })
        if existingExpiry ~= '' then
          notifyPlayer(s, ('Registration renewal unavailable. You can renew when within 3 days of expiry (current expiry: %s).'):format(existingExpiry))
        else
          notifyPlayer(s, 'Registration renewal unavailable. You can renew when within 3 days of expiry.')
        end
        return
      end
      logDocumentFailure('registration-create-failed', {
        http_status = tonumber(status) or 0,
        api_error = parsedError,
        fee_charged = feeCharged == true,
        fee_amount = feeAmount,
        payload = summarizeRegistrationPayloadForLog(payload),
      })
      if parsedError ~= '' then
        notifyPlayer(s, ('Vehicle registration failed to save: %s'):format(parsedError))
      else
        notifyPlayer(s, 'Vehicle registration failed to save to CAD. Check server logs.')
      end
    end)
  end)
end

local function splitByComma(text)
  local value = trim(text)
  local entries = {}
  local seen = {}
  if value == '' then
    return entries
  end

  for token in value:gmatch('([^,]+)') do
    local item = trim(token)
    if item ~= '' and not seen[item] then
      seen[item] = true
      entries[#entries + 1] = item
    end
  end
  return entries
end

local function getNpwdEmergencyNumbers()
  local configured = trim(Config.NpwdEmergencyNumbers or '000')
  local parsed = splitByComma(configured)
  if #parsed == 0 then
    return { '000' }
  end
  return parsed
end

local function submitNpwdEmergencyCall(src, emergencyNumber, incomingCaller)
  local s = tonumber(src)
  if not s then return end

  if isBridgeBackoffActive('calls') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('calls') / 1000))
    notifyPlayer(s, ('CAD bridge is rate-limited. Emergency call not sent yet, retry in %ss.'):format(waitSeconds))
    return
  end

  local callerName = trim((incomingCaller and incomingCaller.name) or getCharacterDisplayName(s))
  local callerNumber = trim((incomingCaller and incomingCaller.number) or '')
  local pos = PlayerPositions[s]
  local messageParts = {
    ('NPWD %s phone emergency call'):format(trim(emergencyNumber)),
  }
  if callerNumber ~= '' then
    messageParts[#messageParts + 1] = ('Caller number: %s'):format(callerNumber)
  end

  local payload = {
    source = s,
    player_name = callerName ~= '' and callerName or getCharacterDisplayName(s),
    platform_name = trim(GetPlayerName(s) or ''),
    identifiers = GetPlayerIdentifiers(s),
    citizenid = getCitizenId(s),
    title = ('000 Phone Call - %s'):format(callerName ~= '' and callerName or getCharacterDisplayName(s)),
    message = table.concat(messageParts, ' | '),
    priority = '1',
    job_code = '000',
    source_type = 'phone_000',
    enable_voice_session = true,
    phone_number = callerNumber,
  }

  if pos then
    payload.position = { x = pos.x, y = pos.y, z = pos.z }
    payload.heading = pos.heading
    payload.speed = pos.speed
    payload.street = pos.street
    payload.crossing = pos.crossing
    payload.postal = pos.postal
  end

  request('POST', '/api/integration/fivem/calls', payload, function(status, body, responseHeaders)
    if status >= 200 and status < 300 then
      local callId = '?'
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and type(parsed.call) == 'table' and parsed.call.id then
        callId = tostring(parsed.call.id)
      end

      local confirmation = ('Dispatch received your 000 call (CAD Call #%s). Stay on this line.'):format(callId)
      notifyPlayer(s, confirmation)
      print(('[cad_bridge] NPWD 000 call created by %s (#%s) as CAD call #%s')
        :format(payload.player_name, tostring(s), callId))
      return
    end

    if status == 429 then
      setBridgeBackoff('calls', responseHeaders, 15000, 'npwd 000 call')
    end

    local err = ('Failed to create CAD phone emergency call (HTTP %s)'):format(tostring(status))
    local ok, parsed = pcall(json.decode, body or '{}')
    if ok and type(parsed) == 'table' and parsed.error then
      err = err .. ': ' .. tostring(parsed.error)
    end
    print('[cad_bridge] ' .. err)
    notifyPlayer(s, '000 call failed to send to CAD. Check server logs.')
  end)
end

local function handleNpwdEmergencyCall(emergencyNumber, callRequest)
  local requestObj = type(callRequest) == 'table' and callRequest or {}
  local incomingCaller = type(requestObj.incomingCaller) == 'table' and requestObj.incomingCaller or {}
  local src = tonumber(incomingCaller.source) or 0

  -- Continue NPWD middleware chain.
  -- NPWD's onCall contract expects middleware to call next()/forward()/exit().
  -- We call next() so NPWD can complete its internal call flow while CAD handles
  -- emergency call creation in parallel.
  if type(requestObj.next) == 'function' then
    pcall(function()
      requestObj.next()
    end)
  end

  if src <= 0 then
    return
  end

  submitNpwdEmergencyCall(src, emergencyNumber, incomingCaller)
end

local function registerOneNpwdEmergencyHandler(emergencyNumber)
  local number = trim(emergencyNumber)
  if number == '' then return false end
  if npwdEmergencyHandlersRegistered[number] then return true end
  local npwdResource = getNpwdResourceName()
  if GetResourceState(npwdResource) ~= 'started' then return false end

  local ok, err = pcall(function()
    exports[npwdResource]:onCall(number, function(callRequest)
      handleNpwdEmergencyCall(number, callRequest)
    end)
  end)

  if not ok then
    print(('[cad_bridge] Failed to register NPWD emergency handler for %s: %s')
      :format(number, tostring(err)))
    return false
  end

  npwdEmergencyHandlersRegistered[number] = true
  print(('[cad_bridge] Registered NPWD emergency handler for number %s'):format(number))
  return true
end

local function registerNpwdEmergencyHandlers()
  local numbers = getNpwdEmergencyNumbers()
  if #numbers == 0 then return true end

  local allRegistered = true
  for _, number in ipairs(numbers) do
    if not registerOneNpwdEmergencyHandler(number) then
      allRegistered = false
    end
  end
  return allRegistered
end

startNpwdEmergencyHandlerRegistration = function()
  local maxAttempts = 20
  CreateThread(function()
    for _ = 1, maxAttempts do
      if registerNpwdEmergencyHandlers() then
        return
      end
      Wait(1000)
    end
    print('[cad_bridge] NPWD emergency handlers not fully registered after retries')
  end)
end

RegisterNetEvent('cad_bridge:submit000', function(payload)
  local src = source
  if not src or src == 0 then return end

  local report, err = parseEmergencyPopupReport(payload)
  if not report then
    notifyPlayer(src, err or 'Invalid emergency form details.')
    return
  end

  submitEmergencyCall(src, report)
end)

RegisterNetEvent('cad_bridge:submitDriverLicense', function(payload)
  local src = source
  print(('[cad_bridge] >>> submitDriverLicense event received from src=%s'):format(tostring(src)))
  if not src or src == 0 then
    print('[cad_bridge] submitDriverLicense ABORTED: invalid source')
    return
  end
  logDocumentTrace('license-event-received', {
    source = tonumber(src) or 0,
    payload = summarizeLicensePayloadForLog(payload),
  }, true)

  local formData, err = parseDriverLicenseForm(payload)
  if not formData then
    print(('[cad_bridge] submitDriverLicense ABORTED: form validation failed: %s'):format(tostring(err)))
    logDocumentFailure('license-validate-failed', {
      source = tonumber(src) or 0,
      error = trim(err or 'invalid_form'),
      payload = summarizeLicensePayloadForLog(payload),
    })
    notifyPlayer(src, err or 'Invalid driver license details.')
    return
  end

  print(('[cad_bridge] submitDriverLicense: form valid, calling submitDriverLicense() for citizenid=%s'):format(trim(getCitizenId(src) or '')))
  submitDriverLicense(src, formData)
end)

RegisterNetEvent('cad_bridge:submitVehicleRegistration', function(payload)
  local src = source
  print(('[cad_bridge] >>> submitVehicleRegistration event received from src=%s'):format(tostring(src)))
  if not src or src == 0 then
    print('[cad_bridge] submitVehicleRegistration ABORTED: invalid source')
    return
  end
  logDocumentTrace('registration-event-received', {
    source = tonumber(src) or 0,
    payload = summarizeRegistrationPayloadForLog(payload),
  }, true)

  local formData, err = parseVehicleRegistrationForm(payload)
  if not formData then
    logDocumentFailure('registration-validate-failed', {
      source = tonumber(src) or 0,
      error = trim(err or 'invalid_form'),
      payload = summarizeRegistrationPayloadForLog(payload),
    })
    notifyPlayer(src, err or 'Invalid registration details.')
    return
  end

  submitVehicleRegistration(src, formData)
end)

RegisterNetEvent('cad_bridge:requestShowId', function(targetSource)
  local src = source
  if not src or src == 0 then return end

  local defaults = getCharacterDefaults(src)
  local citizenId = trim(defaults.citizenid or getCitizenId(src) or '')
  if citizenId == '' then
    notifyPlayer(src, 'Unable to determine your active character (citizenid).')
    return
  end

  local function getPlayerCoords(sourceId)
    local s = tonumber(sourceId) or 0
    if s <= 0 then return nil end

    local ped = GetPlayerPed(s)
    if ped and ped > 0 then
      local coords = GetEntityCoords(ped)
      if coords then
        return {
          x = tonumber(coords.x) or 0.0,
          y = tonumber(coords.y) or 0.0,
          z = tonumber(coords.z) or 0.0,
        }
      end
    end

    local cached = PlayerPositions[s]
    if type(cached) == 'table' then
      return {
        x = tonumber(cached.x) or 0.0,
        y = tonumber(cached.y) or 0.0,
        z = tonumber(cached.z) or 0.0,
      }
    end
    return nil
  end

  local function findNearbyPlayers(originSource, radius)
    local nearby = {}
    local seen = {}
    local origin = getPlayerCoords(originSource)
    if not origin then return nearby, seen end

    local maxDistance = tonumber(radius) or tonumber(Config.ShowIdTargetDistance or 4.0) or 4.0
    if maxDistance < 1.0 then maxDistance = 1.0 end

    for _, player in ipairs(GetPlayers()) do
      local candidate = tonumber(player) or 0
      if candidate > 0 and candidate ~= originSource and GetPlayerName(candidate) then
        local targetCoords = getPlayerCoords(candidate)
        if targetCoords then
          local dx = targetCoords.x - origin.x
          local dy = targetCoords.y - origin.y
          local dz = targetCoords.z - origin.z
          local distance = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
          if distance <= maxDistance then
            seen[candidate] = true
            nearby[#nearby + 1] = candidate
          end
        end
      end
    end

    return nearby, seen
  end

  local nearbyDistance = tonumber(Config.ShowIdNearbyDistance or Config.ShowIdTargetDistance or 4.0) or 4.0
  local viewerTargets, viewerTargetSet = findNearbyPlayers(src, nearbyDistance)
  local target = tonumber(targetSource) or 0
  if target > 0 and target ~= src and GetPlayerName(target) and not viewerTargetSet[target] then
    viewerTargetSet[target] = true
    viewerTargets[#viewerTargets + 1] = target
  end

  request('GET', '/api/integration/fivem/licenses/' .. urlEncode(citizenId), nil, function(status, body)
    if status == 404 then
      notifyPlayer(src, 'No licence record found in CAD. Use /cadlicense first.')
      return
    end

    if status < 200 or status >= 300 then
      notifyPlayer(src, ('Unable to fetch licence from CAD (HTTP %s).'):format(tostring(status)))
      return
    end

    local ok, parsed = pcall(json.decode, body or '{}')
    if not ok or type(parsed) ~= 'table' or type(parsed.license) ~= 'table' then
      notifyPlayer(src, 'CAD returned an invalid licence response.')
      return
    end

    local license = parsed.license
    local fullName = trim(license.full_name or defaults.full_name or getCharacterDisplayName(src) or '')

    -- Resolve mugshot URL to a full URL for fetching the image server-side.
    local rawMugshot = trim(license.mugshot_url or '')
    local mugshotFullUrl = rawMugshot
    if rawMugshot ~= '' and rawMugshot:sub(1, 1) == '/' then
      mugshotFullUrl = getCadUrl(rawMugshot)
    end

    local payload = {
      full_name = fullName,
      date_of_birth = trim(license.date_of_birth or defaults.date_of_birth or ''),
      gender = trim(license.gender or defaults.gender or ''),
      license_number = trim(license.license_number or ''),
      license_classes = normalizeList(license.license_classes or {}, true),
      conditions = normalizeList(license.conditions or {}, false),
      status = trim(license.status or ''),
      expiry_at = trim(license.expiry_at or ''),
      mugshot_url = '',
    }

    -- Fetch the mugshot image server-side and convert to a data URI so the NUI
    -- doesn't hit mixed-content blocks (cfx-nui is HTTPS, CAD is HTTP).
    local function broadcastIdCard(mugshotDataUri)
      payload.mugshot_url = mugshotDataUri or ''

      TriggerClientEvent('cad_bridge:showIdCard', src, {
        full_name = payload.full_name,
        date_of_birth = payload.date_of_birth,
        gender = payload.gender,
        license_number = payload.license_number,
        license_classes = payload.license_classes,
        conditions = payload.conditions,
        status = payload.status,
        expiry_at = payload.expiry_at,
        mugshot_url = payload.mugshot_url,
        viewer_note = 'Your licence record',
      })

      local shownCount = 0
      for _, viewerSource in ipairs(viewerTargets) do
        if tonumber(viewerSource) and viewerSource ~= src and GetPlayerName(viewerSource) then
          TriggerClientEvent('cad_bridge:showIdCard', viewerSource, {
          full_name = payload.full_name,
          date_of_birth = payload.date_of_birth,
          gender = payload.gender,
          license_number = payload.license_number,
          license_classes = payload.license_classes,
          conditions = payload.conditions,
          status = payload.status,
          expiry_at = payload.expiry_at,
          mugshot_url = payload.mugshot_url,
          viewer_note = ('Shown by %s'):format(getCharacterDisplayName(src)),
        })
          shownCount = shownCount + 1
        end
      end

      if shownCount > 0 then
        notifyPlayer(src, ('Licence shown to %s nearby player%s.'):format(
          tostring(shownCount),
          shownCount == 1 and '' or 's'
        ))
        return
      end

      notifyPlayer(src, 'No nearby player found. Licence shown to yourself only.')
    end

    if mugshotFullUrl == '' or rawMugshot == '' then
      broadcastIdCard('')
      return
    end

    -- Fetch the image binary from the CAD server, base64-encode it as a data URI.
    PerformHttpRequest(mugshotFullUrl, function(imgStatus, imgBody, imgHeaders)
      if imgStatus < 200 or imgStatus >= 300 or not imgBody or #imgBody == 0 then
        print(('[cad_bridge] WARNING: Failed to fetch mugshot image (HTTP %s) from %s'):format(tostring(imgStatus), mugshotFullUrl))
        broadcastIdCard('')
        return
      end

      -- Determine MIME type from the URL extension, default to png.
      local mime = 'image/png'
      if mugshotFullUrl:match('%.jpe?g$') then mime = 'image/jpeg'
      elseif mugshotFullUrl:match('%.webp$') then mime = 'image/webp'
      end

      local b64 = ''
      if type(imgBody) == 'string' and #imgBody > 0 then
        -- FiveM's Lua doesn't have a built-in base64 encoder, but we can
        -- build one from the standard bit operations.
        local b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        local len = #imgBody
        local parts = {}
        for i = 1, len, 3 do
          local a = string.byte(imgBody, i) or 0
          local b2 = (i + 1 <= len) and string.byte(imgBody, i + 1) or 0
          local c = (i + 2 <= len) and string.byte(imgBody, i + 2) or 0
          local n = a * 65536 + b2 * 256 + c

          local c1 = math.floor(n / 262144) % 64
          local c2 = math.floor(n / 4096) % 64
          local c3 = math.floor(n / 64) % 64
          local c4 = n % 64

          parts[#parts + 1] = b64chars:sub(c1 + 1, c1 + 1)
          parts[#parts + 1] = b64chars:sub(c2 + 1, c2 + 1)
          if i + 1 <= len then
            parts[#parts + 1] = b64chars:sub(c3 + 1, c3 + 1)
          else
            parts[#parts + 1] = '='
          end
          if i + 2 <= len then
            parts[#parts + 1] = b64chars:sub(c4 + 1, c4 + 1)
          else
            parts[#parts + 1] = '='
          end
        end
        b64 = table.concat(parts)
      end

      if b64 ~= '' then
        broadcastIdCard('data:' .. mime .. ';base64,' .. b64)
      else
        broadcastIdCard('')
      end
    end, 'GET', '', {
      ['Accept'] = 'image/*',
    })
  end)
end)

RegisterCommand('000', function(src, args)
  if not src or src == 0 then
    print('[cad_bridge] /000 command is in-game only')
    return
  end

  local rawInput = trim(table.concat(args or {}, ' '))
  if rawInput == '' then
    request('GET', '/api/integration/fivem/departments', nil, function(status, body)
      local departments = {}
      if status >= 200 and status < 300 then
        local ok, parsed = pcall(json.decode, body or '[]')
        if ok and type(parsed) == 'table' then
          for _, dept in ipairs(parsed) do
            local id = tonumber(dept.id)
            if id and id > 0 then
              departments[#departments + 1] = {
                id = math.floor(id),
                name = tostring(dept.name or ''),
                short_name = tostring(dept.short_name or ''),
                color = tostring(dept.color or ''),
              }
            end
          end
        end
      end
      TriggerClientEvent('cad_bridge:prompt000', src, departments)
    end)
    return
  end
  if rawInput:lower() == 'help' then
    sendEmergencyUsage(src)
    return
  end

  local report, err = parseEmergencyReport(rawInput)
  if not report then
    notifyPlayer(src, err or 'Invalid emergency format.')
    sendEmergencyUsage(src)
    return
  end

  submitEmergencyCall(src, report)
end, false)

local function getDocumentInteractionPedById(pedId)
  local target = trim(pedId or '')
  if target == '' then return nil end
  local configured = Config.DocumentInteractionPeds
  if type(configured) ~= 'table' then return nil end
  for _, ped in ipairs(configured) do
    if type(ped) == 'table' and trim(ped.id or '') == target then
      return ped
    end
  end
  return nil
end

local function openDriverLicensePromptForSource(src, pedId)
  if not src or src == 0 then
    print('[cad_bridge] Driver license prompt is in-game only')
    return
  end
  local sourcePed = getDocumentInteractionPedById(pedId)
  if trim(pedId or '') ~= '' and not sourcePed then
    notifyPlayer(src, 'Invalid document desk.')
    return
  end
  if sourcePed and sourcePed.allows_license ~= true then
    notifyPlayer(src, 'Licences are not available at this desk.')
    return
  end

  local defaults = getCharacterDefaults(src)
  local defaultExpiryDays = tonumber(Config.DriverLicenseQuizExpiryDays or 30) or 30
  if defaultExpiryDays < 1 then defaultExpiryDays = 30 end
  local citizenId = trim(defaults.citizenid or getCitizenId(src) or '')
  local payload = {
    full_name = defaults.full_name,
    date_of_birth = defaults.date_of_birth,
    gender = defaults.gender,
    citizenid = citizenId,
    quiz_pass_percent = tonumber(Config.DriverLicenseQuizPassPercent or 80) or 80,
    class_options = Config.DriverLicenseQuizClasses or { 'CAR' },
    default_classes = Config.DriverLicenseQuizClasses or { 'CAR' },
    default_expiry_days = defaultExpiryDays,
    duration_options = { defaultExpiryDays },
    quiz_mode = true,
    can_take_quiz = true,
    can_retake_photo = false,
    existing_license = nil,
    renewal_window_days = 3,
  }

  if citizenId == '' then
    TriggerClientEvent('cad_bridge:promptDriverLicense', src, payload)
    return
  end

  request('GET', '/api/integration/fivem/licenses/' .. urlEncode(citizenId), nil, function(status, body)
    if status >= 200 and status < 300 then
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and type(parsed.license) == 'table' then
        local license = parsed.license
        local expiryAt = trim(license.expiry_at or '')
        local statusText = trim(license.status or '')
        local daysUntilExpiry = daysUntilDateOnly(expiryAt)
        local outsideRenewalWindow = statusText:lower() == 'valid' and daysUntilExpiry ~= nil and daysUntilExpiry > 3
        payload.existing_license = {
          full_name = trim(license.full_name or payload.full_name),
          date_of_birth = normalizeDateOnly(license.date_of_birth or payload.date_of_birth),
          gender = trim(license.gender or payload.gender),
          license_number = trim(license.license_number or ''),
          license_classes = normalizeList(license.license_classes or {}, true),
          conditions = normalizeList(license.conditions or {}, false),
          expiry_at = expiryAt,
          status = statusText,
          days_until_expiry = daysUntilExpiry,
        }
        if outsideRenewalWindow then
          payload.can_take_quiz = false
          payload.can_retake_photo = true
        else
          payload.can_take_quiz = true
          payload.can_retake_photo = true
        end
      end
    end
    TriggerClientEvent('cad_bridge:promptDriverLicense', src, payload)
  end)
end

local function openVehicleRegistrationPromptForSource(src, pedId)
  if not src or src == 0 then
    print('[cad_bridge] Vehicle registration prompt is in-game only')
    return
  end
  local sourcePed = getDocumentInteractionPedById(pedId)
  if trim(pedId or '') ~= '' and not sourcePed then
    notifyPlayer(src, 'Invalid document desk.')
    return
  end
  if sourcePed and sourcePed.allows_registration ~= true then
    notifyPlayer(src, 'Vehicle registration is not available at this desk.')
    return
  end

  local defaults = getCharacterDefaults(src)
  local pedDurationOptions = {}
  if sourcePed and type(sourcePed.registration_duration_options) == 'table' then
    for _, raw in ipairs(sourcePed.registration_duration_options) do
      local days = tonumber(raw)
      if days and days >= 1 then
        pedDurationOptions[#pedDurationOptions + 1] = math.floor(days)
      end
    end
  end
  local resolvedDurationOptions = (#pedDurationOptions > 0) and pedDurationOptions or (Config.VehicleRegistrationDurationOptions or { 6, 14, 35, 70 })
  local defaultDuration = tonumber(Config.VehicleRegistrationDefaultDays or 35) or 35
  if #pedDurationOptions > 0 then
    defaultDuration = tonumber(pedDurationOptions[1]) or 1
  end
  TriggerClientEvent('cad_bridge:promptVehicleRegistration', src, {
    owner_name = defaults.full_name,
    duration_options = resolvedDurationOptions,
    default_duration_days = defaultDuration,
    registration_parking = {
      coords = type(sourcePed and sourcePed.registration_parking_coords) == 'table' and sourcePed.registration_parking_coords or nil,
      radius = tonumber(sourcePed and sourcePed.registration_parking_radius or 0) or 0,
    },
  })
end

RegisterNetEvent('cad_bridge:requestDriverLicensePrompt', function(pedId)
  local src = source
  openDriverLicensePromptForSource(src, pedId)
end)

RegisterNetEvent('cad_bridge:requestVehicleRegistrationPrompt', function(pedId)
  local src = source
  openVehicleRegistrationPromptForSource(src, pedId)
end)

local function isFiniteNumber(value)
  local num = tonumber(value)
  if not num then return false end
  if num ~= num then return false end
  if num == math.huge or num == -math.huge then return false end
  return true
end

local function normalizeFiniteNumber(value, fallback)
  if isFiniteNumber(value) then
    return tonumber(value) + 0.0
  end
  return tonumber(fallback) or 0.0
end

local function canUseLiveMapCalibration(src)
  if not src or src == 0 then return true end
  local ace = trim(Config.LiveMapCalibrationAce or 'cad_bridge.calibrate')
  if ace == '' then return true end
  local ok, allowed = pcall(function()
    return IsPlayerAceAllowed(src, ace)
  end)
  return ok and allowed == true
end

local function submitLiveMapCalibration(src, data)
  local s = tonumber(src) or 0
  if s <= 0 then return end

  local function notifyCalibration(message, level)
    notifyAlert(s, 'Live Map Calibration', tostring(message or ''), tostring(level or 'inform'))
    notifyPlayer(s, tostring(message or ''))
  end

  if Config.LiveMapCalibrationEnabled ~= true then
    notifyCalibration('Live map calibration is disabled.', 'error')
    return
  end

  if not canUseLiveMapCalibration(s) then
    notifyCalibration('You are not authorised to calibrate the live map.', 'error')
    return
  end

  local payload = type(data) == 'table' and data or {}
  local point1 = type(payload.point1) == 'table' and payload.point1 or {}
  local point2 = type(payload.point2) == 'table' and payload.point2 or {}

  if not isFiniteNumber(point1.x) or not isFiniteNumber(point1.y) or not isFiniteNumber(point2.x) or not isFiniteNumber(point2.y) then
    notifyCalibration('Calibration points are invalid. Capture point1 and point2 again.', 'error')
    return
  end

  local x1 = math.min(tonumber(point1.x) or 0.0, tonumber(point2.x) or 0.0)
  local x2 = math.max(tonumber(point1.x) or 0.0, tonumber(point2.x) or 0.0)
  local y1 = math.max(tonumber(point1.y) or 0.0, tonumber(point2.y) or 0.0)
  local y2 = math.min(tonumber(point1.y) or 0.0, tonumber(point2.y) or 0.0)
  local padding = normalizeFiniteNumber(payload.padding, Config.LiveMapCalibrationPadding or 250.0)
  if padding < 0.0 then padding = 0.0 end
  if padding > 2000.0 then padding = 2000.0 end

  x1 = x1 - padding
  x2 = x2 + padding
  y1 = y1 + padding
  y2 = y2 - padding

  if (x2 - x1) < 500.0 or (y1 - y2) < 500.0 then
    notifyCalibration('Calibration area is too small. Move further apart before saving.', 'error')
    return
  end

  request('POST', '/api/integration/fivem/live-map/calibration', {
    map_game_x1 = x1,
    map_game_y1 = y1,
    map_game_x2 = x2,
    map_game_y2 = y2,
    map_scale_x = 1.0,
    map_scale_y = 1.0,
    map_offset_x = 0.0,
    map_offset_y = 0.0,
    source = 'fivem_calibrate_command',
    source_player = s,
  }, function(status, body, _headers)
    if status >= 200 and status < 300 then
      notifyCalibration(('Live map calibration saved (x1=%.1f y1=%.1f x2=%.1f y2=%.1f). Refresh CAD map.'):format(x1, y1, x2, y2), 'success')
      return
    end

    local err = ''
    local okParsed, parsed = pcall(json.decode, body or '{}')
    if okParsed and type(parsed) == 'table' then
      err = trim(parsed.error or '')
    end
    if err ~= '' then
      notifyCalibration(('Live map calibration failed: %s'):format(err), 'error')
    else
      notifyCalibration(('Live map calibration failed (HTTP %s).'):format(tostring(status)), 'error')
    end
  end)
end

RegisterNetEvent('cad_bridge:saveLiveMapCalibration', function(data)
  local src = source
  submitLiveMapCalibration(src, data)
end)

if Config.EnableDocumentCommands == true then
  RegisterCommand(trim(Config.DriverLicenseCommand or 'cadlicense'), function(src, _args)
    openDriverLicensePromptForSource(src)
  end, false)

  RegisterCommand(trim(Config.VehicleRegistrationCommand or 'cadrego'), function(src, _args)
    openVehicleRegistrationPromptForSource(src)
  end, false)
end

local heartbeatInFlight = false
local heartbeatInFlightSinceMs = 0
local pollFineJobs = nil
local pollJailJobs = nil
local lastFastEnforcementPollMs = 0

local function getServerPedPositionSnapshot(sourceId)
  local s = tonumber(sourceId) or 0
  if s <= 0 then return nil end
  local ped = GetPlayerPed(s)
  if not ped or ped <= 0 then return nil end
  local coords = GetEntityCoords(ped)
  if not coords then return nil end
  return {
    x = tonumber(coords.x) or 0.0,
    y = tonumber(coords.y) or 0.0,
    z = tonumber(coords.z) or 0.0,
    heading = tonumber(GetEntityHeading(ped)) or 0.0,
    speed = tonumber(GetEntitySpeed(ped)) or 0.0,
  }
end

local function triggerFastEnforcementPoll()
  local now = nowMs()
  if (now - lastFastEnforcementPollMs) < 800 then
    return
  end
  lastFastEnforcementPollMs = now
  if pollFineJobs then
    pollFineJobs()
  end
  if pollJailJobs then
    pollJailJobs()
  end
end

local function resetHeartbeatInFlight(reason)
  heartbeatInFlight = false
  heartbeatInFlightSinceMs = 0
  if reason and reason ~= '' then
    print(('[cad_bridge] heartbeat in-flight reset (%s)'):format(tostring(reason)))
  end
end

local function clearStuckHeartbeatIfNeeded()
  if not heartbeatInFlight then return false end
  local timeoutMs = math.max(10000, math.floor((tonumber(Config.HeartbeatIntervalMs) or 1500) * 8))
  if heartbeatInFlightSinceMs <= 0 then
    heartbeatInFlightSinceMs = nowMs()
    return false
  end
  local elapsed = nowMs() - heartbeatInFlightSinceMs
  if elapsed < timeoutMs then
    return false
  end
  resetHeartbeatInFlight(('watchdog timeout after %sms'):format(math.floor(elapsed)))
  setBridgeBackoff('heartbeat', nil, 3000, 'heartbeat watchdog')
  return true
end

CreateThread(function()
  while true do
    Wait(math.max(1000, tonumber(Config.HeartbeatIntervalMs) or 1500))
    if not hasBridgeConfig() then
      goto continue
    end
    if heartbeatInFlight and not clearStuckHeartbeatIfNeeded() then
      goto continue
    end
    if isBridgeBackoffActive('heartbeat') then
      goto continue
    end

    local payloadPlayers = {}
    for _, src in ipairs(GetPlayers()) do
      local s = tonumber(src)
      if s then
        local identifiers = GetPlayerIdentifiers(s)
        if Config.PublishAllPlayers or hasTrackedIdentifier(identifiers) then
          local pos = PlayerPositions[s]
          local fallbackSnapshot = getServerPedPositionSnapshot(s)
          if fallbackSnapshot and (type(pos) ~= 'table' or ((tonumber(pos.x) or 0.0) == 0.0 and (tonumber(pos.y) or 0.0) == 0.0)) then
            if type(pos) ~= 'table' then pos = {} end
            pos.x = fallbackSnapshot.x
            pos.y = fallbackSnapshot.y
            pos.z = fallbackSnapshot.z
            pos.heading = fallbackSnapshot.heading
            pos.speed = fallbackSnapshot.speed
            PlayerPositions[s] = pos
          end
          if type(pos) ~= 'table' then
            pos = {
              x = 0.0,
              y = 0.0,
              z = 0.0,
              heading = 0.0,
              speed = 0.0,
              street = '',
              crossing = '',
              postal = '',
              location = '',
              vehicle = '',
              license_plate = '',
              has_siren_enabled = false,
              icon = 6,
              weapon = '',
            }
          end
          payloadPlayers[#payloadPlayers + 1] = {
            source = s,
            name = getCharacterDisplayName(s),
            platform_name = trim(GetPlayerName(s) or ''),
            identifiers = identifiers,
            citizenid = getCitizenId(s),
            position = {
              x = pos.x,
              y = pos.y,
              z = pos.z,
            },
            heading = pos.heading,
            speed = pos.speed,
            street = pos.street,
            crossing = pos.crossing,
            postal = pos.postal,
            location = pos.location,
            vehicle = pos.vehicle,
            license_plate = pos.license_plate,
            has_siren_enabled = pos.has_siren_enabled,
            icon = pos.icon,
            weapon = pos.weapon,
          }
        end
      end
    end

    heartbeatInFlight = true
    heartbeatInFlightSinceMs = nowMs()
    request('POST', '/api/integration/fivem/heartbeat', {
      players = payloadPlayers,
      timestamp = os.time(),
    }, function(status, _body, responseHeaders)
      resetHeartbeatInFlight('')
      if status == 429 then
        setBridgeBackoff('heartbeat', responseHeaders, 15000, 'heartbeat')
        return
      end
      if status == 0 then
        setBridgeBackoff('heartbeat', responseHeaders, 3000, 'heartbeat transport')
        print('[cad_bridge] heartbeat transport failed (status 0)')
        return
      end
      if status >= 400 then
        if status >= 500 then
          setBridgeBackoff('heartbeat', responseHeaders, 5000, 'heartbeat error')
        end
        print(('[cad_bridge] heartbeat failed with status %s'):format(tostring(status)))
        return
      end

      if status >= 200 and status < 300 then
        -- Nudge enforcement queues so record-created fines/jails apply quickly.
        triggerFastEnforcementPoll()
      end
    end)

    ::continue::
  end
end)

local function shellEscape(value)
  value = tostring(value or '')
  if value:find('%s') then
    return '"' .. value:gsub('"', '\\"') .. '"'
  end
  return value
end

local function commandExists(commandName)
  commandName = tostring(commandName or ''):gsub('^/', ''):lower()
  if commandName == '' then return false end

  local ok, commands = pcall(GetRegisteredCommands)
  if not ok or type(commands) ~= 'table' then
    -- If the runtime cannot provide command metadata, do not hard-fail here.
    return true
  end

  for _, entry in ipairs(commands) do
    local name = ''
    if type(entry) == 'table' then
      name = tostring(entry.name or '')
    elseif type(entry) == 'string' then
      name = entry
    end
    if name:gsub('^/', ''):lower() == commandName then
      return true
    end
  end
  return false
end

local function normalizeCitizenId(citizenId)
  return trim(citizenId):lower()
end

local function findPlayerByCitizenId(citizenId)
  local target = normalizeCitizenId(citizenId)
  if target == '' then return nil end

  for _, src in ipairs(GetPlayers()) do
    local s = tonumber(src)
    if s and normalizeCitizenId(getCitizenId(s)) == target then
      return s
    end
  end
  return nil
end

local function findPlayerByIdentifier(prefix, value)
  local target = trim(value):lower()
  if target == '' then return nil end
  local expectedPrefix = tostring(prefix or ''):lower() .. ':'

  for _, src in ipairs(GetPlayers()) do
    local s = tonumber(src)
    if s then
      for _, identifier in ipairs(GetPlayerIdentifiers(s)) do
        local id = tostring(identifier or ''):lower()
        if id == (expectedPrefix .. target) then
          return s
        end
      end
    end
  end
  return nil
end

local function resolvePlayerSourceForJob(job)
  local sourceId = tonumber(job.game_id or job.source or 0)
  if sourceId and sourceId > 0 and GetPlayerName(sourceId) then
    return sourceId
  end

  local byCitizen = findPlayerByCitizenId(job.citizen_id)
  if byCitizen then return byCitizen end

  local byDiscord = findPlayerByIdentifier('discord', job.discord_id)
  if byDiscord then return byDiscord end

  return nil
end

local function resolveFineSource(job, citizenId)
  local sourceId = tonumber(job.game_id or job.source or 0)
  local normalizedCitizen = normalizeCitizenId(citizenId)
  if sourceId and sourceId > 0 and GetPlayerName(sourceId) then
    if normalizedCitizen == '' or normalizeCitizenId(getCitizenId(sourceId)) == normalizedCitizen then
      return sourceId
    end
  end

  local byCitizen = findPlayerByCitizenId(citizenId)
  if byCitizen then return byCitizen end

  local discordId = trim(job.discord_id or '')
  if discordId ~= '' then
    local byDiscord = findPlayerByIdentifier('discord', discordId)
    if byDiscord then return byDiscord end
  end

  local steamKey = trim(job.steam_id or ''):lower()
  if steamKey:sub(1, 8) == 'discord:' then
    local byDiscord = findPlayerByIdentifier('discord', steamKey:sub(9))
    if byDiscord then return byDiscord end
  elseif steamKey:sub(1, 8) == 'license:' then
    local byLicense = findPlayerByIdentifier('license', steamKey:sub(9))
    if byLicense then return byLicense end
  elseif steamKey:sub(1, 9) == 'license2:' then
    local byLicense2 = findPlayerByIdentifier('license2', steamKey:sub(10))
    if byLicense2 then return byLicense2 end
  end

  return nil
end

local function toMoneyNumber(value)
  local n = tonumber(value)
  if not n then return nil end
  if n ~= n then return nil end
  return n
end

local function getPlayerMoneyBalance(player, account)
  if type(player) ~= 'table' then return nil end
  local playerData = player.PlayerData
  if type(playerData) ~= 'table' then return nil end
  local money = playerData.money
  if type(money) ~= 'table' then return nil end
  return toMoneyNumber(money[account])
end

local function getQbxMoneyBalance(sourceId, player, account)
  if GetResourceState('qbx_core') == 'started' and sourceId and sourceId > 0 then
    local ok, amount = pcall(function()
      return exports.qbx_core:GetMoney(sourceId, account)
    end)
    if ok then
      local normalized = toMoneyNumber(amount)
      if normalized ~= nil then
        return normalized
      end
    end
  end
  return getPlayerMoneyBalance(player, account)
end

local function hasExpectedDeduction(beforeBalance, afterBalance, amount)
  local before = toMoneyNumber(beforeBalance)
  local after = toMoneyNumber(afterBalance)
  if not before or not after then return nil end
  local expected = before - (tonumber(amount) or 0)
  return after <= (expected + 0.01)
end

local function verifyDeductionWithRetries(readBalance, beforeBalance, amount, retries, delayMs)
  local attempts = math.max(0, math.floor(tonumber(retries) or 0))
  local waitMs = math.max(0, math.floor(tonumber(delayMs) or 0))

  local afterBalance = readBalance()
  local deducted = hasExpectedDeduction(beforeBalance, afterBalance, amount)
  if deducted ~= false then
    return deducted, afterBalance
  end

  for _ = 1, attempts do
    if waitMs > 0 then
      Wait(waitMs)
    end
    afterBalance = readBalance()
    deducted = hasExpectedDeduction(beforeBalance, afterBalance, amount)
    if deducted ~= false then
      return deducted, afterBalance
    end
  end

  return deducted, afterBalance
end

local function applyJobSyncAuto(sourceId, jobName, jobGrade)
  if GetResourceState('qbx_core') == 'started' then
    local ok, xPlayer = pcall(function()
      return exports.qbx_core:GetPlayer(sourceId)
    end)
    if ok and xPlayer then
      if xPlayer.Functions and type(xPlayer.Functions.SetJob) == 'function' then
        local setOk, err = pcall(function()
          xPlayer.Functions.SetJob(jobName, jobGrade)
        end)
        if setOk then return true, '' end
        return false, ('qbx_core SetJob failed: %s'):format(tostring(err))
      end
      if type(xPlayer.SetJob) == 'function' then
        local setOk, err = pcall(function()
          xPlayer:SetJob(jobName, jobGrade)
        end)
        if setOk then return true, '' end
        return false, ('qbx_core SetJob failed: %s'):format(tostring(err))
      end
      return false, 'qbx_core player object has no SetJob method'
    end
  end

  if GetResourceState('qb-core') == 'started' then
    local ok, core = pcall(function()
      return exports['qb-core']:GetCoreObject()
    end)
    if ok and core and core.Functions and core.Functions.GetPlayer then
      local player = core.Functions.GetPlayer(sourceId)
      if player and player.Functions and type(player.Functions.SetJob) == 'function' then
        local setOk, err = pcall(function()
          player.Functions.SetJob(jobName, jobGrade)
        end)
        if setOk then return true, '' end
        return false, ('qb-core SetJob failed: %s'):format(tostring(err))
      end
      return false, 'qb-core player object has no SetJob method'
    end
  end

  return false, 'No supported framework for auto job sync (qbx_core/qb-core)'
end

local function applyJobSync(job)
  if Config.JobSyncAdapter == 'none' then
    return false, 'Job sync adapter disabled (Config.JobSyncAdapter=none)', false
  end

  local jobName = trim(job.job_name or '')
  if jobName == '' then
    return false, 'Job name is empty', false
  end
  local jobGrade = math.max(0, math.floor(tonumber(job.job_grade) or 0))
  local sourceId = resolvePlayerSourceForJob(job)

  if not sourceId then
    return false, 'Target player is no longer online', true
  end

  if Config.JobSyncAdapter == 'command' then
    local cmdTemplate = tostring(Config.JobSyncCommandTemplate or '')
    if cmdTemplate == '' then
      return false, 'Job sync command template is empty', false
    end

    local commandName = cmdTemplate:match('^%s*([^%s]+)') or ''
    if commandName == '' then
      return false, 'Job sync command template has no command name', false
    end
    if not commandExists(commandName) then
      return false, ('Job sync command not registered: %s'):format(commandName), false
    end

    local cmd = cmdTemplate
    cmd = cmd:gsub('{source}', shellEscape(sourceId))
    cmd = cmd:gsub('{citizenid}', shellEscape(job.citizen_id or ''))
    cmd = cmd:gsub('{job}', shellEscape(jobName))
    cmd = cmd:gsub('{grade}', shellEscape(jobGrade))
    ExecuteCommand(cmd)
    return true, '', false
  end

  if Config.JobSyncAdapter == 'auto' then
    local ok, err = applyJobSyncAuto(sourceId, jobName, jobGrade)
    return ok, err or '', false
  end

  return false, ('Unknown job sync adapter: %s'):format(tostring(Config.JobSyncAdapter)), false
end

local jobPollInFlight = false
CreateThread(function()
  while true do
    Wait(math.max(2000, tonumber(Config.JobSyncPollIntervalMs) or 5000))
    if Config.JobSyncAdapter == 'none' then
      goto continue
    end
    if not hasBridgeConfig() then
      goto continue
    end
    if jobPollInFlight or isBridgeBackoffActive('job_poll') then
      goto continue
    end

    jobPollInFlight = true
    request('GET', '/api/integration/fivem/job-jobs?limit=25', nil, function(status, body, responseHeaders)
      jobPollInFlight = false
      if status == 429 then
        setBridgeBackoff('job_poll', responseHeaders, 10000, 'job poll')
        return
      end
      if status ~= 200 then
        return
      end

      local ok, jobs = pcall(json.decode, body)
      if not ok or type(jobs) ~= 'table' then
        return
      end

      for _, job in ipairs(jobs) do
        local success, err, transient = applyJobSync(job)
        if success then
          request('POST', ('/api/integration/fivem/job-jobs/%s/sent'):format(tostring(job.id)), {}, function() end)
        elseif transient then
          -- Keep pending so it can be retried automatically when player is available.
        else
          request('POST', ('/api/integration/fivem/job-jobs/%s/failed'):format(tostring(job.id)), {
            error = err or 'Job sync adapter failed',
          }, function() end)
        end
      end
    end)

    ::continue::
  end
end)

local function applyRouteJob(job)
  local citizenId = trim(job.citizen_id or '')
  local sourceId = resolveFineSource(job, citizenId)
  if not sourceId then
    return false, 'Target character is not currently online', true
  end

  local action = trim(job.action or 'set'):lower()
  local clearWaypoint = job.clear_waypoint == true or tonumber(job.clear_waypoint or 0) == 1 or action == 'clear'
  local payload = {
    id = tostring(job.id or ''),
    call_id = tonumber(job.call_id) or 0,
    action = action ~= '' and action or 'set',
    clear_waypoint = clearWaypoint,
    call_title = tostring(job.call_title or ''),
    location = tostring(job.location or ''),
    postal = tostring(job.postal or ''),
  }

  if not clearWaypoint then
    local x = tonumber(job.position_x)
    local y = tonumber(job.position_y)
    local z = tonumber(job.position_z)
    if x and y then
      payload.position = {
        x = x,
        y = y,
        z = z or 0.0,
      }
    end
  end

  TriggerClientEvent('cad_bridge:setCallRoute', sourceId, payload)
  return true, '', false
end

local routePollInFlight = false
CreateThread(function()
  while true do
    Wait(math.max(2000, tonumber(Config.RoutePollIntervalMs) or 5000))
    if not hasBridgeConfig() then
      goto continue
    end
    if routePollInFlight or isBridgeBackoffActive('route_poll') then
      goto continue
    end

    routePollInFlight = true
    request('GET', '/api/integration/fivem/route-jobs?limit=25', nil, function(status, body, responseHeaders)
      routePollInFlight = false
      if status == 429 then
        setBridgeBackoff('route_poll', responseHeaders, 10000, 'route poll')
        return
      end
      if status ~= 200 then
        return
      end

      local ok, jobs = pcall(json.decode, body)
      if not ok or type(jobs) ~= 'table' then
        return
      end

      for _, job in ipairs(jobs) do
        local success, err, transient = applyRouteJob(job)
        if success then
          request('POST', ('/api/integration/fivem/route-jobs/%s/sent'):format(tostring(job.id)), {}, function() end)
        elseif transient then
          -- Keep pending and retry when the target character is online.
        else
          request('POST', ('/api/integration/fivem/route-jobs/%s/failed'):format(tostring(job.id)), {
            error = err or 'Route delivery failed',
          }, function() end)
        end
      end
    end)

    ::continue::
  end
end)

local function applyFine(job)
  if Config.FineAdapter == 'none' then
    return false, 'Fine adapter disabled (Config.FineAdapter=none)', false
  end

  local citizenId = trim(job.citizen_id or '')
  local amount = tonumber(job.amount) or 0
  local reason = trim(job.reason or '')
  local account = trim(job.account or 'bank'):lower()
  if citizenId == '' then
    return false, 'Fine citizen_id is empty', false
  end
  if amount <= 0 then
    return false, 'Fine amount must be greater than 0', false
  end

  local function notifyFineApplied(sourceId)
    local message = ('You have been fined $%s'):format(tostring(math.floor(amount)))
    if reason ~= '' then
      message = message .. (' (%s)'):format(reason)
    end
    TriggerClientEvent('cad_bridge:notifyFine', sourceId, {
      title = 'CAD Fine Issued',
      description = message,
      amount = tonumber(amount) or 0,
      reason = reason,
    })
  end

  if Config.FineAdapter == 'auto' then
    local sourceId = resolveFineSource(job, citizenId)
    if not sourceId then
      return false, 'Target character is not currently online', true
    end

    if GetResourceState('qbx_core') == 'started' then
      local ok, xPlayer = pcall(function()
        return exports.qbx_core:GetPlayer(sourceId)
      end)
      if ok and xPlayer then
        local fineReason = reason ~= '' and reason or 'CAD fine'
        local beforeBalance = getQbxMoneyBalance(sourceId, xPlayer, account)
        local attemptedAdapters = {}
        local attemptErrors = {}
        local balanceVerifyRetries = 3
        local balanceVerifyDelayMs = 150

        local function recordAttempt(label, err)
          attemptedAdapters[#attemptedAdapters + 1] = label
          if err and err ~= '' then
            attemptErrors[#attemptErrors + 1] = ('%s -> %s'):format(label, err)
          end
        end

        local function getAfterBalance()
          local refreshed = xPlayer
          local refreshedOk, refreshedPlayer = pcall(function()
            return exports.qbx_core:GetPlayer(sourceId)
          end)
          if refreshedOk and refreshedPlayer then
            refreshed = refreshedPlayer
          end
          return getQbxMoneyBalance(sourceId, refreshed, account)
        end

        local function tryAdapter(label, fn)
          local callOk, result = pcall(fn)
          if not callOk then
            recordAttempt(label, ('error: %s'):format(tostring(result)))
            return false
          end

          if result == false then
            recordAttempt(label, 'returned false')
            return false
          end

          local deducted = nil
          if beforeBalance ~= nil then
            deducted = select(1, verifyDeductionWithRetries(
              getAfterBalance,
              beforeBalance,
              amount,
              balanceVerifyRetries,
              balanceVerifyDelayMs
            ))
          end

          if deducted == true then
            recordAttempt(label)
            return true
          end

          if result == true then
            -- Some QBX implementations return true before balance replication catches up.
            if deducted == false then
              recordAttempt(label, 'returned true but balance check did not reflect deduction yet')
            else
              recordAttempt(label)
            end
            return true
          end

          -- Some framework adapters do not return a status; accept on no-error when balance cannot be verified.
          if deducted == false then
            recordAttempt(label, ('no deduction verified (result=%s)'):format(tostring(result)))
            return false
          end
          recordAttempt(label)
          return true
        end

        local adapters = {
          {
            label = 'qbx export RemoveMoney(source, account, amount, reason)',
            fn = function()
              return exports.qbx_core:RemoveMoney(sourceId, account, amount, fineReason)
            end,
          },
          {
            label = 'qbx export RemoveMoney(source, account, amount)',
            fn = function()
              return exports.qbx_core:RemoveMoney(sourceId, account, amount)
            end,
          },
        }

        if citizenId ~= '' then
          adapters[#adapters + 1] = {
            label = 'qbx export RemoveMoney(citizenid, account, amount, reason)',
            fn = function()
              return exports.qbx_core:RemoveMoney(citizenId, account, amount, fineReason)
            end,
          }
          adapters[#adapters + 1] = {
            label = 'qbx export RemoveMoney(citizenid, account, amount)',
            fn = function()
              return exports.qbx_core:RemoveMoney(citizenId, account, amount)
            end,
          }
        end

        if xPlayer.Functions and type(xPlayer.Functions.RemoveMoney) == 'function' then
          adapters[#adapters + 1] = {
            label = 'xPlayer.Functions.RemoveMoney(account, amount, reason)',
            fn = function()
              return xPlayer.Functions.RemoveMoney(account, amount, fineReason)
            end,
          }
          adapters[#adapters + 1] = {
            label = 'xPlayer.Functions.RemoveMoney(account, amount)',
            fn = function()
              return xPlayer.Functions.RemoveMoney(account, amount)
            end,
          }
          adapters[#adapters + 1] = {
            label = 'xPlayer.Functions.RemoveMoney(amount, account, reason)',
            fn = function()
              return xPlayer.Functions.RemoveMoney(amount, account, fineReason)
            end,
          }
        end

        if type(xPlayer.RemoveMoney) == 'function' then
          adapters[#adapters + 1] = {
            label = 'xPlayer:RemoveMoney(account, amount, reason)',
            fn = function()
              return xPlayer:RemoveMoney(account, amount, fineReason)
            end,
          }
          adapters[#adapters + 1] = {
            label = 'xPlayer:RemoveMoney(account, amount)',
            fn = function()
              return xPlayer:RemoveMoney(account, amount)
            end,
          }
          adapters[#adapters + 1] = {
            label = 'xPlayer.RemoveMoney(xPlayer, account, amount, reason)',
            fn = function()
              return xPlayer.RemoveMoney(xPlayer, account, amount, fineReason)
            end,
          }
        end

        for _, adapter in ipairs(adapters) do
          if tryAdapter(adapter.label, adapter.fn) then
            notifyFineApplied(sourceId)
            return true, '', false
          end
        end

        local err = 'qbx_core RemoveMoney failed'
        if #attemptErrors > 0 then
          err = err .. ': ' .. attemptErrors[#attemptErrors]
        end
        if #attemptedAdapters > 0 then
          err = err .. (' (attempted: %s)'):format(table.concat(attemptedAdapters, ', '))
        end
        return false, err, false
      end
    end

    if GetResourceState('qb-core') == 'started' then
      local ok, core = pcall(function()
        return exports['qb-core']:GetCoreObject()
      end)
      if ok and core and core.Functions and core.Functions.GetPlayer then
        local player = core.Functions.GetPlayer(sourceId)
        if player and player.Functions and type(player.Functions.RemoveMoney) == 'function' then
          local beforeBalance = getPlayerMoneyBalance(player, account)
          local success, removed = pcall(function()
            return player.Functions.RemoveMoney(account, amount, reason ~= '' and reason or 'CAD fine')
          end)
          if not success then
            return false, ('qb-core RemoveMoney failed: %s'):format(tostring(removed)), false
          end
          if removed == false then
            return false, 'qb-core rejected fine removal', false
          end

          local deducted = nil
          if beforeBalance ~= nil then
            deducted = select(1, verifyDeductionWithRetries(
              function()
                return getPlayerMoneyBalance(player, account)
              end,
              beforeBalance,
              amount,
              3,
              150
            ))
          end

          if removed == nil and deducted ~= true then
            return false, 'qb-core RemoveMoney returned no status and deduction could not be verified', false
          end
          if removed == true and deducted == false then
            print(('[cad_bridge] qb-core RemoveMoney reported success but balance verification did not update immediately (source=%s, account=%s, amount=%s)'):format(
              tostring(sourceId),
              tostring(account),
              tostring(amount)
            ))
          end
          notifyFineApplied(sourceId)
          return true, '', false
        end
        return false, 'qb-core player object has no RemoveMoney method', false
      end
    end

    return false, 'No supported framework for auto fine adapter (qbx_core/qb-core)', false
  end

  if Config.FineAdapter == 'command' then
    local cmdTemplate = tostring(Config.FineCommandTemplate or '')
    if cmdTemplate == '' then
      return false, 'Fine command template is empty', false
    end

    local commandName = cmdTemplate:match('^%s*([^%s]+)') or ''
    if commandName == '' then
      return false, 'Fine command template has no command name', false
    end
    if not commandExists(commandName) then
      return false, ('Fine command not registered: %s'):format(commandName), false
    end

    local sourceId = resolveFineSource(job, citizenId)
    if not sourceId then
      return false, 'Target character is not currently online for command fine', true
    end
    local cmd = cmdTemplate
    cmd = cmd:gsub('{source}', shellEscape(sourceId or 0))
    cmd = cmd:gsub('{citizenid}', shellEscape(citizenId))
    cmd = cmd:gsub('{amount}', shellEscape(amount))
    cmd = cmd:gsub('{reason}', shellEscape(reason))

    ExecuteCommand(cmd)
    if sourceId then
      notifyFineApplied(sourceId)
    end
    return true, '', false
  end

  return false, ('Unknown fine adapter: %s'):format(tostring(Config.FineAdapter)), false
end

local finePollInFlight = false
pollFineJobs = function()
  if not hasBridgeConfig() then
    return
  end
  if finePollInFlight or isBridgeBackoffActive('fine_poll') then
    return
  end

  finePollInFlight = true
  request('GET', '/api/integration/fivem/fine-jobs?limit=25', nil, function(status, body, responseHeaders)
    finePollInFlight = false
    if status == 429 then
      setBridgeBackoff('fine_poll', responseHeaders, 10000, 'fine poll')
      return
    end
    if status ~= 200 then
      return
    end

    local ok, jobs = pcall(json.decode, body)
    if not ok or type(jobs) ~= 'table' then
      return
    end

    for _, job in ipairs(jobs) do
      local success, err, transient = applyFine(job)
      if success then
        request('POST', ('/api/integration/fivem/fine-jobs/%s/sent'):format(tostring(job.id)), {}, function() end)
      elseif transient then
        -- Keep pending and retry when the target character is online.
      else
        request('POST', ('/api/integration/fivem/fine-jobs/%s/failed'):format(tostring(job.id)), {
          error = err or 'Fine adapter failed',
        }, function() end)
      end
    end
  end)
end

CreateThread(function()
  while true do
    Wait(math.max(2000, tonumber(Config.FinePollIntervalMs) or 7000))
    pollFineJobs()
  end
end)

local function applyJail(job)
  local adapter = trim(Config.JailAdapter or 'wasabi'):lower()
  if adapter == '' then adapter = 'wasabi' end
  if adapter == 'none' then
    return false, 'Jail adapter disabled (Config.JailAdapter=none)', false
  end

  local citizenId = trim(job.citizen_id or '')
  local minutes = math.max(0, math.floor(tonumber(job.jail_minutes or job.minutes or 0) or 0))
  local reason = trim(job.reason or '')
  if citizenId == '' then
    return false, 'Jail citizen_id is empty', false
  end
  if minutes <= 0 then
    return false, 'Jail minutes must be greater than 0', false
  end

  local sourceId = resolveFineSource(job, citizenId)
  if not sourceId then
    return false, 'Target character is not currently online', true
  end

  if adapter == 'wasabi' then
    if GetResourceState('wasabi_police') ~= 'started' then
      return false, 'wasabi_police is not started', false
    end

    local attempts = {}
    local function recordAttempt(label, ok, err)
      if ok then
        attempts[#attempts + 1] = ('%s -> ok'):format(label)
      else
        attempts[#attempts + 1] = ('%s -> %s'):format(label, tostring(err or 'failed'))
      end
      return ok
    end

    -- For exports: only treat an explicit true return as success.
    -- wasabi_police exports return true on success; nil means the export
    -- ran but did nothing (wrong signature, wrong version, etc.).
    local function invokeExport(label, fn)
      local ok, result = pcall(fn)
      if not ok then
        return recordAttempt(label, false, result)
      end
      if result ~= true then
        return recordAttempt(label, false, result == false and 'returned false' or 'returned nil')
      end
      return recordAttempt(label, true)
    end

    -- For server/client events: Lua events never return a value, so we
    -- fire the event and treat a clean pcall as success. Only reached
    -- when all export variants have already failed.
    local function invokeEvent(label, fn)
      local ok, err = pcall(fn)
      if not ok then
        return recordAttempt(label, false, err)
      end
      return recordAttempt(label, true)
    end

    local invoked = false

    -- Try wasabi export variants first as these do not rely on event "source" context.
    local exportAttempts = {
      {
        label = 'exports.wasabi_police:sendToJail(source, minutes, reason)',
        fn = function()
          return exports.wasabi_police:sendToJail(sourceId, minutes, reason)
        end,
      },
      {
        label = 'exports.wasabi_police:sendToJail(source, minutes)',
        fn = function()
          return exports.wasabi_police:sendToJail(sourceId, minutes)
        end,
      },
      {
        label = 'exports.wasabi_police:SendToJail(source, minutes, reason)',
        fn = function()
          return exports.wasabi_police:SendToJail(sourceId, minutes, reason)
        end,
      },
      {
        label = 'exports.wasabi_police:SendToJail(source, minutes)',
        fn = function()
          return exports.wasabi_police:SendToJail(sourceId, minutes)
        end,
      },
    }

    for _, adapterTry in ipairs(exportAttempts) do
      if invokeExport(adapterTry.label, adapterTry.fn) then
        invoked = true
        break
      end
    end

    if not invoked then
      local eventAttempts = {
        {
          label = 'TriggerEvent wasabi_police:server:sendToJail(source, minutes)',
          fn = function()
            TriggerEvent('wasabi_police:server:sendToJail', sourceId, minutes)
          end,
        },
        {
          label = 'TriggerEvent wasabi_police:server:sendToJail(source, minutes, reason)',
          fn = function()
            TriggerEvent('wasabi_police:server:sendToJail', sourceId, minutes, reason)
          end,
        },
        {
          label = 'TriggerEvent wasabi_police:qbPrisonJail(source, minutes)',
          fn = function()
            TriggerEvent('wasabi_police:qbPrisonJail', sourceId, minutes)
          end,
        },
        {
          label = 'TriggerClientEvent wasabi_police:jailPlayer(source, minutes)',
          fn = function()
            TriggerClientEvent('wasabi_police:jailPlayer', sourceId, minutes)
          end,
        },
        {
          label = 'TriggerClientEvent wasabi_police:jailPlayer(source, minutes, reason)',
          fn = function()
            TriggerClientEvent('wasabi_police:jailPlayer', sourceId, minutes, reason)
          end,
        },
        {
          label = 'TriggerEvent wasabi_police:sendToJail(source, minutes)',
          fn = function()
            TriggerEvent('wasabi_police:sendToJail', sourceId, minutes)
          end,
        },
        {
          label = 'TriggerEvent wasabi_police:sendToJail(source, minutes, reason)',
          fn = function()
            TriggerEvent('wasabi_police:sendToJail', sourceId, minutes, reason)
          end,
        },
      }

      for _, eventTry in ipairs(eventAttempts) do
        if invokeEvent(eventTry.label, eventTry.fn) then
          invoked = true
          break
        end
      end
    end

    if not invoked then
      return false, table.concat(attempts, ' | '), false
    end

    local message = ('You have been sentenced to %s minute(s)'):format(tostring(minutes))
    if reason ~= '' then
      message = message .. (' | %s'):format(reason)
    end
    notifyAlert(sourceId, 'CAD Sentence', message, 'error')
    return true, '', false
  end

  if adapter == 'command' then
    local cmdTemplate = tostring(Config.JailCommandTemplate or '')
    if cmdTemplate == '' then
      return false, 'Jail command template is empty', false
    end

    local commandName = cmdTemplate:match('^%s*([^%s]+)') or ''
    if commandName == '' then
      return false, 'Jail command template has no command name', false
    end
    if not commandExists(commandName) then
      return false, ('Jail command not registered: %s'):format(commandName), false
    end

    local cmd = cmdTemplate
    cmd = cmd:gsub('{source}', shellEscape(sourceId))
    cmd = cmd:gsub('{citizenid}', shellEscape(citizenId))
    cmd = cmd:gsub('{minutes}', shellEscape(minutes))
    cmd = cmd:gsub('{reason}', shellEscape(reason))
    ExecuteCommand(cmd)

    local message = ('You have been sentenced to %s minute(s)'):format(tostring(minutes))
    if reason ~= '' then
      message = message .. (' | %s'):format(reason)
    end
    notifyAlert(sourceId, 'CAD Sentence', message, 'error')
    return true, '', false
  end

  return false, ('Unknown jail adapter: %s'):format(tostring(adapter)), false
end

local jailPollInFlight = false
pollJailJobs = function()
  if not hasBridgeConfig() then
    return
  end
  if jailPollInFlight or isBridgeBackoffActive('jail_poll') then
    return
  end

  jailPollInFlight = true
  request('GET', '/api/integration/fivem/jail-jobs?limit=25', nil, function(status, body, responseHeaders)
    jailPollInFlight = false
    if status == 429 then
      setBridgeBackoff('jail_poll', responseHeaders, 10000, 'jail poll')
      return
    end
    if status ~= 200 then
      return
    end

    local ok, jobs = pcall(json.decode, body)
    if not ok or type(jobs) ~= 'table' then
      return
    end

    for _, job in ipairs(jobs) do
      local success, err, transient = applyJail(job)
      if success then
        request('POST', ('/api/integration/fivem/jail-jobs/%s/sent'):format(tostring(job.id)), {}, function() end)
      elseif transient then
        -- Keep pending and retry when the target character is online.
      else
        request('POST', ('/api/integration/fivem/jail-jobs/%s/failed'):format(tostring(job.id)), {
          error = err or 'Jail adapter failed',
        }, function() end)
      end
    end
  end)
end

CreateThread(function()
  while true do
    Wait(math.max(2000, Config.JailPollIntervalMs or 7000))
    pollJailJobs()
  end
end)

local wraithLookupCooldownBySource = {}

local function normalizePlateKey(value)
  return trim(value):upper():gsub('[^A-Z0-9]', '')
end

local function shouldThrottleWraithLookup(source, plateKey)
  local src = tonumber(source) or 0
  if src <= 0 or plateKey == '' then return true end
  local cooldownMs = math.max(250, math.floor(tonumber(Config.WraithLookupCooldownMs) or 8000))
  local now = nowMs()
  local cache = wraithLookupCooldownBySource[src]
  if type(cache) ~= 'table' then
    cache = {}
    wraithLookupCooldownBySource[src] = cache
  end

  local blockedUntil = tonumber(cache[plateKey] or 0) or 0
  if blockedUntil > now then
    return true
  end

  cache[plateKey] = now + cooldownMs
  return false
end

local function lookupWraithPlateStatus(source, camera, plateRaw)
  if Config.WraithCadLookupEnabled ~= true then return end
  if not hasBridgeConfig() then return end
  if isBridgeBackoffActive('wraith_plate_lookup') then return end

  local src = tonumber(source) or 0
  if src <= 0 then return end
  if not GetPlayerName(src) then return end

  local plateKey = normalizePlateKey(plateRaw)
  if plateKey == '' then return end
  if shouldThrottleWraithLookup(src, plateKey) then return end

  request('GET', '/api/integration/fivem/plate-status/' .. urlEncode(plateKey), nil, function(status, body, responseHeaders)
    if status == 429 then
      setBridgeBackoff('wraith_plate_lookup', responseHeaders, 5000, 'wraith plate lookup')
      return
    end
    if status ~= 200 then
      return
    end

    local ok, payload = pcall(json.decode, body or '{}')
    if not ok or type(payload) ~= 'table' then
      return
    end
    if payload.alert ~= true then
      return
    end

    local cam = trim(camera):lower()
    local camLabel = cam == 'rear' and 'Rear LPR' or 'Front LPR'
    local plate = trim(payload.plate or plateKey)
    local statusText = trim(payload.message or '')
    local model = trim(payload.vehicle_model or '')
    local owner = trim(payload.owner_name or '')
    local boloFlags = {}
    if type(payload.bolo_flags) == 'table' then
      for _, rawFlag in ipairs(payload.bolo_flags) do
        local normalized = trim(rawFlag):lower()
        if normalized ~= '' then
          local pretty = normalized:gsub('_', ' ')
          pretty = pretty:gsub('(%a)([%w_]*)', function(first, rest)
            return string.upper(first) .. string.lower(rest)
          end)
          boloFlags[#boloFlags + 1] = pretty
        end
      end
    end

    local details = {}
    if statusText ~= '' then details[#details + 1] = statusText end
    if model ~= '' then details[#details + 1] = model end
    if owner ~= '' then details[#details + 1] = owner end
    local statusHasBolo = statusText:lower():find('bolo', 1, true) ~= nil
    if payload.bolo_alert == true then
      if #boloFlags > 0 and not statusHasBolo then
        details[#details + 1] = 'BOLO: ' .. table.concat(boloFlags, ', ')
      elseif #boloFlags == 0 and not statusHasBolo then
        details[#details + 1] = 'BOLO match'
      end
    end

    local message = ('%s hit: %s'):format(camLabel, plate)
    if #details > 0 then
      message = message .. ' | ' .. table.concat(details, ' | ')
    end

    local severity = (payload.registration_status == 'unregistered' and payload.bolo_alert ~= true) and 'warning' or 'error'
    notifyAlert(src, 'CAD Plate Alert', message, severity)
  end)
end

RegisterNetEvent('wk:onPlateScanned', function(camera, plate, _index)
  local src = source
  if not src or src == 0 then return end
  lookupWraithPlateStatus(src, camera, plate)
end)

RegisterNetEvent('wk:onPlateLocked', function(camera, plate, _index)
  local src = source
  if not src or src == 0 then return end
  lookupWraithPlateStatus(src, camera, plate)
end)

AddEventHandler('playerDropped', function()
  local src = source
  wraithLookupCooldownBySource[src] = nil
end)

-- ============================================================================
-- Voice Integration (custom CAD radio only)
--
-- Radio channel membership/routing is handled only by cad_bridge.
-- No pma-voice/mm_radio radio exports are used here.
-- ============================================================================

local radioAdapterFallbackWarned = false

local function getRadioAdapter()
  local adapter = tostring(Config.RadioAdapter or 'cad-radio'):lower()
  if adapter == 'cad_radio' then adapter = 'cad-radio' end
  if adapter == 'none' then
    return 'none'
  end
  if adapter ~= 'cad-radio' then
    if not radioAdapterFallbackWarned then
      print(('[cad_bridge] Unsupported cad_bridge_radio_adapter "%s"; forcing cad-radio mode'):format(adapter))
      radioAdapterFallbackWarned = true
    end
    return 'cad-radio'
  end
  return 'cad-radio'
end

-- Custom CAD radio state (used when adapter = cad-radio)
local CadRadioMembersByChannel = {} -- [channel] = { [source] = true }
local CadRadioChannelBySource = {}  -- [source] = channel
local CadRadioTalkingBySource = {}  -- [source] = bool
local CadRadioDisplayNameBySource = {} -- [source] = custom display name
local ExternalVoiceSessionBySource = {} -- [source] = session payload
local externalVoiceTokenRequestInFlightBySource = {}

local function clearExternalVoiceSessionForSource(source, reason)
  local src = tonumber(source) or 0
  if src <= 0 then return end
  externalVoiceTokenRequestInFlightBySource[src] = nil
  ExternalVoiceSessionBySource[src] = nil

  TriggerClientEvent('cad_bridge:external_voice:session', src, {
    ok = false,
    cleared = true,
    reason = tostring(reason or 'cleared'),
  })
end

local function requestExternalVoiceTokenForSource(source, options)
  if Config.ExternalVoiceTokenEnabled ~= true then return end
  if not hasBridgeConfig() then return end

  local src = tonumber(source) or 0
  if src <= 0 then return end
  if not GetPlayerName(src) then return end

  local opts = type(options) == 'table' and options or {}
  local channelNumber = tonumber(opts.channelNumber) or tonumber(CadRadioChannelBySource[src] or 0) or 0
  channelNumber = math.floor(channelNumber)
  if channelNumber <= 0 then
    clearExternalVoiceSessionForSource(src, 'left_channel')
    return
  end

  if isBridgeBackoffActive('external_voice_token') then
    return
  end

  local channelType = trim(opts.channelType or 'radio')
  if channelType == '' then channelType = 'radio' end
  local now = nowMs()
  local force = opts.force == true
  local existing = ExternalVoiceSessionBySource[src]
  if not force and type(existing) == 'table' then
    local existingChannel = tonumber(existing.channel_number) or 0
    local existingType = trim(existing.channel_type or 'radio')
    local expiresAtMs = tonumber(existing.expires_at_ms or 0) or 0
    if existingChannel == channelNumber and existingType == channelType and expiresAtMs > (now + 15000) then
      return
    end
  end

  if externalVoiceTokenRequestInFlightBySource[src] then
    return
  end
  externalVoiceTokenRequestInFlightBySource[src] = true

  request('POST', '/api/integration/fivem/external-voice/token', {
    game_id = tostring(src),
    citizen_id = getCitizenId(src),
    player_name = getCharacterDisplayName(src),
    channel_number = channelNumber,
    channel_type = channelType,
    identifiers = GetPlayerIdentifiers(src),
  }, function(status, body, responseHeaders)
    externalVoiceTokenRequestInFlightBySource[src] = nil

    if status == 429 then
      setBridgeBackoff('external_voice_token', responseHeaders, 5000, 'external voice token')
      return
    end

    if status ~= 200 then
      if status ~= 0 then
        print(('[cad_bridge][external_voice] token request failed src=%s channel=%s status=%s'):format(
          tostring(src),
          tostring(channelNumber),
          tostring(status)
        ))
      end
      return
    end

    local ok, payload = pcall(json.decode, body or '{}')
    if not ok or type(payload) ~= 'table' or payload.ok ~= true or trim(payload.token or '') == '' then
      print(('[cad_bridge][external_voice] invalid token payload src=%s channel=%s'):format(
        tostring(src),
        tostring(channelNumber)
      ))
      return
    end

    local expiresInSeconds = tonumber(payload.expires_in_seconds) or 0
    if expiresInSeconds < 1 then expiresInSeconds = 60 end
    local session = {
      ok = true,
      provider = tostring(payload.provider or ''),
      url = tostring(payload.url or ''),
      room_name = tostring(payload.room_name or ''),
      identity = tostring(payload.identity or ''),
      token = tostring(payload.token or ''),
      channel_id = tonumber(payload.channel_id) or 0,
      channel_number = tonumber(payload.channel_number) or channelNumber,
      channel_type = channelType,
      game_id = tostring(payload.game_id or tostring(src)),
      citizen_id = tostring(payload.citizen_id or ''),
      expires_in_seconds = expiresInSeconds,
      issued_at_ms = nowMs(),
      expires_at_ms = nowMs() + (expiresInSeconds * 1000),
    }
    ExternalVoiceSessionBySource[src] = session
    TriggerClientEvent('cad_bridge:external_voice:session', src, session)

    print(('[cad_bridge][external_voice] token issued src=%s channel=%s provider=%s ttl=%ss'):format(
      tostring(src),
      tostring(session.channel_number),
      tostring(session.provider),
      tostring(session.expires_in_seconds)
    ))
  end)
end

local function cadRadioCountMembers(channelNumber)
  local channel = tonumber(channelNumber) or 0
  if channel <= 0 then return 0 end
  local bucket = CadRadioMembersByChannel[channel]
  if type(bucket) ~= 'table' then return 0 end

  local count = 0
  for memberSource, _ in pairs(bucket) do
    local src = tonumber(memberSource) or 0
    if src > 0 and GetPlayerName(src) then
      count = count + 1
    end
  end
  return count
end

local function cadRadioCountRouteTargetsForSource(source, channelNumber)
  local src = tonumber(source) or 0
  local channel = tonumber(channelNumber) or 0
  if src <= 0 or channel <= 0 then return 0 end

  local bucket = CadRadioMembersByChannel[channel]
  if type(bucket) ~= 'table' then return 0 end

  local count = 0
  for memberSource, _ in pairs(bucket) do
    local member = tonumber(memberSource) or 0
    if member > 0 and member ~= src and GetPlayerName(member) then
      count = count + 1
    end
  end
  return count
end

local function cadRadioLogChannelChange(source, oldChannel, newChannel)
  local src = tonumber(source) or 0
  if src <= 0 then return end
  local fromChannel = tonumber(oldChannel) or 0
  local toChannel = tonumber(newChannel) or 0

  if toChannel > 0 then
    local members = cadRadioCountMembers(toChannel)
    local routeTargets = cadRadioCountRouteTargetsForSource(src, toChannel)
    local noRouteReason = routeTargets > 0 and '' or ' no_route_reason=single_member_or_no_peers'
    print(('[cad_bridge][radio] join-success src=%s from=%s to=%s members=%s route_targets=%s%s'):format(
      tostring(src),
      tostring(fromChannel),
      tostring(toChannel),
      tostring(members),
      tostring(routeTargets),
      noRouteReason
    ))
    return
  end

  if fromChannel > 0 then
    local remaining = cadRadioCountMembers(fromChannel)
    print(('[cad_bridge][radio] leave-success src=%s from=%s remaining_members=%s'):format(
      tostring(src),
      tostring(fromChannel),
      tostring(remaining)
    ))
  end
end

local function cadRadioGetMemberRows(channelNumber)
  local channel = tonumber(channelNumber) or 0
  if channel <= 0 then return {} end

  local bucket = CadRadioMembersByChannel[channel]
  if not bucket then return {} end

  local rows = {}
  for memberSource, _ in pairs(bucket) do
    if GetPlayerName(memberSource) then
      local displayName = CadRadioDisplayNameBySource[memberSource] or getCharacterDisplayName(memberSource)
      rows[#rows + 1] = {
        source = memberSource,
        name = displayName or ('Player ' .. tostring(memberSource)),
        talking = CadRadioTalkingBySource[memberSource] == true,
      }
    else
      bucket[memberSource] = nil
      CadRadioChannelBySource[memberSource] = nil
      CadRadioTalkingBySource[memberSource] = nil
      CadRadioDisplayNameBySource[memberSource] = nil
    end
  end

  if next(bucket) == nil then
    CadRadioMembersByChannel[channel] = nil
  end

  table.sort(rows, function(a, b)
    return tonumber(a.source or 0) < tonumber(b.source or 0)
  end)

  return rows
end

local function cadRadioPushStateToPlayer(source, channelNumber)
  local src = tonumber(source) or 0
  if src <= 0 or not GetPlayerName(src) then return end
  local channel = tonumber(channelNumber) or 0
  TriggerClientEvent('cad_bridge:radio:update', src, {
    channel_number = channel,
    members = cadRadioGetMemberRows(channel),
  })
end

local function cadRadioBroadcastChannel(channelNumber)
  local channel = tonumber(channelNumber) or 0
  if channel <= 0 then return end

  local members = cadRadioGetMemberRows(channel)
  for _, row in ipairs(members) do
    local src = tonumber(row.source) or 0
    if src > 0 then
      TriggerClientEvent('cad_bridge:radio:update', src, {
        channel_number = channel,
        members = members,
      })
    end
  end
end

local function cadRadioSetPlayerChannel(source, channelNumber)
  local src = tonumber(source) or 0
  if src <= 0 then
    return false, 'Invalid source'
  end

  local newChannel = tonumber(channelNumber) or 0
  if newChannel < 0 then newChannel = 0 end
  if newChannel > 0 then newChannel = math.floor(newChannel) end

  local oldChannel = tonumber(CadRadioChannelBySource[src] or 0) or 0

  if oldChannel == newChannel then
    local player = Player(src)
    if player and player.state then
      player.state.radioChannel = newChannel
    end
    if newChannel > 0 then
      cadRadioBroadcastChannel(newChannel)
    else
      cadRadioPushStateToPlayer(src, 0)
    end
    return true, nil
  end

  if oldChannel > 0 then
    local oldBucket = CadRadioMembersByChannel[oldChannel]
    if oldBucket then
      oldBucket[src] = nil
      if next(oldBucket) == nil then
        CadRadioMembersByChannel[oldChannel] = nil
      end
    end
  end

  CadRadioTalkingBySource[src] = false

  if newChannel > 0 then
    local newBucket = CadRadioMembersByChannel[newChannel]
    if not newBucket then
      newBucket = {}
      CadRadioMembersByChannel[newChannel] = newBucket
    end
    newBucket[src] = true
    CadRadioChannelBySource[src] = newChannel
  else
    CadRadioChannelBySource[src] = nil
  end

  local player = Player(src)
  if player and player.state then
    player.state.radioChannel = newChannel
  end

  if oldChannel > 0 then cadRadioBroadcastChannel(oldChannel) end
  if newChannel > 0 then
    cadRadioBroadcastChannel(newChannel)
    requestExternalVoiceTokenForSource(src, {
      channelType = 'radio',
      channelNumber = newChannel,
      force = true,
    })
  else
    cadRadioPushStateToPlayer(src, 0)
    clearExternalVoiceSessionForSource(src, 'left_radio_channel')
  end
  cadRadioLogChannelChange(src, oldChannel, newChannel)

  return true, nil
end

RegisterNetEvent('cad_bridge:radio:setTalking', function(enabled)
  local src = tonumber(source) or 0
  if src <= 0 then return end

  local channel = tonumber(CadRadioChannelBySource[src] or 0) or 0
  if channel <= 0 then return end

  local isTalking = enabled == true
  if CadRadioTalkingBySource[src] == isTalking then return end
  CadRadioTalkingBySource[src] = isTalking

  local bucket = CadRadioMembersByChannel[channel]
  if not bucket then return end
  for memberSource, _ in pairs(bucket) do
    if GetPlayerName(memberSource) then
      TriggerClientEvent('cad_bridge:radio:setTalking', memberSource, src, isTalking)
    end
  end
end)

local function radioNameListContains(nameList, value)
  local target = tostring(value or ''):lower()
  if target == '' then return false end
  if type(nameList) ~= 'table' then return false end
  for _, entry in ipairs(nameList) do
    if tostring(entry or ''):lower() == target then
      return true
    end
  end
  return false
end

local function getSourceJobGangDuty(source)
  local src = tonumber(source) or 0
  if src <= 0 then return '', '', false end

  local jobName = ''
  local gangName = ''
  local onDuty = true

  local player = Player(src)
  if player and player.state then
    local state = player.state

    local job = state.job
    if type(job) == 'table' then
      jobName = tostring(job.name or job.id or ''):lower()
      if job.onDuty ~= nil then
        onDuty = job.onDuty == true
      elseif job.onduty ~= nil then
        onDuty = job.onduty == true
      end
    elseif type(job) == 'string' then
      jobName = tostring(job):lower()
    end

    local gang = state.gang
    if type(gang) == 'table' then
      gangName = tostring(gang.name or gang.id or ''):lower()
    elseif type(gang) == 'string' then
      gangName = tostring(gang):lower()
    end

    if state.jobDuty ~= nil then
      onDuty = state.jobDuty == true
    elseif state.onduty ~= nil then
      onDuty = state.onduty == true
    end
  end

  return jobName, gangName, onDuty
end

local function validateCadRadioJoin(source, channelNumber)
  local channel = tonumber(channelNumber) or 0
  if channel <= 0 then
    return false, 'invalid_channel'
  end

  local maxFrequency = tonumber(Config.RadioMaxFrequency) or 500
  if channel > maxFrequency then
    return false, 'invalid_channel'
  end

  local restricted = Config.RadioRestrictedChannels
  if type(restricted) ~= 'table' then
    return true, nil
  end

  local rule = restricted[math.floor(channel)]
  if type(rule) ~= 'table' then
    return true, nil
  end

  local ruleType = tostring(rule.type or ''):lower()
  local allowedNames = rule.name
  local jobName, gangName, onDuty = getSourceJobGangDuty(source)

  if ruleType == 'job' then
    local requireDuty = rule.requireDuty ~= false
    if radioNameListContains(allowedNames, jobName) and (not requireDuty or onDuty == true) then
      return true, nil
    end
    return false, 'restricted_channel'
  end

  if ruleType == 'gang' then
    if radioNameListContains(allowedNames, gangName) then
      return true, nil
    end
    return false, 'restricted_channel'
  end

  return false, 'restricted_channel'
end

RegisterNetEvent('cad_bridge:radio:uiJoinRequest', function(channelNumber, radioName)
  if getRadioAdapter() ~= 'cad-radio' then return end
  local src = tonumber(source) or 0
  if src <= 0 then return end

  local channel = tonumber(channelNumber) or 0
  local allowed, denyReason = validateCadRadioJoin(src, channel)
  if not allowed then
    print(('[cad_bridge][radio] join-denied src=%s channel=%s reason=%s'):format(
      tostring(src),
      tostring(channel),
      tostring(denyReason or 'join_denied')
    ))
    TriggerClientEvent('cad_bridge:radio:uiJoinResult', src, false, denyReason, channel)
    return
  end

  local name = tostring(radioName or ''):gsub('^%s+', ''):gsub('%s+$', '')
  if name ~= '' and #name <= 64 then
    CadRadioDisplayNameBySource[src] = name
  elseif not CadRadioDisplayNameBySource[src] then
    CadRadioDisplayNameBySource[src] = getCharacterDisplayName(src)
  end

  local success, err = cadRadioSetPlayerChannel(src, channel)
  if not success then
    print(('[cad_bridge][radio] join-failed src=%s channel=%s reason=%s'):format(
      tostring(src),
      tostring(channel),
      tostring(err or 'join_failed')
    ))
  end
  TriggerClientEvent('cad_bridge:radio:uiJoinResult', src, success, success and nil or tostring(err or 'join_failed'), channel)
end)

RegisterNetEvent('cad_bridge:radio:uiLeaveRequest', function()
  if getRadioAdapter() ~= 'cad-radio' then return end
  local src = tonumber(source) or 0
  if src <= 0 then return end
  local success, err = cadRadioSetPlayerChannel(src, 0)
  if not success then
    print(('[cad_bridge][radio] leave-failed src=%s reason=%s'):format(
      tostring(src),
      tostring(err or 'leave_failed')
    ))
  end
  TriggerClientEvent('cad_bridge:radio:uiLeaveResult', src, success, success and nil or tostring(err or 'leave_failed'))
end)

RegisterNetEvent('cad_bridge:radio:setDisplayName', function(radioName)
  if getRadioAdapter() ~= 'cad-radio' then return end
  local src = tonumber(source) or 0
  if src <= 0 then return end

  local name = tostring(radioName or ''):gsub('^%s+', ''):gsub('%s+$', '')
  if name == '' or #name > 64 then
    return
  end

  CadRadioDisplayNameBySource[src] = name
  local channel = tonumber(CadRadioChannelBySource[src] or 0) or 0
  if channel > 0 then
    cadRadioBroadcastChannel(channel)
  end
end)

local function isRadioAdapterAvailable()
  return getRadioAdapter() == 'cad-radio'
end

local function setPlayerToRadioChannel(source, channelNumber)
  if getRadioAdapter() ~= 'cad-radio' then
    return false, 'Radio adapter is disabled (none)'
  end
  return cadRadioSetPlayerChannel(source, channelNumber)
end

local function isCallAdapterAvailable()
  return false
end

local function setPlayerToCallChannel(source, channelNumber)
  local src = tonumber(source) or 0
  if src <= 0 then
    return false, 'Invalid source'
  end
  local player = Player(src)
  if player and player.state then
    player.state.callChannel = tonumber(channelNumber) or 0
  end
  return true, nil
end

local function removePlayerFromRadio(source)
  return setPlayerToRadioChannel(source, 0)
end

local function removePlayerFromCall(source)
  return setPlayerToCallChannel(source, 0)
end

local function getPlayerRadioChannel(source)
  local player = Player(source)
  if player and player.state and player.state.radioChannel ~= nil then
    return tonumber(player.state.radioChannel) or 0
  end
  local customChannel = tonumber(CadRadioChannelBySource[source] or 0) or 0
  if customChannel > 0 then
    return customChannel
  end
  return nil
end

local function getPlayerCallChannel(source)
  local player = Player(source)
  if player and player.state then
    return player.state.callChannel
  end
  return nil
end

-- Track voice channel assignments for each player
local PlayerVoiceChannels = {}

local function updatePlayerVoiceChannel(source, channelType, channelNumber)
  if not PlayerVoiceChannels[source] then
    PlayerVoiceChannels[source] = {}
  end
  PlayerVoiceChannels[source][channelType] = channelNumber
end

local function clearPlayerVoiceChannels(source)
  PlayerVoiceChannels[source] = nil
end

-- Handle player disconnect to clean up voice channels
AddEventHandler('playerDropped', function(reason)
  local source = source
  removePlayerFromRadio(source)
  removePlayerFromCall(source)
  clearPlayerVoiceChannels(source)
  clearExternalVoiceSessionForSource(source, 'player_dropped')
  CadRadioTalkingBySource[source] = nil
  CadRadioDisplayNameBySource[source] = nil
end)

RegisterNetEvent('cad_bridge:external_voice:refresh', function()
  local src = tonumber(source) or 0
  if src <= 0 then return end
  local channel = tonumber(CadRadioChannelBySource[src] or 0) or 0
  if channel <= 0 then
    clearExternalVoiceSessionForSource(src, 'refresh_without_channel')
    return
  end
  requestExternalVoiceTokenForSource(src, {
    channelType = 'radio',
    channelNumber = channel,
    force = true,
  })
end)

CreateThread(function()
  Wait(5000)
  if Config.ExternalVoiceTokenEnabled ~= true then
    print('[cad_bridge][external_voice] token flow disabled (cad_bridge_external_voice_token_enabled=false).')
    return
  end
  if not hasBridgeConfig() then
    print('[cad_bridge][external_voice] bridge not configured; token flow disabled.')
    return
  end

  request('GET', '/api/integration/fivem/external-voice/status', nil, function(status, body)
    if status ~= 200 then
      if status ~= 0 then
        print(('[cad_bridge][external_voice] status check failed (status %s)'):format(tostring(status)))
      end
      return
    end
    local ok, payload = pcall(json.decode, body or '{}')
    if not ok or type(payload) ~= 'table' then
      print('[cad_bridge][external_voice] status check returned invalid payload')
      return
    end
    print(('[cad_bridge][external_voice] mode=%s provider=%s available=%s'):format(
      tostring(payload.mode or 'unknown'),
      tostring(payload.provider or 'none'),
      tostring(payload.available == true)
    ))
    if type(payload.missing) == 'table' and #payload.missing > 0 then
      print(('[cad_bridge][external_voice] missing config: %s'):format(table.concat(payload.missing, ', ')))
    end
  end)

  while true do
    Wait(10000)
    for src, session in pairs(ExternalVoiceSessionBySource) do
      if not GetPlayerName(src) then
        ExternalVoiceSessionBySource[src] = nil
        externalVoiceTokenRequestInFlightBySource[src] = nil
        goto nextSession
      end

      local expiresAtMs = tonumber(session and session.expires_at_ms or 0) or 0
      local currentChannel = tonumber(CadRadioChannelBySource[src] or 0) or 0
      if currentChannel <= 0 then
        clearExternalVoiceSessionForSource(src, 'not_in_radio_channel')
        goto nextSession
      end

      if expiresAtMs <= 0 or expiresAtMs <= (nowMs() + 20000) then
        requestExternalVoiceTokenForSource(src, {
          channelType = 'radio',
          channelNumber = currentChannel,
          force = true,
        })
      end
      ::nextSession::
    end
  end
end)

-- Poll CAD for voice events and sync with cad-radio.
-- External-radio deployments should keep this disabled to avoid duplicate
-- channel membership writers (in-game radio state -> CAD heartbeat is canonical).
local voicePollInFlight = false
CreateThread(function()
  if Config.VoiceEventPollEnabled ~= true then
    print('[cad_bridge] Voice event poll disabled (cad_bridge_voice_event_poll_enabled=false).')
    return
  end

  while true do
    Wait(math.max(1000, Config.VoicePollIntervalMs or 2000))
    if not hasBridgeConfig() then
      goto voiceContinue
    end
    if not isRadioAdapterAvailable() then
      goto voiceContinue
    end
    if voicePollInFlight or isBridgeBackoffActive('voice_poll') then
      goto voiceContinue
    end

    voicePollInFlight = true
    request('GET', '/api/integration/fivem/voice-events?limit=50', nil, function(status, body, responseHeaders)
      voicePollInFlight = false
      if status == 429 then
        setBridgeBackoff('voice_poll', responseHeaders, 5000, 'voice poll')
        return
      end
      if status ~= 200 then
        return
      end

      local ok, events = pcall(json.decode, body)
      if not ok or type(events) ~= 'table' then
        return
      end

      for _, event in ipairs(events) do
        local eventType = tostring(event.event_type or '')
        local sourceId = tonumber(event.game_id) or nil
        local channelNumber = tonumber(event.channel_number) or 0
        local eventId = tonumber(event.id) or nil

        if sourceId and eventId then
          local success = false
          local errorMsg = nil

          if eventType == 'join_radio' then
            success, errorMsg = setPlayerToRadioChannel(sourceId, channelNumber)
            if success then
              updatePlayerVoiceChannel(sourceId, 'radio', channelNumber)
            end
          elseif eventType == 'leave_radio' then
            success, errorMsg = removePlayerFromRadio(sourceId)
            if success then
              updatePlayerVoiceChannel(sourceId, 'radio', nil)
            end
          elseif eventType == 'join_call' then
            -- Call audio routing is intentionally disabled in cad-radio-only mode.
            success = true
            updatePlayerVoiceChannel(sourceId, 'call', channelNumber)
          elseif eventType == 'leave_call' then
            -- Keep queue clean even when call routing is disabled.
            success = true
            updatePlayerVoiceChannel(sourceId, 'call', nil)
          else
            errorMsg = 'Unknown voice event type: ' .. eventType
          end

          if success then
            request('POST', ('/api/integration/fivem/voice-events/%s/processed'):format(eventId), {}, function() end)
          else
            request('POST', ('/api/integration/fivem/voice-events/%s/failed'):format(eventId), {
              error = errorMsg or 'Voice event processing failed',
            }, function() end)
          end
        end
      end
    end)

    ::voiceContinue::
  end
end)

-- Export functions for use by other resources
exports('setPlayerRadio', setPlayerToRadioChannel)
exports('setPlayerCall', setPlayerToCallChannel)
exports('removePlayerRadio', removePlayerFromRadio)
exports('removePlayerCall', removePlayerFromCall)
exports('getPlayerRadioChannel', getPlayerRadioChannel)
exports('getPlayerCallChannel', getPlayerCallChannel)

-- ============================================================================
-- Radio Channel Auto-Sync (cad-radio)
-- Syncs channel labels from Config.RadioNames into CAD.
-- ============================================================================

-- Build channel labels from built-in cad_bridge config (preferred).
local function buildChannelsFromConfigNames()
  if type(Config.RadioNames) ~= 'table' then return nil end

  local channels = {}
  local seen = {}
  for key, name in pairs(Config.RadioNames) do
    local keyStr = tostring(key or '')
    if keyStr ~= '' and not keyStr:find('%%') and not keyStr:find('%.') then
      local channelNum = tonumber(keyStr)
      if channelNum and channelNum == math.floor(channelNum) and channelNum >= 1 and not seen[channelNum] then
        seen[channelNum] = true
        channels[#channels + 1] = {
          id = math.floor(channelNum),
          name = tostring(name or ('Channel ' .. tostring(channelNum))),
        }
      end
    end
  end

  if #channels == 0 then return nil end
  table.sort(channels, function(a, b) return a.id < b.id end)
  return channels
end

local function syncRadioChannelsToCad(channels)
  if Config.RadioChannelSyncEnabled ~= true then return end
  if not channels or #channels == 0 then return end
  if not hasBridgeConfig() then return end

  request('POST', '/api/integration/fivem/radio-channels/sync', { channels = channels }, function(status, body)
    if status == 200 then
      local ok, data = pcall(json.decode, body)
      if ok and data then
        print(('[cad_bridge] Radio channels synced: %d total (%d created, %d updated)'):format(
          data.synced or 0, data.created or 0, data.updated or 0))
      end
    elseif status ~= 0 then
      print(('[cad_bridge] Radio channel sync failed (status %d)'):format(status))
    end
  end)
end

-- Auto-sync on resource start.
CreateThread(function()
  Wait(4000)
  if not hasBridgeConfig() then return end
  if Config.RadioChannelSyncEnabled ~= true then
    print('[cad_bridge] Radio channel sync disabled (cad_bridge_radio_channel_sync_enabled=false).')
    return
  end

  local channels = buildChannelsFromConfigNames()

  if channels then
    print(('[cad_bridge] Syncing %d radio channels from config to CAD...'):format(#channels))
    syncRadioChannelsToCad(channels)
  else
    print('[cad_bridge] No radio channel definitions found in Config.RadioNames.')
    print('[cad_bridge] Set cad_bridge_radio_names_json in cad_bridge/config.cfg for CAD channel labels.')
  end
end)

-- ============================================================================
-- Voice Participant Heartbeat (in-game radio state → CAD)
-- Polls every online player's state bag to read their current
-- radioChannel, then reports the full list to the CAD so the channel
-- participant panel stays live without needing a resource restart.
-- ============================================================================
local VOICE_HEARTBEAT_INTERVAL_MS = 5000  -- send full participant list every 5 s
local voiceHeartbeatInFlight = false
-- Small per-source cache: game_id (string) → citizenId (string)
local hbCitizenIdCache = {}

local function buildParticipantList()
  if not isRadioAdapterAvailable() then return nil end

  local players = GetPlayers()
  if #players == 0 then return {} end

  local list = {}

  for _, src in ipairs(players) do
    local source = tonumber(src)
    if not source then goto nextPlayer end

    local player = Player(source)
    if not player or not player.state then goto nextPlayer end

    local radioChannel = tonumber(player.state.radioChannel)
    if radioChannel == nil then
      radioChannel = tonumber(CadRadioChannelBySource[source] or 0) or 0
    end

    local gameId    = tostring(source)
    local citizenId = hbCitizenIdCache[gameId] or ''

    -- Lazily resolve citizenId from identifiers on first encounter
    if citizenId == '' then
      citizenId = getCitizenId(source) or ''
      hbCitizenIdCache[gameId] = citizenId
    end

    -- Always report the player so the CAD can add or remove them from channels.
    -- channel_number == 0 means "not in any radio channel".
    list[#list + 1] = {
      game_id        = gameId,
      citizen_id     = citizenId,
      channel_number = radioChannel,
      channel_type   = 'radio',
    }

    ::nextPlayer::
  end

  return list
end

-- Clear cache entry when a player drops so stale citizenIds aren't reused.
AddEventHandler('playerDropped', function()
  local droppedSrc = source
  hbCitizenIdCache[tostring(droppedSrc)] = nil
end)

CreateThread(function()
  -- Wait for bridge config to be ready
  Wait(10000)
  if Config.VoiceParticipantHeartbeatEnabled ~= true then
    print('[cad_bridge] Voice participant heartbeat disabled (cad_bridge_voice_participant_heartbeat_enabled=false).')
    return
  end

  while true do
    Wait(VOICE_HEARTBEAT_INTERVAL_MS)

    if not hasBridgeConfig() then goto heartbeatContinue end
    if not isRadioAdapterAvailable() then goto heartbeatContinue end
    if voiceHeartbeatInFlight or isBridgeBackoffActive('voice_hb') then goto heartbeatContinue end

    local participants = buildParticipantList()
    if not participants then goto heartbeatContinue end
    -- Send even if empty so the CAD can clear participants when no one is on.
    -- But skip if the server is completely empty (saves pointless requests).
    if #participants == 0 then goto heartbeatContinue end

    voiceHeartbeatInFlight = true
    request('POST', '/api/integration/fivem/voice-participants/heartbeat',
      { participants = participants },
      function(status, _, responseHeaders)
        voiceHeartbeatInFlight = false
        if status == 429 then
          setBridgeBackoff('voice_hb', responseHeaders, 10000, 'voice heartbeat')
        end
      end
    )

    ::heartbeatContinue::
  end
end)
