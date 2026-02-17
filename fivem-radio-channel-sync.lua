-- FiveM Radio Channel Sync for CAD
-- Syncs your pma-voice / mm-radio channel names to the CAD.
--
-- USAGE:
--   Option A (recommended): cad_bridge already auto-syncs mm_radio channels
--     on startup when mm_radio is running.  You only need this script if you
--     want to override or add extra channel names.
--
--   Option B: Create a standalone resource with this as the only server script.
--     Add `server_script 'fivem-radio-channel-sync.lua'` to fxmanifest.lua.
--
-- AUTH: Token is read from the cad_bridge_token convar (set in voice.cfg).
--   You can also hardcode BRIDGE_TOKEN below.

local function trim(s)
  return (tostring(s or '')):gsub('^%s+', ''):gsub('%s+$', '')
end

local CAD_URL      = trim(GetConvar('cad_bridge_base_url', 'http://127.0.0.1:3031'))
local BRIDGE_TOKEN = trim(GetConvar('cad_bridge_token', ''))

-- ── Channel definitions ──────────────────────────────────────────────────────
-- Edit these to match your mm_radio Shared.RadioNames / pma-voice channel config.
-- The `id` must be the integer channel number used in-game
-- (in mm_radio, channel 1 = frequency 1.0, channel 420 = frequency 420.0, etc.)
local RADIO_CHANNELS = {
    {id = 1,   name = "MRPD CH#1",   description = "Police primary"},
    {id = 2,   name = "MRPD CH#2",   description = "Police secondary"},
    {id = 3,   name = "MRPD CH#3",   description = "Police traffic"},
    {id = 4,   name = "MRPD CH#4",   description = "Police command"},
    {id = 5,   name = "MRPD CH#5",   description = "Police ops"},
    {id = 6,   name = "MRPD CH#6",   description = "Police channel 6"},
    {id = 7,   name = "MRPD CH#7",   description = "Police channel 7"},
    {id = 8,   name = "MRPD CH#8",   description = "EMS primary"},
    {id = 9,   name = "MRPD CH#9",   description = "EMS secondary"},
    {id = 10,  name = "MRPD CH#10",  description = "Dispatch"},
    {id = 420, name = "Ballas CH#1", description = "Ballas gang channel"},
    {id = 421, name = "LostMC CH#1", description = "Lost MC channel"},
    {id = 422, name = "Vagos CH#1",  description = "Vagos channel"},
    -- Add more channels here as needed
}
-- ─────────────────────────────────────────────────────────────────────────────

local function SyncChannelsToCad()
    if trim(CAD_URL) == '' or trim(BRIDGE_TOKEN) == '' then
        print('[CAD Radio Sync] cad_bridge_base_url or cad_bridge_token not set — skipping sync.')
        return
    end

    print('[CAD Radio Sync] Syncing ' .. #RADIO_CHANNELS .. ' radio channels to CAD...')

    local payload = json.encode({ channels = RADIO_CHANNELS })

    PerformHttpRequest(
        CAD_URL .. '/api/integration/fivem/radio-channels/sync',
        function(statusCode, response, headers)
            if statusCode == 200 then
                local ok, data = pcall(json.decode, response)
                if ok and data then
                    print(string.format('[CAD Radio Sync] Success! Synced %d channels (%d created, %d updated)',
                        data.synced or 0, data.created or 0, data.updated or 0))
                end
            else
                print('[CAD Radio Sync] Failed — status ' .. statusCode .. ': ' .. (response or 'no response'))
            end
        end,
        'POST', payload,
        {
            ['Content-Type']       = 'application/json',
            ['x-cad-bridge-token'] = BRIDGE_TOKEN,
        }
    )
end

-- Auto-sync on resource start (after a short delay)
CreateThread(function()
    Wait(6000)
    SyncChannelsToCad()
end)

-- Manual sync command (server console only)
RegisterCommand('synccadradio', function(source)
    if source == 0 then
        SyncChannelsToCad()
    else
        print('[CAD Radio Sync] This command can only be run from the server console.')
    end
end, false)

-- Periodic re-sync every 30 minutes
CreateThread(function()
    while true do
        Wait(30 * 60 * 1000)
        SyncChannelsToCad()
    end
end)

print('^2[CAD Radio Sync] Loaded — radio channels will sync to CAD^0')
