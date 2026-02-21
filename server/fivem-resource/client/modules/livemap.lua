  local nType = trim(notifyType or '')
  if nType == '' then nType = 'inform' end

  if triggerCadOxNotify({
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

RegisterCommand(SHOW_ID_COMMAND, function()
  requestShowIdCard()
end, false)

RegisterCommand('cadbridgecloseid', function()
  closeShownIdCard()
end, false)

RegisterCommand('cadbridgeidtoggle', function()
  if idCardUiOpen then
    closeShownIdCard()
    return
  end
  requestShowIdCard()
end, false)

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
      TriggerServerEvent('cad_bridge:saveLiveMapCalibration', {
        reset = true,
      })
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

RegisterKeyMapping('cadbridgeidtoggle', 'Show or hide your ID card', 'keyboard', SHOW_ID_KEY)

-- Test command to verify UI works without server
RegisterCommand('test000ui', function()
  print('[cad_bridge] Testing 000 UI with mock data')
  openEmergencyPopup({
    {id = 1, name = 'Police Department', short_name = 'LSPD', color = '#3b82f6'},
    {id = 2, name = 'Fire Department', short_name = 'LSFD', color = '#ef4444'},
    {id = 3, name = 'Emergency Medical Services', short_name = 'EMS', color = '#10b981'},
  })
end, false)

local function loadPedModel(modelName)
  local modelHash = modelName
  if type(modelName) ~= 'number' then
    modelHash = GetHashKey(tostring(modelName or ''))
  end
  if not modelHash or modelHash == 0 or not IsModelInCdimage(modelHash) or not IsModelValid(modelHash) then
    return nil
  end
  RequestModel(modelHash)
  local waited = 0
  while not HasModelLoaded(modelHash) and waited < 5000 do
    Wait(25)
    waited = waited + 25
  end
  if not HasModelLoaded(modelHash) then
    return nil
  end
  return modelHash
end

local function resolveGroundZForPed(x, y, fallbackZ)
  local baseZ = tonumber(fallbackZ) or 0.0
  local probes = {
    baseZ + 1.0,
    baseZ + 4.0,
    baseZ + 10.0,
    baseZ + 25.0,
    baseZ + 50.0,
    baseZ + 100.0,
  }

  for _, probeZ in ipairs(probes) do
    local foundGround, groundZ = GetGroundZFor_3dCoord(x + 0.0, y + 0.0, probeZ + 0.0, false)
    if foundGround and type(groundZ) == 'number' then
      return groundZ
    end
  end

  return baseZ
end

local function requestPedSpawnCollision(x, y, z, timeoutMs)
  local px = (tonumber(x) or 0.0) + 0.0
  local py = (tonumber(y) or 0.0) + 0.0
  local pz = (tonumber(z) or 0.0) + 0.0
  local deadline = (tonumber(GetGameTimer() or 0) or 0) + math.max(250, math.floor(tonumber(timeoutMs) or 1500))
  repeat
    RequestCollisionAtCoord(px, py, pz)
    Wait(0)
  until (tonumber(GetGameTimer() or 0) or 0) >= deadline
end

local function placePedOnGroundProperly(entity, x, y, z, heading)
  if not entity or entity == 0 or not DoesEntityExist(entity) then
    return false, tonumber(z) or 0.0
  end

  local px = (tonumber(x) or 0.0) + 0.0
  local py = (tonumber(y) or 0.0) + 0.0
  local pz = (tonumber(z) or 0.0) + 0.0
  local h = (tonumber(heading) or 0.0) + 0.0

  SetEntityCoordsNoOffset(entity, px, py, pz + 1.0, false, false, false)
  SetEntityHeading(entity, h)
  requestPedSpawnCollision(px, py, pz, 1800)

  local deadline = (tonumber(GetGameTimer() or 0) or 0) + 2000
  while (tonumber(GetGameTimer() or 0) or 0) < deadline do
    if HasCollisionLoadedAroundEntity(entity) then break end
    RequestCollisionAtCoord(px, py, pz)
    Wait(0)
  end

  local placed = false
  for _ = 1, 3 do
    if type(PlaceEntityOnGroundProperly) == 'function' then
      local ok, result = pcall(function()
        return PlaceEntityOnGroundProperly(entity)
      end)
      placed = ok and (result == nil or result == true)
    end
    if not placed and type(SetPedOnGroundProperly) == 'function' then
      local ok, result = pcall(function()
        return SetPedOnGroundProperly(entity)
      end)
      placed = ok and (result == nil or result == true)
    end
    if placed then break end
    Wait(50)
  end

  local settledGroundZ = resolveGroundZForPed(px, py, pz)
  local entityCoords = GetEntityCoords(entity)
  local finalZ = tonumber(entityCoords and entityCoords.z) or settledGroundZ
  if (not placed) or finalZ < (settledGroundZ - 0.2) then
    finalZ = settledGroundZ + 0.08
    SetEntityCoordsNoOffset(entity, px, py, finalZ, false, false, false)
  end
  SetEntityHeading(entity, h)

  return placed, finalZ
end

local function spawnDocumentPed(pedConfig)
  if type(pedConfig) ~= 'table' or pedConfig.enabled == false then
    return
  end
  local coords = type(pedConfig.coords) == 'table' and pedConfig.coords or nil
  if not coords then return end
  local x = tonumber(coords.x) or 0.0
  local y = tonumber(coords.y) or 0.0
  local z = tonumber(coords.z) or 0.0
  local w = tonumber(coords.w) or 0.0
  requestPedSpawnCollision(x, y, z, 1800)
  local configuredZ = z + 0.0
  local spawnZ = configuredZ

  local modelHash = loadPedModel(pedConfig.model or '')
  if not modelHash then
    print(('[cad_bridge] Failed to load document ped model: %s'):format(tostring(pedConfig.model or '')))
    return
  end

  local entity = CreatePed(4, modelHash, x, y, spawnZ + 1.0, w, false, true)
  if not entity or entity == 0 or not DoesEntityExist(entity) then
    print(('[cad_bridge] Failed to create document ped for id=%s'):format(tostring(pedConfig.id or 'unknown')))
    SetModelAsNoLongerNeeded(modelHash)
    return
  end
  SetEntityAsMissionEntity(entity, true, true)
