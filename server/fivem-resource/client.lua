CreateThread(function()
  while true do
    Wait(math.max(1000, Config.HeartbeatIntervalMs))

    local ped = PlayerPedId()
    if ped and ped ~= 0 then
      local coords = GetEntityCoords(ped)
      local heading = GetEntityHeading(ped)
      local speed = GetEntitySpeed(ped)
      local streetHash, crossingHash = GetStreetNameAtCoord(coords.x, coords.y, coords.z)
      local street = ''
      local crossing = ''
      if streetHash and streetHash ~= 0 then
        street = GetStreetNameFromHashKey(streetHash) or ''
      end
      if crossingHash and crossingHash ~= 0 then
        crossing = GetStreetNameFromHashKey(crossingHash) or ''
      end
      TriggerServerEvent('cad_bridge:clientPosition', {
        x = coords.x,
        y = coords.y,
        z = coords.z,
        heading = heading,
        speed = speed,
        street = street,
        crossing = crossing,
      })
    end
  end
end)
