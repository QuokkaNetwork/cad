-- Mini-CAD: Server-side handlers for fetching active call data and detaching units.

local miniCadInFlightBySource = {}

RegisterNetEvent('cad_bridge:requestMiniCadData', function()
  local src = tonumber(source) or 0
  if src <= 0 then return end

  if not hasBridgeConfig() then return end
  if miniCadInFlightBySource[src] then return end
  if isBridgeBackoffActive('minicad_poll') then return end

  miniCadInFlightBySource[src] = true
  local gameId = tostring(src)

  request('GET', '/api/integration/fivem/unit-active-call?game_id=' .. urlEncode(gameId), nil, function(status, body, responseHeaders)
    miniCadInFlightBySource[src] = nil

    if status == 429 then
      setBridgeBackoff('minicad_poll', responseHeaders, 10000, 'minicad poll')
      return
    end

    if status ~= 200 then
      TriggerClientEvent('cad_bridge:miniCadUpdate', src, nil)
      return
    end

    local ok, parsed = pcall(json.decode, body or 'null')
    if not ok or type(parsed) ~= 'table' then
      TriggerClientEvent('cad_bridge:miniCadUpdate', src, nil)
      return
    end

    TriggerClientEvent('cad_bridge:miniCadUpdate', src, parsed)
  end)
end)

RegisterNetEvent('cad_bridge:miniCadDetach', function(callId)
  local src = tonumber(source) or 0
  if src <= 0 then return end
  local cid = tonumber(callId) or 0
  if cid <= 0 then return end

  if not hasBridgeConfig() then return end

  local gameId = tostring(src)
  request('POST', '/api/integration/fivem/unit-detach-call', {
    game_id = gameId,
    call_id = cid,
  }, function(status, body)
    if status >= 200 and status < 300 then
      -- Refresh the mini-CAD after detach.
      TriggerClientEvent('cad_bridge:miniCadUpdate', src, nil)
    end
  end)
end)
