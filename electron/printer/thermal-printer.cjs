const { EventEmitter } = require('events');
const { createHash } = require('crypto');
const { createRequire } = require('module');

const requireModule = createRequire(__filename);
const usbModule = requireModule('usb');
const { SerialPort } = requireModule('serialport');
const usbRuntime = usbModule?.usb && typeof usbModule.usb === 'object'
  ? usbModule.usb
  : usbModule;
if (typeof usbModule.on !== 'function' && typeof usbRuntime?.on === 'function') {
  usbModule.on = usbRuntime.on.bind(usbRuntime);
}
if (typeof usbModule.removeAllListeners !== 'function' && typeof usbRuntime?.removeAllListeners === 'function') {
  usbModule.removeAllListeners = usbRuntime.removeAllListeners.bind(usbRuntime);
}
if (typeof usbModule.getDeviceList !== 'function' && typeof usbRuntime?.getDeviceList === 'function') {
  usbModule.getDeviceList = usbRuntime.getDeviceList.bind(usbRuntime);
}

const escpos = requireModule('escpos');
escpos.USB = requireModule('escpos-usb');

const XPRINTER_VENDOR_IDS = new Set([
  0x0483,
  0x0519,
  0x0416,
]);

const ESC = 0x1b;
const GS = 0x1d;

const MAX_ITEM_NAME = 24;
const usbPrinterId = (printer) =>
  `${printer.vendorIdHex}-${printer.productIdHex}-${String(printer.deviceAddress)}`;

