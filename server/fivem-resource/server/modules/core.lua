local PlayerPositions = {}
local activeCallPromptBySource = {}

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
  activeCallPromptBySource[src] = nil

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
