local miniCadVisible = false
local miniCadUserHidden = false  -- true when user manually hid with PageUp
local miniCadData = nil
local miniCadClosestPrompt = nil
local miniCadLastCallId = 0
local miniCadPollIntervalMs = 3000
local miniCadToggleCommand = 'cadbridge_minicad_toggle'
local miniCadDetachCommand = 'cadbridge_minicad_detach'
local miniCadClosestAcceptCommand = 'cadbridge_minicad_closest_accept'
local miniCadClosestDeclineCommand = 'cadbridge_minicad_closest_decline'

local function trim(value)
  if value == nil then return '' end
  return (tostring(value):gsub('^%s+', ''):gsub('%s+$', ''))
end

local function hasActiveMiniCadCall(data)
  if type(data) ~= 'table' then return false end
  return (tonumber(data.call_id) or 0) > 0
end

local function sendMiniCadNui(action, payload)
  SendNUIMessage({
    action = action,
    payload = payload or {},
  })
end

local function clearClosestPromptNui()
  sendMiniCadNui('cadBridgeMiniCad:closestPromptClear', nil)
end

local function pushClosestPromptToNui()
  if type(miniCadClosestPrompt) ~= 'table' then
    clearClosestPromptNui()
    return
  end

  local nowMs = tonumber(GetGameTimer() or 0) or 0
  local expiresAtMs = tonumber(miniCadClosestPrompt.expires_at_ms) or nowMs
  local expiresInMs = math.max(0, expiresAtMs - nowMs)

  sendMiniCadNui('cadBridgeMiniCad:closestPrompt', {
    id = tostring(miniCadClosestPrompt.id or ''),
    call_id = tonumber(miniCadClosestPrompt.call_id) or 0,
    title = tostring(miniCadClosestPrompt.title or ''),
    priority = tostring(miniCadClosestPrompt.priority or ''),
    location = tostring(miniCadClosestPrompt.location or ''),
    postal = tostring(miniCadClosestPrompt.postal or ''),
    distance_meters = tonumber(miniCadClosestPrompt.distance_meters) or 0,
    department_name = tostring(miniCadClosestPrompt.department_name or ''),
    department_short_name = tostring(miniCadClosestPrompt.department_short_name or ''),
    expires_in_ms = expiresInMs,
  })
end

local function showMiniCad()
  if not hasActiveMiniCadCall(miniCadData) and type(miniCadClosestPrompt) ~= 'table' then return end
  miniCadVisible = true
  sendMiniCadNui('cadBridgeMiniCad:show', nil)
end

local function hideMiniCad()
  miniCadVisible = false
  sendMiniCadNui('cadBridgeMiniCad:hide', nil)
end

local function updateMiniCad(data)
  miniCadData = data
  sendMiniCadNui('cadBridgeMiniCad:update', data)

  if hasActiveMiniCadCall(data) then
    local newCallId = tonumber(data.call_id) or 0
    -- Auto-show when a new call is assigned (different call_id than before).
    if newCallId ~= miniCadLastCallId then
      miniCadLastCallId = newCallId
      miniCadUserHidden = false
      showMiniCad()
    elseif not miniCadUserHidden then
      showMiniCad()
    end
  else
    miniCadLastCallId = 0
    if type(miniCadClosestPrompt) ~= 'table' then
      miniCadVisible = false
      miniCadUserHidden = false
      hideMiniCad()
    end
  end
end

local function toggleMiniCad()
  if type(miniCadClosestPrompt) == 'table' then
    -- Closest-call prompts must stay visible until accepted/declined.
    return
  end

  if miniCadVisible then
    miniCadUserHidden = true
    hideMiniCad()
  else
    if hasActiveMiniCadCall(miniCadData) then
      miniCadUserHidden = false
      showMiniCad()
    end
  end
end

local function detachCurrentMiniCadCall()
  if type(miniCadClosestPrompt) == 'table' then return false end
  local callId = tonumber(miniCadData and miniCadData.call_id or 0) or 0
  if callId <= 0 then return false end
  TriggerServerEvent('cad_bridge:miniCadDetach', callId)
  return true
end

local function submitClosestCallPromptDecision(action, reason)
  local state = miniCadClosestPrompt
  if type(state) ~= 'table' then return false end

  local normalizedAction = trim(action):lower()
  if normalizedAction ~= 'accept' and normalizedAction ~= 'decline' then
    normalizedAction = 'decline'
  end

  miniCadClosestPrompt = nil
  clearClosestPromptNui()
  TriggerServerEvent('cad_bridge:closestCallPromptDecision', {
    id = tostring(state.id or ''),
    call_id = tonumber(state.call_id) or 0,
    action = normalizedAction,
    reason = tostring(reason or ''),
  })

  if hasActiveMiniCadCall(miniCadData) and not miniCadUserHidden then
    showMiniCad()
  elseif not hasActiveMiniCadCall(miniCadData) then
    hideMiniCad()
  end

  return true
end

-- NUI callback: user clicked hide button.
RegisterNUICallback('cadBridgeMiniCadHidden', function(_data, cb)
  if type(miniCadClosestPrompt) == 'table' then
    showMiniCad()
    if cb then cb({ ok = false, blocked = true }) end
    return
  end

  miniCadVisible = false
  miniCadUserHidden = true
  if cb then cb({ ok = true }) end
end)

-- NUI callback: user clicked detach from call.
RegisterNUICallback('cadBridgeMiniCadDetach', function(data, cb)
  local callId = tonumber(data and data.call_id or 0) or 0
  if callId > 0 then
    TriggerServerEvent('cad_bridge:miniCadDetach', callId)
  end
  if cb then cb({ ok = true }) end
end)

