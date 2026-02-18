fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'cad_bridge'
author 'CAD Team'
description 'Bridge between CAD and FiveM/QBox'
version '0.1.0'

shared_script 'config.lua'
client_script 'client.lua'
server_script 'server.lua'

ui_page 'ui/index.html'

files {
  'config.cfg',
  'ui/index.html',
  'ui/styles.css',
  'ui/app.js',
  'ui/cad_radio.css',
  'ui/cad_radio.js',
  'ui/overlay.webp',
}
