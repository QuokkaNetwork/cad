-- FiveM Radio Channel Sync for CAD
-- This script syncs your pma-voice/mm-radio channel names to the CAD
-- Place this in your cad-bridge resource or create a standalone resource

-- Configuration
local CAD_URL = "http://103.203.241.35:3030" -- Your CAD server URL
local BRIDGE_TOKEN = "Ku3xaT6MVe+GgGC9qQu2bMbdqBEPY7cXCyRd3WISCjA=" -- Matches .env FIVEM_BRIDGE_SHARED_TOKEN

-- Define your radio channels that match your pma-voice/mm-radio config
-- These should match exactly what players see in-game
local RADIO_CHANNELS = {
    -- Channel ID, Name, Description (optional)
    {id = 1, name = "Police Primary", description = "Main police channel"},
    {id = 2, name = "Police Backup", description = "Police backup communications"},
    {id = 3, name = "Police Traffic", description = "Traffic unit coordination"},
    {id = 4, name = "EMS Primary", description = "Main EMS/Ambulance channel"},
    {id = 5, name = "Fire Primary", description = "Main fire department channel"},
    {id = 6, name = "DOT/Tow", description = "Department of Transport and towing"},
    {id = 7, name = "Dispatch Coordination", description = "Cross-agency dispatch"},
    -- Add more channels as needed
}

-- Sync channels to CAD
local function SyncChannelsToCad()
    print("[CAD Radio Sync] Syncing " .. #RADIO_CHANNELS .. " radio channels to CAD...")

    local payload = json.encode({
        channels = RADIO_CHANNELS
    })

    PerformHttpRequest(CAD_URL .. "/api/fivem/radio-channels/sync", function(statusCode, response, headers)
        if statusCode == 200 then
            local data = json.decode(response)
            print(string.format("[CAD Radio Sync] Success! Synced %d channels (%d created, %d updated)",
                data.synced or 0, data.created or 0, data.updated or 0))
        else
            print("[CAD Radio Sync] Failed with status " .. statusCode .. ": " .. (response or "No response"))
        end
    end, "POST", payload, {
        ["Content-Type"] = "application/json",
        ["Authorization"] = "Bearer " .. BRIDGE_TOKEN
    })
end

-- Auto-sync on resource start
CreateThread(function()
    Wait(5000) -- Wait 5 seconds after server start
    SyncChannelsToCad()
end)

-- Command to manually sync channels (admin only)
RegisterCommand("synccadradio", function(source, args, rawCommand)
    if source == 0 then -- Console only for security
        SyncChannelsToCad()
    else
        print("[CAD Radio Sync] This command can only be run from the server console")
    end
end, false)

-- Optional: Auto-sync every 30 minutes to keep names updated
CreateThread(function()
    while true do
        Wait(30 * 60 * 1000) -- 30 minutes
        SyncChannelsToCad()
    end
end)

print("^2[CAD Radio Sync] Loaded - Radio channels will sync to CAD^0")
