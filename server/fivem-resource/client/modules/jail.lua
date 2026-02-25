local util = CadBridge and CadBridge.util or {}
local ui = CadBridge and CadBridge.ui or {}
local state = CadBridge and CadBridge.state or {}

local function trim(value)
  if type(util.trim) == 'function' then
    return util.trim(value)
  end
  if value == nil then return '' end
  return (tostring(value):gsub('^%s+', ''):gsub('%s+$', ''))
end

local activeSentence = nil
local jailSpawnEmoteState = {
  mode = '',
  value = '',
}
local JAIL_INTAKE_INITIAL_DEFER_MS = 1750
local JAIL_INTAKE_SPAWN_EVENT_DEFER_MS = 1400
local JAIL_INTAKE_ENFORCE_WINDOW_MS = 30000
local JAIL_INTAKE_RECHECK_INTERVAL_MS = 1000
local JAIL_INTAKE_OUTFIT_REFRESH_MS = 3500
local JAIL_INTAKE_FAR_DISTANCE_METERS = 450.0

local COMPONENT_SLOT_MAP = {
  mask = 1,
  arms = 3,
  pants = 4,
  jacket = 11,
  shirt = 8,
  bodyArmor = 9,
  accessories = 7,
  shoes = 6,
}

local SCENARIO_EMOTE_MAP = {
  pushup = 'WORLD_HUMAN_PUSH_UPS',
  pushups = 'WORLD_HUMAN_PUSH_UPS',
  weights = 'WORLD_HUMAN_MUSCLE_FREE_WEIGHTS',
  weight = 'WORLD_HUMAN_MUSCLE_FREE_WEIGHTS',
  lean = 'WORLD_HUMAN_LEANING',
}

local function nowMs()
  return tonumber(GetGameTimer() or 0) or 0
end

local function distanceSq3(a, b)
  if type(a) ~= 'table' or type(b) ~= 'table' then return nil end
  local ax = tonumber(a.x or a[1]); local ay = tonumber(a.y or a[2]); local az = tonumber(a.z or a[3])
  local bx = tonumber(b.x or b[1]); local by = tonumber(b.y or b[2]); local bz = tonumber(b.z or b[3])
  if not ax or not ay or not az or not bx or not by or not bz then return nil end
  local dx, dy, dz = ax - bx, ay - by, az - bz
  return (dx * dx) + (dy * dy) + (dz * dz)
end

local function getPlayerPedCoords()
  local ped = PlayerPedId()
  if not ped or ped == 0 or not DoesEntityExist(ped) then return nil, nil end
  local ok, coords = pcall(function()
    return GetEntityCoords(ped)
  end)
  if not ok or type(coords) ~= 'vector3' and type(coords) ~= 'table' then
    return ped, nil
  end
  local x = tonumber(coords.x or coords[1])
  local y = tonumber(coords.y or coords[2])
  local z = tonumber(coords.z or coords[3])
  if not x or not y or not z then
    return ped, nil
  end
  return ped, { x = x + 0.0, y = y + 0.0, z = z + 0.0 }
end

local function isLocalPlayerSpawnReady()
  local playerId = PlayerId()
  if not playerId or playerId < 0 then return false end
  if type(NetworkIsPlayerActive) == 'function' and not NetworkIsPlayerActive(playerId) then
    return false
  end
  if type(IsPlayerSwitchInProgress) == 'function' then
    local ok, result = pcall(function()
      return IsPlayerSwitchInProgress()
    end)
    if ok and result == true then
      return false
    end
  end

  local ped, coords = getPlayerPedCoords()
  if not ped or ped == 0 or not coords then return false end
  if type(IsEntityDead) == 'function' and IsEntityDead(ped) then return false end

  -- During some spawn selectors the local ped briefly sits at/near origin before final spawn.
  if math.abs(coords.x) < 2.0 and math.abs(coords.y) < 2.0 and math.abs(coords.z) < 2.0 then
    return false
  end

  return true
end

local function resetSentenceIntakeState(sentence)
  if type(sentence) ~= 'table' then return end
  sentence.intakePending = false
  sentence.intakeApplyAtOrAfterMs = 0
  sentence.intakeRequestedAtMs = 0
  sentence.intakeAppliedAtMs = 0
  sentence.intakeLastCheckAtMs = 0
  sentence.intakeLastOutfitApplyAtMs = 0
  sentence.intakeEnforceUntilMs = 0
  sentence.intakeSource = ''
  sentence.intakeSpawnPoint = nil
