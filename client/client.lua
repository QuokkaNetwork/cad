local isOpen = false

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
        open = isOpen
    })
end

RegisterCommand('cad', function()
    ToggleCAD()
end, false)

RegisterKeyMapping('cad', 'Open CAD/MDT', 'keyboard', 'F5')
