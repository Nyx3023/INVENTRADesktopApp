const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { ThermalPrinterManager } = require('./printer/thermal-printer.cjs');

// Align app name with productName for directory paths
app.name = 'INVENTRA';

const DEFAULT_PORT = 3001;
const isDev = !app.isPackaged;
const printerManager = new ThermalPrinterManager();
let mainWindow = null;

function validateReceiptPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Receipt payload is required.');
  }
  const tx = payload.transaction || payload;
  if (!tx || typeof tx !== 'object') {
    throw new Error('Receipt transaction is invalid.');
  }
  if (!Array.isArray(tx.items)) {
    tx.items = [];
  }
  return payload;
}

function getAppRoot() {
  if (isDev) {
    return path.resolve(__dirname, '..');
  }
  return path.join(process.resourcesPath, 'app.asar');
}

function ensureRuntimeFolders(baseDir) {
  const folders = [
    path.join(baseDir, 'data'),
    path.join(baseDir, 'uploads'),
    path.join(baseDir, 'uploads', 'products'),
    path.join(baseDir, 'tmp_restore'),
  ];
  for (const folder of folders) {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  }
}

function parseInstallerIni(rawText) {
  const result = {};
  const lines = String(rawText || '').split(/\r?\n/);
  let inSetupSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      inSetupSection = line.toLowerCase() === '[setup]';
      continue;
    }
    if (!inSetupSection) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    // Remove surrounding quotes if present
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }

  return result;
}

async function applyInstallerSetupIfPresent(runtimeDir) {
  const setupIniPath = path.join(runtimeDir, 'data', 'installer-setup.ini');
  console.log('[Installer Setup] Checking for INI at:', setupIniPath);
  if (!fs.existsSync(setupIniPath)) {
    console.log('[Installer Setup] No INI file found, skipping.');
    return;
  }
  console.log('[Installer Setup] INI file found! Applying setup...');

  const appUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
  await waitForServer(appUrl);

  try {
    const rawIni = fs.readFileSync(setupIniPath, 'utf8');
    const setupValues = parseInstallerIni(rawIni);

    const storeName = String(setupValues.storeName || '').trim();
    const adminEmail = String(setupValues.adminEmail || '').trim().toLowerCase();
    const adminPassword = String(setupValues.adminPassword || '');
    if (!storeName || !adminEmail || adminPassword.length < 8) {
      console.warn('Installer setup file has incomplete values. Skipping auto-setup.');
      return;
    }

    const payload = {
      storeInfo: {
        storeName,
        email: String(setupValues.storeEmail || '').trim(),
        phone: String(setupValues.storePhone || '').trim(),
        address: String(setupValues.storeAddress || '').trim(),
      },
      admin: {
        name: String(setupValues.adminName || 'Administrator').trim() || 'Administrator',
        email: adminEmail,
        password: adminPassword,
      },
      printerConfigured: false,
    };

    const response = await fetch(`${appUrl}/api/setup/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Installer setup apply failed (${response.status}): ${body}`);
    }

    fs.unlinkSync(setupIniPath);
    console.log('Installer setup applied successfully.');
  } catch (error) {
    console.error('Failed applying installer setup:', error);
  }
}

async function startBackendServer(runtimeDir) {
  const appRoot = getAppRoot();
  const serverEntry = path.join(appRoot, 'server', 'index.js');
  const distDir = path.join(appRoot, 'dist');

  process.chdir(runtimeDir);
  process.env.PORT = String(DEFAULT_PORT);
  process.env.DIST_DIR = distDir;
  process.env.NODE_ENV = isDev ? 'development' : 'production';

  await import(pathToFileURL(serverEntry).href);
}

async function waitForServer(url, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return true;
      }
    } catch {
      // Server still booting.
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Backend startup timed out for ${url}`);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'src', 'assets', 'jbologo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    return;
  }

  const appUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
  await waitForServer(appUrl);
  await mainWindow.loadURL(appUrl);
}

function registerPrinterIpc() {
  ipcMain.handle('printer:status', async () => {
    await printerManager.listPrinters();
    return printerManager.getStatus();
  });

  ipcMain.handle('printer:list', async () => {
    return printerManager.listPrinters();
  });

  ipcMain.handle('printer:select-usb', async (_event, payload) => {
    const preferredId = typeof payload?.preferredId === 'string' ? payload.preferredId : undefined;
    const selected = await printerManager.selectUsbPrinter(preferredId);
    return {
      ok: true,
      selected,
      status: printerManager.getStatus(),
    };
  });

  ipcMain.handle('printer:auto-connect', async () => {
    const selected = await printerManager.autoConnect();
    return {
      ok: !!selected,
      selected,
      status: printerManager.getStatus(),
    };
  });

  ipcMain.handle('printer:print-receipt', async (_event, payload) => {
    const validPayload = validateReceiptPayload(payload);
    return printerManager.printReceipt(validPayload);
  });

  ipcMain.handle('printer:test-print', async () => {
    const sample = {
      transaction: {
        id: `TEST-${Date.now()}`,
        timestamp: new Date().toISOString(),
        items: [
          { name: 'Sample Item 1', quantity: 1, price: 50 },
          { name: 'Sample Item 2', quantity: 2, price: 25 },
        ],
        subtotal: 100,
        tax: 12,
        total: 112,
        paymentMethod: 'Cash',
        receivedAmount: 120,
        change: 8,
        userName: 'Desktop Test',
      },
      footerText: 'XPRINTER TEST PRINT',
    };
    return printerManager.printReceipt(sample);
  });

  ipcMain.handle('printer:print-receipt-bluetooth', async (_event, payload) => {
    const validPayload = validateReceiptPayload(payload);
    const selectedPath = typeof payload?.portPath === 'string' ? payload.portPath : undefined;
    return printerManager.printViaBluetoothSerial(validPayload, selectedPath);
  });

  ipcMain.handle('printer:print-receipt-serial', async (_event, payload) => {
    const validPayload = validateReceiptPayload(payload);
    const selectedPath = typeof payload?.portPath === 'string' ? payload.portPath : undefined;
    return printerManager.printViaSerialPath(validPayload, selectedPath);
  });

  printerManager.on('status', (status) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('printer:status-changed', status);
  });
}

app.whenReady().then(async () => {
  const runtimeDir = path.join(app.getPath('userData'), 'runtime');
  ensureRuntimeFolders(runtimeDir);
  registerPrinterIpc();

  try {
    await startBackendServer(runtimeDir);
  } catch (error) {
    console.error('Failed to start backend server in Electron:', error);
  }

  await applyInstallerSetupIfPresent(runtimeDir);
  await printerManager.autoConnect();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
