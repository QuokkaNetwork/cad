          plate = trim(payload.plate or ''),
          citizenid = trim(payload.citizenid or ''),
          expiry_at = trim(expiryAt or ''),
        }, true)
        notifyPlayer(s, ('Vehicle registration saved to CAD%s%s%s%s'):format(
          expiryAt ~= '' and ' | Expires: ' or '',
          expiryAt ~= '' and expiryAt or '',
          feeCharged and ' | Charged: ' or '',
          feeCharged and formatMoney(feeAmount) or ''
        ))
        return
      end

      if status == 429 then
        setBridgeBackoff('registrations', responseHeaders, 15000, 'vehicle registration create')
      end

      local err = ('Failed to create CAD vehicle registration (HTTP %s)'):format(tostring(status))
      local ok, parsed = pcall(json.decode, body or '{}')
      local parsedError = ''
      if ok and type(parsed) == 'table' and parsed.error then
        parsedError = tostring(parsed.error)
        err = err .. ': ' .. parsedError
      end
      print('[cad_bridge] ' .. err)
      if feeCharged and feeAmount > 0 then
        local refunded, refundErr = refundDocumentFee(
          s,
          payload.citizenid,
          feeAccount,
          feeAmount,
          'CAD registration refund (save failed)'
        )
        if not refunded then
          print(('[cad_bridge] WARNING: registration fee refund failed for src %s amount %s: %s'):format(
            tostring(s),
            tostring(feeAmount),
            tostring(refundErr)
          ))
        end
      end
      if status == 409 then
        local existingExpiry = ''
        if ok and type(parsed) == 'table' then
          existingExpiry = trim(parsed.existing_expiry_at or '')
        end
        logDocumentFailure('registration-create-rejected', {
          reason = 'renewal_window_blocked',
          http_status = tonumber(status) or 0,
          existing_expiry_at = existingExpiry,
          payload = summarizeRegistrationPayloadForLog(payload),
        })
        if existingExpiry ~= '' then
          notifyPlayer(s, ('Registration renewal unavailable. You can renew when within 3 days of expiry (current expiry: %s).'):format(existingExpiry))
        else
          notifyPlayer(s, 'Registration renewal unavailable. You can renew when within 3 days of expiry.')
        end
        return
      end

      if status == 403 then
        local parsedErrorLower = string.lower(trim(parsedError or ''))
        if parsedErrorLower:find('do not own', 1, true)
          or parsedErrorLower:find('ownership', 1, true)
          or parsedErrorLower:find('player_vehicles', 1, true) then
          logDocumentFailure('registration-create-rejected', {
            reason = 'ownership_mismatch',
            http_status = tonumber(status) or 0,
            api_error = parsedError,
            payload = summarizeRegistrationPayloadForLog(payload),
          })
          notifyPlayer(s, 'Vehicle detected in the registration area, but you cannot register it because you do not own it.')
          return
        end
      end

      logDocumentFailure('registration-create-failed', {
        http_status = tonumber(status) or 0,
        api_error = parsedError,
        fee_charged = feeCharged == true,
        fee_amount = feeAmount,
        payload = summarizeRegistrationPayloadForLog(payload),
      })
      if parsedError ~= '' then
        notifyPlayer(s, ('Vehicle registration failed to save: %s'):format(parsedError))
      else
        notifyPlayer(s, 'Vehicle registration failed to save to CAD. Check server logs.')
      end
    end)
  end)
end

local function splitByComma(text)
  local value = trim(text)
  local entries = {}
  local seen = {}
  if value == '' then
    return entries
  end

  for token in value:gmatch('([^,]+)') do
    local item = trim(token)
    if item ~= '' and not seen[item] then
      seen[item] = true
      entries[#entries + 1] = item
    end
  end
  return entries
end

local function getNpwdEmergencyNumbers()
  local configured = trim(Config.NpwdEmergencyNumbers or '000')
  local parsed = splitByComma(configured)
  if #parsed == 0 then
    return { '000' }
  end
  return parsed
end

local function submitNpwdEmergencyCall(src, emergencyNumber, incomingCaller)
  local s = tonumber(src)
  if not s then return end

  if isBridgeBackoffActive('calls') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('calls') / 1000))
    notifyPlayer(s, ('CAD bridge is rate-limited. Emergency call not sent yet, retry in %ss.'):format(waitSeconds))
    return
  end

  local callerName = trim((incomingCaller and incomingCaller.name) or getCharacterDisplayName(s))
  local callerNumber = trim((incomingCaller and incomingCaller.number) or '')
  local pos = PlayerPositions[s]
  local messageParts = {
    ('NPWD %s phone emergency call'):format(trim(emergencyNumber)),
  }
  if callerNumber ~= '' then
    messageParts[#messageParts + 1] = ('Caller number: %s'):format(callerNumber)
  end

  local payload = {
    source = s,
    player_name = callerName ~= '' and callerName or getCharacterDisplayName(s),
    platform_name = trim(GetPlayerName(s) or ''),
    identifiers = GetPlayerIdentifiers(s),
    citizenid = getCitizenId(s),
    title = ('000 Phone Call - %s'):format(callerName ~= '' and callerName or getCharacterDisplayName(s)),
    message = table.concat(messageParts, ' | '),
    priority = '1',
    job_code = '000',
    source_type = 'phone_000',
    enable_voice_session = true,
    phone_number = callerNumber,
  }

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

      local confirmation = ('Dispatch received your 000 call (CAD Call #%s). Stay on this line.'):format(callId)
      notifyPlayer(s, confirmation)
      print(('[cad_bridge] NPWD 000 call created by %s (#%s) as CAD call #%s')
        :format(payload.player_name, tostring(s), callId))
      return
    end

    if status == 429 then
      setBridgeBackoff('calls', responseHeaders, 15000, 'npwd 000 call')
    end

    local err = ('Failed to create CAD phone emergency call (HTTP %s)'):format(tostring(status))
    local ok, parsed = pcall(json.decode, body or '{}')
    if ok and type(parsed) == 'table' and parsed.error then
      err = err .. ': ' .. tostring(parsed.error)
    end
    print('[cad_bridge] ' .. err)
    notifyPlayer(s, '000 call failed to send to CAD. Check server logs.')
  end)
