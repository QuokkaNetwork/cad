  [51] = 'Sea Green',
  [52] = 'Olive Green',
  [53] = 'Bright Green',
  [54] = 'Gasoline Green',
  [55] = 'Matte Lime Green',
  [61] = 'Galaxy Blue',
  [62] = 'Dark Blue',
  [63] = 'Saxon Blue',
  [64] = 'Blue',
  [65] = 'Mariner Blue',
  [66] = 'Harbor Blue',
  [67] = 'Diamond Blue',
  [68] = 'Surf Blue',
  [69] = 'Nautical Blue',
  [70] = 'Ultra Blue',
  [71] = 'Schafter Purple',
  [72] = 'Spinnaker Purple',
  [73] = 'Racing Blue',
  [74] = 'Light Blue',
  [82] = 'Matte Dark Blue',
  [83] = 'Matte Blue',
  [84] = 'Matte Midnight Blue',
  [88] = 'Yellow',
  [89] = 'Race Yellow',
  [90] = 'Bronze',
  [91] = 'Dew Yellow',
  [92] = 'Lime Green',
  [94] = 'Feltzer Brown',
  [95] = 'Creek Brown',
  [96] = 'Chocolate Brown',
  [97] = 'Maple Brown',
  [98] = 'Saddle Brown',
  [99] = 'Straw Brown',
  [100] = 'Moss Brown',
  [101] = 'Bison Brown',
  [102] = 'Woodbeech Brown',
  [103] = 'Beechwood Brown',
  [104] = 'Sienna Brown',
  [105] = 'Sandy Brown',
  [106] = 'Bleached Brown',
  [107] = 'Cream',
  [111] = 'Ice White',
  [112] = 'Frost White',
  [117] = 'Brushed Steel',
  [118] = 'Brushed Black Steel',
  [119] = 'Brushed Aluminum',
  [128] = 'Matte Green',
  [131] = 'Matte Ice White',
  [135] = 'Hot Pink',
  [136] = 'Salmon Pink',
  [137] = 'Pfister Pink',
  [138] = 'Bright Orange',
  [141] = 'Midnight Blue',
  [142] = 'Midnight Purple',
  [143] = 'Wine Red',
  [145] = 'Bright Purple',
  [147] = 'Carbon Black',
  [148] = 'Matte Schafter Purple',
  [149] = 'Matte Midnight Purple',
  [150] = 'Lava Red',
  [151] = 'Matte Frost Green',
  [152] = 'Matte Olive Drab',
  [154] = 'Matte Desert Tan',
  [155] = 'Matte Dark Earth',
  [158] = 'Pure Gold',
  [159] = 'Brushed Gold',
}

local function resolveVehicleColourName(index)
  local id = tonumber(index)
  if id == nil then return 'Unknown' end
  id = math.floor(id)
  if GTA_COLOUR_NAME_OVERRIDES[id] then
    return GTA_COLOUR_NAME_OVERRIDES[id]
  end
  return GTA_COLOUR_NAMES[id] or ('Colour %s'):format(tostring(id))
end

local function getVehicleCustomColourLabel(vehicle, primary)
  local hasCustom = false
  if primary then
    if type(GetIsVehiclePrimaryColourCustom) == 'function' then
      hasCustom = GetIsVehiclePrimaryColourCustom(vehicle) == true
    end
  else
    if type(GetIsVehicleSecondaryColourCustom) == 'function' then
      hasCustom = GetIsVehicleSecondaryColourCustom(vehicle) == true
    end
  end
  if not hasCustom then return '' end

  local r, g, b = nil, nil, nil
  if primary then
    if type(GetVehicleCustomPrimaryColour) == 'function' then
      r, g, b = GetVehicleCustomPrimaryColour(vehicle)
    end
  else
    if type(GetVehicleCustomSecondaryColour) == 'function' then
      r, g, b = GetVehicleCustomSecondaryColour(vehicle)
    end
  end

  if r and g and b then
    return ('Custom (%d, %d, %d)'):format(tonumber(r) or 0, tonumber(g) or 0, tonumber(b) or 0)
  end
  return 'Custom'
