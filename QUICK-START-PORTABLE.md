# Quick Start Guide - Portable Edition

## Step 1: Install Dependencies

```bash
npm install
```

This will install all required packages including `better-sqlite3` for SQLite support.

## Step 2: Start the Application

**Option A: Using the batch file (Windows)**
```bash
START-Portable.bat
```

**Option B: Using npm**
```bash
npm start
```

**Option C: Direct Node.js**
```bash
node server/index.js
```

## Step 3: Access the Application

1. Wait for the message: "Server is running on port 3001"
2. Open your browser
3. Navigate to: **http://localhost:3001**

## Step 4: Login

- **Email**: admin@gmail.com
- **Password**: admin123

⚠️ **Important**: Change the default password after first login!

## What's Different?

### Before (MySQL/XAMPP):
- Required XAMPP or MySQL server
- Had to start MySQL service manually
- Database stored externally
- More complex setup

### Now (SQLite):
- ✅ No external database server needed
- ✅ Database stored in `data/pos_inventory.db`
- ✅ Completely portable
- ✅ Simple one-click startup

## Database Location

The SQLite database is automatically created in:
- `data/pos_inventory.db` (portable mode)

## Testing

Run the test script to verify everything works:
```bash
TEST-Portable.bat
```

## Building Installer

To create an installer for distribution:

1. Install Inno Setup: https://jrsoftware.org/isinfo.php
2. Run:
   ```bash
   npm run build:installer
   ```
3. Find installer in: `dist/ThesisPOS-Setup-1.0.0.exe`

## Troubleshooting

**Port 3001 already in use:**
- Change PORT in `.env` file
- Or close the application using that port

**Database errors:**
- Delete `data/pos_inventory.db` to reset
- Restart the application

**Node.js not found:**
- Install Node.js from https://nodejs.org
- Restart your computer after installation

## Next Steps

Once you've verified the portable app works correctly, you can proceed with:
1. Testing all features
2. Building the installer
3. Converting to Electron (Step 3)
