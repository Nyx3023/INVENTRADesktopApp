import { buildReceiptHtml, defaultStoreProfile } from './receiptTemplate.js';

const defaultConfig = {
  paperWidth: '58mm',
  contentWidth: '56mm',
  margin: '0mm',
  bodyPadding: '1mm 1.5mm 4mm 1.5mm',
  fontSize: '12px',
  lineHeight: 1.3,
  footerText: '',
  store: defaultStoreProfile,
  showCutLine: true,
  autoPrintDelay: 200,
  silent: true,
  sharpRendering: true,
  useNativePrinter: true,
  nativePrinterUrl: 'http://localhost:37221/print',
  nativePrinterTimeout: 4000,
  deviceName: '',
  nativePrinterHeaders: {},
  logoDataUri: undefined
};

const nativeConfigKeys = [
  'paperWidth',
  'contentWidth',
  'margin',
  'bodyPadding',
  'fontSize',
  'lineHeight',
  'footerText',
  'store',
  'showCutLine',
  'silent',
  'sharpRendering',
  'deviceName',
  'logoDataUri'
];

const sanitizeNativeConfig = (config) =>
  nativeConfigKeys.reduce((acc, key) => {
    if (typeof config[key] !== 'undefined') {
      acc[key] = config[key];
    }
    return acc;
  }, {});

const tryNativePrinter = async (transaction, config) => {
  if (
    typeof window === 'undefined' ||
    typeof fetch === 'undefined' ||
    !config.useNativePrinter ||
    !config.nativePrinterUrl
  ) {
    return false;
  }

  try {
    console.info(
      '[ThermalPrinter] Sending native print job to',
      config.nativePrinterUrl,
      'for receipt',
      transaction?.id ?? '(no id)'
    );
  } catch {
    /* ignore console permission errors */
  }

  const payload = {
    transaction,
    config: sanitizeNativeConfig(config)
  };

  const controller =
    typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = Number(config.nativePrinterTimeout) || 4000;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    const response = await fetch(config.nativePrinterUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.nativePrinterHeaders || {})
      },
      body: JSON.stringify(payload),
      signal: controller?.signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Native printer rejected the request.');
    }

    try {
      console.info('[ThermalPrinter] Native printer accepted the job.');
    } catch {
      /* ignore */
    }
    return true;
  } catch (error) {
    console.warn(
      '[ThermalPrinter] Native printer unavailable, falling back to browser print.',
      error?.message || error
    );
    return false;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const printThermalReceipt = async (transaction, options = {}) => {
  if (typeof document === 'undefined') {
    throw new Error('Thermal printing is only available in the browser.');
  }

  if (!transaction) {
    throw new Error('No transaction data provided for printing.');
  }

  const config = {
    ...defaultConfig,
    ...options,
    store: {
      ...defaultStoreProfile,
      ...(options.store || {})
    },
    autoPrintDelay: 0
  };

  const usedNativePrinter = await tryNativePrinter(transaction, config);
  if (usedNativePrinter) {
    return;
  }

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '100%';
    iframe.style.bottom = '100%';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const cleanup = () => {
      setTimeout(() => {
        iframe.remove();
      }, 100);
    };

    const handleError = (error) => {
      cleanup();
      reject(error);
    };

    const handlePrint = () => {
      try {
        const printOptions =
          config.silent &&
          /Electron|NW.js/i.test(
            iframe.contentWindow?.navigator?.userAgent || ''
          )
            ? { silent: true, printBackground: true }
            : undefined;

        const printResult = iframe.contentWindow.print();

        if (printResult && typeof printResult.then === 'function') {
          printResult
            .then(() => {
              cleanup();
              resolve();
            })
            .catch(handleError);
        } else {
          cleanup();
          resolve();
        }
      } catch (error) {
        handleError(error);
      }
    };

    iframe.onload = () => {
      setTimeout(handlePrint, config.autoPrintDelay);
    };

    try {
      const doc = iframe.contentWindow?.document;
      if (!doc) {
        throw new Error('Unable to access print document.');
      }
      doc.open();
      doc.write(buildReceiptHtml(transaction, config));
      doc.close();
    } catch (error) {
      handleError(error);
    }
  });
};

export { buildReceiptHtml };

export default printThermalReceipt;

