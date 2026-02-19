[CmdletBinding()]
param(
  [string]$Domain = 'cad.quokkanetworks.net',
  [string]$Email = '',
  [string]$Backend = 'http://127.0.0.1:3031',
  [string]$NginxRoot = 'C:\nginx',
  [string]$WinAcmeRoot = 'C:\tools\win-acme'
)

$ErrorActionPreference = 'Stop'

function Write-Step {
  param([string]$Message)
  Write-Host "[CAD] $Message"
}

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run setup-nginx-win.bat from an Administrator terminal.'
  }
}

function Ensure-Directory {
  param([string]$PathValue)
  if (-not (Test-Path -LiteralPath $PathValue)) {
    New-Item -ItemType Directory -Path $PathValue -Force | Out-Null
  }
}

function To-NginxPath {
  param([string]$PathValue)
  return ($PathValue -replace '\\', '/')
}

function Download-AndExtractZip {
  param(
    [string]$Url,
    [string]$DestinationDir
  )

  $zipPath = Join-Path $env:TEMP ("cad-download-" + [Guid]::NewGuid().ToString('N') + '.zip')
  $extractPath = Join-Path $env:TEMP ("cad-extract-" + [Guid]::NewGuid().ToString('N'))

  try {
    Write-Step "Downloading $Url"
    Invoke-WebRequest -Uri $Url -OutFile $zipPath -UseBasicParsing

    Ensure-Directory -PathValue $extractPath
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force

    $sourcePath = $extractPath
    $childDirs = @(Get-ChildItem -Path $extractPath -Directory -ErrorAction SilentlyContinue)
    $childFiles = @(Get-ChildItem -Path $extractPath -File -ErrorAction SilentlyContinue)
    if ($childDirs.Count -eq 1 -and $childFiles.Count -eq 0) {
      $sourcePath = $childDirs[0].FullName
    }

    Ensure-Directory -PathValue $DestinationDir
    Copy-Item -Path (Join-Path $sourcePath '*') -Destination $DestinationDir -Recurse -Force
  } finally {
    Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $extractPath -Recurse -Force -ErrorAction SilentlyContinue
  }
}

function Get-LatestNginxZipUrl {
  $response = Invoke-WebRequest -Uri 'https://nginx.org/en/download.html' -UseBasicParsing
  $matches = [regex]::Matches($response.Content, 'href="(?<href>/download/nginx-(?<ver>\d+\.\d+\.\d+)\.zip)"')
  if ($matches.Count -lt 1) {
    throw 'Unable to discover nginx Windows zip URL from nginx.org.'
  }

  $versions = foreach ($match in $matches) {
    [PSCustomObject]@{
      Url = "https://nginx.org$($match.Groups['href'].Value)"
      Version = [version]$match.Groups['ver'].Value
    }
  }

  $latest = $versions | Sort-Object Version -Descending | Select-Object -First 1
  return [string]$latest.Url
}

function Get-LatestWinAcmeZipUrl {
  $headers = @{ 'User-Agent' = 'cad-setup-script' }
  $release = Invoke-RestMethod -Uri 'https://api.github.com/repos/win-acme/win-acme/releases/latest' -Headers $headers
  if (-not $release.assets) {
    throw 'Unable to discover win-acme release assets from GitHub.'
  }

  $asset = $release.assets | Where-Object { $_.name -match 'x64.*trimmed.*\.zip$' } | Select-Object -First 1
  if (-not $asset) {
    $asset = $release.assets | Where-Object { $_.name -match 'x64.*\.zip$' } | Select-Object -First 1
  }
  if (-not $asset) {
    throw 'Unable to find a win-acme x64 zip asset.'
  }

  return [string]$asset.browser_download_url
}

function Render-Template {
  param(
    [string]$TemplatePath,
    [string]$OutputPath,
    [hashtable]$Values
  )

  $content = Get-Content -Path $TemplatePath -Raw
  foreach ($key in $Values.Keys) {
    $token = "{{${key}}}"
    $content = $content.Replace($token, [string]$Values[$key])
  }
  Set-Content -Path $OutputPath -Value $content -Encoding Ascii
}

function Ensure-FirewallRule {
  param(
    [string]$DisplayName,
    [int]$Port
  )

  $existing = Get-NetFirewallRule -DisplayName $DisplayName -ErrorAction SilentlyContinue
  if (-not $existing) {
    New-NetFirewallRule -DisplayName $DisplayName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port | Out-Null
  }
}

