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

local function getSteamIdentifier(src)
  local identifiers = GetPlayerIdentifiers(src)
  for _, identifier in ipairs(identifiers) do
    if identifier:sub(1, 6) == 'steam:' then
      return identifier
    end
  end
  return nil
end

local function getCitizenId(src)
  if GetResourceState('qbx_core') == 'started' and exports.qbx_core and exports.qbx_core.GetPlayer then
    local xPlayer = exports.qbx_core:GetPlayer(src)
    if xPlayer and xPlayer.PlayerData and xPlayer.PlayerData.citizenid then
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
        local steam = getSteamIdentifier(s)
        if Config.PublishAllPlayers or steam then
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

local function applyFine(job)
  if Config.FineAdapter == 'none' then
    return false, 'Fine adapter disabled (Config.FineAdapter=none)'
  end

  if Config.FineAdapter == 'command' then
    local cmd = tostring(Config.FineCommandTemplate or '')
    if cmd == '' then
      return false, 'Fine command template is empty'
    end

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
