@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Ask the Author - Starting Dev Server
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH. Please install Node.js first.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

if not exist ".env.local" if exist ".env.example" (
    echo [INFO] .env.local not found. Frontend preview will run without API keys.
    echo        Copy .env.example to .env.local when ready to connect Supabase and Claude.
    echo.
)

echo Starting Next.js dev server at http://localhost:3000
echo Press Ctrl+C to stop.
echo.

call npm run dev
if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start the dev server.
    pause
    exit /b 1
)
