fx_version "cerulean"
game "gta5"

author "Quokka"
description "Quokka Live Map - Real-time dispatch map"
version "1.0.0"

client_scripts { "client/client.js" }
server_scripts { "server/server.js" }

files {
    "web/**/*",
    "tiles/**/*",
    "tiles/*.png",
    "web/tiles/*.png"
}
