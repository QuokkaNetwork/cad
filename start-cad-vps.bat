@echo off
setlocal ENABLEDELAYEDEXPANSION

REM --- Self-relocate to temp copy ---
REM cmd.exe reads .bat files from disk line-by-line. If git updates this file mid-run
REM the interpreter loses its place and the window closes. Copy to temp and re-launch.
if not defined CAD_RUNNING_FROM_TEMP (
  set "CAD_TEMP_BAT=%TEMP%\cad-launcher-%RANDOM%.bat"
  copy /Y "%~f0" "!CAD_TEMP_BAT!" >nul 2>nul
  set "CAD_RUNNING_FROM_TEMP=1"
  set "CAD_ORIGINAL_DIR=%~dp0"
  cmd /c ""!CAD_TEMP_BAT!""
  del "!CAD_TEMP_BAT!" >nul 2>nul
  exit /b !ERRORLEVEL!
)

REM --- Bootstrap config ---
REM Set this to your repo URL if running this BAT outside an existing CAD repo checkout.
set "CAD_REPO_URL=https://github.com/QuokkaNetwork/cad.git"
set "CAD_REPO_BRANCH=main"
set "CAD_SUBDIR=cad"

if defined CAD_ORIGINAL_DIR (
  set "SCRIPT_DIR=%CAD_ORIGINAL_DIR%"
) else (
  set "SCRIPT_DIR=%~dp0"
)
for %%I in ("%SCRIPT_DIR%.") do set "SCRIPT_DIR=%%~fI"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "APP_DIR=%SCRIPT_DIR%"
set "NPM_BIN="
set "NPM_INSTALL_FLAGS=--include=dev"
set "npm_config_production=false"
set "npm_config_include=dev"

echo [CAD] Starting self-install launcher...

REM --- Detect app directory ---
REM Check if this BAT lives inside an existing CAD repo checkout
if exist "%APP_DIR%\package.json" if exist "%APP_DIR%\server" if exist "%APP_DIR%\web" goto :deps_check
REM Not inside a repo checkout — use a subdirectory
set "APP_DIR=%SCRIPT_DIR%\%CAD_SUBDIR%"
if not exist "%APP_DIR%" mkdir "%APP_DIR%"

set "APP_DIR=%APP_DIR:"=%"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

:deps_check
where winget >nul 2>nul
if errorlevel 1 (
  echo [CAD] ERROR: winget not found. Install App Installer from Microsoft Store.
  pause
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo [CAD] Git not found. Installing Git...
  winget install --id Git.Git -e --source winget --silent --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo [CAD] ERROR: Git install failed.
    pause
    exit /b 1
  )
  if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
  if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "PATH=%ProgramFiles(x86)%\Git\cmd;%PATH%"
)

where node >nul 2>nul
if errorlevel 1 (
  echo [CAD] Node.js not found. Installing Node LTS...
  winget install --id OpenJS.NodeJS.LTS -e --source winget --silent --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo [CAD] ERROR: Node.js install failed.
    pause
    exit /b 1
  )
  if exist "%ProgramFiles%\nodejs" set "PATH=%ProgramFiles%\nodejs;%PATH%"
)

where npm >nul 2>nul
if not errorlevel 1 set "NPM_BIN=npm"
if not defined NPM_BIN (
  where npm.cmd >nul 2>nul
  if not errorlevel 1 set "NPM_BIN=npm.cmd"
)
if not defined NPM_BIN (
  echo [CAD] ERROR: npm is not available after Node install.
  pause
  exit /b 1
)

REM --- Clone repo if needed ---
if not exist "%APP_DIR%\package.json" (
  if "%CAD_REPO_URL%"=="https://github.com/YOUR_ORG/YOUR_CAD_REPO.git" (
    echo [CAD] ERROR: Set CAD_REPO_URL at top of this BAT to your real repository URL.
    pause
    exit /b 1
  )
  echo [CAD] No CAD source found. Cloning repository into "%APP_DIR%"...
  echo [CAD] Cloning to: %APP_DIR%
  git clone --branch "%CAD_REPO_BRANCH%" "%CAD_REPO_URL%" "%APP_DIR%"
  if errorlevel 1 (
    echo [CAD] ERROR: Repository clone failed.
    pause
    exit /b 1
  )
)

cd /d "%APP_DIR%"

REM --- Ensure we have a git repo ---
if not exist ".git" (
  echo [CAD] No .git directory found in %APP_DIR%.
  REM Try initializing git and connecting to the remote
  if "%CAD_REPO_URL%"=="https://github.com/YOUR_ORG/YOUR_CAD_REPO.git" (
    echo [CAD] ERROR: Directory is not a git repo and CAD_REPO_URL is not configured.
    echo [CAD] Set CAD_REPO_URL at the top of this BAT, then run again.
    pause
    exit /b 1
  )
  echo [CAD] Initializing git repo and connecting to remote...
  git init
  git remote add origin "%CAD_REPO_URL%"
  git fetch origin "%CAD_REPO_BRANCH%"
  if errorlevel 1 (
    echo [CAD] ERROR: Could not fetch from remote. Check CAD_REPO_URL.
    pause
    exit /b 1
  )
  git reset --hard "origin/%CAD_REPO_BRANCH%"
  if errorlevel 1 (
    echo [CAD] ERROR: Could not sync to origin/%CAD_REPO_BRANCH%.
    pause
    exit /b 1
  )
  git branch -M "%CAD_REPO_BRANCH%"
  git branch --set-upstream-to="origin/%CAD_REPO_BRANCH%" "%CAD_REPO_BRANCH%"
  echo [CAD] Git repo initialized and synced to origin/%CAD_REPO_BRANCH%.
)

