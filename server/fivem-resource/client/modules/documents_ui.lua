      print('[cad_bridge] WARNING: 000 UI did not acknowledge open after 2 seconds')
      print('[cad_bridge] Attempting to resend open message...')
      SendNUIMessage({
        action = 'cadBridge000:open',
        payload = payload,
      })
    end
  end)
end

local function closeDriverLicensePopup()
  if not driverLicenseUiOpen then return end
  driverLicenseUiOpen = false
  refreshCadBridgeNuiFocus()
  SendNUIMessage({
    action = 'cadBridgeLicense:close',
    payload = {},
  })
end

local function closeVehicleRegistrationPopup()
  if not vehicleRegistrationUiOpen then return end
  vehicleRegistrationUiOpen = false
  refreshCadBridgeNuiFocus()
  SendNUIMessage({
    action = 'cadBridgeRegistration:close',
    payload = {},
  })
end

local function openDriverLicensePopup(payload)
  if emergencyUiOpen then
    closeEmergencyPopup()
  end
  if vehicleRegistrationUiOpen then
    closeVehicleRegistrationPopup()
  end

  driverLicenseUiOpen = true
  SetNuiFocus(true, true)
  SendNUIMessage({
    action = 'cadBridgeLicense:open',
    payload = payload or {},
  })
end

local function openVehicleRegistrationPopup(payload)
  if emergencyUiOpen then
    closeEmergencyPopup()
  end
  if driverLicenseUiOpen then
    closeDriverLicensePopup()
  end

  local nextPayload = payload or {}
  local defaults = getCurrentVehicleRegistrationDefaults(nextPayload.registration_parking)
  if trim(nextPayload.plate or '') == '' then
    nextPayload.plate = defaults.plate
  end
  if trim(nextPayload.vehicle_model or '') == '' then
    nextPayload.vehicle_model = defaults.vehicle_model
  end
  if trim(nextPayload.vehicle_colour or '') == '' then
    nextPayload.vehicle_colour = defaults.vehicle_colour
  end

  if trim(nextPayload.plate or '') == '' or trim(nextPayload.vehicle_model or '') == '' then
    local message = trim(defaults.error_message or '')
    if message == '' then
      message = 'Park any vehicle in the registration carpark so details can be auto-filled.'
    end
    if not triggerCadOxNotify({
      title = 'CAD Registration',
      description = message,
      type = 'warning',
    }) and GetResourceState('chat') == 'started' then
      TriggerEvent('chat:addMessage', {
        color = { 255, 170, 0 },
        args = { 'CAD', message },
      })
    end
    return
  end

  vehicleRegistrationUiOpen = true
  SetNuiFocus(true, true)
  SendNUIMessage({
    action = 'cadBridgeRegistration:open',
    payload = nextPayload,
  })
end

local function closeShownIdCard()
  if not idCardUiOpen then return end
  idCardUiOpen = false
  SendNUIMessage({
    action = 'cadBridgeIdCard:hide',
    payload = {},
  })
end

local function openShownIdCard(payload)
  idCardUiOpen = true
  SendNUIMessage({
    action = 'cadBridgeIdCard:show',
    payload = payload or {},
  })
end