end

local function getVehicleColourLabel(vehicle)
  local primary, secondary = GetVehicleColours(vehicle)
  local primaryLabel = getVehicleCustomColourLabel(vehicle, true)
  if primaryLabel == '' then
    primaryLabel = resolveVehicleColourName(primary)
  end

  local secondaryLabel = getVehicleCustomColourLabel(vehicle, false)
  if secondaryLabel == '' then
    secondaryLabel = resolveVehicleColourName(secondary)
  end

  if primaryLabel == secondaryLabel then
    return primaryLabel
  end
  return ('%s / %s'):format(primaryLabel, secondaryLabel)
end

local function distanceBetweenVec3(a, b)
  local av = parseCoords(a)
  local bv = parseCoords(b)
  if not av or not bv then return 999999.0 end
  local ax = tonumber(av.x) or 0.0
  local ay = tonumber(av.y) or 0.0
  local az = tonumber(av.z) or 0.0
  local bx = tonumber(bv.x) or 0.0
  local by = tonumber(bv.y) or 0.0
  local bz = tonumber(bv.z) or 0.0
  local dx = ax - bx
  local dy = ay - by
  local dz = az - bz
  return math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
end

local function distanceBetweenVec2(a, b)
  local av = parseCoords(a)
  local bv = parseCoords(b)
  if not av or not bv then return 999999.0 end
  local ax = tonumber(av.x) or 0.0
  local ay = tonumber(av.y) or 0.0
  local bx = tonumber(bv.x) or 0.0
  local by = tonumber(bv.y) or 0.0
  local dx = ax - bx
  local dy = ay - by
  return math.sqrt((dx * dx) + (dy * dy))
end

local function isVehicleUsableForRegistration(vehicle)
  if not vehicle or vehicle == 0 then return false end
  if not DoesEntityExist(vehicle) then return false end
  if not IsEntityAVehicle(vehicle) then return false end
  return true
end

