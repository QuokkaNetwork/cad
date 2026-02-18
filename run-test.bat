@echo off
setlocal

cd /d "%~dp0"

if not exist "server\scripts\test-mumble-local.js" (
  echo [CAD-TEST] ERROR: server\scripts\test-mumble-local.js not found.
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [CAD-TEST] ERROR: node is not available in PATH.
  exit /b 1
)

del /f /q test-output.txt 2>nul
node server\scripts\test-mumble-local.js >> test-output.txt 2>&1
echo Exit code: %ERRORLEVEL% >> test-output.txt
