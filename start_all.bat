@echo off
setlocal EnableDelayedExpansion
title ARIA - Start All Services
color 0A

echo.
echo ============================================================
echo   ARIA - Anticipatory Reasoning ^& Intelligent Assistance
echo ============================================================
echo.

:: ---------- sanity checks ----------
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Make sure Python is installed and on PATH.
    pause & exit /b 1
)
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Make sure Node.js is installed and on PATH.
    pause & exit /b 1
)

:: ---------- write .env so Vite picks up the backend URL ----------
echo [Preflight] Writing aria-desktop\.env ...
(
    echo VITE_ARIA_API_URL=http://127.0.0.1:8742
) > "%~dp0aria-desktop\.env"

:: ---------- release ports 8742 and 5173 if occupied ----------
echo [Preflight] Releasing ports 8742 and 5173 if occupied ...
for %%P in (8742 5173) do (
    for /f "tokens=5" %%A in ('netstat -ano ^| findstr ":%%P " ^| findstr "LISTENING"') do (
        taskkill /PID %%A /F >nul 2>&1
    )
)

:: ---------- backend ----------
echo [1/2] Starting Backend API on http://127.0.0.1:8742 ...
start "ARIA Backend" cmd /k ^
    "cd /d ""%~dp0aria-backend"" && ^
    if not exist .venv (echo Creating virtual environment... && python -m venv .venv) && ^
    call .venv\Scripts\activate.bat && ^
    pip install -r requirements.txt -q && ^
    echo. && ^
    echo ======================================== && ^
    echo   ARIA Backend starting on port 8742 && ^
    echo ======================================== && ^
    python main.py"

:: ---------- wait for backend to be ready ----------
echo [Preflight] Waiting for backend to be ready ...
set /a tries=0
:wait_loop
    timeout /t 1 /nobreak >nul
    curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8742/api/health 2>nul | findstr "200" >nul 2>&1
    if not errorlevel 1 goto backend_ready
    set /a tries+=1
    if !tries! geq 20 (
        echo [WARN] Backend did not respond after 20s — launching desktop anyway.
        goto backend_ready
    )
    goto wait_loop
:backend_ready

:: ---------- desktop ----------
echo [2/2] Starting ARIA Desktop App ...
start "ARIA Desktop" cmd /k ^
    "cd /d ""%~dp0aria-desktop"" && ^
    npm install --silent && ^
    echo. && ^
    echo ======================================== && ^
    echo   ARIA Desktop App starting (Electron^) && ^
    echo ======================================== && ^
    npm run dev:electron"

echo.
echo ============================================================
echo   All services launched!
echo.
echo   Backend API  : http://127.0.0.1:8742
echo   Desktop App  : Electron window via npm run dev:electron
echo.
echo   Keep the terminal windows open to view logs.
echo   Close them to stop ARIA.
echo ============================================================
echo.
pause
endlocal