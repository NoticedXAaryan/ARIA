@echo off
title ARIA - Start All Services
echo Starting ARIA (Anticipatory Reasoning ^& Intelligent Assistance)...
echo ==================================================================

echo.
echo 1. Starting Backend Server...
start "ARIA Backend" cmd /k "if not exist .venv (python -m venv .venv) && .venv\Scripts\activate && pip install -r aria-backend\requirements.txt && if not exist .env (copy .env.example .env) && python aria-backend\main.py"

echo.
echo 2. Starting Desktop UI (React/Vite)...
start "ARIA Desktop Vite" cmd /k "cd aria-desktop && npm install && npm run dev"

echo.
echo 3. Starting Desktop Electron Shell...
start "ARIA Desktop Electron" cmd /k "cd aria-desktop && npm install && npm run electron"

echo.
echo 4. Starting Mobile Companion (Expo)...
start "ARIA Mobile Expo" cmd /k "cd aria-mobile && npm install && npx expo start"

echo.
echo All ARIA components have been launched in separate terminal windows!
echo Keep the terminal windows open to view logs.
echo ==================================================================
pause
