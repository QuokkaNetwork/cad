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

CreateThread(function()
  while true do
    Wait(math.max(2000, Config.JobSyncPollIntervalMs))
    if not hasBridgeConfig() then
      goto continue
    end

    request('GET', '/api/integration/fivem/job-jobs?limit=25', nil, function(status, body)
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

  local payload = {
    id = tostring(job.id or ''),
    call_id = tonumber(job.call_id) or 0,
    call_title = tostring(job.call_title or ''),
    location = tostring(job.location or ''),
    postal = tostring(job.postal or ''),
  }

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

  TriggerClientEvent('cad_bridge:setCallRoute', sourceId, payload)
  return true, '', false
end

CreateThread(function()
  while true do
    Wait(math.max(2000, Config.RoutePollIntervalMs))
    if not hasBridgeConfig() then
      goto continue
    end

    request('GET', '/api/integration/fivem/route-jobs?limit=25', nil, function(status, body)
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

    if GetResourceState('ox_lib') == 'started' then
      TriggerClientEvent('ox_lib:notify', sourceId, {
        title = 'CAD Fine Issued',
        description = message,
        type = 'error',
      })
      return
    end
    notifyPlayer(sourceId, message)
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

          local afterBalance = getAfterBalance()
          local deducted = hasExpectedDeduction(beforeBalance, afterBalance, amount)
          if deducted == true then
            recordAttempt(label)
            return true
          end

          if result == false then
            recordAttempt(label, 'returned false')
            return false
          end
          if deducted == false then
            recordAttempt(label, ('no deduction verified (result=%s)'):format(tostring(result)))
            return false
          end

          -- Some framework adapters do not return a status; accept on no-error when balance cannot be verified.
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
          local afterBalance = getPlayerMoneyBalance(player, account)
          local deducted = hasExpectedDeduction(beforeBalance, afterBalance, amount)
          if removed == nil and deducted ~= true then
            return false, 'qb-core RemoveMoney returned no status and deduction could not be verified', false
          end
          if removed == true and deducted == false then
            return false, 'qb-core reported success but balance did not decrease', false
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
