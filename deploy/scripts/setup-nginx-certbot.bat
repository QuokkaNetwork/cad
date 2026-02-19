@echo off
setlocal ENABLEEXTENSIONS

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"

set "LOCAL_SETUP_SH=%REPO_ROOT%\deploy\scripts\setup-nginx-certbot.sh"
set "LOCAL_TEMPLATE=%REPO_ROOT%\deploy\nginx\cad-site.conf.template"

if not exist "%LOCAL_SETUP_SH%" (
  echo [CAD] ERROR: Missing script: %LOCAL_SETUP_SH%
  exit /b 1
)

if not exist "%LOCAL_TEMPLATE%" (
  echo [CAD] ERROR: Missing nginx template: %LOCAL_TEMPLATE%
  exit /b 1
)

where ssh >nul 2>nul
if errorlevel 1 (
  echo [CAD] ERROR: ssh client not found. Install OpenSSH Client on this machine.
  exit /b 1
)

where scp >nul 2>nul
if errorlevel 1 (
  echo [CAD] ERROR: scp client not found. Install OpenSSH Client on this machine.
  exit /b 1
)

echo [CAD] Remote NGINX + Certbot setup
set /p "VPS_HOST=VPS host or IP: "
if "%VPS_HOST%"=="" (
  echo [CAD] ERROR: VPS host is required.
  exit /b 1
)

set /p "VPS_USER=SSH user [root]: "
if "%VPS_USER%"=="" set "VPS_USER=root"

set /p "DOMAIN=Domain [cad.quokkanetworks.net]: "
if "%DOMAIN%"=="" set "DOMAIN=cad.quokkanetworks.net"

set /p "EMAIL=Let's Encrypt email: "
if "%EMAIL%"=="" (
  echo [CAD] ERROR: email is required.
  exit /b 1
)

set /p "CAD_BACKEND_URL=CAD backend URL [http://127.0.0.1:3031]: "
if "%CAD_BACKEND_URL%"=="" set "CAD_BACKEND_URL=http://127.0.0.1:3031"

set "SSH_TARGET=%VPS_USER%@%VPS_HOST%"
set "REMOTE_DIR=/tmp/cad-nginx-setup"

echo [CAD] Creating remote staging directory...
ssh "%SSH_TARGET%" "mkdir -p '%REMOTE_DIR%/deploy/scripts' '%REMOTE_DIR%/deploy/nginx'"
if errorlevel 1 (
  echo [CAD] ERROR: Could not create staging directory on VPS.
  exit /b 1
)

echo [CAD] Uploading setup assets...
scp "%LOCAL_SETUP_SH%" "%SSH_TARGET%:%REMOTE_DIR%/deploy/scripts/setup-nginx-certbot.sh"
if errorlevel 1 (
  echo [CAD] ERROR: Failed to upload setup-nginx-certbot.sh
  exit /b 1
)

scp "%LOCAL_TEMPLATE%" "%SSH_TARGET%:%REMOTE_DIR%/deploy/nginx/cad-site.conf.template"
if errorlevel 1 (
  echo [CAD] ERROR: Failed to upload cad-site.conf.template
  exit /b 1
)

echo [CAD] Running remote install (nginx + certbot)...
ssh -t "%SSH_TARGET%" "cd '%REMOTE_DIR%' && chmod +x deploy/scripts/setup-nginx-certbot.sh && if [ $(id -u) -eq 0 ]; then CAD_BACKEND_URL='%CAD_BACKEND_URL%' bash deploy/scripts/setup-nginx-certbot.sh '%DOMAIN%' '%EMAIL%'; else CAD_BACKEND_URL='%CAD_BACKEND_URL%' sudo bash deploy/scripts/setup-nginx-certbot.sh '%DOMAIN%' '%EMAIL%'; fi"
if errorlevel 1 (
  echo [CAD] ERROR: Remote setup failed.
  exit /b 1
)

echo [CAD] Cleaning remote staging directory...
ssh "%SSH_TARGET%" "rm -rf '%REMOTE_DIR%'" >nul 2>nul

echo [CAD] Setup complete.
echo [CAD] URL: https://%DOMAIN%
exit /b 0