end

local function handleNpwdEmergencyCall(emergencyNumber, callRequest)
  local requestObj = type(callRequest) == 'table' and callRequest or {}
  local incomingCaller = type(requestObj.incomingCaller) == 'table' and requestObj.incomingCaller or {}
  local src = tonumber(incomingCaller.source) or 0

  -- Continue NPWD middleware chain.
  -- NPWD's onCall contract expects middleware to call next()/forward()/exit().
  -- We call next() so NPWD can complete its internal call flow while CAD handles
  -- emergency call creation in parallel.
  if type(requestObj.next) == 'function' then
    pcall(function()
      requestObj.next()
    end)
  end

  if src <= 0 then
    return
  end

  submitNpwdEmergencyCall(src, emergencyNumber, incomingCaller)
end

local function registerOneNpwdEmergencyHandler(emergencyNumber)
  local number = trim(emergencyNumber)
  if number == '' then return false end
  if npwdEmergencyHandlersRegistered[number] then return true end
  local npwdResource = getNpwdResourceName()
  if GetResourceState(npwdResource) ~= 'started' then return false end

  local ok, err = pcall(function()
    exports[npwdResource]:onCall(number, function(callRequest)
      handleNpwdEmergencyCall(number, callRequest)
    end)
  end)

  if not ok then
    print(('[cad_bridge] Failed to register NPWD emergency handler for %s: %s')
      :format(number, tostring(err)))
    return false
  end

  npwdEmergencyHandlersRegistered[number] = true
  print(('[cad_bridge] Registered NPWD emergency handler for number %s'):format(number))
  return true
end

local function registerNpwdEmergencyHandlers()
  local numbers = getNpwdEmergencyNumbers()
  if #numbers == 0 then return true end

  local allRegistered = true
  for _, number in ipairs(numbers) do
    if not registerOneNpwdEmergencyHandler(number) then
      allRegistered = false
    end
  end
  return allRegistered
end

startNpwdEmergencyHandlerRegistration = function()
  local maxAttempts = 20
  CreateThread(function()
    for _ = 1, maxAttempts do
      if registerNpwdEmergencyHandlers() then
        return
      end
      Wait(1000)
    end
    print('[cad_bridge] NPWD emergency handlers not fully registered after retries')
  end)
end

RegisterNetEvent('cad_bridge:submit000', function(payload)
  local src = source
  if not src or src == 0 then return end

  local report, err = parseEmergencyPopupReport(payload)
  if not report then
    notifyPlayer(src, err or 'Invalid emergency form details.')
    return
  end

  submitEmergencyCall(src, report)
end)

RegisterNetEvent('cad_bridge:submitDriverLicense', function(payload)
  local src = source
  print(('[cad_bridge] >>> submitDriverLicense event received from src=%s'):format(tostring(src)))
  if not src or src == 0 then
    print('[cad_bridge] submitDriverLicense ABORTED: invalid source')
    return
  end
  logDocumentTrace('license-event-received', {
    source = tonumber(src) or 0,
    payload = summarizeLicensePayloadForLog(payload),
  }, true)

  local formData, err = parseDriverLicenseForm(payload)
  if not formData then
    print(('[cad_bridge] submitDriverLicense ABORTED: form validation failed: %s'):format(tostring(err)))
    logDocumentFailure('license-validate-failed', {
      source = tonumber(src) or 0,
      error = trim(err or 'invalid_form'),
      payload = summarizeLicensePayloadForLog(payload),
    })
    notifyPlayer(src, err or 'Invalid driver license details.')
    return
  end

  print(('[cad_bridge] submitDriverLicense: form valid, calling submitDriverLicense() for citizenid=%s'):format(trim(getCitizenId(src) or '')))
  submitDriverLicense(src, formData)
end)

