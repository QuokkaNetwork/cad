local resourceName = GetCurrentResourceName()

local modules = {
  'client/modules/shared.lua',
  'client/modules/license.lua',
  'client/modules/registration.lua',
  'client/modules/documents_ui.lua',
  'client/modules/livemap.lua',
  'client/modules/peds.lua',
}

local chunks = {}
for i = 1, #modules do
  local modulePath = modules[i]
  local fileContents = LoadResourceFile(resourceName, modulePath)
  if not fileContents then
    error(('cad_bridge client loader missing module: %s'):format(modulePath))
  end
  chunks[#chunks + 1] = fileContents
end

local chunk, loadError = load(table.concat(chunks, '\n'), ('@@%s/client.bundle.lua'):format(resourceName))
if not chunk then
  error(('cad_bridge client loader failed: %s'):format(tostring(loadError or 'unknown error')))
end

chunk()