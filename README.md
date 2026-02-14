# FiveM CAD + Desktop Client

CAD/MDT that runs as a FiveM server resource, with a shared backend API/database so in-game NUI and desktop users stay in sync.

## Repository layout
- `resource/`: FiveM resource + backend API + web panel
- `desktop/`: installable desktop wrapper app

## What is included
- FiveM resource (`resource/fxmanifest.lua`, `resource/client/`, `resource/server/`, `resource/shared/`)
- Express API hosted by the resource (`resource/server/index.js`)
- Persistent CAD database (`resource/data/cad.sqlite`)
- QBox character + vehicle search via MySQL (`resource/server/qbox.js`)
- React dispatcher panel (`resource/web/`)
- Installable Windows desktop wrapper (`desktop/`) for dispatchers not in-game

## Sync model
- All clients (FiveM NUI + desktop app + browser) connect to the same CAD API server.
- The API writes to one shared database file (`resource/data/cad.sqlite`), so calls, units, BOLOs, etc. are synchronized across all clients.
- Admins can configure an external character/vehicle database mapping in the CAD UI (Admin -> Services -> External DB Mapping).

## Quick start
1. Install dependencies:
   - `npm install`
   - `npm --prefix resource/web install`
   - `npm --prefix desktop install` (only needed if building/running desktop app)
2. Build web assets:
   - `npm run web:build`
3. Configure:
   - Edit `resource/shared/config.js` (host/port, JWT secret, QBox DB details)
   - Optional FiveM ConVar to control in-game CAD URL:
     - `set cad_web_url "http://127.0.0.1:3030"`
4. Run CAD server:
   - Local: `npm start`
   - FiveM: add resource and `ensure <resource-name>`
5. Optional desktop app:
   - Dev run: `npm run desktop:dev`
   - Build installer: `npm run desktop:build`
   - Desktop config file is created at first launch in app data (`config.json`) with `serverUrl`.

## Default dispatcher login
- Username: `admin`
- Password: `changeme`

Change the default password after first login.
