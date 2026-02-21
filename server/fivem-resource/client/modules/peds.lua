  local _, groundedZ = placePedOnGroundProperly(entity, x, y, spawnZ, w)
  if type(groundedZ) == 'number' then
    spawnZ = groundedZ
  end
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
        if (nowMs - lastDocumentInteractAt) < 750 then return end
        lastDocumentInteractAt = nowMs
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
        if (nowMs - lastDocumentInteractAt) < 750 then return end
        lastDocumentInteractAt = nowMs
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
      tostring(pedData.id or entity),
      tostring(err)
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
      }
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
              if (nowMs - lastDocumentInteractAt) >= 1000 then
                lastDocumentInteractAt = nowMs
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
  if idCardUiOpen then
    closeShownIdCard()
  end
  if emergencyUiOpen or driverLicenseUiOpen or vehicleRegistrationUiOpen then
    SetNuiFocus(false, false)
  end
end)

CreateThread(function()
  while true do
    if hasAnyCadBridgeModalOpen() then
      Wait(0)

      if IsControlJustPressed(0, 200) or IsControlJustPressed(0, 202) or IsControlJustPressed(0, 177) then
        closeEmergencyPopup()
        closeDriverLicensePopup()
        closeVehicleRegistrationPopup()
      end

      if emergencyUiAwaitingOpenAck and emergencyUiOpenedAtMs > 0 then
        local nowMs = tonumber(GetGameTimer() or 0) or 0
        if (nowMs - emergencyUiOpenedAtMs) > 2500 then
          closeEmergencyPopup()
          notifyEmergencyUiIssue('000 UI failed to initialize. Focus was released.')
        end
      end
    else
      Wait(250)
    end
  end
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
      local postal = getNearestPostal()
      local street = ''
      local crossing = ''
      if streetHash and streetHash ~= 0 then
        street = GetStreetNameFromHashKey(streetHash) or ''
      end
      if crossingHash and crossingHash ~= 0 then
        crossing = GetStreetNameFromHashKey(crossingHash) or ''
      end
      local vehicleSnapshot = getVehicleSnapshot(ped)
      local weapon = getWeaponName(ped)
      local location = buildLocationText(street, crossing, postal, coords)
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
