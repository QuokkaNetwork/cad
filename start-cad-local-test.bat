@echo off
setlocal ENABLEDELAYEDEXPANSION

REM Local test launcher (NO git pull/reset/clean)
REM Use this for development so uncommitted changes are never overwritten.

cd /d "%~dp0"

if not exist "package.json" (
  echo [CAD-TEST] ERROR: package.json not found in %CD%
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  where npm.cmd >nul 2>nul
  if errorlevel 1 (
    echo [CAD-TEST] ERROR: npm is not available in PATH.
    exit /b 1
  ) else (
    set "NPM_BIN=npm.cmd"
  )
) else (
  set "NPM_BIN=npm"
)

if not exist "node_modules" (
  echo [CAD-TEST] Installing dependencies...
  call %NPM_BIN% install --include=dev
  if errorlevel 1 exit /b 1
)

if not exist "web\dist\index.html" (
  echo [CAD-TEST] Building web app...
  call %NPM_BIN% run build
  if errorlevel 1 exit /b 1
)

REM Hard-disable updater for this run regardless of .env values.
set "NODE_ENV=production"
set "AUTO_UPDATE_ENABLED=false"
set "AUTO_UPDATE_FORCE_SYNC=false"
set "AUTO_UPDATE_SELF_RESTART=false"
set "AUTO_UPDATE_EXIT_ON_UPDATE=false"
set "AUTO_UPDATE_RUN_NPM_INSTALL=false"
set "AUTO_UPDATE_RUN_WEB_BUILD=false"

echo [CAD-TEST] Starting CAD without auto-update/pull...
echo [CAD-TEST] Working tree will not be reset by this launcher.
echo.
call %NPM_BIN% run start
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo [CAD-TEST] CAD exited with code %EXIT_CODE%.
exit /b %EXIT_CODE%