if not exist ".env" (
  if exist ".env.example" (
    echo [CAD] Creating .env from .env.example...
    copy /Y ".env.example" ".env" >nul
  )
)
if not exist "server\data" mkdir "server\data"
if not exist "server\data\uploads" mkdir "server\data\uploads"

set "AUTO_UPDATE_BRANCH=%CAD_REPO_BRANCH%"
if exist ".env" (
  for /f "usebackq eol=# tokens=1,* delims==" %%A in (".env") do (
    set "_KEY=%%A"
    REM Skip blank lines
    if defined _KEY if /I "!_KEY!"=="AUTO_UPDATE_BRANCH" set "AUTO_UPDATE_BRANCH=%%B"
  )
)
if "%AUTO_UPDATE_BRANCH%"=="" set "AUTO_UPDATE_BRANCH=%CAD_REPO_BRANCH%"

:main_loop
set "LOCAL_HEAD="
set "REMOTE_HEAD="
set "UPDATED=0"

echo [CAD] Checking for updates on startup...
for /f %%I in ('git rev-parse HEAD 2^>nul') do set "LOCAL_HEAD=%%I"
git fetch origin %AUTO_UPDATE_BRANCH% --quiet
if errorlevel 1 (
  echo [CAD] WARNING: Could not fetch updates ^(network issue?^). Continuing with current version...
  goto :skip_update
)
for /f %%I in ('git rev-parse "origin/%AUTO_UPDATE_BRANCH%" 2^>nul') do set "REMOTE_HEAD=%%I"

if not defined REMOTE_HEAD (
  echo [CAD] WARNING: Could not determine remote HEAD. Skipping update.
  goto :skip_update
)

if not defined LOCAL_HEAD (
  echo [CAD] No local commit detected. Syncing to origin/%AUTO_UPDATE_BRANCH%...
  git reset --hard "origin/%AUTO_UPDATE_BRANCH%"
  if errorlevel 1 goto :fail
  git clean -fd -e .env -e server/data/
  if errorlevel 1 goto :fail
  set "UPDATED=1"
) else if /I not "!LOCAL_HEAD!"=="!REMOTE_HEAD!" (
  echo [CAD] Update found on origin/%AUTO_UPDATE_BRANCH%. Local: !LOCAL_HEAD:~0,8! Remote: !REMOTE_HEAD:~0,8!
  git reset --hard "origin/%AUTO_UPDATE_BRANCH%"
  if errorlevel 1 goto :fail
  git clean -fd -e .env -e server/data/
  if errorlevel 1 goto :fail
  set "UPDATED=1"
) else (
  echo [CAD] Already up to date ^(!LOCAL_HEAD:~0,8!^).
)

:skip_update
if "!UPDATED!"=="1" (
  echo [CAD] Installing dependencies...
  %NPM_BIN% install %NPM_INSTALL_FLAGS%
  if errorlevel 1 goto :fail

  echo [CAD] Building web app...
  %NPM_BIN% run build
  if errorlevel 1 (
    echo [CAD] Build failed. Re-installing web workspace dev dependencies and retrying...
    %NPM_BIN% install --workspace=web %NPM_INSTALL_FLAGS%
    if errorlevel 1 goto :fail
    %NPM_BIN% run build
    if errorlevel 1 goto :fail
  )
) else (
  if not exist "node_modules" (
    echo [CAD] Dependencies missing. Running npm install...
    %NPM_BIN% install %NPM_INSTALL_FLAGS%
    if errorlevel 1 goto :fail
  )
  if not exist "web\dist\index.html" (
    echo [CAD] Web build missing. Running npm run build...
    %NPM_BIN% run build
    if errorlevel 1 (
      echo [CAD] Build failed. Re-installing web workspace dev dependencies and retrying...
      %NPM_BIN% install --workspace=web %NPM_INSTALL_FLAGS%
      if errorlevel 1 goto :fail
      %NPM_BIN% run build
      if errorlevel 1 goto :fail
    )
  )
)

echo [CAD] Launching server...
set NODE_ENV=production
set AUTO_UPDATE_ENABLED=true
set AUTO_UPDATE_SELF_RESTART=false
set AUTO_UPDATE_EXIT_ON_UPDATE=true
echo [CAD] Running: %NPM_BIN% run start
echo.
%NPM_BIN% run start
set "SERVER_EXIT=!ERRORLEVEL!"
echo.
echo [CAD] Server exited with code !SERVER_EXIT!.
if "!SERVER_EXIT!"=="0" (
  echo [CAD] Clean exit ^(likely auto-update restart^). Restarting in 2 seconds...
  timeout /t 2 /nobreak >nul
) else (
  echo [CAD] Server crashed. Restarting in 5 seconds...
  echo [CAD] If this keeps happening, check the error above and your .env configuration.
  timeout /t 5 /nobreak >nul
)
goto :main_loop

:fail
echo.
echo [CAD] Startup failed. See error above.
echo [CAD] Press any key to exit...
pause >nul
exit /b 1
