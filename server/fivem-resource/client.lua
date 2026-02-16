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
    { primaryResource, 'getPostalCoords' },
    { primaryResource, 'GetCoordsFromPostal' },
    { primaryResource, 'GetCoordFromPostal' },
    { primaryResource, 'GetPostalCoords' },
    { 'nearest-postal', 'getCoordsFromPostal' },
    { 'nearest-postal', 'getCoordFromPostal' },
    { 'nearest-postal', 'getPostalCoords' },
    { 'nearest-postal', 'GetCoordsFromPostal' },
    { 'nearest-postal', 'GetCoordFromPostal' },
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

RegisterNetEvent('cad_bridge:setCallRoute', function(route)
  if type(route) ~= 'table' then return end

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
