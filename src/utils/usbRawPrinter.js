/**
 * USB RAW Printer using WebUSB API
 * Direct communication with thermal printers via ESC/POS commands
 * * IMPORTANT: The printer must NOT be installed in Windows Printers & Scanners
 * for WebUSB to access it. Windows drivers will claim exclusive access.
 */

class USBRawPrinter {
  constructor() {
    this.device = null;
    this.endpoint = null;
    this.isConnected = false;
  }

  isSupported() {
    return 'usb' in navigator;
  }

  async requestDevice() {
    if (!this.isSupported()) {
      throw new Error('WebUSB API is not supported. Please use Chrome, Edge, or Opera browser.');
    }

    try {
      if (this.isConnected) {
        await this.disconnect();
      }

      // Try previously authorized devices first
      try {
        const authorizedDevices = await navigator.usb.getDevices();
        if (authorizedDevices.length > 0) {
          console.log('[WebUSB] Found previously authorized device');
          this.device = authorizedDevices[0];
          await this.connect();
          return this.device;
        }
      } catch (e) {
        console.warn('[WebUSB] Error getting authorized devices:', e);
      }

      // Request new device
      console.log('[WebUSB] Requesting device access...');
      this.device = await navigator.usb.requestDevice({ filters: [] });
      await this.connect();
      return this.device;
    } catch (error) {
      console.error('[WebUSB] Device request failed:', error);
      if (error.name === 'NotFoundError') {
        throw new Error('No USB device selected.');
      } else if (error.message && error.message.includes('Access denied')) {
        throw new Error('DEVICE_CLAIMED_BY_WINDOWS');
      }
      throw error;
    }
  }

  async connect() {
    if (!this.device) throw new Error('No device selected');

    try {
      if (this.device.opened) {
        try { await this.device.close(); } catch (e) {}
      }

      await this.device.open();
      const configurations = this.device.configurations;
      if (!configurations || configurations.length === 0) throw new Error('Device has no configurations');

      let connected = false;
      for (const config of configurations) {
        try {
          await this.device.selectConfiguration(config.configurationValue);
          for (const iface of config.interfaces) {
            try {
              await this.device.claimInterface(iface.interfaceNumber);
              for (const alt of iface.alternates) {
                for (const endpoint of alt.endpoints) {
                  if (endpoint.direction === 'out' && endpoint.type === 'bulk') {
                    this.endpoint = endpoint.endpointNumber;
                    connected = true;
                    break;
                  }
                }
                if (connected) break;
              }
              if (connected) break;
            } catch (e) {
              // Try next interface
            }
          }
          if (connected) break;
        } catch (e) {
          // Try next config
        }
      }

      if (!connected || !this.endpoint) {
        throw new Error('No suitable endpoint found. Device may not be a compatible ESC/POS printer.');
      }

      this.isConnected = true;
      console.log('[WebUSB] Successfully connected');
      return true;
    } catch (error) {
      this.isConnected = false;
      this.device = null;
      this.endpoint = null;
      if (error.message && error.message.includes('Access denied')) {
        throw new Error('DEVICE_CLAIMED_BY_WINDOWS');
      }
      throw error;
    }
  }

  async disconnect() {
    if (!this.device) return;
    try {
      if (this.device.opened) {
        await this.device.close();
      }
    } catch (error) {
      console.error('[WebUSB] Disconnect error:', error);
    } finally {
      this.device = null;
      this.endpoint = null;
      this.isConnected = false;
    }
  }

