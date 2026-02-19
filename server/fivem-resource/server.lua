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
    if cb then cb(0, '{}', {}) end
    return
  end

  local headers = {
    ['Content-Type'] = 'application/json',
    ['x-cad-bridge-token'] = Config.SharedToken,
  }

  PerformHttpRequest(getCadUrl(path), function(status, body, responseHeaders)
    if cb then cb(status, body or '{}', responseHeaders or {}) end
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

local function getCitizenId(src)
  local player = Player(src)
  if player and player.state then
    local state = player.state

    local directCandidates = {
      state.citizenid,
      state.citizenId,
      state.cid,
      state.playerCitizenId,
    }
    for _, candidate in ipairs(directCandidates) do
      local value = trim(candidate)
      if value ~= '' then
        return value
      end
    end

    local statePlayerData = state.PlayerData
    if type(statePlayerData) == 'table' then
      local value = trim(statePlayerData.citizenid or '')
      if value ~= '' then
        return value
      end
    end
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

  local licenseCommand = trim(Config.DriverLicenseCommand or 'cadlicense')
  if licenseCommand ~= '' then
    TriggerClientEvent('chat:addSuggestion', target, '/' .. licenseCommand, 'Open CAD driver license form')
  end

  local regoCommand = trim(Config.VehicleRegistrationCommand or 'cadrego')
  if regoCommand ~= '' then
    TriggerClientEvent('chat:addSuggestion', target, '/' .. regoCommand, 'Open CAD vehicle registration form')
  end

  local showIdCommand = trim(Config.ShowIdCommand or 'showid')
  if showIdCommand ~= '' then
    TriggerClientEvent('chat:addSuggestion', target, '/' .. showIdCommand, 'Show your driver licence to the player in front of you')
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
local function forceOxNotifyPosition(logApplied)
  if Config.ForceOxNotifyPosition ~= true then return end

  local target = trim(Config.OxNotifyPosition or 'center-right')
  if target == '' then target = 'center-right' end

  local ok, err = pcall(function()
    SetConvarReplicated('ox:notifyPosition', target)
  end)

  if not ok then
    print(('[cad_bridge] Failed to force ox:notifyPosition=%s (%s)'):format(target, tostring(err)))
    return
  end

  if logApplied == true or lastForcedOxNotifyPosition ~= target then
    print(('[cad_bridge] Forced ox:notifyPosition=%s'):format(target))
  end
  lastForcedOxNotifyPosition = target
end

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
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

local function normalizeDateOnly(value)
  local text = trim(value)
  if text == '' then return '' end
  local y, m, d = text:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)$')
  if y and m and d then
    return ('%s-%s-%s'):format(y, m, d)
  end
  return ''
end

