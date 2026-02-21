local lastForcedOxNotifyPosition = ''
local loggedOxNotifyModernBehavior = false
local function forceOxNotifyPosition(logApplied)
  if Config.ForceOxNotifyPosition ~= true then return end

  local target = trim(Config.OxNotifyPosition or 'center-right')
  if target == '' then target = 'center-right' end

  local okReplicated, errReplicated = pcall(function()
    SetConvarReplicated('ox:notifyPosition', target)
  end)

  if not okReplicated then
    print(('[cad_bridge] Failed to force ox:notifyPosition=%s (SetConvarReplicated=%s)'):format(
      target,
      tostring(errReplicated)
    ))
    return
  end

  if logApplied == true or lastForcedOxNotifyPosition ~= target then
    print(('[cad_bridge] Forced ox:notifyPosition=%s'):format(target))
    if not loggedOxNotifyModernBehavior then
      print('[cad_bridge] Note: modern ox_lib keeps default notification position in player settings. cad_bridge notifications still force this position explicitly.')
      loggedOxNotifyModernBehavior = true
    end
  end
  lastForcedOxNotifyPosition = target
end

AddEventHandler('onResourceStart', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  -- Log bridge configuration status on startup for diagnostics
  local baseUrl = trim(Config.CadBaseUrl or '')
  local hasToken = trim(Config.SharedToken or '') ~= ''
  if baseUrl ~= '' and hasToken then
    print(('[cad_bridge] Bridge configured: base_url=%s token=SET'):format(baseUrl))
  else
    print(('[cad_bridge] WARNING: Bridge NOT configured. base_url=%q token=%s. License/registration features will NOT work.'):format(
      baseUrl,
      hasToken and 'SET' or 'EMPTY'
    ))
  end
  CreateThread(function()
    Wait(500)
    registerEmergencySuggestion(-1)
  end)
  forceOxNotifyPosition(true)
end)

AddEventHandler('playerJoining', function()
  local src = source
  CreateThread(function()
    Wait(3000)
    registerEmergencySuggestion(src)
  end)
end)

CreateThread(function()
  while true do
    Wait(math.max(5000, tonumber(Config.OxNotifyForceIntervalMs or 60000) or 60000))
    forceOxNotifyPosition(false)
  end
end)

