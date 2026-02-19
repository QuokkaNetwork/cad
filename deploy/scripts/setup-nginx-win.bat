@echo off
setlocal ENABLEEXTENSIONS

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%setup-nginx-win.ps1"

if not exist "%PS_SCRIPT%" (
  echo [CAD] ERROR: Missing script: %PS_SCRIPT%
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS_SCRIPT%" %*
exit /b %ERRORLEVEL%
