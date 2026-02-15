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

where git >nul 2>nul
if errorlevel 1 (
  echo [CAD] Git not found. Attempting install via winget...
  where winget >nul 2>nul
  if errorlevel 1 (
    echo [CAD] ERROR: Git is required for auto updates and winget is not available.
    echo [CAD] Install Git manually from https://git-scm.com/download/win
    pause
    exit /b 1
  )

  winget install --id Git.Git -e --source winget --silent --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo [CAD] ERROR: Failed to install Git automatically.
    echo [CAD] Install Git manually from https://git-scm.com/download/win
    pause
    exit /b 1
  )

  if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
  if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "PATH=%ProgramFiles(x86)%\Git\cmd;%PATH%"

  where git >nul 2>nul
  if errorlevel 1 (
    echo [CAD] ERROR: Git installed but still not available in PATH.
    echo [CAD] Re-open the terminal or set GIT_BIN in .env to your git.exe path.
    pause
    exit /b 1
  )
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