RegisterNetEvent('cad_bridge:submitVehicleRegistration', function(payload)
  local src = source
  print(('[cad_bridge] >>> submitVehicleRegistration event received from src=%s'):format(tostring(src)))
  if not src or src == 0 then
    print('[cad_bridge] submitVehicleRegistration ABORTED: invalid source')
    return
  end
  logDocumentTrace('registration-event-received', {
    source = tonumber(src) or 0,
    payload = summarizeRegistrationPayloadForLog(payload),
  }, true)

  local formData, err = parseVehicleRegistrationForm(payload)
  if not formData then
    logDocumentFailure('registration-validate-failed', {
      source = tonumber(src) or 0,
      error = trim(err or 'invalid_form'),
      payload = summarizeRegistrationPayloadForLog(payload),
    })
    notifyPlayer(src, err or 'Invalid registration details.')
    return
  end

  submitVehicleRegistration(src, formData)
end)

RegisterNetEvent('cad_bridge:requestShowId', function(targetSource)
  local src = source
  if not src or src == 0 then return end

  local defaults = getCharacterDefaults(src)
  local citizenId = trim(defaults.citizenid or getCitizenId(src) or '')
  if citizenId == '' then
    notifyPlayer(src, 'Unable to determine your active character (citizenid).')
    return
  end

  local function getPlayerCoords(sourceId)
    local s = tonumber(sourceId) or 0
    if s <= 0 then return nil end

    local ped = GetPlayerPed(s)
    if ped and ped > 0 then
      local coords = GetEntityCoords(ped)
      if coords then
        return {
          x = tonumber(coords.x) or 0.0,
          y = tonumber(coords.y) or 0.0,
          z = tonumber(coords.z) or 0.0,
        }
      end
    end

    local cached = PlayerPositions[s]
    if type(cached) == 'table' then
      return {
        x = tonumber(cached.x) or 0.0,
        y = tonumber(cached.y) or 0.0,
        z = tonumber(cached.z) or 0.0,
      }
    end
    return nil
  end

  local function findNearbyPlayers(originSource, radius)
    local nearby = {}
    local seen = {}
    local origin = getPlayerCoords(originSource)
    if not origin then return nearby, seen end

    local maxDistance = tonumber(radius) or tonumber(Config.ShowIdTargetDistance or 4.0) or 4.0
    if maxDistance < 1.0 then maxDistance = 1.0 end

    for _, player in ipairs(GetPlayers()) do
      local candidate = tonumber(player) or 0
      if candidate > 0 and candidate ~= originSource and GetPlayerName(candidate) then
        local targetCoords = getPlayerCoords(candidate)
        if targetCoords then
          local dx = targetCoords.x - origin.x
          local dy = targetCoords.y - origin.y
          local dz = targetCoords.z - origin.z
          local distance = math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
          if distance <= maxDistance then
            seen[candidate] = true
            nearby[#nearby + 1] = candidate
          end
        end
      end
    end

    return nearby, seen
  end

  local nearbyDistance = tonumber(Config.ShowIdNearbyDistance or Config.ShowIdTargetDistance or 4.0) or 4.0
  local viewerTargets, viewerTargetSet = findNearbyPlayers(src, nearbyDistance)
  local target = tonumber(targetSource) or 0
  if target > 0 and target ~= src and GetPlayerName(target) and not viewerTargetSet[target] then
    viewerTargetSet[target] = true
    viewerTargets[#viewerTargets + 1] = target
  end

  request('GET', '/api/integration/fivem/licenses/' .. urlEncode(citizenId), nil, function(status, body)
    if status == 404 then
      notifyPlayer(src, 'No licence record found in CAD. Use /cadlicense first.')
      return
    end

    if status < 200 or status >= 300 then
      notifyPlayer(src, ('Unable to fetch licence from CAD (HTTP %s).'):format(tostring(status)))
      return
    end

    local ok, parsed = pcall(json.decode, body or '{}')
    if not ok or type(parsed) ~= 'table' or type(parsed.license) ~= 'table' then
      notifyPlayer(src, 'CAD returned an invalid licence response.')
      return
    end

    local license = parsed.license
    local fullName = trim(license.full_name or defaults.full_name or getCharacterDisplayName(src) or '')

    -- Resolve mugshot URL to a full URL for fetching the image server-side.
    local rawMugshot = trim(license.mugshot_url or '')
    local mugshotFullUrl = rawMugshot
    if rawMugshot ~= '' and rawMugshot:sub(1, 1) == '/' then
      mugshotFullUrl = getCadUrl(rawMugshot)
    end

    local payload = {
      full_name = fullName,
      date_of_birth = trim(license.date_of_birth or defaults.date_of_birth or ''),
      gender = trim(license.gender or defaults.gender or ''),
      license_number = trim(license.license_number or ''),
      license_classes = normalizeList(license.license_classes or {}, true),
      conditions = normalizeList(license.conditions or {}, false),
