@echo off
title TechBee Chronicle - API Launcher
color 0B
cls

echo.
echo  ================================================================
echo       TECHBEE CHRONICLE - FASTAPI BACKEND LAUNCHER
echo       Starts Python FastAPI Backend on http://localhost:8000
echo  ================================================================
echo.

set ROOT=%~dp0
set API_DIR=%ROOT%apps\api
set VENV_PYTHON=%API_DIR%\.venv\Scripts\python.exe

:: Step 1: Check virtual environment
if not exist "%VENV_PYTHON%" (
    color 0C
    echo  [ERROR] Python virtual environment not found at:
    echo  %VENV_PYTHON%
    echo.
    echo  Please ensure the virtual environment exists.
    echo.
    pause
    exit /b 1
)

:: Step 2: Check if port 8000 is already in use and free it
echo  [1/2] Checking port 8000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
    echo  Port 8000 is occupied by PID %%a. Closing previous process...
    taskkill /PID %%a /F >nul 2>&1
    ping 127.0.0.1 -n 2 >nul
)

:: Step 3: Launch FastAPI in a separate dedicated console
echo  [2/2] Launching FastAPI Backend...
start "TechBee API Backend (port 8000)" cmd /k "cd /d %API_DIR% && color 0B && title TechBee API Backend && echo. && echo  ================================================== && echo  TechBee Chronicle - FastAPI Backend (port 8000) && echo  ================================================== && echo. && "%VENV_PYTHON%" -m uvicorn main:app --reload --port 8000 --host 0.0.0.0"

:: Step 4: Health Check Ping
echo.
echo  Waiting for API to respond at http://127.0.0.1:8000/api/health...
set /a attempts=0

:HEALTH_LOOP
set /a attempts+=1
powershell -NoProfile -ExecutionPolicy Bypass -Command "try{$r=(Invoke-WebRequest 'http://127.0.0.1:8000/api/health' -TimeoutSec 2 -UseBasicParsing -EA Stop).StatusCode; if($r -eq 200){exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
if %errorlevel%==0 goto API_READY
if %attempts% geq 25 goto API_TIMEOUT
ping 127.0.0.1 -n 2 >nul
goto HEALTH_LOOP

:API_TIMEOUT
color 0E
echo.
echo  ================================================================
echo   [WARNING] API health check is taking longer than usual.
echo   Check the cyan 'TechBee API Backend' window for startup errors.
echo   You can inspect: http://localhost:8000/docs
echo  ================================================================
echo.
pause
exit /b 0

:API_READY
color 0A
echo.
echo  ================================================================
echo   SUCCESS: FastAPI Backend is HEALTHY and RUNNING!
echo   API URL  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo   Health   : http://localhost:8000/api/health
echo  ================================================================
echo.
echo  You can leave this window open or close it safely.
echo  The cyan API Backend window will continue running in the background.
echo.
pause