end

local function getOrPickSentenceJailSpawn(sentence)
  if type(sentence) ~= 'table' then return nil end
  if type(sentence.intakeSpawnPoint) == 'table' then
    return sentence.intakeSpawnPoint
  end

  local spawns = type(sentence.spawnPoints) == 'table' and sentence.spawnPoints or {}
  if #spawns <= 0 then return nil end
  sentence.intakeSpawnPoint = spawns[math.random(1, #spawns)]
  return sentence.intakeSpawnPoint
end

local function scheduleSentenceIntake(sentence, sourceLabel, deferMs)
  if type(sentence) ~= 'table' then return false end
  if sentence.released == true or sentence.completed == true or sentence.releasing == true then return false end

  getOrPickSentenceJailSpawn(sentence)

  local now = nowMs()
  local delay = math.max(0, math.floor(tonumber(deferMs) or JAIL_INTAKE_INITIAL_DEFER_MS))
  sentence.intakePending = true
  sentence.intakeRequestedAtMs = now
  sentence.intakeApplyAtOrAfterMs = now + delay
  sentence.intakeEnforceUntilMs = math.max(
    tonumber(sentence.intakeEnforceUntilMs or 0) or 0,
    now + JAIL_INTAKE_ENFORCE_WINDOW_MS
  )
  sentence.intakeSource = trim(sourceLabel or '')
  return true
end

local function getDistanceFromSentenceJailArea(sentence)
  if type(sentence) ~= 'table' then return nil end
  local _, coords = getPlayerPedCoords()
  if not coords then return nil end

  local nearestSq = nil
  local spawns = type(sentence.spawnPoints) == 'table' and sentence.spawnPoints or {}
  if #spawns == 0 and type(sentence.intakeSpawnPoint) == 'table' then
    spawns = { sentence.intakeSpawnPoint }
  end

  for _, point in ipairs(spawns) do
    local sq = distanceSq3(coords, point)
    if sq and (not nearestSq or sq < nearestSq) then
      nearestSq = sq
    end
  end

  if not nearestSq then return nil end
  return math.sqrt(nearestSq)
end

local function notifyLocal(title, description, notifyType)
  local payload = {
    title = tostring(title or 'CAD'),
    description = tostring(description or ''),
    type = tostring(notifyType or 'inform'),
  }
  if type(util.triggerCadOxNotify) == 'function' and util.triggerCadOxNotify(payload) then
    return
  end
  print(('[cad_bridge] %s: %s'):format(payload.title, payload.description))
end

local function normalizeVec4Point(value, fallbackLabel)
  if type(value) ~= 'table' then return nil end
  local x = tonumber(value.x or value[1])
  local y = tonumber(value.y or value[2])
  local z = tonumber(value.z or value[3])
  local w = tonumber(value.w or value.h or value.heading or value[4]) or 0.0
  if not x or not y or not z then return nil end
  return {
    x = x + 0.0,
    y = y + 0.0,
    z = z + 0.0,
    w = w + 0.0,
    label = trim(value.label or value.name or fallbackLabel or ''),
    description = trim(value.description or ''),
    emote = trim(value.emote or value.scenario or ''),
  }
end

local function getConfiguredJailSpawnPoints(configuredList)
  local configured = configuredList
  if type(configured) ~= 'table' then
    configured = type(Config) == 'table' and (Config.CadBridgeJailSpawnPoints or Config.Spawns) or {}
  end
  local out = {}
  if type(configured) == 'table' then
    for i, entry in ipairs(configured) do
      local point = normalizeVec4Point(entry, ('Cell Spawn %s'):format(i))
      if point then out[#out + 1] = point end
    end
  end
  return out
end

local function getConfiguredReleasePoints(configuredList)
  local configured = configuredList
  if type(configured) ~= 'table' then
    configured = type(Config) == 'table' and Config.CadBridgeJailReleasePoints or {}
  end
  local out = {}
  if type(configured) == 'table' then
    for i, entry in ipairs(configured) do
      local point = normalizeVec4Point(entry, ('Release Point %s'):format(i))
      if point then
        if point.label == '' then
          point.label = ('Release Point %s'):format(i)
        end
        out[#out + 1] = point
      end
    end
  end
  return out
end

local function ensureScreenFadedOut(timeoutMs)
  local deadline = nowMs() + math.max(0, math.floor(tonumber(timeoutMs) or 0))
  while not IsScreenFadedOut() and nowMs() < deadline do
    Wait(0)
  end
end

local function ensureScreenFadedIn(timeoutMs)
  local deadline = nowMs() + math.max(0, math.floor(tonumber(timeoutMs) or 0))
  while not IsScreenFadedIn() and nowMs() < deadline do
    Wait(0)
  end
end

local function fadeOutToBlack(durationMs)
  local duration = math.max(0, math.floor(tonumber(durationMs) or 250))
  if not IsScreenFadedOut() then
    DoScreenFadeOut(duration)
  end
  ensureScreenFadedOut(math.max(1000, duration + 750))
end

local function fadeInFromBlack(durationMs)
  local duration = math.max(0, math.floor(tonumber(durationMs) or 350))
  DoScreenFadeIn(duration)
  ensureScreenFadedIn(math.max(1000, duration + 750))
end

local function teleportPlayerToVec4(point, options)
  local p = normalizeVec4Point(point)
  if not p then return false end
  local ped = PlayerPedId()
  if not ped or ped == 0 then return false end
  local opts = type(options) == 'table' and options or {}
  local fadeOut = opts.fade ~= false and opts.fadeOut ~= false
  local fadeIn = opts.fade ~= false and opts.fadeIn ~= false

  if fadeOut then fadeOutToBlack(tonumber(opts.fadeOutMs) or 250) end

  RequestCollisionAtCoord(p.x, p.y, p.z)
  pcall(function()
    ClearPedTasksImmediately(ped)
  end)
  pcall(function()
    SetEntityCoordsNoOffset(ped, p.x, p.y, p.z, false, false, false)
  end)
  pcall(function()
    SetEntityHeading(ped, p.w or 0.0)
  end)
  pcall(function()
    FreezeEntityPosition(ped, false)
  end)

  local settleMs = math.max(0, math.floor(tonumber(opts.settleMs) or 150))
  if settleMs > 0 then Wait(settleMs) end
  if fadeIn then fadeInFromBlack(tonumber(opts.fadeInMs) or 350) end
  return true
end

local function stopJailSpawnEmote()
  local ped = PlayerPedId()
  if not ped or ped == 0 then return end

  if jailSpawnEmoteState.mode == 'scully' and GetResourceState('scully_emotemenu') == 'started' then
    pcall(function()
      exports['scully_emotemenu']:cancelEmote()
    end)
  elseif jailSpawnEmoteState.mode == 'scenario' then
    pcall(function()
      ClearPedTasks(ped)
    end)
  end

  jailSpawnEmoteState.mode = ''
  jailSpawnEmoteState.value = ''
end

local function playJailSpawnEmote(emoteName)
  local ped = PlayerPedId()
  local emote = trim(emoteName or '')
  if not ped or ped == 0 or emote == '' then
    jailSpawnEmoteState.mode = ''
    jailSpawnEmoteState.value = ''
    return
  end

  stopJailSpawnEmote()
  pcall(function()
    ClearPedTasksImmediately(ped)
  end)
  Wait(25)

  if GetResourceState('scully_emotemenu') == 'started' then
    local ok = pcall(function()
      exports['scully_emotemenu']:playEmoteByCommand(emote)
    end)
    if ok then
      jailSpawnEmoteState.mode = 'scully'
      jailSpawnEmoteState.value = emote
      return
    end
  end

  local scenario = SCENARIO_EMOTE_MAP[string.lower(emote)] or ''
  if scenario ~= '' then
    pcall(function()
      TaskStartScenarioInPlace(ped, scenario, 0, true)
    end)
    jailSpawnEmoteState.mode = 'scenario'
    jailSpawnEmoteState.value = scenario
    return
  end

  pcall(function()
    ExecuteCommand(('e %s'):format(emote))
  end)
  jailSpawnEmoteState.mode = 'command'
  jailSpawnEmoteState.value = emote
end

local function callConfigJailSound()
  if type(Config) ~= 'table' then return end
  local fn = Config.CadBridgeJailPlaySound
  if type(fn) ~= 'function' and type(Config.playJailSound) == 'function' then
    fn = Config.playJailSound
  end
  if type(fn) ~= 'function' then return end
  pcall(fn)
end

local function callConfigResetClothing()
  if type(Config) ~= 'table' then return end
  local fn = Config.CadBridgeJailResetClothing
  if type(fn) ~= 'function' and type(Config.ResetClothing) == 'function' then
    fn = Config.ResetClothing
  end
  if type(fn) ~= 'function' then return end
  pcall(fn)
end

local function clearAllPedProps(ped)
  if not ped or ped == 0 then return end
  for propIndex = 0, 11 do
    pcall(function()
      ClearPedProp(ped, propIndex)
    end)
  end
end

local function clearPedComponentsForPrisonOutfit(ped)
  if not ped or ped == 0 then return end
  local resetComponents = {
    [1] = { item = 0, texture = 0 },  -- mask
    [3] = { item = 0, texture = 0 },  -- arms
    [4] = { item = 0, texture = 0 },  -- pants
    [5] = { item = 0, texture = 0 },  -- bag/parachute
    [6] = { item = 0, texture = 0 },  -- shoes
    [7] = { item = 0, texture = 0 },  -- accessories
    [8] = { item = 15, texture = 0 }, -- undershirt
    [9] = { item = 0, texture = 0 },  -- armour
    [10] = { item = 0, texture = 0 }, -- decals
    [11] = { item = 0, texture = 0 }, -- jacket/top
  }
  for componentId, outfit in pairs(resetComponents) do
    pcall(function()
      SetPedComponentVariation(ped, componentId, tonumber(outfit.item) or 0, tonumber(outfit.texture) or 0, 0)
    end)
  end
end

local function isFreemodeMalePed(ped)
  if not ped or ped == 0 then return false end
  local model = GetEntityModel(ped)
  return model == GetHashKey('mp_m_freemode_01')
end

local function isFreemodeFemalePed(ped)
  if not ped or ped == 0 then return false end
  local model = GetEntityModel(ped)
  return model == GetHashKey('mp_f_freemode_01')
end

local function applyPrisonOutfitIfEnabled()
  if type(Config) ~= 'table' then return false end
  local outfitsEnabled = Config.CadBridgeEnablePrisonOutfits
  if outfitsEnabled == nil then outfitsEnabled = Config.EnablePrisonOutfits end
  if outfitsEnabled ~= true then return false end

  local ped = PlayerPedId()
  if not ped or ped == 0 then return false end
  if not isFreemodeMalePed(ped) and not isFreemodeFemalePed(ped) then
    -- Freemode-only outfit application; still clear helmet/props to avoid jail entry oddities.
    clearAllPedProps(ped)
    return false
  end

  local outfits = type(Config.CadBridgePrisonOutfits) == 'table' and Config.CadBridgePrisonOutfits
    or (type(Config.PrisonOutfits) == 'table' and Config.PrisonOutfits)
    or (type(Config.PrisonOufits) == 'table' and Config.PrisonOufits)
    or {}
  local outfit = isFreemodeFemalePed(ped) and outfits.female or outfits.male
  if type(outfit) ~= 'table' then
    clearAllPedProps(ped)
    return false
  end

  clearAllPedProps(ped)
  clearPedComponentsForPrisonOutfit(ped)

  for key, componentId in pairs(COMPONENT_SLOT_MAP) do
    local piece = outfit[key]
    if type(piece) == 'table' then
      local item = tonumber(piece.item)
      local texture = tonumber(piece.texture) or 0
      if item then
        pcall(function()
          SetPedComponentVariation(ped, componentId, math.max(0, math.floor(item)), math.max(0, math.floor(texture)), 0)
        end)
      end
    end
  end

  pcall(function()
    ClearPedBloodDamage(ped)
    ResetPedVisibleDamage(ped)
  end)

  return true
end

local function intakeTransitionToSpawn(spawnPoint)
  local point = normalizeVec4Point(spawnPoint)
  if not point then return false end

  fadeOutToBlack(450)
  callConfigJailSound()
  local moved = teleportPlayerToVec4(point, {
    fade = false,
    settleMs = 200,
  })
  if not moved then
    fadeInFromBlack(300)
    return false
  end

  applyPrisonOutfitIfEnabled()
  stopJailSpawnEmote()
  Wait(150)
  fadeInFromBlack(500)
  return true
end

local function tryApplySentenceIntake(sentence, sourceLabel)
  if type(sentence) ~= 'table' then return false end
  if sentence.released == true or sentence.completed == true or sentence.releasing == true then return false end
  if not isLocalPlayerSpawnReady() then return false end

  local point = getOrPickSentenceJailSpawn(sentence)
  if not point then return false end

  local moved = intakeTransitionToSpawn(point)
  if moved ~= true then return false end

  local now = nowMs()
  sentence.intakePending = false
  sentence.intakeAppliedAtMs = now
  sentence.intakeLastCheckAtMs = now
  sentence.intakeLastOutfitApplyAtMs = now
  sentence.intakeEnforceUntilMs = math.max(
    tonumber(sentence.intakeEnforceUntilMs or 0) or 0,
    now + JAIL_INTAKE_ENFORCE_WINDOW_MS
  )
  sentence.intakeSource = trim(sourceLabel or sentence.intakeSource or '')
  return true
end

local function setJailReleaseUiVisible(isVisible, payload)
  local visible = isVisible == true
  state.jailReleaseUiOpen = visible

  if visible then
    state.jailReleaseUiAwaitingOpenAck = true
    state.jailReleaseUiOpenedAtMs = nowMs()
    SetNuiFocus(true, true)
    Wait(10)
    SetNuiFocus(true, true)

    SendNUIMessage({
      action = 'cadBridgeJailRelease:open',
      payload = payload or {},
    })
    Wait(10)
    SendNUIMessage({
      action = 'cadBridgeJailRelease:open',
      payload = payload or {},
    })
  else
    state.jailReleaseUiAwaitingOpenAck = false
    state.jailReleaseUiOpenedAtMs = 0
    if type(ui.refreshCadBridgeNuiFocus) == 'function' then
      ui.refreshCadBridgeNuiFocus()
    else
      SetNuiFocus(false, false)
    end
    SendNUIMessage({
      action = 'cadBridgeJailRelease:close',
      payload = {},
    })
  end
end

local function closeJailReleasePopup()
  if not state.jailReleaseUiOpen then return end
  setJailReleaseUiVisible(false, {})
end
ui.closeJailReleasePopup = closeJailReleasePopup

local function requestInventoryRestoreForActiveSentence()
  if type(activeSentence) ~= 'table' then return end
  TriggerServerEvent('cad_bridge:jailInventoryRestoreRequest', {
    citizen_id = trim(activeSentence.citizenId or ''),
    reason = trim(activeSentence.reason or ''),
    jail_minutes = math.max(0, math.floor(tonumber(activeSentence.minutes or 0) or 0)),
  })
end

local function buildReleaseUiPayload()
  if type(activeSentence) ~= 'table' then return nil end
  local options = {}
  for index, point in ipairs(activeSentence.releasePoints or {}) do
    options[#options + 1] = {
      id = tostring(index),
      index = index,
      label = trim(point.label or ('Release Point ' .. tostring(index))),
      description = trim(point.description or ('X:' .. tostring(math.floor(point.x or 0)) .. ' Y:' .. tostring(math.floor(point.y or 0)))),
    }
  end
  return {
    sentence_minutes = math.max(0, math.floor(tonumber(activeSentence.minutes or 0) or 0)),
    reason = trim(activeSentence.reason or ''),
    options = options,
    default_option_id = options[1] and options[1].id or '',
  }
end

local function openJailReleasePopup()
  if type(activeSentence) ~= 'table' then return end
  if activeSentence.released == true then return end
  local payload = buildReleaseUiPayload()
  if not payload or type(payload.options) ~= 'table' or #payload.options == 0 then
    local first = normalizeVec4Point({ x = 1850.7, y = 2585.69, z = 44.67, w = 270.25, label = 'Bolingbroke Main Gate' })
    if first then
      activeSentence.releasing = true
      activeSentence.releasePending = false
      resetSentenceIntakeState(activeSentence)
      requestInventoryRestoreForActiveSentence()
      local teleported = teleportPlayerToVec4(first)
      activeSentence.releasing = false
      if teleported ~= true then
        notifyLocal('CAD Jail', 'Could not teleport to the default release point.', 'error')
        return
      end
      activeSentence.released = true
      activeSentence.completed = true
      notifyLocal('CAD Jail', 'Sentence served. You have been released.', 'success')
      return
    end
  end

  if type(ui.closeAllModals) == 'function' then
    ui.closeAllModals()
  end

  if not state.jailReleaseUiReady then
    local attempts = 0
    while not state.jailReleaseUiReady and attempts < 20 do
      attempts = attempts + 1
      Wait(50)
    end
  end

  setJailReleaseUiVisible(true, payload or {})
end

local function normalizeSentencePayload(payload)
  local data = type(payload) == 'table' and payload or {}
  local minutes = math.max(0, math.floor(tonumber(data.minutes or data.jail_minutes or 0) or 0))
  local reason = trim(data.reason or '')
  local releasePoints = getConfiguredReleasePoints(data.release_points)
  local spawnPoints = getConfiguredJailSpawnPoints(data.spawn_points)
  if #releasePoints == 0 then releasePoints = getConfiguredReleasePoints() end
  if #spawnPoints == 0 then spawnPoints = getConfiguredJailSpawnPoints() end
  return {
    minutes = minutes,
    reason = reason,
    citizenId = trim(data.citizen_id or data.citizenId or ''),
    releasePoints = releasePoints,
    spawnPoints = spawnPoints,
    startAtMs = nowMs(),
    endAtMs = nowMs() + (minutes * 60 * 1000),
    releasePending = false,
    released = false,
    completed = false,
    releasing = false,
    intakePending = false,
    intakeApplyAtOrAfterMs = 0,
    intakeRequestedAtMs = 0,
    intakeAppliedAtMs = 0,
    intakeLastCheckAtMs = 0,
    intakeLastOutfitApplyAtMs = 0,
    intakeEnforceUntilMs = 0,
    intakeSource = '',
    intakeSpawnPoint = nil,
  }
end

local function startCadJailSentence(payload)
  local sentence = normalizeSentencePayload(payload)
  if sentence.minutes <= 0 then
    return
  end

  activeSentence = sentence
  closeJailReleasePopup()
  stopJailSpawnEmote()
  scheduleSentenceIntake(sentence, 'sentence_start', JAIL_INTAKE_INITIAL_DEFER_MS)

  local message = ('You have been sentenced to %s minute(s).'):format(tostring(sentence.minutes))
  if sentence.reason ~= '' then
    message = message .. (' Reason: %s'):format(sentence.reason)
  end
  notifyLocal('CAD Jail', message, 'error')
end

local function releaseFromJailByIndex(index)
  if type(activeSentence) ~= 'table' then return false end
  local numeric = math.floor(tonumber(index) or 0)
  if numeric < 1 then numeric = 1 end
  local point = activeSentence.releasePoints and activeSentence.releasePoints[numeric] or nil
  if not point then return false end

  activeSentence.releasing = true
  activeSentence.releasePending = false
  resetSentenceIntakeState(activeSentence)
  stopJailSpawnEmote()
  callConfigResetClothing()
  requestInventoryRestoreForActiveSentence()
  local teleported = teleportPlayerToVec4(point)
  if teleported ~= true then
    activeSentence.releasing = false
    notifyLocal('CAD Jail', 'Could not teleport to the selected release point.', 'error')
    return false
  end
  activeSentence.released = true
  activeSentence.completed = true
  activeSentence.releasing = false
  closeJailReleasePopup()
  notifyLocal('CAD Jail', ('Released at %s'):format(trim(point.label or 'release point')), 'success')
  return true
end

RegisterNUICallback('cadBridgeJailReleaseReady', function(_data, cb)
  state.jailReleaseUiReady = true
  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridgeJailReleaseOpened', function(_data, cb)
  state.jailReleaseUiAwaitingOpenAck = false
  state.jailReleaseUiOpenedAtMs = 0
  if cb then cb({ ok = true }) end
end)

RegisterNUICallback('cadBridgeJailReleaseSubmit', function(data, cb)
  local payload = type(data) == 'table' and data or {}
  local selectedIndex = tonumber(payload.selected_release_index or payload.index or payload.selected_index)
  if not selectedIndex then
    selectedIndex = tonumber(payload.selected_release_id)
  end
  local ok = releaseFromJailByIndex(selectedIndex or 1)
  if cb then
    cb(ok and { ok = true } or { ok = false, error = 'invalid_release_point' })
  end
end)

RegisterNUICallback('cadBridgeJailReleaseCancel', function(_data, cb)
  closeJailReleasePopup()
  if cb then cb({ ok = true }) end
end)

RegisterNetEvent('cad_bridge:jailSentenceStart', function(payload)
  startCadJailSentence(payload or {})
end)

AddEventHandler('playerSpawned', function()
  if type(activeSentence) ~= 'table' or activeSentence.released == true or activeSentence.completed == true then return end
  scheduleSentenceIntake(activeSentence, 'playerSpawned', JAIL_INTAKE_SPAWN_EVENT_DEFER_MS)
end)

RegisterNetEvent('QBCore:Client:OnPlayerLoaded', function()
  if type(activeSentence) ~= 'table' or activeSentence.released == true or activeSentence.completed == true then return end
  scheduleSentenceIntake(activeSentence, 'QBCore:Client:OnPlayerLoaded', JAIL_INTAKE_SPAWN_EVENT_DEFER_MS)
end)

RegisterNetEvent('qbx_core:client:onPlayerLoaded', function()
  if type(activeSentence) ~= 'table' or activeSentence.released == true or activeSentence.completed == true then return end
  scheduleSentenceIntake(activeSentence, 'qbx_core:client:onPlayerLoaded', JAIL_INTAKE_SPAWN_EVENT_DEFER_MS)
end)

RegisterNetEvent('qbx_core:client:playerLoaded', function()
  if type(activeSentence) ~= 'table' or activeSentence.released == true or activeSentence.completed == true then return end
  scheduleSentenceIntake(activeSentence, 'qbx_core:client:playerLoaded', JAIL_INTAKE_SPAWN_EVENT_DEFER_MS)
end)

CreateThread(function()
  while true do
    local sentence = activeSentence
    if type(sentence) == 'table' and sentence.released ~= true and sentence.completed ~= true and sentence.releasing ~= true then
      local now = nowMs()
      local waitMs = 350

      if sentence.intakePending == true then
        local applyAt = tonumber(sentence.intakeApplyAtOrAfterMs or 0) or 0
        if now >= applyAt then
          if tryApplySentenceIntake(sentence, 'pending_sync') then
            waitMs = 150
          else
            waitMs = 250
          end
        else
          waitMs = math.max(100, math.min(400, applyAt - now))
        end
      elseif (tonumber(sentence.intakeEnforceUntilMs or 0) or 0) > now then
        if isLocalPlayerSpawnReady() then
          local lastCheckAt = tonumber(sentence.intakeLastCheckAtMs or 0) or 0
          if (now - lastCheckAt) >= JAIL_INTAKE_RECHECK_INTERVAL_MS then
            sentence.intakeLastCheckAtMs = now
            local dist = getDistanceFromSentenceJailArea(sentence)
            if dist and dist > JAIL_INTAKE_FAR_DISTANCE_METERS then
              scheduleSentenceIntake(sentence, 'out_of_jail_after_spawn', 250)
              waitMs = 150
            else
              local lastOutfitAt = tonumber(sentence.intakeLastOutfitApplyAtMs or 0) or 0
              if (now - lastOutfitAt) >= JAIL_INTAKE_OUTFIT_REFRESH_MS then
                applyPrisonOutfitIfEnabled()
                sentence.intakeLastOutfitApplyAtMs = now
              end
            end
          end
        else
          waitMs = 250
        end
      else
        waitMs = 750
      end

      Wait(waitMs)
    else
      Wait(1000)
    end
  end
end)

CreateThread(function()
  while true do
    if type(activeSentence) == 'table' and activeSentence.released ~= true and activeSentence.releasing ~= true then
      local now = nowMs()
      if activeSentence.releasePending ~= true and now >= tonumber(activeSentence.endAtMs or 0) then
        activeSentence.releasePending = true
        notifyLocal('CAD Jail', 'You have served your sentence. Select a release point.', 'success')
      end

      if activeSentence.releasePending == true and not state.jailReleaseUiOpen then
        openJailReleasePopup()
      end
      Wait(500)
    else
      Wait(1000)
    end
  end
end)

CreateThread(function()
  while true do
    if state.jailReleaseUiAwaitingOpenAck and (tonumber(state.jailReleaseUiOpenedAtMs or 0) > 0) then
      local elapsed = nowMs() - tonumber(state.jailReleaseUiOpenedAtMs or 0)
      if elapsed > 2500 then
        closeJailReleasePopup()
        notifyLocal('CAD Jail', 'Release UI failed to initialize. Re-opening...', 'warning')
        if type(activeSentence) == 'table' and activeSentence.releasePending == true and activeSentence.released ~= true then
          Wait(150)
          openJailReleasePopup()
        end
      end
      Wait(250)
    else
      Wait(500)
    end
  end
end)
