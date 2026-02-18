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

local function notifyRoute(route, hadWaypoint)
  local callId = tostring(route.call_id or '?')
  local targetLabel = normalizePostal(route.postal)
  if targetLabel == '' then
    targetLabel = tostring(route.location or '')
  end

  local message = hadWaypoint
    and ('CAD route set for call #%s%s%s'):format(callId, targetLabel ~= '' and ' -> ' or '', targetLabel)
    or ('CAD assigned call #%s%s%s (postal lookup unavailable for waypoint)'):format(callId, targetLabel ~= '' and ' -> ' or '', targetLabel)

  if GetResourceState('ox_lib') == 'started' then
    TriggerEvent('ox_lib:notify', {
      title = 'CAD Dispatch',
      description = message,
      type = hadWaypoint and 'inform' or 'warning',
    })
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

  if GetResourceState('ox_lib') == 'started' then
    TriggerEvent('ox_lib:notify', {
      title = 'CAD Dispatch',
      description = message,
      type = 'inform',
    })
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

  if GetResourceState('ox_lib') == 'started' then
    TriggerEvent('ox_lib:notify', {
      title = title,
      description = description,
      type = 'error',
    })
    return
  end

  if GetResourceState('chat') == 'started' then
    TriggerEvent('chat:addMessage', {
      color = { 255, 85, 85 },
      args = { 'CAD', description },
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

local function notifyEmergencyUiIssue(message)
  local text = tostring(message or 'Unable to open the 000 UI right now.')

  if GetResourceState('ox_lib') == 'started' then
    TriggerEvent('ox_lib:notify', {
      title = 'CAD Dispatch',
      description = text,
      type = 'warning',
    })
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
    SetNuiFocus(false, false)
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

RegisterNetEvent('cad_bridge:prompt000', function(departments)
  openEmergencyPopup(departments)
end)

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
  if emergencyUiOpen then
    SetNuiFocus(false, false)
  end
end)

CreateThread(function()
  while true do
    if emergencyUiOpen then
      Wait(0)

      if IsControlJustPressed(0, 200) or IsControlJustPressed(0, 202) or IsControlJustPressed(0, 177) then
        closeEmergencyPopup()
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
-- This replaces mm_radio/pma radio routing while keeping pma-voice proximity.
-- We use a dedicated voice target slot so we do not fight pma proximity logic.
-- ============================================================================
local cadBridgeCurrentMmRadioChannel = nil
RegisterNetEvent('cad_bridge:syncMmRadio', function(channelNumber, playerName)
  if GetResourceState('mm_radio') ~= 'started' then return end
  local ch = tonumber(channelNumber) or 0
  if ch > 0 then
    if cadBridgeCurrentMmRadioChannel and cadBridgeCurrentMmRadioChannel ~= ch then
      TriggerServerEvent('mm_radio:server:removeFromRadioChannel', cadBridgeCurrentMmRadioChannel)
    end
    cadBridgeCurrentMmRadioChannel = ch
    TriggerServerEvent('mm_radio:server:addToRadioChannel', ch, tostring(playerName or ''))
  else
    if cadBridgeCurrentMmRadioChannel then
      TriggerServerEvent('mm_radio:server:removeFromRadioChannel', cadBridgeCurrentMmRadioChannel)
      cadBridgeCurrentMmRadioChannel = nil
    end
  end
end)

local CAD_RADIO_ENABLED = tostring(GetConvar('cad_bridge_radio_enabled', 'true')) == 'true'
local CAD_RADIO_TARGET_ID = tonumber(GetConvar('cad_bridge_radio_target_id', '2')) or 2
local CAD_PROXIMITY_TARGET_ID = tonumber(GetConvar('cad_bridge_proximity_target_id', '1')) or 1
local CAD_RADIO_RX_VOLUME = tonumber(GetConvar('cad_bridge_radio_rx_volume', '0.35')) or 0.35
local CAD_RADIO_PTT_KEY = tostring(GetConvar('cad_bridge_radio_ptt_key', 'LMENU'))
local CAD_RADIO_FORWARD_ROOT = tostring(GetConvar('cad_bridge_radio_forward_root', 'true')) == 'true'
local CAD_RADIO_UI_ENABLED = tostring(GetConvar('cad_bridge_radio_ui_enabled', 'true')) == 'true'
local CAD_RADIO_UI_KEY = tostring(GetConvar('cad_bridge_radio_ui_key', 'EQUALS'))
local CAD_RADIO_MAX_CHANNEL = tonumber(GetConvar('cad_bridge_radio_max_frequency', tostring(Config.RadioMaxFrequency or 500))) or tonumber(Config.RadioMaxFrequency or 500) or 500
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
local cadRadioSubmixId = -1
local cadRadioRxVolume = CAD_RADIO_RX_VOLUME
local cadRadioMutedBySource = {}
local cadRadioUiVisible = false

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
  local adapter = tostring(GetConvar('cad_bridge_radio_adapter', 'cad-radio') or 'cad-radio'):lower()
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

local function cadRadioPushUiState()
  cadRadioSendNui('updateRadio', cadRadioBuildUiPayload())
  cadRadioSendNui('updateRadioList', cadRadioBuildUiMemberList())
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
  MumbleClearVoiceTarget(CAD_RADIO_TARGET_ID)
  MumbleSetVoiceTarget(CAD_RADIO_TARGET_ID)
  MumbleClearVoiceTargetPlayers(CAD_RADIO_TARGET_ID)

  local localSource = getLocalServerId()
  for src, _ in pairs(cadRadioMemberBySource) do
    if src ~= localSource then
      MumbleAddVoiceTargetPlayerByServerId(CAD_RADIO_TARGET_ID, src)
    end
  end

  if CAD_RADIO_FORWARD_ROOT then
    -- Send in-game radio TX to Mumble root so CAD dispatchers can hear it.
    MumbleAddVoiceTargetChannel(CAD_RADIO_TARGET_ID, 0)
  end
end

local function setCadRadioPttState(enabled)
  if not CAD_RADIO_ENABLED or not isCadRadioAdapterActive() then return end
  local isEnabled = enabled == true
  if cadRadioPttPressed == isEnabled then return end

  if isEnabled then
    if cadRadioChannel <= 0 then return end
    if isPlayerDeadForCadRadio() then return end
    cadRadioPttPressed = true
    rebuildCadRadioTarget()
    MumbleSetVoiceTarget(CAD_RADIO_TARGET_ID)
    TriggerServerEvent('cad_bridge:radio:setTalking', true)
    TriggerEvent('pma-voice:radioActive', true)
    cadRadioSendNui('updateRadioTalking', {
      radioId = tostring(getLocalServerId()),
      radioTalking = true,
    })
    playCadRadioMicClick(true)
    return
  end

  cadRadioPttPressed = false
  TriggerServerEvent('cad_bridge:radio:setTalking', false)
  TriggerEvent('pma-voice:radioActive', false)
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
    rebuildCadRadioTarget()
  end

  if previousChannel ~= cadRadioChannel then
    if GetResourceState('ox_lib') == 'started' then
      if cadRadioChannel > 0 then
        TriggerEvent('ox_lib:notify', {
          title = 'CAD Radio',
          description = ('Joined channel %s'):format(tostring(cadRadioChannel)),
          type = 'inform',
        })
      elseif previousChannel > 0 then
        TriggerEvent('ox_lib:notify', {
          title = 'CAD Radio',
          description = ('Left channel %s'):format(tostring(previousChannel)),
          type = 'inform',
        })
      end
    end
  end

  local memberList = cadRadioBuildUiMemberList()
  cadRadioSendNui('updateRadioList', memberList)
  cadRadioPushUiState()
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
  setCadRadioPttState(true)
end, false)

RegisterCommand('-cadbridgeradio', function()
  setCadRadioPttState(false)
end, false)

RegisterKeyMapping('+cadbridgeradio', 'CAD Radio Push-To-Talk', 'keyboard', CAD_RADIO_PTT_KEY)

local function cadRadioNotify(message, notifyType)
  local text = tostring(message or '')
  if text == '' then return end
  if GetResourceState('ox_lib') == 'started' then
    TriggerEvent('ox_lib:notify', {
      title = 'CAD Radio',
      description = text,
      type = notifyType or 'inform',
    })
  end
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

RegisterCommand('cadbridgeradio', function()
  if not CAD_RADIO_ENABLED or not CAD_RADIO_UI_ENABLED or not isCadRadioAdapterActive() then return end
  if cadRadioUiVisible then
    cadRadioCloseUi()
  else
    cadRadioOpenUi()
  end
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
  if cadRadioPttPressed then
    TriggerServerEvent('cad_bridge:radio:setTalking', false)
    TriggerEvent('pma-voice:radioActive', false)
  end
  cadRadioCloseUi()
  clearAllRemoteCadRadioTalking()
  MumbleClearVoiceTargetPlayers(CAD_RADIO_TARGET_ID)
  MumbleSetVoiceTarget(CAD_PROXIMITY_TARGET_ID)
end)
