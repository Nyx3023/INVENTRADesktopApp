@echo off
echo ========================================
echo   ThesisPOS - Portable Edition
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo.

REM Database will be initialized automatically by the server on first run

REM Check if node_modules exists (for offline installation)
if not exist "node_modules" (
    echo WARNING: node_modules not found. Attempting to install dependencies...
    echo This requires an internet connection.
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install dependencies
        echo Please ensure you have an internet connection or reinstall the application.
        pause
        exit /b 1
    )
    echo Dependencies installed successfully.
    echo.
) else (
    echo Dependencies found - offline mode ready.
    echo.
)

REM Build frontend if dist doesn't exist
if not exist "dist" (
    echo Building frontend...
    call npm run build
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to build frontend
        pause
        exit /b 1
    )
    echo Frontend built successfully.
    echo.
)

REM Start the server
echo Starting ThesisPOS server...
echo Server will be available at: http://localhost:3001
echo Press Ctrl+C to stop the server
echo.

REM Open browser after a short delay (3 seconds for server to start)
start "" /b cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:3001"

REM Start the server (foreground so Ctrl+C works)
node server/index.js

pause
