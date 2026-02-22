local resourceName = GetCurrentResourceName()

local modules = {
  'server/modules/core.lua',
  'server/modules/documents_shared.lua',
  'server/modules/license.lua',
  'server/modules/registration.lua',
  'server/modules/dispatch_events.lua',
  'server/modules/document_prompts.lua',
  'server/modules/enforcement.lua',
  'server/modules/minicad.lua',
}

local chunks = {}
for i = 1, #modules do
  local modulePath = modules[i]
  local fileContents = LoadResourceFile(resourceName, modulePath)
  if not fileContents then
    error(('cad_bridge server loader missing module: %s'):format(modulePath))
  end
  chunks[#chunks + 1] = fileContents
end

local chunk, loadError = load(table.concat(chunks, '\n'), ('@@%s/server.bundle.lua'):format(resourceName))
if not chunk then
  error(('cad_bridge server loader failed: %s'):format(tostring(loadError or 'unknown error')))
end

chunk()
