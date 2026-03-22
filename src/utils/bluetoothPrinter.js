/**
 * Bluetooth Thermal Printer Module
 * Supports Web Bluetooth API for direct browser-to-printer communication
 * ESC/POS command generation for thermal printers
 */

// ESC/POS Commands
const ESC = '\x1B';
const GS = '\x1D';

const COMMANDS = {
  INIT: ESC + '@',
  LINE_FEED: '\n',
  CUT_PAPER: GS + 'V' + String.fromCharCode(66) + String.fromCharCode(0),
  ALIGN_LEFT: ESC + 'a' + String.fromCharCode(0),
  ALIGN_CENTER: ESC + 'a' + String.fromCharCode(1),
  ALIGN_RIGHT: ESC + 'a' + String.fromCharCode(2),
  BOLD_ON: ESC + 'E' + String.fromCharCode(1),
  BOLD_OFF: ESC + 'E' + String.fromCharCode(0),
  UNDERLINE_ON: ESC + '-' + String.fromCharCode(1),
  UNDERLINE_OFF: ESC + '-' + String.fromCharCode(0),
  DOUBLE_HEIGHT: ESC + '!' + String.fromCharCode(16),
  DOUBLE_WIDTH: ESC + '!' + String.fromCharCode(32),
  DOUBLE_SIZE: ESC + '!' + String.fromCharCode(48),
  NORMAL_SIZE: ESC + '!' + String.fromCharCode(0),
  TEXT_SIZE: (height, width) => ESC + '!' + String.fromCharCode((height - 1) * 16 + (width - 1)),
  BARCODE_HEIGHT: (dots) => GS + 'h' + String.fromCharCode(dots),
  BARCODE_WIDTH: (width) => GS + 'w' + String.fromCharCode(width),
  PRINT_BARCODE: (data) => GS + 'k' + String.fromCharCode(73) + String.fromCharCode(data.length) + data,
  QR_CODE: (data) => {
    const dataLength = data.length;
    return GS + '(k' + String.fromCharCode(dataLength + 3) + String.fromCharCode(0) + String.fromCharCode(49) + String.fromCharCode(80) + String.fromCharCode(48) + data +
           GS + '(k' + String.fromCharCode(3) + String.fromCharCode(0) + String.fromCharCode(49) + String.fromCharCode(69) + String.fromCharCode(48) +
           GS + '(k' + String.fromCharCode(3) + String.fromCharCode(0) + String.fromCharCode(49) + String.fromCharCode(81) + String.fromCharCode(48);
  }
};

class BluetoothThermalPrinter {
  constructor() {
    this.device = null;
    this.characteristic = null;
    this.isConnected = false;
  }

  /**
   * Check if Web Bluetooth is supported
   */
  isSupported() {
    return 'bluetooth' in navigator && typeof navigator.bluetooth.requestDevice === 'function';
  }