local function findNearestVehicleInRadius(origin, radius)
  local resolvedOrigin = parseCoords(origin)
  local vehicles = GetGamePool('CVehicle')
  if type(vehicles) ~= 'table' or not resolvedOrigin then return 0, 999999.0 end

  local maxRadius = tonumber(radius) or 8.0
  if maxRadius < 2.0 then maxRadius = 2.0 end
  if maxRadius > 80.0 then maxRadius = 80.0 end
  local searchRadius = maxRadius + math.max(1.5, maxRadius * 0.12)
  local maxZDiff = math.max(6.0, searchRadius * 0.9)

  local bestVehicle = 0
  local bestDistance = searchRadius + 0.001
  local bestHasPlate = false
  local fallbackVehicle = 0
  local fallbackDistance = searchRadius + 0.001
  local fallbackHasPlate = false

  local function considerCandidate(vehicle, dist2d, zDiff, hasPlate)
    if dist2d <= searchRadius then
      local shouldUseFallback = false
      if fallbackVehicle == 0 then
        shouldUseFallback = true
      elseif hasPlate and not fallbackHasPlate then
        shouldUseFallback = true
      elseif hasPlate == fallbackHasPlate and dist2d < fallbackDistance then
        shouldUseFallback = true
      end
      if shouldUseFallback then
        fallbackDistance = dist2d
        fallbackVehicle = vehicle
        fallbackHasPlate = hasPlate
      end
    end

    if dist2d <= searchRadius and zDiff <= maxZDiff then
      local shouldUseBest = false
      if bestVehicle == 0 then
        shouldUseBest = true
      elseif hasPlate and not bestHasPlate then
        shouldUseBest = true
      elseif hasPlate == bestHasPlate and dist2d < bestDistance then
        shouldUseBest = true
      end
      if shouldUseBest then
        bestDistance = dist2d
        bestVehicle = vehicle
        bestHasPlate = hasPlate
      end
    end
  end

  for _, vehicle in ipairs(vehicles) do
    if isVehicleUsableForRegistration(vehicle) then
      local coords = GetEntityCoords(vehicle)
      local dist2d = distanceBetweenVec2(coords, resolvedOrigin)
      local hasPlate = trim(GetVehicleNumberPlateText(vehicle) or '') ~= ''
      local zDiff = math.abs((tonumber(coords and coords.z) or 0.0) - (tonumber(resolvedOrigin and resolvedOrigin.z) or 0.0))
      considerCandidate(vehicle, dist2d, zDiff, hasPlate)
    end
  end

  local playerPed = PlayerPedId()
  if playerPed and playerPed ~= 0 and IsPedInAnyVehicle(playerPed, false) then
    local playerVehicle = GetVehiclePedIsIn(playerPed, false)
    if isVehicleUsableForRegistration(playerVehicle) then
      local playerCoords = GetEntityCoords(playerVehicle)
      local playerDist2d = distanceBetweenVec2(playerCoords, resolvedOrigin)
      local playerZDiff = math.abs((tonumber(playerCoords and playerCoords.z) or 0.0) - (tonumber(resolvedOrigin and resolvedOrigin.z) or 0.0))
      local playerHasPlate = trim(GetVehicleNumberPlateText(playerVehicle) or '') ~= ''
      considerCandidate(playerVehicle, playerDist2d, playerZDiff, playerHasPlate)
    end
  end

  if bestVehicle == 0 and type(GetClosestVehicle) == 'function' then
    local closest = GetClosestVehicle(
      tonumber(resolvedOrigin.x) or 0.0,
      tonumber(resolvedOrigin.y) or 0.0,
      tonumber(resolvedOrigin.z) or 0.0,
      searchRadius + 5.0,
      0,
      70
    )
    if isVehicleUsableForRegistration(closest) then
      local closestCoords = GetEntityCoords(closest)
      local closestDist2d = distanceBetweenVec2(closestCoords, resolvedOrigin)
      local closestZDiff = math.abs((tonumber(closestCoords and closestCoords.z) or 0.0) - (tonumber(resolvedOrigin and resolvedOrigin.z) or 0.0))
      local closestHasPlate = trim(GetVehicleNumberPlateText(closest) or '') ~= ''
      considerCandidate(closest, closestDist2d, closestZDiff, closestHasPlate)
    end
  end

  if bestVehicle == 0 then
    bestVehicle = fallbackVehicle
    bestDistance = fallbackDistance
  end
  if bestVehicle == 0 then return 0, 999999.0 end
  return bestVehicle, bestDistance
end

local function getCurrentVehicleRegistrationDefaults(registrationParking)
  local payload = {
    plate = '',
    vehicle_model = '',
    vehicle_colour = '',
    error_message = '',
  }

  local ped = PlayerPedId()
  if not ped or ped == 0 then return payload end

  local playerCoords = GetEntityCoords(ped)
  local parking = type(registrationParking) == 'table' and registrationParking or {}
  local zoneCoords = parseCoords(parking.coords)
  local zoneRadius = tonumber(parking.radius or 0) or 0

  local searchOrigin = zoneCoords or playerCoords
  local searchRadius = zoneRadius > 0 and zoneRadius or 12.0
  local vehicle, vehicleDistance = findNearestVehicleInRadius(searchOrigin, searchRadius)

  if (not vehicle or vehicle == 0) and zoneCoords then
    local expandedRadius = math.min(60.0, searchRadius + math.max(8.0, searchRadius * 0.5))
    vehicle, vehicleDistance = findNearestVehicleInRadius(searchOrigin, expandedRadius)
  end

  if not vehicle or vehicle == 0 then
    payload.error_message = 'No vehicle found in the registration area. Park any vehicle inside the marked carpark.'
    return payload
  end
  if tonumber(vehicleDistance) and tonumber(vehicleDistance) > (searchRadius + 8.0) then
    payload.error_message = 'No nearby vehicle found in the registration area. Move the vehicle closer to the marked carpark.'
    return payload
  end

  local plate = trim(GetVehicleNumberPlateText(vehicle) or '')
  if plate == '' then
    payload.error_message = 'Vehicle detected but plate could not be read. Re-park and try again.'
    return payload
  end
  local modelHash = GetEntityModel(vehicle)
  local model = GetDisplayNameFromVehicleModel(modelHash)
  if model and model ~= '' then
    local localized = GetLabelText(model)
    if localized and localized ~= '' and localized ~= 'NULL' then
      model = localized
    end
  else
    model = ''
  end
  if model == '' or model == 'NULL' or model == 'CARNOTFOUND' then
    model = tostring(modelHash or '')
  end

  payload.plate = plate
  payload.vehicle_model = trim(model or '')
  payload.vehicle_colour = getVehicleColourLabel(vehicle)
  return payload
