@echo off
echo ========================================
echo   ThesisPOS - Portable Edition Test
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found
    pause
    exit /b 1
)

echo [1/4] Checking Node.js...
node --version
echo.

echo [2/4] Installing dependencies...
if not exist "node_modules" (
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: npm install failed
        pause
        exit /b 1
    )
) else (
    echo Dependencies already installed.
)
echo.

echo [3/4] Initializing database...
node -e "import('./database/sqlite-schema.js').then(m => m.initializeDatabase()).then(() => console.log('Database OK')).catch(e => {console.error('ERROR:', e.message); process.exit(1);})"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Database initialization failed
    pause
    exit /b 1
)
echo.

echo [4/4] Testing server startup...
timeout /t 2 /nobreak >nul
start /B node server/index.js
timeout /t 3 /nobreak >nul

REM Test if server is responding
curl -s http://localhost:3001/api/products >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   SUCCESS! Server is running
    echo ========================================
    echo.
    echo Open your browser and go to:
    echo http://localhost:3001
    echo.
    echo Default login:
    echo Email: admin@gmail.com
    echo Password: admin123
    echo.
    echo Press any key to stop the server...
    pause >nul
    taskkill /F /IM node.exe >nul 2>&1
) else (
    echo.
    echo WARNING: Server may not be responding correctly
    echo Check the console output above for errors
    echo.
    pause
)
