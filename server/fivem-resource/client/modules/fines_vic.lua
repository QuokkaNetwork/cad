local util = CadBridge and CadBridge.util or {}

local function trim(value)
  if type(util.trim) == 'function' then
    return util.trim(value)
  end
  if value == nil then return '' end
  return (tostring(value):gsub('^%s+', ''):gsub('%s+$', ''))
end

local finesVicPendingRequestsById = {}
local finesVicRequestSeq = 0

local function nextFinesVicRequestId(prefix)
  finesVicRequestSeq = (tonumber(finesVicRequestSeq) or 0) + 1
  if finesVicRequestSeq > 999999 then finesVicRequestSeq = 1 end
  return ('%s:%s:%s'):format(
    trim(prefix ~= '' and prefix or 'fines_vic'),
    tostring(GetGameTimer() or 0),
    tostring(finesVicRequestSeq)
  )
end

local function awaitFinesVicBridgeReply(serverEventName, clientReplyEventName, payload, timeoutMs)
  local requestId = nextFinesVicRequestId(serverEventName or 'fines_vic')
  local pending = { done = false, response = nil }
  finesVicPendingRequestsById[requestId] = pending

  local nextPayload = type(payload) == 'table' and payload or {}
  nextPayload.request_id = requestId
  TriggerServerEvent(serverEventName, nextPayload)

  local deadline = (tonumber(GetGameTimer() or 0) or 0) + math.max(3000, tonumber(timeoutMs) or 15000)
  while pending.done ~= true and (tonumber(GetGameTimer() or 0) or 0) < deadline do
    Wait(0)
  end

  finesVicPendingRequestsById[requestId] = nil

  if pending.done ~= true then
    return {
      ok = false,
      error = 'timeout',
      message = 'Fines Victoria request timed out. Please try again.',
      request_id = requestId,
      event = clientReplyEventName,
    }
  end

  if type(pending.response) ~= 'table' then
    return {
      ok = false,
      error = 'invalid_response',
      message = 'Fines Victoria returned an invalid response.',
      request_id = requestId,
      event = clientReplyEventName,
    }
  end

  return pending.response
end

RegisterNetEvent('cad_bridge:finesVicListResult', function(payload)
  local data = type(payload) == 'table' and payload or {}
  local requestId = trim(data.request_id or '')
  if requestId == '' then return end
  local pending = finesVicPendingRequestsById[requestId]
  if not pending then return end
  pending.response = data
  pending.done = true
end)

RegisterNetEvent('cad_bridge:finesVicPayResult', function(payload)
  local data = type(payload) == 'table' and payload or {}
  local requestId = trim(data.request_id or '')
  if requestId == '' then return end
  local pending = finesVicPendingRequestsById[requestId]
  if not pending then return end
  pending.response = data
  pending.done = true
end)

RegisterNUICallback('cadBridgeNpwdFinesVicList', function(_data, cb)
  local result = awaitFinesVicBridgeReply(
    'cad_bridge:finesVicListRequest',
    'cad_bridge:finesVicListResult',
    {},
    15000
  )
  if cb then cb(result) end
end)

RegisterNUICallback('cadBridgeNpwdFinesVicPay', function(data, cb)
  local noticeId = tonumber(data and (data.notice_id or data.id) or 0)
  if not noticeId or noticeId <= 0 then
    if cb then
      cb({
        ok = false,
        error = 'invalid_notice_id',
        message = 'Invalid infringement notice selected.',
      })
    end
    return
  end

  local result = awaitFinesVicBridgeReply(
    'cad_bridge:finesVicPayRequest',
    'cad_bridge:finesVicPayResult',
    { notice_id = math.floor(noticeId) },
    20000
  )
  if cb then cb(result) end
end)
