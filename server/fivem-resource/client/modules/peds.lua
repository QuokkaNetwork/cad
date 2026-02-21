local util = CadBridge and CadBridge.util or {}
local ui = CadBridge and CadBridge.ui or {}
local state = CadBridge and CadBridge.state or {}

local function trim(value)
  if type(util.trim) == 'function' then
    return util.trim(value)
  end
  if value == nil then return '' end
  return (tostring(value):gsub('^%s+', ''):gsub('%s+$', ''))
end

local documentInteractionDistance = tonumber(Config.DocumentPedInteractionDistance or 2.2) or 2.2
if documentInteractionDistance < 1.0 then documentInteractionDistance = 1.0 end
local documentPromptDistance = tonumber(Config.DocumentPedPromptDistance or 12.0) or 12.0
if documentPromptDistance < documentInteractionDistance then
  documentPromptDistance = documentInteractionDistance + 2.0
end

local documentPeds = {}
local documentPedBlips = {}
local documentPedTargetEntities = {}
local useOxTargetForDocuments = GetResourceState('ox_target') == 'started'

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
  if not HasModelLoaded(modelHash) then return nil end
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
  if type(pedConfig) ~= 'table' or pedConfig.enabled == false then return end
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

  local _, groundedZ = placePedOnGroundProperly(entity, x, y, spawnZ, w)
  if type(groundedZ) == 'number' then spawnZ = groundedZ end
  local minAllowedZ = configuredZ - 0.02
  if spawnZ < minAllowedZ then
    spawnZ = configuredZ
    SetEntityCoordsNoOffset(entity, x + 0.0, y + 0.0, spawnZ, false, false, false)
    SetEntityHeading(entity, w + 0.0)
  end

  SetEntityInvincible(entity, true)
  SetBlockingOfNonTemporaryEvents(entity, true)
  SetPedCanRagdoll(entity, false)

  local scenario = trim(pedConfig.scenario or '')
  if scenario ~= '' then
    TaskStartScenarioInPlace(entity, scenario, 0, true)
    Wait(75)
    local afterScenarioCoords = GetEntityCoords(entity)
    local afterScenarioZ = tonumber(afterScenarioCoords and afterScenarioCoords.z) or spawnZ
    if afterScenarioZ < minAllowedZ then
      SetEntityCoordsNoOffset(entity, x + 0.0, y + 0.0, spawnZ, false, false, false)
      SetEntityHeading(entity, w + 0.0)
    end
  end
  FreezeEntityPosition(entity, true)

  SetModelAsNoLongerNeeded(modelHash)
  documentPeds[#documentPeds + 1] = {
    id = trim(pedConfig.id or ''),
    entity = entity,
    x = x,
    y = y,
    z = spawnZ,
    licenseLabel = trim(pedConfig.license_label or ''),
    registrationLabel = trim(pedConfig.registration_label or ''),
    allowsLicense = pedConfig.allows_license == true,
    allowsRegistration = pedConfig.allows_registration == true,
  }
end

local function deleteDocumentPeds()
  for i = 1, #documentPeds do
    local pedData = documentPeds[i]
    if type(pedData) == 'table' then
      local entity = pedData.entity
      if useOxTargetForDocuments and entity and entity ~= 0 then
        pcall(function()
          exports.ox_target:removeLocalEntity(entity)
        end)
      end
      if entity and entity ~= 0 and DoesEntityExist(entity) then
        DeletePed(entity)
      end
    end
  end
  documentPedTargetEntities = {}
  documentPeds = {}
end

local function clearDocumentPedBlips()
  for i = 1, #documentPedBlips do
    local blip = documentPedBlips[i]
    if blip and DoesBlipExist(blip) then
      RemoveBlip(blip)
    end
  end
  documentPedBlips = {}
end

