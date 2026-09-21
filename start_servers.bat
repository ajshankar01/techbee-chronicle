@echo off
title TechBee Chronicle - Server Launcher
color 0A
cls

echo.
echo  ================================================================
echo       TECHBEE CHRONICLE AI INTERVIEW PLATFORM
echo       Unified Server Launcher
echo  ================================================================
echo.

set ROOT=%~dp0
set API_DIR=%ROOT%apps\api
set WEB_DIR=%ROOT%apps\web
set VENV_PYTHON=%API_DIR%\.venv\Scripts\python.exe

:: Validate environment
if not exist "%VENV_PYTHON%" (
    color 0C
    echo  [ERROR] Python virtual environment not found at:
    echo  %VENV_PYTHON%
    echo  Please ensure the virtual environment is set up.
    echo.
    pause
    exit /b 1
)

:: Prompt for Mode (Defaults to [1] Local Development after 5 seconds)
echo  Select Launch Mode:
echo.
echo   [1] Local Development Mode (FastAPI 8000 + Next.js 3000) [DEFAULT in 5s]
echo   [2] Presentation Mode (Local Servers + ngrok Manager Public Share Link)
echo   [3] API Backend Only (FastAPI port 8000)
echo.
choice /c 123 /t 5 /d 1 /m " Enter your choice (1, 2, or 3): "
set LAUNCH_MODE=%errorlevel%

if "%LAUNCH_MODE%"=="3" (
    call "%ROOT%start_api.bat"
    exit /b 0
)

cls
echo.
echo  ================================================================
if "%LAUNCH_MODE%"=="2" (
    echo   LAUNCHING IN PRESENTATION MODE (LOCAL + NGROK TUNNEL)
) else (
    echo   LAUNCHING IN LOCAL DEVELOPMENT MODE (RELIABLE LOCALHOST)
)
echo  ================================================================
echo.

:: ── Step 1: Ensure Local .env.local ──────────────────────────────────────────
echo  [1/5] Configuring frontend API connection to http://127.0.0.1:8000 (IPv4)...
(
    echo # Local development connection (Explicit IPv4 to avoid Windows 11 IPv6 refusal)
    echo NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
    echo NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000
) > "%WEB_DIR%\.env.local"

:: ── Step 2: Clear any stuck processes on ports 8000 and 3000 ─────────────────
echo  [2/5] Cleaning up any previous port conflicts...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
ping 127.0.0.1 -n 2 >nul

:: ── Step 3: Start FastAPI Backend ────────────────────────────────────────────
echo  [3/5] Starting FastAPI Backend on port 8000...
start "TechBee API Backend (port 8000)" cmd /k "cd /d %API_DIR% && color 0B && title TechBee API Backend && echo. && echo  ================================================== && echo  TechBee Chronicle - FastAPI Backend (port 8000) && echo  ================================================== && echo. && "%VENV_PYTHON%" -m uvicorn main:app --reload --port 8000 --host 0.0.0.0"

:: ── Step 4: Start Next.js Frontend ───────────────────────────────────────────
echo  [4/5] Starting Next.js Frontend on port 3000...
start "TechBee Next.js Frontend (port 3000)" cmd /k "cd /d %WEB_DIR% && color 0E && title TechBee Next.js Frontend && echo. && echo  ================================================= && echo  TechBee Chronicle - Next.js Frontend (port 3000) && echo  ================================================= && echo. && npm run dev"

:: ── Step 5: Wait and Verify Both Services Are Healthy ────────────────────────
echo.
echo  [5/5] Verifying services health...
echo        - Checking API at http://127.0.0.1:8000/api/health
echo        - Checking Web at http://localhost:3000

set /a attempts=0

:HEALTH_CHECK_LOOP
set /a attempts+=1

