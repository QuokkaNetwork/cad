fx_version 'cerulean'

game 'gta5'

lua54 'yes'

description 'Victoria Police VKC CAD/MDT System'

shared_script 'shared/config.js'
server_script 'server/index.js'

client_scripts {
  'client/client.lua',
  'client/radio.js',
}

ui_page 'client/nui/index.html'

files {
  'client/nui/index.html',
}
