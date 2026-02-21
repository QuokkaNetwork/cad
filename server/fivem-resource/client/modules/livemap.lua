local util = CadBridge and CadBridge.util or {}
local notify = CadBridge and CadBridge.notify or {}

local function trim(value)
  if type(util.trim) == 'function' then
    return util.trim(value)
  end
  if value == nil then return '' end
  return (tostring(value):gsub('^%s+', ''):gsub('%s+$', ''))
end

RegisterNetEvent('cad_bridge:setCallRoute', function(route)
  if type(route) ~= 'table' then return end
  local action = tostring(route.action or ''):lower()
  local clearWaypoint = action == 'clear' or route.clear_waypoint == true or tonumber(route.clear_waypoint or 0) == 1

  if clearWaypoint then
    SetWaypointOff()
    if type(notify.routeCleared) == 'function' then
      notify.routeCleared(route)
    end
    return
  end

  local coords = nil
  if type(util.parseCoords) == 'function' then
    coords = util.parseCoords(route.position)
  end
  if not coords and type(util.getPostalCoords) == 'function' then
    coords = util.getPostalCoords(route.postal)
  end

  if coords and tonumber(coords.x) and tonumber(coords.y) then
    SetNewWaypoint(coords.x + 0.0, coords.y + 0.0)
    if type(notify.route) == 'function' then
      notify.route(route, true)
    end
    return
  end

  if type(notify.route) == 'function' then
    notify.route(route, false)
  end
end)

RegisterNetEvent('cad_bridge:notifyFine', function(payload)
  if type(notify.fine) == 'function' then
    notify.fine(payload)
  end
end)

RegisterNetEvent('cad_bridge:notifyAlert', function(payload)
  if type(notify.alert) == 'function' then
    notify.alert(payload)
  end
end)

local LIVE_MAP_CALIBRATION_ENABLED = Config.LiveMapCalibrationEnabled == true
local LIVE_MAP_CALIBRATION_COMMAND = trim(Config.LiveMapCalibrationCommand or 'calibrate')
if LIVE_MAP_CALIBRATION_COMMAND == '' then LIVE_MAP_CALIBRATION_COMMAND = 'calibrate' end
local liveMapCalibrationPointA = nil
local liveMapCalibrationPointB = nil

local function notifyLiveMapCalibration(message, notifyType)
  local title = 'Live Map Calibration'
  local description = tostring(message or '')
  local nType = trim(notifyType or '')
  if nType == '' then nType = 'inform' end

  if type(util.triggerCadOxNotify) == 'function' and util.triggerCadOxNotify({
    title = title,
    description = description,
    type = nType,
  }) then
    return
  end

  if GetResourceState('chat') == 'started' then
    TriggerEvent('chat:addMessage', {
      color = { 0, 170, 255 },
      args = { 'CAD', description ~= '' and description or title },
    })
  end
end

local function getCalibrationPointFromPlayer()
  local ped = PlayerPedId()
  if not ped or ped == 0 then return nil end
  local coords = GetEntityCoords(ped)
  if not coords then return nil end
  return {
    x = tonumber(coords.x) or 0.0,
    y = tonumber(coords.y) or 0.0,
    z = tonumber(coords.z) or 0.0,
  }
end

local function formatCalibrationPoint(point)
  if type(point) ~= 'table' then return 'unset' end
  return ('x=%.2f y=%.2f z=%.2f'):format(
    tonumber(point.x) or 0.0,
    tonumber(point.y) or 0.0,
    tonumber(point.z) or 0.0
  )
end

local function resolveGroundZQuick(x, y, fallbackZ)
  local baseZ = tonumber(fallbackZ) or 0.0
  local probes = {
    baseZ + 2.0,
    baseZ + 8.0,
    baseZ + 25.0,
    baseZ + 60.0,
    baseZ + 120.0,
  }
  for _, probeZ in ipairs(probes) do
    local foundGround, groundZ = GetGroundZFor_3dCoord((tonumber(x) or 0.0) + 0.0, (tonumber(y) or 0.0) + 0.0, probeZ + 0.0, false)
    if foundGround and type(groundZ) == 'number' then
      return groundZ
    end
    local foundWaterGround, waterGroundZ = GetGroundZFor_3dCoord((tonumber(x) or 0.0) + 0.0, (tonumber(y) or 0.0) + 0.0, probeZ + 0.0, true)
    if foundWaterGround and type(waterGroundZ) == 'number' then
      return waterGroundZ
    end
  end
  return baseZ