  async sendRaw(data) {
    if (!this.isConnected || !this.device || !this.endpoint) {
      throw new Error('Printer not connected');
    }
    try {
      const chunkSize = 64; 
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await this.device.transferOut(this.endpoint, chunk);
      }
    } catch (error) {
      console.error('[WebUSB] Send error:', error);
      throw error;
    }
  }

  /**
   * Helper: Concatenate Uint8Arrays
   */
  concatArrays(a, b) {
    const result = new Uint8Array(a.length + b.length);
    result.set(a, 0);
    result.set(b, a.length);
    return result;
  }

  /**
   * Convert text to ESC/POS commands
   * Updated to match Bluetooth styling EXACTLY
   */
  textToEscPos(text, options = {}) {
    const {
      align = 'left',
      bold = false,
      size = 'normal' // 'normal', 'wide', 'double'
    } = options;

    let commands = new Uint8Array(0);

    // 1. Alignment (Standard ESC a n)
    if (align === 'center') {
      commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x61, 0x01]));
    } else if (align === 'right') {
      commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x61, 0x02]));
    } else {
      commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x61, 0x00]));
    }

    // 2. Bold (ESC E n)
    if (bold) {
      commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x45, 0x01]));
    } else {
      commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x45, 0x00]));
    }

    // 3. Size (ESC ! n) - Switched to ESC ! to match BluetoothPrinter.js logic
    // 0x00 = Normal
    // 0x20 = Double Width (Decimal 32)
    // 0x30 = Double Width + Double Height (Decimal 48)
    if (size === 'double' || size === 'large') {
      commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x21, 0x30])); 
    } else if (size === 'wide') {
      commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x21, 0x20])); 
    } else {
      commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x21, 0x00])); 
    }

    // 4. Content
    const textBytes = new TextEncoder().encode(text);
    commands = this.concatArrays(commands, textBytes);

    // 5. Reset Formatting (Important to prevent bleeding styles)
    commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x45, 0x00])); // Bold Off
    commands = this.concatArrays(commands, new Uint8Array([0x1B, 0x21, 0x00])); // Normal Size

    return commands;
  }

  lineFeed(lines = 1) {
    const commands = new Uint8Array(lines);
    commands.fill(0x0A);
    return commands;
  }

  cutPaper() {
    return new Uint8Array([0x1D, 0x56, 0x41, 0x03]); // GS V A 3
  }

  /**
   * Print Receipt
   * Layout Logic synced 1:1 with BluetoothPrinter.js
   */
  async printReceipt(transaction, options = {}) {
    if (!this.isConnected) throw new Error('Printer not connected');

    // Get store info from localStorage
    let storeInfo = {
      storeName: 'JBO Arts & Crafts Trading',
      storeAddress: '#303 B1A J.R. Blvd Tagapo',
      storeCity: 'Santa Rosa, Philippines',
      storePhone: '0932 868 7911'
    };
    
    try {
      const savedStoreInfo = localStorage.getItem('storeInfo');
      if (savedStoreInfo) {
        const parsed = JSON.parse(savedStoreInfo);
        const addressParts = (parsed.address || '').split(',').map(s => s.trim());
        storeInfo = {
          storeName: parsed.storeName || storeInfo.storeName,
          storeAddress: addressParts[0] || storeInfo.storeAddress,
          storeCity: addressParts.slice(1).join(', ') || storeInfo.storeCity,
          storePhone: parsed.phone || storeInfo.storePhone
        };
      }
    } catch (e) {
      console.error('Error parsing store info:', e);
    }

    const {
      storeName = storeInfo.storeName,
      storeAddress = storeInfo.storeAddress,
      storeCity = storeInfo.storeCity,
      storePhone = storeInfo.storePhone,
      footerText = 'Thank you for your purchase!'
    } = options;

    try {
      let data = new Uint8Array(0);

      // Init
      data = this.concatArrays(data, new Uint8Array([0x1B, 0x40])); 

      // --- HEADER ---
      data = this.concatArrays(data, this.textToEscPos(storeName, { align: 'center', bold: true, size: 'wide' }));
      data = this.concatArrays(data, this.lineFeed(1));
      data = this.concatArrays(data, this.textToEscPos(storeAddress, { align: 'center' }));
      data = this.concatArrays(data, this.lineFeed(1));
      data = this.concatArrays(data, this.textToEscPos(storeCity, { align: 'center' }));
      data = this.concatArrays(data, this.lineFeed(1));
      data = this.concatArrays(data, this.textToEscPos(storePhone, { align: 'center' }));
      data = this.concatArrays(data, this.lineFeed(2));

      // --- INFO ---
      // Separator "="
      data = this.concatArrays(data, this.textToEscPos('================================', { align: 'center' }));
      data = this.concatArrays(data, this.lineFeed(1));
      
      const receiptId = transaction.id || transaction.transactionId || 'N/A';
      data = this.concatArrays(data, this.textToEscPos(`Receipt #: ${receiptId}`, { bold: true }));
      data = this.concatArrays(data, this.lineFeed(1));

      const dateStr = new Date(transaction.timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      data = this.concatArrays(data, this.textToEscPos(`Date: ${dateStr}`));
      data = this.concatArrays(data, this.lineFeed(1));

      const userName = transaction.userName || transaction.user_name || transaction.cashier || 'N/A';
      data = this.concatArrays(data, this.textToEscPos(`Cashier: ${userName}`));
      data = this.concatArrays(data, this.lineFeed(1));

      const refNo = transaction.referenceNumber || transaction.reference_number;
      if (refNo) {
        data = this.concatArrays(data, this.textToEscPos(`Ref No: ${refNo}`));
        data = this.concatArrays(data, this.lineFeed(1));
      }

      // Separator "="
      data = this.concatArrays(data, this.textToEscPos('================================', { align: 'center' }));
      data = this.concatArrays(data, this.lineFeed(1));

      // --- ITEMS ---
      data = this.concatArrays(data, this.textToEscPos('ITEMS', { align: 'center', bold: true }));
      data = this.concatArrays(data, this.lineFeed(1));

      const items = transaction.items || [];
      for (const item of items) {
        const itemName = (item.name || item.productName || 'Item').substring(0, 20);
        const qty = item.quantity || 0;
        const price = Number(item.price || item.unit_price || 0);
        const subtotal = qty * price;

        data = this.concatArrays(data, this.textToEscPos(itemName));
        data = this.concatArrays(data, this.lineFeed(1));
        
        const itemLine = `  ${qty} x ₱${price.toFixed(2)} = ₱${subtotal.toFixed(2)}`;
        // Explicit right alignment via option
        data = this.concatArrays(data, this.textToEscPos(itemLine, { align: 'right' }));
        data = this.concatArrays(data, this.lineFeed(1));
      }

      // Separator "-"
      data = this.concatArrays(data, this.textToEscPos('--------------------------------', { align: 'center' }));
      data = this.concatArrays(data, this.lineFeed(1));

      // --- TOTALS ---
      const subtotal = Number(transaction.subtotal || 0);
      const tax = Number(transaction.tax || 0);
      const total = Number(transaction.total || 0);
      const discountPct = transaction.discount_percentage || transaction.discountPercentage || 0;
      const discountAmt = transaction.discount_amount || transaction.discountAmount || 0;

      data = this.concatArrays(data, this.textToEscPos(`SUBTOTAL:    ₱${subtotal.toFixed(2)}`, { align: 'right' }));
      data = this.concatArrays(data, this.lineFeed(1));
      
      if (discountPct > 0) {
        data = this.concatArrays(data, this.textToEscPos(`DISC (${discountPct}%):  -₱${Number(discountAmt).toFixed(2)}`, { align: 'right' }));
        data = this.concatArrays(data, this.lineFeed(1));
      }
      data = this.concatArrays(data, this.textToEscPos(`TAX:         ₱${tax.toFixed(2)}`, { align: 'right' }));
      data = this.concatArrays(data, this.lineFeed(1));
      data = this.concatArrays(data, this.textToEscPos(`TOTAL:       ₱${total.toFixed(2)}`, { align: 'right', bold: true, size: 'wide' }));
      data = this.concatArrays(data, this.lineFeed(2));

      // --- PAYMENT ---
      const paymentMethod = transaction.paymentMethod || 'Cash';
      data = this.concatArrays(data, this.textToEscPos(`Payment: ${paymentMethod}`, { bold: true }));
      data = this.concatArrays(data, this.lineFeed(1));

      if (transaction.receivedAmount !== undefined) {
        data = this.concatArrays(data, this.textToEscPos(`Received:    ₱${Number(transaction.receivedAmount).toFixed(2)}`, { align: 'right' }));
        data = this.concatArrays(data, this.lineFeed(1));
        data = this.concatArrays(data, this.textToEscPos(`Change:      ₱${Number(transaction.change || 0).toFixed(2)}`, { align: 'right' }));
        data = this.concatArrays(data, this.lineFeed(1));
      }
      data = this.concatArrays(data, this.lineFeed(1));

      // Separator "="
      data = this.concatArrays(data, this.textToEscPos('================================', { align: 'center' }));
      data = this.concatArrays(data, this.lineFeed(1));

      // --- FOOTER ---
      data = this.concatArrays(data, this.textToEscPos(footerText, { align: 'center', bold: true }));
      data = this.concatArrays(data, this.lineFeed(1));
      data = this.concatArrays(data, this.textToEscPos('Powered by INVENTRA', { align: 'center' }));
      data = this.concatArrays(data, this.lineFeed(4));

      // Cut
      data = this.concatArrays(data, this.cutPaper());

      await this.sendRaw(data);
      console.log('[WebUSB] Receipt printed successfully');
    } catch (error) {
      console.error('[WebUSB] Print error:', error);
      throw error;
    }
  }
}

export const usbRawPrinter = new USBRawPrinter();
export default usbRawPrinter;