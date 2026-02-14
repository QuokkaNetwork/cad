# FiveM CAD Prototype

Basic CAD skeleton that runs as a FiveM server resource and exposes a web panel for dispatchers.

## What is included
- Express API hosted from the resource
- JWT auth with a local SQLite user table
- QBox character search via MySQL
- React web panel served from the same server

## Quick start
1. Install dependencies:
   - `npm install`
   - `npm --prefix web install`
2. Build the web panel:
   - `npm run web:build`
3. Update config in `shared/config.js`.
4. Start the server resource or run locally:
   - Local dev: `npm run web:dev` and `npm start`

## Default dispatcher login
- Username: admin
- Password: changeme

Change the default password after first login.
