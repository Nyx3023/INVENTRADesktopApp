# ThesisPOS - Portable Edition

## Overview

This is a portable version of ThesisPOS that uses SQLite instead of MySQL/XAMPP, making it completely self-contained and portable.

## System Requirements

- **Node.js 18 or higher** (Download: https://nodejs.org)
- Windows 10/11

**No MySQL/XAMPP required!** The database is now SQLite-based and stored locally.

## Quick Start

1. **Install Node.js** (if not already installed)
   - Download from: https://nodejs.org
   - Choose LTS version (recommended)
   - Restart computer after installation

2. **Start the Application**
   - Double-click `START-Portable.bat`
   - Wait for "Server is running" message
   - Open browser: http://localhost:3001

## Default Login

- **Username**: admin@gmail.com
- **Password**: admin123

⚠️ **Change default password after first login!**

## Features

✅ Completely portable - no external database server needed
✅ SQLite database stored in `data/pos_inventory.db`
✅ All data is stored locally
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

## Database Location

The SQLite database is stored in:
- `data/pos_inventory.db` (portable mode)
- `pos_inventory.db` (root directory, if data folder doesn't exist)

## Backup

To backup your data, simply copy the `data/pos_inventory.db` file.

## Troubleshooting

**Server won't start:**
- Check if port 3001 is already in use
- Verify Node.js is installed correctly
- Check console for error messages

**Database errors:**
- Delete `data/pos_inventory.db` to reset the database
- Restart the application

**Port already in use:**
- Change the PORT in `.env` file or server/index.js
- Or close the application using port 3001

## Building Installer

To create an installer using Inno Setup:
1. Install Inno Setup from https://jrsoftware.org/isinfo.php
2. Run the build script or use the provided `.iss` file
3. The installer will be generated in the `dist` folder
