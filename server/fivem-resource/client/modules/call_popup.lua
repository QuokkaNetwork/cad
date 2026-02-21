local miniCadVisible = false
local miniCadUserHidden = false  -- true when user manually hid with PageUp
local miniCadData = nil
local miniCadLastCallId = 0
local miniCadPollIntervalMs = 3000
local miniCadToggleCommand = 'cadbridge_minicad_toggle'

local function sendMiniCadNui(action, payload)
  SendNUIMessage({
    action = action,
    payload = payload or {},
  })
end

local function showMiniCad()
  if not miniCadData then return end
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

  if data and data.call_id then
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
    miniCadVisible = false
    miniCadUserHidden = false
  end
end

local function toggleMiniCad()
  if miniCadVisible then
    miniCadUserHidden = true
    hideMiniCad()
  else
    if miniCadData and miniCadData.call_id then
      miniCadUserHidden = false
      showMiniCad()
    end
  end
end

-- NUI callback: user clicked hide button.
RegisterNUICallback('cadBridgeMiniCadHidden', function(_data, cb)
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

-- Clean up on resource stop.
AddEventHandler('onResourceStop', function(resourceName)
  if resourceName ~= GetCurrentResourceName() then return end
  miniCadVisible = false
  miniCadData = nil
end)