function Test-NginxConfig {
  param(
    [string]$NginxExe,
    [string]$NginxPrefix
  )

  & $NginxExe -p "$NginxPrefix\" -c conf/nginx.conf -t
  if ($LASTEXITCODE -ne 0) {
    throw 'nginx configuration test failed.'
  }
}

function Start-OrReloadNginx {
  param(
    [string]$NginxExe,
    [string]$NginxPrefix
  )

  $running = Get-Process -Name 'nginx' -ErrorAction SilentlyContinue
  if ($running) {
    & $NginxExe -p "$NginxPrefix\" -c conf/nginx.conf -s reload
    if ($LASTEXITCODE -ne 0) {
      throw 'nginx reload failed.'
    }
    return
  }

  Start-Process -FilePath $NginxExe -ArgumentList "-p `"$NginxPrefix\`" -c conf/nginx.conf" -WorkingDirectory $NginxPrefix -WindowStyle Hidden
  Start-Sleep -Seconds 2
}

Assert-Admin

$domainInput = Read-Host "Domain [$Domain]"
if (-not [string]::IsNullOrWhiteSpace($domainInput)) {
  $Domain = $domainInput.Trim()
}

$emailPrompt = if ([string]::IsNullOrWhiteSpace($Email)) { 'Let''s Encrypt email' } else { "Let's Encrypt email [$Email]" }
$emailInput = Read-Host $emailPrompt
if (-not [string]::IsNullOrWhiteSpace($emailInput)) {
  $Email = $emailInput.Trim()
}
if ([string]::IsNullOrWhiteSpace($Email)) {
  throw 'Email is required.'
}

$backendInput = Read-Host "CAD backend URL [$Backend]"
if (-not [string]::IsNullOrWhiteSpace($backendInput)) {
  $Backend = $backendInput.Trim()
}

$nginxInput = Read-Host "nginx install path [$NginxRoot]"
if (-not [string]::IsNullOrWhiteSpace($nginxInput)) {
  $NginxRoot = $nginxInput.Trim()
}

$wacsInput = Read-Host "win-acme install path [$WinAcmeRoot]"
if (-not [string]::IsNullOrWhiteSpace($wacsInput)) {
  $WinAcmeRoot = $wacsInput.Trim()
}

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$BootstrapTemplate = Join-Path $RepoRoot 'deploy\nginx\cad-site.windows.bootstrap.conf.template'
$TlsTemplate = Join-Path $RepoRoot 'deploy\nginx\cad-site.windows.tls.conf.template'

if (-not (Test-Path -LiteralPath $BootstrapTemplate)) {
  throw "Missing template: $BootstrapTemplate"
}
if (-not (Test-Path -LiteralPath $TlsTemplate)) {
  throw "Missing template: $TlsTemplate"
}

$NginxExe = Join-Path $NginxRoot 'nginx.exe'
if (-not (Test-Path -LiteralPath $NginxExe)) {
  Write-Step 'nginx.exe not found. Installing nginx (Windows zip build)...'
  $nginxZipUrl = Get-LatestNginxZipUrl
  Download-AndExtractZip -Url $nginxZipUrl -DestinationDir $NginxRoot
}
if (-not (Test-Path -LiteralPath $NginxExe)) {
  throw "nginx.exe not found after install attempt: $NginxExe"
}

$WacsExe = Join-Path $WinAcmeRoot 'wacs.exe'
if (-not (Test-Path -LiteralPath $WacsExe)) {
  Write-Step 'wacs.exe not found. Installing win-acme...'
  $wacsZipUrl = Get-LatestWinAcmeZipUrl
  Download-AndExtractZip -Url $wacsZipUrl -DestinationDir $WinAcmeRoot
}
if (-not (Test-Path -LiteralPath $WacsExe)) {
  throw "wacs.exe not found after install attempt: $WacsExe"
}

$NginxConfDir = Join-Path $NginxRoot 'conf'
$NginxMainConf = Join-Path $NginxConfDir 'nginx.conf'
$NginxConfD = Join-Path $NginxConfDir 'conf.d'
$SiteConf = Join-Path $NginxConfD "$Domain.conf"
$AcmeWebroot = Join-Path $NginxRoot 'acme-webroot'
$AcmeChallenge = Join-Path $AcmeWebroot '.well-known\acme-challenge'
$CertDir = Join-Path $NginxRoot 'certs'
$CertChain = Join-Path $CertDir "$Domain-chain.pem"
$CertKey = Join-Path $CertDir "$Domain-key.pem"
$ReloadScript = Join-Path $NginxRoot 'reload-nginx.bat'

Ensure-Directory -PathValue $NginxConfDir
Ensure-Directory -PathValue $NginxConfD
Ensure-Directory -PathValue $AcmeChallenge
Ensure-Directory -PathValue $CertDir

$mainConfNeedsWrite = $true
if (Test-Path -LiteralPath $NginxMainConf) {
  $existingMainConf = Get-Content -Path $NginxMainConf -Raw
  if ($existingMainConf -match 'include\s+.*conf\.d[\\/]\*\.conf;') {
    $mainConfNeedsWrite = $false
  }
}

if ($mainConfNeedsWrite) {
  if (Test-Path -LiteralPath $NginxMainConf) {
    $timestamp = Get-Date -Format 'yyyyMMddHHmmss'
    Copy-Item -LiteralPath $NginxMainConf -Destination "$NginxMainConf.$timestamp.bak" -Force
  }

  $mainConfContent = @"
worker_processes auto;
error_log logs/error.log warn;
pid logs/nginx.pid;

events {
  worker_connections 1024;
}

http {
  include mime.types;
  default_type application/octet-stream;
  sendfile on;
  tcp_nopush on;
  keepalive_timeout 65;
  server_tokens off;

  access_log logs/access.log;
  include conf.d/*.conf;
}
"@
  Set-Content -Path $NginxMainConf -Value $mainConfContent -Encoding Ascii
}

$renderValues = @{
  DOMAIN = $Domain
  BACKEND = $Backend
  ACME_WEBROOT = To-NginxPath -PathValue $AcmeWebroot
  CERT_CHAIN = To-NginxPath -PathValue $CertChain
  CERT_KEY = To-NginxPath -PathValue $CertKey
}

Write-Step 'Writing bootstrap HTTP nginx site config...'
Render-Template -TemplatePath $BootstrapTemplate -OutputPath $SiteConf -Values $renderValues

Write-Step 'Applying Windows Firewall rules for 80/443...'
Ensure-FirewallRule -DisplayName 'CAD NGINX HTTP (80)' -Port 80
Ensure-FirewallRule -DisplayName 'CAD NGINX HTTPS (443)' -Port 443

Write-Step 'Testing nginx bootstrap config...'
Test-NginxConfig -NginxExe $NginxExe -NginxPrefix $NginxRoot
Write-Step 'Starting/reloading nginx...'
Start-OrReloadNginx -NginxExe $NginxExe -NginxPrefix $NginxRoot

$reloadScriptContent = @"
@echo off
"$NginxExe" -p "$NginxRoot\" -c conf/nginx.conf -t
if errorlevel 1 exit /b 1
"$NginxExe" -p "$NginxRoot\" -c conf/nginx.conf -s reload
exit /b %ERRORLEVEL%
"@
Set-Content -Path $ReloadScript -Value $reloadScriptContent -Encoding Ascii

Write-Step "Requesting Let's Encrypt certificate for $Domain via win-acme..."
$wacsArgs = @(
  '--source', 'manual',
  '--host', $Domain,
  '--friendlyname', "cad-$Domain",
  '--emailaddress', $Email,
  '--accepttos',
  '--validation', 'filesystem',
  '--webroot', $AcmeWebroot,
  '--store', 'pemfiles',
  '--pemfilespath', $CertDir,
  '--pemfilesname', $Domain,
  '--installation', 'script',
  '--script', $ReloadScript,
  '--closeonfinish'
)
& $WacsExe @wacsArgs
if ($LASTEXITCODE -ne 0) {
  throw 'win-acme certificate request failed. Confirm DNS points to this VPS and port 80 is reachable.'
}

if (-not (Test-Path -LiteralPath $CertChain) -or -not (Test-Path -LiteralPath $CertKey)) {
  throw "Expected certificate files not found: $CertChain and $CertKey"
}

Write-Step 'Writing HTTPS nginx site config...'
Render-Template -TemplatePath $TlsTemplate -OutputPath $SiteConf -Values $renderValues

Write-Step 'Testing nginx HTTPS config...'
Test-NginxConfig -NginxExe $NginxExe -NginxPrefix $NginxRoot
Write-Step 'Reloading nginx with HTTPS config...'
Start-OrReloadNginx -NginxExe $NginxExe -NginxPrefix $NginxRoot

Write-Step 'Completed.'
Write-Host "  URL: https://$Domain"
Write-Host "  Backend: $Backend"
Write-Host "  NGINX root: $NginxRoot"
Write-Host "  Site conf: $SiteConf"
Write-Host "  Cert chain: $CertChain"
Write-Host "  Cert key: $CertKey"
Write-Host '  Verify:'
Write-Host "    Invoke-WebRequest https://$Domain/health -UseBasicParsing"
