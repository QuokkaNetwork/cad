-- FiveM Radio Channel Sync for CAD (Enhanced with Mumble Detection)
-- This script syncs your pma-voice/mm-radio channel names to the CAD
-- AND detects your Mumble server configuration automatically

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

-- Auto-detect Mumble server configuration
local function DetectMumbleConfig()
    -- Get the server's external IP from convars
    local serverEndpoint = GetConvar("sv_listingIpOverride", GetConvar("sv_endpoints", "unknown"))
    local serverIp = "103.203.241.35" -- Fallback to known IP

    -- Try to parse IP from endpoint
    if serverEndpoint and serverEndpoint ~= "unknown" then
        local ip = string.match(serverEndpoint, "([%d%.]+)")
        if ip then
            serverIp = ip
        end
    end

    local config = {
        host = serverIp, -- Use server's external IP
        port = nil,
        detected = false,
        voiceSystem = "unknown",
        externalAccessible = false
    }

    -- Try to detect pma-voice configuration
    local success, pmaConfig = pcall(function()
        return exports['pma-voice']:getConfig()
    end)

    if success and pmaConfig then
        config.voiceSystem = "pma-voice"

        -- Check if using Mumble mode
        if pmaConfig.voiceMode and pmaConfig.voiceMode == 0 then
            -- Mode 0 = Mumble
            config.detected = true

            -- Try to get Mumble port from different possible config locations
            if pmaConfig.mumblePort then
                config.port = pmaConfig.mumblePort
            elseif pmaConfig.voiceServerPort then
                config.port = pmaConfig.voiceServerPort
            else
                -- Default Mumble ports to try
                config.port = 64738 -- Standard Mumble port
            end

            -- Check if Mumble is configured for external access
            -- By default, pma-voice Mumble only listens on 127.0.0.1
            config.externalAccessible = false -- Assume not accessible

            print(string.format("^2[CAD Mumble Detect] pma-voice Mumble mode detected on port %d^0", config.port))
            print("^3[CAD Mumble Detect] WARNING: pma-voice Mumble usually only listens on 127.0.0.1 (localhost)^0")
            print("^3[CAD Mumble Detect] For external CAD connection, you may need to configure Mumble to bind to 0.0.0.0^0")
        else
            print("^3[CAD Mumble Detect] pma-voice detected but using WebRTC mode (voice bridge not compatible)^0")
            print("^3[CAD Mumble Detect] Voice bridge requires Mumble mode. Set voiceMode = 0 in pma-voice config^0")
            config.voiceSystem = "pma-voice (WebRTC)"
        end
    end

    -- Try to detect mumble-voip (legacy)
    if not config.detected then
        success, _ = pcall(function()
            return exports['mumble-voip']
        end)

        if success then
            config.voiceSystem = "mumble-voip"
            config.detected = true
            config.port = 64738 -- Standard port for mumble-voip
            print("^2[CAD Mumble Detect] mumble-voip detected, using port 64738^0")
        end
    end

    -- Try to detect tokovoip (very legacy)
    if not config.detected then
        success, _ = pcall(function()
            return exports['tokovoip_script']
        end)

        if success then
            config.voiceSystem = "tokovoip"
            config.detected = true
            config.port = 64738
            print("^2[CAD Mumble Detect] TokoVoip detected, using port 64738^0")
        end
    end

    -- Fallback: Try common Mumble ports
    if not config.detected then
        print("^3[CAD Mumble Detect] No voice system detected, will try common Mumble ports^0")
        -- We'll try multiple ports when syncing
        config.port = 64738 -- Start with standard port
    end

    return config
end