:: Ping API (Explicit IPv4 loopback)
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=(Invoke-WebRequest 'http://127.0.0.1:8000/api/health' -TimeoutSec 2 -UseBasicParsing -EA Stop).StatusCode; if($r -eq 200){exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
set API_READY=%errorlevel%

:: Ping Web
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=(Invoke-WebRequest 'http://localhost:3000' -TimeoutSec 2 -UseBasicParsing -EA Stop).StatusCode; if($r -lt 500){exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
set WEB_READY=%errorlevel%

if %API_READY%==0 if %WEB_READY%==0 goto ALL_READY

if %attempts% geq 35 goto HEALTH_TIMEOUT
echo        Waiting for servers to initialize... (%attempts%/35)
ping 127.0.0.1 -n 3 >nul
goto HEALTH_CHECK_LOOP

:HEALTH_TIMEOUT
color 0E
echo.
echo  ================================================================
echo   [NOTE] Initial server startup is taking longer than expected.
echo   Check the yellow window (Next.js) and cyan window (FastAPI).
echo   Once both show ready, you can access:
echo     Web: http://localhost:3000/hr/schedule
echo     API: http://localhost:8000/docs
echo  ================================================================
echo.
goto HANDLE_MODE_POST

:ALL_READY
color 0A
echo.
echo  ================================================================
echo   ALL SYSTEMS ONLINE AND HEALTHY!
echo     - FastAPI Backend : http://localhost:8000 (Connected)
echo     - Next.js Web App : http://localhost:3000 (Ready)
echo  ================================================================
echo.

:HANDLE_MODE_POST
if "%LAUNCH_MODE%"=="2" goto START_NGROK
goto OPEN_LOCAL_BROWSER

:START_NGROK
echo  Starting ngrok tunnels for manager presentation...
start "ngrok Tunnels" cmd /k "color 0D && title ngrok Tunnels && npx ngrok start --all"
ping 127.0.0.1 -n 7 >nul

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$t=(Invoke-RestMethod 'http://localhost:4040/api/tunnels' -UseBasicParsing -EA SilentlyContinue).tunnels;" ^
  "if(-not $t){Write-Host '  ERROR: Could not get ngrok URLs.' -ForegroundColor Red; Write-Host '  Check the purple ngrok window for errors.' -ForegroundColor Red; exit 0;}" ^
  "$api=($t|?{$_.config.addr -match '8000'}|Select -First 1).public_url -replace '^http://','https://';" ^
  "$web=($t|?{$_.config.addr -match '3000'}|Select -First 1).public_url -replace '^http://','https://';" ^
  "$ws=$api -replace '^https://','wss://';" ^
  "\"NEXT_PUBLIC_API_URL=$api`nNEXT_PUBLIC_WS_URL=$ws\"|Set-Content '%WEB_DIR%\.env.local' -Encoding UTF8;" ^
  "cls;" ^
  "Write-Host '';" ^
  "Write-Host '  ================================================================' -ForegroundColor Green;" ^
  "Write-Host '    PRESENTATION URL READY FOR YOUR MANAGER:' -ForegroundColor Green;" ^
  "Write-Host '';" ^
  "Write-Host \"    >>> $web <<<\" -ForegroundColor Cyan;" ^
  "Write-Host '';" ^
  "Write-Host '    Public API Tunnel : ' -ForegroundColor Gray -NoNewline; Write-Host $api -ForegroundColor DarkGray;" ^
  "Write-Host '  ================================================================' -ForegroundColor Green;" ^
  "Start-Process $web;"

echo.
echo  Keep the purple ngrok window open during your presentation.
goto LAUNCH_DONE

:OPEN_LOCAL_BROWSER
echo  Launching browser to http://localhost:3000/hr/schedule...
start http://localhost:3000/hr/schedule

:LAUNCH_DONE
echo.
echo  ================================================================
echo   Server Windows Open:
echo     [Cyan]    FastAPI Backend   (port 8000)
echo     [Yellow]  Next.js Frontend  (port 3000)
if "%LAUNCH_MODE%"=="2" (
echo     [Purple]  ngrok Tunnel      (Public share)
)
echo.
echo   Do not close the server windows while using the application.
echo   This launcher window can now be safely closed.
echo  ================================================================
echo.
pause
