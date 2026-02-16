local PlayerPositions = {}

local function trim(s)
  if not s then return '' end
  return (s:gsub('^%s+', ''):gsub('%s+$', ''))
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

local function registerEmergencySuggestion(target)
  if GetResourceState('chat') ~= 'started' then return end
  TriggerClientEvent('chat:addSuggestion', target, '/000', 'Send emergency call to CAD', {
    { name = 'message', help = 'Leave blank to open popup. Optional chat format: /000 <type> | <details> | <suspects> | <vehicle> | <hazards/injuries>' },
  })
end

local startNpwdEmergencyHandlerRegistration

local function getNpwdResourceName()
  local name = trim(GetConvar('cad_bridge_npwd_resource', 'npwd'))
  if name == '' then return 'npwd' end
  return name
end

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  CreateThread(function()
    Wait(500)
    registerEmergencySuggestion(-1)
  end)
  startNpwdEmergencyHandlerRegistration()
end)

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= getNpwdResourceName() then return end
  startNpwdEmergencyHandlerRegistration()
end)

AddEventHandler('playerJoining', function()
  local src = source
  CreateThread(function()
    Wait(3000)
    registerEmergencySuggestion(src)
  end)
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
    player_name = GetPlayerName(s) or ('Player ' .. tostring(s)),
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

local npwdEmergencyHandlersRegistered = {}

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
  local configured = trim(GetConvar('cad_bridge_npwd_emergency_numbers', '000'))
  local parsed = splitByComma(configured)
  if #parsed == 0 then
    return { '000' }
  end
  return parsed
end

local function sendNpwdMessage(senderNumber, targetNumber, message)
  local sender = trim(senderNumber)
  local target = trim(targetNumber)
  local text = trim(message)
  if sender == '' or target == '' or text == '' then
    return
  end
  local npwdResource = getNpwdResourceName()
  if GetResourceState(npwdResource) ~= 'started' then
    return
  end

  local ok, err = pcall(function()
    exports[npwdResource]:emitMessage({
      senderNumber = sender,
      targetNumber = target,
      message = text,
    })
  end)
  if not ok then
    print(('[cad_bridge] NPWD message send failed: %s'):format(tostring(err)))
  end
end

local function submitNpwdEmergencyCall(src, emergencyNumber, incomingCaller)
  local s = tonumber(src)
  if not s then return end

  if isBridgeBackoffActive('calls') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('calls') / 1000))
    notifyPlayer(s, ('CAD bridge is rate-limited. Emergency call not sent yet, retry in %ss.'):format(waitSeconds))
    return
  end

  local callerName = trim((incomingCaller and incomingCaller.name) or GetPlayerName(s) or ('Player ' .. tostring(s)))
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
    player_name = callerName ~= '' and callerName or ('Player ' .. tostring(s)),
    identifiers = GetPlayerIdentifiers(s),
    citizenid = getCitizenId(s),
    title = ('000 Phone Call - %s'):format(callerName ~= '' and callerName or ('Player ' .. tostring(s))),
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
      sendNpwdMessage(emergencyNumber, callerNumber, confirmation)
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
    sendNpwdMessage(emergencyNumber, callerNumber, 'Unable to reach CAD dispatch right now. Please try again.')
    notifyPlayer(s, '000 call failed to send to CAD. Check server logs.')
  end)
end

local function handleNpwdEmergencyCall(emergencyNumber, callRequest)
  local requestObj = type(callRequest) == 'table' and callRequest or {}
  local incomingCaller = type(requestObj.incomingCaller) == 'table' and requestObj.incomingCaller or {}
  local src = tonumber(incomingCaller.source) or 0

  -- Allow NPWD to continue its own default call flow so this hook is non-blocking.
  if type(requestObj.reply) == 'function' then
    pcall(function()
      requestObj.reply('Connecting emergency dispatch...')
    end)
  end
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
            name = GetPlayerName(s) or ('Player ' .. tostring(s)),
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

-- ============================================================================
-- Voice Integration (pma-voice)
-- ============================================================================

local function isPmaVoiceAvailable()
  return GetResourceState('pma-voice') == 'started'
end

local function setPlayerToRadioChannel(source, channelNumber)
  if not isPmaVoiceAvailable() then
    return false, 'pma-voice resource not available'
  end

  local success, err = pcall(function()
    exports['pma-voice']:setPlayerRadio(source, channelNumber)
  end)

  if not success then
    return false, 'Failed to set radio channel: ' .. tostring(err)
  end

  return true, nil
end

local function setPlayerToCallChannel(source, channelNumber)
  if not isPmaVoiceAvailable() then
    return false, 'pma-voice resource not available'
  end

  local success, err = pcall(function()
    exports['pma-voice']:setPlayerCall(source, channelNumber)
  end)

  if not success then
    return false, 'Failed to set call channel: ' .. tostring(err)
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
  if not isPmaVoiceAvailable() then
    return nil
  end

  local player = Player(source)
  if not player or not player.state then
    return nil
  end

  return player.state.radioChannel
end

local function getPlayerCallChannel(source)
  if not isPmaVoiceAvailable() then
    return nil
  end

  local player = Player(source)
  if not player or not player.state then
    return nil
  end

  return player.state.callChannel
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
end)

-- Poll CAD for voice events and sync with pma-voice
local voicePollInFlight = false
CreateThread(function()
  while true do
    Wait(math.max(1000, Config.VoicePollIntervalMs or 2000))
    if not hasBridgeConfig() then
      goto voiceContinue
    end
    if not isPmaVoiceAvailable() then
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
            success, errorMsg = setPlayerToCallChannel(sourceId, channelNumber)
            if success then
              updatePlayerVoiceChannel(sourceId, 'call', channelNumber)
            end
          elseif eventType == 'leave_call' then
            success, errorMsg = removePlayerFromCall(sourceId)
            if success then
              updatePlayerVoiceChannel(sourceId, 'call', nil)
            end
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