-- NUI callback: closest-call prompt decision.
RegisterNUICallback('cadBridgeMiniCadClosestDecision', function(data, cb)
  local state = miniCadClosestPrompt
  if type(state) ~= 'table' then
    if cb then cb({ ok = false, error = 'no_active_prompt' }) end
    return
  end

  local payload = type(data) == 'table' and data or {}
  local promptId = trim(payload.id or payload.prompt_id or '')
  local expectedId = trim(state.id or '')
  if promptId ~= '' and expectedId ~= '' and promptId ~= expectedId then
    if cb then cb({ ok = false, error = 'stale_prompt' }) end
    return
  end

  local action = trim(payload.action or payload.decision or ''):lower()
  local reason = trim(payload.reason or '')
  if reason == '' then
    reason = action == 'accept' and 'player_accept_ui' or 'player_decline_ui'
  end

  submitClosestCallPromptDecision(action, reason)
  if cb then cb({ ok = true }) end
end)

-- Closest call prompt from server (Mini-CAD only; no ox_lib/top-left notifications).
RegisterNetEvent('cad_bridge:showClosestCallPrompt', function(payload)
  if type(payload) ~= 'table' then return end

  local promptId = trim(payload.id or payload.prompt_id or '')
  local callId = tonumber(payload.call_id) or 0
  if promptId == '' or callId <= 0 then return end

  local expiresInMs = math.max(6000, tonumber(payload.expires_in_ms) or 15000)
  miniCadClosestPrompt = {
    id = promptId,
    call_id = callId,
    title = tostring(payload.title or payload.call_title or ''),
    priority = tostring(payload.priority or ''),
    location = tostring(payload.location or ''),
    postal = tostring(payload.postal or ''),
    distance_meters = tonumber(payload.distance_meters) or 0,
    department_name = tostring(payload.department_name or ''),
    department_short_name = tostring(payload.department_short_name or ''),
    expires_at_ms = (tonumber(GetGameTimer() or 0) or 0) + expiresInMs,
  }

  miniCadUserHidden = false
  pushClosestPromptToNui()
  showMiniCad()
end)

-- Receive active call data from server.
RegisterNetEvent('cad_bridge:miniCadUpdate', function(payload)
  if type(payload) ~= 'table' then
    updateMiniCad(nil)
    return
  end
  updateMiniCad(payload)
end)

-- Toggle command bound to PageUp.
RegisterCommand(miniCadToggleCommand, function()
  toggleMiniCad()
end, false)

RegisterKeyMapping(miniCadToggleCommand, 'Toggle Mini-CAD call popup', 'keyboard', 'PAGEUP')

RegisterCommand(miniCadDetachCommand, function()
  detachCurrentMiniCadCall()
end, false)

RegisterKeyMapping(miniCadDetachCommand, 'Mini-CAD: Detach from current call', 'keyboard', 'END')

RegisterCommand(miniCadClosestAcceptCommand, function()
  if type(miniCadClosestPrompt) ~= 'table' then return end
  submitClosestCallPromptDecision('accept', 'player_accept_keybind')
end, false)

RegisterKeyMapping(miniCadClosestAcceptCommand, 'Mini-CAD closest prompt: Attach', 'keyboard', 'Y')

RegisterCommand(miniCadClosestDeclineCommand, function()
  if type(miniCadClosestPrompt) ~= 'table' then return end
  submitClosestCallPromptDecision('decline', 'player_decline_keybind')
end, false)

RegisterKeyMapping(miniCadClosestDeclineCommand, 'Mini-CAD closest prompt: Decline', 'keyboard', 'N')

-- Backward-compatible aliases for existing keybinds from earlier closest-prompt module.
RegisterCommand('cadbridge_callprompt_accept', function()
  if type(miniCadClosestPrompt) ~= 'table' then return end
  submitClosestCallPromptDecision('accept', 'player_accept_legacy_keybind')
end, false)

RegisterCommand('cadbridge_callprompt_decline', function()
  if type(miniCadClosestPrompt) ~= 'table' then return end
  submitClosestCallPromptDecision('decline', 'player_decline_legacy_keybind')
end, false)

-- Polling loop: periodically ask server for active call data.
CreateThread(function()
  while true do
    Wait(miniCadPollIntervalMs)

    -- Only poll if the player is loaded and alive.
    local ped = PlayerPedId()
    if not ped or ped == 0 then
      goto continue
    end

    TriggerServerEvent('cad_bridge:requestMiniCadData')

    ::continue::
  end
end)

-- Auto-decline closest prompt when it expires.
CreateThread(function()
  while true do
    if type(miniCadClosestPrompt) ~= 'table' then
      Wait(300)
      goto continue
    end

    local nowMs = tonumber(GetGameTimer() or 0) or 0
    if nowMs >= (tonumber(miniCadClosestPrompt.expires_at_ms) or 0) then
      submitClosestCallPromptDecision('decline', 'timeout')
      Wait(100)
      goto continue
    end

    Wait(0)
    if IsPauseMenuActive() then
      goto continue
    end

    -- Keep control-based fallback active for servers that don't keep key mappings.
    if IsControlJustPressed(0, 246) then
      submitClosestCallPromptDecision('accept', 'player_accept_control')
      Wait(150)
      goto continue
    end
    if IsControlJustPressed(0, 249) or IsControlJustPressed(0, 306) then
      submitClosestCallPromptDecision('decline', 'player_decline_control')
      Wait(150)
      goto continue
    end

    ::continue::
  end
end)

-- Clean up on resource stop.
AddEventHandler('onResourceStop', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  miniCadVisible = false
  miniCadData = nil
  miniCadClosestPrompt = nil
end)
