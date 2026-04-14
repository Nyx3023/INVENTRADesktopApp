import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { JBO_LOGO } from './logo';

/* ===============================
   BRAND COLORS
================================ */
const COLORS = {
  black: [0, 0, 0],
  gray: [180, 180, 180],
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
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.3); // Default thin line for grids

  // 2. Header Section
  let y = margin + 10;
  
  // Left: Invoice/PO #
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Purchase Order #', margin + 5, y + 5);
  doc.line(margin + 35, y + 5, margin + 80, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(order?.id || '—', margin + 37, y + 4);

  // Right: Store Info
  const rightX = pageWidth - margin - 5;
  if (JBO_LOGO) {
    const logoSize = 20;
    doc.addImage(JBO_LOGO, 'PNG', rightX - logoSize + 4, y - 5, logoSize, logoSize);
    y += 18;
  } else {
    y += 5; // Extra spacing if no logo
  }
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(store.storeName, rightX, y, { align: 'right' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 5;
  doc.text(store.address, rightX, y, { align: 'right' });
  y += 4;
  doc.text(store.email, rightX, y, { align: 'right' });
  y += 4;
  doc.text(store.phone, rightX, y, { align: 'right' });

  // 3. Info Grid Section
  y = margin + 45;
  const gridHeight = 28;
  const col1W = 22;
  const col2W = contentWidth / 2 - col1W;
  const col3W = 28;
  const col4W = contentWidth / 2 - col3W;
  
  // Draw outer rect for grid
  doc.rect(margin, y, contentWidth, gridHeight);
  // Vertical split in middle
  const midX = margin + contentWidth / 2;
  doc.line(midX, y, midX, y + gridHeight);
  
  // Grid Rows
  const rowH = gridHeight / 4;
  for (let i = 1; i < 4; i++) {
    const lineY = y + (rowH * i);
    doc.line(margin, lineY, margin + contentWidth, lineY);
  }

  // Draw inner vertical dividers for labels
  doc.line(margin + col1W, y, margin + col1W, y + gridHeight);
  doc.line(midX + col3W, y, midX + col3W, y + gridHeight);

  // Populate Grid Texts
  const drawRowText = (label, value, startX, startY, labelW, valueW) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    // Vertically center text in row (approx)
    const textY = startY + 5;
    doc.text(label, startX + 2, textY);
    // Print Value
    const valText = doc.splitTextToSize(String(value || ''), valueW - 2)[0] || '';
    doc.text(valText, startX + labelW + 2, textY);
  };

  const sName = supplier?.name || '—';
  const sPhone = supplier?.phone || '—';
  const sEmail = supplier?.email || '—';
  const sAddr = supplier?.address || '—';
  
  drawRowText('Name:', sName, margin, y, col1W, col2W);
  drawRowText('Phone:', sPhone, margin, y + rowH, col1W, col2W);
  drawRowText('Email:', sEmail, margin, y + rowH * 2, col1W, col2W);
  drawRowText('Address:', sAddr, margin, y + rowH * 3, col1W, col2W);

  const orderDate = order?.order_date ? new Date(order.order_date).toLocaleDateString() : new Date().toLocaleDateString();

  drawRowText('Date:', orderDate, midX, y, col3W, col4W);
  drawRowText('Order Status:', order?.status ? order.status.toUpperCase() : 'PENDING', midX, y + rowH, col3W, col4W);
  drawRowText('Tracking Ref:', '—', midX, y + rowH * 2, col3W, col4W);
  drawRowText('Delivery Term:', '—', midX, y + rowH * 3, col3W, col4W);

  // 4. Items Table
  y += gridHeight + 5;

  const safeItems = Array.isArray(items) ? items : [];
  let tableBody = safeItems.map((item) => {
    const qty = Number(item.quantity || 0);
    const price = Number(item.unitCost || item.unit_cost || 0);
    return [
      item.productName || item.name || 'Item',
      qty.toString(),
      formatAmount(price),
      formatAmount(qty * price),
    ];
  });

  // Pad with empty rows so that even with few products, table is fixed
  const minRows = 10;
  while (tableBody.length < minRows) {
    tableBody.push(['', '', '', '']);
  }

  doc.autoTable({
    startY: y,
    head: [['Item Description', 'Quantity', 'Unit price', 'Amount']],
    body: tableBody,
    margin: { left: margin, right: margin, bottom: margin },
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3,
      textColor: COLORS.black,
      lineColor: COLORS.black,
      lineWidth: 0.3,
      valign: 'middle',
    },
    headStyles: {
      fillColor: COLORS.gray,
      textColor: COLORS.black,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'center', cellWidth: 25 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'right', cellWidth: 35 },
    },
  });

  // Change position of grand total to next page if there's no space on current
  if (doc.lastAutoTable.finalY > pageHeight - margin - 45) {
    doc.addPage();
  }

  // Fix notes and totals to the bottom of the last page
  const totalsY = pageHeight - margin - 40;

  // 5. Notes & Totals section
  // Notes block on left
  const notesX = margin;
  const notesW = contentWidth * 0.45;
  const notesH = 25;
  
  doc.setFillColor(...COLORS.gray);
  doc.rect(notesX, totalsY, notesW, 6, 'FD'); // Filled and stroked header
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Notes', notesX + notesW/2, totalsY + 4, { align: 'center' });
  
  // Notes content box
  doc.rect(notesX, totalsY + 6, notesW, notesH);
  doc.setFont('helvetica', 'normal');
  const noteLines = doc.splitTextToSize(order?.notes || '', notesW - 4);
  doc.text(noteLines, notesX + 2, totalsY + 10);

  // Totals block on right
  const subtotal = safeItems.reduce((sum, i) => sum + Number(i.quantity || 0) * Number(i.unitCost || i.unit_cost || 0), 0);
  const discount = Number(order?.discount || 0);
  const taxRate = Number(order?.taxRate || 0);
  const tax = (subtotal - discount) * (taxRate / 100);
  const grandTotal = subtotal - discount + tax;

  const totalsX = margin + contentWidth * 0.55;
  let runningTotalY = totalsY + 5;
  const totalItemH = 7;
  const labelW = 25;
  const totalLineW = contentWidth * 0.45 - labelW;

  const drawTotalLine = (label, value) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, totalsX, runningTotalY);
    doc.line(totalsX + labelW, runningTotalY + 1, totalsX + labelW + totalLineW, runningTotalY + 1);
    doc.text(value, totalsX + labelW + totalLineW - 1, runningTotalY - 0.5, { align: 'right' });
    runningTotalY += totalItemH;
  };

  drawTotalLine('Subtotal:', formatAmount(subtotal));
  drawTotalLine('Discount:', formatDiscount(discount));
  drawTotalLine('Tax:', formatAmount(tax));
  drawTotalLine('Grand total:', formatAmount(grandTotal));

  /* ---------- FULL PAGE BORDERS & FOOTER ---------- */
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Draw thick outer page border
    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.8);
    doc.rect(margin, margin, contentWidth, pageHeight - margin * 2);
    
    // Default back to thin line
    doc.setLineWidth(0.3);
    
    // Footer contact & pagination
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`${store.phone} • ${store.email}`, margin, pageHeight - 10);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
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
