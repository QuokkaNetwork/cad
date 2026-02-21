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

-- ---------------------------------------------------------------------------
-- Server-side screencapture via serverCapture export
-- ---------------------------------------------------------------------------
-- The client sets up the ped (freeze, camera, backdrop) then asks the server
-- to perform the actual capture using the screencapture server export. This
-- avoids the TriggerServerEvent payload size limit and keeps the image data
-- server-side where it can be saved to disk and included in the API request.
-- ---------------------------------------------------------------------------

local mugshotCaptureResult = nil

RegisterNetEvent('cad_bridge:mugshotCaptureResult', function(success)
  mugshotCaptureResult = success == true
end)

local function captureMugshotViaScreenshot()
  print('[cad_bridge] [screencapture] captureMugshotViaScreenshot() — using server-side capture')

  local ped = PlayerPedId()
  if not ped or ped == 0 then return '' end

  -- Save original ped state for restoration.
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

  -- 1) Freeze the ped and lock heading FIRST, before any animation.
  FreezeEntityPosition(ped, true)
  SetEntityHeading(ped, originalHeading)
  if type(SetNightvision) == 'function' then
    SetNightvision(false)
  end
  if type(SetSeethrough) == 'function' then
    SetSeethrough(false)
  end
  Wait(100)

  -- 2) Trigger the Airforce 2 emote via scully_emotemenu.
  --    This forces a rigid military attention stance — completely still, arms at sides.
  local hasScully = GetResourceState('scully_emotemenu') == 'started'
  if hasScully then
    exports['scully_emotemenu']:cancelEmote()
    Wait(200)
    exports['scully_emotemenu']:playEmoteByCommand('airforce2')
  end

  -- Wait for the emote animation to fully settle into its loop pose.
  Wait(1500)

  -- 3) Force the ped to face the original heading after the emote settles.
  --    Emotes can rotate the ped, so we re-assert heading aggressively.
  SetEntityHeading(ped, originalHeading)
  Wait(100)
  SetEntityHeading(ped, originalHeading)

  -- Force the ped to look straight ahead using a far-away look-at point.
  local headingRad = math.rad(originalHeading)
  local lookX = GetEntityCoords(ped).x + (-math.sin(headingRad)) * 50.0
  local lookY = GetEntityCoords(ped).y + ( math.cos(headingRad)) * 50.0
  local lookZ = GetEntityCoords(ped).z + 0.5
  TaskLookAtCoord(ped, lookX, lookY, lookZ, 5000, 2048 + 16, 2)
  Wait(500)

  -- 4) Get head bone position for camera framing AFTER the emote and look-at have settled.
  local headPos = GetPedBoneCoords(ped, 31086, 0.0, 0.0, 0.0)
  if not headPos then
    if hasScully then exports['scully_emotemenu']:cancelEmote() end
    if type(SetNightvision) == 'function' then
      SetNightvision(hadNightVision)
    end
    if type(SetSeethrough) == 'function' then
      SetSeethrough(hadSeeThrough)
    end
    if not pedWasFrozen then FreezeEntityPosition(ped, false) end
    return ''
  end

  -- 5) Calculate camera position using heading-based trig.
  local forwardX = -math.sin(headingRad)
  local forwardY =  math.cos(headingRad)
  local hasHeadProp = false
  if type(GetPedPropIndex) == 'function' then
    hasHeadProp = (GetPedPropIndex(ped, 0) or -1) >= 0
  end
  local wearingHelmet = false
  if type(IsPedWearingHelmet) == 'function' then
    wearingHelmet = IsPedWearingHelmet(ped) == true
  end
  local useHelmetFraming = hasHeadProp or wearingHelmet

  -- Keep extra distance for helmets/head props to avoid clipping into the model.
  local camDist = useHelmetFraming and 1.20 or 0.82
  local camX = headPos.x + forwardX * camDist
  local camY = headPos.y + forwardY * camDist
  local camZ = headPos.z + (useHelmetFraming and 0.16 or 0.10)

  local cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
  SetCamCoord(cam, camX, camY, camZ)
  if type(SetCamNearClip) == 'function' then
    SetCamNearClip(cam, 0.03)
  end
  -- Aim slightly higher for helmet captures so hats/helmets remain fully visible.
  PointCamAtCoord(cam, headPos.x, headPos.y, headPos.z + (useHelmetFraming and 0.10 or 0.04))
  SetCamFov(cam, useHelmetFraming and 35.0 or 30.0)
  RenderScriptCams(true, false, 0, true, true)

  -- 4) Hide HUD during capture.
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

  -- Let camera render a few frames.
  Wait(600)

  -- 6) Tell the server to capture.
  mugshotCaptureResult = nil
  print('[cad_bridge] [screencapture] Requesting server-side capture...')
  TriggerServerEvent('cad_bridge:requestMugshotCapture')

  -- Wait for the server to complete the capture.
  local timeoutMs = tonumber(Config.ScreenshotTimeoutMs or 8000) or 8000
  if timeoutMs < 1000 then timeoutMs = 1000 end
  local deadline = GetGameTimer() + timeoutMs
  while mugshotCaptureResult == nil and GetGameTimer() < deadline do
    Wait(50)
  end

  -- 7) Cleanup: stop HUD thread, cancel emote, restore ped.
  hideUi = false
  RenderScriptCams(false, false, 0, true, true)
  DestroyCam(cam, false)
  if hasScully then exports['scully_emotemenu']:cancelEmote() end
  ClearPedTasksImmediately(ped)
  SetEntityHeading(ped, originalHeading)
  if type(SetNightvision) == 'function' then
    SetNightvision(hadNightVision)
  end
  if type(SetSeethrough) == 'function' then
    SetSeethrough(hadSeeThrough)
  end
  if not pedWasFrozen then
    FreezeEntityPosition(ped, false)
  end

  if mugshotCaptureResult == nil then
    print('[cad_bridge] [screencapture] Server capture timed out')
    return ''
  end

  if mugshotCaptureResult then
    print('[cad_bridge] [screencapture] Server capture succeeded — mugshot stored server-side')
    return 'SERVER_CAPTURE'
  end

  print('[cad_bridge] [screencapture] Server capture failed')
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

  -- auto fallback mode: try screencapture first, then headshot, then legacy
  local screenshot = captureMugshotViaScreenshot()
  if screenshot ~= '' then return screenshot end
  local headshot = captureMugshotViaHeadshot()
  if headshot ~= '' then return headshot end
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
  [90] = 'Cream', [91] = 'Ice White', [92] = 'Frost White', [93] = 'Champagne', [94] = 'Pueblo Beige',
  [95] = 'Dark Ivory', [96] = 'Chocolate Brown', [97] = 'Golden Brown', [98] = 'Light Brown', [99] = 'Straw Beige',
  [100] = 'Moss Brown', [101] = 'Biston Brown', [102] = 'Beechwood', [103] = 'Dark Beechwood', [104] = 'Choco Orange',
  [105] = 'Beach Sand', [106] = 'Sun Bleached Sand', [107] = 'Cream', [108] = 'Util Brown', [109] = 'Util Medium Brown',
  [110] = 'Util Light Brown', [111] = 'Metallic White', [112] = 'Metallic Frost White', [113] = 'Worn Honey Beige', [114] = 'Worn Brown',
  [115] = 'Worn Dark Brown', [116] = 'Worn Straw Beige', [117] = 'Brushed Steel', [118] = 'Brushed Black Steel', [119] = 'Brushed Aluminium',
  [120] = 'Chrome', [121] = 'Worn Off White', [122] = 'Util Off White', [123] = 'Worn Orange', [124] = 'Worn Light Orange',
  [125] = 'Metallic Securicor Green', [126] = 'Worn Taxi Yellow', [127] = 'Police Blue', [128] = 'Matte Green', [129] = 'Matte Brown',
  [130] = 'Worn Orange', [131] = 'Matte White', [132] = 'Worn White', [133] = 'Worn Olive Army Green', [134] = 'Pure White',
  [135] = 'Hot Pink', [136] = 'Salmon Pink', [137] = 'Metallic Vermillion Pink', [138] = 'Orange', [139] = 'Green',
  [140] = 'Blue', [141] = 'Metallic Black Blue', [142] = 'Metallic Black Purple', [143] = 'Metallic Black Red', [144] = 'Hunter Green',
  [145] = 'Metallic Purple', [146] = 'Metallic V Dark Blue', [147] = 'Modshop Black', [148] = 'Matte Purple', [149] = 'Matte Dark Purple',
  [150] = 'Metallic Lava Red', [151] = 'Matte Forest Green', [152] = 'Matte Olive Drab', [153] = 'Matte Desert Brown', [154] = 'Matte Desert Tan',
  [155] = 'Matte Foilage Green', [156] = 'Default Alloy', [157] = 'Epsilon Blue', [158] = 'Pure Gold', [159] = 'Brushed Gold',
}