end

local function notifyEmergencyUiIssue(message)
  local text = tostring(message or 'Unable to open the 000 UI right now.')

  if triggerCadOxNotify({
    title = 'CAD Dispatch',
    description = text,
    type = 'warning',
  }) then
    return
  end

  if GetResourceState('chat') == 'started' then
    TriggerEvent('chat:addMessage', {
      color = { 255, 170, 0 },
      args = { 'CAD', text },
    })
  end
end

local function setEmergencyUiVisible(isVisible, payload)
  local visible = isVisible == true
  emergencyUiOpen = visible
  if visible then
    emergencyUiAwaitingOpenAck = true
    emergencyUiOpenedAtMs = tonumber(GetGameTimer() or 0) or 0
    print('[cad_bridge] Setting NUI focus and sending open message')
    print('[cad_bridge] Payload:', json.encode(payload or {}))

    -- Force set NUI focus multiple times to ensure it works
    SetNuiFocus(true, true)
    Wait(10)
    SetNuiFocus(true, true)

    -- Send the open message
    SendNUIMessage({
      action = 'cadBridge000:open',
      payload = payload or {},
    })

    -- Send again after a tiny delay to ensure it's received
    Wait(10)
    SendNUIMessage({
      action = 'cadBridge000:open',
      payload = payload or {},
    })

    print('[cad_bridge] NUI focus set and messages sent')
  else
    emergencyUiAwaitingOpenAck = false
    emergencyUiOpenedAtMs = 0
    print('[cad_bridge] Closing 000 popup')
    emergencyUiOpen = false
    refreshCadBridgeNuiFocus()
    SendNUIMessage({
      action = 'cadBridge000:close',
      payload = {},
    })
  end
end

local function sanitizeEmergencyDepartments(departments)
  local out = {}
  if type(departments) ~= 'table' then
    return out
  end

  for _, dept in ipairs(departments) do
    local id = tonumber(dept.id)
    if id and id > 0 then
      out[#out + 1] = {
        id = math.floor(id),
        name = trim(dept.name or ('Department #' .. tostring(id))),
        short_name = trim(dept.short_name or ''),
        color = trim(dept.color or ''),
      }
    end
  end

  return out
end

local function closeEmergencyPopup()
  if not emergencyUiOpen then return end
  setEmergencyUiVisible(false, {})
end

local function openEmergencyPopup(departments)
  if not emergencyUiReady then
    local attempts = 0
    while not emergencyUiReady and attempts < 20 do
      attempts = attempts + 1
      Wait(50)
    end
  end

  if not emergencyUiReady then
    -- Try to force it anyway as a last resort
    print('[cad_bridge] Emergency UI not ready - attempting force open anyway')
    notifyEmergencyUiIssue('000 UI may not be fully loaded. If nothing appears, restart cad_bridge.')
    -- Continue anyway to try opening
  else
    print('[cad_bridge] 000 NUI confirmed ready')
  end

  local sanitizedDepts = sanitizeEmergencyDepartments(departments)
  print('[cad_bridge] Opening 000 emergency popup with ' .. tostring(#sanitizedDepts) .. ' departments')

  local payload = {
    departments = sanitizedDepts,
    max_title_length = 80,
    max_details_length = 600,
  }

  setEmergencyUiVisible(true, payload)

  -- Watchdog: Check if UI opened after 2 seconds
  CreateThread(function()
    Wait(2000)
    if emergencyUiOpen and emergencyUiAwaitingOpenAck then
