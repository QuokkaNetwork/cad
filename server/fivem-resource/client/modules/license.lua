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

local function normalizeMugshotValue(value)
  local normalized = trim(value)
  if normalized == '' then return '' end
  if normalized:match('^https?://') then return normalized end
  if normalized:match('^data:image/') then return normalized end

  if #normalized > 100 and normalized:match('^[A-Za-z0-9+/=]+$') then
    local encoding = trim(Config.ScreenshotEncoding or 'png'):lower()
    if encoding ~= 'png' and encoding ~= 'jpg' and encoding ~= 'jpeg' and encoding ~= 'webp' then
      encoding = 'png'
    end
    if encoding == 'jpg' then encoding = 'jpeg' end
    return ('data:image/%s;base64,%s'):format(encoding, normalized)
  end
  return normalized
end

local function tryMugshotExport(resourceName, exportName, args)
  local ok, result = pcall(function()
    local resource = exports[resourceName]
    if not resource then return nil end
    local fn = resource[exportName]
    if type(fn) ~= 'function' then return nil end
    return fn(table.unpack(args or {}))
  end)
  if not ok then return '' end

  if type(result) == 'table' then
    if result.url then return normalizeMugshotValue(result.url) end
    if result.image then return normalizeMugshotValue(result.image) end
    if result.mugshot then return normalizeMugshotValue(result.mugshot) end
    if result[1] then return normalizeMugshotValue(result[1]) end
  end
  return normalizeMugshotValue(result)
end

local function captureMugshotViaLegacyExport()
  local resourceName = trim(Config.MugshotResource or 'MugShotBase64')
  if resourceName == '' then return '' end
  if GetResourceState(resourceName) ~= 'started' then return '' end

  local ped = PlayerPedId()
  local playerId = PlayerId()
  local serverId = GetPlayerServerId(playerId)
  local attempts = {
    { 'GetMugShotBase64', { ped, false } },
    { 'GetMugShotBase64', { ped } },
    { 'getMugShotBase64', { ped, false } },
    { 'getMugShotBase64', { ped } },
    { 'GetMugShotUrl', { ped } },
    { 'getMugShotUrl', { ped } },
    { 'GetMugshotUrl', { ped } },
    { 'getMugshotUrl', { ped } },
    { 'GetMugShot', { ped } },
    { 'getMugShot', { ped } },
    { 'GetMugshot', { ped } },
    { 'getMugshot', { ped } },
    { 'GetPlayerMugshot', { serverId } },
    { 'getPlayerMugshot', { serverId } },
    { 'GetMugShotUrl', {} },
    { 'GetMugShotBase64', { ped, true } },
    { 'getMugShotBase64', { ped, true } },
  }

  for _, attempt in ipairs(attempts) do
    local url = tryMugshotExport(resourceName, attempt[1], attempt[2])
    if url ~= '' then
      return url
    end
  end
  return ''
end

local function safeDecodeJson(value)
  local ok, parsed = pcall(function()
    return json.decode(value)
  end)
  if ok then return parsed end
  return nil
end

local function normalizeScreenshotResult(result)
  if type(result) == 'table' then
    if result.data then return normalizeMugshotValue(result.data) end
    if result.image then return normalizeMugshotValue(result.image) end
    if result.base64 then return normalizeMugshotValue(result.base64) end
    if result[1] then return normalizeMugshotValue(result[1]) end
    return ''
  end

  local text = trim(result)
  if text == '' then return '' end
  if text:sub(1, 1) == '{' then
    local parsed = safeDecodeJson(text)
    if type(parsed) == 'table' then
      return normalizeScreenshotResult(parsed)
    end
  end
  return normalizeMugshotValue(text)
end

local mugshotCaptureResult = nil
RegisterNetEvent('cad_bridge:mugshotCaptureResult', function(success)
  mugshotCaptureResult = success == true
end)

