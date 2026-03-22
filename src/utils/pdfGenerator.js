import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { JBO_LOGO } from './logo';

/* ===============================
   BRAND COLORS
================================ */
const COLORS = {
  gold: [218, 165, 32],
  goldDark: [184, 134, 11],
  dark: [31, 41, 55],
  muted: [107, 114, 128],
  light: [245, 245, 235],
  line: [220, 220, 220],
};

/* ===============================
   FORMATTERS
================================ */
const formatAmount = (value = 0) => {
  const num = Number(value) || 0;
  return Math.abs(num).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDiscount = (value = 0) => {
  const num = Number(value) || 0;
  return num > 0 ? `-${formatAmount(num)}` : '0.00';
};

/* ===============================
   STORE INFO
================================ */
const getStoreInfo = () => {
  try {
    const savedStoreInfo = localStorage.getItem('storeInfo');
    if (savedStoreInfo) {
      const parsed = JSON.parse(savedStoreInfo);
      return {
        storeName: parsed.storeName || 'JBO Arts & Crafts Trading',
        address: parsed.address || '#303 B1A J.R. Blvd Tagapo, Santa Rosa, Philippines',
        phone: parsed.phone || '0932 868 7911',
        email: parsed.email || 'jboartsandcrafts@gmail.com',
        tagline: parsed.tagline || ''
      };
    }
  } catch (e) {
    console.error('Error parsing store info:', e);
  }
  return {
    storeName: 'JBO Arts & Crafts Trading',
    address: '#303 B1A J.R. Blvd Tagapo, Santa Rosa, Philippines',
    phone: '0932 868 7911',
    email: 'jboartsandcrafts@gmail.com',
    tagline: ''
  };
};

/* ===============================
   MAIN GENERATOR
================================ */
export const generatePurchaseOrderPDF = (order, items, supplier) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const store = getStoreInfo();

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const headerHeight = 45;

  /* ---------- HEADER ---------- */
  doc.setFillColor(...COLORS.light);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  if (JBO_LOGO) {
    const logoSize = 26;
    const logoY = (headerHeight - logoSize) / 2;
    doc.addImage(JBO_LOGO, 'PNG', margin, logoY, logoSize, logoSize);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.dark);
  doc.text('INVOICE', pageWidth - margin, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Invoice No: ${order?.id || '—'}`, pageWidth - margin, 28, { align: 'right' });
  doc.text(
    `Date: ${new Date(order?.order_date || new Date()).toLocaleDateString()}`,
    pageWidth - margin,
    34,
    { align: 'right' }
  );

  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.8);
  doc.line(margin, headerHeight + 1, pageWidth - margin, headerHeight + 1);

  /* ---------- COMPANY INFO ---------- */
  let y = headerHeight + 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(store.storeName, margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.muted);
  doc.text(store.address, margin, y + 6);
  doc.text(store.phone, margin, y + 12);
  doc.text(store.email, margin, y + 18);

  /* ---------- BILL TO / SUPPLIER ---------- */
  y += 30;
  doc.setDrawColor(...COLORS.line);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.text('BILL TO', margin, y);
  doc.text('SUPPLIER', pageWidth / 2, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(store.storeName, margin, y + 8);
  doc.text(store.address, margin, y + 14);
  doc.text(store.phone, margin, y + 20);

  // Supplier info with text wrapping for address
  const supplierName = supplier?.name || '—';
  const supplierAddress = supplier?.address || '—';
  const supplierPhone = supplier?.phone || '—';
  
  doc.text(supplierName, pageWidth / 2, y + 8);
  
  // Wrap supplier address to fit within available width (pageWidth/2 to margin)
  const addressMaxWidth = (pageWidth - margin) - (pageWidth / 2);
  const addressLines = doc.splitTextToSize(supplierAddress, addressMaxWidth);
  let addressY = y + 14;
  addressLines.forEach((line) => {
    doc.text(line, pageWidth / 2, addressY);
    addressY += 5; // Line spacing
  });
  
  doc.text(supplierPhone, pageWidth / 2, addressY);

  /* ---------- ITEMS TABLE ---------- */
  const safeItems = Array.isArray(items) ? items : [];
  const tableStartY = y + 35;

  const tableBody =
    safeItems.length > 0
      ? safeItems.map((item) => {
          const qty = Number(item.quantity || 0);
          const price = Number(item.unitCost || item.unit_cost || 0);
          return [
            item.productName || item.name || 'Item',
            qty.toString(),
            formatAmount(price),
            formatAmount(qty * price),
          ];
        })
      : [['No items', '-', '0.00', '0.00']];

  doc.autoTable({
    startY: tableStartY,
    head: [['ITEM DESCRIPTION', 'QTY', 'UNIT PRICE', 'LINE TOTAL']],
    body: tableBody,
    margin: { left: margin, right: margin },
    pageBreak: 'auto',
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9.5,
      cellPadding: 6,
      textColor: COLORS.dark,
      lineColor: COLORS.line,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [245, 235, 200],
      textColor: COLORS.dark,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { halign: 'left', fontStyle: 'bold', fontSize: 11 },
      1: { halign: 'center', cellWidth: 20, fontSize: 10 },
      2: { halign: 'right', cellWidth: 30, fontSize: 10 },
      3: { halign: 'right', cellWidth: 30, fontSize: 10 },
    },
  });

  /* ---------- TOTALS ---------- */
  const subtotal = safeItems.reduce(
    (sum, i) => sum + Number(i.quantity || 0) * Number(i.unitCost || i.unit_cost || 0),
    0
  );

  const discount = Number(order?.discount || 0);
  const taxRate = Number(order?.taxRate || 0);
  const tax = (subtotal - discount) * (taxRate / 100);
  const grandTotal = subtotal - discount + tax;

  let totalsY = doc.lastAutoTable.finalY + 14;
  if (totalsY > pageHeight - 60) {
    doc.addPage();
    totalsY = margin;
  }

  const tx = pageWidth - margin - 70;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.dark);
  doc.text('Subtotal:', tx, totalsY);
  doc.text(formatAmount(subtotal), pageWidth - margin, totalsY, { align: 'right' });

  if (discount > 0) {
    totalsY += 7;
    doc.text('Discount:', tx, totalsY);
    doc.text(formatDiscount(discount), pageWidth - margin, totalsY, { align: 'right' });
  }

  if (taxRate > 0) {
    totalsY += 7;
    doc.text(`Tax (${taxRate}%):`, tx, totalsY);
    doc.text(formatAmount(tax), pageWidth - margin, totalsY, { align: 'right' });
  }

  totalsY += 15;
  doc.setDrawColor(...COLORS.gold);
  doc.setLineWidth(0.8);
  doc.line(tx, totalsY - 6, pageWidth - margin, totalsY - 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLORS.goldDark);
  doc.text('TOTAL:', tx, totalsY);
  doc.text(formatAmount(grandTotal), pageWidth - margin, totalsY, { align: 'right' });

  /* ---------- FOOTER ---------- */
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `${store.phone} • ${store.email}`,
      margin,
      pageHeight - 15
    );
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth - margin,
      pageHeight - 15,
      { align: 'right' }
    );
  }

  return doc;
};

/* ===============================
   EXPECTED EXPORT
================================ */
export const downloadPurchaseOrderPDF = (order, items, supplier) => {
  const doc = generatePurchaseOrderPDF(order, items, supplier);
  doc.save(`Invoice_${order?.id || 'draft'}.pdf`);
};

export default {
  generatePurchaseOrderPDF,
  downloadPurchaseOrderPDF,
};