-- Explicit label overrides supplied for this server's colour index mapping.
local GTA_COLOUR_NAME_OVERRIDES = {
  [0] = 'Black',
  [1] = 'Graphite',
  [2] = 'Black Steel',
  [3] = 'Dark Steel',
  [4] = 'Silver',
  [5] = 'Bluish Silver',
  [6] = 'Rolled Steel',
  [7] = 'Shadow Silver',
  [8] = 'Stone Silver',
  [9] = 'Midnight Silver',
  [10] = 'Cast Iron Silver',
  [11] = 'Anthracite Black',
  [12] = 'Matte Black',
  [13] = 'Matte Gray',
  [14] = 'Matte Light Gray',
  [27] = 'Red',
  [28] = 'Torino Red',
  [29] = 'Formula Red',
  [30] = 'Blaze Red',
  [31] = 'Grace Red',
  [32] = 'Garnet Red',
  [33] = 'Sunset Red',
  [34] = 'Cabernet Red',
  [35] = 'Candy Red',
  [36] = 'Sunrise Orange',
  [38] = 'Orange',
  [39] = 'Matte Red',
  [40] = 'Matte Dark Red',
  [41] = 'Matte Orange',
  [42] = 'Matte Yellow',
  [49] = 'Dark Green',
  [50] = 'Racing Green',