local function captureMugshotViaScreenshot()
  local ped = PlayerPedId()
  if not ped or ped == 0 then return '' end

  local pedWasFrozen = false
  if type(IsEntityPositionFrozen) == 'function' then
    pedWasFrozen = IsEntityPositionFrozen(ped) == true
  end
  local originalHeading = GetEntityHeading(ped)
  local hadNightVision = false
  if type(GetUsingnightvision) == 'function' then
    hadNightVision = GetUsingnightvision() == true
  end
  local hadSeeThrough = false
  if type(GetUsingseethrough) == 'function' then
    hadSeeThrough = GetUsingseethrough() == true
  end

  FreezeEntityPosition(ped, true)
  SetEntityHeading(ped, originalHeading)
  if type(SetNightvision) == 'function' then SetNightvision(false) end
  if type(SetSeethrough) == 'function' then SetSeethrough(false) end
  Wait(100)

  local hasScully = GetResourceState('scully_emotemenu') == 'started'
  if hasScully then
    exports['scully_emotemenu']:cancelEmote()
    Wait(200)
    exports['scully_emotemenu']:playEmoteByCommand('airforce2')
  end

  Wait(1500)
  SetEntityHeading(ped, originalHeading)
  Wait(100)
  SetEntityHeading(ped, originalHeading)

  local headingRad = math.rad(originalHeading)
  local pedCoords = GetEntityCoords(ped)
  local lookX = pedCoords.x + (-math.sin(headingRad)) * 50.0
  local lookY = pedCoords.y + (math.cos(headingRad)) * 50.0
  local lookZ = pedCoords.z + 0.5
  TaskLookAtCoord(ped, lookX, lookY, lookZ, 5000, 2048 + 16, 2)
  Wait(500)

  local headPos = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
  if not headPos then
    if hasScully then exports['scully_emotemenu']:cancelEmote() end
    if type(SetNightvision) == 'function' then SetNightvision(hadNightVision) end
    if type(SetSeethrough) == 'function' then SetSeethrough(hadSeeThrough) end
    if not pedWasFrozen then FreezeEntityPosition(ped, false) end
    return ''
  end

  local forwardX = -math.sin(headingRad)
  local forwardY = math.cos(headingRad)
  local hasHeadProp = false
  if type(GetPedPropIndex) == 'function' then
    hasHeadProp = (GetPedPropIndex(ped, 0) or -1) >= 0
  end
  local wearingHelmet = false
  if type(IsPedWearingHelmet) == 'function' then
    wearingHelmet = IsPedWearingHelmet(ped) == true
  end
  local useHelmetFraming = hasHeadProp or wearingHelmet

  local camDist = useHelmetFraming and 1.20 or 0.82
  local camX = headPos.x + forwardX * camDist
  local camY = headPos.y + forwardY * camDist
  local camZ = headPos.z + (useHelmetFraming and 0.16 or 0.10)

  local cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
  SetCamCoord(cam, camX, camY, camZ)
  if type(SetCamNearClip) == 'function' then SetCamNearClip(cam, 0.03) end
  PointCamAtCoord(cam, headPos.x, headPos.y, headPos.z + (useHelmetFraming and 0.10 or 0.04))
  SetCamFov(cam, useHelmetFraming and 35.0 or 30.0)
  RenderScriptCams(true, false, 0, true, true)

  local hideUi = true
  CreateThread(function()
    while hideUi do
      HideHudAndRadarThisFrame()
      HideHudComponentThisFrame(1)
      HideHudComponentThisFrame(2)
      HideHudComponentThisFrame(3)
      HideHudComponentThisFrame(6)
      HideHudComponentThisFrame(7)
      HideHudComponentThisFrame(8)
      HideHudComponentThisFrame(9)
      HideHudComponentThisFrame(13)
      Wait(0)
    end
  end)

  Wait(600)
  mugshotCaptureResult = nil
  TriggerServerEvent('cad_bridge:requestMugshotCapture')

  local timeoutMs = tonumber(Config.ScreenshotTimeoutMs or 8000) or 8000
  if timeoutMs < 1000 then timeoutMs = 1000 end
  local deadline = GetGameTimer() + timeoutMs
  while mugshotCaptureResult == nil and GetGameTimer() < deadline do
    Wait(50)
  end

  hideUi = false
  RenderScriptCams(false, false, 0, true, true)
  DestroyCam(cam, false)
  if hasScully then exports['scully_emotemenu']:cancelEmote() end
  ClearPedTasksImmediately(ped)
  SetEntityHeading(ped, originalHeading)
  if type(SetNightvision) == 'function' then SetNightvision(hadNightVision) end
  if type(SetSeethrough) == 'function' then SetSeethrough(hadSeeThrough) end
  if not pedWasFrozen then FreezeEntityPosition(ped, false) end

  if mugshotCaptureResult == nil then return '' end
  if mugshotCaptureResult then return 'SERVER_CAPTURE' end
  return ''
end