end

local function setCalibrationEntityFreezeState(enabled)
  local ped = PlayerPedId()
  if not ped or ped == 0 then return end
  local shouldFreeze = enabled == true
  FreezeEntityPosition(ped, shouldFreeze)
  if IsPedInAnyVehicle(ped, false) then
    local vehicle = GetVehiclePedIsIn(ped, false)
    if vehicle and vehicle ~= 0 and GetPedInVehicleSeat(vehicle, -1) == ped then
      FreezeEntityPosition(vehicle, shouldFreeze)
    end
  end
end

local function teleportCalibrationPoint(point)
  if type(point) ~= 'table' then return false end
  local ped = PlayerPedId()
  if not ped or ped == 0 then return false end

  local x = tonumber(point.x) or 0.0
  local y = tonumber(point.y) or 0.0
  local zHint = tonumber(point.z) or 0.0
  local z = resolveGroundZQuick(x, y, zHint) + 1.0
  local heading = GetEntityHeading(ped)

  DoScreenFadeOut(250)
  while not IsScreenFadedOut() do Wait(0) end

  RequestCollisionAtCoord(x + 0.0, y + 0.0, z + 0.0)
  local entity = ped
  if IsPedInAnyVehicle(ped, false) then
    local vehicle = GetVehiclePedIsIn(ped, false)
    if vehicle and vehicle ~= 0 and GetPedInVehicleSeat(vehicle, -1) == ped then
      entity = vehicle
    end
  end

  SetEntityCoordsNoOffset(entity, x + 0.0, y + 0.0, z + 0.0, false, false, false)
  SetEntityHeading(entity, heading + 0.0)
  Wait(350)

  DoScreenFadeIn(250)
  return true
end

local function runAutoLiveMapCalibration()
  local point1 = type(Config.LiveMapCalibrationAutoPoint1) == 'table' and Config.LiveMapCalibrationAutoPoint1 or nil
  local point2 = type(Config.LiveMapCalibrationAutoPoint2) == 'table' and Config.LiveMapCalibrationAutoPoint2 or nil
  if not point1 or not point2 then
    notifyLiveMapCalibration('Auto calibration points are not configured.', 'error')
    return
  end

  local delayMs = tonumber(Config.LiveMapCalibrationAutoTeleportDelayMs or 1200) or 1200
  if delayMs < 400 then delayMs = 400 end

  local ped = PlayerPedId()
  local returnEntity = ped
  if IsPedInAnyVehicle(ped, false) then
    local currentVehicle = GetVehiclePedIsIn(ped, false)
    if currentVehicle and currentVehicle ~= 0 and GetPedInVehicleSeat(currentVehicle, -1) == ped then
      returnEntity = currentVehicle
    end
  end
  local returnCoords = GetEntityCoords(returnEntity)
  local returnHeading = GetEntityHeading(returnEntity)

  local function teleportBackToStart()
    if not returnEntity or returnEntity == 0 or not DoesEntityExist(returnEntity) then return end
    local rx = tonumber(returnCoords and returnCoords.x) or 0.0
    local ry = tonumber(returnCoords and returnCoords.y) or 0.0
    local rz = tonumber(returnCoords and returnCoords.z) or 0.0
    DoScreenFadeOut(200)
    while not IsScreenFadedOut() do Wait(0) end
    RequestCollisionAtCoord(rx + 0.0, ry + 0.0, rz + 0.0)
    SetEntityCoordsNoOffset(returnEntity, rx + 0.0, ry + 0.0, rz + 0.0, false, false, false)
    SetEntityHeading(returnEntity, (tonumber(returnHeading) or 0.0) + 0.0)
    Wait(250)
    DoScreenFadeIn(200)
  end

  local function abortAutoCalibration(message)
    teleportBackToStart()
    setCalibrationEntityFreezeState(false)
    notifyLiveMapCalibration(tostring(message or 'Auto calibration failed.'), 'error')
  end

  setCalibrationEntityFreezeState(true)
  notifyLiveMapCalibration('Auto calibration started. Teleporting to point 1...')
  if not teleportCalibrationPoint(point1) then
    abortAutoCalibration('Failed to teleport to point 1.')
    return
  end
  Wait(delayMs)
  liveMapCalibrationPointA = getCalibrationPointFromPlayer()
  if type(liveMapCalibrationPointA) ~= 'table' then
    abortAutoCalibration('Failed to capture point 1.')
    return
  end
  notifyLiveMapCalibration('Point 1 captured: ' .. formatCalibrationPoint(liveMapCalibrationPointA))

  notifyLiveMapCalibration('Teleporting to point 2...')
  if not teleportCalibrationPoint(point2) then
    abortAutoCalibration('Failed to teleport to point 2.')
    return
  end
  Wait(delayMs)
  liveMapCalibrationPointB = getCalibrationPointFromPlayer()
  if type(liveMapCalibrationPointB) ~= 'table' then
    abortAutoCalibration('Failed to capture point 2.')
    return
  end
  notifyLiveMapCalibration('Point 2 captured: ' .. formatCalibrationPoint(liveMapCalibrationPointB))

  TriggerServerEvent('cad_bridge:saveLiveMapCalibration', {
    point1 = liveMapCalibrationPointA,
    point2 = liveMapCalibrationPointB,
    padding = tonumber(Config.LiveMapCalibrationPadding or 250.0) or 250.0,
  })
  teleportBackToStart()
  setCalibrationEntityFreezeState(false)
  notifyLiveMapCalibration('Auto calibration submitted.')