function sanitizeText(value) {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function makeReceiptId(transaction) {
  if (transaction?.id) return String(transaction.id);
  const payload = JSON.stringify(transaction || {});
  const hash = createHash('sha1').update(payload).digest('hex');
  return `OFFLINE-${hash.slice(0, 8).toUpperCase()}`;
}

class ThermalPrinterManager extends EventEmitter {
  constructor() {
    super();
    this.selectedUsbPrinter = null;
    this.selectedSerialPrinter = null;
    this.cachedUsbPrinters = [];
    this.cachedUsbSerialPorts = [];
    this.cachedBluetoothPorts = [];
    this.status = {
      connected: false,
      transport: 'usb',
      selectedPrinter: null,
      lastError: null,
      lastPrintedAt: null,
      paperStatus: 'unknown',
    };
    this._bindUsbEvents();
  }

  _bindUsbEvents() {
    if (typeof usbRuntime?.on !== 'function') {
      return;
    }

    usbRuntime.on('attach', () => {
      this.autoDetectUsbPrinter();
    });
    usbRuntime.on('detach', () => {
      const previous = this.selectedUsbPrinter;
      this.autoDetectUsbPrinter();
      if (previous && !this.selectedUsbPrinter) {
        this._emitStatus({
          connected: false,
          lastError: 'Selected printer disconnected.',
        });
      }
    });
  }

  _emitStatus(patch) {
    this.status = {
      ...this.status,
      ...patch,
    };
    this.emit('status', { ...this.status });
  }

  _isUsbPrinterDevice(device) {
    const descriptor = device.deviceDescriptor || {};
    if (XPRINTER_VENDOR_IDS.has(descriptor.idVendor)) {
      return true;
    }
    if (descriptor.bDeviceClass === 0x07) {
      return true;
    }
    const config = device.configDescriptor || device.allConfigDescriptors?.[0];
    if (!config?.interfaces || !Array.isArray(config.interfaces)) {
      return false;
    }
    for (const ifaceGroup of config.interfaces) {
      const ifaceList = Array.isArray(ifaceGroup) ? ifaceGroup : [ifaceGroup];
      for (const iface of ifaceList) {
        if (iface.bInterfaceClass === 0x07) {
          return true;
        }
      }
    }
    return false;
  }

  detectUsbPrinters() {
    const getDeviceList = usbRuntime?.getDeviceList || usbModule?.getDeviceList;
    if (typeof getDeviceList !== 'function') {
      this.cachedUsbPrinters = [];
      return [];
    }
    const devices = getDeviceList.call(usbRuntime);
    const mapped = [];
    for (const device of devices) {
      if (!this._isUsbPrinterDevice(device)) {
        continue;
      }
      const vendorId = device.deviceDescriptor.idVendor;
      const productId = device.deviceDescriptor.idProduct;
      mapped.push({
        id: `usb-${vendorId.toString(16).padStart(4, '0')}-${productId.toString(16).padStart(4, '0')}-${String(device.deviceAddress)}`,
        transport: 'usb',
        vendorId,
        productId,
        vendorIdHex: `0x${vendorId.toString(16).padStart(4, '0')}`,
        productIdHex: `0x${productId.toString(16).padStart(4, '0')}`,
        busNumber: device.busNumber,
        deviceAddress: device.deviceAddress,
        isXprinter: XPRINTER_VENDOR_IDS.has(vendorId),
      });
    }
    this.cachedUsbPrinters = mapped;
    return mapped;
  }

  async detectBluetoothPorts() {
    const ports = await SerialPort.list();
    const mapped = ports
      .filter((port) => {
        const name = `${port.friendlyName || ''} ${port.manufacturer || ''}`.toLowerCase();
        const pnp = String(port.pnpId || '').toLowerCase();
        return name.includes('bluetooth') || name.includes('xprinter') || name.includes('bth') || pnp.includes('bthenum');
      })
      .map((port) => ({
        id: `bt-${port.path}`,
        transport: 'bluetooth',
        path: port.path,
        pnpId: port.pnpId,
        manufacturer: port.manufacturer,
        friendlyName: port.friendlyName || port.manufacturer || 'Bluetooth serial printer',
      }));
    this.cachedBluetoothPorts = mapped;
    return mapped;
  }

  async detectUsbSerialPorts() {
    const ports = await SerialPort.list();
    const mapped = ports
      .filter((port) => {
        const name = `${port.friendlyName || ''} ${port.manufacturer || ''}`.toLowerCase();
        const pnp = String(port.pnpId || '').toLowerCase();
        return (
          pnp.includes('usb') ||
          name.includes('xprinter') ||
          name.includes('usb serial') ||
          name.includes('ch340') ||
          name.includes('prolific') ||
          name.includes('ftdi')
        );
      })
      .map((port) => ({
        id: `usb-serial-${port.path}`,
        transport: 'usb_serial',
        path: port.path,
        pnpId: port.pnpId,
        manufacturer: port.manufacturer,
        friendlyName: port.friendlyName || `USB Serial Printer (${port.path})`,
      }));
    this.cachedUsbSerialPorts = mapped;
    return mapped;
  }

  autoDetectUsbPrinter() {
    const printers = this.detectUsbPrinters();
    const preferred = printers.find((printer) => printer.isXprinter) || printers[0] || null;
    this.selectedUsbPrinter = preferred;
    this._emitStatus({
      connected: !!preferred,
      selectedPrinter: preferred,
      transport: 'usb',
      lastError: preferred ? null : 'No USB thermal printer detected.',
    });
    return preferred;
  }

  async selectUsbPrinter(preferredId) {
    const printers = this.detectUsbPrinters();
    const usbSerialPorts = await this.detectUsbSerialPorts();
    if (preferredId && String(preferredId).startsWith('usb-serial-')) {
      const matchedSerial = usbSerialPorts.find((port) => port.id === preferredId);
      if (!matchedSerial) {
        throw {
          code: 'PRINTER_NOT_CONNECTED',
          message: 'Selected USB serial printer is no longer available.',
        };
      }
      await this._probeSerialPort(matchedSerial.path);
      this.selectedUsbPrinter = null;
      this.selectedSerialPrinter = matchedSerial;
      this._emitStatus({
        connected: true,
        selectedPrinter: matchedSerial,
        transport: 'usb_serial',
        lastError: null,
      });
      return matchedSerial;
    }

    if (!printers.length) {
      if (usbSerialPorts.length > 0) {
        const serialPreferred = usbSerialPorts[0];
        await this._probeSerialPort(serialPreferred.path);
        this.selectedUsbPrinter = null;
        this.selectedSerialPrinter = serialPreferred;
        this._emitStatus({
          connected: true,
          selectedPrinter: serialPreferred,
          transport: 'usb_serial',
          lastError: null,
        });
        return serialPreferred;
      }
      const failure = {
        code: 'PRINTER_NOT_CONNECTED',
        message: 'No USB thermal printer detected.',
      };
      this.selectedUsbPrinter = null;
      this.selectedSerialPrinter = null;
      this._emitStatus({ connected: false, selectedPrinter: null, lastError: failure.message });
      throw failure;
    }

    let selected = printers.find((printer) => printer.id === preferredId);
    if (!selected && preferredId) {
      selected = printers.find((printer) => usbPrinterId(printer) === preferredId);
    }

    const orderedCandidates = [];
    if (selected) {
      orderedCandidates.push(selected);
    }
    for (const printer of printers.filter((printer) => printer.isXprinter)) {
      if (!orderedCandidates.find((candidate) => candidate.id === printer.id)) {
        orderedCandidates.push(printer);
      }
    }
    for (const printer of printers) {
      if (!orderedCandidates.find((candidate) => candidate.id === printer.id)) {
        orderedCandidates.push(printer);
      }
    }

    let lastProbeError = null;
    let connectedPrinter = null;
    for (const candidate of orderedCandidates) {
      try {
        await this._probeUsbPrinter(candidate);
        connectedPrinter = candidate;
        break;
      } catch (probeError) {
        lastProbeError = this._normalizePrintError(probeError);
      }
    }

    if (!connectedPrinter) {
      if (usbSerialPorts.length > 0) {
        const serialPreferred = usbSerialPorts[0];
        await this._probeSerialPort(serialPreferred.path);
        this.selectedUsbPrinter = null;
        this.selectedSerialPrinter = serialPreferred;
        this._emitStatus({
          connected: true,
          selectedPrinter: serialPreferred,
          transport: 'usb_serial',
          lastError: null,
        });
        return serialPreferred;
      }

      throw lastProbeError || {
        code: 'PRINTER_NOT_CONNECTED',
        message: 'Found USB devices but none accepted ESC/POS connection.',
      };
    }

    this.selectedUsbPrinter = connectedPrinter;
    this.selectedSerialPrinter = null;
    this._emitStatus({
      connected: true,
      selectedPrinter: connectedPrinter,
      transport: 'usb',
      lastError: null,
    });
    return connectedPrinter;
  }

  _probeSerialPort(path) {
    return new Promise((resolve, reject) => {
      const serial = new SerialPort({
        path,
        baudRate: 9600,
        autoOpen: false,
      });
      serial.open((openError) => {
        if (openError) {
          reject(openError);
          return;
        }
        serial.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve(true);
        });
      });
    });
  }

  _probeUsbPrinter(printer) {
    return new Promise((resolve, reject) => {
      const device = this._createEscposUsbAdapter(printer);
      device.open((openError) => {
        if (openError) {
          reject(this._normalizePrintError(openError));
          return;
        }
        device.close((closeError) => {
          if (closeError) {
            reject(this._normalizePrintError(closeError));
            return;
          }
          resolve(true);
        });
      });
    });
  }

  _resolveUsbDeviceHandle(printer) {
    const getDeviceList = usbRuntime?.getDeviceList || usbModule?.getDeviceList;
    if (typeof getDeviceList !== 'function') {
      return null;
    }
    const devices = getDeviceList.call(usbRuntime) || [];
    return devices.find((device) => {
      const descriptor = device?.deviceDescriptor || {};
      return (
        descriptor.idVendor === printer.vendorId &&
        descriptor.idProduct === printer.productId &&
        String(device.deviceAddress) === String(printer.deviceAddress)
      );
    }) || null;
  }

  _createEscposUsbAdapter(printer) {
    const exactDevice = this._resolveUsbDeviceHandle(printer);
    if (exactDevice) {
      return new escpos.USB(exactDevice);
    }
    return new escpos.USB(printer.vendorId, printer.productId);
  }

  getStatus() {
    const latestUsb = this.detectUsbPrinters();
    const hasSelectedUsb = this.selectedUsbPrinter
      ? latestUsb.some((printer) => printer.id === this.selectedUsbPrinter.id)
      : false;

    let hasSelectedSerial = false;
    if (this.selectedSerialPrinter?.path) {
      try {
        const ports = this.cachedUsbSerialPorts.length
          ? this.cachedUsbSerialPorts
          : [];
        hasSelectedSerial = ports.some((port) => port.path === this.selectedSerialPrinter.path);
      } catch {
        hasSelectedSerial = false;
      }
    }

    const hasExplicitSelection = !!this.selectedUsbPrinter || !!this.selectedSerialPrinter;
    const connected = hasExplicitSelection
      ? (hasSelectedUsb || hasSelectedSerial)
      : this.status.connected;
    return {
      ...this.status,
      connected,
      usbPrinters: [...this.cachedUsbPrinters],
      usbSerialPorts: [...this.cachedUsbSerialPorts],
      bluetoothPorts: [...this.cachedBluetoothPorts],
    };
  }

  async listPrinters() {
    const usbPrinters = this.detectUsbPrinters();
    const usbSerialPorts = await this.detectUsbSerialPorts();
    const bluetoothPorts = await this.detectBluetoothPorts();
    return {
      usbPrinters,
      usbSerialPorts,
      bluetoothPorts,
      selectedUsbPrinter: this.selectedUsbPrinter,
      selectedSerialPrinter: this.selectedSerialPrinter,
    };
  }

  async autoConnect() {
    try {
      return await this.selectUsbPrinter();
    } catch (error) {
      this._emitStatus({
        connected: false,
        lastError: error?.message || 'Auto-connect failed.',
      });
      return null;
    }
  }

  _line(align, text, opts = {}) {
    const alignCommand = align === 'center'
      ? Buffer.from([ESC, 0x61, 0x01])
      : align === 'right'
        ? Buffer.from([ESC, 0x61, 0x02])
        : Buffer.from([ESC, 0x61, 0x00]);
    const boldCommand = Buffer.from([ESC, 0x45, opts.bold ? 0x01 : 0x00]);
    const sizeCommand = opts.double
      ? Buffer.from([GS, 0x21, 0x11])
      : Buffer.from([GS, 0x21, 0x00]);
    const payload = Buffer.from(`${sanitizeText(text)}\n`, 'utf8');
    const reset = Buffer.from([ESC, 0x45, 0x00, GS, 0x21, 0x00]);
    return Buffer.concat([alignCommand, boldCommand, sizeCommand, payload, reset]);
  }

  _buildReceiptBuffer(data) {
    const tx = data?.transaction || data || {};
    const store = data?.store || tx.store || {};
    const items = Array.isArray(tx.items) ? tx.items : [];
    const receiptId = makeReceiptId(tx);
    const dateText = new Date(tx.timestamp || Date.now()).toLocaleString();
    const cashier = sanitizeText(tx.userName || tx.user_name || tx.cashier || 'N/A');
    const footer = sanitizeText(data?.footerText || 'Thank you for your purchase!');

    const chunks = [];
    chunks.push(Buffer.from([ESC, 0x40]));
    chunks.push(this._line('center', store.storeName || store.name || 'INVENTRA', { bold: true, double: true }));
    if (store.storeAddress) chunks.push(this._line('center', store.storeAddress));
    if (store.storeCity) chunks.push(this._line('center', store.storeCity));
    if (store.storePhone) chunks.push(this._line('center', store.storePhone));
    chunks.push(this._line('center', '================================'));
    chunks.push(this._line('left', `Receipt #: ${receiptId}`, { bold: true }));
    chunks.push(this._line('left', `Date: ${dateText}`));
    chunks.push(this._line('left', `Cashier: ${cashier}`));
    chunks.push(this._line('center', '================================'));
    chunks.push(this._line('center', 'ITEMS', { bold: true }));

    for (const item of items) {
      const itemName = sanitizeText(item.name || item.productName || 'Item').slice(0, MAX_ITEM_NAME);
      const qty = Number(item.quantity || 0);
      const price = Number(item.price || item.unit_price || 0);
      const subtotal = qty * price;
      chunks.push(this._line('left', itemName));
      chunks.push(this._line('right', `${qty} x ${money(price)} = ${money(subtotal)}`));
    }

    chunks.push(this._line('center', '--------------------------------'));
    chunks.push(this._line('right', `SUBTOTAL: ${money(tx.subtotal)}`));
    if (Number(tx.discount_amount || tx.discountAmount || 0) > 0) {
      const discountPct = Number(tx.discount_percentage || tx.discountPercentage || 0);
      chunks.push(this._line('right', `DISCOUNT${discountPct ? ` (${discountPct}%)` : ''}: -${money(tx.discount_amount || tx.discountAmount)}`));
    }
    chunks.push(this._line('right', `TAX: ${money(tx.tax)}`));
    chunks.push(this._line('right', `TOTAL: ${money(tx.total)}`, { bold: true, double: true }));
    chunks.push(this._line('left', `Payment: ${sanitizeText(tx.paymentMethod || 'Cash')}`, { bold: true }));
    if (typeof tx.receivedAmount !== 'undefined') {
      chunks.push(this._line('right', `Received: ${money(tx.receivedAmount)}`));
      chunks.push(this._line('right', `Change: ${money(tx.change)}`));
    }
    chunks.push(this._line('center', '================================'));
    chunks.push(this._line('center', footer, { bold: true }));
    chunks.push(this._line('center', 'Powered by INVENTRA'));
    chunks.push(Buffer.from('\n\n\n', 'utf8'));
    chunks.push(Buffer.from([GS, 0x56, 0x41, 0x03]));
    return Buffer.concat(chunks);
  }

  _normalizePrintError(error) {
    const message = String(error?.message || error || 'Unknown printer error');
    const lower = message.toLowerCase();
    if (
      lower.includes('libusb_error_no_device') ||
      lower.includes('libusb_error_not_found') ||
      lower.includes('not found')
    ) {
      return { code: 'PRINTER_NOT_CONNECTED', message: 'Printer not connected or disconnected during print.' };
    }
    if (lower.includes('libusb_error_access') || lower.includes('access denied')) {
      return {
        code: 'PRINTER_ACCESS_DENIED',
        message: 'USB access denied. Another driver or process is locking the printer.',
      };
    }
    if (lower.includes('stall') || lower.includes('paper')) {
      return { code: 'PAPER_OUT', message: 'Printer appears to be out of paper or blocked.' };
    }
    if (lower.includes('busy') || lower.includes('timeout')) {
      return { code: 'PRINTER_BUSY', message: 'Printer is busy or not responding.' };
    }
    return { code: 'PRINT_FAILED', message };
  }

  _printViaUsbDevice(printer, payload) {
    return new Promise((resolve, reject) => {
      const device = this._createEscposUsbAdapter(printer);
      const printerClient = new escpos.Printer(device);
      device.open((openError) => {
        if (openError) {
          reject(openError);
          return;
        }

        try {
          printerClient.raw(payload);
          printerClient.close();
          resolve({
            ok: true,
            transport: 'usb',
            printer,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async printReceipt(data) {
    if (this.selectedSerialPrinter?.transport === 'usb_serial') {
      return this._writeSerialReceipt(data, this.selectedSerialPrinter.path, 'usb_serial');
    }

    const printer = this.selectedUsbPrinter || this.autoDetectUsbPrinter();
    if (!printer) {
      const failure = { code: 'PRINTER_NOT_CONNECTED', message: 'No USB thermal printer detected.' };
      this._emitStatus({ connected: false, lastError: failure.message });
      throw failure;
    }

    const payload = this._buildReceiptBuffer(data);

    try {
      const result = await this._printViaUsbDevice(printer, payload);
      this._emitStatus({
        connected: true,
        paperStatus: 'ok',
        lastError: null,
        lastPrintedAt: new Date().toISOString(),
        selectedPrinter: printer,
        transport: 'usb',
      });
      return result;
    } catch (firstError) {
      const normalizedFirst = this._normalizePrintError(firstError);
      const shouldRetryAfterHotplug = normalizedFirst.code === 'PRINTER_NOT_CONNECTED';

      if (!shouldRetryAfterHotplug) {
        this._emitStatus({
          connected: false,
          paperStatus: normalizedFirst.code === 'PAPER_OUT' ? 'paper_out' : 'unknown',
          lastError: normalizedFirst.message,
        });
        throw normalizedFirst;
      }

      // Hotplug recovery: re-detect/re-select and retry once.
      try {
        const recovered = await this.selectUsbPrinter(this.selectedUsbPrinter?.id || printer?.id);
        if (recovered?.transport === 'usb_serial') {
          return this._writeSerialReceipt(data, recovered.path, 'usb_serial');
        }
        const retried = await this._printViaUsbDevice(recovered, payload);
        this._emitStatus({
          connected: true,
          paperStatus: 'ok',
          lastError: null,
          lastPrintedAt: new Date().toISOString(),
          selectedPrinter: recovered,
          transport: 'usb',
        });
        return retried;
      } catch (retryError) {
        const normalizedRetry = this._normalizePrintError(retryError);
        this._emitStatus({
          connected: false,
          paperStatus: normalizedRetry.code === 'PAPER_OUT' ? 'paper_out' : 'unknown',
          lastError: normalizedRetry.message,
        });
        throw normalizedRetry;
      }
    }
  }

  async printViaBluetoothSerial(data, selectedPath) {
    const ports = this.cachedBluetoothPorts.length ? this.cachedBluetoothPorts : await this.detectBluetoothPorts();
    const target = ports.find((port) => port.path === selectedPath) || ports[0];
    if (!target) {
      throw {
        code: 'BLUETOOTH_UNAVAILABLE',
        message: 'No Bluetooth serial printer detected. Pair the printer first (COM port profile).',
      };
    }

    return this._writeSerialReceipt(data, target.path, 'bluetooth');
  }

  async printViaSerialPath(data, portPath) {
    if (!portPath || typeof portPath !== 'string') {
      throw {
        code: 'USB_SERIAL_UNAVAILABLE',
        message: 'No USB serial COM port selected.',
      };
    }
    return this._writeSerialReceipt(data, portPath, 'usb_serial');
  }

  _writeSerialReceipt(data, path, transport) {
    const payload = this._buildReceiptBuffer(data);
    return new Promise((resolve, reject) => {
      const serial = new SerialPort({
        path,
        baudRate: 9600,
        autoOpen: false,
      });

      serial.open((openError) => {
        if (openError) {
          reject({
            code: transport === 'bluetooth' ? 'BLUETOOTH_OPEN_FAILED' : 'USB_SERIAL_OPEN_FAILED',
            message: `Failed to open ${transport === 'bluetooth' ? 'Bluetooth' : 'USB serial'} COM port ${path}: ${openError.message}`,
          });
          return;
        }

        serial.write(payload, (writeError) => {
          if (writeError) {
            serial.close(() => undefined);
            reject({
              code: transport === 'bluetooth' ? 'BLUETOOTH_WRITE_FAILED' : 'USB_SERIAL_WRITE_FAILED',
              message: `Failed writing to ${transport === 'bluetooth' ? 'Bluetooth' : 'USB serial'} COM port ${path}: ${writeError.message}`,
            });
            return;
          }
          serial.drain(() => {
            serial.close(() => undefined);
            this._emitStatus({
              connected: true,
              selectedPrinter: transport === 'usb_serial' ? this.selectedSerialPrinter : this.status.selectedPrinter,
              transport,
              lastError: null,
              lastPrintedAt: new Date().toISOString(),
            });
            resolve({
              ok: true,
              transport,
              port: path,
              note: transport === 'bluetooth'
                ? 'Bluetooth raw print uses paired COM ports. Reliability depends on the printer profile/driver.'
                : 'USB serial raw print via COM port.',
            });
          });
        });
      });
    });
  }
}

module.exports = {
  ThermalPrinterManager,
};
