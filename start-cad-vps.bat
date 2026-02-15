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

set "AUTO_UPDATE_BRANCH=main"
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
    if /I "%%A"=="AUTO_UPDATE_BRANCH" set "AUTO_UPDATE_BRANCH=%%B"
  )
)

if "%AUTO_UPDATE_BRANCH%"=="" set "AUTO_UPDATE_BRANCH=main"
echo [CAD] Forcing sync with origin/%AUTO_UPDATE_BRANCH% ...
call git fetch origin %AUTO_UPDATE_BRANCH%
if errorlevel 1 goto :fail
call git reset --hard origin/%AUTO_UPDATE_BRANCH%
if errorlevel 1 goto :fail
call git clean -fd
if errorlevel 1 goto :fail

echo [CAD] Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo [CAD] Building web app...
call npm run build
if errorlevel 1 goto :fail

echo [CAD] Launching server...
set NODE_ENV=production
call npm run start
goto :eof

:fail
echo [CAD] Startup failed.
pause
exit /b 1
