local function trim(value)
  if value == nil then return '' end
  return (tostring(value):gsub('^%s+', ''):gsub('%s+$', ''))
end

local closestCallPromptState = nil

local function getCallPromptDisplayLabel(state)
  local callId = tostring(state.call_id or '?')
  local title = trim(state.title or '')
  local priority = trim(state.priority or '')
  local location = trim(state.location or '')
  local postal = trim(state.postal or '')

  local header = ('CAD Call #%s'):format(callId)
  if priority ~= '' then
    header = ('%s | Priority %s'):format(header, priority)
  end

  local detail = title ~= '' and title or 'New active call'
  if location ~= '' and postal ~= '' then
    detail = ('%s @ %s (%s)'):format(detail, location, postal)
  elseif location ~= '' then
    detail = ('%s @ %s'):format(detail, location)
  elseif postal ~= '' then
    detail = ('%s @ Postal %s'):format(detail, postal)
  end

  return header, detail
end

local function notifyClosestCallPrompt(state)
  local header, detail = getCallPromptDisplayLabel(state)
  local distance = tonumber(state.distance_meters or 0) or 0
  local distanceLabel = ''
  if distance > 0 then
    distanceLabel = (' | %.0fm'):format(distance)
  end

  local message = ('%s%s\n%s\nPress Y to attach or N to decline.'):format(header, distanceLabel, detail)

  if GetResourceState('ox_lib') == 'started' then
    TriggerEvent('ox_lib:notify', {
      title = 'CAD Dispatch',
      description = message,
      type = 'inform',
      position = trim(Config and Config.OxNotifyPosition or '') ~= '' and Config.OxNotifyPosition or 'center-right',
      duration = 6000,
    })
  end
end

local function sendClosestCallPromptDecision(action, reason)
  local state = closestCallPromptState
  if type(state) ~= 'table' then return end

  closestCallPromptState = nil
  TriggerServerEvent('cad_bridge:closestCallPromptDecision', {
    id = tostring(state.id or ''),
    call_id = tonumber(state.call_id) or 0,
    action = tostring(action or 'decline'),
    reason = tostring(reason or ''),
  })
end

local function isPromptActive()
  return type(closestCallPromptState) == 'table'
end

RegisterNetEvent('cad_bridge:showClosestCallPrompt', function(payload)
  if type(payload) ~= 'table' then return end

  local promptId = trim(payload.id or payload.prompt_id or '')
  local callId = tonumber(payload.call_id) or 0
  if promptId == '' or callId <= 0 then
    return
  end

  local expiresInMs = math.max(6000, tonumber(payload.expires_in_ms) or 15000)
  closestCallPromptState = {
    id = promptId,
    call_id = callId,
    title = tostring(payload.title or payload.call_title or ''),
    priority = tostring(payload.priority or ''),
    location = tostring(payload.location or ''),
    postal = tostring(payload.postal or ''),
    distance_meters = tonumber(payload.distance_meters) or 0,
    expires_at_ms = (tonumber(GetGameTimer() or 0) or 0) + expiresInMs,
  }

  notifyClosestCallPrompt(closestCallPromptState)
end)

RegisterCommand('cadbridge_callprompt_accept', function()
  if not isPromptActive() then return end
  sendClosestCallPromptDecision('accept', 'player_accept')
end, false)

RegisterCommand('cadbridge_callprompt_decline', function()
  if not isPromptActive() then return end
  sendClosestCallPromptDecision('decline', 'player_decline')
end, false)

RegisterKeyMapping('cadbridge_callprompt_accept', 'CAD closest call prompt: Attach', 'keyboard', 'Y')
RegisterKeyMapping('cadbridge_callprompt_decline', 'CAD closest call prompt: Decline', 'keyboard', 'N')

CreateThread(function()
  while true do
    if not isPromptActive() then
      Wait(300)
      goto continue
    end

    local state = closestCallPromptState
    local nowMs = tonumber(GetGameTimer() or 0) or 0
    if nowMs >= (tonumber(state.expires_at_ms) or 0) then
      sendClosestCallPromptDecision('decline', 'timeout')
      Wait(100)
      goto continue
    end

    Wait(0)
    if IsPauseMenuActive() then
      goto continue
    end

    local remaining = math.max(0, math.ceil(((tonumber(state.expires_at_ms) or nowMs) - nowMs) / 1000))
    local header, detail = getCallPromptDisplayLabel(state)
    local distance = tonumber(state.distance_meters or 0) or 0
    local distanceLabel = distance > 0 and (' | %.0fm'):format(distance) or ''
    local promptText = ('%s%s\n%s\n~g~Y~s~ Attach  |  ~r~N~s~ Decline  (%ss)'):format(
      header,
      distanceLabel,
      detail,
      tostring(remaining)
    )

    BeginTextCommandDisplayHelp('STRING')
    AddTextComponentSubstringPlayerName(promptText)
    EndTextCommandDisplayHelp(0, false, false, -1)

    if IsControlJustPressed(0, 246) then
      sendClosestCallPromptDecision('accept', 'player_accept_control')
      Wait(150)
    elseif IsControlJustPressed(0, 249) or IsControlJustPressed(0, 306) then
      sendClosestCallPromptDecision('decline', 'player_decline_control')
      Wait(150)
    end

    ::continue::
  end
end)

AddEventHandler('onResourceStop', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  closestCallPromptState = nil
end)
