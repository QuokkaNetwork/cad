#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-shot setup for the Mumble voice server on a Windows VPS.

.DESCRIPTION
    - Opens Windows Firewall for port 64738 TCP + UDP
    - murmur.exe ships bundled in server/murmur/ via the repo — no download needed

    Run once on the VPS after pulling the repo.
    After this, the CAD server manages Murmur automatically
    whenever MUMBLE_MANAGE=true is set in server/.env.

.NOTES
    Must be run as Administrator (required for firewall rules).
    Called automatically by start-cad-vps.bat on first run.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$MumblePort = 64738
$ScriptDir  = $PSScriptRoot
$MurmurDir  = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir '..\murmur'))

Write-Host ''
Write-Host '=======================================================' -ForegroundColor Cyan
Write-Host '  Mumble Server Setup for CAD Voice Bridge'              -ForegroundColor Cyan
Write-Host '=======================================================' -ForegroundColor Cyan
Write-Host ''

# ---------------------------------------------------------------------------
# Step 1 — Verify murmur.exe is present (it ships with the repo)
# ---------------------------------------------------------------------------
$ExeCandidates = @(
    (Join-Path $MurmurDir 'murmur.exe'),
    (Join-Path $MurmurDir 'mumble-server.exe')
)
$FoundExe = $ExeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($FoundExe) {
    Write-Host "[OK] Found: $FoundExe" -ForegroundColor Green
} else {
    Write-Host '[ERROR] Mumble server exe not found in server\murmur\' -ForegroundColor Red
    Write-Host '        Expected one of:' -ForegroundColor Yellow
    $ExeCandidates | ForEach-Object { Write-Host "          $_" }
    Write-Host ''
    Write-Host '        The exe should have been included in the repo.' -ForegroundColor Yellow
    Write-Host '        Try: git pull  then re-run this script.' -ForegroundColor Yellow
    exit 1
}

# ---------------------------------------------------------------------------
# Step 2 — Open Windows Firewall
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '[1/1] Configuring Windows Firewall (port 64738 TCP + UDP) ...' -ForegroundColor Cyan

$RuleTCP = Get-NetFirewallRule -DisplayName 'Mumble Voice TCP' -ErrorAction SilentlyContinue
$RuleUDP = Get-NetFirewallRule -DisplayName 'Mumble Voice UDP' -ErrorAction SilentlyContinue

if ($RuleTCP) {
    Write-Host '      TCP rule already exists — skipping.' -ForegroundColor Yellow
} else {
    netsh advfirewall firewall add rule name="Mumble Voice TCP" protocol=TCP dir=in localport=$MumblePort action=allow | Out-Null
    Write-Host '      Added TCP inbound rule.' -ForegroundColor Green
}

if ($RuleUDP) {
    Write-Host '      UDP rule already exists — skipping.' -ForegroundColor Yellow
} else {
    netsh advfirewall firewall add rule name="Mumble Voice UDP" protocol=UDP dir=in localport=$MumblePort action=allow | Out-Null
    Write-Host '      Added UDP inbound rule.' -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '=======================================================' -ForegroundColor Green
Write-Host '  Setup complete!'                                        -ForegroundColor Green
Write-Host '=======================================================' -ForegroundColor Green
Write-Host ''
Write-Host 'What was done:'
Write-Host "  - Verified murmur exe at: $FoundExe"
Write-Host "  - Windows Firewall opened for port $MumblePort TCP + UDP"
Write-Host ''
Write-Host 'What you still need to do manually:' -ForegroundColor Yellow
Write-Host "  1. Open port $MumblePort TCP+UDP in your VPS provider's security group / firewall panel"
Write-Host '  2. Confirm voice.cfg in the repo root has your correct public IP'
Write-Host '  3. Ensure MUMBLE_MANAGE=true and MUMBLE_HOST=127.0.0.1 are in server/.env'
Write-Host '  4. Restart the CAD server — it will start Murmur automatically'
Write-Host '  5. Restart the FiveM server so pma-voice picks up the new voice convars'
Write-Host ''
