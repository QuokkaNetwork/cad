      first_name = trim(license.first_name or ''),
      last_name = trim(license.last_name or ''),
      address = trim(license.address or ''),
      expiry_at = trim(license.expiry_at or ''),
      mugshot_url = '',
    }

    if payload.first_name == '' then
      payload.first_name = trim((payload.full_name or ''):match('^([^%s]+)') or '')
    end
    if payload.last_name == '' then
      payload.last_name = trim((payload.full_name or ''):match('(%S+)%s*$') or '')
      if payload.last_name == payload.first_name then
        payload.last_name = ''
      end
    end
    if payload.first_name ~= '' and payload.last_name ~= '' then
      payload.full_name = ('%s %s'):format(payload.first_name, payload.last_name)
    end

    -- Fetch the mugshot image server-side and convert to a data URI so the NUI
    -- doesn't hit mixed-content blocks (cfx-nui is HTTPS, CAD is HTTP).
    local function broadcastIdCard(mugshotDataUri)
      payload.mugshot_url = mugshotDataUri or ''

      TriggerClientEvent('cad_bridge:showIdCard', src, {
        first_name = payload.first_name,
        last_name = payload.last_name,
        full_name = payload.full_name,
        address = payload.address,
        date_of_birth = payload.date_of_birth,
        license_number = payload.license_number,
        license_classes = payload.license_classes,
        conditions = payload.conditions,
        expiry_at = payload.expiry_at,
        mugshot_url = payload.mugshot_url,
        viewer_note = 'Your licence record',
      })

      local shownCount = 0
      for _, viewerSource in ipairs(viewerTargets) do
        if tonumber(viewerSource) and viewerSource ~= src and GetPlayerName(viewerSource) then
          TriggerClientEvent('cad_bridge:showIdCard', viewerSource, {
          first_name = payload.first_name,
          last_name = payload.last_name,
          full_name = payload.full_name,
          address = payload.address,
          date_of_birth = payload.date_of_birth,
          license_number = payload.license_number,
          license_classes = payload.license_classes,
          conditions = payload.conditions,
          expiry_at = payload.expiry_at,
          mugshot_url = payload.mugshot_url,
          viewer_note = ('Shown by %s'):format(getCharacterDisplayName(src)),
        })
          shownCount = shownCount + 1
        end
      end

      if shownCount > 0 then
        notifyPlayer(src, ('Licence shown to %s nearby player%s.'):format(
          tostring(shownCount),
          shownCount == 1 and '' or 's'
        ))
        return
      end

      notifyPlayer(src, 'No nearby player found. Licence shown to yourself only.')
    end

    if mugshotFullUrl == '' or rawMugshot == '' then
      broadcastIdCard('')
      return
    end

    -- Fetch the image binary from the CAD server, base64-encode it as a data URI.
    PerformHttpRequest(mugshotFullUrl, function(imgStatus, imgBody, imgHeaders)
      if imgStatus < 200 or imgStatus >= 300 or not imgBody or #imgBody == 0 then
        print(('[cad_bridge] WARNING: Failed to fetch mugshot image (HTTP %s) from %s'):format(tostring(imgStatus), mugshotFullUrl))
        broadcastIdCard('')
        return
      end

      -- Determine MIME type from the URL extension, default to png.
      local mime = 'image/png'
      if mugshotFullUrl:match('%.jpe?g$') then mime = 'image/jpeg'
      elseif mugshotFullUrl:match('%.webp$') then mime = 'image/webp'
      end

      local b64 = ''
      if type(imgBody) == 'string' and #imgBody > 0 then
        -- FiveM's Lua doesn't have a built-in base64 encoder, but we can
        -- build one from the standard bit operations.
        local b64chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
        local len = #imgBody
        local parts = {}
        for i = 1, len, 3 do
          local a = string.byte(imgBody, i) or 0
          local b2 = (i + 1 <= len) and string.byte(imgBody, i + 1) or 0
          local c = (i + 2 <= len) and string.byte(imgBody, i + 2) or 0
          local n = a * 65536 + b2 * 256 + c

          local c1 = math.floor(n / 262144) % 64
          local c2 = math.floor(n / 4096) % 64
          local c3 = math.floor(n / 64) % 64
          local c4 = n % 64

          parts[#parts + 1] = b64chars:sub(c1 + 1, c1 + 1)
          parts[#parts + 1] = b64chars:sub(c2 + 1, c2 + 1)
          if i + 1 <= len then
            parts[#parts + 1] = b64chars:sub(c3 + 1, c3 + 1)
          else
            parts[#parts + 1] = '='
          end
          if i + 2 <= len then
            parts[#parts + 1] = b64chars:sub(c4 + 1, c4 + 1)
          else
            parts[#parts + 1] = '='
          end
        end
        b64 = table.concat(parts)
      end

      if b64 ~= '' then
        broadcastIdCard('data:' .. mime .. ';base64,' .. b64)
      else
        broadcastIdCard('')
      end
    end, 'GET', '', {
      ['Accept'] = 'image/*',
    })
  end)
end)

RegisterCommand('000', function(src, args)
  if not src or src == 0 then
    print('[cad_bridge] /000 command is in-game only')
    return
  end

  local rawInput = trim(table.concat(args or {}, ' '))
  if rawInput == '' then
    request('GET', '/api/integration/fivem/departments', nil, function(status, body)
      local departments = {}
      if status >= 200 and status < 300 then
        local ok, parsed = pcall(json.decode, body or '[]')
        if ok and type(parsed) == 'table' then
          for _, dept in ipairs(parsed) do
            local id = tonumber(dept.id)
            if id and id > 0 then
              departments[#departments + 1] = {
                id = math.floor(id),
                name = tostring(dept.name or ''),
                short_name = tostring(dept.short_name or ''),
                color = tostring(dept.color or ''),
              }
            end
          end
        end
      end
      TriggerClientEvent('cad_bridge:prompt000', src, departments)
    end)
    return
  end
  if rawInput:lower() == 'help' then
    sendEmergencyUsage(src)
    return
  end

  local report, err = parseEmergencyReport(rawInput)
  if not report then
    notifyPlayer(src, err or 'Invalid emergency format.')
    sendEmergencyUsage(src)
    return
  end

  submitEmergencyCall(src, report)
end, false)

local function getDocumentInteractionPedById(pedId)
  local target = trim(pedId or '')
  if target == '' then return nil end
  local configured = Config.DocumentInteractionPeds
  if type(configured) ~= 'table' then return nil end
  for _, ped in ipairs(configured) do
    if type(ped) == 'table' and trim(ped.id or '') == target then
      return ped
    end
  end
  return nil
end

local function normalizeVec3Like(value)
  if value == nil then return nil end
  local t = type(value)
  if t ~= 'table' and t ~= 'vector3' and t ~= 'vector4' and t ~= 'userdata' then return nil end

  local function readRaw(container, key, index)
    local out = nil
    local ok = pcall(function()
      out = container[key]
    end)
    if (not ok or out == nil) and index ~= nil then
      pcall(function()
        out = container[index]
      end)
    end
    return out
  end

  local x = tonumber(readRaw(value, 'x', 1))
  local y = tonumber(readRaw(value, 'y', 2))
  local z = tonumber(readRaw(value, 'z', 3) or 0.0)
  local w = tonumber(readRaw(value, 'w', 4))
  if not x or not y then return nil end

  local out = {
    x = x + 0.0,
    y = y + 0.0,
    z = (z or 0.0) + 0.0,
  }
  if w then out.w = w + 0.0 end
  return out
end

local function openDriverLicensePromptForSource(src, pedId)
  if not src or src == 0 then
    print('[cad_bridge] Driver license prompt is in-game only')
    return
  end
  local sourcePed = getDocumentInteractionPedById(pedId)
  if trim(pedId or '') ~= '' and not sourcePed then
    notifyPlayer(src, 'Invalid document desk.')
    return
  end
  if sourcePed and sourcePed.allows_license ~= true then
    notifyPlayer(src, 'Licences are not available at this desk.')
    return
  end

  local defaults = getCharacterDefaults(src)
  local defaultExpiryDays = tonumber(Config.DriverLicenseQuizExpiryDays or 30) or 30
  if defaultExpiryDays < 1 then defaultExpiryDays = 30 end
  local citizenId = trim(defaults.citizenid or getCitizenId(src) or '')
  local payload = {
    full_name = defaults.full_name,
    date_of_birth = defaults.date_of_birth,
    gender = defaults.gender,
    citizenid = citizenId,
    quiz_pass_percent = tonumber(Config.DriverLicenseQuizPassPercent or 80) or 80,
    class_options = Config.DriverLicenseQuizClasses or { 'CAR' },
    default_classes = Config.DriverLicenseQuizClasses or { 'CAR' },
    default_expiry_days = defaultExpiryDays,
    duration_options = { defaultExpiryDays },
    quiz_mode = true,
    can_take_quiz = true,
    can_retake_photo = false,
    existing_license = nil,
    renewal_window_days = 3,
    blocked_reason = '',
    blocked_message = '',
  }

  if citizenId == '' then
    TriggerClientEvent('cad_bridge:promptDriverLicense', src, payload)
    return
  end

  request('GET', '/api/integration/fivem/licenses/' .. urlEncode(citizenId), nil, function(status, body)
    if status >= 200 and status < 300 then
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and type(parsed.license) == 'table' then
        local license = parsed.license
        local expiryAt = trim(license.expiry_at or '')
        local statusText = trim(license.status or '')
        local statusLower = statusText:lower()
        local daysUntilExpiry = daysUntilDateOnly(expiryAt)
        local outsideRenewalWindow = statusLower == 'valid' and daysUntilExpiry ~= nil and daysUntilExpiry > 3
        payload.existing_license = {
          full_name = trim(license.full_name or payload.full_name),
          date_of_birth = normalizeDateOnly(license.date_of_birth or payload.date_of_birth),
          gender = trim(license.gender or payload.gender),
          license_number = trim(license.license_number or ''),
          license_classes = normalizeList(license.license_classes or {}, true),
          conditions = normalizeList(license.conditions or {}, false),
          expiry_at = expiryAt,
          status = statusText,
          days_until_expiry = daysUntilExpiry,
        }
        if statusLower == 'suspended' or statusLower == 'disqualified' then
          payload.can_take_quiz = false
          payload.can_retake_photo = true
          payload.blocked_reason = 'status'
          payload.blocked_message = ('Licence renewal is unavailable while your licence status is "%s". You may retake your photo or exit.'):format(
            statusText ~= '' and statusText or statusLower
          )
        elseif outsideRenewalWindow then
          payload.can_take_quiz = false
          payload.can_retake_photo = true
          payload.blocked_reason = 'renewal_window'
          payload.blocked_message = ('You already have a valid licence (status: %s, expiry: %s). You can renew within %s days of expiry. You may retake your photo now.'):format(
            statusText ~= '' and statusText or 'valid',
            expiryAt ~= '' and expiryAt or 'unknown',
            tostring(payload.renewal_window_days)
          )
        else
          payload.can_take_quiz = true
          payload.can_retake_photo = true
          payload.blocked_reason = ''
          payload.blocked_message = ''
        end
      end
    end
    TriggerClientEvent('cad_bridge:promptDriverLicense', src, payload)
  end)
end

local function openVehicleRegistrationPromptForSource(src, pedId)
  if not src or src == 0 then
    print('[cad_bridge] Vehicle registration prompt is in-game only')
    return
  end
  local sourcePed = getDocumentInteractionPedById(pedId)
  if trim(pedId or '') ~= '' and not sourcePed then
    notifyPlayer(src, 'Invalid document desk.')
    return
  end
  if sourcePed and sourcePed.allows_registration ~= true then
    notifyPlayer(src, 'Vehicle registration is not available at this desk.')
    return
  end

  local defaults = getCharacterDefaults(src)
  local pedDurationOptions = {}
  if sourcePed and type(sourcePed.registration_duration_options) == 'table' then
    for _, raw in ipairs(sourcePed.registration_duration_options) do
      local days = tonumber(raw)
      if days and days >= 1 then
        pedDurationOptions[#pedDurationOptions + 1] = math.floor(days)
      end
    end
  end
  local resolvedDurationOptions = (#pedDurationOptions > 0) and pedDurationOptions or (Config.VehicleRegistrationDurationOptions or { 6, 14, 35, 70 })
  local defaultDuration = tonumber(Config.VehicleRegistrationDefaultDays or 35) or 35
  if #pedDurationOptions > 0 then
    defaultDuration = tonumber(pedDurationOptions[1]) or 1
  end
  TriggerClientEvent('cad_bridge:promptVehicleRegistration', src, {
    owner_name = defaults.full_name,
    duration_options = resolvedDurationOptions,
    default_duration_days = defaultDuration,
    registration_parking = {
      coords = normalizeVec3Like(sourcePed and sourcePed.registration_parking_coords or nil),
      radius = tonumber(sourcePed and sourcePed.registration_parking_radius or 0) or 0,
    },
  })
end

RegisterNetEvent('cad_bridge:requestDriverLicensePrompt', function(pedId)
  local src = source
  openDriverLicensePromptForSource(src, pedId)
end)

RegisterNetEvent('cad_bridge:requestVehicleRegistrationPrompt', function(pedId)
  local src = source
  openVehicleRegistrationPromptForSource(src, pedId)
end)
