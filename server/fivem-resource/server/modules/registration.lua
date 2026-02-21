      return false
    end

    local function submitLicensePost()
      print(('[cad_bridge] >>> Sending POST /api/integration/fivem/licenses for citizenid=%s'):format(trim(payload.citizenid or '')))
      logDocumentTrace('license-create-request', {
        citizenid = trim(payload.citizenid or ''),
        mugshot_length = math.max(#(trim(payload.mugshot_data or '')), #(trim(payload.mugshot_url or ''))),
        mugshot_data_length = #(trim(payload.mugshot_data or '')),
        mugshot_url_length = #(trim(payload.mugshot_url or '')),
        has_retried_without_photo = hasRetriedWithoutPhoto == true,
      })
      request('POST', '/api/integration/fivem/licenses', payload, function(status, body, responseHeaders)
        print(('[cad_bridge] <<< POST /licenses response: HTTP %s body_len=%d'):format(tostring(status), #(body or '')))
        logDocumentTrace('license-create-response', {
          http_status = tonumber(status) or 0,
          citizenid = trim(payload.citizenid or ''),
          retry_without_photo = hasRetriedWithoutPhoto == true,
        })
        if status >= 200 and status < 300 then
          local expiryAt = payload.expiry_at
          local ok, parsed = pcall(json.decode, body or '{}')
          if ok and type(parsed) == 'table' and type(parsed.license) == 'table' then
            expiryAt = tostring(parsed.license.expiry_at or expiryAt)
          end
          logDocumentTrace('license-create-success', {
            citizenid = trim(payload.citizenid or ''),
            expiry_at = trim(expiryAt or ''),
            saved_without_photo = savedWithoutPhoto == true,
          }, true)
          notifyPlayer(s, ('Driver licence saved to CAD%s%s%s%s%s%s%s'):format(
            photoOnly and ' | Photo updated' or '. Status: VALID',
            expiryAt ~= '' and ' | Expires: ' or '',
            expiryAt ~= '' and expiryAt or '',
            feeCharged and ' | Charged: ' or '',
            feeCharged and formatMoney(feeAmount) or '',
            savedWithoutPhoto and ' | Photo: ' or '',
            savedWithoutPhoto and 'omitted (payload too large)' or ''
          ))
          return
        end

        if shouldRetryWithoutPhoto(status, body) then
          hasRetriedWithoutPhoto = true
          savedWithoutPhoto = true
          payload.mugshot_data = ''
          payload.mugshot_url = ''
          print(('[cad_bridge] Driver licence save retry without mugshot for src %s (initial HTTP %s)'):format(
            tostring(s),
            tostring(status)
          ))
          submitLicensePost()
          return
        end

        if status == 409 then
          local existingExpiry = ''
          local ok, parsed = pcall(json.decode, body or '{}')
          if ok and type(parsed) == 'table' then
            existingExpiry = trim(parsed.existing_expiry_at or '')
          end
          logDocumentFailure('license-create-rejected', {
            reason = 'renewal_window_blocked',
            http_status = tonumber(status) or 0,
            existing_expiry_at = existingExpiry,
            payload = summarizeLicensePayloadForLog(payload),
          })
          notifyPlayer(s, ('Licence renewal unavailable. You can renew within 3 days of expiry%s%s.'):format(
            existingExpiry ~= '' and ' (current expiry: ' or '',
            existingExpiry ~= '' and (existingExpiry .. ')') or ''
          ))
          maybeRefundFee()
          return
        end

        if status == 413 then
          logDocumentFailure('license-create-rejected', {
            reason = 'payload_too_large',
            http_status = tonumber(status) or 0,
            payload = summarizeLicensePayloadForLog(payload),
          })
          notifyPlayer(s, 'Licence photo is too large for CAD. Try again (JPG/compressed) or contact staff.')
          maybeRefundFee()
          return
        end

        if status == 429 then
          setBridgeBackoff('licenses', responseHeaders, 15000, 'driver license create')
        end

        local err = ('Failed to create CAD driver license (HTTP %s)'):format(tostring(status))
        local parsedError = parseBridgeError(body)
        if parsedError ~= '' then
          err = err .. ': ' .. parsedError
        end
        print('[cad_bridge] ' .. err)
        logDocumentFailure('license-create-failed', {
          http_status = tonumber(status) or 0,
          api_error = parsedError,
          fee_charged = feeCharged == true,
          fee_amount = feeAmount,
          payload = summarizeLicensePayloadForLog(payload),
        })
        maybeRefundFee()
        if parsedError ~= '' then
          notifyPlayer(s, ('Driver license failed to save: %s'):format(parsedError))
        else
          notifyPlayer(s, 'Driver license failed to save to CAD. Check server logs.')
        end
      end)
    end

    submitLicensePost()
  end)
end

local function submitVehicleRegistration(src, formData)
  local s = tonumber(src)
  if not s then return end
  if isBridgeBackoffActive('registrations') then
    local waitSeconds = math.max(1, math.ceil(getEffectiveBackoffRemainingMs('registrations') / 1000))
    local message = ('CAD bridge is rate-limited. Try again in %ss.'):format(waitSeconds)
    notifyPlayer(s, message)
    TriggerClientEvent('cad_bridge:vehicleRegistrationSubmitResult', s, {
      ok = false,
      error_code = 'bridge_rate_limited',
      message = message,
    })
    return
  end

  local defaults = getCharacterDefaults(s)
  local payload = {
    source = s,
    player_name = getCharacterDisplayName(s),
    platform_name = trim(GetPlayerName(s) or ''),
    identifiers = GetPlayerIdentifiers(s),
    citizenid = trim(getCitizenId(s) or defaults.citizenid or ''),
    owner_name = trim(defaults.full_name ~= '' and defaults.full_name or formData.owner_name),
    plate = trim(formData.plate or ''),
    vehicle_model = trim(formData.vehicle_model or ''),
    vehicle_colour = trim(formData.vehicle_colour or ''),
    duration_days = tonumber(formData.duration_days or Config.VehicleRegistrationDefaultDays or 35) or (Config.VehicleRegistrationDefaultDays or 35),
    expiry_at = normalizeDateOnly(formData.expiry_at or ''),
    status = 'valid',
  }
  logDocumentTrace('registration-submit-start', {
    payload = summarizeRegistrationPayloadForLog(payload),
    form = summarizeRegistrationPayloadForLog(formData),
  }, true)

  if trim(payload.citizenid) == '' then
    local message = 'Unable to determine your active character (citizenid). Re-log and try again.'
    notifyPlayer(s, message)
    print(('[cad_bridge] Registration submit blocked for src %s: missing citizenid'):format(tostring(s)))
    logDocumentFailure('registration-create-blocked', {
      reason = 'missing_citizenid',
      payload = summarizeRegistrationPayloadForLog(payload),
    })
    TriggerClientEvent('cad_bridge:vehicleRegistrationSubmitResult', s, {
      ok = false,
      error_code = 'missing_citizenid',
      message = message,
    })
    return
  end

  local feeAccount = trim(Config.DocumentFeeAccount or 'bank'):lower()
  if feeAccount == '' then feeAccount = 'bank' end
  local feeAmount = resolveDocumentFeeAmount(Config.VehicleRegistrationFeesByDays or {}, payload.duration_days)
  local feeCharged = false
  local feeRequired = Config.RequireDocumentFeePayment == true

  request('GET', '/api/integration/fivem/registrations/' .. urlEncode(payload.plate), nil, function(existingStatus, existingBody)
    logDocumentTrace('registration-renew-check-response', {
      http_status = tonumber(existingStatus) or 0,
      plate = trim(payload.plate or ''),
    })
    if existingStatus >= 200 and existingStatus < 300 then
      local okExisting, existingParsed = pcall(json.decode, existingBody or '{}')
      if okExisting and type(existingParsed) == 'table' and type(existingParsed.registration) == 'table' then
        local daysUntilExpiry = daysUntilDateOnly(existingParsed.registration.expiry_at)
        if daysUntilExpiry ~= nil and daysUntilExpiry > 3 then
          local message = ('Registration renewal unavailable. You can renew when within 3 days of expiry (current expiry: %s).'):format(tostring(existingParsed.registration.expiry_at or 'unknown'))
          notifyPlayer(s, message)
          TriggerClientEvent('cad_bridge:vehicleRegistrationSubmitResult', s, {
            ok = false,
            error_code = 'renewal_window_blocked',
            message = message,
          })
          return
        end
      end
    end

    if feeAmount > 0 then
      local paid, payErr = chargeDocumentFee(
        s,
        payload.citizenid,
        feeAccount,
        feeAmount,
        ('Vehicle registration issue/renewal (%s days)'):format(tostring(math.floor(tonumber(payload.duration_days) or 0)))
      )
      if not paid then
      local feeError = payErr ~= '' and payErr or ('Unable to charge registration fee %s from %s account.'):format(formatMoney(feeAmount), feeAccount)
      if feeRequired then
        logDocumentFailure('registration-create-blocked', {
          reason = 'fee_charge_failed_required',
          fee_account = feeAccount,
          fee_amount = feeAmount,
          fee_error = feeError,
          payload = summarizeRegistrationPayloadForLog(payload),
        })
        notifyPlayer(s, feeError)
        TriggerClientEvent('cad_bridge:vehicleRegistrationSubmitResult', s, {
          ok = false,
          error_code = 'fee_charge_failed_required',
          message = feeError,
        })
        return
      end
        print(('[cad_bridge] Registration fee bypassed for src %s (continuing without payment): %s'):format(
          tostring(s),
          tostring(feeError)
        ))
        notifyPlayer(s, 'Registration fee could not be charged. Continuing without payment.')
      else
        feeCharged = true
      end
    end

    request('POST', '/api/integration/fivem/registrations', payload, function(status, body, responseHeaders)
      logDocumentTrace('registration-create-response', {
        http_status = tonumber(status) or 0,
        plate = trim(payload.plate or ''),
      })
      if status >= 200 and status < 300 then
        local expiryAt = payload.expiry_at
        local ok, parsed = pcall(json.decode, body or '{}')
        if ok and type(parsed) == 'table' and type(parsed.registration) == 'table' then
          expiryAt = tostring(parsed.registration.expiry_at or expiryAt)
        end
        logDocumentTrace('registration-create-success', {