-- Sync Mumble configuration to CAD
local function SyncMumbleConfigToCad(mumbleConfig)
    if not mumbleConfig.port then
        print("^1[CAD Mumble Sync] No Mumble port detected, skipping Mumble config sync^0")
        return
    end

    print(string.format("[CAD Mumble Sync] Syncing Mumble config: %s:%d (%s)",
        mumbleConfig.host, mumbleConfig.port, mumbleConfig.voiceSystem))

    if not mumbleConfig.externalAccessible and mumbleConfig.voiceSystem == "pma-voice" then
        print("^1[CAD Mumble Sync] WARNING: Mumble server may not be accessible from external CAD!^0")
        print("^1[CAD Mumble Sync] Check FiveM console for configuration instructions.^0")
    end

    local payload = json.encode({
        mumble_host = mumbleConfig.host,
        mumble_port = mumbleConfig.port,
        voice_system = mumbleConfig.voiceSystem,
        detected = mumbleConfig.detected,
        external_accessible = mumbleConfig.externalAccessible
    })

    PerformHttpRequest(CAD_URL .. "/api/integration/fivem/mumble-config/sync", function(statusCode, response, headers)
        if statusCode == 200 then
            print("^2[CAD Mumble Sync] Successfully synced Mumble config to CAD^0")
        elseif statusCode == 404 then
            print("^3[CAD Mumble Sync] Endpoint not found (update CAD server to support auto-config)^0")
        else
            print("^1[CAD Mumble Sync] Failed with status " .. statusCode .. ": " .. (response or "No response") .. "^0")
        end
    end, "POST", payload, {
        ["Content-Type"] = "application/json",
        ["x-cad-bridge-token"] = BRIDGE_TOKEN
    })
end

-- Sync radio channels to CAD
local function SyncChannelsToCad()
    print("[CAD Radio Sync] Syncing " .. #RADIO_CHANNELS .. " radio channels to CAD...")

    local payload = json.encode({
        channels = RADIO_CHANNELS
    })

    PerformHttpRequest(CAD_URL .. "/api/integration/fivem/radio-channels/sync", function(statusCode, response, headers)
        if statusCode == 200 then
            local data = json.decode(response)
            print(string.format("^2[CAD Radio Sync] Success! Synced %d channels (%d created, %d updated)^0",
                data.synced or 0, data.created or 0, data.updated or 0))
        else
            print("^1[CAD Radio Sync] Failed with status " .. statusCode .. ": " .. (response or "No response") .. "^0")
        end
    end, "POST", payload, {
        ["Content-Type"] = "application/json",
        ["x-cad-bridge-token"] = BRIDGE_TOKEN
    })
end

-- Initialize on resource start
CreateThread(function()
    Wait(5000) -- Wait 5 seconds after server start

    -- Detect Mumble configuration
    local mumbleConfig = DetectMumbleConfig()

    print("^5========================================^0")
    print("^5[CAD Bridge Sync] Starting...^0")
    print(string.format("^5Voice System: %s^0", mumbleConfig.voiceSystem))
    if mumbleConfig.detected then
        print(string.format("^2Mumble Server: %s:%d^0", mumbleConfig.host, mumbleConfig.port))
    else
        print("^3Mumble Server: Not detected (voice bridge may not work)^0")
    end
    print("^5========================================^0")

    -- Sync Mumble config to CAD
    SyncMumbleConfigToCad(mumbleConfig)

    -- Wait a moment, then sync radio channels
    Wait(2000)
    SyncChannelsToCad()
end)

-- Command to manually sync everything (admin/console only)
RegisterCommand("synccad", function(source, args, rawCommand)
    if source == 0 then -- Console only for security
        print("^5[CAD Sync] Manual sync triggered^0")
        local mumbleConfig = DetectMumbleConfig()
        SyncMumbleConfigToCad(mumbleConfig)
        Wait(1000)
        SyncChannelsToCad()
    else
        print("^1[CAD Sync] This command can only be run from the server console^0")
    end
end, false)

-- Command to check current Mumble detection
RegisterCommand("checkmumble", function(source, args, rawCommand)
    if source == 0 then
        local mumbleConfig = DetectMumbleConfig()
        print("^5========================================^0")
        print("^5[Mumble Detection Results]^0")
        print(string.format("Voice System: %s", mumbleConfig.voiceSystem))
        print(string.format("Detected: %s", mumbleConfig.detected and "Yes" or "No"))
        print(string.format("Host: %s", mumbleConfig.host))
        print(string.format("Port: %s", mumbleConfig.port or "Not detected"))
        print("^5========================================^0")
    end
end, false)

-- Optional: Auto-sync every 30 minutes
CreateThread(function()
    while true do
        Wait(30 * 60 * 1000) -- 30 minutes
        local mumbleConfig = DetectMumbleConfig()
        SyncMumbleConfigToCad(mumbleConfig)
        Wait(2000)
        SyncChannelsToCad()
    end
end)

print("^2[CAD Bridge Sync] Loaded - Will auto-detect Mumble and sync to CAD^0")
