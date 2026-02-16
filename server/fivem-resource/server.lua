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
    { name = 'type', help = 'Emergency type (e.g. Armed Robbery, Shots Fired, Stabbing)' },
    { name = 'details', help = 'Format: /000 <type> | <details> | <suspects> | <vehicle> | <hazards/injuries>' },
  })
end

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  CreateThread(function()
    Wait(500)
    registerEmergencySuggestion(-1)
  end)
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

local function sendEmergencyUsage(src)
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
  }

  if pos then
    payload.position = { x = pos.x, y = pos.y, z = pos.z }
    payload.heading = pos.heading
    payload.speed = pos.speed
    payload.street = pos.street
    payload.crossing = pos.crossing
    payload.postal = pos.postal
  end

  request('POST', '/api/integration/fivem/calls', payload, function(status, body)
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

    local err = ('Failed to create CAD call (HTTP %s)'):format(tostring(status))
    local ok, parsed = pcall(json.decode, body or '{}')
    if ok and type(parsed) == 'table' and parsed.error then
      err = err .. ': ' .. tostring(parsed.error)
    end
    print('[cad_bridge] ' .. err)
    notifyPlayer(s, '000 call failed to send to CAD. Check server logs.')
  end)
end

RegisterCommand('000', function(src, args)
  if not src or src == 0 then
    print('[cad_bridge] /000 command is in-game only')
    return
  end

  local rawInput = trim(table.concat(args or {}, ' '))
  if rawInput == '' or rawInput:lower() == 'help' then
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

CreateThread(function()
  while true do
    Wait(math.max(1000, Config.HeartbeatIntervalMs))
    if not hasBridgeConfig() then
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
          }
        end
      end
    end

    request('POST', '/api/integration/fivem/heartbeat', {
      players = payloadPlayers,
      timestamp = os.time(),
    }, function(status)
      if status >= 400 then
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

local function applyFine(job)
  if Config.FineAdapter == 'none' then
    return false, 'Fine adapter disabled (Config.FineAdapter=none)'
  end

  if Config.FineAdapter == 'command' then
    local cmdTemplate = tostring(Config.FineCommandTemplate or '')
    if cmdTemplate == '' then
      return false, 'Fine command template is empty'
    end

    local commandName = cmdTemplate:match('^%s*([^%s]+)') or ''
    if commandName == '' then
      return false, 'Fine command template has no command name'
    end
    if not commandExists(commandName) then
      return false, ('Fine command not registered: %s'):format(commandName)
    end

    local cmd = cmdTemplate
    cmd = cmd:gsub('{citizenid}', shellEscape(job.citizen_id or ''))
    cmd = cmd:gsub('{amount}', shellEscape(job.amount or 0))
    cmd = cmd:gsub('{reason}', shellEscape(job.reason or ''))

    ExecuteCommand(cmd)
    return true, ''
  end

  return false, ('Unknown fine adapter: %s'):format(tostring(Config.FineAdapter))
end

CreateThread(function()
  while true do
    Wait(math.max(2000, Config.FinePollIntervalMs))
    if not hasBridgeConfig() then
      goto continue
    end

    request('GET', '/api/integration/fivem/fine-jobs?limit=25', nil, function(status, body)
      if status ~= 200 then
        return
      end

      local ok, jobs = pcall(json.decode, body)
      if not ok or type(jobs) ~= 'table' then
        return
      end

      for _, job in ipairs(jobs) do
        local success, err = applyFine(job)
        if success then
          request('POST', ('/api/integration/fivem/fine-jobs/%s/sent'):format(tostring(job.id)), {}, function() end)
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
