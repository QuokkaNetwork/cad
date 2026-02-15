@echo off
setlocal ENABLEDELAYEDEXPANSION

cd /d "%~dp0"

echo [CAD] Starting VPS launcher...

where node >nul 2>nul
if errorlevel 1 (
  echo [CAD] ERROR: Node.js is not installed or not in PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [CAD] ERROR: npm is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [CAD] Root dependencies missing. Running npm install...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist "server\node_modules" (
  echo [CAD] Server dependencies missing. Running npm install...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist "web\dist\index.html" (
  echo [CAD] Web build missing. Running npm run build...
  call npm run build
  if errorlevel 1 goto :fail
)

echo [CAD] Launching server...
set NODE_ENV=production
call npm run start
goto :eof

:fail
echo [CAD] Startup failed.
pause
exit /b 1

