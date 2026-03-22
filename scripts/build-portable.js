/**
 * Build Portable Executable Package
 * Creates a complete portable application bundle
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'ThesisPOS-Portable');

console.log('🚀 Building Portable ThesisPOS Application...\n');

// Step 1: Clean previous build
console.log('📦 Step 1: Cleaning previous build...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// Step 2: Build frontend
console.log('🎨 Step 2: Building frontend (this may take a minute)...');
try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
} catch (error) {
  console.error('❌ Frontend build failed:', error.message);
  process.exit(1);
}

// Step 3: Copy server files and node_modules
console.log('📦 Step 3: Copying server files...');

// Copy server folder
if (fs.existsSync(path.join(rootDir, 'server'))) {
  fs.cpSync(path.join(rootDir, 'server'), path.join(distDir, 'server'), { recursive: true });
}

// Copy package.json
fs.copyFileSync(path.join(rootDir, 'package.json'), path.join(distDir, 'package.json'));

// Copy package-lock.json if exists
if (fs.existsSync(path.join(rootDir, 'package-lock.json'))) {
  fs.copyFileSync(path.join(rootDir, 'package-lock.json'), path.join(distDir, 'package-lock.json'));
}

// Step 4: Copy necessary files
console.log('📁 Step 4: Copying required files...');

// Copy dist folder (built frontend)
if (fs.existsSync(path.join(rootDir, 'dist'))) {
  fs.cpSync(path.join(rootDir, 'dist'), path.join(distDir, 'dist'), { recursive: true });
}

// Copy database folder
if (fs.existsSync(path.join(rootDir, 'database'))) {
  fs.cpSync(path.join(rootDir, 'database'), path.join(distDir, 'database'), { recursive: true });
}

// Create uploads folder
fs.mkdirSync(path.join(distDir, 'uploads'), { recursive: true });

// Create .env template
fs.writeFileSync(path.join(distDir, '.env'), `# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=pos_inventory
DB_PORT=3306

# Server Configuration
PORT=3000
NODE_ENV=production

# Session Secret (change this!)
SESSION_SECRET=your-super-secret-key-change-this

# File Upload
MAX_FILE_SIZE=5242880
`);

// Step 5: Install production dependencies
console.log('📦 Step 5: Installing dependencies (this may take a few minutes)...');
try {
  execSync('npm install --omit=dev --legacy-peer-deps', {
    cwd: distDir,
    stdio: 'inherit'
  });
} catch (error) {
  console.log('⚠️  Some dependencies may have warnings, but installation should continue...');
}

// Step 6: Create launcher batch file
console.log('🔧 Step 6: Creating launcher...');
const launcherBat = `@echo off
title ThesisPOS - Inventory Management System
echo.
echo =========================================
echo   ThesisPOS - Inventory Management
echo =========================================
echo.

REM Check if .env exists
if not exist ".env" (
    echo Warning: .env file not found! Using defaults.
    echo Please configure database settings in .env
    echo.
)

REM Check if node is available
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo Server starting...
echo.
echo ✓ Opening browser automatically...
echo ✓ Access at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the application in background and wait a moment
start /B node server/index.js

REM Wait 3 seconds for server to start
timeout /t 3 /nobreak >nul

REM Open browser
start http://localhost:3000

REM Keep window open to show server logs
echo.
echo ========================================
echo   Server is running!
echo   Close this window to stop the server
echo ========================================
echo.

REM Wait for Ctrl+C
pause >nul
`;

fs.writeFileSync(path.join(distDir, 'START-ThesisPOS.bat'), launcherBat);

// Step 7: Create README
console.log('📝 Step 7: Creating README...');
const readme = `# ThesisPOS - Portable Edition

## System Requirements

- **Node.js 18 or higher** (Download: https://nodejs.org)
- **MySQL/MariaDB** or **XAMPP** (Download: https://www.apachefriends.org)
- Windows 10/11

## Quick Start

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org
   - Choose LTS version (recommended)
   - Restart computer after installation

2. **Install MySQL/MariaDB**
   - Option A: Install XAMPP (easier): https://www.apachefriends.org/
   - Option B: Install MySQL: https://dev.mysql.com/downloads/installer/

3. **Setup Database**
   - Start MySQL (or start XAMPP MySQL from Control Panel)
   - Run \`SETUP-DATABASE.bat\` for automatic setup
   - OR manually: Import \`database/pos_inventory_full.sql\` via phpMyAdmin

4. **Configure Application**
   - Edit \`.env\` file with your database credentials
   - (Default settings work with XAMPP - no password needed)

5. **Start Application**
   - Double-click \`START-ThesisPOS.bat\`
   - Wait for "Server is running" message
   - Open browser: http://localhost:3000

## Default Login

- **Username**: admin
- **Password**: admin123

⚠️ **Change default password after first login!**

## Features

✅ Inventory Management with Smart Reorder Suggestions
✅ Point of Sale (POS) System
✅ Purchase Order Management
✅ Supplier Management with Social Links
✅ Stock Adjustments & Movement Tracking
✅ Activity Logs & Audit Trail
✅ Bluetooth Thermal Printer Support
✅ Statistical Reports & Analytics
✅ User Management & Roles
✅ Barcode Support
✅ Dark Mode

## Printer Setup

### USB/Network Thermal Printer
1. Install printer drivers
2. Set as Windows default printer
3. Configure in Settings > Printer

### Bluetooth Thermal Printer
1. Pair printer with Windows Bluetooth
2. Open Settings > Printer
3. Click "Connect Bluetooth Printer"
4. Select your printer from the list

## Troubleshooting

**Server won't start:**
- Check if port 3000 is already in use
- Verify database is running
- Check \`.env\` configuration

**Can't connect to database:**
- Verify MySQL/MariaDB is running
- Check credentials in \`.env\`
- Ensure database \`pos_inventory\` exists

**Printer not working:**
- Check printer is powered on
- Verify drivers are installed
- Try test print in Settings

## Support

For issues or questions, refer to the documentation or contact support.

## Version

v1.0.0 - Portable Edition

---
**Powered by ThesisPOS** | Arts & Crafts Inventory Management System
`;

fs.writeFileSync(path.join(distDir, 'README.txt'), readme);

// Step 8: Create database setup script
console.log('🗄️  Step 8: Creating database setup script...');
const dbSetup = `@echo off
echo =========================================
echo   Database Setup Helper
echo =========================================
echo.
echo This script will help you import the database.
echo.
echo Make sure MySQL/MariaDB (XAMPP) is running!
echo.
pause

REM Try to find MySQL executable
set MYSQL_PATH=mysql
if exist "C:\\xampp\\mysql\\bin\\mysql.exe" set MYSQL_PATH=C:\\xampp\\mysql\\bin\\mysql.exe
if exist "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe" set MYSQL_PATH="C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe"
if exist "C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysql.exe" set MYSQL_PATH="C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysql.exe"

echo Using MySQL at: %MYSQL_PATH%
echo.

set /p dbhost="Enter MySQL host (default: localhost): "
if "%dbhost%"=="" set dbhost=localhost

set /p dbuser="Enter MySQL username (default: root): "
if "%dbuser%"=="" set dbuser=root

set /p dbpass="Enter MySQL password (leave empty for no password): "

echo.
echo Creating database and importing...
echo.

if "%dbpass%"=="" (
    %MYSQL_PATH% -h %dbhost% -u %dbuser% -e "CREATE DATABASE IF NOT EXISTS pos_inventory;"
    %MYSQL_PATH% -h %dbhost% -u %dbuser% pos_inventory < database\\pos_inventory_full.sql
) else (
    %MYSQL_PATH% -h %dbhost% -u %dbuser% -p%dbpass% -e "CREATE DATABASE IF NOT EXISTS pos_inventory;"
    %MYSQL_PATH% -h %dbhost% -u %dbuser% -p%dbpass% pos_inventory < database\\pos_inventory_full.sql
)

if %errorlevel% == 0 (
    echo.
    echo ✓ Database setup complete!
    echo.
) else (
    echo.
    echo ✗ Database setup failed!
    echo   Please check your MySQL credentials and try again.
    echo.
)

pause
`;

fs.writeFileSync(path.join(distDir, 'SETUP-DATABASE.bat'), dbSetup);

console.log('\n✅ Build complete!\n');
console.log('📦 Portable package created at:', distDir);
console.log('\n📋 Next steps:');
console.log('   1. Navigate to:', distDir);
console.log('   2. Run SETUP-DATABASE.bat (first time only)');
console.log('   3. Edit .env with your database credentials');
console.log('   4. Run START-ThesisPOS.bat');
console.log('\n🎉 Your portable application is ready to deploy!');
