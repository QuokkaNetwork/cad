DROP murmur.exe HERE
====================

The CAD auto-starts Murmur (the Mumble server) when MUMBLE_MANAGE=true in .env.
It looks for murmur.exe in THIS folder: server/murmur/murmur.exe

HOW TO GET murmur.exe
---------------------
1. Go to: https://www.mumble.info/downloads/
2. Under "Mumble Server (Murmur)" click the Windows download
3. You will get a .zip or .msi — extract/install it and find murmur.exe
4. Copy murmur.exe into this folder (server/murmur/murmur.exe)

Alternatively, run the PowerShell setup script which does this automatically:
   server/scripts/setup-mumble.ps1

WHAT THE CAD MANAGES AUTOMATICALLY
------------------------------------
- Starts murmur.exe when the CAD server starts
- Writes server/data/murmur.ini with the correct settings
- Restarts Murmur if it crashes
- Stops Murmur cleanly when the CAD shuts down
- All voice data stored in server/data/murmur.sqlite

YOU STILL NEED TO
------------------
- Open port 64738 TCP+UDP in Windows Firewall (the setup script does this)
- Open port 64738 in your VPS provider's security group / network firewall panel
- Add voice_externalAddress and voice_externalPort to your FiveM server.cfg
  (see server/fivem-resource/server.cfg.example)
