CreateThread(function()
  while true do
    Wait(math.max(1000, Config.HeartbeatIntervalMs))

    local ped = PlayerPedId()
    if ped and ped ~= 0 then
      local coords = GetEntityCoords(ped)
      local heading = GetEntityHeading(ped)
      local speed = GetEntitySpeed(ped)
      TriggerServerEvent('cad_bridge:clientPosition', {
        x = coords.x,
        y = coords.y,
        z = coords.z,
        heading = heading,
        speed = speed,
      })
    end
  end
end)
