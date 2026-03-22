import { defaultStoreProfile } from '../utils/receiptTemplate.js';

// Get saved printer settings from localStorage
const getSavedPrinterSettings = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const saved = localStorage.getItem('printerSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('[ThermalPrinter] Failed to load saved printer settings:', e);
    }
  }
  return {};
};

export const THERMAL_RECEIPT_CONFIG = {
  paperWidth: '58mm',
  contentWidth: '56mm',
  margin: '0mm',
  bodyPadding: '1mm 1.5mm 4mm 1.5mm',
  fontSize: '12px',
  lineHeight: 1.3,
  footerText: '',
  store: defaultStoreProfile,
  showCutLine: true,
  autoPrintDelay: 100,
  silent: true, // Enable silent printing by default
  sharpRendering: true,
  useNativePrinter: true,
  nativePrinterUrl: 'http://localhost:37221/print',
  nativePrinterTimeout: 4000,
  deviceName: '', // Will be populated from settings
  nativePrinterHeaders: {},
  logoDataUri: undefined
};

export const buildReceiptConfig = (overrides = {}) => {
  const savedSettings = getSavedPrinterSettings();
  return {
    ...THERMAL_RECEIPT_CONFIG,
    deviceName: savedSettings.defaultPrinter || THERMAL_RECEIPT_CONFIG.deviceName,
    silent: savedSettings.silentPrint !== false, // Default to true
    ...overrides
  };
};

// Export helper to save printer settings
export const savePrinterSettings = (settings) => {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem('printerSettings', JSON.stringify(settings));
      return true;
    } catch (e) {
      console.warn('[ThermalPrinter] Failed to save printer settings:', e);
    }
  }
  return false;
};

// Export helper to get printer settings
export const getPrinterSettings = () => {
  return getSavedPrinterSettings();
};

