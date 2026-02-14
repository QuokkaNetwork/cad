local isOpen = false
local cadUrl = GetConvar('cad_web_url', 'http://127.0.0.1:3030')

RegisterNUICallback('closeCAD', function(_, cb)
    isOpen = false
    SetNuiFocus(false, false)
    cb({ ok = true })
end)

function ToggleCAD()
    isOpen = not isOpen
    SetNuiFocus(isOpen, isOpen)
    SendNUIMessage({
        type = 'toggleCAD',
        open = isOpen,
        cadUrl = cadUrl
    })
end

RegisterCommand('cad', function()
    ToggleCAD()
end, false)

RegisterKeyMapping('cad', 'Open CAD/MDT', 'keyboard', 'F5')
