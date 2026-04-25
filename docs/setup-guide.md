# Setup Guide

## Backend

1. `python -m venv .venv`
2. `.venv\Scripts\activate`
3. `pip install -r aria-backend/requirements.txt`
4. Copy `.env.example` to `.env` and fill values
5. `python aria-backend/main.py`

## Desktop (Electron)

1. `cd aria-desktop`
2. `npm install`
3. `npm run dev`

## Mobile (Expo)

1. `cd aria-mobile`
2. `npm install`
3. `npx expo start`
