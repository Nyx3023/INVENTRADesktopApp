/**
 * Unified Printer Service
 * Supports: Bluetooth, USB (via browser print), Network printers, Silent printing
 */

import { bluetoothPrinter } from './bluetoothPrinter.js';
import { printThermalReceipt } from './thermalPrinter.js';
import { usbRawPrinter } from './usbRawPrinter.js';

const hasDesktopPrinterBridge =
  typeof window !== 'undefined' &&
  typeof window.printer?.printReceipt === 'function';

export const PRINTER_TYPES = {
  BLUETOOTH: 'bluetooth',
  BROWSER: 'browser',
  NETWORK: 'network'
};

class PrinterService {
  constructor() {
    this.activePrinter = null;
    this.printerType = null;
    this.config = this.loadConfig();
  }

  /**
   * Convert low-level errors to user-friendly messages.
   */
  normalizePrintError(error) {
    const code = error?.code;
    const rawMessage = String(error?.message || '');
    const lower = rawMessage.toLowerCase();

    if (code === 'PRINTER_NOT_CONNECTED') {
      return 'Printer is not connected. Check the USB cable and power, then try again.';
    }
    if (code === 'PRINTER_ACCESS_DENIED') {
      return 'Printer access is blocked by Windows. Close other printer apps and reconnect the printer.';
    }
    if (code === 'PAPER_OUT') {
      return 'Printer is out of paper. Load a new roll and try again.';
    }
    if (code === 'PRINTER_BUSY') {
      return 'Printer is busy. Please wait a few seconds and retry.';
    }
    if (code === 'USB_SERIAL_OPEN_FAILED' || code === 'BLUETOOTH_OPEN_FAILED') {
      return 'Could not open the printer port. Reconnect the printer and try again.';
    }
    if (code === 'USB_SERIAL_WRITE_FAILED' || code === 'BLUETOOTH_WRITE_FAILED') {
      return 'Could not send data to the printer. Check connection and try again.';
    }
    if (lower.includes('timeout')) {
      return 'Printer did not respond in time. Please try again.';
    }

    return rawMessage || 'Printing failed. Please check printer connection and paper.';
  }

  /**
   * Get footer text from app settings (receiptFooter) or fallback to printer config
   */
  getFooterText() {
    try {
      // First check appSettings for receiptFooter (set in Settings screen)
      const appSettings = localStorage.getItem('appSettings');
      if (appSettings) {
        const parsed = JSON.parse(appSettings);
        if (parsed.receiptFooter && parsed.receiptFooter.trim()) {
          return parsed.receiptFooter.trim();
        }
      }
      // Fallback to printerConfig footerText
      if (this.config?.footerText) {
        return this.config.footerText;
      }
      // Default fallback
      return 'Thank you for your purchase!';
    } catch (error) {
      console.error('Failed to get footer text:', error);
      return 'Thank you for your purchase!';
    }
  }

  /**
   * Get store info from localStorage
   */
  getStoreInfo() {
    try {
      const savedStoreInfo = localStorage.getItem('storeInfo');
      if (savedStoreInfo) {
        const parsed = JSON.parse(savedStoreInfo);
        const addressParts = (parsed.address || '').split(',').map(s => s.trim());
        return {
          storeName: parsed.storeName || 'JBO Arts & Crafts Trading',
          storeAddress: addressParts[0] || '#303 B1A J.R. Blvd Tagapo',
          storeCity: addressParts.slice(1).join(', ') || 'Santa Rosa, Philippines',
          storePhone: parsed.phone || '0932 868 7911'
        };
      }
    } catch (e) {
      console.error('Error parsing store info:', e);
    }
    return {
      storeName: 'JBO Arts & Crafts Trading',
      storeAddress: '#303 B1A J.R. Blvd Tagapo',
      storeCity: 'Santa Rosa, Philippines',
      storePhone: '0932 868 7911'
    };
  }

  /**
   * Load printer configuration from localStorage
   */
  loadConfig() {
    try {
      const saved = localStorage.getItem('printerConfig');
      const storeInfo = this.getStoreInfo();
      const defaultConfig = {
        type: PRINTER_TYPES.BROWSER,
        selectedPrinterType: 'usb',
        silentPrint: true,
        autoPrint: true,
        autoConnectBluetooth: true,
        bluetoothDeviceId: null,
        bluetoothDeviceName: null,
        networkUrl: null,
        paperWidth: '58mm',
        storeName: storeInfo.storeName,
        storeAddress: storeInfo.storeAddress,
        storeCity: storeInfo.storeCity,
        storePhone: storeInfo.storePhone,
        footerText: 'Thank you for your purchase!'
      };
      
      return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
    } catch (error) {
      console.error('Failed to load printer config:', error);
      return {
        type: PRINTER_TYPES.BROWSER,
        selectedPrinterType: 'usb',
        silentPrint: true
      };
    }
  }