local function createDocumentPedBlip(pedConfig)
  if type(pedConfig) ~= 'table' then return end
  if pedConfig.allows_registration ~= true then return end
  local coords = type(pedConfig.coords) == 'table' and pedConfig.coords or nil
  if not coords then return end
  local x = tonumber(coords.x) or 0.0
  local y = tonumber(coords.y) or 0.0
  local z = tonumber(coords.z) or 0.0

  local blip = AddBlipForCoord(x, y, z)
  SetBlipSprite(blip, 525)
  SetBlipDisplay(blip, 4)
  SetBlipScale(blip, 0.8)
  SetBlipAsShortRange(blip, true)
  SetBlipColour(blip, 5)
  BeginTextCommandSetBlipName('STRING')
  AddTextComponentString('VicRoads')
  EndTextCommandSetBlipName(blip)
  documentPedBlips[#documentPedBlips + 1] = blip
end

local function registerDocumentPedTarget(pedData)
  if not useOxTargetForDocuments then return end
  if type(pedData) ~= 'table' then return end
  local entity = pedData.entity
  if not entity or entity == 0 then return end

  local options = {}
  if pedData.allowsLicense then
    options[#options + 1] = {
      name = ('cad_bridge_license_%s'):format(trim(pedData.id or tostring(entity))),
      icon = 'fa-solid fa-id-card',
      label = 'Driver License',
      distance = documentInteractionDistance,
      onSelect = function()
        local nowMs = tonumber(GetGameTimer() or 0) or 0
        if (nowMs - tonumber(state.lastDocumentInteractAt or 0)) < 750 then return end
        state.lastDocumentInteractAt = nowMs
        TriggerServerEvent('cad_bridge:requestDriverLicensePrompt', pedData.id)
      end,
    }
  end
  if pedData.allowsRegistration then
    options[#options + 1] = {
      name = ('cad_bridge_registration_%s'):format(trim(pedData.id or tostring(entity))),
      icon = 'fa-solid fa-car',
      label = 'Registration',
      distance = documentInteractionDistance,
      onSelect = function()
        local nowMs = tonumber(GetGameTimer() or 0) or 0
        if (nowMs - tonumber(state.lastDocumentInteractAt or 0)) < 750 then return end
        state.lastDocumentInteractAt = nowMs
        TriggerServerEvent('cad_bridge:requestVehicleRegistrationPrompt', pedData.id)
      end,
    }
  end
  if #options == 0 then return end

  local ok, err = pcall(function()
    exports.ox_target:addLocalEntity(entity, options)
  end)
  if not ok then
    print(('[cad_bridge] Failed to register ox_target options for document ped %s: %s'):format(
      tostring(pedData.id or entity), tostring(err)
    ))
    return
  end
  documentPedTargetEntities[#documentPedTargetEntities + 1] = entity
end

local function drawDocumentHelpText(label)
  BeginTextCommandDisplayHelp('STRING')
  AddTextComponentSubstringPlayerName(tostring(label or 'Press ~INPUT_CONTEXT~ to interact'))
  EndTextCommandDisplayHelp(0, false, false, -1)
end

CreateThread(function()
  Wait(1000)
  clearDocumentPedBlips()
  local interactionPeds = Config.DocumentInteractionPeds or {}
  if type(interactionPeds) ~= 'table' or #interactionPeds == 0 then
    interactionPeds = {
      {
        id = 'license',
        enabled = (Config.DriverLicensePed and Config.DriverLicensePed.enabled == true),
        model = Config.DriverLicensePed and Config.DriverLicensePed.model or '',
        coords = Config.DriverLicensePed and Config.DriverLicensePed.coords or nil,
        scenario = Config.DriverLicensePed and Config.DriverLicensePed.scenario or '',
        allows_license = true,
        allows_registration = false,
      },
      {
        id = 'registration',
        enabled = (Config.VehicleRegistrationPed and Config.VehicleRegistrationPed.enabled == true),
        model = Config.VehicleRegistrationPed and Config.VehicleRegistrationPed.model or '',
        coords = Config.VehicleRegistrationPed and Config.VehicleRegistrationPed.coords or nil,
        scenario = Config.VehicleRegistrationPed and Config.VehicleRegistrationPed.scenario or '',
        allows_license = false,
        allows_registration = true,
      },
    }
  end

  for _, pedConfig in ipairs(interactionPeds) do
    spawnDocumentPed(pedConfig)
    createDocumentPedBlip(pedConfig)
    if #documentPeds > 0 then
      registerDocumentPedTarget(documentPeds[#documentPeds])
    end
  end
end)

CreateThread(function()
  if useOxTargetForDocuments then
    return
  end

  while true do
    local waitMs = 500
    local playerPed = PlayerPedId()
    if playerPed and playerPed ~= 0 then
      local playerCoords = GetEntityCoords(playerPed)
      for _, pedData in ipairs(documentPeds) do
        local entity = pedData and pedData.entity or 0
        if entity ~= 0 and DoesEntityExist(entity) then
          local dx = (tonumber(playerCoords.x) or 0.0) - (tonumber(pedData.x) or 0.0)
          local dy = (tonumber(playerCoords.y) or 0.0) - (tonumber(pedData.y) or 0.0)
          local dz = (tonumber(playerCoords.z) or 0.0) - (tonumber(pedData.z) or 0.0)
          local distance = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
          if distance <= documentPromptDistance then
            waitMs = 0
            local promptText = ''
            if pedData.allowsLicense and pedData.allowsRegistration then
              promptText = 'Press ~INPUT_CONTEXT~ for licence quiz | Press ~INPUT_DETONATE~ for rego'
            elseif pedData.allowsLicense then
              promptText = pedData.licenseLabel ~= '' and pedData.licenseLabel or 'Press ~INPUT_CONTEXT~ for licence quiz'
            elseif pedData.allowsRegistration then
              promptText = pedData.registrationLabel ~= '' and pedData.registrationLabel or 'Press ~INPUT_CONTEXT~ for rego'
            else
              promptText = 'Document desk unavailable'
            end
            drawDocumentHelpText(promptText)

            if distance <= documentInteractionDistance and (IsControlJustPressed(0, 38) or IsControlJustPressed(0, 47)) then
              local nowMs = tonumber(GetGameTimer() or 0) or 0
              if (nowMs - tonumber(state.lastDocumentInteractAt or 0)) >= 1000 then
                state.lastDocumentInteractAt = nowMs
                local useLicense = IsControlJustPressed(0, 38)
                local useRegistration = IsControlJustPressed(0, 47)
                if pedData.allowsLicense and pedData.allowsRegistration then
                  if useRegistration then
                    TriggerServerEvent('cad_bridge:requestVehicleRegistrationPrompt', pedData.id)
                  else
                    TriggerServerEvent('cad_bridge:requestDriverLicensePrompt', pedData.id)
                  end
                elseif pedData.allowsLicense and useLicense then
                  TriggerServerEvent('cad_bridge:requestDriverLicensePrompt', pedData.id)
                elseif pedData.allowsRegistration and useLicense then
                  TriggerServerEvent('cad_bridge:requestVehicleRegistrationPrompt', pedData.id)
                end
              end
            end
          end
        end
      end
    end
    Wait(waitMs)
  end
end)

AddEventHandler('onResourceStop', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  clearDocumentPedBlips()
  deleteDocumentPeds()
end)

CreateThread(function()
  while true do
    Wait(math.max(250, tonumber(Config.HeartbeatIntervalMs) or 500))

    local ped = PlayerPedId()
    if ped and ped ~= 0 then
      local coords = GetEntityCoords(ped)
      local heading = GetEntityHeading(ped)
      local speed = GetEntitySpeed(ped)
      local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
      local postal = type(util.getNearestPostal) == 'function' and util.getNearestPostal() or ''
      local street, crossing = '', ''
      if streetHash and streetHash ~= 0 then
        street = GetStreetNameFromHashKey(streetHash) or ''
      end
      if crossingHash and crossingHash ~= 0 then
        crossing = GetStreetNameFromHashKey(crossingHash) or ''
      end
      local vehicleSnapshot = type(util.getVehicleSnapshot) == 'function' and util.getVehicleSnapshot(ped) or {
        vehicle = '',
        license_plate = '',
        has_siren_enabled = false,
        icon = 6,
      }
      local weapon = type(util.getWeaponName) == 'function' and util.getWeaponName(ped) or ''
      local location = type(util.buildLocationText) == 'function'
        and util.buildLocationText(street, crossing, postal, coords)
        or tostring(street or '')
      TriggerServerEvent('cad_bridge:clientPosition', {
        x = coords.x,
        y = coords.y,
        z = coords.z,
        heading = heading,
        speed = speed,
        street = street,
        crossing = crossing,
        postal = postal,
        location = location,
        vehicle = vehicleSnapshot.vehicle,
        license_plate = vehicleSnapshot.license_plate,
        has_siren_enabled = vehicleSnapshot.has_siren_enabled,
        icon = vehicleSnapshot.icon,
        weapon = weapon,
      })
    end
  end
end)
