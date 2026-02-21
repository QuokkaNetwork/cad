  local capturedY1 = tonumber(point1.y) or 0.0
  local capturedX2 = tonumber(point2.x) or 0.0
  local capturedY2 = tonumber(point2.y) or 0.0

  -- Use the configured auto points as reference anchors and solve map bounds from
  -- their relative location on the full GTA map. This avoids treating sampled points
  -- as literal map corners, which caused severe drift/off-map markers.
  local referencePoint1 = type(Config.LiveMapCalibrationAutoPoint1) == 'table' and Config.LiveMapCalibrationAutoPoint1 or nil
  local referencePoint2 = type(Config.LiveMapCalibrationAutoPoint2) == 'table' and Config.LiveMapCalibrationAutoPoint2 or nil

  local defaultWidth = DEFAULT_GAME_BOUNDS.x2 - DEFAULT_GAME_BOUNDS.x1
  local defaultHeight = DEFAULT_GAME_BOUNDS.y1 - DEFAULT_GAME_BOUNDS.y2
  local solvedByReference = false
  local x1 = 0.0
  local x2 = 0.0
  local y1 = 0.0
  local y2 = 0.0

  if referencePoint1 and referencePoint2 and defaultWidth > 0.0 and defaultHeight > 0.0 then
    local refX1 = tonumber(referencePoint1.x) or 0.0
    local refY1 = tonumber(referencePoint1.y) or 0.0
    local refX2 = tonumber(referencePoint2.x) or 0.0
    local refY2 = tonumber(referencePoint2.y) or 0.0

    local u1 = (refX1 - DEFAULT_GAME_BOUNDS.x1) / defaultWidth
    local u2 = (refX2 - DEFAULT_GAME_BOUNDS.x1) / defaultWidth
    local v1 = (DEFAULT_GAME_BOUNDS.y1 - refY1) / defaultHeight
    local v2 = (DEFAULT_GAME_BOUNDS.y1 - refY2) / defaultHeight

    local du = u2 - u1
    local dv = v2 - v1
    if math.abs(du) > 0.0001 and math.abs(dv) > 0.0001 then
      local solvedWidth = (capturedX2 - capturedX1) / du
      local solvedHeight = (capturedY1 - capturedY2) / dv
      if solvedWidth > 500.0 and solvedHeight > 500.0 then
        x1 = capturedX1 - (u1 * solvedWidth)
        x2 = x1 + solvedWidth
        y1 = capturedY1 + (v1 * solvedHeight)
        y2 = y1 - solvedHeight
        solvedByReference = true
      end
    end
  end

  if not solvedByReference then
    -- Fallback to legacy corner-mode if reference solving cannot run.
    x1 = math.min(capturedX1, capturedX2)
    x2 = math.max(capturedX1, capturedX2)
    y1 = math.max(capturedY1, capturedY2)
    y2 = math.min(capturedY1, capturedY2)
  end

  local padding = normalizeFiniteNumber(payload.padding, Config.LiveMapCalibrationPadding or 250.0)
  if padding < 0.0 then padding = 0.0 end
  if padding > 2000.0 then padding = 2000.0 end

  if not solvedByReference then
    x1 = x1 - padding
    x2 = x2 + padding
    y1 = y1 + padding
    y2 = y2 - padding
  end

  if (x2 - x1) < 500.0 or (y1 - y2) < 500.0 then
    notifyCalibration('Calibration area is too small. Move further apart before saving.', 'error')
    return
  end

  request('POST', '/api/integration/fivem/live-map/calibration', {
    map_game_x1 = x1,
    map_game_y1 = y1,
    map_game_x2 = x2,
    map_game_y2 = y2,
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
  local timeoutMs = math.max(10000, math.floor((tonumber(Config.HeartbeatIntervalMs) or 500) * 8))
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
    Wait(math.max(250, tonumber(Config.HeartbeatIntervalMs) or 500))
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
          local platformName = trim(GetPlayerName(s) or '')
          local characterName = getCharacterDisplayName(s)
          local displayName = platformName ~= '' and platformName or characterName