local function captureMugshotViaHeadshot()
  if type(RegisterPedheadshot) ~= 'function' or type(IsPedHeadshotReady) ~= 'function' then return '' end

  local ped = PlayerPedId()
  if not ped or ped == 0 then return '' end

  local handle = RegisterPedheadshot(ped)
  if not handle or handle == 0 then return '' end

  local deadline = GetGameTimer() + 5000
  while not IsPedHeadshotReady(handle) and GetGameTimer() < deadline do
    Wait(100)
  end

  if not IsPedHeadshotReady(handle) then
    UnregisterPedHeadshot(handle)
    return ''
  end

  local txdName = GetPedHeadshotTxdString(handle)
  if not txdName or trim(txdName) == '' then
    UnregisterPedHeadshot(handle)
    return ''
  end

  local pending = { done = false, result = '' }
  state.headshotCapturePending = pending
  SendNUIMessage({
    action = 'cadBridgeHeadshot:capture',
    txdName = txdName,
  })

  local captureDeadline = GetGameTimer() + 5000
  while not pending.done and GetGameTimer() < captureDeadline do
    Wait(50)
  end

  state.headshotCapturePending = nil
  UnregisterPedHeadshot(handle)
  return pending.result
end

local function captureMugshotUrl()
  local provider = trim(Config.MugshotProvider or 'screencapture'):lower()
  if provider == '' then provider = 'screencapture' end

  if provider == 'screencapture' or provider == 'screenshot-basic' then
    local screenshot = captureMugshotViaScreenshot()
    if screenshot ~= '' then return screenshot end
    local headshot = captureMugshotViaHeadshot()
    if headshot ~= '' then return headshot end
    return captureMugshotViaLegacyExport()
  end

  if provider == 'mugshotbase64' then
    local legacy = captureMugshotViaLegacyExport()
    if legacy ~= '' then return legacy end
    return captureMugshotViaScreenshot()
  end

  local screenshot = captureMugshotViaScreenshot()
  if screenshot ~= '' then return screenshot end
  local headshot = captureMugshotViaHeadshot()
  if headshot ~= '' then return headshot end
  return captureMugshotViaLegacyExport()
end

local function splitMugshotPayload(value)
  local normalized = trim(value)
  if normalized == '' then return '', '' end
  if normalized:match('^data:image/') then return normalized, '' end
  if normalized:match('^https?://') then return '', normalized end

  if #normalized > 100 and normalized:match('^[A-Za-z0-9+/=]+$') then
    local encoding = trim(Config.ScreenshotEncoding or 'jpg'):lower()
    if encoding == 'jpg' then encoding = 'jpeg' end
    if encoding ~= 'jpeg' and encoding ~= 'png' and encoding ~= 'webp' then
      encoding = 'jpeg'
    end
    return ('data:image/%s;base64,%s'):format(encoding, normalized), ''
  end

  return '', normalized
end

local function closeDriverLicensePopup()
  if not state.driverLicenseUiOpen then return end
  state.driverLicenseUiOpen = false
  if type(ui.refreshCadBridgeNuiFocus) == 'function' then
    ui.refreshCadBridgeNuiFocus()
  end
  SendNUIMessage({
    action = 'cadBridgeLicense:close',
    payload = {},
  })
end
ui.closeDriverLicensePopup = closeDriverLicensePopup

local function openDriverLicensePopup(payload)
  if state.emergencyUiOpen and type(ui.closeEmergencyPopup) == 'function' then
    ui.closeEmergencyPopup()
  end
  if state.vehicleRegistrationUiOpen and type(ui.closeVehicleRegistrationPopup) == 'function' then
    ui.closeVehicleRegistrationPopup()
  end

  state.driverLicenseUiOpen = true
  SetNuiFocus(true, true)
  SendNUIMessage({
    action = 'cadBridgeLicense:open',
    payload = payload or {},
  })
end
ui.openDriverLicensePopup = openDriverLicensePopup

RegisterNUICallback('cadBridgeLicenseSubmit', function(data, cb)
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

  if fullName == '' or dateOfBirth == '' or gender == '' or #classes == 0 then
    if cb then cb({ ok = false, error = 'invalid_form' }) end
    return
  end

  if cb then cb({ ok = true }) end
  local licenseNumber = trim(data and data.license_number or '')
  local conditions = type(data and data.conditions) == 'table' and data.conditions or {}
  local expiryAt = trim(data and data.expiry_at or '')
  closeDriverLicensePopup()

  CreateThread(function()
    Wait(80)
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
      expiry_days = math.floor(expiryDays),
      expiry_at = expiryAt,
    })
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
  if state.headshotCapturePending then
    state.headshotCapturePending.result = normalizeScreenshotResult(tostring(data and data.data or ''))
    state.headshotCapturePending.done = true
  end
  if cb then cb({ ok = true }) end
end)

RegisterNetEvent('cad_bridge:promptDriverLicense', function(payload)
  openDriverLicensePopup(payload or {})
end)
