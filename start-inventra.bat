@echo off
cd /d "%~dp0"
title INVENTRA - Inventory Management System
echo ========================================
echo   INVENTRA - Inventory Management
echo   JBO Arts ^& Crafts Trading
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

REM Check if node_modules exists
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
    echo Dependencies found.
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

REM Start the server in background
echo Starting INVENTRA server...
echo.
echo Server will be available at: http://localhost:3001
echo.

start /B node server/index.js

REM Wait for server to start
echo Waiting for server to start...
timeout /t 3 /nobreak >nul

REM Open browser automatically
echo Opening browser...
start http://localhost:3001

echo.
echo ========================================
echo   INVENTRA is running!
echo   Browser should open automatically.
echo   If not, go to: http://localhost:3001
echo.
echo   Press Ctrl+C or close this window
echo   to stop the server.
echo ========================================
echo.

REM Keep window open
cmd /k