local function splitByPipe(text)
  local input = tostring(text or '')
  local parts = {}
  local cursor = 1
  while true do
    local sepStart, sepEnd = input:find('|', cursor, true)
    if not sepStart then
      parts[#parts + 1] = trim(input:sub(cursor))
      break
    end
    parts[#parts + 1] = trim(input:sub(cursor, sepStart - 1))
    cursor = sepEnd + 1
  end
  return parts
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

local function sendEmergencyUsage(src)
  notifyPlayer(src, 'Use /000 with no text to open an in-game popup form.')
  notifyPlayer(src, 'Popup form supports selecting required departments (dispatch departments are excluded).')
  notifyPlayer(src, 'Template: /000 <type> | <details> | <suspects> | <vehicle> | <hazards/injuries>')
  notifyPlayer(src, 'Example: /000 Armed Robbery | 24/7 in Sandy | 2 masked males | Black Sultan | shots fired')
end

local function parseEmergencyReport(rawInput)
  local raw = trim(rawInput)
  if raw == '' then
    return nil, 'Emergency details are required.'
  end

  local parts = splitByPipe(raw)
  local report = {
    emergency_type = '',
    details = '',
    suspects = '',
    vehicle = '',
    hazards = '',
  }

  if #parts == 1 then
    if #parts[1] > 64 then
      report.emergency_type = 'Emergency'
      report.details = parts[1]
    else
      report.emergency_type = parts[1]
    end
  else
    report.emergency_type = parts[1]
    report.details = parts[2] or ''
    report.suspects = parts[3] or ''
    report.vehicle = parts[4] or ''
    report.hazards = parts[5] or ''
  end

  if report.emergency_type == '' then
    return nil, 'Emergency type is required.'
  end
  return report
end

local function parseEmergencyPopupReport(payload)
  if type(payload) ~= 'table' then
    return nil, 'Invalid emergency form payload.'
  end

  local emergencyType = trim(payload.title or payload.emergency_type or '')
  local details = trim(payload.details or payload.message or '')
  local requestedDepartmentIds = normalizeDepartmentIdList(
    payload.requested_department_ids or payload.requested_departments or payload.department_ids or {}
  )

  if emergencyType == '' then
    return nil, 'Emergency title is required.'
  end

  if #emergencyType > 80 then
    emergencyType = emergencyType:sub(1, 80)
  end
  if #details > 600 then
    details = details:sub(1, 600)
  end

  return {
    emergency_type = emergencyType,
    details = details,
    suspects = '',
    vehicle = '',
    hazards = '',
    requested_department_ids = requestedDepartmentIds,
  }
end

local function isValidDateOnly(year, month, day)
  local y = tonumber(year)
  local m = tonumber(month)
  local d = tonumber(day)
  if not y or not m or not d then return false end
  if y < 1900 or y > 2100 then return false end
  if m < 1 or m > 12 then return false end
  if d < 1 or d > 31 then return false end

  local stamp = os.time({
    year = math.floor(y),
    month = math.floor(m),
    day = math.floor(d),
    hour = 12,
    min = 0,
    sec = 0,
  })
  if not stamp then return false end
  local normalized = os.date('!*t', stamp)
  if not normalized then return false end
  return normalized.year == math.floor(y)
    and normalized.month == math.floor(m)
    and normalized.day == math.floor(d)
end

local function formatDateOnly(year, month, day)
  return ('%04d-%02d-%02d'):format(
    math.floor(tonumber(year) or 0),
    math.floor(tonumber(month) or 0),
    math.floor(tonumber(day) or 0)
  )
end

local function normalizeDateOnly(value)
  local text = trim(value)
  if text == '' then return '' end

  -- Accept ISO date with optional time suffix.
  local yIso, mIso, dIso = text:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)')
  if yIso and mIso and dIso and isValidDateOnly(yIso, mIso, dIso) then
    return formatDateOnly(yIso, mIso, dIso)
  end

  -- Accept common separators and both YYYY-MM-DD and DD-MM-YYYY/MM-DD-YYYY inputs.
  local p1, p2, p3 = text:match('^(%d+)[%./%-](%d+)[%./%-](%d+)$')
  if not p1 or not p2 or not p3 then
    return ''
  end

  if #p1 == 4 then
    if isValidDateOnly(p1, p2, p3) then
      return formatDateOnly(p1, p2, p3)
    end
    return ''
  end

  if #p3 == 4 then
    local first = math.floor(tonumber(p1) or 0)
    local second = math.floor(tonumber(p2) or 0)
    local year = math.floor(tonumber(p3) or 0)

    -- Prefer day-first for Australian-style DOB strings, but fallback to month-first if needed.
    local day = first
    local month = second
    if first <= 12 and second > 12 then
      month = first
      day = second
    end

    if isValidDateOnly(year, month, day) then
      return formatDateOnly(year, month, day)
    end
    if isValidDateOnly(year, first, second) then
      return formatDateOnly(year, first, second)
    end
  end

  return ''
end

local function addDaysDateOnly(days)
  local numericDays = tonumber(days) or 1
  if numericDays < 1 then numericDays = 1 end
  local when = os.time() + math.floor(numericDays) * 24 * 60 * 60
  return os.date('!%Y-%m-%d', when)
end


local function daysUntilDateOnly(value)
  local normalized = normalizeDateOnly(value)
  if normalized == '' then return nil end
  local year, month, day = normalized:match('^(%d%d%d%d)%-(%d%d)%-(%d%d)$')
  if not year or not month or not day then return nil end
  -- Use hour=12 on both sides to avoid DST boundary issues.
  -- Use os.date('*t') (local) consistently with os.time() which expects local time.
  local target = os.time({ year = tonumber(year), month = tonumber(month), day = tonumber(day), hour = 12, min = 0, sec = 0 })
  if not target then return nil end
  local now = os.date('*t')
  local today = os.time({ year = now.year, month = now.month, day = now.day, hour = 12, min = 0, sec = 0 })
  if not today then return nil end
  return math.floor((target - today) / (24 * 60 * 60))
end

local function normalizeList(input, makeUpper)
  local out = {}
  local seen = {}
  if type(input) ~= 'table' then return out end
  for _, item in ipairs(input) do
    local value = trim(item)
    if value ~= '' then
      if makeUpper == true then
        value = value:upper()
      end
      if not seen[value] then
        seen[value] = true
        out[#out + 1] = value
      end
    end
  end
  return out
end

local function parseDriverLicenseForm(payload)
  if type(payload) ~= 'table' then
    return nil, 'Invalid driver license payload.'
  end

  local photoOnly = payload.photo_only == true or payload.photo_only == 1
  local fullName = trim(payload.full_name or payload.character_name or '')
  local dateOfBirth = normalizeDateOnly(payload.date_of_birth or payload.dob or '')
  local gender = trim(payload.gender or '')
  local quizMode = payload.quiz_mode == true or payload.quiz_mode == 1
  local classes = normalizeList(payload.license_classes or payload.classes or {}, true)
  local conditions = normalizeList(payload.conditions or {}, false)
  local mugshotData = trim(payload.mugshot_data or '')
  local mugshotUrl = trim(payload.mugshot_url or '')
  local licenseNumber = trim(payload.license_number or '')
  local expiryDays = tonumber(payload.expiry_days or payload.duration_days or Config.DriverLicenseDefaultExpiryDays or 35) or (Config.DriverLicenseDefaultExpiryDays or 35)
  if quizMode then
    expiryDays = tonumber(Config.DriverLicenseQuizExpiryDays or 30) or 30
    classes = normalizeList(Config.DriverLicenseQuizClasses or { 'CAR' }, true)
  end
  if expiryDays < 1 then expiryDays = 1 end
  local expiryAt = normalizeDateOnly(payload.expiry_at or '')
  if expiryAt == '' then
    expiryAt = addDaysDateOnly(expiryDays)
  end

  if fullName == '' then return nil, 'Character name is required.' end
  if dateOfBirth == '' then return nil, 'Date of birth is required (YYYY-MM-DD).' end
  if gender == '' then return nil, 'Gender is required.' end
  if #classes == 0 then return nil, 'At least one license class is required.' end
  if quizMode then
    local scorePercent = tonumber(payload.quiz_score_percent or 0) or 0
    local passPercent = tonumber(Config.DriverLicenseQuizPassPercent or 80) or 80
    if scorePercent < passPercent then
      return nil, ('Quiz pass mark is %s%%.'):format(tostring(passPercent))
    end
  end

  return {
    full_name = fullName,
    date_of_birth = dateOfBirth,
    gender = gender,
    license_classes = classes,
    conditions = conditions,
    mugshot_data = mugshotData,
    mugshot_url = mugshotUrl,
    license_number = licenseNumber,
    expiry_days = math.floor(expiryDays),
    expiry_at = expiryAt,
    status = 'valid',
    photo_only = photoOnly,
    quiz_mode = quizMode,
  }
end

local function parseVehicleRegistrationForm(payload)
  if type(payload) ~= 'table' then
    return nil, 'Invalid registration payload.'
  end

  local plate = trim(payload.plate or payload.license_plate or '')
  local model = trim(payload.vehicle_model or payload.model or '')
  local colour = trim(payload.vehicle_colour or payload.colour or payload.color or '')
  local ownerName = trim(payload.owner_name or payload.character_name or '')
  local durationDays = tonumber(payload.duration_days or payload.expiry_days or Config.VehicleRegistrationDefaultDays or 35) or (Config.VehicleRegistrationDefaultDays or 35)
  if durationDays < 1 then durationDays = 1 end
  local expiryAt = addDaysDateOnly(durationDays)

  if plate == '' then return nil, 'Vehicle plate is required.' end
  if model == '' then return nil, 'Vehicle model is required.' end
  if ownerName == '' then return nil, 'Owner name is required.' end

  return {
    plate = plate,
    vehicle_model = model,
    vehicle_colour = colour,
    owner_name = ownerName,
    duration_days = math.floor(durationDays),
    expiry_at = expiryAt,
    status = 'valid',
  }
end

local function resolveDocumentFeeAmount(feeMap, durationDays)
  local days = math.max(1, math.floor(tonumber(durationDays) or 0))
  if type(feeMap) ~= 'table' then return 0 end

  local exact = tonumber(feeMap[days])
  if exact and exact > 0 then
    return math.floor(exact)
  end

  local nearestFee = 0
  local nearestDistance = nil
  for rawDays, rawFee in pairs(feeMap) do
    local mappedDays = tonumber(rawDays)
    local mappedFee = tonumber(rawFee)
    if mappedDays and mappedFee and mappedFee > 0 then
      local distance = math.abs(days - math.floor(mappedDays))
      if nearestDistance == nil or distance < nearestDistance then
        nearestDistance = distance
        nearestFee = math.floor(mappedFee)
      end
    end
  end

  if nearestFee > 0 then return nearestFee end
  return 0
end

local function formatMoney(amount)
  return ('$%s'):format(tostring(math.floor(tonumber(amount) or 0)))
end

local function getDocumentMoneyBalance(sourceId, account)
  local normalizedAccount = trim(account):lower()
  if normalizedAccount == '' then normalizedAccount = 'bank' end

  if GetResourceState('qbx_core') == 'started' then
    local okAmount, amount = pcall(function()
      return exports.qbx_core:GetMoney(sourceId, normalizedAccount)
    end)
    if okAmount and tonumber(amount) then
      return tonumber(amount)
    end

    local okPlayer, xPlayer = pcall(function()
      return exports.qbx_core:GetPlayer(sourceId)
    end)
    if okPlayer and xPlayer and type(xPlayer.PlayerData) == 'table' and type(xPlayer.PlayerData.money) == 'table' then
      local fallback = tonumber(xPlayer.PlayerData.money[normalizedAccount])
      if fallback then return fallback end
    end
  end

  if GetResourceState('qb-core') == 'started' then
    local okCore, core = pcall(function()
      return exports['qb-core']:GetCoreObject()
    end)
    if okCore and core and core.Functions and core.Functions.GetPlayer then
      local player = core.Functions.GetPlayer(sourceId)
      if player and player.PlayerData and type(player.PlayerData.money) == 'table' then
        local amount = tonumber(player.PlayerData.money[normalizedAccount])
        if amount then return amount end
      end
    end
  end

  return nil
end

local function tryDocumentMoneyChange(sourceId, citizenId, account, amount, reason, mode)
  local normalizedAccount = trim(account):lower()
  if normalizedAccount == '' then normalizedAccount = 'bank' end
  local normalizedReason = trim(reason)
  if normalizedReason == '' then normalizedReason = 'CAD document fee' end

  local fnName = mode == 'add' and 'AddMoney' or 'RemoveMoney'
  local attempts = {}

  local function pushAttempt(label, fn)
    attempts[#attempts + 1] = {
      label = label,
      fn = fn,
    }
  end

  if GetResourceState('qbx_core') == 'started' then
    local okPlayer, xPlayer = pcall(function()
      return exports.qbx_core:GetPlayer(sourceId)
    end)

    if mode == 'add' then
      pushAttempt('qbx export AddMoney(source, account, amount, reason)', function()
        return exports.qbx_core:AddMoney(sourceId, normalizedAccount, amount, normalizedReason)
      end)
      pushAttempt('qbx export AddMoney(source, account, amount)', function()
        return exports.qbx_core:AddMoney(sourceId, normalizedAccount, amount)
      end)
      if citizenId ~= '' then
        pushAttempt('qbx export AddMoney(citizenid, account, amount, reason)', function()
          return exports.qbx_core:AddMoney(citizenId, normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt('qbx export AddMoney(citizenid, account, amount)', function()
          return exports.qbx_core:AddMoney(citizenId, normalizedAccount, amount)
        end)
      end
    else
      pushAttempt('qbx export RemoveMoney(source, account, amount, reason)', function()
        return exports.qbx_core:RemoveMoney(sourceId, normalizedAccount, amount, normalizedReason)
      end)
      pushAttempt('qbx export RemoveMoney(source, account, amount)', function()
        return exports.qbx_core:RemoveMoney(sourceId, normalizedAccount, amount)
      end)
      if citizenId ~= '' then
        pushAttempt('qbx export RemoveMoney(citizenid, account, amount, reason)', function()
          return exports.qbx_core:RemoveMoney(citizenId, normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt('qbx export RemoveMoney(citizenid, account, amount)', function()
          return exports.qbx_core:RemoveMoney(citizenId, normalizedAccount, amount)
        end)
      end
    end

    if okPlayer and xPlayer then
      if xPlayer.Functions and type(xPlayer.Functions[fnName]) == 'function' then
        pushAttempt(('xPlayer.Functions.%s(account, amount, reason)'):format(fnName), function()
          return xPlayer.Functions[fnName](normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt(('xPlayer.Functions.%s(account, amount)'):format(fnName), function()
          return xPlayer.Functions[fnName](normalizedAccount, amount)
        end)
      end

      if type(xPlayer[fnName]) == 'function' then
        pushAttempt(('xPlayer:%s(account, amount, reason)'):format(fnName), function()
          return xPlayer[fnName](xPlayer, normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt(('xPlayer:%s(account, amount)'):format(fnName), function()
          return xPlayer[fnName](xPlayer, normalizedAccount, amount)
        end)
      end
    end
  end

  if GetResourceState('qb-core') == 'started' then
    local okCore, core = pcall(function()
      return exports['qb-core']:GetCoreObject()
    end)
    if okCore and core and core.Functions and core.Functions.GetPlayer then
      local player = core.Functions.GetPlayer(sourceId)
      if player and player.Functions and type(player.Functions[fnName]) == 'function' then
        pushAttempt(('qb player.Functions.%s(account, amount, reason)'):format(fnName), function()
          return player.Functions[fnName](normalizedAccount, amount, normalizedReason)
        end)
        pushAttempt(('qb player.Functions.%s(account, amount)'):format(fnName), function()
          return player.Functions[fnName](normalizedAccount, amount)
        end)
      end
    end
  end

  local attemptedLabels = {}
  for _, attempt in ipairs(attempts) do
    attemptedLabels[#attemptedLabels + 1] = attempt.label
    local callOk, result = pcall(attempt.fn)
    if callOk and result ~= false then
      return true, ''
    end
  end

  if #attemptedLabels > 0 then
    return false, ('No adapter succeeded (%s)'):format(table.concat(attemptedLabels, ', '))
  end
  return false, 'No supported money adapter found (qbx_core/qb-core)'
end

local function chargeDocumentFee(sourceId, citizenId, account, amount, reason)
  local fee = math.max(0, math.floor(tonumber(amount) or 0))
  if fee <= 0 then return true, '' end

  local balance = getDocumentMoneyBalance(sourceId, account)
  if balance ~= nil and balance < fee then
    return false, ('Insufficient funds: %s needed in %s account.'):format(formatMoney(fee), tostring(account))
  end

  return tryDocumentMoneyChange(sourceId, citizenId, account, fee, reason, 'remove')
end

local function refundDocumentFee(sourceId, citizenId, account, amount, reason)
  local fee = math.max(0, math.floor(tonumber(amount) or 0))
  if fee <= 0 then return true, '' end
  return tryDocumentMoneyChange(sourceId, citizenId, account, fee, reason, 'add')
end

local function buildEmergencyMessage(report)
  local lines = {}
  if report.details ~= '' then lines[#lines + 1] = report.details end
  if report.suspects ~= '' then lines[#lines + 1] = ('Suspects: %s'):format(report.suspects) end
  if report.vehicle ~= '' then lines[#lines + 1] = ('Vehicle: %s'):format(report.vehicle) end
  if report.hazards ~= '' then lines[#lines + 1] = ('Hazards/Injuries: %s'):format(report.hazards) end
  if #lines == 0 then return 'No additional details provided.' end
  return table.concat(lines, ' | ')
end

local function encodeLogJson(value)
  local ok, encoded = pcall(function()
    return json.encode(value)
  end)
  if ok and type(encoded) == 'string' and encoded ~= '' then
    return encoded
  end
  return tostring(value)
end

local function countList(value)
  if type(value) ~= 'table' then return 0 end
  local count = 0
  for _ in ipairs(value) do
    count = count + 1
  end
  return count
end

-- ---------------------------------------------------------------------------
-- Mugshot file persistence
-- ---------------------------------------------------------------------------
-- Saves base64 mugshot data to a local file inside the resource so a copy
-- is always retained on the server regardless of CAD upload outcome.
-- Files are stored under mugshots/<citizenid>_<timestamp>.<ext>
-- Returns the relative file path on success, or '' on failure.
-- ---------------------------------------------------------------------------

local function saveMugshotFile(citizenid, base64Data)
  if trim(base64Data) == '' then return '' end
  if trim(citizenid) == '' then return '' end

  -- Strip the data URI prefix if present to get raw base64.
  local mimeType = 'image/jpg'
  local rawBase64 = base64Data
  local dataUriPrefix = base64Data:match('^(data:image/[^;]+;base64,)')
  if dataUriPrefix then
    mimeType = dataUriPrefix:match('data:(image/[^;]+);') or mimeType
    rawBase64 = base64Data:sub(#dataUriPrefix + 1)
  end

  -- Determine file extension from mime type.
  local extMap = {
    ['image/jpeg'] = 'jpg',
    ['image/jpg'] = 'jpg',
    ['image/png'] = 'png',
    ['image/webp'] = 'webp',
  }
  local ext = extMap[mimeType:lower()] or 'jpg'

  -- Decode base64 to binary.
  -- FiveM server-side Lua does not have a built-in base64 decoder, but we
  -- can use the raw base64 string and let SaveResourceFile handle it if the
  -- data is already decoded, or we decode manually.
  local decodeOk, binaryData = pcall(function()
    -- FiveM's Lua runtime does not expose a native base64 decode. We use a
    -- pure-Lua implementation that is compatible with server-side scripting.
    local b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
    rawBase64 = rawBase64:gsub('[^' .. b .. '=]', '')
    return (rawBase64:gsub('.', function(x)
      if x == '=' then return '' end
      local r, f = '', (b:find(x) - 1)
      for i = 6, 1, -1 do r = r .. (f % 2^i - f % 2^(i-1) > 0 and '1' or '0') end
      return r
    end):gsub('%d%d%d?%d?%d?%d?%d?%d', function(x)
      if #x ~= 8 then return '' end
      local c = 0
      for i = 1, 8 do c = c + (x:sub(i, i) == '1' and 2^(8-i) or 0) end
      return string.char(c)
    end))
  end)

  if not decodeOk or not binaryData or #binaryData == 0 then
    print(('[cad_bridge] WARNING: Failed to decode mugshot base64 for citizenid=%s'):format(citizenid))
    return ''
  end

  -- Sanitise citizenid for use in a filename.
  local safeCitizenId = citizenid:gsub('[^%w%-_]', '_')
  local timestamp = os.time()
  local fileName = ('mugshots/%s_%d.%s'):format(safeCitizenId, timestamp, ext)

  local saveOk = pcall(function()
    SaveResourceFile(GetCurrentResourceName(), fileName, binaryData, #binaryData)
  end)

  if not saveOk then
    print(('[cad_bridge] WARNING: Failed to save mugshot file %s for citizenid=%s'):format(fileName, citizenid))
    return ''
  end

  print(('[cad_bridge] Mugshot saved to file: %s (%d bytes) for citizenid=%s'):format(fileName, #binaryData, citizenid))
  return fileName
end

-- ---------------------------------------------------------------------------
-- Server-side screencapture via serverCapture export
-- ---------------------------------------------------------------------------
-- Stores pending mugshot data per source so the license submission can
-- retrieve it without sending it over TriggerServerEvent.
-- ---------------------------------------------------------------------------
local pendingMugshots = {}

RegisterNetEvent('cad_bridge:requestMugshotCapture', function()
  local src = source
  if not src or src == 0 then return end

  local resourceName = trim(Config.ScreenshotResource or 'screencapture')
  print(('[cad_bridge] [screencapture] Server capture requested by src=%s resource=%q'):format(tostring(src), resourceName))

  if GetResourceState(resourceName) ~= 'started' then
    print(('[cad_bridge] [screencapture] Resource %q not started (state=%s), aborting capture'):format(
      resourceName, tostring(GetResourceState(resourceName))))
    TriggerClientEvent('cad_bridge:mugshotCaptureResult', src, false)
    return
  end

  local chromaEnabled = Config.ScreenshotChromaKeyEnabled == true
  local captureOptions = {
    encoding = trim(Config.ScreenshotEncoding or 'jpg'):lower(),
    quality = tonumber(Config.ScreenshotQuality or 0.7) or 0.7,
    maxWidth = 512,
    maxHeight = 512,
  }
  -- Keep chroma options explicit so provider defaults do not override runtime config.
  if chromaEnabled then
    captureOptions.chromaKey = true
    captureOptions.chroma = true
    captureOptions.transparent = true
  else
    captureOptions.chromaKey = false
    captureOptions.chroma = false
    captureOptions.transparent = false
    captureOptions.disableChromaKey = true
  end

  print(('[cad_bridge] [screencapture] Calling serverCapture for src=%s encoding=%s quality=%s'):format(
    tostring(src), captureOptions.encoding, tostring(captureOptions.quality)))

  local ok, callErr = pcall(function()
    exports[resourceName]:serverCapture(src, captureOptions, function(data)
      local dataLen = 0
      if type(data) == 'string' then
        dataLen = #data
      end
      print(('[cad_bridge] [screencapture] serverCapture callback — src=%s type=%s length=%d'):format(
        tostring(src), type(data), dataLen))

      if dataLen > 0 then
        -- Encode binary data to base64 data URI for consistency with existing pipeline.
        local encoding = captureOptions.encoding
        if encoding == 'jpg' then encoding = 'jpeg' end
        local base64Data = data
        -- If the data doesn't already have a data URI prefix, it's raw base64 from serverCapture.
        if not base64Data:match('^data:image/') then
          base64Data = ('data:image/%s;base64,%s'):format(encoding, data)
        end
        pendingMugshots[src] = base64Data
        print(('[cad_bridge] [screencapture] Mugshot stored for src=%s (base64 len=%d)'):format(tostring(src), #base64Data))
        TriggerClientEvent('cad_bridge:mugshotCaptureResult', src, true)
      else
        print(('[cad_bridge] [screencapture] No data returned for src=%s'):format(tostring(src)))
        TriggerClientEvent('cad_bridge:mugshotCaptureResult', src, false)
      end
    end, 'base64')
  end)

  if not ok then
    print(('[cad_bridge] [screencapture] ERROR calling serverCapture: %s'):format(tostring(callErr)))
    TriggerClientEvent('cad_bridge:mugshotCaptureResult', src, false)
  end
end)

local function consumePendingMugshot(src)
  local data = pendingMugshots[src]
  pendingMugshots[src] = nil
  return data or ''
end

local function summarizeLicensePayloadForLog(payload)
  local data = type(payload) == 'table' and payload or {}
  local mugshotData = trim(data.mugshot_data or '')
  local mugshotUrl = trim(data.mugshot_url or '')
  return {
    source = tonumber(data.source) or 0,
    player_name = trim(data.player_name or ''),
    citizenid = trim(data.citizenid or data.citizen_id or ''),
    full_name = trim(data.full_name or data.character_name or ''),
    date_of_birth = trim(data.date_of_birth or data.dob or ''),
    gender = trim(data.gender or ''),
    license_number = trim(data.license_number or ''),
    classes_count = countList(data.license_classes or data.classes),
    conditions_count = countList(data.conditions),
    expiry_days = tonumber(data.expiry_days or data.duration_days or 0) or 0,
    expiry_at = trim(data.expiry_at or ''),
    mugshot_length = #mugshotData > 0 and #mugshotData or #mugshotUrl,
    mugshot_data_length = #mugshotData,
    mugshot_url_length = #mugshotUrl,
  }
end

local function summarizeRegistrationPayloadForLog(payload)
  local data = type(payload) == 'table' and payload or {}
  return {
    source = tonumber(data.source) or 0,
    player_name = trim(data.player_name or ''),
    citizenid = trim(data.citizenid or data.citizen_id or ''),
    owner_name = trim(data.owner_name or data.character_name or ''),
    plate = trim(data.plate or data.license_plate or ''),
    vehicle_model = trim(data.vehicle_model or data.model or ''),
    vehicle_colour = trim(data.vehicle_colour or data.colour or data.color or ''),
    duration_days = tonumber(data.duration_days or data.expiry_days or 0) or 0,
    expiry_at = trim(data.expiry_at or ''),
  }
end

local function logDocumentFailure(kind, details)
  print(('[cad_bridge][%s] %s'):format(trim(kind), encodeLogJson(details or {})))
end

local function logDocumentTrace(kind, details, force)
  if force == true or Config.DocumentDebugLogs == true then
    print(('[cad_bridge][%s] %s'):format(trim(kind), encodeLogJson(details or {})))
  end
end

local function submitEmergencyCall(src, report)
  local s = tonumber(src)
  if not s then return end
  if isBridgeBackoffActive('calls') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('calls') / 1000))
    notifyPlayer(s, ('CAD bridge is rate-limited. Try /000 again in %ss.'):format(waitSeconds))
    return
  end

  local pos = PlayerPositions[s]
  local details = buildEmergencyMessage(report)
  local payload = {
    source = s,
    player_name = getCharacterDisplayName(s),
    platform_name = trim(GetPlayerName(s) or ''),
    identifiers = GetPlayerIdentifiers(s),
    title = ('000 %s'):format(report.emergency_type),
    message = details,
    priority = '1',
    job_code = '000',
    source_type = 'command_000',
  }
  if type(report.requested_department_ids) == 'table' and #report.requested_department_ids > 0 then
    payload.requested_department_ids = report.requested_department_ids
  end

  if pos then
    payload.position = { x = pos.x, y = pos.y, z = pos.z }
    payload.heading = pos.heading
    payload.speed = pos.speed
    payload.street = pos.street
    payload.crossing = pos.crossing
    payload.postal = pos.postal
  end

  request('POST', '/api/integration/fivem/calls', payload, function(status, body, responseHeaders)
    if status >= 200 and status < 300 then
      local callId = '?'
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and type(parsed.call) == 'table' and parsed.call.id then
        callId = tostring(parsed.call.id)
      end
      print(('[cad_bridge] /000 call created by %s (#%s) as CAD call #%s [%s]')
        :format(payload.player_name, tostring(s), callId, report.emergency_type))
      notifyPlayer(s, ('000 call sent to CAD (Call #%s). Type: %s'):format(callId, report.emergency_type))
