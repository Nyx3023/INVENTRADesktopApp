# Electron Offline Desktop + XPRINTER Guide

## Folder Structure (new desktop layer)

```text
26-electron-work/
  electron/
    main.cjs
    preload.cjs
    printer/
      thermal-printer.cjs
  src/
    components/Settings/SettingsScreen.jsx   (desktop printer detection bridge)
    utils/printerService.js                  (uses window.printer.printReceipt)
  server/
    index.js                                 (supports DIST_DIR override for Electron runtime)
  package.json                               (electron + electron-builder scripts/config)
```

## Runtime Design

- React UI runs inside Electron renderer with `nodeIntegration: false` and `contextIsolation: true`.
- Node/Electron access is exposed only through `preload.cjs` via `contextBridge`.
- Backend server starts in Electron main process (offline, local-only) and serves local `dist`.
- Printing path is IPC-based:
  - Renderer: `window.printer.printReceipt(data)`
  - Main IPC handler: `printer:print-receipt`
  - Native print manager: `electron/printer/thermal-printer.cjs`
  - Transport:
    - Primary: USB raw ESC/POS via `escpos` + `escpos-usb`
    - Optional fallback: Bluetooth paired COM port via `serialport`

## Exposed Renderer API

```js
window.printer.printReceipt(payload)
window.printer.printTest()
window.printer.getStatus()
window.printer.listPrinters()
window.printer.printReceiptBluetooth(payload)
window.printer.onStatusChange((status) => { ... })
```

## ESC/POS Example

The app sends raw ESC/POS bytes directly from main process:

- init: `ESC @`
- align: `ESC a n`
- bold: `ESC E n`
- size: `GS ! n`
- cut: `GS V A 3`

Commands are assembled into a single `Buffer` and sent through `escpos.Printer(...).raw(...)` with no OS print dialog.

## Build Instructions (Windows)

1. Install dependencies:
   - `npm install`
2. Build React:
   - `npm run build`
3. Run desktop app locally:
   - `npm run electron:start`
4. Build Windows installer (.exe):
   - `npm run electron:build`
5. Output:
   - `release/INVENTRA-Offline-Setup-<version>.exe`

## Native Module Notes

- `usb`, `escpos-usb`, and `serialport` are native modules.
- `electron-builder install-app-deps` is configured in `postinstall`.
- `asarUnpack` is configured so native binaries remain accessible at runtime.

## XPRINTER Troubleshooting

1. Printer not detected
   - Replug USB directly to PC (avoid hubs first).
   - Verify Windows Device Manager shows the printer.
   - Restart app to trigger auto-detection.

2. Print fails with disconnect/error
   - Check cable and power brick.
   - Ensure only one app is trying to write to the USB device.

3. Paper out / jam
   - Re-seat paper roll and close cover firmly.
   - Re-run `Test Print` from Settings tab.

4. Bluetooth limitations (important)
   - Reliable Bluetooth raw printing on Windows usually requires the printer to expose a paired Serial (SPP) COM port.
   - BLE-only printer profiles are often unreliable for ESC/POS streaming.
   - USB is the recommended production transport for speed/stability.

