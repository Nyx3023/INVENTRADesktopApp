# INVENTRA Desktop App: Complete User Manual

Welcome to the official User Manual for **INVENTRA**, a modern, offline-first Desktop Point of Sale (POS) and Inventory Management System. This manual is designed to guide both **Cashiers** and **Administrators** through the setup, operations, and maintenance of the system.

---

## Table of Contents
1. [System Installation & Setup Guide](#1-system-installation--setup-guide)
   - [Prerequisites](#prerequisites)
   - [Installing the Application](#installing-the-application)
   - [Default Login Credentials](#default-login-credentials)
2. [Getting Started](#2-getting-started)
   - [Logging In](#logging-in)
   - [User Roles & Permissions](#user-roles--permissions)
   - [Navigating the Application](#navigating-the-application)
3. [Dashboard Operations](#3-dashboard-operations)
   - [Dashboard Overview](#dashboard-overview)
   - [Low Stock Alerts](#low-stock-alerts)
   - [Sales Charts & Analytics](#sales-charts--analytics)
4. [Inventory & Stock Management](#4-inventory--stock-management)
   - [Adding a Product](#adding-a-product)
   - [Editing or Deleting a Product](#editing-or-deleting-a-product)
   - [Stock Adjustments](#stock-adjustments)
   - [Batch Management (Expiry Tracking)](#batch-management-expiry-tracking)
   - [Barcode Scanning](#barcode-scanning)
   - [Managing Suppliers](#managing-suppliers)
   - [Inventory Audit & Reconciliation](#inventory-audit--reconciliation)
5. [Point of Sale (POS) Transactions](#5-point-of-sale-pos-transactions)
   - [Processing a Sale](#processing-a-sale)
   - [Applying Discounts](#applying-discounts)
   - [Receipts & Printing](#receipts--printing)
   - [Voiding or Cancelling a Transaction](#voiding-or-cancelling-a-transaction)
6. [Sales History & Reports](#6-sales-history--reports)
   - [Viewing Sales History](#viewing-sales-history)
   - [Statistical Reports & Charts](#statistical-reports--charts)
   - [Archived Sales](#archived-sales)
7. [System Configurations (Settings)](#7-system-configurations-settings)
   - [Business Information](#business-information)
   - [Tax Rate & Configurations](#tax-rate--configurations)
   - [Low Stock Threshold](#low-stock-threshold)
   - [Receipt Footer Configuration](#receipt-footer-configuration)
   - [Language Preferences](#language-preferences)
8. [Hardware & Printer Setup](#8-hardware--printer-setup)
   - [USB Thermal Printer Configuration](#usb-thermal-printer-configuration)
   - [Printer Status Indicator](#printer-status-indicator)
   - [Paper Width Differences](#paper-width-differences)
9. [Administrator-Only Settings](#9-administrator-only-settings)
   - [User Management](#user-management)
   - [Managing Product Categories](#managing-product-categories)
   - [Backup & Restore Procedures](#backup--restore-procedures)
10. [Keyboard Shortcuts](#10-keyboard-shortcuts)
11. [Frequently Asked Questions (FAQ)](#11-frequently-asked-questions-faq)

---

## 1. System Installation & Setup Guide
This guide walks you through the simple process of installing INVENTRA on your Windows computer. Everything the system needs is already pre-packaged in the installer.

### Prerequisites
*   **Operating System**: Windows 10 or 11.

---

### Installing the Application
1. **Get the Installer**: Locate the provided INVENTRA setup file (e.g., `INVENTRA-Setup-1.0.0.exe`).
2. **Run the Setup**: Double-click the installer file to begin.
3. **Follow the Prompts**: Follow the simple on-screen instructions to install the program onto your computer.
4. **Launch**: Once installation is complete, find the **INVENTRA** icon on your Desktop and double-click it to open the application.

---

### Default Login Credentials
At your first startup, use the default administrator credentials to log in:
*   **Username**: `admin@gmail.com`
*   **Password**: `admin123`

> [!CAUTION]
> For security, log in immediately on your first launch, navigate to **Settings** → **User Management**, and change the default password.

---

## 2. Getting Started

### Logging In
1. **Launch** the INVENTRA application. You will be brought to the secure Login page.
2. **Enter your credentials** (Username and Password).
3. Click **Sign In** or press the <kbd>Enter</kbd> key.
4. The system will automatically direct you to your dashboard based on your assigned user role.

> [!TIP]
> If you have forgotten your password, ask an **Administrator** to reset it for you through the *User Management* panel in Settings.

---

### User Roles & Permissions
INVENTRA employs a role-based access control system to secure business operations:

| Role | Access Level | Description |
| :--- | :--- | :--- |
| **Admin** | **Full Access** | Can manage users, edit categories, perform backups/restores, configure system parameters, view full reports, and execute sales. |
| **Cashier** | **Operational Access** | Primarily focused on operating the POS, viewing product lists, accessing limited self-settings, and processing checkouts. |

*Look for the **🔒 Admin Only** badge throughout this manual to identify features restricted to Administrator accounts.*

---

### Navigating the Application
The main navigation bar remains at the top of the interface for seamless transition:
- **Logo / Brand**: Click this anytime to quickly return to your Dashboard.
- **Main Tabs**: Easily toggle between **DASHBOARD**, **INVENTORY**, **REPORTS**, **SALES**, and **POINT OF SALE**.
- **Right Utility Panel**: Quick links to Activity Logs, Archives (Admin), Settings, Logout, and Theme toggle (Light/Dark Mode).
- **Global Time Display**: Keeps you updated with a real-time system clock.

---

## 3. Dashboard Operations

### Dashboard Overview
The Dashboard acts as your central operational command center, displaying a high-level summary of your store's daily activity:
*   **Today's Sales**: Real-time gross revenue generated during the current calendar day.
*   **Total Transactions**: The count of successfully processed sales/invoices today.
*   **Low Stock Alerts**: Count of critical inventory items reaching restocking limits.
*   **Total Products**: Total unique SKUs/products tracked in the database.

---

### Low Stock Alerts
Any product whose current stock level is equal to or below the globally configured **Low Stock Threshold** will be automatically flagged on the Dashboard.

> [!WARNING]
> Keep an eye on low stock warnings! Perform restocking updates or manual stock adjustments immediately to prevent running out of stock during active checkout periods.

---

### Sales Charts & Analytics
The Dashboard contains dynamic charts visualizing sales trends. 
- You can filter data by **Today**, **This Week**, or **This Month**.
- Use these visual representations to quickly identify peak business hours, top performance days, and weekly growth trajectories.

---

## 4. Inventory & Stock Management

### Adding a Product
1. Go to the **Inventory** tab using the top navigation.
2. Click **Add Product** (located in the top-right corner).
3. Fill in the required details:
    *   **Product Name** (Descriptive name of the SKU).
    *   **Category** (Drop-down of configured groupings).
    *   **Barcode** (Input manually or scan).
    *   **Retail Price** (The customer checkout price).
    *   **Initial Stock** (Current physical count).
4. Optionally, upload a product image.
5. Click **Save Product** to commit.

> [!TIP]
> While creating or editing a product, focus your cursor on the **Barcode** input field and scan the item's physical barcode using your USB scanner to auto-fill the field instantly.

---

### Editing or Deleting a Product
1. Locate the product in the inventory table using the Search or Category filters.
2. Click the **Edit** (Pencil) icon on the far right of the product row.
3. Make your modifications inside the dialog box and click **Save**.
4. To delete a product, click the **Delete** (Trash) icon and confirm your decision.

> [!CAUTION]
> Deleting a product is permanent. It will instantly remove the product from active stock listings, though archived sales reports will maintain historical receipts to ensure accounting records remain correct.

---

### Stock Adjustments
For manual inventory corrections (such as updating counts after breakages, returns, or minor stock inaccuracies):
1. Navigate to **Inventory** → **Stock Adjustments** tab.
2. Select your desired product.
3. Choose the correction type: **Add** or **Deduct**.
4. Enter the adjustment quantity and specify a clear reason (e.g., "Damaged Stock", "Reconciliation").
5. Click **Apply Adjustment**.

---

### Batch Management (Expiry Tracking)
INVENTRA allows you to manage inventory using **Batches** to track individual shipments, costs, and expiration dates seamlessly.
1. Navigate to the **Inventory** → **Batches** tab (or click the "Batch Status" button).
2. From this centralized view, you can track which products are **Active**, **Near Expiry**, **Critical**, **Expired**, or **Depleted**.
3. **Adding a Batch**: Click **Add Batch** to record a new shipment, ensuring you input the correct Expiry Date and Received Date.
4. **FIFO Checkout Logic**: When processing sales at the Point of Sale (POS), the system uses *First-In, First-Out (FIFO)* logic. It will automatically deduct stock from the oldest or nearest-to-expire active batch first to minimize your inventory waste.

---

### Barcode Scanning
INVENTRA supports standard plug-and-play USB barcode scanners by treating input globally:
*   **In Point of Sale (POS)**: Scanning a barcode automatically identifies the product and appends it to the active checkout cart.
*   **In Inventory**: Scanning a barcode automatically searches and isolates the scanned SKU.
*   **In Forms/Modals**: Auto-populates any focused barcode input fields.

> [!NOTE]
> Barcode scanning is automatically suspended while you are inside the **Settings** menu to avoid accidental barcode scans modifying system values.

---

### Managing Suppliers
1. Navigate to **Inventory** → **Suppliers** tab.
2. Click **Add Supplier**.
3. Supply the name of the supplier, key contact person, telephone number, email, and address.
4. Click **Save** to create the record.

---

### Inventory Audit & Reconciliation
Perform periodic stocktaking to reconcile real-world numbers with digital databases:
1. Navigate to **Inventory** → **Audit**.
2. Go through your listed stock and input the actual physical count for each product.
3. The system will automatically calculate the **Variance** (digital stock vs. physical stock).
4. Review the differences, provide justification notes, and click **Submit Audit** to adjust the database.

> [!WARNING]
> Submitting an audit overwrites the system's recorded stock counts. Make sure your physical count is highly accurate before clicking submit.

---

## 5. Point of Sale (POS) Transactions

### Processing a Sale
1. Go to the **Point of Sale** tab (or press <kbd>F2</kbd>).
2. Scan product barcodes or use the search box to locate items and add them to the cart.
3. Adjust quantities by typing inside the quantity column or clicking the increment tools.
4. Click the prominent **Charge** button.
5. In the checkout modal, enter the exact payment amount received from the customer.
6. The system calculates the change due. Click **Complete Sale**.
7. The thermal printer prints the receipt, and the cart is reset for the next customer.

---

### Applying Discounts
*   **Item-Level Discount**: Click the discount tag on an individual cart row to deduct a fixed amount or a percentage from that specific product.
*   **Order-Level Discount**: Input a total discount percentage or fixed cash value at the bottom of the checkout pane to apply it across the entire transaction.

---

### Receipts & Printing
If an ESC/POS compatible thermal printer is connected and active:
*   An itemized receipt is generated containing: Business Name, Tagline, Date/Time, Cart Breakdown, Total Discounts, Taxes, and Custom Footer.
*   Receipt templates automatically adapt to **58mm** or **80mm** paper sizing.
*   Receipts can be reprinted at any point by pulling up the transaction in **Sales History**.

---

### Voiding or Cancelling a Transaction
*   **Before completion**: Click the **Clear Cart** button to immediately purge the active session.
*   **After completion**: Go to the **Sales History** panel, locate the transaction reference, and click **Void**. 

> [!IMPORTANT]
> Voiding a completed transaction returns the sold products back into your active inventory stock automatically to maintain accurate ledger books.

---

## 6. Sales History & Reports

### Viewing Sales History
Access a chronological ledger of all store invoices:
1. Click **Sales** on the navigation bar.
2. Select any invoice to inspect individual line-item purchases, taxes charged, and payment details.
3. Use the search parameters or the Date Range pickers to narrow down long records.

---

### Statistical Reports & Charts
For a comprehensive breakdown of store performance, navigate to the **Reports** section:
*   **Revenue by Period**: Compares sales across daily, weekly, or monthly timelines.
*   **Top Products**: Identifies top performers by item quantity sold and total revenue contribution.
*   **Category Performance**: Highlights which stock categories represent your largest revenue drivers.
*   **Sales by Cashier**: Logs employee operational sales performance.

---

### Archived Sales
Older sales data can be "Archived" to keep the active database speedy and clean. Archived logs remain searchable and accessible to **Administrators** via the dedicated Archive icon in the top header.

---

## 7. System Configurations (Settings)

### Business Information
You can configure details shown on customer-facing receipts:
1. Open **Settings** (or press <kbd>Alt</kbd> + <kbd>S</kbd>) → **General**.
2. Click the **Edit** (Pencil) icon on the Business card.
3. Edit the Business Name, Tagline, Phone, Email, and Address.
4. Upload a company logo (Max size: 2MB).
5. Click **Save** to commit.

---

### Tax Rate & Configurations
*(🔒 Admin Only)*
To adjust tax calculations:
1. Open **Settings** → **General**.
2. Enter the applicable percentage (e.g., `12` for 12% Value Added Tax).
3. If your prices already include tax, the calculation adjusts accordingly during checkout.
4. Set this field to `0` if you do not collect tax.

---

### Low Stock Threshold
1. Open **Settings** → **General**.
2. Set the threshold number (Default: `10`).
3. Products fall into low stock classification once they hit this value.

---

### Receipt Footer Configuration
Customize the message appearing at the base of printouts:
1. Open **Settings** → **General**.
2. Type your message (e.g., *"Thank you for your business! Items may be returned within 7 days with a valid receipt."*).
3. Click **Save**.

---

### Language Preferences
INVENTRA fully supports localization. Toggle the **Language** setting dropdown between **English** and **Filipino (Tagalog)** to immediately update the interface language.

---

## 8. Hardware & Printer Setup

### USB Thermal Printer Configuration
1. Securely connect your thermal receipt printer via USB and power it on.
2. Navigate to **Settings** → **Printer**.
3. Select your detected USB printer from the hardware listing dropdown.
4. Specify the paper size (**58mm** or **80mm**).
5. Click **Test Print** to confirm the connection.
6. Toggle **Auto Print Receipt** to the ON position if you want the system to print receipts automatically at checkout.

---

### Printer Status Indicator
The top header provides an immediate status icon:
*   🟢 **Green**: Connected. The printer is online and ready to receive jobs.
*   🔴 **Red**: Offline. Check cable seating, power switches, or USB driver options.

---

### Paper Width Differences

| Sizing | Common Sizing Application | Notes |
| :--- | :--- | :--- |
| **58mm** | Compact/Mobile thermal printers. | Smaller margins, highly economical. |
| **80mm** | Standard commercial heavy-duty POS printers. | Wider margin layout, perfect for longer itemized tables. |

---

## 9. Administrator-Only Settings

### User Management
*(🔒 Admin Only)*
Control who can log in to INVENTRA and their access scope:
1. Navigate to **Settings** → **User Management**.
2. To add a user: Click **Add User**, supply a name, unique username, strong password, and select either the **Admin** or **Cashier** role. Click **Save**.
3. To modify or delete: Click **Edit** or **Delete** next to their row in the user ledger.

> [!CAUTION]
> The system requires at least one active **Admin** account at all times. You cannot delete your own active account while logged in.

---

### Managing Product Categories
*(🔒 Admin Only)*
Categories organize inventory and filter choices in the POS:
1. Open **Settings** → **Categories**.
2. Input the category title and description, then click **Add Category**.
3. Click **Remove** to delete a category. Any product previously assigned to it will revert to *"Uncategorized"* automatically.

---

### Backup & Restore Procedures
*(🔒 Admin Only)*
Protect your store databases from data loss:
1. Open **Settings** → **Backup & Restore**.
2. **To Back Up**: Click **Create Backup** and select a folder directory (external flash drives or cloud storage are recommended). The database is saved as a secure `.db` file.
3. **To Restore**: Click **Restore Backup**, browse to your `.db` file, and confirm. 

> [!WARNING]
> Restoring a backup completely overwrites current live transactions and product counts. Ensure you create a fresh backup of your current database before attempting a restore.

---

## 10. Keyboard Shortcuts

Boost your checkout speed with native hotkeys:

| Key Binding | Action / Description |
| :--- | :--- |
| <kbd>F1</kbd> | Navigate to **Dashboard** |
| <kbd>F2</kbd> | Navigate to **Point of Sale (POS)** |
| <kbd>F3</kbd> | Navigate to **Inventory** |
| <kbd>F4</kbd> | Navigate to **Sales History** |
| <kbd>F6</kbd> | Navigate to **Activity Logs** *(🔒 Admin Only)* |
| <kbd>Alt</kbd> + <kbd>S</kbd> | Open **Settings** |
| <kbd>Alt</kbd> + <kbd>L</kbd> | **Logout** |
| <kbd>Alt</kbd> + <kbd>T</kbd> | **Toggle Theme** (Light / Dark Mode) |
| <kbd>Escape</kbd> | Close active modal, cancel transaction steps, or clear fields |

---

## 11. Frequently Asked Questions (FAQ)

#### I cannot log in — what should I do?
1. Ensure your keyboard's **Caps Lock** is toggled off.
2. Usernames are case-sensitive; check spelling carefully.
3. Ask your store Administrator to verify your account or reset your password in **Settings** → **User Management**.

#### The Low Stock Filter shows products that have plenty of stock.
This happens if your **Low Stock Threshold** is set too high. Open **Settings** → **General** and lower the threshold number to represent your actual reorder minimums.

#### The printer is connected, but not printing.
1. Inspect the physical USB connection on the printer and PC.
2. Ensure the printer is powered on and paper is correctly fed (thermal side facing the print head).
3. Open **Settings** → **Printer** and run a **Test Print**.
4. Confirm you have selected the matching printer port/name in the settings page.
5. Unplug the USB cable, plug it back in, and reload the settings tab to refresh the connection list.

#### The barcode scanner isn't adding items in POS.
1. Check that the scanned product's barcode matches the code recorded in the **Inventory** profile.
2. Confirm the scanner emitted a successful read beep.
3. Search the inventory manually to ensure the item has active stock (the POS will reject items with 0 stock).
4. Close the **Settings** panel if open, as scanning is paused there to prevent setting errors.

#### A sale I just processed isn't showing in Reports.
1. Check the date filter in the **Reports** section — make sure it includes today's date.
2. Ensure the sale was fully closed and processed, not just sitting in an open cart.
3. Check the **Sales History** tab to confirm the transaction is saved in the local database.