  /**
   * Scan and connect to a Bluetooth thermal printer
   */
  async connect() {
    if (!this.isSupported()) {
      throw new Error('Web Bluetooth is not supported in this browser. Use Chrome, Edge, or Opera.');
    }

    try {
      // Request Bluetooth device with printer service filter
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common printer service
          { namePrefix: 'BlueTooth Printer' },
          { namePrefix: 'BT Printer' },
          { namePrefix: 'Thermal' }
        ],
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb',
          '49535343-fe7d-4ae5-8fa9-9fafd205e455'
        ]
      });

      console.log('Connecting to Bluetooth printer:', this.device.name);

      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      this.characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      this.isConnected = true;
      console.log('Connected to printer:', this.device.name);
      
      return {
        name: this.device.name,
        id: this.device.id
      };
    } catch (error) {
      this.isConnected = false;
      console.error('Bluetooth connection error:', error);
      throw new Error(`Failed to connect: ${error.message}`);
    }
  }

  /**
   * Disconnect from the printer
   */
  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      await this.device.gatt.disconnect();
      this.isConnected = false;
      console.log('Disconnected from printer');
    }
  }

  /**
   * Send raw data to the printer
   */
  async sendData(data) {
    if (!this.isConnected || !this.characteristic) {
      throw new Error('Printer not connected. Please connect first.');
    }

    try {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(data);
      
      // Split data into chunks (Bluetooth typically has 20-byte MTU limit)
      const chunkSize = 20;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        await this.characteristic.writeValue(chunk);
        // Small delay to prevent buffer overflow
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (error) {
      console.error('Error sending data to printer:', error);
      throw new Error(`Print failed: ${error.message}`);
    }
  }

  /**
   * Print text with formatting
   */
  async printText(text, options = {}) {
    let command = '';
    
    // Apply alignment
    if (options.align === 'center') command += COMMANDS.ALIGN_CENTER;
    else if (options.align === 'right') command += COMMANDS.ALIGN_RIGHT;
    else command += COMMANDS.ALIGN_LEFT;
    
    // Apply styling
    if (options.bold) command += COMMANDS.BOLD_ON;
    if (options.underline) command += COMMANDS.UNDERLINE_ON;
    
    // Apply size
    if (options.size === 'double') command += COMMANDS.DOUBLE_SIZE;
    else if (options.size === 'wide') command += COMMANDS.DOUBLE_WIDTH;
    else if (options.size === 'tall') command += COMMANDS.DOUBLE_HEIGHT;
    else command += COMMANDS.NORMAL_SIZE;
    
    command += text;
    
    // Reset styling
    if (options.bold) command += COMMANDS.BOLD_OFF;
    if (options.underline) command += COMMANDS.UNDERLINE_OFF;
    command += COMMANDS.NORMAL_SIZE;
    
    await this.sendData(command);
  }

  /**
   * Print line feed (newline)
   */
  async printLine(lines = 1) {
    await this.sendData(COMMANDS.LINE_FEED.repeat(lines));
  }

  /**
   * Print separator line
   */
  async printSeparator(char = '-') {
    await this.printText(char.repeat(32), { align: 'center' });
    await this.printLine();
  }

  /**
   * Cut paper
   */
  async cutPaper() {
    await this.sendData(COMMANDS.CUT_PAPER);
  }

  /**
   * Print a complete receipt
   */
  async printReceipt(transaction, config = {}) {
    try {
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
      } = config;

      // Initialize printer
      await this.sendData(COMMANDS.INIT);

      // Print header
      await this.printText(storeName, { align: 'center', bold: true, size: 'wide' });
      await this.printLine();
      await this.printText(storeAddress, { align: 'center' });
      await this.printLine();
      await this.printText(storeCity, { align: 'center' });
      await this.printLine();
      await this.printText(storePhone, { align: 'center' });
      await this.printLine(2);

      // Transaction info
      await this.printSeparator('=');
      await this.printText(`Receipt #: ${transaction.id}`, { bold: true });
      await this.printLine();
      await this.printText(`Date: ${new Date(transaction.timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })}`);
      await this.printLine();
      
      const refNo = transaction.referenceNumber || transaction.reference_number;
      if (refNo) {
        await this.printText(`Ref No: ${refNo}`);
        await this.printLine();
      }
      await this.printText(`Cashier: ${transaction.userName || transaction.user_name || 'N/A'}`);
      await this.printLine();
      await this.printSeparator('=');

      // Items
      await this.printText('ITEMS', { align: 'center', bold: true });
      await this.printLine();
      
      for (const item of transaction.items || []) {
        const itemName = (item.name || item.productName || 'Item').substring(0, 20);
        const qty = item.quantity || 0;
        const price = Number(item.price || item.unit_price || 0);
        const subtotal = qty * price;
        
        await this.printText(itemName);
        await this.printLine();
        await this.printText(`  ${qty} x ₱${price.toFixed(2)} = ₱${subtotal.toFixed(2)}`, { align: 'right' });
        await this.printLine();
      }

      await this.printSeparator('-');

      // Totals
      await this.printText(`SUBTOTAL:    ₱${Number(transaction.subtotal || 0).toFixed(2)}`, { align: 'right' });
      await this.printLine();
      
      const discountPct = transaction.discount_percentage || transaction.discountPercentage || 0;
      const discountAmt = transaction.discount_amount || transaction.discountAmount || 0;
      if (discountPct > 0) {
        await this.printText(`DISC (${discountPct}%):  -₱${Number(discountAmt).toFixed(2)}`, { align: 'right' });
        await this.printLine();
      }
      
      await this.printText(`TAX:         ₱${Number(transaction.tax || 0).toFixed(2)}`, { align: 'right' });
      await this.printLine();
      await this.printText(`TOTAL:       ₱${Number(transaction.total || 0).toFixed(2)}`, { 
        align: 'right', 
        bold: true, 
        size: 'wide' 
      });
      await this.printLine(2);

      // Payment info
      await this.printText(`Payment: ${transaction.paymentMethod || 'Cash'}`, { bold: true });
      await this.printLine();
      if (transaction.receivedAmount) {
        await this.printText(`Received:    ₱${Number(transaction.receivedAmount).toFixed(2)}`, { align: 'right' });
        await this.printLine();
        await this.printText(`Change:      ₱${Number(transaction.change || 0).toFixed(2)}`, { align: 'right' });
        await this.printLine();
      }

      await this.printLine();
      await this.printSeparator('=');

      // Footer
      await this.printText(footerText, { align: 'center', bold: true });
      await this.printLine();
      await this.printText('Powered by INVENTRA', { align: 'center' });
      await this.printLine(4);

      // Cut paper
      await this.cutPaper();

      return true;
    } catch (error) {
      console.error('Error printing receipt:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const bluetoothPrinter = new BluetoothThermalPrinter();
export default BluetoothThermalPrinter;
