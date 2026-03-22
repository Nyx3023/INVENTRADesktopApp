const { contextBridge, ipcRenderer } = require('electron');

const printerApi = {
  printReceipt: async (data) => ipcRenderer.invoke('printer:print-receipt', data),
  printTest: async () => ipcRenderer.invoke('printer:test-print'),
  getStatus: async () => ipcRenderer.invoke('printer:status'),
  listPrinters: async () => ipcRenderer.invoke('printer:list'),
  selectUsbPrinter: async (preferredId) => ipcRenderer.invoke('printer:select-usb', { preferredId }),
  autoConnect: async () => ipcRenderer.invoke('printer:auto-connect'),
  printReceiptSerial: async (data) => ipcRenderer.invoke('printer:print-receipt-serial', data),
  printReceiptBluetooth: async (data) => ipcRenderer.invoke('printer:print-receipt-bluetooth', data),
  onStatusChange: (listener) => {
    if (typeof listener !== 'function') {
      return () => undefined;
    }
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('printer:status-changed', wrapped);
    return () => ipcRenderer.removeListener('printer:status-changed', wrapped);
  },
};

contextBridge.exposeInMainWorld('printer', printerApi);
