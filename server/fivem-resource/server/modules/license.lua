      return
    end
    if status == 429 then
      setBridgeBackoff('calls', responseHeaders, 15000, '/000 call')
    end

    local err = ('Failed to create CAD call (HTTP %s)'):format(tostring(status))
    local ok, parsed = pcall(json.decode, body or '{}')
    if ok and type(parsed) == 'table' and parsed.error then
      err = err .. ': ' .. tostring(parsed.error)
    end
    print('[cad_bridge] ' .. err)
    notifyPlayer(s, '000 call failed to send to CAD. Check server logs.')
  end)
end

local function submitDriverLicense(src, formData)
  local s = tonumber(src)
  if not s then return end
  local photoOnly = formData and formData.photo_only == true
  print(('[cad_bridge] submitDriverLicense() called for src=%s'):format(tostring(s)))
  if isBridgeBackoffActive('licenses') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('licenses') / 1000))
    print(('[cad_bridge] submitDriverLicense BLOCKED by rate-limit backoff (%ss remaining)'):format(waitSeconds))
    notifyPlayer(s, ('CAD bridge is rate-limited. Try again in %ss.'):format(waitSeconds))
    return
  end

  local defaults = getCharacterDefaults(s)
  local payload = {
    source = s,
    player_name = getCharacterDisplayName(s),
    platform_name = trim(GetPlayerName(s) or ''),
    identifiers = GetPlayerIdentifiers(s),
    citizenid = trim(getCitizenId(s) or defaults.citizenid or ''),
    full_name = trim(defaults.full_name ~= '' and defaults.full_name or formData.full_name),
    date_of_birth = normalizeDateOnly(defaults.date_of_birth ~= '' and defaults.date_of_birth or formData.date_of_birth),
    gender = trim(defaults.gender ~= '' and defaults.gender or formData.gender),
    license_number = trim(formData.license_number or ''),
    license_classes = formData.license_classes or {},
    conditions = formData.conditions or {},
    mugshot_data = trim(formData.mugshot_data or ''),
    mugshot_url = trim(formData.mugshot_url or ''),
    expiry_days = tonumber(formData.expiry_days or Config.DriverLicenseDefaultExpiryDays or 35) or (Config.DriverLicenseDefaultExpiryDays or 35),
    expiry_at = normalizeDateOnly(formData.expiry_at or ''),
    status = 'valid',
    photo_only = photoOnly,
  }

  -- Check for server-side captured mugshot (from serverCapture export).
  local serverMugshot = consumePendingMugshot(s)
  if serverMugshot ~= '' then
    print(('[cad_bridge] Using server-side captured mugshot for src=%s (len=%d)'):format(tostring(s), #serverMugshot))
    payload.mugshot_data = serverMugshot
  end

  print(('[cad_bridge] License payload: citizenid=%q name=%q dob=%q mugshot_data_len=%d mugshot_url_len=%d'):format(
    trim(payload.citizenid or ''), trim(payload.full_name or ''),
    trim(payload.date_of_birth or ''), #trim(payload.mugshot_data or ''), #trim(payload.mugshot_url or '')))

  -- Persist mugshot to a local file as a backup copy.
  if trim(payload.mugshot_data) ~= '' and trim(payload.citizenid) ~= '' then
    local savedFile = saveMugshotFile(payload.citizenid, payload.mugshot_data)
    if savedFile ~= '' then
      print(('[cad_bridge] Mugshot file persisted: %s'):format(savedFile))
    end
  end

  logDocumentTrace('license-submit-start', {
    payload = summarizeLicensePayloadForLog(payload),
    form = summarizeLicensePayloadForLog(formData),
  }, true)

  if trim(payload.citizenid) == '' then
    notifyPlayer(s, 'Unable to determine your active character (citizenid). Re-log and try again.')
    print(('[cad_bridge] Driver license submit blocked for src %s: missing citizenid'):format(tostring(s)))
    logDocumentFailure('license-create-blocked', {
      reason = 'missing_citizenid',
      payload = summarizeLicensePayloadForLog(payload),
    })
    return
  end

  print(('[cad_bridge] Checking existing license for citizenid=%s ...'):format(trim(payload.citizenid or '')))
  request('GET', '/api/integration/fivem/licenses/' .. urlEncode(payload.citizenid), nil, function(existingStatus, existingBody)
    print(('[cad_bridge] Existing license check response: HTTP %s'):format(tostring(existingStatus)))
    logDocumentTrace('license-renew-check-response', {
      http_status = tonumber(existingStatus) or 0,
      citizenid = trim(payload.citizenid or ''),
    })
    if existingStatus >= 200 and existingStatus < 300 then
      local okExisting, existingParsed = pcall(json.decode, existingBody or '{}')
      if okExisting and type(existingParsed) == 'table' and type(existingParsed.license) == 'table' then
        local existingLicense = existingParsed.license
        local existingStatus = trim(existingLicense.status or ''):lower()
        local daysUntilExpiry = daysUntilDateOnly(existingLicense.expiry_at)
        print(('[cad_bridge] Existing license found: expiry_at=%s daysUntilExpiry=%s status=%s'):format(
          tostring(existingLicense.expiry_at or '?'),
          tostring(daysUntilExpiry),
          tostring(existingLicense.status or '?')
        ))
        if (existingStatus == 'suspended' or existingStatus == 'disqualified') and not photoOnly then
          notifyPlayer(s, ('Licence renewal blocked. Your licence status is "%s".'):format(existingStatus))
          return
        end
        if photoOnly then
          payload.full_name = trim(existingLicense.full_name or payload.full_name)
          payload.date_of_birth = normalizeDateOnly(existingLicense.date_of_birth or payload.date_of_birth)
          payload.gender = trim(existingLicense.gender or payload.gender)
          payload.license_number = trim(existingLicense.license_number or payload.license_number)
          payload.license_classes = normalizeList(existingLicense.license_classes or payload.license_classes or {}, true)
          payload.conditions = normalizeList(existingLicense.conditions or payload.conditions or {}, false)
          payload.expiry_at = normalizeDateOnly(existingLicense.expiry_at or payload.expiry_at)
          local resolvedDays = daysUntilDateOnly(payload.expiry_at)
          payload.expiry_days = (resolvedDays and resolvedDays > 0) and resolvedDays or math.floor(payload.expiry_days or 1)
          if payload.expiry_days < 1 then payload.expiry_days = 1 end
          if existingStatus == 'suspended' or existingStatus == 'disqualified' then
            payload.status = existingStatus
          end
          print('[cad_bridge] Photo-only licence update requested; skipping renewal window block and fees')
        elseif daysUntilExpiry ~= nil and daysUntilExpiry > 3 then
          print(('[cad_bridge] BLOCKED: Licence renewal unavailable — %s days until expiry (must be <=3). citizenid=%s'):format(
            tostring(daysUntilExpiry), trim(payload.citizenid or '')))
          notifyPlayer(s, ('Licence renewal unavailable. You can renew when within 3 days of expiry (current expiry: %s).'):format(tostring(existingLicense.expiry_at or 'unknown')))
          return
        end
        print('[cad_bridge] Existing license is within renewal window or expired — proceeding with upsert')
      else
        if photoOnly then
          notifyPlayer(s, 'Unable to read existing licence record for photo update.')
          return
        end
        print('[cad_bridge] Existing license response could not be parsed - proceeding with create')
      end
    else
      if photoOnly then
        notifyPlayer(s, 'No existing licence record found to update photo.')
        return
      end
      print(('[cad_bridge] No existing license found (HTTP %s) - proceeding with create'):format(tostring(existingStatus)))
    end

    local feeAccount = trim(Config.DocumentFeeAccount or 'bank'):lower()
    if feeAccount == '' then feeAccount = 'bank' end
    local feeAmount = photoOnly and 0 or resolveDocumentFeeAmount(Config.DriverLicenseFeesByDays or {}, payload.expiry_days)
    print(('[cad_bridge] Fee check: amount=%s required=%s account=%s'):format(
      tostring(feeAmount), tostring(Config.RequireDocumentFeePayment == true), feeAccount))
    local feeCharged = false
    local feeRequired = Config.RequireDocumentFeePayment == true

    if feeAmount > 0 then
      local paid, payErr = chargeDocumentFee(
        s,
        payload.citizenid,
        feeAccount,
        feeAmount,
        ('Driver licence issue/renewal (%s days)'):format(tostring(math.floor(tonumber(payload.expiry_days) or 0)))
      )
      if not paid then
        local feeError = payErr ~= '' and payErr or ('Unable to charge licence fee %s from %s account.'):format(formatMoney(feeAmount), feeAccount)
        if feeRequired then
          logDocumentFailure('license-create-blocked', {
            reason = 'fee_charge_failed_required',
            fee_account = feeAccount,
            fee_amount = feeAmount,
            fee_error = feeError,
            payload = summarizeLicensePayloadForLog(payload),
          })
          notifyPlayer(s, feeError)
          return
        end
        print(('[cad_bridge] Driver licence fee bypassed for src %s (continuing without payment): %s'):format(
          tostring(s),
          tostring(feeError)
        ))
        notifyPlayer(s, 'Licence fee could not be charged. Continuing without payment.')
      else
        feeCharged = true
      end
    end
    local hasRetriedWithoutPhoto = false
    local savedWithoutPhoto = false

    local function parseBridgeError(body)
      local ok, parsed = pcall(json.decode, body or '{}')
      if ok and type(parsed) == 'table' and parsed.error then
        return trim(parsed.error)
      end
      return ''
    end

    local function maybeRefundFee()
      if not feeCharged or feeAmount <= 0 then return end
      local refunded, refundErr = refundDocumentFee(
        s,
        payload.citizenid,
        feeAccount,
        feeAmount,
        'CAD licence refund (save failed)'
      )
      if not refunded then
        print(('[cad_bridge] WARNING: licence fee refund failed for src %s amount %s: %s'):format(
          tostring(s),
          tostring(feeAmount),
          tostring(refundErr)
        ))
      end
    end

    local function shouldRetryWithoutPhoto(status, body)
      if hasRetriedWithoutPhoto then return false end
      if trim(payload.mugshot_data or '') == '' and trim(payload.mugshot_url or '') == '' then return false end

      local code = tonumber(status) or 0
      if code == 413 then return true end
      if code ~= 400 then return false end

      local errorText = parseBridgeError(body):lower()
      if errorText:find('payload too large', 1, true) then return true end
      if errorText:find('mugshot', 1, true) and errorText:find('too large', 1, true) then return true end