local function addDaysDateOnly(days)
  local numericDays = tonumber(days) or 1
  if numericDays < 1 then numericDays = 1 end
  local when = os.time() + math.floor(numericDays) * 24 * 60 * 60
  return os.date('!%Y-%m-%d', when)
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

  local fullName = trim(payload.full_name or payload.character_name or '')
  local dateOfBirth = normalizeDateOnly(payload.date_of_birth or payload.dob or '')
  local gender = trim(payload.gender or '')
  local classes = normalizeList(payload.license_classes or payload.classes or {}, true)
  local conditions = normalizeList(payload.conditions or {}, false)
  local mugshotUrl = trim(payload.mugshot_url or '')
  local licenseNumber = trim(payload.license_number or '')
  local expiryDays = tonumber(payload.expiry_days or payload.duration_days or Config.DriverLicenseDefaultExpiryDays or 35) or (Config.DriverLicenseDefaultExpiryDays or 35)
  if expiryDays < 1 then expiryDays = 1 end
  local expiryAt = normalizeDateOnly(payload.expiry_at or '') or addDaysDateOnly(expiryDays)

  if fullName == '' then return nil, 'Character name is required.' end
  if dateOfBirth == '' then return nil, 'Date of birth is required (YYYY-MM-DD).' end
  if gender == '' then return nil, 'Gender is required.' end
  if #classes == 0 then return nil, 'At least one license class is required.' end

  return {
    full_name = fullName,
    date_of_birth = dateOfBirth,
    gender = gender,
    license_classes = classes,
    conditions = conditions,
    mugshot_url = mugshotUrl,
    license_number = licenseNumber,
    expiry_days = math.floor(expiryDays),
    expiry_at = expiryAt,
    status = 'valid',
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
  if isBridgeBackoffActive('licenses') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('licenses') / 1000))
    notifyPlayer(s, ('CAD bridge is rate-limited. Try again in %ss.'):format(waitSeconds))
    return
  end

  local defaults = getCharacterDefaults(s)
  local payload = {
    source = s,
    player_name = getCharacterDisplayName(s),
    identifiers = GetPlayerIdentifiers(s),
    citizenid = trim(getCitizenId(s) or defaults.citizenid or ''),
    full_name = trim(defaults.full_name ~= '' and defaults.full_name or formData.full_name),
    date_of_birth = normalizeDateOnly(defaults.date_of_birth ~= '' and defaults.date_of_birth or formData.date_of_birth),
    gender = trim(defaults.gender ~= '' and defaults.gender or formData.gender),
    license_number = trim(formData.license_number or ''),
    license_classes = formData.license_classes or {},
    conditions = formData.conditions or {},
    mugshot_url = trim(formData.mugshot_url or ''),
    expiry_days = tonumber(formData.expiry_days or Config.DriverLicenseDefaultExpiryDays or 35) or (Config.DriverLicenseDefaultExpiryDays or 35),
    expiry_at = normalizeDateOnly(formData.expiry_at or ''),
    status = 'valid',
  }

  if trim(payload.citizenid) == '' then
    notifyPlayer(s, 'Unable to determine your active character (citizenid). Re-log and try again.')
    print(('[cad_bridge] Driver license submit blocked for src %s: missing citizenid'):format(tostring(s)))
    return
  end

  local feeAccount = trim(Config.DocumentFeeAccount or 'bank'):lower()
  if feeAccount == '' then feeAccount = 'bank' end
  local feeAmount = resolveDocumentFeeAmount(Config.DriverLicenseFeesByDays or {}, payload.expiry_days)
  local feeCharged = false

  if feeAmount > 0 then
    local paid, payErr = chargeDocumentFee(
      s,
      payload.citizenid,
      feeAccount,
      feeAmount,
      ('Driver licence issue/renewal (%s days)'):format(tostring(math.floor(tonumber(payload.expiry_days) or 0)))
    )
    if not paid then
      notifyPlayer(s, payErr ~= '' and payErr or ('Unable to charge licence fee %s from %s account.'):format(formatMoney(feeAmount), feeAccount))
      return
    end
    feeCharged = true
  end

  request('POST', '/api/integration/fivem/licenses', payload, function(status, body, responseHeaders)
    if status >= 200 and status < 300 then
      local expiryAt = payload.expiry_at
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and type(parsed.license) == 'table' then
        expiryAt = tostring(parsed.license.expiry_at or expiryAt)
      end
      notifyPlayer(s, ('Driver licence saved to CAD. Status: VALID%s%s%s%s'):format(
        expiryAt ~= '' and ' | Expires: ' or '',
        expiryAt ~= '' and expiryAt or '',
        feeAmount > 0 and ' | Charged: ' or '',
        feeAmount > 0 and formatMoney(feeAmount) or ''
      ))
      return
    end

    if status == 429 then
      setBridgeBackoff('licenses', responseHeaders, 15000, 'driver license create')
    end

    local err = ('Failed to create CAD driver license (HTTP %s)'):format(tostring(status))
    local ok, parsed = pcall(json.decode, body or '{}')
    if ok and type(parsed) == 'table' and parsed.error then
      err = err .. ': ' .. tostring(parsed.error)
    end
    print('[cad_bridge] ' .. err)
    if feeCharged and feeAmount > 0 then
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
    notifyPlayer(s, 'Driver license failed to save to CAD. Check server logs.')
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

  if trim(payload.citizenid) == '' then
    notifyPlayer(s, 'Unable to determine your active character (citizenid). Re-log and try again.')
    print(('[cad_bridge] Registration submit blocked for src %s: missing citizenid'):format(tostring(s)))
    return
  end

  local feeAccount = trim(Config.DocumentFeeAccount or 'bank'):lower()
  if feeAccount == '' then feeAccount = 'bank' end
  local feeAmount = resolveDocumentFeeAmount(Config.VehicleRegistrationFeesByDays or {}, payload.duration_days)
  local feeCharged = false

  if feeAmount > 0 then
    local paid, payErr = chargeDocumentFee(
      s,
      payload.citizenid,
      feeAccount,
      feeAmount,
      ('Vehicle registration issue/renewal (%s days)'):format(tostring(math.floor(tonumber(payload.duration_days) or 0)))
    )
    if not paid then
      notifyPlayer(s, payErr ~= '' and payErr or ('Unable to charge registration fee %s from %s account.'):format(formatMoney(feeAmount), feeAccount))
      return
    end
    feeCharged = true
  end

  request('POST', '/api/integration/fivem/registrations', payload, function(status, body, responseHeaders)
    if status >= 200 and status < 300 then
      local expiryAt = payload.expiry_at
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and type(parsed.registration) == 'table' then
        expiryAt = tostring(parsed.registration.expiry_at or expiryAt)
      end
      notifyPlayer(s, ('Vehicle registration saved to CAD%s%s%s%s'):format(
        expiryAt ~= '' and ' | Expires: ' or '',
        expiryAt ~= '' and expiryAt or '',
        feeAmount > 0 and ' | Charged: ' or '',
        feeAmount > 0 and formatMoney(feeAmount) or ''
      ))
      return
    end

    if status == 429 then
      setBridgeBackoff('registrations', responseHeaders, 15000, 'vehicle registration create')
    end

    local err = ('Failed to create CAD vehicle registration (HTTP %s)'):format(tostring(status))
    local ok, parsed = pcall(json.decode, body or '{}')
    if ok and type(parsed) == 'table' and parsed.error then
      err = err .. ': ' .. tostring(parsed.error)
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
    notifyPlayer(s, 'Vehicle registration failed to save to CAD. Check server logs.')
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
  if not src or src == 0 then return end

  local formData, err = parseDriverLicenseForm(payload)
  if not formData then
    notifyPlayer(src, err or 'Invalid driver license details.')
    return
  end

  submitDriverLicense(src, formData)
end)

RegisterNetEvent('cad_bridge:submitVehicleRegistration', function(payload)
  local src = source
  if not src or src == 0 then return end

  local formData, err = parseVehicleRegistrationForm(payload)
  if not formData then
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

  local target = tonumber(targetSource) or 0
  if target <= 0 or target == src or not GetPlayerName(target) then
    target = 0
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
    local payload = {
      full_name = fullName,
      date_of_birth = trim(license.date_of_birth or defaults.date_of_birth or ''),
      gender = trim(license.gender or defaults.gender or ''),
      license_number = trim(license.license_number or ''),
      license_classes = normalizeList(license.license_classes or {}, true),
      conditions = normalizeList(license.conditions or {}, false),
      status = trim(license.status or ''),
      expiry_at = trim(license.expiry_at or ''),
      mugshot_url = trim(license.mugshot_url or ''),
    }

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

    if target > 0 then
      TriggerClientEvent('cad_bridge:showIdCard', target, {
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
      notifyPlayer(src, ('Licence shown to %s.'):format(GetPlayerName(target) or ('Player ' .. tostring(target))))
      return
    end

    notifyPlayer(src, 'No player in front. Licence shown to yourself only.')
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

RegisterCommand(trim(Config.DriverLicenseCommand or 'cadlicense'), function(src, _args)
  if not src or src == 0 then
    print('[cad_bridge] Driver license command is in-game only')
    return
  end

  local defaults = getCharacterDefaults(src)
  local defaultExpiryDays = tonumber(Config.DriverLicenseDefaultExpiryDays or 35) or 35
  if defaultExpiryDays < 1 then defaultExpiryDays = 35 end
  TriggerClientEvent('cad_bridge:promptDriverLicense', src, {
    full_name = defaults.full_name,
    date_of_birth = defaults.date_of_birth,
    gender = defaults.gender,
    class_options = Config.DriverLicenseClassOptions or {},
    default_classes = Config.DriverLicenseDefaultClasses or {},
    default_expiry_days = defaultExpiryDays,
    duration_options = Config.DriverLicenseDurationOptions or { 6, 14, 35, 70 },
  })
end, false)

RegisterCommand(trim(Config.VehicleRegistrationCommand or 'cadrego'), function(src, _args)
  if not src or src == 0 then
    print('[cad_bridge] Vehicle registration command is in-game only')
    return
  end

  local defaults = getCharacterDefaults(src)
  TriggerClientEvent('cad_bridge:promptVehicleRegistration', src, {
    owner_name = defaults.full_name,
    duration_options = Config.VehicleRegistrationDurationOptions or { 6, 14, 35, 70 },
    default_duration_days = tonumber(Config.VehicleRegistrationDefaultDays or 35) or 35,
  })
end, false)

local heartbeatInFlight = false
local heartbeatInFlightSinceMs = 0

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
    Wait(math.max(1000, Config.HeartbeatIntervalMs))
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
          local pos = PlayerPositions[s] or {
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
          payloadPlayers[#payloadPlayers + 1] = {
            source = s,
            name = getCharacterDisplayName(s),
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
    Wait(math.max(2000, Config.JobSyncPollIntervalMs))
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
    Wait(math.max(2000, Config.RoutePollIntervalMs))
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
CreateThread(function()
  while true do
    Wait(math.max(2000, Config.FinePollIntervalMs))
    if not hasBridgeConfig() then
      goto continue
    end
    if finePollInFlight or isBridgeBackoffActive('fine_poll') then
      goto continue
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

    ::continue::
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

    local function invoke(label, fn)
      local ok, result = pcall(fn)
      if not ok then
        return recordAttempt(label, false, result)
      end
      if result == false then
        return recordAttempt(label, false, 'returned false')
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
      if invoke(adapterTry.label, adapterTry.fn) then
        invoked = true
        break
      end
    end

    if not invoked then
      local eventAttempts = {
        {
          label = 'TriggerEvent wasabi_police:sendToJail(source, minutes, reason)',
          fn = function()
            TriggerEvent('wasabi_police:sendToJail', sourceId, minutes, reason)
          end,
        },
        {
          label = 'TriggerEvent wasabi_police:sendToJail(source, minutes)',
          fn = function()
            TriggerEvent('wasabi_police:sendToJail', sourceId, minutes)
          end,
        },
        {
          label = 'TriggerEvent wasabi_police:server:sendToJail(source, minutes, reason)',
          fn = function()
            TriggerEvent('wasabi_police:server:sendToJail', sourceId, minutes, reason)
          end,
        },
        {
          label = 'TriggerEvent wasabi_police:server:sendToJail(source, minutes)',
          fn = function()
            TriggerEvent('wasabi_police:server:sendToJail', sourceId, minutes)
          end,
        },
        {
          label = 'TriggerClientEvent wasabi_police:jailPlayer(source, minutes, reason)',
          fn = function()
            TriggerClientEvent('wasabi_police:jailPlayer', sourceId, minutes, reason)
          end,
        },
        {
          label = 'TriggerClientEvent wasabi_police:jailPlayer(source, minutes)',
          fn = function()
            TriggerClientEvent('wasabi_police:jailPlayer', sourceId, minutes)
          end,
        },
      }

      for _, eventTry in ipairs(eventAttempts) do
        if invoke(eventTry.label, eventTry.fn) then
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
CreateThread(function()
  while true do
    Wait(math.max(2000, Config.JailPollIntervalMs or 7000))
    if not hasBridgeConfig() then
      goto continue
    end
    if jailPollInFlight or isBridgeBackoffActive('jail_poll') then
      goto continue
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

    ::continue::
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
  else
    cadRadioPushStateToPlayer(src, 0)
  end

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
  TriggerClientEvent('cad_bridge:radio:uiJoinResult', src, success, success and nil or tostring(err or 'join_failed'), channel)
end)

RegisterNetEvent('cad_bridge:radio:uiLeaveRequest', function()
  if getRadioAdapter() ~= 'cad-radio' then return end
  local src = tonumber(source) or 0
  if src <= 0 then return end
  local success, err = cadRadioSetPlayerChannel(src, 0)
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
  CadRadioTalkingBySource[source] = nil
  CadRadioDisplayNameBySource[source] = nil
end)

-- Poll CAD for voice events and sync with cad-radio
local voicePollInFlight = false
CreateThread(function()
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