end

if LIVE_MAP_CALIBRATION_ENABLED then
  RegisterCommand(LIVE_MAP_CALIBRATION_COMMAND, function(_source, args)
    local action = trim(args and args[1] or ''):lower()
    if action == '' or action == 'help' then
      notifyLiveMapCalibration(('Usage: /%s start | auto | manual | point1 | point2 | status | save | reset | cancel'):format(LIVE_MAP_CALIBRATION_COMMAND))
      return
    end

    if action == 'start' then
      liveMapCalibrationPointA = nil
      liveMapCalibrationPointB = nil
      CreateThread(function()
        runAutoLiveMapCalibration()
      end)
      return
    end

    if action == 'manual' then
      liveMapCalibrationPointA = nil
      liveMapCalibrationPointB = nil
      notifyLiveMapCalibration('Manual calibration started. Move to first reference point and use /' .. LIVE_MAP_CALIBRATION_COMMAND .. ' point1')
      return
    end

    if action == 'point1' or action == 'p1' or action == 'a' then
      local point = getCalibrationPointFromPlayer()
      if not point then
        notifyLiveMapCalibration('Unable to capture point 1.', 'error')
        return
      end
      liveMapCalibrationPointA = point
      notifyLiveMapCalibration('Point 1 captured: ' .. formatCalibrationPoint(point))
      return
    end

    if action == 'point2' or action == 'p2' or action == 'b' then
      local point = getCalibrationPointFromPlayer()
      if not point then
        notifyLiveMapCalibration('Unable to capture point 2.', 'error')
        return
      end
      liveMapCalibrationPointB = point
      notifyLiveMapCalibration('Point 2 captured: ' .. formatCalibrationPoint(point))
      return
    end

    if action == 'status' then
      notifyLiveMapCalibration(('Point 1: %s | Point 2: %s'):format(
        formatCalibrationPoint(liveMapCalibrationPointA),
        formatCalibrationPoint(liveMapCalibrationPointB)
      ))
      return
    end

    if action == 'cancel' then
      liveMapCalibrationPointA = nil
      liveMapCalibrationPointB = nil
      notifyLiveMapCalibration('Calibration cancelled.')
      return
    end

    if action == 'reset' then
      liveMapCalibrationPointA = nil
      liveMapCalibrationPointB = nil
      TriggerServerEvent('cad_bridge:saveLiveMapCalibration', { reset = true })
      notifyLiveMapCalibration('Calibration reset submitted. Default GTA bounds will be restored if authorised.')
      return
    end

    if action == 'save' then
      if type(liveMapCalibrationPointA) ~= 'table' or type(liveMapCalibrationPointB) ~= 'table' then
        notifyLiveMapCalibration('Capture point1 and point2 before saving.', 'error')
        return
      end
      TriggerServerEvent('cad_bridge:saveLiveMapCalibration', {
        point1 = liveMapCalibrationPointA,
        point2 = liveMapCalibrationPointB,
        padding = tonumber(Config.LiveMapCalibrationPadding or 250.0) or 250.0,
      })
      notifyLiveMapCalibration('Calibration submitted to server. If authorised, map bounds will be updated.')
      return
    end

    if action == 'auto' then
      CreateThread(function()
        runAutoLiveMapCalibration()
      end)
      return
    end

    notifyLiveMapCalibration(('Unknown action: %s. Use /%s help'):format(action, LIVE_MAP_CALIBRATION_COMMAND), 'error')
  end, false)
end
