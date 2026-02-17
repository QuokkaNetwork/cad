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
-- mm_radio channel member sync
-- The server cannot call mm_radio:server:addToRadioChannel directly because
-- FiveM net events use the *calling client's* source — a server-to-server
-- TriggerEvent would have source = 0. Instead the server sends this client
-- event so the player's own client triggers the mm_radio server event, giving
-- mm_radio the correct source for its channels{} table tracking.
-- ============================================================================
local cadBridgeCurrentMmRadioChannel = nil -- track for leave cleanup

RegisterNetEvent('cad_bridge:syncMmRadio', function(channelNumber, playerName)
  if GetResourceState('mm_radio') ~= 'started' then return end
  local ch = tonumber(channelNumber) or 0
  if ch > 0 then
    -- Leave old channel first so mm_radio's list stays clean
    if cadBridgeCurrentMmRadioChannel and cadBridgeCurrentMmRadioChannel ~= ch then
      TriggerServerEvent('mm_radio:server:removeFromRadioChannel', cadBridgeCurrentMmRadioChannel)
    end
    cadBridgeCurrentMmRadioChannel = ch
    TriggerServerEvent('mm_radio:server:addToRadioChannel', ch, tostring(playerName or ''))
  else
    -- channel 0 means leave radio entirely
    if cadBridgeCurrentMmRadioChannel then
      TriggerServerEvent('mm_radio:server:removeFromRadioChannel', cadBridgeCurrentMmRadioChannel)
      cadBridgeCurrentMmRadioChannel = nil
    end
  end
end)

-- ============================================================================
-- CAD dispatcher inbound radio listen shim
--
-- Why this exists:
-- - CAD dispatchers connect as standalone Mumble clients (not FiveM players).
-- - pma-voice radio targets are built from FiveM player IDs, so dispatcher
--   sessions are not naturally included in player radio whispers.
-- - Dispatchers stay in Mumble root channel (0) on the CAD bridge side.
--
-- Practical workaround:
-- - While a player is on a radio channel, continuously add channel 0 to the
--   active radio voice target so player radio TX is also sent to root.
-- - Dispatcher bots in root then receive inbound radio audio from in-game users.
--
-- Notes:
-- - This does not replace pma-voice targeting; it only adds root as an extra
--   recipient.
-- - We avoid clearing any targets here to prevent fighting pma-voice internals.
-- ============================================================================
local CAD_BRIDGE_DISPATCH_TARGET_ID = 1
local CAD_BRIDGE_DISPATCH_PATCH_INTERVAL_MS = 750
local cadBridgeLastDispatchPatchAtMs = 0

local function getCurrentRadioChannel()
  if not LocalPlayer or not LocalPlayer.state then
    return 0
  end
  return tonumber(LocalPlayer.state.radioChannel) or 0
end

local function getCurrentCallChannel()
  if not LocalPlayer or not LocalPlayer.state then
    return 0
  end
  return tonumber(LocalPlayer.state.callChannel) or 0
end

CreateThread(function()
  while true do
    Wait(250)

    -- Only meaningful when pma-voice is active.
    if GetResourceState('pma-voice') ~= 'started' then
      goto continue
    end

    local radioChannel = getCurrentRadioChannel()
    local callChannel = getCurrentCallChannel()
    if radioChannel <= 0 and callChannel <= 0 then
      goto continue
    end

    local nowMs = tonumber(GetGameTimer() or 0) or 0
    if (nowMs - cadBridgeLastDispatchPatchAtMs) < CAD_BRIDGE_DISPATCH_PATCH_INTERVAL_MS then
      goto continue
    end

    cadBridgeLastDispatchPatchAtMs = nowMs
    pcall(function()
      -- Add root channel as an extra recipient for the active radio target.
      MumbleAddVoiceTargetChannel(CAD_BRIDGE_DISPATCH_TARGET_ID, 0)
    end)

    ::continue::
  end
end)
