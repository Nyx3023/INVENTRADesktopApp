const defaultFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2
});

// Get store info from localStorage
const getStoreInfoFromStorage = () => {
  try {
    const savedStoreInfo = localStorage.getItem('storeInfo');
    if (savedStoreInfo) {
      const parsed = JSON.parse(savedStoreInfo);
      // Parse address into two lines if needed
      const addressParts = (parsed.address || '').split(',').map(s => s.trim());
      return {
        name: parsed.storeName || 'JBO Arts & Crafts Trading',
        addressLine1: addressParts[0] || '#303 B1A J.R. Blvd Tagapo',
        addressLine2: addressParts.slice(1).join(', ') || 'Santa Rosa, Philippines',
        phone: parsed.phone || '0932 868 7911',
        tagline: parsed.tagline || ''
      };
    }
  } catch (e) {
    console.error('Error parsing store info:', e);
  }
  return null;
};

export const defaultStoreProfile = {
  name: 'JBO Arts & Crafts Trading',
  addressLine1: '#303 B1A J.R. Blvd Tagapo',
  addressLine2: 'Santa Rosa, Philippines',
  phone: '0932 868 7911',
  tagline: ''
};

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeItems = (items) => {
  if (!items) return [];
  if (typeof items === 'string') {
    try {
      return JSON.parse(items);
    } catch {
      return [];
    }
  }
  return Array.isArray(items) ? items : [];
};

const formatMoney = (value) => defaultFormatter.format(Number(value || 0));

const parseReceiptTimestamp = (rawValue) => {
  if (!rawValue) return new Date(NaN);
  const value = String(rawValue);

  if (value.includes('Z') || /[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }

  // SQLite/MySQL DATETIME values are usually "YYYY-MM-DD HH:mm:ss" (UTC in this app).
  const utcParts = value.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (utcParts) {
    const [, year, month, day, hours, minutes, seconds] = utcParts;
    return new Date(Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hours),
      Number(minutes),
      Number(seconds)
    ));
  }

  // For ISO-like local strings without timezone (e.g. POS immediate print), keep local parse.
  return new Date(value);
};

const miniLogoSvg = `
<svg width="160" height="160" viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="80" cy="80" r="74" fill="#ffffff" stroke="#111111" stroke-width="6"/>
  <circle cx="80" cy="80" r="64" fill="none" stroke="#111111" stroke-width="2"/>
  <text x="80" y="62" text-anchor="middle" font-family="'Cinzel', 'Times New Roman', serif" font-size="36" font-weight="700" letter-spacing="6" fill="#111">JBO</text>
  <text x="80" y="96" text-anchor="middle" font-family="'Brush Script MT', 'Segoe Script', cursive" font-size="28" fill="#111">Arts &amp; Crafts</text>
  <text x="80" y="124" text-anchor="middle" font-family="'Brush Script MT', 'Segoe Script', cursive" font-size="30" fill="#111">Trading</text>
  <path d="M40 38c10 6 22 6 32 0 10 6 22 6 32 0" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>
  <path d="M40 132c10-6 22-6 32 0 10-6 22-6 32 0" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round"/>
</svg>
`;

const defaultLogoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(miniLogoSvg)}`;

export const buildReceiptHtml = (transaction, config) => {
  const items = normalizeItems(transaction.items);
  const rawPaymentMethod = (
    transaction.paymentMethod ||
    transaction.payment_method ||
    'cash'
  ).toString();
  const paymentMethod = rawPaymentMethod.toUpperCase();
  const isCashPayment = rawPaymentMethod.toLowerCase() === 'cash';

  const referenceNumber =
    transaction.referenceNumber || transaction.reference_number || '';

  const receivedAmount =
    transaction.receivedAmount ??
    transaction.received_amount ??
    (isCashPayment ? transaction.total : transaction.total);

  const changeAmount =
    transaction.change ??
    transaction.change_amount ??
    (isCashPayment
      ? (receivedAmount || 0) - (transaction.total || 0)
      : 0);

  const cashier =
    transaction.cashier ||
    transaction.processedBy ||
    transaction.processed_by ||
    transaction.user ||
    '';

  const transactionTimestamp = transaction.timestamp || transaction.created_at;
  const parsedTimestamp = parseReceiptTimestamp(transactionTimestamp);
  const transactionDate = !Number.isNaN(parsedTimestamp.getTime())
    ? parsedTimestamp.toLocaleString()
    : new Date().toLocaleString();

  const footerText = escapeHtml(
    config.footerText || 'Thank you for your business!'
  );

  // Get store info from localStorage first, then config, then defaults
  const storedInfo = getStoreInfoFromStorage();
  const store = {
    ...defaultStoreProfile,
    ...(storedInfo || {}),
    ...(config.store || {})
  };

  const logoSrc = config.logoDataUri || defaultLogoDataUri;

  const printableWidth = config.contentWidth || config.paperWidth;

  const itemsHtml = items
    .map((item) => {
      const name = escapeHtml(item.name || item.productName || 'Item');
      const quantity = Number(item.quantity || 0);
      const price = Number(item.price || item.unit_price || 0);
      const subtotal = (item.price || item.unit_price || 0) * quantity;
      return `
        <div class="item">
          <div class="item-name">${name}</div>
          <div class="item-detail">${quantity} × ${formatMoney(price)} = ${formatMoney(subtotal)}</div>
        </div>
      `;
    })
    .join('');

  const metadataLines = [
    cashier && `<div class="meta-line"><span>Cashier</span><span>${escapeHtml(cashier)}</span></div>`,
    referenceNumber &&
      `<div class="meta-line"><span>Reference #</span><span>${escapeHtml(referenceNumber)}</span></div>`
  ]
    .filter(Boolean)
    .join('');

  const sharpStyles = config.sharpRendering
    ? `
    html, body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      text-rendering: geometricPrecision;
      -webkit-font-smoothing: none;
      font-smooth: never;
    }
    body * {
      -webkit-font-smoothing: none !important;
      font-smooth: never !important;
    }
    `
    : '';

  // Check for user_name (snake_case from database) or userName (camelCase from frontend)
  const userName = transaction.userName || transaction.user_name || cashier || 'N/A';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Receipt ${escapeHtml(transaction.id || '')}</title>
  <style>
    @page {
      size: ${config.paperWidth} auto;
      margin: ${config.margin};
    }
    html, body {
      width: ${config.paperWidth};
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Courier New', 'Consolas', monospace;
      font-size: ${config.fontSize};
      line-height: ${config.lineHeight || 1.4};
      color: #000;
      background: #fff;
      text-rendering: optimizeLegibility;
      font-weight: normal;
      display: flex;
      justify-content: center;
      padding: 0;
      margin: 0;
    }
    .receipt {
      width: ${printableWidth};
      max-width: 100%;
      margin: 0 auto;
      padding: ${config.bodyPadding || '4mm 2mm'};
    }
    ${sharpStyles}
    
    /* Beautiful Header - Centered */
    .header {
      text-align: center;
      margin-bottom: 12px;
    }
    .store-name {
      font-size: 1.5rem;
      font-weight: bold;
      letter-spacing: 1px;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .store-address {
      font-size: 0.9rem;
      line-height: 1.4;
      margin: 3px 0;
    }
    .store-phone {
      font-size: 0.9rem;
      margin: 3px 0;
      font-weight: 500;
    }
    
    /* Separator Lines */
    .divider {
      text-align: center;
      margin: 10px 0;
      font-size: 0.9rem;
      letter-spacing: -0.5px;
      font-weight: bold;
    }
    .divider-double {
      text-align: center;
      margin: 10px 0;
      font-size: 0.95rem;
      letter-spacing: -0.5px;
      font-weight: bold;
    }
    
    /* Receipt Info */
    .receipt-info {
      margin: 10px 0;
      font-size: 0.9rem;
      line-height: 1.5;
    }
    .receipt-info div {
      margin: 3px 0;
    }
    .receipt-info strong {
      font-weight: bold;
    }
    
    /* Items Section */
    .section-title {
      text-align: center;
      font-weight: bold;
      text-transform: uppercase;
      margin: 12px 0 8px 0;
      font-size: 1rem;
      letter-spacing: 1px;
    }
    .items {
      margin: 8px 0;
    }
    .item {
      margin-bottom: 8px;
    }
    .item-name {
      font-weight: bold;
      margin-bottom: 3px;
      font-size: 1rem;
    }
    .item-detail {
      text-align: right;
      font-size: 0.9rem;
      margin-bottom: 4px;
    }
    
    /* Summary/Totals */
    .summary {
      margin-top: 10px;
    }
    .summary-line {
      display: flex;
      justify-content: space-between;
      margin: 4px 0;
      font-size: 1rem;
    }
    .summary-line.total {
      font-weight: bold;
      font-size: 1.3rem;
      margin-top: 8px;
      padding-top: 6px;
      border-top: 2px solid #000;
    }
    
    /* Payment Info */
    .payment-section {
      margin-top: 12px;
    }
    .payment-method {
      font-weight: bold;
      margin-bottom: 6px;
      font-size: 1rem;
    }
    
    /* Footer */
    .footer {
      text-align: center;
      margin-top: 14px;
      font-size: 0.9rem;
    }
    .footer-thank-you {
      font-weight: bold;
      margin-bottom: 6px;
      font-size: 1rem;
    }
    .footer-powered {
      font-size: 0.85rem;
      color: #333;
    }
    
    /* Cut Line */
    .cut-line {
      text-align: center;
      margin-top: 12px;
      font-size: 0.8em;
      letter-spacing: 0.3em;
    }
  </style>
</head>
<body>
  <div class="receipt">
    <!-- Beautiful Header - Centered -->
    <div class="header">
      <div class="store-name">${escapeHtml(store.name)}</div>
      <div class="store-address">${escapeHtml(store.addressLine1)}</div>
      <div class="store-address">${escapeHtml(store.addressLine2)}</div>
      <div class="store-phone">${escapeHtml(store.phone || '')}</div>
    </div>

    <!-- Separator -->
    <div class="divider-double">================================</div>

    <!-- Receipt Info -->
    <div class="receipt-info">
      <div><strong>Receipt #:</strong> ${escapeHtml(transaction.id || transaction.transactionId || '')}</div>
      <div><strong>Date:</strong> ${escapeHtml(transactionDate)}</div>
      <div><strong>Cashier:</strong> ${escapeHtml(userName)}</div>
      ${referenceNumber ? `<div><strong>Ref No:</strong> ${escapeHtml(referenceNumber)}</div>` : ''}
    </div>

    <!-- Separator -->
    <div class="divider-double">================================</div>

    <!-- Items Section -->
    <div class="section-title">ITEMS</div>
    <div class="items">
      ${itemsHtml || '<div class="item"><div class="item-name">No items</div></div>'}
    </div>

    <!-- Separator -->
    <div class="divider">--------------------------------</div>

    <!-- Totals -->
    <div class="summary">
      <div class="summary-line">
        <span>SUBTOTAL:</span>
        <span>${formatMoney(transaction.subtotal)}</span>
      </div>
      ${(transaction.discount_percentage > 0 || transaction.discountPercentage > 0) ? `
      <div class="summary-line">
        <span>DISC (${transaction.discount_percentage || transaction.discountPercentage}%):</span>
        <span>-${formatMoney(transaction.discount_amount || transaction.discountAmount || 0)}</span>
      </div>
      ` : ''}
      <div class="summary-line">
        <span>TAX:</span>
        <span>${formatMoney(transaction.tax)}</span>
      </div>
      <div class="summary-line total">
        <span>TOTAL:</span>
        <span>${formatMoney(transaction.total)}</span>
      </div>
    </div>

    <!-- Payment Info -->
    <div class="payment-section">
      <div class="payment-method">Payment: ${escapeHtml(paymentMethod)}</div>
      ${isCashPayment ? `
      <div class="summary-line">
        <span>Received:</span>
        <span>${formatMoney(receivedAmount)}</span>
      </div>
      <div class="summary-line">
        <span>Change:</span>
        <span>${formatMoney(changeAmount)}</span>
      </div>
      ` : ''}
    </div>

    <!-- Separator -->
    <div class="divider-double">================================</div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-thank-you">${footerText || 'Thank you for your purchase!'}</div>
      <div class="footer-powered">Powered by INVENTRA</div>
    </div>

    ${config.showCutLine ? '<div class="cut-line">--------------------</div>' : ''}
  </div>
</body>
</html>`;
};

export default buildReceiptHtml;

