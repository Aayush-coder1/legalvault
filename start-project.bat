@echo off
REM ============================================================
REM  LegalVault - one double-click starter (Windows)
REM  1. Checks node/npm, env files and MongoDB
REM  2. Installs missing dependencies (skips if present)
REM  3. Opens each service in its own terminal, in boot order:
REM     auth -> crypto -> case -> file -> frontend
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"
title LegalVault Launcher

echo.
echo  ===== LegalVault starter =====
echo  Folder: %CD%
echo.

REM ---- 1. node + npm must exist ----
where node >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Node.js not found. Install Node.js 22 from https://nodejs.org then double-click again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] npm not found. Reinstall Node.js 22 then double-click again.
  pause
  exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo  Node %%v ^| npm ready
echo.

REM ---- 2. env files (create from examples if missing) ----
if not exist ".env" (
  if exist ".env.example" (
    copy /y ".env.example" ".env" >nul
    echo  [SETUP] Created .env from .env.example - FILL IN your secrets, then run again.
    pause
    exit /b 1
  ) else (
    echo  [ERROR] .env and .env.example both missing. Cannot start.
    pause
    exit /b 1
  )
) else (
  echo  [OK] root .env found
)
if not exist "frontend\.env.local" (
  if exist "frontend\.env.example" (
    copy /y "frontend\.env.example" "frontend\.env.local" >nul
    echo  [SETUP] Created frontend\.env.local from example
  ) else (
    echo  [WARN] frontend\.env.local missing and no example to copy from
  )
) else (
  echo  [OK] frontend\.env.local found
)
echo.

REM ---- 3. Mongo: Atlas cloud URL or local server? ----
REM Reads .env directly (no variable expansion, so special chars in passwords are safe).
findstr /i /c:"MONGO_URI=mongodb+srv" ".env" >nul 2>nul
if not errorlevel 1 goto :mongoatlas
findstr /i /c:"mongodb.net" ".env" >nul 2>nul
if not errorlevel 1 goto :mongoatlas
echo  Checking local MongoDB on 127.0.0.1:27017 ...
powershell -NoProfile -NonInteractive -Command "$c=New-Object Net.Sockets.TcpClient; try { if ($c.ConnectAsync('127.0.0.1',27017).Wait(2000)) { exit 0 } else { exit 1 } } catch { exit 1 } finally { $c.Close() }" >nul 2>nul
if errorlevel 1 (
  echo  [WARN] Local MongoDB is NOT reachable. Start MongoDB / Compass first,
  echo         or put your Atlas mongodb+srv:// URL in .env as MONGO_URI.
  echo         Services will still open, but auth and crypto-proxy will exit until Mongo is up.
  echo.
  pause
) else (
  echo  [OK] Local MongoDB is up
  echo.
)
goto :mongodone
:mongoatlas
echo  [OK] Atlas MONGO_URI detected - cloud DB, no local Mongo needed
echo       (Make sure your IP is allowed in Atlas Network Access.)
echo.
:mongodone

REM ---- 4. install deps where node_modules is missing ----
echo  Installing dependencies (skipped where already installed)...
call npm --prefix services\auth-service install --no-audit --no-fund
if errorlevel 1 goto :installfail
call npm --prefix services\crypto-proxy install --no-audit --no-fund
if errorlevel 1 goto :installfail
call npm --prefix services\case-service install --no-audit --no-fund
if errorlevel 1 goto :installfail
call npm --prefix services\file-service install --no-audit --no-fund
if errorlevel 1 goto :installfail
call npm --prefix frontend install --no-audit --no-fund
if errorlevel 1 goto :installfail
echo.
echo  [OK] All dependencies ready
echo.

REM ---- 5. launch each service in its own terminal (boot order matters) ----
echo  Starting services in order: auth -^> crypto -^> case -^> file -^> frontend
echo.

start "LegalVault - auth-service :4001" cmd /k "cd /d "%~dp0services\auth-service" && npm run dev"
timeout /t 6 /nobreak >nul

start "LegalVault - crypto-proxy :4004" cmd /k "cd /d "%~dp0services\crypto-proxy" && npm run dev"
timeout /t 6 /nobreak >nul

start "LegalVault - case-service :4002" cmd /k "cd /d "%~dp0services\case-service" && npm run dev"
timeout /t 3 /nobreak >nul

start "LegalVault - file-service :4003" cmd /k "cd /d "%~dp0services\file-service" && npm run dev"
timeout /t 3 /nobreak >nul

start "LegalVault - frontend :3000" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo  All 5 terminals launched.
echo.
echo  Health checks (wait ~30s for Next.js first build, then open these):
echo    http://localhost:4001/health
echo    http://localhost:4004/health
echo    http://localhost:4002/health
echo    http://localhost:4003/health
echo    http://localhost:3000  ^<-- app
echo.
set /p OPENBROWSER="Open http://localhost:3000 in browser now? (Y/n): "
if /i not "%OPENBROWSER%"=="n" start "" "http://localhost:3000"
echo.
echo  To stop everything: close the 5 service windows (or Ctrl+C in each).
echo  This launcher window can be closed.
pause
exit /b 0

:installfail
echo.
echo  [ERROR] npm install failed above. Fix the error, then double-click again.
pause
exit /b 1
