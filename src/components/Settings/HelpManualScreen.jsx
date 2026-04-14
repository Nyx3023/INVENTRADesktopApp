import { useState, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  HomeIcon,
  CubeIcon,
  CalculatorIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  PrinterIcon,
  UserIcon,
  Squares2X2Icon,
  CircleStackIcon,
  QuestionMarkCircleIcon,
  LockClosedIcon,
  LightBulbIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  BookOpenIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';

// ─── Data ─────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'getting-started',
    label: 'Getting Started',
    icon: BookOpenIcon,
    adminOnly: false,
    topics: [
      {
        id: 'gs-login',
        title: 'Logging In',
        content: [
          {
            type: 'steps',
            items: [
              'Launch the INVENTRA app. You will be brought to the Login page.',
              'Enter your assigned username and password.',
              'Click <strong>Sign In</strong> or press <kbd>Enter</kbd>.',
              'You will be redirected to the Dashboard based on your role.',
            ],
          },
          {
            type: 'tip',
            text: 'If you forgot your password, ask an Admin user to reset your account from the User Management section.',
          },
        ],
      },
      {
        id: 'gs-roles',
        title: 'User Roles',
        content: [
          {
            type: 'paragraph',
            text: 'INVENTRA has two roles, each with different levels of access:',
          },
          {
            type: 'table',
            headers: ['Role', 'Access Level'],
            rows: [
              ['Admin', 'Full access — can manage users, categories, backup data, view all reports, and configure all settings.'],
              ['Cashier', 'Operational access — can process sales, view inventory, view sales history, and access limited settings.'],
            ],
          },
          {
            type: 'tip',
            text: 'Sections labeled with a 🔒 Admin Only badge in this manual are restricted to Admin accounts.',
          },
        ],
      },
      {
        id: 'gs-navigation',
        title: 'Navigating the App',
        content: [
          {
            type: 'paragraph',
            text: 'The main navigation bar is at the top of every screen. It contains:',
          },
          {
            type: 'list',
            items: [
              '<strong>Logo</strong> — click to return to the Dashboard.',
              '<strong>Navigation tabs</strong> — DASHBOARD, INVENTORY, REPORTS, SALES, POINT OF SALE.',
              '<strong>Right-side icons</strong> — Activity Logs, Archives (admin), Settings, Logout, and Theme toggle.',
              '<strong>Clock</strong> — displays current date and time.',
            ],
          },
          {
            type: 'tip',
            text: 'Most screens can be accessed instantly using keyboard shortcuts. See the Keyboard Shortcuts section for a full list.',
          },
        ],
      },
    ],
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: HomeIcon,
    adminOnly: false,
    topics: [
      {
        id: 'db-overview',
        title: 'Dashboard Overview',
        content: [
          {
            type: 'paragraph',
            text: 'The Dashboard is your home screen and shows a real-time snapshot of your store\'s performance.',
          },
          {
            type: 'list',
            items: [
              '<strong>Today\'s Sales</strong> — total revenue generated today.',
              '<strong>Total Transactions</strong> — number of completed sales today.',
              '<strong>Low Stock Alerts</strong> — products below the configured threshold.',
              '<strong>Total Products</strong> — total number of products in your inventory.',
            ],
          },
        ],
      },
      {
        id: 'db-alerts',
        title: 'Low Stock Alerts',
        content: [
          {
            type: 'paragraph',
            text: 'Products with stock at or below your Low Stock Threshold will appear highlighted. You can configure the threshold in Settings → General.',
          },
          {
            type: 'warning',
            text: 'If a product shows as low stock, make sure to restock it or create a Purchase Order before it runs out.',
          },
        ],
      },
      {
        id: 'db-charts',
        title: 'Sales Charts',
        content: [
          {
            type: 'paragraph',
            text: 'Charts on the Dashboard visualize sales trends over a selected time range (Today, This Week, This Month). Use these to identify peak hours, best-selling days, and growth trends.',
          },
        ],
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: CubeIcon,
    adminOnly: false,
    topics: [
      {
        id: 'inv-add',
        title: 'Adding a Product',
        content: [
          {
            type: 'steps',
            items: [
              'Go to <strong>Inventory</strong> from the top navigation.',
              'Click the <strong>Add Product</strong> button (top right).',
              'Fill in: Product Name, Category, Barcode, Price (retail), Cost Price, and Stock quantity.',
              'Optionally upload a product image.',
              'Click <strong>Save Product</strong>.',
            ],
          },
          {
            type: 'tip',
            text: 'If the product has a barcode, scan it with the barcode scanner while the Barcode field is focused — it will auto-fill.',
          },
        ],
      },
      {
        id: 'inv-edit',
        title: 'Editing / Deleting a Product',
        content: [
          {
            type: 'steps',
            items: [
              'Find the product using the search bar or filter by category.',
              'Click the <strong>Edit</strong> (pencil) icon on the product row.',
              'Make your changes in the modal and click <strong>Save</strong>.',
              'To delete, click the <strong>Delete</strong> (trash) icon and confirm.',
            ],
          },
          {
            type: 'warning',
            text: 'Deleting a product is permanent and cannot be undone. It will also remove the product from all unarchived sales.',
          },
        ],
      },
      {
        id: 'inv-stock',
        title: 'Stock Adjustments',
        content: [
          {
            type: 'paragraph',
            text: 'Use Stock Adjustments to correct inventory levels without making a sale. Access it from the Inventory page via the <strong>Stock Adjustments</strong> tab.',
          },
          {
            type: 'steps',
            items: [
              'Navigate to Inventory → <strong>Stock Adjustments</strong> tab.',
              'Select the product you want to adjust.',
              'Choose the adjustment type: <em>Add</em> or <em>Deduct</em>.',
              'Enter the quantity and a reason.',
              'Click <strong>Apply Adjustment</strong>.',
            ],
          },
        ],
      },
      {
        id: 'inv-barcode',
        title: 'Barcode Scanning',
        content: [
          {
            type: 'paragraph',
            text: 'INVENTRA supports USB barcode scanners. Scanning works globally — you can scan a barcode anywhere in the app and the system will try to find and act on the matching product.',
          },
          {
            type: 'list',
            items: [
              'In <strong>POS</strong>: scanning a barcode will add the product to the cart.',
              'In <strong>Inventory</strong>: scanning will search and highlight the product.',
              'In <strong>Add/Edit Product modal</strong>: scanning fills the barcode field.',
            ],
          },
          {
            type: 'tip',
            text: 'Barcode scanning is automatically paused when the Settings page is open to prevent accidental input.',
          },
        ],
      },
      {
        id: 'inv-suppliers',
        title: 'Suppliers',
        content: [
          {
            type: 'paragraph',
            text: 'Manage your product suppliers from the <strong>Suppliers</strong> tab inside Inventory.',
          },
          {
            type: 'steps',
            items: [
              'Go to Inventory → <strong>Suppliers</strong> tab.',
              'Click <strong>Add Supplier</strong>.',
              'Enter the supplier name, contact person, phone, email, and address.',
              'Click <strong>Save</strong>.',
            ],
          },
        ],
      },
      {
        id: 'inv-po',
        title: 'Purchase Orders',
        content: [
          {
            type: 'paragraph',
            text: 'Purchase Orders let you record incoming stock from suppliers before updating inventory levels.',
          },
          {
            type: 'steps',
            items: [
              'Go to Inventory → <strong>Purchase Orders</strong> tab.',
              'Click <strong>New Purchase Order</strong>.',
              'Select a supplier and add the products and quantities being ordered.',
              'Set the order date and any notes.',
              'Click <strong>Save</strong>. When stock arrives, mark the order as <em>Received</em> to automatically update inventory.',
            ],
          },
        ],
      },
      {
        id: 'inv-audit',
        title: 'Inventory Audit',
        content: [
          {
            type: 'paragraph',
            text: 'Audits let you physically count all inventory and reconcile differences with the system\'s recorded quantities.',
          },
          {
            type: 'steps',
            items: [
              'Go to Inventory → <strong>Audit</strong> or click the Audit button.',
              'For each product, enter the actual physical count.',
              'The system will show the variance (difference) for each item.',
              'Review variances and click <strong>Submit Audit</strong> to apply corrections.',
            ],
          },
          {
            type: 'warning',
            text: 'Submitting an audit will overwrite current stock quantities for all items included. This action cannot be undone.',
          },
        ],
      },
    ],
  },
  {
    id: 'pos',
    label: 'Point of Sale',
    icon: CalculatorIcon,
    adminOnly: false,
    topics: [
      {
        id: 'pos-sale',
        title: 'Processing a Sale',
        content: [
          {
            type: 'steps',
            items: [
              'Navigate to <strong>Point of Sale</strong> (or press <kbd>F2</kbd>).',
              'Add products to the cart by scanning their barcode or searching manually.',
              'Adjust quantities in the cart if needed.',
              'Click <strong>Charge</strong> to proceed to payment.',
              'Enter the payment amount and click <strong>Complete Sale</strong>.',
              'A receipt will be generated automatically.',
            ],
          },
          {
            type: 'tip',
            text: 'You can apply discounts per item or on the whole order from the cart panel.',
          },
        ],
      },
      {
        id: 'pos-discount',
        title: 'Applying Discounts',
        content: [
          {
            type: 'paragraph',
            text: 'Discounts can be applied at two levels:',
          },
          {
            type: 'list',
            items: [
              '<strong>Item-level discount</strong> — click the discount icon on a cart item and enter a percentage or fixed amount.',
              '<strong>Order-level discount</strong> — use the overall discount field at the bottom of the cart.',
            ],
          },
        ],
      },
      {
        id: 'pos-receipt',
        title: 'Receipts & Printing',
        content: [
          {
            type: 'paragraph',
            text: 'After completing a sale, INVENTRA will automatically attempt to print a receipt if a USB thermal printer is configured.',
          },
          {
            type: 'list',
            items: [
              'Receipts include: store name, transaction date, itemized products, subtotal, tax, discount, and total.',
              'The receipt footer message is configurable in Settings → General.',
              'You can reprint a receipt from the Sales History page.',
            ],
          },
          {
            type: 'tip',
            text: 'Make sure your printer is set up correctly in Settings → Printer before processing your first sale.',
          },
        ],
      },
      {
        id: 'pos-void',
        title: 'Voiding / Cancelling a Transaction',
        content: [
          {
            type: 'steps',
            items: [
              'To cancel before completing: click <strong>Clear Cart</strong> in the POS screen.',
              'To void a completed sale: go to Sales History, find the transaction, and click <strong>Void</strong> (admin permission may be required).',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'sales',
    label: 'Sales & Reports',
    icon: DocumentTextIcon,
    adminOnly: false,
    topics: [
      {
        id: 'sales-history',
        title: 'Viewing Sales History',
        content: [
          {
            type: 'steps',
            items: [
              'Go to <strong>Sales</strong> from the navigation bar.',
              'The list shows all completed transactions with date, total, and cashier.',
              'Click on any transaction to expand it and see the full breakdown.',
              'Use the date range filter and search bar to narrow down results.',
            ],
          },
        ],
      },
      {
        id: 'sales-reports',
        title: 'Statistical Reports',
        content: [
          {
            type: 'paragraph',
            text: 'The <strong>Reports</strong> section provides graphical analysis of sales performance.',
          },
          {
            type: 'list',
            items: [
              '<strong>Revenue by Period</strong> — total earnings per day, week, or month.',
              '<strong>Top Products</strong> — best-selling items by quantity and revenue.',
              '<strong>Category Performance</strong> — revenue broken down by product category.',
              '<strong>Sales by Cashier</strong> — contributions per staff member.',
            ],
          },
          {
            type: 'tip',
            text: 'Use the date range selector in Reports to compare performance across different periods.',
          },
        ],
      },
      {
        id: 'sales-archives',
        title: 'Archives (Admin Only)',
        adminOnly: true,
        content: [
          {
            type: 'paragraph',
            text: 'Archived sales are older transactions that have been moved out of the main Sales list to keep it clean. Accessible from the top-right header icon.',
          },
        ],
      },
    ],
  },
  {
    id: 'settings-general',
    label: 'General Settings',
    icon: Cog6ToothIcon,
    adminOnly: false,
    topics: [
      {
        id: 'sg-store',
        title: 'Business Information',
        content: [
          {
            type: 'paragraph',
            text: 'Your store\'s name, tagline, contact details, and logo are displayed on receipts and inside the app. To update them:',
          },
          {
            type: 'steps',
            items: [
              'Go to <strong>Settings → General</strong>.',
              'Click the <strong>Edit</strong> (pencil) icon in the Business Information card.',
              'Update the fields as needed.',
              'Click the <strong>Save</strong> (checkmark) icon to confirm, or the <strong>Cancel</strong> (X) icon to discard.',
              'To change the logo, click the camera icon on the logo while in edit mode and select a new image (max 2MB).',
            ],
          },
        ],
      },
      {
        id: 'sg-tax',
        title: 'Tax Rate',
        content: [
          {
            type: 'paragraph',
            text: 'The tax rate is used for tax-inclusive pricing calculations.',
          },
          {
            type: 'list',
            items: [
              'Default value: <strong>12%</strong>',
              'This field is <strong>Admin only</strong>.',
              'Set to <strong>0</strong> to disable tax calculations.',
            ],
          },
        ],
      },
      {
        id: 'sg-lowstock',
        title: 'Low Stock Threshold',
        content: [
          {
            type: 'paragraph',
            text: 'Products at or below this quantity will be flagged as "low stock" on the Dashboard and in the Inventory list.',
          },
          {
            type: 'list',
            items: [
              'Default value: <strong>10 units</strong>',
              'Adjust based on your restocking frequency.',
            ],
          },
        ],
      },
      {
        id: 'sg-receipt',
        title: 'Receipt Footer',
        content: [
          {
            type: 'paragraph',
            text: 'The text entered here will appear at the bottom of every printed receipt. Use it for thank-you messages, return policies, or promotional notes.',
          },
          {
            type: 'tip',
            text: 'Example: "Thank you for shopping with us! All sales are final."',
          },
        ],
      },
      {
        id: 'sg-language',
        title: 'Language',
        content: [
          {
            type: 'paragraph',
            text: 'INVENTRA supports <strong>English</strong> and <strong>Filipino</strong>. Select your preferred language from the dropdown. The change takes effect immediately after saving.',
          },
        ],
      },
    ],
  },
  {
    id: 'printer',
    label: 'Printer Setup',
    icon: PrinterIcon,
    adminOnly: false,
    topics: [
      {
        id: 'pr-usb',
        title: 'USB Thermal Printer',
        content: [
          {
            type: 'paragraph',
            text: 'INVENTRA supports USB thermal printers (ESC/POS compatible, e.g., XPRINTER, Epson TM series).',
          },
          {
            type: 'steps',
            items: [
              'Connect your USB thermal printer to the computer.',
              'Go to <strong>Settings → Printer</strong>.',
              'The system will automatically detect connected USB printers.',
              'Select your printer from the detected list.',
              'Choose the correct <strong>Paper Width</strong> (58mm or 80mm).',
              'Click <strong>Test Print</strong> to verify it works.',
              'Make sure <strong>Auto Print Receipt</strong> is enabled for automatic printing after every sale.',
            ],
          },
          {
            type: 'tip',
            text: 'If your printer is not detected, try unplugging and re-plugging the USB cable, then revisit this page.',
          },
        ],
      },
      {
        id: 'pr-status',
        title: 'Printer Status Indicator',
        content: [
          {
            type: 'paragraph',
            text: 'The top-right header shows a <strong>printer icon</strong> with a colored dot:',
          },
          {
            type: 'list',
            items: [
              '<span style="color:#10b981">Green dot</span> — Printer is connected and ready.',
              '<span style="color:#ef4444">Red dot</span> — Printer is disconnected or unavailable.',
            ],
          },
          {
            type: 'tip',
            text: 'Hover over the printer icon in the header to see the connection detail.',
          },
        ],
      },
      {
        id: 'pr-paper',
        title: 'Paper Width',
        content: [
          {
            type: 'paragraph',
            text: 'INVENTRA supports two standard thermal paper sizes:',
          },
          {
            type: 'table',
            headers: ['Width', 'Common Use'],
            rows: [
              ['58mm', 'Compact receipts — most small thermal printers'],
              ['80mm', 'Wider receipts — standard for retail POS printers'],
            ],
          },
          {
            type: 'warning',
            text: 'Selecting the wrong paper width may cause text to be cut off or misaligned on receipts.',
          },
        ],
      },
    ],
  },
  {
    id: 'user-management',
    label: 'User Management',
    icon: UserIcon,
    adminOnly: true,
    topics: [
      {
        id: 'um-add',
        title: 'Adding a User',
        content: [
          {
            type: 'steps',
            items: [
              'Go to <strong>Settings → User Management</strong>.',
              'Click <strong>Add User</strong>.',
              'Enter the name, username, password, and select a role (Admin or Cashier).',
              'Click <strong>Save</strong>.',
            ],
          },
          {
            type: 'tip',
            text: 'Create a unique username for each staff member so their activity can be tracked in the Logs.',
          },
        ],
      },
      {
        id: 'um-edit',
        title: 'Editing or Removing a User',
        content: [
          {
            type: 'steps',
            items: [
              'Find the user in the list under Settings → User Management.',
              'Click the <strong>Edit</strong> icon to update their name, username, or password.',
              'Click the <strong>Delete</strong> icon to permanently remove the user.',
              'Confirm the action in the dialog.',
            ],
          },
          {
            type: 'warning',
            text: 'You cannot delete your own account while logged in. You also cannot have zero admin accounts in the system.',
          },
        ],
      },
      {
        id: 'um-permissions',
        title: 'Permissions by Role',
        content: [
          {
            type: 'table',
            headers: ['Feature', 'Admin', 'Cashier'],
            rows: [
              ['Dashboard', '✅', '✅'],
              ['Inventory (view)', '✅', '✅'],
              ['Add / Edit Products', '✅', '✅'],
              ['Point of Sale', '✅', '✅'],
              ['Sales History', '✅', '✅'],
              ['Statistical Reports', '✅', '✅'],
              ['User Management', '✅', '❌'],
              ['Categories', '✅', '❌'],
              ['Backup & Restore', '✅', '❌'],
              ['Tax Rate (edit)', '✅', '❌'],
              ['Activity Logs', '✅', '❌'],
              ['Archives', '✅', '❌'],
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'categories',
    label: 'Categories',
    icon: Squares2X2Icon,
    adminOnly: true,
    topics: [
      {
        id: 'cat-manage',
        title: 'Managing Product Categories',
        content: [
          {
            type: 'paragraph',
            text: 'Categories help organize your inventory. Products can be filtered by category in both the Inventory and POS screens.',
          },
          {
            type: 'steps',
            items: [
              'Go to <strong>Settings → Categories</strong>.',
              'Click <strong>Add Category</strong>.',
              'Enter a category name and optional description.',
              'Click <strong>Add Category</strong> to save.',
              'To remove a category, click <strong>Remove</strong> next to it and confirm.',
            ],
          },
          {
            type: 'warning',
            text: 'Removing a category does not delete the products in it — they will appear as "Uncategorized".',
          },
        ],
      },
    ],
  },
  {
    id: 'backup',
    label: 'Backup & Restore',
    icon: CircleStackIcon,
    adminOnly: true,
    topics: [
      {
        id: 'bk-create',
        title: 'Creating a Backup',
        content: [
          {
            type: 'steps',
            items: [
              'Go to <strong>Settings → Backup & Restore</strong>.',
              'Click <strong>Create Backup</strong>.',
              'Choose a destination folder on your computer.',
              'The backup file will be saved as a <code>.db</code> or archive file.',
            ],
          },
          {
            type: 'tip',
            text: 'Schedule regular backups — at least daily — especially after periods of heavy sales activity.',
          },
        ],
      },
      {
        id: 'bk-restore',
        title: 'Restoring from a Backup',
        content: [
          {
            type: 'steps',
            items: [
              'Go to <strong>Settings → Backup & Restore</strong>.',
              'Click <strong>Restore Backup</strong>.',
              'Browse to and select your backup file.',
              'Confirm the restore. The system will restart and load the backup data.',
            ],
          },
          {
            type: 'warning',
            text: 'Restoring a backup will OVERWRITE all current data. Make sure to create a fresh backup of your current state first if needed.',
          },
        ],
      },
    ],
  },
  {
    id: 'shortcuts',
    label: 'Keyboard Shortcuts',
    icon: CommandLineIcon,
    adminOnly: false,
    topics: [
      {
        id: 'sc-navigation',
        title: 'Navigation Shortcuts',
        content: [
          {
            type: 'shortcuts',
            items: [
              { key: 'F1', description: 'Go to Dashboard' },
              { key: 'F2', description: 'Go to Point of Sale' },
              { key: 'F3', description: 'Go to Inventory' },
              { key: 'F4', description: 'Go to Sales History' },
              { key: 'F6', description: 'Go to Activity Logs (Admin only)' },
              { key: 'Alt + S', description: 'Open Settings' },
              { key: 'Alt + L', description: 'Logout' },
              { key: 'Alt + T', description: 'Toggle Dark / Light mode' },
              { key: 'Escape', description: 'Close modal or cancel action' },
            ],
          },
        ],
      },
      {
        id: 'sc-general',
        title: 'General Tips',
        content: [
          {
            type: 'list',
            items: [
              'Pressing <kbd>Enter</kbd> in most form fields submits the form.',
              'The barcode scanner functions as a keyboard — it types the barcode and presses Enter automatically.',
              'If you navigate away while a POS transaction is active, a warning dialog will ask you to confirm.',
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'faq',
    label: 'FAQ',
    icon: QuestionMarkCircleIcon,
    adminOnly: false,
    topics: [
      {
        id: 'faq-login',
        title: 'I cannot log in — what should I do?',
        content: [
          {
            type: 'list',
            items: [
              'Double-check that Caps Lock is not on.',
              'Make sure you are using the correct username (case-sensitive).',
              'Ask an Admin to reset your password from User Management.',
            ],
          },
        ],
      },
      {
        id: 'faq-lowstock',
        title: 'The low stock filter shows items that have enough stock.',
        content: [
          {
            type: 'paragraph',
            text: 'This happens when the Low Stock Threshold in Settings is set too high. Go to <strong>Settings → General</strong> and lower the threshold value to match your actual needs.',
          },
        ],
      },
      {
        id: 'faq-printer',
        title: 'The printer is connected but not printing.',
        content: [
          {
            type: 'list',
            items: [
              'Make sure the USB cable is firmly connected on both ends.',
              'The printer should be powered on and have paper loaded.',
              'Go to <strong>Settings → Printer</strong> and click <strong>Test Print</strong>.',
              'Check that the correct paper width (58mm or 80mm) is selected.',
              'Try unplugging and re-plugging the USB cable, then revisit the Settings page.',
            ],
          },
        ],
      },
      {
        id: 'faq-barcode',
        title: 'The barcode scanner is not adding products in POS.',
        content: [
          {
            type: 'list',
            items: [
              'Verify that the barcode on the product matches the barcode saved in the system.',
              'Make sure the scanner is producing a complete scan (listen for the beep).',
              'Try scanning in the Inventory page — search for the product to confirm the barcode exists.',
              'If Settings is open, close it first — barcode scanning is paused while Settings is active.',
            ],
          },
        ],
      },
      {
        id: 'faq-missing-report',
        title: 'A sale from today is not showing in Reports.',
        content: [
          {
            type: 'paragraph',
            text: 'Reports may have a date filter applied. Make sure the selected date range includes today. Also verify the sale was fully completed in POS (not just added to cart).',
          },
        ],
      },
    ],
  },
];

// ─── Sub-components ────────────────────────────────────

function RoleBadge({ adminOnly }) {
  if (!adminOnly) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-semibold ml-2">
      <LockClosedIcon className="h-3 w-3" />
      Admin Only
    </span>
  );
}

function Tip({ text }) {
  return (
    <div className="flex items-start gap-2.5 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700/50 rounded-lg px-4 py-3 mt-3">
      <LightBulbIcon className="h-4 w-4 text-teal-500 dark:text-teal-400 mt-0.5 shrink-0" />
      <p className="text-sm text-teal-800 dark:text-teal-200" dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}

function Warning({ text }) {
  return (
    <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-lg px-4 py-3 mt-3">
      <ExclamationTriangleIcon className="h-4 w-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
      <p className="text-sm text-amber-800 dark:text-amber-200" dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}

function Steps({ items }) {
  return (
    <ol className="space-y-2 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-3">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-xs font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <span className="text-sm leading-relaxed text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items }) {
  return (
    <ul className="space-y-1.5 mt-2">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
          <CheckCircleIcon className="h-4 w-4 text-teal-500 dark:text-teal-400 mt-0.5 shrink-0" />
          <span dangerouslySetInnerHTML={{ __html: item }} />
        </li>
      ))}
    </ul>
  );
}

function ContentTable({ headers, rows }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-slate-800">
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-gray-50/60 dark:bg-slate-800/60'}>
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-2.5 text-gray-700 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800" dangerouslySetInnerHTML={{ __html: cell }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShortcutList({ items }) {
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5">
          <span className="text-sm text-gray-700 dark:text-gray-300">{item.description}</span>
          <kbd className="ml-3 px-2.5 py-1 bg-white dark:bg-slate-700 border border-gray-300 dark:border-gray-600 rounded-md text-xs font-mono font-semibold text-gray-800 dark:text-gray-200 shadow-sm shrink-0">
            {item.key}
          </kbd>
        </div>
      ))}
    </div>
  );
}

function ContentBlock({ block }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="text-sm leading-relaxed mt-2 text-gray-800 dark:text-gray-200" dangerouslySetInnerHTML={{ __html: block.text }} />;
    case 'steps':
      return <Steps items={block.items} />;
    case 'list':
      return <BulletList items={block.items} />;
    case 'table':
      return <ContentTable headers={block.headers} rows={block.rows} />;
    case 'tip':
      return <Tip text={block.text} />;
    case 'warning':
      return <Warning text={block.text} />;
    case 'shortcuts':
      return <ShortcutList items={block.items} />;
    default:
      return null;
  }
}

function TopicAccordion({ topic, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen || false);
  const { colors } = useTheme();

  return (
    <div className={`border ${colors.border.primary} rounded-xl overflow-hidden transition-all duration-200`}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-5 py-4 text-left
          ${open
            ? 'bg-teal-50 dark:bg-teal-900/20 border-b border-teal-100 dark:border-teal-800/50'
            : `${colors.card.primary} hover:bg-gray-50 dark:hover:bg-slate-800`
          } transition-colors duration-200`}
      >
        <span className={`text-sm font-semibold ${open ? 'text-teal-700 dark:text-teal-300' : colors.text.primary}`}>
          {topic.title}
          {topic.adminOnly && <RoleBadge adminOnly />}
        </span>
        {open
          ? <ChevronDownIcon className="h-4 w-4 text-teal-500 dark:text-teal-400 shrink-0" />
          : <ChevronRightIcon className={`h-4 w-4 ${colors.text.secondary} shrink-0`} />
        }
      </button>
      {open && (
        <div className={`px-5 py-4 ${colors.card.primary} space-y-1`}>
          {topic.content.map((block, i) => (
            <ContentBlock key={i} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────

const HelpManualScreen = ({ user, allowedSections = null }) => {
  const { colors } = useTheme();
  const [activeSection, setActiveSection] = useState(allowedSections ? allowedSections[0] : 'getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  const isAdmin = user?.role === 'admin';

  // Filter topics by search query across all sections or within active section
  const availableSections = SECTIONS.filter(s => !allowedSections || allowedSections.includes(s.id));
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return availableSections;
    const q = searchQuery.toLowerCase();
    return availableSections.map(section => ({
      ...section,
      topics: section.topics.filter(topic => {
        const titleMatch = topic.title.toLowerCase().includes(q);
        const contentMatch = topic.content.some(block => {
          if (block.text) return block.text.toLowerCase().includes(q);
          if (block.items) return block.items.some(item =>
            typeof item === 'string' ? item.toLowerCase().includes(q) : (item.description || item.key || '').toLowerCase().includes(q)
          );
          if (block.rows) return block.rows.some(row => row.some(cell => cell.toLowerCase().includes(q)));
          return false;
        });
        return titleMatch || contentMatch;
      }),
    })).filter(section =>
      section.topics.length > 0 || section.label.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const currentSection = searchQuery.trim()
    ? filteredSections[0]
    : filteredSections.find(s => s.id === activeSection) || availableSections[0];

  const sidebarSections = searchQuery.trim() ? filteredSections : availableSections;

  return (
    <div className={`${colors.card.primary} w-full rounded-xl border ${colors.border.primary} shadow flex flex-col`} style={{ height: 'calc(100vh - 8rem)', minHeight: '500px', maxHeight: '800px' }}>
      {/* Search bar */}
      <div className={`shrink-0 flex items-center gap-3 px-5 py-3.5 border-b ${colors.border.primary} bg-gradient-to-r from-amber-500 to-amber-600 dark:from-teal-600 dark:to-teal-700`}>
        <BookOpenIcon className="h-5 w-5 text-teal-100 shrink-0" />
        <span className="text-white font-semibold text-base">Help & Manual</span>
        <div className="ml-auto flex items-center gap-2 bg-white/15 border border-white/25 rounded-lg px-3 py-1.5 w-64">
          <MagnifyingGlassIcon className="h-4 w-4 text-white/70 shrink-0" />
          <input
            type="text"
            placeholder="Search manual..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-transparent text-white placeholder-white/60 text-sm outline-none w-full"
          />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className={`w-56 shrink-0 border-r ${colors.border.primary} py-3 overflow-y-auto`}>
          {sidebarSections.map(section => {
            const Icon = section.icon;
            const isActive = !searchQuery.trim() && activeSection === section.id;
            const isSearchMatch = searchQuery.trim() && filteredSections[0]?.id === section.id;
            return (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id);
                  setSearchQuery('');
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors duration-150
                  ${isActive
                    ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border-r-2 border-teal-500 font-semibold'
                    : `${colors.text.secondary} hover:bg-gray-50 dark:hover:bg-slate-800 hover:${colors.text.primary}`
                  }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-teal-600 dark:text-teal-400' : ''}`} />
                <span className="leading-tight">{section.label}</span>
                {section.adminOnly && (
                  <LockClosedIcon className="h-3 w-3 ml-auto text-amber-500 dark:text-amber-400 shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content Panel */}
        <div className="flex-1 p-6 overflow-y-auto">
          {currentSection ? (
            <>
              {/* Section header */}
              <div className="flex items-center gap-3 mb-5">
                {currentSection.icon && (
                  <div className="p-2 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                    <currentSection.icon className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  </div>
                )}
                <div>
                  <h2 className={`text-lg font-bold ${colors.text.primary} flex items-center gap-2`}>
                    {currentSection.label}
                    {currentSection.adminOnly && <RoleBadge adminOnly />}
                  </h2>
                  {currentSection.adminOnly && !isAdmin && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                      Your account does not have access to this feature.
                    </p>
                  )}
                </div>
              </div>

              {/* Topics */}
              {currentSection.topics.length > 0 ? (
                <div className="space-y-3">
                  {currentSection.topics.map((topic, i) => (
                    <TopicAccordion
                      key={topic.id}
                      topic={topic}
                      defaultOpen={i === 0}
                    />
                  ))}
                </div>
              ) : (
                <div className={`text-center py-12 ${colors.text.secondary}`}>
                  <QuestionMarkCircleIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="text-sm">No results found for "{searchQuery}"</p>
                </div>
              )}
            </>
          ) : (
            <div className={`text-center py-12 ${colors.text.secondary}`}>
              <QuestionMarkCircleIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No results found for "{searchQuery}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HelpManualScreen;