RegisterNUICallback('cadBridge000Ready', function(_data, cb)
  emergencyUiReady = true
  print('[cad_bridge] 000 NUI is ready')
  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridge000Opened', function(_data, cb)
  emergencyUiAwaitingOpenAck = false
  emergencyUiOpenedAtMs = 0
  print('[cad_bridge] 000 NUI opened successfully')
  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridge000Submit', function(data, cb)
  local title = trim(data and data.title or '')
  local details = trim(data and data.details or '')
  local requestedDepartmentIds = normalizeDepartmentIdList(data and data.requested_department_ids or {})

  if title == '' then
    if cb then cb({ ok = false, error = 'title_required' }) end
    return
  end

  if #title > 80 then
    title = title:sub(1, 80)
  end
  if #details > 600 then
    details = details:sub(1, 600)
  end

  closeEmergencyPopup()
  TriggerServerEvent('cad_bridge:submit000', {
    title = title,
    details = details,
    requested_department_ids = requestedDepartmentIds,
  })

  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridge000Cancel', function(_data, cb)
  closeEmergencyPopup()
  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridgeLicenseSubmit', function(data, cb)
  print('[cad_bridge] NUI cadBridgeLicenseSubmit callback fired')
  local fullName = trim(data and data.full_name or data and data.character_name or '')
  local dateOfBirth = trim(data and data.date_of_birth or data and data.dob or '')
  local gender = trim(data and data.gender or '')
  local expiryDays = tonumber(data and data.expiry_days or 0) or tonumber(Config.DriverLicenseDefaultExpiryDays or 35) or 35
  if expiryDays < 1 then expiryDays = 1 end

  local classes = {}
  if type(data and data.license_classes) == 'table' then
    for _, value in ipairs(data.license_classes) do
      local normalized = trim(value)
      if normalized ~= '' then
        classes[#classes + 1] = normalized:upper()
      end
    end
  end

  print(('[cad_bridge] License form data: name=%q dob=%q gender=%q classes=%d expiry_days=%s'):format(
    fullName, dateOfBirth, gender, #classes, tostring(expiryDays)))

  if fullName == '' or dateOfBirth == '' or gender == '' or #classes == 0 then
    print(('[cad_bridge] License form validation FAILED: name=%q dob=%q gender=%q classes=%d'):format(
      fullName, dateOfBirth, gender, #classes))
    if cb then cb({ ok = false, error = 'invalid_form' }) end
    return
  end

  -- Respond to NUI immediately so the UI closes without delay.
  if cb then cb({ ok = true }) end

  -- Capture form fields before entering async thread.
  local licenseNumber = trim(data and data.license_number or '')
  local conditions = type(data and data.conditions) == 'table' and data.conditions or {}
  local expiryAt = trim(data and data.expiry_at or '')

  closeDriverLicensePopup()

  -- Run mugshot capture + server event in a proper coroutine so Wait() works reliably.
  CreateThread(function()
    -- Release NUI focus before taking mugshot so the PED is captured, not the form UI.
    Wait(80)
    print('[cad_bridge] Capturing mugshot via server-side screencapture...')
    local capturedMugshot = captureMugshotUrl()
    -- When using server-side capture, mugshot data is stored on the server.
    -- We don't need to send it via TriggerServerEvent (avoids payload limit).
    local mugshotData = ''
    local mugshotUrl = ''
    if capturedMugshot ~= 'SERVER_CAPTURE' then
      mugshotData, mugshotUrl = splitMugshotPayload(capturedMugshot)
    end
    print(('[cad_bridge] Mugshot result=%q (data_len=%d url_len=%d). Triggering submitDriverLicense server event...'):format(
      capturedMugshot == 'SERVER_CAPTURE' and 'SERVER_CAPTURE' or 'client',
      #mugshotData, #mugshotUrl))
    TriggerServerEvent('cad_bridge:submitDriverLicense', {
      full_name = fullName,
      date_of_birth = dateOfBirth,
      gender = gender,
      license_number = licenseNumber,
      license_classes = classes,
      conditions = conditions,
      mugshot_data = mugshotData,
      mugshot_url = mugshotUrl,
      expiry_days = math.floor(expiryDays),
      expiry_at = expiryAt,
    })
    print('[cad_bridge] submitDriverLicense server event triggered successfully')
  end)
end)

RegisterNUICallback('cadBridgeLicenseRetakePhoto', function(data, cb)
  local existing = type(data and data.existing_license) == 'table' and data.existing_license or {}
  local fullName = trim(existing.full_name or '')
  local dateOfBirth = trim(existing.date_of_birth or '')
  local gender = trim(existing.gender or '')
  local licenseNumber = trim(existing.license_number or '')
  local expiryAt = trim(existing.expiry_at or '')
  local classes = {}
  if type(existing.license_classes) == 'table' then
    for _, value in ipairs(existing.license_classes) do
      local normalized = trim(value)
      if normalized ~= '' then classes[#classes + 1] = normalized:upper() end
    end
  end
  local conditions = {}
  if type(existing.conditions) == 'table' then
    for _, value in ipairs(existing.conditions) do
      local normalized = trim(value)
      if normalized ~= '' then conditions[#conditions + 1] = normalized end
    end
  end

  if fullName == '' or dateOfBirth == '' or gender == '' or #classes == 0 or expiryAt == '' then
    if cb then cb({ ok = false, error = 'invalid_existing_license' }) end
    return
  end

  if cb then cb({ ok = true }) end
  closeDriverLicensePopup()

  CreateThread(function()
    Wait(80)
    print('[cad_bridge] Retake-photo flow: capturing mugshot via server-side screencapture...')
    local capturedMugshot = captureMugshotUrl()
    local mugshotData = ''
    local mugshotUrl = ''
    if capturedMugshot ~= 'SERVER_CAPTURE' then
      mugshotData, mugshotUrl = splitMugshotPayload(capturedMugshot)
    end
    TriggerServerEvent('cad_bridge:submitDriverLicense', {
      full_name = fullName,
      date_of_birth = dateOfBirth,
      gender = gender,
      license_number = licenseNumber,
      license_classes = classes,
      conditions = conditions,
      mugshot_data = mugshotData,
      mugshot_url = mugshotUrl,
      expiry_at = expiryAt,
      photo_only = true,
    })
  end)
end)

RegisterNUICallback('cadBridgeLicenseCancel', function(_data, cb)
  closeDriverLicensePopup()
  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridgeHeadshotCapture', function(data, cb)
  if headshotCapturePending then
    headshotCapturePending.result = normalizeScreenshotResult(tostring(data and data.data or ''))
    headshotCapturePending.done = true
  end
  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridgeRegistrationSubmit', function(data, cb)
  print('[cad_bridge] NUI cadBridgeRegistrationSubmit callback fired')
  local plate = trim(data and data.plate or data and data.license_plate or '')
  local model = trim(data and data.vehicle_model or data and data.model or '')
  local colour = trim(data and data.vehicle_colour or data and data.colour or data and data.color or '')
  local ownerName = trim(data and data.owner_name or data and data.character_name or '')
  local durationDays = tonumber(data and data.duration_days or 0) or tonumber(Config.VehicleRegistrationDefaultDays or 35) or 35
  if durationDays < 1 then durationDays = 1 end

  print(('[cad_bridge] Registration form data: plate=%q model=%q owner=%q duration=%s'):format(
    plate, model, ownerName, tostring(durationDays)))

  if plate == '' or model == '' or ownerName == '' then
    print(('[cad_bridge] Registration form validation FAILED: plate=%q model=%q owner=%q'):format(plate, model, ownerName))
    if cb then cb({ ok = false, error = 'invalid_form' }) end
    return
  end

  if cb then cb({ ok = true }) end
  closeVehicleRegistrationPopup()
  print('[cad_bridge] Triggering submitVehicleRegistration server event...')
  TriggerServerEvent('cad_bridge:submitVehicleRegistration', {
    plate = plate,
    vehicle_model = model,
    vehicle_colour = colour,
    owner_name = ownerName,
    duration_days = math.floor(durationDays),
  })
  print('[cad_bridge] submitVehicleRegistration server event triggered successfully')
end)

RegisterNUICallback('cadBridgeRegistrationCancel', function(_data, cb)
  closeVehicleRegistrationPopup()
  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridgeIdCardClose', function(_data, cb)
  closeShownIdCard()
  if cb then cb({ ok = true }) end
end)

RegisterNetEvent('cad_bridge:setCallRoute', function(route)
  if type(route) ~= 'table' then return end
  local action = tostring(route.action or ''):lower()
  local clearWaypoint = action == 'clear' or route.clear_waypoint == true or tonumber(route.clear_waypoint or 0) == 1

  if clearWaypoint then
    SetWaypointOff()
    notifyRouteCleared(route)
    return
  end

  local coords = parseCoords(route.position)
  if not coords then
    coords = getPostalCoords(route.postal)
  end

  if coords and tonumber(coords.x) and tonumber(coords.y) then
    SetNewWaypoint(coords.x + 0.0, coords.y + 0.0)
    notifyRoute(route, true)
    return
  end

  notifyRoute(route, false)
end)

RegisterNetEvent('cad_bridge:notifyFine', function(payload)
  notifyFine(payload)
end)

RegisterNetEvent('cad_bridge:notifyAlert', function(payload)
  notifyAlert(payload)
end)

RegisterNetEvent('cad_bridge:prompt000', function(departments)
  openEmergencyPopup(departments)
end)

RegisterNetEvent('cad_bridge:promptDriverLicense', function(payload)
  openDriverLicensePopup(payload or {})
end)

RegisterNetEvent('cad_bridge:promptVehicleRegistration', function(payload)
  openVehicleRegistrationPopup(payload or {})
end)

RegisterNetEvent('cad_bridge:showIdCard', function(payload)
  openShownIdCard(payload or {})
end)

RegisterNetEvent('cad_bridge:hideIdCard', function()
  closeShownIdCard()
end)

local function findFacingPlayerServerId(maxDistance)
  local ped = PlayerPedId()
  if not ped or ped == 0 then return 0 end

  local origin = GetEntityCoords(ped)
  local forward = GetEntityForwardVector(ped)
  local localPlayer = PlayerId()
  local distanceLimit = tonumber(maxDistance) or 4.0
  if distanceLimit < 1.0 then distanceLimit = 1.0 end

  local bestServerId = 0
  local bestScore = 0.0

  for _, player in ipairs(GetActivePlayers()) do
    if player ~= localPlayer then
      local targetPed = GetPlayerPed(player)
      if targetPed and targetPed ~= 0 then
        local targetCoords = GetEntityCoords(targetPed)
        local dx = targetCoords.x - origin.x
        local dy = targetCoords.y - origin.y
        local dz = targetCoords.z - origin.z
        local distance = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))

        if distance > 0.001 and distance <= distanceLimit then
          local invDistance = 1.0 / distance
          local dot = (forward.x * dx * invDistance) + (forward.y * dy * invDistance) + (forward.z * dz * invDistance)
          if dot >= 0.35 then
            local score = dot + (1.0 - (distance / distanceLimit))
            if score > bestScore then
              bestScore = score
              bestServerId = GetPlayerServerId(player)
            end
          end
        end
      end
    end
  end

  return tonumber(bestServerId) or 0
end

local function requestShowIdCard()
  local targetSource = findFacingPlayerServerId(SHOW_ID_MAX_DISTANCE)
  TriggerServerEvent('cad_bridge:requestShowId', targetSource)
end

local LIVE_MAP_CALIBRATION_ENABLED = Config.LiveMapCalibrationEnabled == true
local LIVE_MAP_CALIBRATION_COMMAND = trim(Config.LiveMapCalibrationCommand or 'calibrate')
if LIVE_MAP_CALIBRATION_COMMAND == '' then LIVE_MAP_CALIBRATION_COMMAND = 'calibrate' end
local liveMapCalibrationPointA = nil
local liveMapCalibrationPointB = nil

local function notifyLiveMapCalibration(message, notifyType)
  local title = 'Live Map Calibration'
  local description = tostring(message or '')
