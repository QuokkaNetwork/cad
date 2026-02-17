#Requires -RunAsAdministrator
<#
.SYNOPSIS
    One-shot setup for the Mumble voice server (murmur.exe) on a Windows VPS.

.DESCRIPTION
    - Downloads murmur.exe from the official Mumble release
    - Places it in server/murmur/murmur.exe
    - Opens Windows Firewall for port 64738 TCP + UDP

    Run once on the VPS. After this, the CAD server manages Murmur automatically
    whenever MUMBLE_MANAGE=true is set in server/.env.

.NOTES
    Must be run as Administrator (required for firewall rules).
    Run from the repo root, e.g.:
        powershell -ExecutionPolicy Bypass -File server\scripts\setup-mumble.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
$MumbleVersion  = '1.5.857'
$MsiUrl         = "https://github.com/mumble-voip/mumble/releases/download/v$MumbleVersion/mumble_server-$MumbleVersion.x64.msi"
$TempMsi        = Join-Path $env:TEMP 'mumble_server.msi'
$TargetDir      = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\murmur'))
$TargetExe      = Join-Path $TargetDir 'murmur.exe'
$MumblePort     = 64738

Write-Host ''
Write-Host '=======================================================' -ForegroundColor Cyan
Write-Host '  Mumble Server (Murmur) Setup for CAD Voice Bridge'     -ForegroundColor Cyan
Write-Host '=======================================================' -ForegroundColor Cyan
Write-Host ''

# ---------------------------------------------------------------------------
# Step 1 — Download murmur.exe if not already present
# ---------------------------------------------------------------------------
if (Test-Path $TargetExe) {
    Write-Host "[SKIP] murmur.exe already exists at:" -ForegroundColor Yellow
    Write-Host "       $TargetExe"
    Write-Host "       Delete it and re-run this script to re-download."
} else {
    Write-Host "[1/2] Downloading Mumble Server v$MumbleVersion MSI ..." -ForegroundColor Cyan
    Write-Host "      From: $MsiUrl"

    # Ensure target directory exists
    if (-not (Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    }

    # Download MSI (v1.5+ only ships as an installer, no bare exe available)
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $MsiUrl -OutFile $TempMsi -UseBasicParsing
    } catch {
        Write-Host ''
        Write-Host '[ERROR] Download failed.' -ForegroundColor Red
        Write-Host "        $_" -ForegroundColor Red
        Write-Host ''
        Write-Host 'Manual fallback:' -ForegroundColor Yellow
        Write-Host '  1. Go to https://www.mumble.info/downloads/'
        Write-Host '  2. Download the Windows Mumble Server MSI (mumble_server-*.x64.msi)'
        Write-Host '  3. Install it silently: msiexec /i mumble_server.msi /qn'
        Write-Host "  4. Copy murmur.exe from 'C:\Program Files\Mumble' into: $TargetDir"
        exit 1
    }

    Write-Host "      Installing silently ..." -ForegroundColor Cyan
    Start-Process msiexec.exe -ArgumentList "/i `"$TempMsi`" /qn /norestart" -Wait

    # Find murmur.exe in the install location
    $InstallDir = @('C:\Program Files\Mumble', 'C:\Program Files (x86)\Mumble') |
        Where-Object { Test-Path "$_\murmur.exe" } | Select-Object -First 1

    if (-not $InstallDir) {
        Write-Host '[ERROR] murmur.exe not found after install. Check the MSI manually.' -ForegroundColor Red
        exit 1
    }

    Write-Host "      Copying murmur.exe from $InstallDir ..." -ForegroundColor Cyan
    Copy-Item "$InstallDir\murmur.exe" $TargetExe -Force

    # Remove the Windows service the MSI created — CAD manages Murmur directly
    sc.exe stop murmur 2>$null
    sc.exe delete murmur 2>$null

    # Cleanup MSI
    Remove-Item $TempMsi -Force -ErrorAction SilentlyContinue

    Write-Host "       Saved to: $TargetExe" -ForegroundColor Green
}

# ---------------------------------------------------------------------------
# Step 2 — Open Windows Firewall
# ---------------------------------------------------------------------------
Write-Host ''
Write-Host '[2/2] Configuring Windows Firewall (port 64738 TCP + UDP) ...' -ForegroundColor Cyan

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
Write-Host "  - murmur.exe placed at: $TargetExe"
Write-Host "  - Windows Firewall opened for port $MumblePort TCP + UDP"
Write-Host ''
Write-Host 'What you still need to do manually:' -ForegroundColor Yellow
Write-Host "  1. Open port $MumblePort TCP+UDP in your VPS provider's security group / firewall panel"
Write-Host '  2. Confirm voice.cfg in the repo root has your correct public IP'
Write-Host '  3. Ensure MUMBLE_MANAGE=true and MUMBLE_HOST=127.0.0.1 are in server/.env'
Write-Host '  4. Restart the CAD server — it will start Murmur automatically'
Write-Host '  5. Restart the FiveM server so pma-voice picks up the new voice convars'
Write-Host ''
