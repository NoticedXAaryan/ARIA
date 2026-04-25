@echo off
title ARIA - Start All Services
color 0A
echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   ARIA - Anticipatory Reasoning ^& Intelligent Assistance  ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.

:: ─── 1. Backend (Python FastAPI) ─────────────────────────────
echo  [1/2] Starting Backend API on http://127.0.0.1:8742 ...
start "ARIA Backend" cmd /k "cd /d "%~dp0aria-backend" && (if not exist .venv (echo Creating virtual environment... && python -m venv .venv)) && call .venv\Scripts\activate.bat && pip install -r requirements.txt -q && echo. && echo ======================================== && echo   ARIA Backend starting on port 8742 && echo ======================================== && python main.py"

:: Wait a few seconds for backend to start before launching frontend
timeout /t 4 /nobreak >nul

:: ─── 2. Desktop UI (Vite Dev Server) ─────────────────────────
echo  [2/2] Starting Desktop UI on http://localhost:5173 ...
start "ARIA Desktop" cmd /k "cd /d "%~dp0aria-desktop" && npm install --silent && echo. && echo ======================================== && echo   ARIA Desktop UI starting on port 5173 && echo ======================================== && npm run dev"

:: Wait for Vite to boot, then open in browser
timeout /t 5 /nobreak >nul
start http://localhost:5173

echo.
echo  ╔══════════════════════════════════════════════════════════╗
echo  ║   All services launched!                                   ║
echo  ║                                                            ║
echo  ║   Backend API  : http://127.0.0.1:8742                    ║
echo  ║   Desktop UI   : http://localhost:5173                     ║
echo  ║                                                            ║
echo  ║   Keep the terminal windows open to view logs.             ║
echo  ║   Close them to stop ARIA.                                 ║
echo  ╚══════════════════════════════════════════════════════════╝
echo.
pause