  /**
   * Save printer configuration to localStorage
   */
  saveConfig(config) {
    try {
      this.config = { ...this.config, ...config };
      localStorage.setItem('printerConfig', JSON.stringify(this.config));
      return true;
    } catch (error) {
      console.error('Failed to save printer config:', error);
      return false;
    }
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Check if Bluetooth is available
   */
  isBluetoothAvailable() {
    return bluetoothPrinter.isSupported();
  }

  /**
   * Connect to Bluetooth printer
   */
  async connectBluetooth() {
    try {
      const device = await bluetoothPrinter.connect();
      this.activePrinter = bluetoothPrinter;
      this.printerType = PRINTER_TYPES.BLUETOOTH;
      
      // Save device info
      this.saveConfig({
        type: PRINTER_TYPES.BLUETOOTH,
        bluetoothDeviceId: device.id,
        bluetoothDeviceName: device.name
      });

      return device;
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from active printer
   */
  async disconnect() {
    if (this.printerType === PRINTER_TYPES.BLUETOOTH && this.activePrinter) {
      await this.activePrinter.disconnect();
    }
    this.activePrinter = null;
    this.printerType = null;
  }

  /**
   * Print receipt using the configured printer
   */
  async printReceipt(transaction) {
    // Reload config from localStorage to get latest settings (especially selectedPrinterType)
    try {
      const printerSettings = localStorage.getItem('printerSettings');
      if (printerSettings) {
        const settings = JSON.parse(printerSettings);
        console.log('[PrinterService] Loaded settings from localStorage:', {
          selectedPrinter: settings.selectedPrinter,
          selectedPrinterType: settings.selectedPrinterType,
          fullSettings: settings
        });
        
        // Update config with latest selectedPrinterType
        if (settings.selectedPrinterType) {
          this.config.selectedPrinterType = settings.selectedPrinterType;
          console.log('[PrinterService] Set selectedPrinterType to:', settings.selectedPrinterType);
        }
        if (settings.selectedPrinter) {
          this.config.selectedPrinter = settings.selectedPrinter;
        }
        if (settings.selectedPrinter !== undefined) {
          // Map selectedPrinter to selectedPrinterType if needed
          if (settings.selectedPrinter === 'usb-raw') {
            this.config.selectedPrinterType = 'usb_raw';
            console.log('[PrinterService] Mapped selectedPrinter "usb-raw" to selectedPrinterType "usb_raw"');
          } else if (settings.selectedPrinter === 'system-default') {
            this.config.selectedPrinterType = 'usb';
          }
        }
      } else {
        console.warn('[PrinterService] No printerSettings found in localStorage');
      }
    } catch (error) {
      console.warn('[PrinterService] Failed to reload printer settings:', error);
    }
    
    const { selectedPrinterType, type, silentPrint } = this.config;
    const printerType = selectedPrinterType || type;
    const footerText = this.getFooterText();
    
    console.log('[PrinterService] Print request:', {
      printerType,
      selectedPrinterType,
      bluetoothConnected: bluetoothPrinter.isConnected,
      usbRawConnected: usbRawPrinter.isConnected
    });

    // Get store info from localStorage (always fresh)
    const storeInfo = this.getStoreInfo();
    const storeConfig = {
      storeName: storeInfo.storeName,
      storeAddress: storeInfo.storeAddress,
      storeCity: storeInfo.storeCity,
      storePhone: storeInfo.storePhone,
      footerText
    };

    try {
      // Electron desktop bridge takes priority for offline raw ESC/POS printing.
      if (hasDesktopPrinterBridge) {
        const isBluetoothSelected =
          printerType === 'bluetooth' ||
          selectedPrinterType === 'bluetooth';
        const isSerialSelected =
          printerType === 'usb_serial' ||
          selectedPrinterType === 'usb_serial';
        const payload = {
          transaction,
          store: storeConfig,
          footerText,
          portPath: (this.config.selectedPrinterType === 'bluetooth' || this.config.selectedPrinterType === 'usb_serial')
            ? this.config.selectedPrinter
            : undefined
        };
        const desktopResult = isBluetoothSelected
          ? await window.printer.printReceiptBluetooth(payload)
          : isSerialSelected
            ? await window.printer.printReceiptSerial(payload)
            : await window.printer.printReceipt(payload);
        return {
          success: true,
          method: desktopResult?.transport || (isBluetoothSelected ? 'bluetooth' : isSerialSelected ? 'usb_serial' : 'usb_raw'),
          status: desktopResult
        };
      }

      // Check USB RAW connection status first (most direct check)
      const isUsbRawActuallyConnected = usbRawPrinter.isConnected && 
                                         usbRawPrinter.device && 
                                         usbRawPrinter.device.opened;
      
      // Check if USB RAW is selected
      const isUsbRawSelected = printerType === 'usb_raw' || 
                               printerType === 'usb-raw' || 
                               selectedPrinterType === 'usb_raw' || 
                               selectedPrinterType === 'usb-raw';
      
      console.log('[PrinterService] USB RAW status:', {
        isUsbRawSelected,
        isUsbRawActuallyConnected,
        usbRawPrinterIsConnected: usbRawPrinter.isConnected,
        hasDevice: !!usbRawPrinter.device,
        deviceOpened: usbRawPrinter.device?.opened,
        printerType,
        selectedPrinterType,
        rawConfig: this.config
      });
      
      // Priority 1: USB RAW if selected OR if connected (safety fallback)
      if (isUsbRawSelected || isUsbRawActuallyConnected) {
        if (!isUsbRawActuallyConnected) {
          console.error('[PrinterService] USB RAW selected but not connected');
          // If selected but not connected, throw error
          if (isUsbRawSelected) {
            throw new Error('USB RAW printer not connected. Please connect the printer in Settings.');
          }
          // If not selected but was connected (disconnected mid-session), fall through
        } else {
          console.log('[PrinterService] Printing via USB RAW');
          await usbRawPrinter.printReceipt(transaction, storeConfig);
          return { success: true, method: 'usb_raw' };
        }
      }

      // Priority 2: Bluetooth if selected and connected
      if (printerType === 'bluetooth' || type === PRINTER_TYPES.BLUETOOTH) {
        if (bluetoothPrinter.isConnected) {
          console.log('[PrinterService] Printing via Bluetooth');
          await bluetoothPrinter.printReceipt(transaction, storeConfig);
          return { success: true, method: 'bluetooth' };
        } else {
          // Bluetooth selected but not connected - fallback to USB browser
          console.warn('[PrinterService] Bluetooth printer not connected, falling back to USB browser print');
          await this.printViaBrowser(transaction, silentPrint);
          return { success: true, method: 'usb' };
        }
      }

      // Default: USB/Browser print (thermal printer via system drivers)
      console.log('[PrinterService] Printing via USB Browser (default)');
      await this.printViaBrowser(transaction, silentPrint);
      return { success: true, method: 'usb' };

    } catch (error) {
      console.error('Print failed:', error);
      const friendlyMessage = this.normalizePrintError(error);
      const normalizedError = new Error(friendlyMessage);
      if (error?.code) {
        normalizedError.code = error.code;
      }
      throw normalizedError;
    }
  }

  /**
   * Print via browser (traditional method with optional silent mode)
   */
  async printViaBrowser(transaction, silent = true) {
    const footerText = this.getFooterText();
    // Get store info from localStorage (always fresh)
    const storeInfo = this.getStoreInfo();
    // Use the existing thermal printer module with beautiful layout
    await printThermalReceipt(transaction, {
      paperWidth: this.config.paperWidth || '58mm',
      contentWidth: '56mm',
      margin: '0mm',
      bodyPadding: '4mm 2mm',
      fontSize: '12px',
      lineHeight: 1.4,
      silent,
      showCutLine: true,
      sharpRendering: true,
      store: {
        name: storeInfo.storeName,
        addressLine1: storeInfo.storeAddress,
        addressLine2: storeInfo.storeCity,
        phone: storeInfo.storePhone,
        tagline: ''
      },
      footerText
    });
  }

  /**
   * Test print function
   */
  async testPrint() {
    if (hasDesktopPrinterBridge) {
      const desktopResult = await window.printer.printTest();
      return {
        success: true,
        method: desktopResult?.transport || 'usb_raw',
        status: desktopResult
      };
    }

    const testTransaction = {
      id: 'TEST-' + Date.now(),
      timestamp: new Date().toISOString(),
      items: [
        { name: 'Test Product 1', quantity: 2, price: 50.00 },
        { name: 'Test Product 2', quantity: 1, price: 100.00 }
      ],
      subtotal: 200.00,
      tax: 24.00,
      total: 224.00,
      paymentMethod: 'Cash',
      receivedAmount: 250.00,
      change: 26.00,
      userName: 'Test User'
    };

    return await this.printReceipt(testTransaction);
  }

  /**
   * Get printer status
   */
  getStatus() {
    return {
      type: this.printerType || this.config.type,
      connected: this.printerType === PRINTER_TYPES.BLUETOOTH ? bluetoothPrinter.isConnected : true,
      deviceName: this.config.bluetoothDeviceName || 'Browser Printer',
      bluetoothAvailable: this.isBluetoothAvailable()
    };
  }
}

// Export singleton instance
export const printerService = new PrinterService();
export default printerService;
