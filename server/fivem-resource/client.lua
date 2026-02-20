local function trim(s)
  if not s then return '' end
  return (tostring(s):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function normalizePostal(value)
  if value == nil then return '' end
  local t = type(value)
  if t == 'string' or t == 'number' then
    local v = tostring(value)
    return v ~= '' and v or ''
  end
  if t == 'table' then
    local candidates = {
      value.code,
      value.postal,
      value.postalCode,
      value.postcode,
      value[1],
    }
    for _, candidate in ipairs(candidates) do
      if candidate ~= nil then
        local str = tostring(candidate)
        if str ~= '' then return str end
      end
    end
  end
  return ''
end

local function tryPostalExport(resourceName, exportName)
  local ok, result = pcall(function()
    local resource = exports[resourceName]
    if not resource then return nil end
    local fn = resource[exportName]
    if type(fn) ~= 'function' then return nil end
    return fn()
  end)
  if not ok then return '' end
  return normalizePostal(result)
end

local function getNearestPostal()
  if not Config.UseNearestPostal then return '' end

  local primaryResource = tostring(Config.NearestPostalResource or 'nearest-postal')
  local primaryExport = tostring(Config.NearestPostalExport or 'getPostal')

  local postal = tryPostalExport(primaryResource, primaryExport)
  if postal ~= '' then return postal end

  local fallbacks = {
    { primaryResource, 'getPostalCode' },
    { primaryResource, 'GetPostal' },
    { 'nearest-postal', 'getPostal' },
    { 'nearest-postal', 'getPostalCode' },
  }
  for _, pair in ipairs(fallbacks) do
    postal = tryPostalExport(pair[1], pair[2])
    if postal ~= '' then return postal end
  end
  return ''
end

local function getWeaponName(ped)
  if not ped or ped == 0 then return '' end
  local weaponHash = GetSelectedPedWeapon(ped)
  if not weaponHash or weaponHash == 0 then return '' end
  if weaponHash == GetHashKey('WEAPON_UNARMED') then return '' end

  local weaponLabel = GetWeaponDisplayNameFromHash(weaponHash)
  if not weaponLabel or weaponLabel == '' or weaponLabel == 'WT_INVALID' then
    return ''
  end

  local localized = GetLabelText(weaponLabel)
  if localized and localized ~= '' and localized ~= 'NULL' then
    return localized
  end
  return tostring(weaponLabel)
end

local function isTowTruckModel(modelHash)
  return modelHash == GetHashKey('towtruck') or modelHash == GetHashKey('towtruck2')
end

local function getVehicleSnapshot(ped)
  local snapshot = {
    vehicle = '',
    license_plate = '',
    has_siren_enabled = false,
    icon = 6,
  }

  if not ped or ped == 0 then
    return snapshot
  end

  if not IsPedInAnyVehicle(ped, false) then
    return snapshot
  end

  local vehicle = GetVehiclePedIsIn(ped, false)
  if not vehicle or vehicle == 0 then
    return snapshot
  end

  local modelHash = GetEntityModel(vehicle)
  local vehicleName = GetDisplayNameFromVehicleModel(modelHash)
  if vehicleName and vehicleName ~= '' then
    local localized = GetLabelText(vehicleName)
    if localized and localized ~= '' and localized ~= 'NULL' then
      vehicleName = localized
    end
  else
    vehicleName = ''
  end

  local vehicleClass = GetVehicleClass(vehicle)
  local icon = 225
  if vehicleClass == 18 then
    icon = 56
  elseif isTowTruckModel(modelHash) then
    icon = 68
  elseif IsThisModelAHeli(modelHash) then
    icon = 64
  end

  local hasSiren = IsVehicleSirenOn(vehicle) or IsVehicleSirenAudioOn(vehicle) or IsVehicleSirenSoundOn(vehicle)
  local sirenEnabled = hasSiren == true or hasSiren == 1

  snapshot.vehicle = tostring(vehicleName or '')
  snapshot.license_plate = tostring(GetVehicleNumberPlateText(vehicle) or '')
  snapshot.has_siren_enabled = sirenEnabled
  snapshot.icon = icon
  return snapshot
end

local function buildLocationText(street, crossing, postal, coords)
  local road = tostring(street or '')
  local cross = tostring(crossing or '')
  local post = tostring(postal or '')
  local base = ''

  if road ~= '' and cross ~= '' and road:lower() ~= cross:lower() then
    base = road .. ' / ' .. cross
  elseif road ~= '' then
    base = road
  elseif cross ~= '' then
    base = cross
  end

  if base == '' then
    local x = tonumber(coords and coords.x) or 0.0
    local y = tonumber(coords and coords.y) or 0.0
    local z = tonumber(coords and coords.z) or 0.0
    base = ('X:%.1f Y:%.1f Z:%.1f'):format(x, y, z)
  end

  if post ~= '' then
    return ('%s (%s)'):format(base, post)
  end
  return base
end

local function parseCoords(value)
  if value == nil then return nil end
  local t = type(value)
  if t == 'table' then
    local nested = value.coords or value.position or nil
    if type(nested) == 'table' then
      local nx = tonumber(nested.x or nested[1])
      local ny = tonumber(nested.y or nested[2])
      local nz = tonumber(nested.z or nested[3] or 0.0)
      if nx and ny then
        return { x = nx, y = ny, z = nz or 0.0 }
      end
    end

    local x = tonumber(value.x or value[1])
    local y = tonumber(value.y or value[2])
    local z = tonumber(value.z or value[3] or 0.0)
    if x and y then
      return { x = x, y = y, z = z or 0.0 }
    end
  end
  return nil
end

local function tryPostalCoordsExport(resourceName, exportName, postal)
  local ok, result = pcall(function()
    local resource = exports[resourceName]
    if not resource then return nil end
    local fn = resource[exportName]
    if type(fn) ~= 'function' then return nil end
    return fn(postal)
  end)
  if not ok then return nil end
  return parseCoords(result)
end

local function getPostalCoords(postal)
  local normalized = normalizePostal(postal)
  if normalized == '' then return nil end

  local primaryResource = tostring(Config.NearestPostalResource or 'nearest-postal')
  local lookups = {
    { primaryResource, 'getCoordsFromPostal' },
    { primaryResource, 'getCoordFromPostal' },
    { primaryResource, 'getCoordinateFromPostal' },
    { primaryResource, 'getCoordinatesFromPostal' },
    { primaryResource, 'getPostalCoords' },
    { primaryResource, 'GetCoordsFromPostal' },
    { primaryResource, 'GetCoordFromPostal' },
    { primaryResource, 'GetCoordinateFromPostal' },
    { primaryResource, 'GetCoordinatesFromPostal' },
    { primaryResource, 'GetPostalCoords' },
    { 'nearest-postal', 'getCoordsFromPostal' },
    { 'nearest-postal', 'getCoordFromPostal' },
    { 'nearest-postal', 'getCoordinateFromPostal' },
    { 'nearest-postal', 'getCoordinatesFromPostal' },
    { 'nearest-postal', 'getPostalCoords' },
    { 'nearest-postal', 'GetCoordsFromPostal' },
    { 'nearest-postal', 'GetCoordFromPostal' },
    { 'nearest-postal', 'GetCoordinateFromPostal' },
    { 'nearest-postal', 'GetCoordinatesFromPostal' },
    { 'nearest-postal', 'GetPostalCoords' },
  }

  for _, pair in ipairs(lookups) do
    local coords = tryPostalCoordsExport(pair[1], pair[2], normalized)
    if coords then
      return coords
    end
  end
  return nil
end

local function getCadOxNotifyPosition()
  local configured = trim(Config and Config.OxNotifyPosition or 'center-right')
  if configured == '' then
    configured = 'center-right'
  end
  return configured
end

local function triggerCadOxNotify(payload)
  if GetResourceState('ox_lib') ~= 'started' then
    return false
  end

  local nextPayload = {}
  if type(payload) == 'table' then
    for key, value in pairs(payload) do
      nextPayload[key] = value
    end
  end

  if (Config and Config.ForceOxNotifyPosition == true) or trim(nextPayload.position or '') == '' then
    nextPayload.position = getCadOxNotifyPosition()
  end

  TriggerEvent('ox_lib:notify', nextPayload)
  return true
end

local function notifyRoute(route, hadWaypoint)
  local callId = tostring(route.call_id or '?')
  local targetLabel = normalizePostal(route.postal)
  if targetLabel == '' then
    targetLabel = tostring(route.location or '')
  end

  local message = hadWaypoint
    and ('CAD route set for call #%s%s%s'):format(callId, targetLabel ~= '' and ' -> ' or '', targetLabel)
    or ('CAD assigned call #%s%s%s (postal lookup unavailable for waypoint)'):format(callId, targetLabel ~= '' and ' -> ' or '', targetLabel)

  if triggerCadOxNotify({
    title = 'CAD Dispatch',
    description = message,
    type = hadWaypoint and 'inform' or 'warning',
  }) then
    return
  end

  if GetResourceState('chat') == 'started' then
    TriggerEvent('chat:addMessage', {
      color = hadWaypoint and { 0, 170, 255 } or { 255, 170, 0 },
      args = { 'CAD', message },
    })
  end
end

local function notifyRouteCleared(route)
  local callId = tostring(route.call_id or '?')
  local message = ('CAD route cleared for call #%s'):format(callId)

  if triggerCadOxNotify({
    title = 'CAD Dispatch',
    description = message,
    type = 'inform',
  }) then
    return
  end

  if GetResourceState('chat') == 'started' then
    TriggerEvent('chat:addMessage', {
      color = { 148, 163, 184 },
      args = { 'CAD', message },
    })
  end
end

local function notifyFine(payload)
  local title = tostring(payload and payload.title or 'CAD Fine Issued')
  local description = tostring(payload and payload.description or 'You have received a fine.')

  if triggerCadOxNotify({
    title = title,
    description = description,
    type = 'error',
  }) then
    return
  end

  if GetResourceState('chat') == 'started' then
    TriggerEvent('chat:addMessage', {
      color = { 255, 85, 85 },
      args = { 'CAD', description },
    })
  end
end

local function notifyAlert(payload)
  local title = tostring(payload and payload.title or 'CAD')
  local description = tostring(payload and payload.description or '')
  local notifyType = tostring(payload and payload.type or 'inform')
  if notifyType == '' then notifyType = 'inform' end

  if triggerCadOxNotify({
    title = title,
    description = description,
    type = notifyType,
  }) then
    return
  end

  if GetResourceState('chat') == 'started' then
    TriggerEvent('chat:addMessage', {
      color = { 255, 170, 0 },
      args = { 'CAD', description ~= '' and description or title },
    })
  end
end

local function normalizeDepartmentIdList(value)
  local normalized = {}
  local seen = {}

  if type(value) ~= 'table' then
    return normalized
  end

  for key, raw in pairs(value) do
    local candidate = raw
    if type(key) ~= 'number' and (raw == true or raw == false or raw == nil) then
      candidate = key
    end

    local numeric = tonumber(candidate)
    if numeric and numeric > 0 then
      local id = math.floor(numeric)
      if not seen[id] then
        seen[id] = true
        normalized[#normalized + 1] = id
      end
    end
  end

  return normalized
end

local emergencyUiOpen = false
local emergencyUiReady = false
local emergencyUiAwaitingOpenAck = false
local emergencyUiOpenedAtMs = 0
local driverLicenseUiOpen = false
local vehicleRegistrationUiOpen = false
local idCardUiOpen = false
local headshotCapturePending = nil
local SHOW_ID_COMMAND = trim(Config.ShowIdCommand or 'showid')
if SHOW_ID_COMMAND == '' then SHOW_ID_COMMAND = 'showid' end
local SHOW_ID_KEY = trim(Config.ShowIdKey or 'PAGEDOWN')
if SHOW_ID_KEY == '' then SHOW_ID_KEY = 'PAGEDOWN' end
local SHOW_ID_MAX_DISTANCE = tonumber(Config.ShowIdTargetDistance or 4.0) or 4.0

local function hasAnyCadBridgeModalOpen()
  return emergencyUiOpen or driverLicenseUiOpen or vehicleRegistrationUiOpen
end

local function refreshCadBridgeNuiFocus()
  if hasAnyCadBridgeModalOpen() then
    SetNuiFocus(true, true)
  else
    SetNuiFocus(false, false)
  end
end

local function normalizeMugshotValue(value)
  local normalized = trim(value)
  if normalized == '' then return '' end
  if normalized:match('^https?://') then return normalized end
  if normalized:match('^data:image/') then return normalized end

  -- MugShotBase64/screenshot exports can return raw base64 data; convert to browser-safe data URI.
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
    -- MugShotBase64 transparent mode downsamples to 64x64. Prefer full-res first.
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
    -- Keep transparent capture as low-priority fallback for compatibility.
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

local function captureMugshotViaScreenshot()
  local resourceName = trim(Config.ScreenshotResource or 'screencapture')
  if resourceName == '' then return '' end
  if GetResourceState(resourceName) ~= 'started' then return '' end

  local ped = PlayerPedId()
  if not ped or ped == 0 then return '' end

  local headPos = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
  if not headPos then return '' end

  local forward = GetEntityForwardVector(ped)
  -- Position camera in front of the ped's face for a tight portrait-style headshot.
  -- 0.75 units forward, slightly above eye level for a flattering angle.
  local camX = (headPos.x or 0.0) + (forward.x or 0.0) * 0.75
  local camY = (headPos.y or 0.0) + (forward.y or 0.0) * 0.75
  local camZ = (headPos.z or 0.0) + 0.06
  -- Look point centred on the face, slightly below head bone for a natural framing.
  local lookX = (headPos.x or 0.0) + (forward.x or 0.0) * 0.02
  local lookY = (headPos.y or 0.0) + (forward.y or 0.0) * 0.02
  local lookZ = (headPos.z or 0.0) - 0.02

  local cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
  SetCamCoord(cam, camX, camY, camZ)
  PointCamAtCoord(cam, lookX, lookY, lookZ)
  -- Tight FOV (28) gives a telephoto look — less barrel distortion, more flattering face.
  SetCamFov(cam, 28.0)
  RenderScriptCams(true, false, 0, true, true)

  local pedWasFrozen = false
  if type(IsEntityPositionFrozen) == 'function' then
    pedWasFrozen = IsEntityPositionFrozen(ped) == true
  end
  if not pedWasFrozen and type(FreezeEntityPosition) == 'function' then
    FreezeEntityPosition(ped, true)
  end

  -- Force the player to face and look at the camera for a clean mugshot.
  if type(TaskTurnPedToFaceCoord) == 'function' then
    TaskTurnPedToFaceCoord(ped, camX, camY, camZ, 700)
  end
  if type(TaskLookAtCoord) == 'function' then
    TaskLookAtCoord(ped, camX, camY, camZ, 2200, 0, 2)
  end
  -- Allow time for the ped to turn and settle into position before capturing.
  Wait(350)

  local done = false
  local raw = ''
  local hideUi = true
  CreateThread(function()
    while hideUi do
      HideHudAndRadarThisFrame()
      HideHudComponentThisFrame(1)  -- Wanted stars
      HideHudComponentThisFrame(2)  -- Weapon icon
      HideHudComponentThisFrame(3)  -- Cash
      HideHudComponentThisFrame(6)  -- Vehicle name
      HideHudComponentThisFrame(7)  -- Area name
      HideHudComponentThisFrame(8)  -- Vehicle class
      HideHudComponentThisFrame(9)  -- Street name
      HideHudComponentThisFrame(13) -- Cash change
      Wait(0)
    end
  end)

  local screenshotOptions = {
    encoding = trim(Config.ScreenshotEncoding or 'jpg'):lower(),
    quality = tonumber(Config.ScreenshotQuality or 0.95) or 0.95,
  }

  local ok = pcall(function()
    exports[resourceName]:requestScreenshot(screenshotOptions, function(data)
      raw = data or ''
      done = true
    end)
  end)

  if ok then
    local timeoutMs = tonumber(Config.ScreenshotTimeoutMs or 8000) or 8000
    if timeoutMs < 1000 then timeoutMs = 1000 end
    local deadline = GetGameTimer() + timeoutMs
    while not done and GetGameTimer() < deadline do
      Wait(0)
    end
  end

  hideUi = false
  RenderScriptCams(false, false, 0, true, true)
  DestroyCam(cam, false)
  if type(ClearPedSecondaryTask) == 'function' then
    ClearPedSecondaryTask(ped)
  end
  if not pedWasFrozen and type(FreezeEntityPosition) == 'function' then
    FreezeEntityPosition(ped, false)
  end

  if not ok or not done then
    return ''
  end
  return normalizeScreenshotResult(raw)
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

  local state = { done = false, result = '' }
  headshotCapturePending = state

  SendNUIMessage({
    action = 'cadBridgeHeadshot:capture',
    txdName = txdName,
  })

  local captureDeadline = GetGameTimer() + 5000
  while not state.done and GetGameTimer() < captureDeadline do
    Wait(50)
  end

  headshotCapturePending = nil
  UnregisterPedHeadshot(handle)
  return state.result
end

local function captureMugshotUrl()
  local provider = trim(Config.MugshotProvider or 'screencapture'):lower()
  if provider == '' then provider = 'screencapture' end

  if provider == 'screencapture' then
    local headshot = captureMugshotViaHeadshot()
    if headshot ~= '' then return headshot end
    local screenshot = captureMugshotViaScreenshot()
    if screenshot ~= '' then return screenshot end
    return captureMugshotViaLegacyExport()
  end

  if provider == 'screenshot-basic' then
    local screenshot = captureMugshotViaScreenshot()
    if screenshot ~= '' then return screenshot end
    return captureMugshotViaLegacyExport()
  end

  if provider == 'mugshotbase64' then
    local legacy = captureMugshotViaLegacyExport()
    if legacy ~= '' then return legacy end
    return captureMugshotViaScreenshot()
  end

  -- auto fallback mode: try headshot first, then screencapture, then legacy
  local headshot = captureMugshotViaHeadshot()
  if headshot ~= '' then return headshot end
  local screenshot = captureMugshotViaScreenshot()
  if screenshot ~= '' then return screenshot end
  return captureMugshotViaLegacyExport()
end

local function splitMugshotPayload(value)
  local normalized = trim(value)
  if normalized == '' then return '', '' end
  if normalized:match('^data:image/') then
    return normalized, ''
  end
  if normalized:match('^https?://') then
    return '', normalized
  end

  -- Safety fallback if an export returns raw base64.
  if #normalized > 100 and normalized:match('^[A-Za-z0-9+/=]+$') then
    local encoding = trim(Config.ScreenshotEncoding or 'jpg'):lower()
    if encoding == 'jpg' then encoding = 'jpeg' end
    if encoding ~= 'jpeg' and encoding ~= 'png' and encoding ~= 'webp' then
      encoding = 'jpeg'
    end
    return ('data:image/%s;base64,%s'):format(encoding, normalized), ''
  end

  -- Unknown non-data format; pass through as URL/text for compatibility.
  return '', normalized
end

local GTA_COLOUR_NAMES = {
  [0] = 'Black', [1] = 'Graphite', [2] = 'Black Steel', [3] = 'Dark Silver', [4] = 'Silver',
  [5] = 'Bluish Silver', [6] = 'Rolled Steel', [7] = 'Shadow Silver', [8] = 'Stone Silver', [9] = 'Midnight Silver',
  [10] = 'Cast Iron Silver', [11] = 'Anthracite Black', [12] = 'Matte Black', [13] = 'Matte Gray', [14] = 'Matte Light Gray',
  [15] = 'Util Black', [16] = 'Util Black Poly', [17] = 'Util Dark Silver', [18] = 'Util Silver', [19] = 'Util Gun Metal',
  [20] = 'Util Shadow Silver', [21] = 'Worn Black', [22] = 'Worn Graphite', [23] = 'Worn Silver Grey', [24] = 'Worn Silver',
  [25] = 'Worn Blue Silver', [26] = 'Worn Shadow Silver', [27] = 'Red', [28] = 'Torino Red', [29] = 'Formula Red',
  [30] = 'Blaze Red', [31] = 'Graceful Red', [32] = 'Garnet Red', [33] = 'Sunset Red', [34] = 'Cabernet Red',
  [35] = 'Candy Red', [36] = 'Sunrise Orange', [37] = 'Gold', [38] = 'Orange', [39] = 'Matte Red',
  [40] = 'Matte Dark Red', [41] = 'Matte Orange', [42] = 'Matte Yellow', [43] = 'Util Red', [44] = 'Util Bright Red',
  [45] = 'Util Garnet Red', [46] = 'Worn Red', [47] = 'Worn Golden Red', [48] = 'Worn Dark Red', [49] = 'Dark Green',
  [50] = 'Racing Green', [51] = 'Sea Green', [52] = 'Olive Green', [53] = 'Green', [54] = 'Gasoline Green',
  [55] = 'Matte Lime Green', [56] = 'Util Dark Green', [57] = 'Util Green', [58] = 'Worn Dark Green', [59] = 'Worn Green',
  [60] = 'Worn Sea Wash', [61] = 'Midnight Blue', [62] = 'Dark Blue', [63] = 'Saxony Blue', [64] = 'Blue',
  [65] = 'Mariner Blue', [66] = 'Harbor Blue', [67] = 'Diamond Blue', [68] = 'Surf Blue', [69] = 'Nautical Blue',
  [70] = 'Racing Blue', [71] = 'Ultra Blue', [72] = 'Light Blue', [73] = 'Chocolate Brown', [74] = 'Bison Brown',
  [75] = 'Creek Brown', [76] = 'Feltzer Brown', [77] = 'Maple Brown', [78] = 'Beechwood Brown', [79] = 'Sienna Brown',
  [80] = 'Saddle Brown', [81] = 'Moss Brown', [82] = 'Woodbeech Brown', [83] = 'Straw Brown', [84] = 'Sandy Brown',
  [85] = 'Bleached Brown', [86] = 'Schafter Purple', [87] = 'Spinnaker Purple', [88] = 'Midnight Purple', [89] = 'Bright Purple',
  [90] = 'Cream', [91] = 'Ice White', [92] = 'Frost White',
}

local function resolveVehicleColourName(index)
  local id = tonumber(index)
  if id == nil then return 'Unknown' end
  id = math.floor(id)
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

local function getCurrentVehicleRegistrationDefaults()
  local payload = {
    plate = '',
    vehicle_model = '',
    vehicle_colour = '',
  }

  local ped = PlayerPedId()
  if not ped or ped == 0 then return payload end
  if not IsPedInAnyVehicle(ped, false) then return payload end

  local vehicle = GetVehiclePedIsIn(ped, false)
  if not vehicle or vehicle == 0 then return payload end
  if GetPedInVehicleSeat(vehicle, -1) ~= ped then return payload end

  local plate = trim(GetVehicleNumberPlateText(vehicle) or '')
  local modelHash = GetEntityModel(vehicle)
  local model = GetDisplayNameFromVehicleModel(modelHash)
  if model and model ~= '' then
    local localized = GetLabelText(model)
    if localized and localized ~= '' and localized ~= 'NULL' then
      model = localized
    end
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

  local defaults = getCurrentVehicleRegistrationDefaults()
  local nextPayload = payload or {}
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
    local message = 'You must be in the driver seat of a vehicle to auto-fill registration details.'
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
    print('[cad_bridge] Capturing mugshot...')
    local capturedMugshot = captureMugshotUrl()
    local mugshotData, mugshotUrl = splitMugshotPayload(capturedMugshot)
    print(('[cad_bridge] Mugshot captured (data_len=%d url_len=%d). Triggering submitDriverLicense server event...'):format(
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

AddEventHandler('onResourceStop', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
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
    Wait(math.max(1000, Config.HeartbeatIntervalMs))

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

-- ============================================================================
-- CAD custom radio (adapter: cad-radio)
--
-- This handles radio routing entirely inside cad_bridge.
-- We use a dedicated voice target slot so we do not fight proximity logic.
-- ============================================================================
local CAD_RADIO_ENABLED = Config.RadioEnabled ~= false
local CAD_RADIO_TARGET_ID = tonumber(Config.RadioTargetId or 2) or 2
local CAD_PROXIMITY_TARGET_ID = tonumber(Config.ProximityTargetId or 1) or 1
local CAD_RADIO_RX_VOLUME = tonumber(Config.RadioRxVolume or 0.35) or 0.35
local CAD_RADIO_PTT_KEY = tostring(Config.RadioPttKey or 'LMENU')
local CAD_RADIO_FOLLOW_NATIVE_PTT = Config.RadioFollowNativePtt ~= false
local CAD_RADIO_FORWARD_ROOT = Config.RadioForwardRoot ~= false
local CAD_RADIO_UI_ENABLED = Config.RadioUiEnabled ~= false
local CAD_RADIO_UI_KEY = tostring(Config.RadioUiKey or 'EQUALS')
local CAD_RADIO_MAX_CHANNEL = tonumber(Config.RadioMaxFrequency or 500) or 500
local CAD_RADIO_UI_KVP = 'cad_bridge_radio_ui_settings'

if CAD_RADIO_TARGET_ID < 1 or CAD_RADIO_TARGET_ID > 30 then
  CAD_RADIO_TARGET_ID = 2
end
if CAD_PROXIMITY_TARGET_ID < 0 or CAD_PROXIMITY_TARGET_ID > 30 then
  CAD_PROXIMITY_TARGET_ID = 1
end
if CAD_RADIO_RX_VOLUME < 0.0 then CAD_RADIO_RX_VOLUME = 0.0 end
if CAD_RADIO_RX_VOLUME > 1.0 then CAD_RADIO_RX_VOLUME = 1.0 end

local cadRadioChannel = 0
local cadRadioMembers = {}
local cadRadioMemberBySource = {}
local cadRadioTalkingStateBySource = {}
local cadRadioPttPressed = false
local cadRadioManualPttWanted = false
local cadRadioLastTargetBuildAt = 0
local cadRadioLastNoRouteLogAt = 0
local cadRadioSubmixId = -1
local cadRadioRxVolume = CAD_RADIO_RX_VOLUME
local cadRadioMutedBySource = {}
local cadRadioUiVisible = false
local cadExternalVoiceSession = nil
local cadExternalVoiceLastLogAt = 0

local function isCadExternalVoiceSessionActive()
  if Config.ExternalVoiceTokenEnabled ~= true then
    return false
  end
  if type(cadExternalVoiceSession) ~= 'table' then
    return false
  end
  if cadExternalVoiceSession.ok ~= true then
    return false
  end
  local provider = tostring(cadExternalVoiceSession.provider or ''):lower()
  local token = tostring(cadExternalVoiceSession.token or '')
  if provider ~= 'livekit' or token == '' then
    return false
  end
  local expiresAtMs = tonumber(cadExternalVoiceSession.expires_at_ms or 0) or 0
  if expiresAtMs > 0 then
    local now = tonumber(GetGameTimer() or 0) or 0
    if expiresAtMs <= (now + 1000) then
      return false
    end
  end
  return true
end

local function shouldUseCadExternalVoiceTransport()
  return isCadExternalVoiceSessionActive()
end

local cadRadioUiSettings = {
  name = '',
  favourite = {},
  recomended = {},
  muted = {},
  volume = math.floor((CAD_RADIO_RX_VOLUME or 0.35) * 100.0 + 0.5),
  userData = {
    name = '',
    favourite = {},
    overlaySizeMultiplier = 50,
    radioSizeMultiplier = 50,
    allowMovement = false,
    enableClicks = true,
    playerlist = {
      show = false,
      coords = { x = 15.0, y = 40.0 },
    },
    radio = {
      coords = { x = 10, y = 15 },
    },
  },
}

local CAD_RADIO_UI_LOCALE = {
  ['ui.header'] = 'IN RADIO',
  ['ui.frequency'] = 'Frequency',
  ['ui.disconnect'] = 'DISCONNECT',
  ['ui.notconnected'] = 'NOT CONNECTED',
  ['ui.settings'] = 'Settings',
  ['ui.channels'] = 'Channels',
  ['ui.radio'] = 'Radio',
  ['ui.members'] = 'Members',
  ['ui.favorites'] = 'Favorites',
  ['ui.recommended'] = 'Recommended',
  ['ui.clear'] = 'CLEAR',
  ['ui.hide_overlay'] = 'HIDE OVERLAY',
  ['ui.show_overlay'] = 'SHOW OVERLAY',
  ['ui.save'] = 'SAVE',
  ['ui.radio_settings'] = 'Radio Settings',
  ['ui.move_radio'] = 'Move Radio',
  ['ui.allow_move'] = 'Allow Move',
  ['ui.overlay_settings'] = 'Overlay Settings',
  ['ui.enableClicks'] = 'Radio Sound',
}

local function isCadRadioAdapterActive()
  local adapter = tostring(Config.RadioAdapter or 'cad-radio'):lower()
  return adapter == 'cad-radio' or adapter == 'cad_radio'
end

local function getLocalServerId()
  return tonumber(GetPlayerServerId(PlayerId()) or 0) or 0
end

local function isPlayerDeadForCadRadio()
  if LocalPlayer and LocalPlayer.state and LocalPlayer.state.isDead then
    return true
  end
  return IsPlayerDead(PlayerId())
end

local function getCadRadioSubmixId()
  if cadRadioSubmixId ~= -1 then return cadRadioSubmixId end
  if GetGameName() ~= 'fivem' then return -1 end

  local mix = CreateAudioSubmix('CADBridgeRadio')
  SetAudioSubmixEffectRadioFx(mix, 0)
  SetAudioSubmixEffectParamInt(mix, 0, `default`, 1)
  AddAudioSubmixOutput(mix, 0)
  cadRadioSubmixId = mix
  return cadRadioSubmixId
end

local function playCadRadioMicClick(isOn)
  if cadRadioUiSettings.userData.enableClicks ~= true then return end
  -- Fallback click sounds; can be swapped for custom audio later.
  local soundName = isOn and 'SELECT' or 'BACK'
  local soundSet = 'HUD_FRONTEND_DEFAULT_SOUNDSET'
  pcall(function()
    PlaySoundFrontend(-1, soundName, soundSet, false)
  end)
end

local function cadRadioGetLocalDisplayName()
  local cached = tostring(cadRadioUiSettings.userData.name or ''):gsub('^%s+', ''):gsub('%s+$', '')
  if cached ~= '' then
    return cached
  end
  local fallback = GetPlayerName(PlayerId()) or ('Player ' .. tostring(getLocalServerId()))
  fallback = tostring(fallback or ''):gsub('^%s+', ''):gsub('%s+$', '')
  if fallback == '' then
    fallback = 'Operator'
  end
  cadRadioUiSettings.userData.name = fallback
  return fallback
end

local function cadRadioSaveUiSettings()
  SetResourceKvp(CAD_RADIO_UI_KVP, json.encode(cadRadioUiSettings))
end

local function cadRadioLoadUiSettings()
  local raw = GetResourceKvpString(CAD_RADIO_UI_KVP)
  if not raw or raw == '' then
    cadRadioUiSettings.userData.name = cadRadioGetLocalDisplayName()
    cadRadioSaveUiSettings()
    return
  end

  local ok, data = pcall(json.decode, raw)
  if not ok or type(data) ~= 'table' then
    cadRadioUiSettings.userData.name = cadRadioGetLocalDisplayName()
    cadRadioSaveUiSettings()
    return
  end

  if type(data.favourite) == 'table' then
    cadRadioUiSettings.favourite = data.favourite
    cadRadioUiSettings.userData.favourite = data.favourite
  end
  if type(data.recomended) == 'table' then
    cadRadioUiSettings.recomended = data.recomended
  end
  if type(data.muted) == 'table' then
    cadRadioUiSettings.muted = data.muted
  end
  if tonumber(data.volume) then
    cadRadioUiSettings.volume = math.max(0, math.min(100, math.floor(tonumber(data.volume))))
  end
  if type(data.userData) == 'table' then
    local user = data.userData
    if type(user.name) == 'string' then
      cadRadioUiSettings.userData.name = user.name
    end
    if type(user.favourite) == 'table' then
      cadRadioUiSettings.userData.favourite = user.favourite
    end
    if tonumber(user.overlaySizeMultiplier) then
      cadRadioUiSettings.userData.overlaySizeMultiplier = math.max(25, math.min(75, math.floor(tonumber(user.overlaySizeMultiplier))))
    end
    if tonumber(user.radioSizeMultiplier) then
      cadRadioUiSettings.userData.radioSizeMultiplier = math.max(25, math.min(75, math.floor(tonumber(user.radioSizeMultiplier))))
    end
    if user.allowMovement ~= nil then
      cadRadioUiSettings.userData.allowMovement = user.allowMovement == true
    end
    if user.enableClicks ~= nil then
      cadRadioUiSettings.userData.enableClicks = user.enableClicks == true
    end
    if type(user.playerlist) == 'table' then
      if user.playerlist.show ~= nil then
        cadRadioUiSettings.userData.playerlist.show = user.playerlist.show == true
      end
      if type(user.playerlist.coords) == 'table' then
        cadRadioUiSettings.userData.playerlist.coords.x = tonumber(user.playerlist.coords.x) or cadRadioUiSettings.userData.playerlist.coords.x
        cadRadioUiSettings.userData.playerlist.coords.y = tonumber(user.playerlist.coords.y) or cadRadioUiSettings.userData.playerlist.coords.y
      end
    end
    if type(user.radio) == 'table' and type(user.radio.coords) == 'table' then
      cadRadioUiSettings.userData.radio.coords.x = tonumber(user.radio.coords.x) or cadRadioUiSettings.userData.radio.coords.x
      cadRadioUiSettings.userData.radio.coords.y = tonumber(user.radio.coords.y) or cadRadioUiSettings.userData.radio.coords.y
    end
  end

  cadRadioUiSettings.userData.name = cadRadioGetLocalDisplayName()
  if type(cadRadioUiSettings.userData.favourite) ~= 'table' then
    cadRadioUiSettings.userData.favourite = {}
  end
  if type(cadRadioUiSettings.favourite) ~= 'table' then
    cadRadioUiSettings.favourite = {}
  end
  cadRadioUiSettings.userData.favourite = cadRadioUiSettings.favourite
end

local function cadRadioBuildMutedPayload()
  local payload = {}
  for sourceId, _ in pairs(cadRadioMutedBySource) do
    local src = tonumber(sourceId) or 0
    if src > 0 then
      payload[src - 1] = true
    end
  end
  return payload
end

local function cadRadioBuildUiMemberList()
  local members = {}
  for _, member in ipairs(cadRadioMembers) do
    local src = tonumber(member.source) or 0
    if src > 0 then
      members[tostring(src)] = {
        name = tostring(member.name or ('Player ' .. tostring(src))),
        isTalking = member.talking == true,
      }
    end
  end
  return members
end

local function cadRadioGetClockText()
  local hour = tonumber(GetClockHours()) or 0
  local minute = tonumber(GetClockMinutes()) or 0
  return string.format('%02d:%02d', hour, minute)
end

local function cadRadioGetStreetText()
  local ped = PlayerPedId()
  if ped == 0 then return 'Unknown' end
  local pos = GetEntityCoords(ped)
  local street1, street2 = GetStreetNameAtCoord(pos.x, pos.y, pos.z)
  if street2 and street2 ~= 0 then
    return GetStreetNameFromHashKey(street2) or 'Unknown'
  end
  return GetStreetNameFromHashKey(street1) or 'Unknown'
end

local function cadRadioBuildUiPayload()
  return {
    radioId = 'PERSONAL',
    onRadio = cadRadioChannel > 0,
    channel = cadRadioChannel,
    volume = cadRadioUiSettings.volume,
    favourite = cadRadioUiSettings.favourite,
    recomended = cadRadioUiSettings.recomended,
    userData = cadRadioUiSettings.userData,
    time = cadRadioGetClockText(),
    street = cadRadioGetStreetText(),
    maxChannel = CAD_RADIO_MAX_CHANNEL,
    locale = CAD_RADIO_UI_LOCALE,
    channelName = type(Config.RadioNames) == 'table' and Config.RadioNames or {},
    insideJammerZone = false,
    battery = 100,
    overlay = tostring(Config.RadioOverlayMode or 'default'),
  }
end

local function cadRadioSendNui(action, data)
  SendNUIMessage({
    action = action,
    data = data,
  })
end

local function cadRadioPushExternalVoiceSession()
  if type(cadExternalVoiceSession) == 'table' then
    cadRadioSendNui('externalVoiceSession', cadExternalVoiceSession)
    return
  end
  cadRadioSendNui('externalVoiceSession', {
    ok = false,
    cleared = true,
    reason = 'no_session',
  })
end

local function cadRadioPushUiState()
  cadRadioSendNui('updateRadio', cadRadioBuildUiPayload())
  cadRadioSendNui('updateRadioList', cadRadioBuildUiMemberList())
  cadRadioPushExternalVoiceSession()
end

local function cadRadioCloseUi()
  if not cadRadioUiVisible then return end
  cadRadioUiVisible = false
  SetNuiFocus(false, false)
  SetNuiFocusKeepInput(false)
  cadRadioSendNui('setRadioHide', nil)
end

local function cadRadioOpenUi()
  if not CAD_RADIO_ENABLED or not CAD_RADIO_UI_ENABLED or not isCadRadioAdapterActive() then return end
  cadRadioUiVisible = true
  SetNuiFocus(true, true)
  SetNuiFocusKeepInput(cadRadioUiSettings.userData.allowMovement == true)
  cadRadioSendNui('setRadioVisible', cadRadioBuildUiPayload())
  cadRadioSendNui('updateRadioList', cadRadioBuildUiMemberList())
  cadRadioPushExternalVoiceSession()
end

cadRadioLoadUiSettings()
cadRadioRxVolume = math.max(0.0, math.min(1.0, (tonumber(cadRadioUiSettings.volume) or 35) / 100.0))

if type(cadRadioUiSettings.muted) == 'table' then
  for sourceId, value in pairs(cadRadioUiSettings.muted) do
    if value == true then
      local src = tonumber(sourceId) or 0
      if src > 0 then
        cadRadioMutedBySource[src] = true
      end
    end
  end
end

local function setRemoteCadRadioTalking(sourceId, enabled)
  local src = tonumber(sourceId) or 0
  if src <= 0 then return end
  if src == getLocalServerId() then return end

  cadRadioTalkingStateBySource[src] = enabled == true

  if shouldUseCadExternalVoiceTransport() then
    -- External transport carries remote audio; ensure local Mumble overrides are removed.
    MumbleSetVolumeOverrideByServerId(src, -1.0)
    MumbleSetSubmixForServerId(src, -1)
    return
  end

  if enabled and cadRadioMutedBySource[src] ~= true then
    MumbleSetVolumeOverrideByServerId(src, cadRadioRxVolume)
    local submix = getCadRadioSubmixId()
    if submix ~= -1 then
      MumbleSetSubmixForServerId(src, submix)
    end
  else
    MumbleSetVolumeOverrideByServerId(src, -1.0)
    MumbleSetSubmixForServerId(src, -1)
  end
end

local function clearAllRemoteCadRadioTalking()
  for src, _ in pairs(cadRadioTalkingStateBySource) do
    setRemoteCadRadioTalking(src, false)
  end
  cadRadioTalkingStateBySource = {}
end

local function cadRadioReapplyRemoteAudio()
  for src, talking in pairs(cadRadioTalkingStateBySource) do
    setRemoteCadRadioTalking(src, talking == true)
  end
end

local function rebuildCadRadioTarget()
  if shouldUseCadExternalVoiceTransport() then
    MumbleClearVoiceTargetPlayers(CAD_RADIO_TARGET_ID)
    MumbleSetVoiceTarget(CAD_PROXIMITY_TARGET_ID)
    return {
      peerTargets = 0,
      rootTargets = 0,
      totalTargets = 0,
      external = true,
    }
  end

  MumbleClearVoiceTarget(CAD_RADIO_TARGET_ID)
  MumbleSetVoiceTarget(CAD_RADIO_TARGET_ID)
  MumbleClearVoiceTargetPlayers(CAD_RADIO_TARGET_ID)

  local localSource = getLocalServerId()
  local peerTargets = 0
  for src, _ in pairs(cadRadioMemberBySource) do
    if src ~= localSource then
      MumbleAddVoiceTargetPlayerByServerId(CAD_RADIO_TARGET_ID, src)
      peerTargets = peerTargets + 1
    end
  end

  local rootTargets = 0
  if CAD_RADIO_FORWARD_ROOT then
    -- Legacy compatibility path only (disabled by default): forward TX to root channel.
    MumbleAddVoiceTargetChannel(CAD_RADIO_TARGET_ID, 0)
    rootTargets = 1
  end

  return {
    peerTargets = peerTargets,
    rootTargets = rootTargets,
    totalTargets = peerTargets + rootTargets,
  }
end

local function setCadRadioPttState(enabled)
  if not CAD_RADIO_ENABLED or not isCadRadioAdapterActive() then return end
  local isEnabled = enabled == true
  if cadRadioPttPressed == isEnabled then return end

  if isEnabled then
    if cadRadioChannel <= 0 then return end
    if isPlayerDeadForCadRadio() then return end
    cadRadioPttPressed = true
    local usingExternalTransport = shouldUseCadExternalVoiceTransport()
    local routeStats = {
      peerTargets = 0,
      rootTargets = 0,
      totalTargets = 0,
      external = usingExternalTransport,
    }
    if not usingExternalTransport then
      routeStats = rebuildCadRadioTarget()
      cadRadioLastTargetBuildAt = tonumber(GetGameTimer() or 0) or 0
      MumbleSetVoiceTarget(CAD_RADIO_TARGET_ID)
    else
      cadRadioLastTargetBuildAt = 0
    end
    TriggerServerEvent('cad_bridge:radio:setTalking', true)
    cadRadioSendNui('updateRadioTalking', {
      radioId = tostring(getLocalServerId()),
      radioTalking = true,
    })
    if not usingExternalTransport and routeStats and routeStats.totalTargets <= 0 then
      local nowMs = tonumber(GetGameTimer() or 0) or 0
      if (nowMs - cadRadioLastNoRouteLogAt) >= 5000 then
        cadRadioLastNoRouteLogAt = nowMs
        print(('[cad_bridge][radio] tx-start channel=%s peer_targets=%s root_targets=%s total_targets=%s no_route_reason=no_members_and_root_forward_disabled'):format(
          tostring(cadRadioChannel),
          tostring(routeStats.peerTargets or 0),
          tostring(routeStats.rootTargets or 0),
          tostring(routeStats.totalTargets or 0)
        ))
      end
    elseif not usingExternalTransport then
      print(('[cad_bridge][radio] tx-start channel=%s peer_targets=%s root_targets=%s total_targets=%s'):format(
        tostring(cadRadioChannel),
        tostring(routeStats and routeStats.peerTargets or 0),
        tostring(routeStats and routeStats.rootTargets or 0),
        tostring(routeStats and routeStats.totalTargets or 0)
      ))
    else
      print(('[cad_bridge][radio] tx-start channel=%s transport=external provider=%s'):format(
        tostring(cadRadioChannel),
        tostring(cadExternalVoiceSession and cadExternalVoiceSession.provider or 'unknown')
      ))
    end
    playCadRadioMicClick(true)
    return
  end

  cadRadioPttPressed = false
  cadRadioLastTargetBuildAt = 0
  TriggerServerEvent('cad_bridge:radio:setTalking', false)
  cadRadioSendNui('updateRadioTalking', {
    radioId = tostring(getLocalServerId()),
    radioTalking = false,
  })
  MumbleClearVoiceTargetPlayers(CAD_RADIO_TARGET_ID)
  MumbleSetVoiceTarget(CAD_PROXIMITY_TARGET_ID)
  playCadRadioMicClick(false)
end

RegisterNetEvent('cad_bridge:radio:update', function(payload)
  if not CAD_RADIO_ENABLED or not isCadRadioAdapterActive() then return end
  if type(payload) ~= 'table' then return end

  local previousChannel = cadRadioChannel
  local nextChannel = tonumber(payload.channel_number) or 0
  local nextMembers = {}
  local nextBySource = {}

  if type(payload.members) == 'table' then
    for _, row in ipairs(payload.members) do
      local src = tonumber(row.source) or 0
      if src > 0 then
        local item = {
          source = src,
          name = tostring(row.name or ('Player ' .. tostring(src))),
          talking = row.talking == true,
        }
        nextMembers[#nextMembers + 1] = item
        nextBySource[src] = item
      end
    end
  end

  cadRadioChannel = nextChannel
  cadRadioMembers = nextMembers
  cadRadioMemberBySource = nextBySource

  for src, _ in pairs(cadRadioTalkingStateBySource) do
    if not cadRadioMemberBySource[src] then
      setRemoteCadRadioTalking(src, false)
    end
  end

  for _, member in ipairs(cadRadioMembers) do
    setRemoteCadRadioTalking(member.source, member.talking == true)
  end

  if cadRadioPttPressed and cadRadioChannel <= 0 then
    setCadRadioPttState(false)
  elseif cadRadioPttPressed then
    if not shouldUseCadExternalVoiceTransport() then
      rebuildCadRadioTarget()
    end
  end

  if previousChannel ~= cadRadioChannel then
    if cadRadioChannel > 0 then
      triggerCadOxNotify({
        title = 'CAD Radio',
        description = ('Joined channel %s'):format(tostring(cadRadioChannel)),
        type = 'inform',
      })
      TriggerServerEvent('cad_bridge:external_voice:refresh')
    elseif previousChannel > 0 then
      triggerCadOxNotify({
        title = 'CAD Radio',
        description = ('Left channel %s'):format(tostring(previousChannel)),
        type = 'inform',
      })
      cadExternalVoiceSession = nil
      cadRadioPushExternalVoiceSession()
    end
  end

  local memberList = cadRadioBuildUiMemberList()
  cadRadioSendNui('updateRadioList', memberList)
  cadRadioPushUiState()
end)

RegisterNetEvent('cad_bridge:external_voice:session', function(payload)
  if type(payload) ~= 'table' then return end

  if payload.ok == true and type(payload.token) == 'string' and payload.token ~= '' then
    cadExternalVoiceSession = {
      ok = true,
      provider = tostring(payload.provider or ''),
      url = tostring(payload.url or ''),
      room_name = tostring(payload.room_name or ''),
      identity = tostring(payload.identity or ''),
      token = tostring(payload.token or ''),
      channel_number = tonumber(payload.channel_number) or 0,
      channel_type = tostring(payload.channel_type or 'radio'),
      expires_in_seconds = tonumber(payload.expires_in_seconds) or 0,
      issued_at_ms = tonumber(payload.issued_at_ms) or 0,
      expires_at_ms = tonumber(payload.expires_at_ms) or 0,
    }

    cadRadioPushExternalVoiceSession()
    cadRadioReapplyRemoteAudio()
    if cadRadioPttPressed then
      cadRadioLastTargetBuildAt = 0
      rebuildCadRadioTarget()
    end
    return
  end

  cadExternalVoiceSession = nil
  cadRadioPushExternalVoiceSession()
  cadRadioReapplyRemoteAudio()
  if cadRadioPttPressed then
    rebuildCadRadioTarget()
  end

  local nowMs = tonumber(GetGameTimer() or 0) or 0
  if (nowMs - cadExternalVoiceLastLogAt) >= 5000 then
    cadExternalVoiceLastLogAt = nowMs
    print(('[cad_bridge][external_voice] session cleared (reason=%s)'):format(
      tostring(payload.reason or 'cleared')
    ))
  end
end)

RegisterNetEvent('cad_bridge:radio:setTalking', function(sourceId, enabled)
  if not CAD_RADIO_ENABLED or not isCadRadioAdapterActive() then return end
  local src = tonumber(sourceId) or 0
  local member = cadRadioMemberBySource[src]
  if member then
    member.talking = enabled == true
  end
  cadRadioSendNui('updateRadioTalking', {
    radioId = tostring(src),
    radioTalking = enabled == true,
  })
  setRemoteCadRadioTalking(sourceId, enabled == true)
end)

RegisterCommand('+cadbridgeradio', function()
  cadRadioManualPttWanted = true
  setCadRadioPttState(true)
end, false)

RegisterCommand('-cadbridgeradio', function()
  cadRadioManualPttWanted = false
  if not CAD_RADIO_FOLLOW_NATIVE_PTT or not NetworkIsPlayerTalking(PlayerId()) then
    setCadRadioPttState(false)
  end
end, false)

RegisterKeyMapping('+cadbridgeradio', 'CAD Radio Push-To-Talk', 'keyboard', CAD_RADIO_PTT_KEY)

local function cadRadioNotify(message, notifyType)
  local text = tostring(message or '')
  if text == '' then return end
  triggerCadOxNotify({
    title = 'CAD Radio',
    description = text,
    type = notifyType or 'inform',
  })
end

local function cadRadioSetVolumePercent(value)
  local percent = tonumber(value) or cadRadioUiSettings.volume or 35
  percent = math.max(0, math.min(100, math.floor(percent)))
  cadRadioUiSettings.volume = percent
  cadRadioRxVolume = percent / 100.0
  cadRadioSaveUiSettings()
  cadRadioReapplyRemoteAudio()
  cadRadioPushUiState()
end

local function cadRadioIsChannelInList(list, channel)
  local target = tonumber(channel) or 0
  if target <= 0 or type(list) ~= 'table' then return false end
  for _, value in ipairs(list) do
    if tonumber(value) == target then
      return true
    end
  end
  return false
end

local function cadRadioAddRecommended(channel)
  local ch = tonumber(channel) or 0
  if ch <= 0 then return end
  if cadRadioIsChannelInList(cadRadioUiSettings.recomended, ch) then return end
  cadRadioUiSettings.recomended[#cadRadioUiSettings.recomended + 1] = ch
  cadRadioSaveUiSettings()
  cadRadioPushUiState()
end

local function cadRadioFailureMessage(reason, channel)
  local ch = tonumber(channel) or 0
  if reason == 'invalid_channel' then
    return ('Station %.2f MHz is not available'):format(ch)
  end
  if reason == 'restricted_channel' then
    return ('You are not allowed to join Station %.2f MHz'):format(ch)
  end
  return 'Unable to join radio channel right now.'
end

RegisterNetEvent('cad_bridge:radio:uiJoinResult', function(success, reason, channel)
  if success == true then
    cadRadioAddRecommended(channel)
    return
  end
  cadRadioNotify(cadRadioFailureMessage(reason, channel), 'error')
end)

RegisterNetEvent('cad_bridge:radio:uiLeaveResult', function(success, reason)
  if success == true then return end
  cadRadioNotify(tostring(reason or 'Unable to leave radio channel right now.'), 'error')
end)

RegisterNUICallback('join', function(data, cb)
  if not CAD_RADIO_ENABLED or not isCadRadioAdapterActive() then
    cb('ok')
    return
  end
  local channel = tonumber(data) or 0
  TriggerServerEvent('cad_bridge:radio:uiJoinRequest', channel, cadRadioGetLocalDisplayName())
  cb('ok')
end)

RegisterNUICallback('leave', function(_, cb)
  TriggerServerEvent('cad_bridge:radio:uiLeaveRequest')
  cb('ok')
end)

RegisterNUICallback('hideUI', function(_, cb)
  cadRadioCloseUi()
  cb('ok')
end)

RegisterNUICallback('volumeChange', function(data, cb)
  cadRadioSetVolumePercent(data)
  cb('ok')
end)

RegisterNUICallback('toggleMute', function(volume, cb)
  cadRadioSetVolumePercent(volume)
  cb('ok')
end)

RegisterNUICallback('getMutedList', function(_, cb)
  cb(cadRadioBuildMutedPayload())
end)

RegisterNUICallback('togglemutePlayer', function(data, cb)
  local src = tonumber(data) or 0
  if src > 0 and src ~= getLocalServerId() then
    if cadRadioMutedBySource[src] then
      cadRadioMutedBySource[src] = nil
    else
      cadRadioMutedBySource[src] = true
    end
    cadRadioUiSettings.muted = cadRadioMutedBySource
    cadRadioSaveUiSettings()
    setRemoteCadRadioTalking(src, cadRadioTalkingStateBySource[src] == true)
  end
  cb(cadRadioBuildMutedPayload())
end)

RegisterNUICallback('addFav', function(data, cb)
  local channel = tonumber(data) or 0
  if channel > 0 and not cadRadioIsChannelInList(cadRadioUiSettings.favourite, channel) then
    cadRadioUiSettings.favourite[#cadRadioUiSettings.favourite + 1] = channel
    cadRadioUiSettings.userData.favourite = cadRadioUiSettings.favourite
    cadRadioSaveUiSettings()
    cadRadioPushUiState()
  end
  cb('ok')
end)

RegisterNUICallback('removeFav', function(data, cb)
  local channel = tonumber(data) or 0
  if channel > 0 and type(cadRadioUiSettings.favourite) == 'table' then
    local nextFav = {}
    for _, value in ipairs(cadRadioUiSettings.favourite) do
      if tonumber(value) ~= channel then
        nextFav[#nextFav + 1] = tonumber(value)
      end
    end
    cadRadioUiSettings.favourite = nextFav
    cadRadioUiSettings.userData.favourite = nextFav
    cadRadioSaveUiSettings()
    cadRadioPushUiState()
  end
  cb('ok')
end)

RegisterNUICallback('showPlayerList', function(data, cb)
  cadRadioUiSettings.userData.playerlist.show = data == true
  cadRadioSaveUiSettings()
  cadRadioPushUiState()
  cb('ok')
end)

RegisterNUICallback('updatePlayerListPosition', function(data, cb)
  if type(data) == 'table' then
    cadRadioUiSettings.userData.playerlist.coords.x = tonumber(data.x) or cadRadioUiSettings.userData.playerlist.coords.x
    cadRadioUiSettings.userData.playerlist.coords.y = tonumber(data.y) or cadRadioUiSettings.userData.playerlist.coords.y
    cadRadioSaveUiSettings()
  end
  cb('ok')
end)

RegisterNUICallback('updateRadioPosition', function(data, cb)
  if type(data) == 'table' then
    cadRadioUiSettings.userData.radio.coords.x = tonumber(data.x) or cadRadioUiSettings.userData.radio.coords.x
    cadRadioUiSettings.userData.radio.coords.y = tonumber(data.y) or cadRadioUiSettings.userData.radio.coords.y
    cadRadioSaveUiSettings()
  end
  cb('ok')
end)

RegisterNUICallback('allowMovement', function(data, cb)
  cadRadioUiSettings.userData.allowMovement = data == true
  SetNuiFocusKeepInput(cadRadioUiVisible and cadRadioUiSettings.userData.allowMovement == true)
  cadRadioSaveUiSettings()
  cadRadioPushUiState()
  cb('ok')
end)

RegisterNUICallback('enableClicks', function(data, cb)
  cadRadioUiSettings.userData.enableClicks = data == true
  cadRadioSaveUiSettings()
  cb('ok')
end)

RegisterNUICallback('updateRadioSize', function(data, cb)
  if type(data) == 'table' then
    local radioSize = tonumber(data.radio)
    local overlaySize = tonumber(data.overlay)
    if radioSize then
      cadRadioUiSettings.userData.radioSizeMultiplier = math.max(25, math.min(75, math.floor(radioSize)))
    end
    if overlaySize then
      cadRadioUiSettings.userData.overlaySizeMultiplier = math.max(25, math.min(75, math.floor(overlaySize)))
    end
    cadRadioSaveUiSettings()
    cadRadioPushUiState()
  end
  cb('ok')
end)

RegisterNUICallback('saveData', function(data, cb)
  if type(data) == 'table' then
    local name = tostring(data.name or ''):gsub('^%s+', ''):gsub('%s+$', '')
    if name ~= '' and #name <= 64 then
      cadRadioUiSettings.userData.name = name
      TriggerServerEvent('cad_bridge:radio:setDisplayName', name)
      cadRadioSaveUiSettings()
      cadRadioPushUiState()
    end
  end
  cb('ok')
end)

local function canUseCadRadioUi()
  return CAD_RADIO_ENABLED and CAD_RADIO_UI_ENABLED and isCadRadioAdapterActive()
end

local function cadRadioToggleUi()
  if cadRadioUiVisible then
    cadRadioCloseUi()
  else
    cadRadioOpenUi()
  end
end

local function handleCadRadioCommandArgs(args)
  if type(args) ~= 'table' then return false end
  local first = tostring(args[1] or ''):gsub('^%s+', ''):gsub('%s+$', '')
  if first == '' then return false end

  local lowered = first:lower()
  if lowered == '0' or lowered == 'off' or lowered == 'leave' then
    TriggerServerEvent('cad_bridge:radio:uiLeaveRequest')
    return true
  end

  local channel = tonumber(first)
  if channel and channel > 0 then
    TriggerServerEvent('cad_bridge:radio:uiJoinRequest', channel, cadRadioGetLocalDisplayName())
    return true
  end

  return false
end

RegisterCommand('cadbridgeradio', function(_, args)
  if not canUseCadRadioUi() then return end
  if handleCadRadioCommandArgs(args) then return end
  cadRadioToggleUi()
end, false)

-- Legacy command compatibility.
-- /radio toggles the built-in CAD radio UI, or can be used as:
--   /radio <channel>
--   /radio off
RegisterCommand('radio', function(_, args)
  if not canUseCadRadioUi() then return end
  if handleCadRadioCommandArgs(args) then return end
  cadRadioToggleUi()
end, false)

RegisterKeyMapping('cadbridgeradio', 'Open CAD Radio UI', 'keyboard', CAD_RADIO_UI_KEY)

CreateThread(function()
  while true do
    if cadRadioUiVisible then
      cadRadioSendNui('updateTime', cadRadioGetClockText())
      Wait(1000)
    else
      Wait(500)
    end
  end
end)

CreateThread(function()
  while true do
    if not CAD_RADIO_ENABLED or not isCadRadioAdapterActive() then
      if cadRadioPttPressed then
        setCadRadioPttState(false)
      end
      Wait(500)
      goto continue
    end

    if cadRadioChannel <= 0 then
      if cadRadioPttPressed then
        setCadRadioPttState(false)
      end
      Wait(200)
      goto continue
    end

    local nativeTalking = CAD_RADIO_FOLLOW_NATIVE_PTT and NetworkIsPlayerTalking(PlayerId()) or false
    local shouldTransmit = cadRadioManualPttWanted or nativeTalking

    if cadRadioPttPressed ~= shouldTransmit then
      setCadRadioPttState(shouldTransmit)
    elseif cadRadioPttPressed then
      if not shouldUseCadExternalVoiceTransport() then
        -- pma/proximity scripts can reset the active target every tick.
        -- Reassert CAD radio target while transmitting.
        MumbleSetVoiceTarget(CAD_RADIO_TARGET_ID)

        local nowMs = tonumber(GetGameTimer() or 0) or 0
        if (nowMs - cadRadioLastTargetBuildAt) >= 250 then
          rebuildCadRadioTarget()
          cadRadioLastTargetBuildAt = nowMs
        end
      end
    end

    Wait(25)
    ::continue::
  end
end)

CreateThread(function()
  while true do
    if not CAD_RADIO_ENABLED or not isCadRadioAdapterActive() then
      Wait(1000)
      goto continue
    end

    if cadRadioChannel > 0 then
      local text = ('~y~CAD RADIO~s~ %s %s'):format(
        tostring(cadRadioChannel),
        cadRadioPttPressed and '~r~[TX]~s~' or '~g~[RX]~s~'
      )
      SetTextFont(4)
      SetTextScale(0.32, 0.32)
      SetTextColour(255, 255, 255, 210)
      SetTextOutline()
      SetTextRightJustify(true)
      SetTextWrap(0.0, 0.98)
      BeginTextCommandDisplayText('STRING')
      AddTextComponentSubstringPlayerName(text)
      EndTextCommandDisplayText(0.98, 0.93)
      Wait(0)
    else
      Wait(250)
    end

    ::continue::
  end
end)

AddEventHandler('onClientResourceStop', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  cadRadioManualPttWanted = false
  if cadRadioPttPressed then
    TriggerServerEvent('cad_bridge:radio:setTalking', false)
  end
  cadRadioCloseUi()
  clearAllRemoteCadRadioTalking()
  cadExternalVoiceSession = nil
  cadRadioPushExternalVoiceSession()
  MumbleClearVoiceTargetPlayers(CAD_RADIO_TARGET_ID)
  MumbleSetVoiceTarget(CAD_PROXIMITY_TARGET_ID)
end)
