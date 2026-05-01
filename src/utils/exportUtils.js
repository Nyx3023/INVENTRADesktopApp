import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatCurrency } from './formatters';
import { JBO_LOGO } from './logo';

/**
 * Get store information from localStorage
 */
const getStoreInfo = () => {
  const savedStoreInfo = localStorage.getItem('storeInfo');
  if (savedStoreInfo) {
    try {
      return JSON.parse(savedStoreInfo);
    } catch (e) {
      console.error('Error parsing store info:', e);
    }
  }
  return {
    storeName: 'JBO Arts & Crafts Trading',
    tagline: 'Your trusted partner for arts and crafts supplies',
    email: 'jboartsandcrafts@gmail.com',
    phone: '0932 868 7911',
    address: '#303 B1A J.R. Blvd Tagapo, Santa Rosa, Philippines',
  };
};

// Brand colors
const BRAND_COLORS = {
  primary: [218, 165, 32], // Golden/Amber
  secondary: [139, 90, 43], // Brown
  dark: [55, 65, 81],
  light: [250, 250, 240],
  accent: [184, 134, 11]
};

/**
 * Export data to CSV format (Excel-compatible)
 */
export const exportToCSV = (data, columns, filename = 'export') => {
  // Create header row
  const headers = columns.map(col => `"${col.header}"`).join(',');

  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      let value = col.accessor ? (typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor]) : '';
      // Escape quotes and wrap in quotes for CSV
      if (typeof value === 'string') {
        value = value.replace(/"/g, '""');
      }
      return `"${value ?? ''}"`;
    }).join(',');
  });

  // Combine headers and rows
  const csv = [headers, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return link.download;
};

/**
 * Export sales data to PDF with JBO branding
 * Portrait orientation with clean table-based layout
 */
export const exportSalesToPDF = (transactions, options = {}) => {
  const { title = 'Sales Report', dateRange = '' } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const storeInfo = getStoreInfo();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Format currency without signs
  const formatAmount = (value) => {
    const formatted = formatCurrency(Math.abs(Number(value) || 0));
    return formatted.replace(/[±+\-]/g, '').trim();
  };

  // Header Section
  doc.setFillColor(...BRAND_COLORS.light);
  doc.rect(0, 0, pageWidth, 40, 'F');

  if (JBO_LOGO) {
    doc.addImage(JBO_LOGO, 'PNG', margin, 10, 25, 18);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...BRAND_COLORS.dark);
  doc.text(title, margin + 30, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND_COLORS.secondary);
  doc.text(storeInfo.tagline || 'Arts & Crafts Trading', margin + 30, 28);

  if (dateRange) {
    doc.setFontSize(8);
    doc.text(`Period: ${dateRange}`, margin + 30, 34);
  }

  let currentY = 50;

  // Summary Table
  const totalSales = transactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
  const totalTransactions = transactions.length;
  const avgSale = totalTransactions > 0 ? totalSales / totalTransactions : 0;

  const summaryRows = [
    ['Total Transactions', String(totalTransactions)],
    ['Total Sales', formatAmount(totalSales)],
    ['Average Sale', formatAmount(avgSale)]
  ];

  doc.autoTable({
    startY: currentY,
    head: [['Metric', 'Value']],
    body: summaryRows,
    theme: 'grid',
    styles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: BRAND_COLORS.dark,
    },
    headStyles: {
      fillColor: BRAND_COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold' },
      1: { halign: 'right', cellWidth: 100 }
    },
    margin: { left: margin, right: margin }
  });

  currentY = doc.lastAutoTable.finalY + 12;

  // Transactions Table
  const tableData = transactions.map((t, idx) => [
    idx + 1,
    new Date(t.timestamp).toLocaleDateString(),
    new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    t.id?.slice(-12) || 'N/A',
    (t.payment_method || 'cash').toUpperCase(),
    formatAmount(parseFloat(t.total) || 0)
  ]);

  doc.autoTable({
    startY: currentY,
    head: [['#', 'Date', 'Time', 'Transaction ID', 'Payment', 'Total']],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: BRAND_COLORS.dark
    },
    headStyles: {
      fillColor: BRAND_COLORS.secondary,
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center', cellWidth: 28 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', cellWidth: 35 },
      4: { halign: 'center', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 28 }
    },
    margin: { left: margin, right: margin }
  });

  // Footer
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 15;

    doc.setDrawColor(...BRAND_COLORS.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(storeInfo.storeName, margin, footerY);
    doc.text(storeInfo.email, margin, footerY + 5);

    doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, footerY, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - margin, footerY + 5, { align: 'right' });
  }

  const filename = `JBO_Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * Statistical Report PDF - Corporate Print Layout
 * A4 Portrait, white background, traditional report format
 */
export const exportStatisticalReportPDF = (reportData = {}, options = {}) => {
  const { title = 'Statistical Report', dateRange = '' } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const storeInfo = getStoreInfo();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  const summary = reportData.summary || {};
  const topProducts = reportData.topProducts || [];
  const categories = reportData.salesByCategory || [];
  const salesTrend = reportData.salesTrend || [];

  const periodLabel = dateRange?.replace(/period:/i, '').trim() || 'monthly';
  const formatAmount = (value) => {
    const formatted = formatCurrency(Math.abs(Number(value) || 0));
    return formatted.replace(/[±+\-]/g, '').trim();
  };

  // Colors - Corporate palette
  const kpiBlue = [173, 216, 230];
  const chartBlue = [70, 130, 180];
  const chartGreen = [60, 179, 113];
  const chartOrange = [255, 140, 0];
  const textDark = [33, 33, 33];
  const textMuted = [100, 100, 100];
  const borderGray = [200, 200, 200];

  // White background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  let yPos = margin;

  // REPORT HEADER
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...textDark);
  doc.text('Statistical Report', margin, yPos);

  yPos += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  const subtitle = `This report provides a comprehensive overview of sales performance for ${periodLabel} period.`;
  const wrappedSubtitle = doc.splitTextToSize(subtitle, pageWidth - margin * 2);
  doc.text(wrappedSubtitle, margin, yPos);

  yPos += wrappedSubtitle.length * 4 + 6;

  // SALES TREND ANALYSIS SECTION
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...textDark);
  doc.text('Sales trend analysis', margin, yPos);

  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`Reporting period: ${periodLabel} | Generated on ${new Date().toLocaleDateString()}`, margin, yPos);

  yPos += 8;

  // KPI BOXES - 2x2 Grid
  const kpiData = [
    { label: 'Daily Sales', value: summary.dailySales || 0 },
    { label: 'Weekly Sales', value: summary.weeklySales || 0 },
    { label: 'Monthly Sales', value: summary.monthlySales || 0 },
    { label: 'Yearly Sales', value: summary.yearlySales || 0 }
  ];

  const kpiBoxWidth = (pageWidth - margin * 2 - 8) / 2;
  const kpiBoxHeight = 18;

  kpiData.forEach((kpi, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const boxX = margin + col * (kpiBoxWidth + 8);
    const boxY = yPos + row * (kpiBoxHeight + 4);

    doc.setFillColor(...kpiBlue);
    doc.rect(boxX, boxY, kpiBoxWidth, kpiBoxHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(kpi.label, boxX + 4, boxY + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...textDark);
    doc.text(formatAmount(kpi.value), boxX + 4, boxY + 15);
  });

  yPos += (kpiBoxHeight + 4) * 2 + 8;

  // SALES TREND CHART
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  doc.text('Sales Trend', margin + 4, yPos + 6);

  yPos += 10;

  const chartDataArea = {
    x: margin + 15,
    y: yPos,
    width: pageWidth - margin * 2 - 20,
    height: 55
  };

  // Draw line chart with axes
  doc.setDrawColor(...borderGray);
  doc.setLineWidth(0.3);
  doc.rect(chartDataArea.x, chartDataArea.y, chartDataArea.width, chartDataArea.height);

  // Draw trend line
  if (salesTrend.length > 1) {
    const values = salesTrend.map(d => Number(d.value || d.amount || 0));
    const maxVal = Math.max(...values, 1);

    // Grid lines with Y-axis labels
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...textMuted);
    for (let i = 0; i <= 4; i++) {
      const gridY = chartDataArea.y + (chartDataArea.height / 4) * i;
      doc.line(chartDataArea.x, gridY, chartDataArea.x + chartDataArea.width, gridY);

      // Y-axis labels (left side)
      const labelValue = maxVal * (1 - i / 4);
      doc.text(formatAmount(labelValue), chartDataArea.x - 3, gridY + 1.5, { align: 'right' });
    }

    const points = salesTrend.map((d, idx) => {
      const x = chartDataArea.x + (chartDataArea.width / (salesTrend.length - 1)) * idx;
      const normalized = Number(d.value || d.amount || 0) / maxVal;
      const y = chartDataArea.y + chartDataArea.height - (normalized * chartDataArea.height);
      return { x, y, idx };
    });

    // Draw line segments
    doc.setDrawColor(...chartBlue);
    doc.setLineWidth(1.2);
    for (let i = 1; i < points.length; i++) {
      doc.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
    }

    // Draw points and labels
    const labelStep = Math.max(1, Math.ceil(salesTrend.length / 8));
    points.forEach((point) => {
      // Draw point
      doc.setFillColor(...chartBlue);
      doc.circle(point.x, point.y, 1.2, 'F');

      // X-axis labels (aligned with points)
      if (point.idx % labelStep === 0 && salesTrend[point.idx]) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(...textMuted);
        const label = salesTrend[point.idx].label || salesTrend[point.idx].date || '';
        const labelText = String(label).slice(0, 10);
        doc.text(labelText, point.x, chartDataArea.y + chartDataArea.height + 5, { align: 'center' });
      }
    });
  }

  yPos += chartDataArea.height + 10;

  // TWO COLUMN SECTION
  const col2Width = (pageWidth - margin * 2 - 8) / 2;

  // Column 1 - Sales by Category (List format)
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, col2Width, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  doc.text('Sales by Category', margin + 4, yPos + 6);

  let listY = yPos + 12;
  const chartColors = [chartBlue, chartGreen, chartOrange, [220, 20, 60], [147, 112, 219]];

  if (categories.length > 0) {
    const totalSales = categories.reduce((sum, c) => sum + Number(c.revenue || 0), 0);

    categories.slice(0, 6).forEach((cat, idx) => {
      const catValue = Number(cat.revenue || 0);
      const percentage = totalSales > 0 ? ((catValue / totalSales) * 100).toFixed(1) : '0.0';
      const color = chartColors[idx % chartColors.length];

      // Color indicator
      doc.setFillColor(...color);
      doc.circle(margin + 5, listY + 1, 1.2, 'F');

      // Category name
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);
      const categoryName = (cat.category || '—').slice(0, 15);
      doc.text(categoryName, margin + 9, listY + 2);

      // Amount and percentage
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.text(`${formatAmount(catValue)} (${percentage}%)`, margin + col2Width - 4, listY + 2, { align: 'right' });

      listY += 5;
    });
  }

  // Column 2 - Top Products (Horizontal bars)
  const col2X = margin + col2Width + 8;
  doc.setFillColor(245, 245, 245);
  doc.rect(col2X, yPos, col2Width, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  doc.text('Top 5 Products', col2X + 4, yPos + 6);

  const barStartY = yPos + 12;
  const barHeight = 6;
  const barSpacing = 8;
  const maxProduct = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.quantity || 0), 1) : 1;

  topProducts.slice(0, 5).forEach((product, idx) => {
    const barY = barStartY + idx * barSpacing;
    const barWidth = ((product.quantity || 0) / maxProduct) * (col2Width - 30);

    doc.setFillColor(...chartGreen);
    doc.rect(col2X + 4, barY, Math.max(barWidth, 1), barHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...textDark);
    const productName = (product.name || '—').slice(0, 18);
    doc.text(productName, col2X + 4, barY - 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(String(product.quantity || 0), col2X + col2Width - 4, barY + 4, { align: 'right' });
  });

  yPos += Math.max(listY - yPos - 12, barStartY + 5 * barSpacing - yPos - 12) + 18;

  // THIRD SECTION - Top Products by Revenue
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, yPos, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...textDark);
  doc.text('Top 5 by Revenue', margin + 4, yPos + 6);

  yPos += 10;

  const maxRevenue = topProducts.length > 0 ? Math.max(...topProducts.map(p => Number(p.revenue || 0)), 1) : 1;

  topProducts.slice(0, 5).forEach((product, idx) => {
    const barY = yPos + idx * barSpacing;
    const revenue = Number(product.revenue || 0);
    const barWidth = (revenue / maxRevenue) * (pageWidth - margin * 2 - 30);

    doc.setFillColor(...chartOrange);
    doc.rect(margin + 4, barY, Math.max(barWidth, 1), barHeight, 'F');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...textDark);
    const productName = (product.name || '—').slice(0, 25);
    doc.text(productName, margin + 4, barY - 1);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(formatAmount(revenue), pageWidth - margin - 4, barY + 4, { align: 'right' });
  });

  // FOOTER
  const footerY = pageHeight - 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...textMuted);
  doc.text(
    `Data sourced from ${storeInfo.storeName} POS System • Report generated on ${new Date().toLocaleString()}`,
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  const filename = `Statistical_Report_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
  return filename;
};

/**
 * Export transactions to Excel (CSV) - Legacy function
 */
export const exportTransactionsToExcel = (transactions, filename = 'transactions') => {
  const columns = [
    { header: 'Transaction ID', accessor: 'id' },
    { header: 'Date', accessor: (row) => new Date(row.timestamp).toLocaleDateString() },
    { header: 'Time', accessor: (row) => new Date(row.timestamp).toLocaleTimeString() },
    {
      header: 'Items', accessor: (row) => {
        if (Array.isArray(row.items)) {
          return row.items.map(i => `${i.name} x${i.quantity}`).join('; ');
        }
        return '';
      }
    },
    { header: 'Subtotal', accessor: 'subtotal' },
    { header: 'Tax', accessor: 'tax' },
    { header: 'Total', accessor: 'total' },
    { header: 'Payment Method', accessor: 'payment_method' },
    { header: 'Received Amount', accessor: 'received_amount' },
    { header: 'Change', accessor: 'change_amount' },
    { header: 'Reference #', accessor: 'reference_number' },
  ];

  return exportToCSV(transactions, columns, filename);
};

/**
 * Export sales to Excel with customizable settings
 * @param {Array} transactions - Array of transaction objects
 * @param {Object} settings - Export settings
 * @param {Object} settings.dateRange - { startDate, endDate }
 * @param {string} settings.dataSource - 'all' or 'filtered'
 * @param {Object} settings.columns - Column visibility settings
 * @param {boolean} settings.includeSummary - Include summary sheet
 * @param {string} settings.filename - Output filename
 */
export const exportSalesToExcel = (transactions, settings = {}) => {
  const {
    dateRange = { startDate: '', endDate: '' },
    dataSource = 'all',
    columns = {},
    includeSummary = true,
    filename = `Sales_Export_${new Date().toISOString().split('T')[0]}`
  } = settings;

  // Filter transactions based on settings
  let dataToExport = [...transactions];

  // Apply date range filter if specified
  if (dateRange.startDate || dateRange.endDate) {
    dataToExport = dataToExport.filter(transaction => {
      const transactionDate = new Date(transaction.timestamp);

      if (dateRange.startDate) {
        const startDate = new Date(dateRange.startDate);
        startDate.setHours(0, 0, 0, 0);
        if (transactionDate < startDate) return false;
      }

      if (dateRange.endDate) {
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);
        if (transactionDate > endDate) return false;
      }

      return true;
    });
  }

  // Create workbook
  const workbook = XLSX.utils.book_new();

  // Build main data sheet
  const mainData = [];

  // Helper to check if column should be included (defaults to true)
  const shouldInclude = (key) => columns[key] !== false;

  // Header row
  const headers = [];
  if (shouldInclude('transactionId')) headers.push('Transaction ID');
  if (shouldInclude('date')) headers.push('Date');
  if (shouldInclude('time')) headers.push('Time');
  if (shouldInclude('items')) headers.push('Items Summary');
  if (shouldInclude('itemDetails')) headers.push('Item Name', 'Item Quantity', 'Item Price', 'Item Subtotal');
  if (shouldInclude('subtotal')) headers.push('Subtotal');
  if (shouldInclude('tax')) headers.push('Tax');
  if (shouldInclude('total')) headers.push('Total');
  if (shouldInclude('paymentMethod')) headers.push('Payment Method');
  if (shouldInclude('receivedAmount')) headers.push('Received Amount');
  if (shouldInclude('change')) headers.push('Change');
  if (shouldInclude('referenceNumber')) headers.push('Reference Number');
  if (shouldInclude('cashier')) headers.push('Cashier');

  mainData.push(headers);

  // Data rows
  dataToExport.forEach(transaction => {
    if (shouldInclude('itemDetails') && columns.itemDetails === true && Array.isArray(transaction.items) && transaction.items.length > 0) {
      // Create separate row for each item
      transaction.items.forEach((item, index) => {
        const row = [];
        if (shouldInclude('transactionId')) {
          row.push(index === 0 ? transaction.id : ''); // Only show ID on first item row
        }
        if (shouldInclude('date')) {
          row.push(index === 0 ? new Date(transaction.timestamp).toLocaleDateString() : '');
        }
        if (shouldInclude('time')) {
          row.push(index === 0 ? new Date(transaction.timestamp).toLocaleTimeString() : '');
        }
        if (shouldInclude('items')) {
          row.push(index === 0 ? `${transaction.items.length} item(s)` : '');
        }
        if (shouldInclude('itemDetails')) {
          row.push(item.name || item.productName || '');
          row.push(item.quantity || 0);
          row.push(Number(item.price || item.unit_price || 0).toFixed(2));
          row.push((Number(item.quantity || 0) * Number(item.price || item.unit_price || 0)).toFixed(2));
        }
        if (shouldInclude('subtotal')) {
          row.push(index === 0 ? Number(transaction.subtotal || 0).toFixed(2) : '');
        }
        if (shouldInclude('tax')) {
          row.push(index === 0 ? Number(transaction.tax || 0).toFixed(2) : '');
        }
        if (shouldInclude('total')) {
          row.push(index === 0 ? Number(transaction.total || 0).toFixed(2) : '');
        }
        if (shouldInclude('paymentMethod')) {
          row.push(index === 0 ? (transaction.payment_method || transaction.paymentMethod || 'cash').toUpperCase() : '');
        }
        if (shouldInclude('receivedAmount')) {
          row.push(index === 0 ? Number(transaction.received_amount || transaction.receivedAmount || 0).toFixed(2) : '');
        }
        if (shouldInclude('change')) {
          row.push(index === 0 ? Number(transaction.change_amount || transaction.change || 0).toFixed(2) : '');
        }
        if (shouldInclude('referenceNumber')) {
          row.push(index === 0 ? (transaction.reference_number || transaction.referenceNumber || '') : '');
        }
        if (shouldInclude('cashier')) {
          row.push(index === 0 ? (transaction.user_name || transaction.userName || transaction.user || 'N/A') : '');
        }
        mainData.push(row);
      });
    } else {
      // Single row per transaction
      const row = [];
      if (shouldInclude('transactionId')) row.push(transaction.id);
      if (shouldInclude('date')) row.push(new Date(transaction.timestamp).toLocaleDateString());
      if (shouldInclude('time')) row.push(new Date(transaction.timestamp).toLocaleTimeString());
      if (shouldInclude('items')) {
        if (Array.isArray(transaction.items)) {
          row.push(transaction.items.map(i => `${i.name || i.productName || 'Item'} x${i.quantity || 0}`).join('; '));
        } else {
          row.push('');
        }
      }
      if (shouldInclude('subtotal')) row.push(Number(transaction.subtotal || 0).toFixed(2));
      if (shouldInclude('tax')) row.push(Number(transaction.tax || 0).toFixed(2));
      if (shouldInclude('total')) row.push(Number(transaction.total || 0).toFixed(2));
      if (shouldInclude('paymentMethod')) {
        row.push((transaction.payment_method || transaction.paymentMethod || 'cash').toUpperCase());
      }
      if (shouldInclude('receivedAmount')) {
        row.push(Number(transaction.received_amount || transaction.receivedAmount || 0).toFixed(2));
      }
      if (shouldInclude('change')) {
        row.push(Number(transaction.change_amount || transaction.change || 0).toFixed(2));
      }
      if (shouldInclude('referenceNumber')) {
        row.push(transaction.reference_number || transaction.referenceNumber || '');
      }
      if (shouldInclude('cashier')) {
        row.push(transaction.user_name || transaction.userName || transaction.user || 'N/A');
      }
      mainData.push(row);
    }
  });

  // Create main worksheet
  const mainWorksheet = XLSX.utils.aoa_to_sheet(mainData);

  // Set column widths
  const colWidths = headers.map(() => ({ wch: 15 }));
  mainWorksheet['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, mainWorksheet, 'Sales Data');

  // Add summary sheet if requested
  if (includeSummary) {
    const totalSales = dataToExport.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const totalTransactions = dataToExport.length;
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Calculate payment method breakdown
    const paymentBreakdown = {};
    dataToExport.forEach(t => {
      const method = (t.payment_method || t.paymentMethod || 'cash').toUpperCase();
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + 1;
    });

    const summaryData = [
      ['Sales Summary Report'],
      [''],
      ['Generated:', new Date().toLocaleString()],
      ['Date Range:', dateRange.startDate && dateRange.endDate
        ? `${dateRange.startDate} to ${dateRange.endDate}`
        : 'All Dates'],
      ['Total Records:', totalTransactions],
      [''],
      ['Summary Statistics'],
      ['Total Sales:', totalSales.toFixed(2)],
      ['Total Transactions:', totalTransactions],
      ['Average Transaction:', averageTransaction.toFixed(2)],
      [''],
      ['Payment Method Breakdown'],
      ['Method', 'Count']
    ];

    Object.entries(paymentBreakdown).forEach(([method, count]) => {
      summaryData.push([method, count]);
    });

    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
    summaryWorksheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
  }

  // Generate Excel file and download
  XLSX.writeFile(workbook, `${filename}.xlsx`);

  return `${filename}.xlsx`;
};

/**
 * Export products to Excel
 * @param {Array} products - Array of product objects
 * @param {string} filename - Output filename
 */
export const exportProductsToExcel = (products, filename = `Products_Export_${new Date().toISOString().split('T')[0]}`) => {
  const workbook = XLSX.utils.book_new();

  // Build main data sheet
  const mainData = [];

  const headers = [
    'ProdName',
    'Category',
    'Selling Price',
    'Cost Price',
    'Quantity',
    'Batch Number',
    'Expiration Date',
    'Barcode',
    'ProductImage',
    'Status'
  ];

  mainData.push(headers);

  // Data rows
  products.forEach(product => {
    const row = [
      product.name || '',
      product.category_name || '',
      Number(product.price || 0).toFixed(2),
      Number(product.cost || 0).toFixed(2),
      Number(product.quantity || 0),
      product.batchNumber || product.batch_number || '',
      product.expiryDate || product.expiry_date || '',
      product.barcode || '',
      product.image_url || product.imageUrl || '',
      product.status || 'available'
    ];
    mainData.push(row);
  });

  // Create worksheet
  const worksheet = XLSX.utils.aoa_to_sheet(mainData);

  // Set column widths
  worksheet['!cols'] = [
    { wch: 30 }, // ProdName
    { wch: 20 }, // Category
    { wch: 15 }, // Selling Price
    { wch: 15 }, // Cost Price
    { wch: 12 }, // Quantity
    { wch: 18 }, // Batch Number
    { wch: 18 }, // Expiration Date
    { wch: 20 }, // Barcode
    { wch: 40 }, // ProductImage
    { wch: 15 }  // Status
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  // Add instructions sheet
  const instructionsData = [
    ['Product Import Template - Instructions'],
    [''],
    ['Required Columns:'],
    ['ProdName', 'Product name (required)'],
    ['Category', 'Product category (required)'],
    ['Selling Price', 'Product selling price in decimal format (required)'],
    ['Cost Price', 'Product cost price in decimal format (optional)'],
    ['Quantity', 'Initial stock quantity (required)'],
    ['Batch Number', 'Batch/lot number (optional)'],
    ['Expiration Date', 'Expiration date (optional; YYYY-MM-DD recommended)'],
    ['Barcode', 'Product barcode (optional)'],
    ['ProductImage', 'Image URL or path (optional)'],
    ['Status', 'Availability status: available or unavailable (optional, defaults to available)'],
    [''],
    ['Notes:'],
    ['- All prices should be in decimal format (e.g., 99.99)'],
    ['- Quantities and Low Stock Alerts should be whole numbers'],
    ['- ProductImage can be a URL or relative path to uploaded image'],
    ['- Status must be strictly "available" or "unavailable"'],
    ['- Empty rows will be skipped during import'],
    ['- Duplicate barcodes will be skipped']
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 25 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  // Generate Excel file and download
  XLSX.writeFile(workbook, `${filename}.xlsx`);

  return `${filename}.xlsx`;
};

/**
 * Calculate text similarity between two strings using Levenshtein distance
 * Returns a similarity score between 0 (completely different) and 1 (identical)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
const calculateSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1;

  // One string contains the other (high similarity)
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = Math.max(s1.length, s2.length);
    const shorter = Math.min(s1.length, s2.length);
    return shorter / longer;
  }

  // Calculate Levenshtein distance
  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);

  // Convert distance to similarity (0-1)
  return 1 - (distance / maxLen);
};

/**
 * Find similar products by name
 * @param {string} productName - Product name to check
 * @param {Array} existingProducts - Array of existing products
 * @param {number} threshold - Similarity threshold (default 0.8 = 80% similar)
 * @returns {Array} Array of similar products with similarity scores
 */
const findSimilarProducts = (productName, existingProducts, threshold = 0.8) => {
  if (!productName || !existingProducts || existingProducts.length === 0) {
    return [];
  }

  const similar = [];

  for (const existing of existingProducts) {
    if (!existing.name) continue;

    const similarity = calculateSimilarity(productName, existing.name);

    if (similarity >= threshold) {
      similar.push({
        product: existing,
        similarity: Math.round(similarity * 100) / 100,
        matchType: similarity === 1 ? 'exact' : similarity > 0.9 ? 'very_similar' : 'similar'
      });
    }
  }

  // Sort by similarity (highest first)
  return similar.sort((a, b) => b.similarity - a.similarity);
};

/**
 * Import products from Excel file
 * @param {File} file - Excel file to import
 * @param {Array} existingProducts - Array of existing products for duplicate checking
 * @returns {Promise<Object>} - { products: Array, errors: Array, warnings: Array, duplicates: Array }
 */
export const importProductsFromExcel = async (file, existingProducts = []) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Find the Products sheet (from export) or use first sheet
        let sheetName = workbook.SheetNames.find(name =>
          name.toLowerCase() === 'products' || name.toLowerCase() === 'product'
        ) || workbook.SheetNames[0];

        // Skip Instructions sheet if it exists
        if (sheetName.toLowerCase() === 'instructions') {
          sheetName = workbook.SheetNames.find(name =>
            name.toLowerCase() !== 'instructions'
          ) || workbook.SheetNames[0];
        }

        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: ''
        });

        if (jsonData.length < 2) {
          reject(new Error('Excel file is empty or has no data rows'));
          return;
        }

        // Get headers (first row)
        const headers = jsonData[0].map(h => String(h).trim());

        // Find column indices
        const columnMap = {
          prodName: -1,
          category: -1,
          sellingPrice: -1,
          costPrice: -1,
          quantity: -1,
          batchNumber: -1,
          expiryDate: -1,
          barcode: -1,
          productImage: -1,
          status: -1
        };

        // Map headers - prioritize exact matches from export format, then flexible matching
        headers.forEach((header, index) => {
          const headerTrimmed = String(header).trim();
          const headerLower = headerTrimmed.toLowerCase();

          // Exact matches first (from export format)
          if (headerTrimmed === 'ProdName' || headerLower === 'prodname') {
            columnMap.prodName = index;
          } else if (headerTrimmed === 'Category' || headerLower === 'category') {
            columnMap.category = index;
          } else if (headerTrimmed === 'Selling Price' || headerLower === 'selling price') {
            columnMap.sellingPrice = index;
          } else if (headerTrimmed === 'Cost Price' || headerLower === 'cost price') {
            columnMap.costPrice = index;
          } else if (headerTrimmed === 'Quantity' || headerLower === 'quantity') {
            columnMap.quantity = index;
          } else if (headerTrimmed === 'Batch Number' || headerLower === 'batch number' || headerLower === 'batchnumber') {
            columnMap.batchNumber = index;
          } else if (headerTrimmed === 'Expiration Date' || headerLower === 'expiration date' || headerLower === 'expiry date' || headerLower === 'expirydate') {
            columnMap.expiryDate = index;
          } else if (headerTrimmed === 'Barcode' || headerLower === 'barcode') {
            columnMap.barcode = index;
          } else if (headerTrimmed === 'ProductImage' || headerLower === 'productimage') {
            columnMap.productImage = index;
          } else if (headerTrimmed === 'Status' || headerLower === 'status') {
            columnMap.status = index;
          }
          // Flexible matching for user-modified headers (only if exact match not found)
          else if (columnMap.prodName === -1 && (headerLower.includes('product name') || (headerLower.includes('name') && !headerLower.includes('image')))) {
            columnMap.prodName = index;
          } else if (columnMap.category === -1 && headerLower.includes('category')) {
            columnMap.category = index;
          } else if (columnMap.sellingPrice === -1 && (headerLower.includes('price') && !headerLower.includes('low') && !headerLower.includes('cost'))) {
            columnMap.sellingPrice = index;
          } else if (columnMap.costPrice === -1 && (headerLower.includes('cost') || headerLower.includes('cost price'))) {
            columnMap.costPrice = index;
          } else if (columnMap.quantity === -1 && (headerLower.includes('quantity') || (headerLower.includes('stock') && !headerLower.includes('low')))) {
            columnMap.quantity = index;
          } else if (columnMap.batchNumber === -1 && (headerLower.includes('batch') || headerLower.includes('lot'))) {
            columnMap.batchNumber = index;
          } else if (columnMap.expiryDate === -1 && (headerLower.includes('expiry') || headerLower.includes('expiration'))) {
            columnMap.expiryDate = index;
          } else if (columnMap.barcode === -1 && headerLower.includes('barcode')) {
            columnMap.barcode = index;
          } else if (columnMap.productImage === -1 && headerLower.includes('image')) {
            columnMap.productImage = index;
          } else if (columnMap.status === -1 && (headerLower.includes('status') || headerLower.includes('available'))) {
            columnMap.status = index;
          }
        });

        // Validate required columns
        const missingColumns = [];
        if (columnMap.prodName === -1) missingColumns.push('ProdName');
        if (columnMap.category === -1) missingColumns.push('Category');
        if (columnMap.sellingPrice === -1) missingColumns.push('Selling Price');
        if (columnMap.quantity === -1) missingColumns.push('Quantity');

        if (missingColumns.length > 0) {
          reject(new Error(`Missing required columns: ${missingColumns.join(', ')}`));
          return;
        }

        // Process data rows
        const products = [];
        const errors = [];
        const warnings = [];
        const duplicates = [];

        // Create sets for quick lookup
        const existingBarcodes = new Set(
          existingProducts
            .filter(p => p.barcode)
            .map(p => p.barcode)
        );

        const existingNames = new Set(
          existingProducts
            .map(p => p.name?.toLowerCase().trim())
            .filter(Boolean)
        );

        const importBatchNames = new Set();

        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];

          // Skip empty rows
          if (row.every(cell => !cell || String(cell).trim() === '')) {
            continue;
          }

          const prodName = String(row[columnMap.prodName] || '').trim();
          const category = String(row[columnMap.category] || '').trim();
          const sellingPrice = String(row[columnMap.sellingPrice] || '').trim();
          const costPrice = columnMap.costPrice !== -1 ? String(row[columnMap.costPrice] || '').trim() : '';
          const quantity = String(row[columnMap.quantity] || '').trim();
          const batchNumber = columnMap.batchNumber !== -1 ? String(row[columnMap.batchNumber] || '').trim() : '';
          const expiryDate = columnMap.expiryDate !== -1 ? String(row[columnMap.expiryDate] || '').trim() : '';
          const barcode = columnMap.barcode !== -1 ? String(row[columnMap.barcode] || '').trim() : '';
          const productImage = columnMap.productImage !== -1 ? String(row[columnMap.productImage] || '').trim() : '';
          const statusRaw = columnMap.status !== -1 ? String(row[columnMap.status] || '').trim().toLowerCase() : 'available';
          const statusValue = (statusRaw === 'unavailable' || statusRaw === 'not available') ? 'unavailable' : 'available';

          // Validate required fields
          const rowErrors = [];

          if (!prodName) {
            rowErrors.push('Product name is required');
          }

          if (!category) {
            rowErrors.push('Category is required');
          }

          const priceNum = parseFloat(sellingPrice);
          if (isNaN(priceNum) || priceNum < 0) {
            rowErrors.push('Selling price must be a valid positive number');
          }

          const costNum = parseFloat(costPrice);
          if (costPrice && (isNaN(costNum) || costNum < 0)) {
            rowErrors.push('Cost price must be a valid positive number');
          }

          const qtyNum = parseInt(quantity, 10);
          if (isNaN(qtyNum) || qtyNum < 0) {
            rowErrors.push('Quantity must be a valid non-negative integer');
          }

          if (rowErrors.length > 0) {
            errors.push({
              row: i + 1,
              productName: prodName || 'N/A',
              errors: rowErrors
            });
            continue; // Skip adding this product to the products array
          }

          // Check for duplicate barcodes in import batch
          if (barcode && products.some(p => p.barcode === barcode)) {
            warnings.push({
              row: i + 1,
              productName: prodName,
              warning: `Duplicate barcode "${barcode}" found in import file`
            });
          }

          // Check for existing product with same barcode (if barcode is not null)
          if (barcode && existingBarcodes.has(barcode)) {
            duplicates.push({
              row: i + 1,
              productName: prodName,
              barcode: barcode,
              reason: 'duplicate_barcode',
              message: `Product with barcode "${barcode}" already exists in inventory`
            });
            continue; // Skip this product
          }

          // Check for duplicate name in inventory or within the import file
          const prodNameLower = prodName.toLowerCase();
          if (existingNames.has(prodNameLower)) {
            duplicates.push({
              row: i + 1,
              productName: prodName,
              barcode: barcode || '',
              reason: 'duplicate_name',
              message: `Product with name "${prodName}" already exists in inventory`
            });
            continue; // Skip this product
          }

          if (importBatchNames.has(prodNameLower)) {
            duplicates.push({
              row: i + 1,
              productName: prodName,
              barcode: barcode || '',
              reason: 'duplicate_name_in_file',
              message: `Duplicate product name "${prodName}" found in import file`
            });
            continue; // Skip this product
          }
          
          importBatchNames.add(prodNameLower);

          // Check for similar product names (text similarity)
          const similarProducts = findSimilarProducts(prodName, existingProducts, 0.8);
          if (similarProducts.length > 0) {
            const bestMatch = similarProducts[0];
            warnings.push({
              row: i + 1,
              productName: prodName,
              warning: `Similar product found: "${bestMatch.product.name}" (${Math.round(bestMatch.similarity * 100)}% similar)`,
              similarProduct: bestMatch.product,
              similarity: bestMatch.similarity
            });
          }

          // Create product object with Excel row number for tracking
          const product = {
            name: prodName,
            category_name: category,
            price: priceNum,
            cost: costPrice ? costNum : 0,
            quantity: qtyNum,
            batchNumber: batchNumber || '',
            expiryDate: expiryDate || '',
            barcode: barcode || null,
            image_url: productImage || null,
            status: statusValue,
            _excelRow: i + 1 // Store Excel row number for reference
          };

          products.push(product);
        }

        if (products.length === 0) {
          reject(new Error('No valid products found in the file'));
          return;
        }

        resolve({
          products,
          errors,
          warnings,
          duplicates,
          totalRows: jsonData.length - 1,
          validProducts: products.length,
          skippedDuplicates: duplicates.length
        });

      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Create a downloadable Excel template for importing products
 * @param {string} filename - Output filename
 */
export const downloadImportTemplate = (filename = 'Import_Products_Template.xlsx') => {
  const workbook = XLSX.utils.book_new();

  // Build main data sheet
  const headers = [
    'ProdName',
    'Category',
    'Selling Price',
    'Cost Price',
    'Quantity',
    'Batch Number',
    'Expiration Date',
    'Barcode',
    'ProductImage',
    'Status'
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  worksheet['!cols'] = [
    { wch: 30 }, // ProdName
    { wch: 20 }, // Category
    { wch: 15 }, // Selling Price
    { wch: 15 }, // Cost Price
    { wch: 12 }, // Quantity
    { wch: 18 }, // Batch Number
    { wch: 18 }, // Expiration Date
    { wch: 20 }, // Barcode
    { wch: 40 }, // ProductImage
    { wch: 15 }  // Status
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  // Add instructions sheet
  const instructionsData = [
    ['Product Import Template - Instructions'],
    [''],
    ['Required Columns:'],
    ['ProdName', 'Product name (required)'],
    ['Category', 'Product category (required)'],
    ['Selling Price', 'Product selling price in decimal format (required)'],
    ['Cost Price', 'Product cost price in decimal format (optional)'],
    ['Quantity', 'Initial stock quantity (required)'],
    ['Batch Number', 'Batch/lot number (optional)'],
    ['Expiration Date', 'Expiration date (optional; YYYY-MM-DD recommended)'],
    ['Barcode', 'Product barcode (optional)'],
    ['ProductImage', 'Image URL or path (optional)'],
    ['Status', 'Availability status: available or unavailable (optional, defaults to available)'],
    [''],
    ['Notes:'],
    ['- All prices should be in decimal format (e.g., 99.99)'],
    ['- Quantities and Low Stock Alerts should be whole numbers'],
    ['- ProductImage can be a URL or relative path to uploaded image'],
    ['- Status must be strictly "available" or "unavailable"'],
    ['- Empty rows will be skipped during import']
  ];

  const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsSheet['!cols'] = [{ wch: 25 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

  XLSX.writeFile(workbook, filename);
  return filename;
};

/* -------------------------------------------------------------------------- */
/* Reports - Per-section Excel exporters                                      */
/* -------------------------------------------------------------------------- */

const periodToLabel = (period) => {
  switch ((period || '').toLowerCase()) {
    case 'weekly': return 'Last 7 days';
    case 'monthly': return 'Last 30 days';
    case 'quarterly': return 'Last 90 days';
    case 'yearly': return 'Last 365 days';
    default: return period || '—';
  }
};

const buildMetadataSheet = (title, period, extra = []) => {
  const storeInfo = getStoreInfo();
  const rows = [
    [title],
    [''],
    ['Generated', new Date().toLocaleString()],
    ['Store', storeInfo.storeName || ''],
    ['Period', periodToLabel(period)],
  ];
  if (Array.isArray(extra) && extra.length) {
    rows.push(['']);
    extra.forEach(([label, value]) => rows.push([label, value]));
  }
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 22 }, { wch: 32 }];
  return sheet;
};

const safeFilename = (name) => String(name || 'report').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');

const buildFilename = (slug, period) => {
  const ts = new Date();
  const stamp = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}-${String(ts.getDate()).padStart(2, '0')}_${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`;
  return `${safeFilename(slug)}_${(period || 'all')}_${stamp}.xlsx`;
};

/**
 * Export the Sales summary panel (KPIs + revenue/cost + sales trend).
 */
export const exportSalesSummaryToExcel = ({ salesData = {}, revenueData = {}, salesGrowth = {}, salesTrend = [], period = 'monthly' } = {}) => {
  const workbook = XLSX.utils.book_new();

  const formatGrowthCell = (value) => (value === null || value === undefined) ? 'N/A' : `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}%`;

  const summaryRows = [
    ['Metric', 'Value'],
    ['Daily Sales', Number(salesData.daily || 0).toFixed(2)],
    ['Weekly Sales', Number(salesData.weekly || 0).toFixed(2)],
    ['Monthly Sales', Number(salesData.monthly || 0).toFixed(2)],
    ['Quarterly Sales', Number(salesData.quarterly || 0).toFixed(2)],
    ['Yearly Sales', Number(salesData.yearly || 0).toFixed(2)],
    [''],
    ['Revenue', Number(revenueData.revenue || 0).toFixed(2)],
    ['Cost of Goods Sold', Number(revenueData.cost || 0).toFixed(2)],
    ['Items Sold', Number(revenueData.itemsSold || 0)],
    [''],
    ['Growth vs previous period', ''],
    ['Weekly Growth', formatGrowthCell(salesGrowth.weekly)],
    ['Monthly Growth', formatGrowthCell(salesGrowth.monthly)],
    ['Quarterly Growth', formatGrowthCell(salesGrowth.quarterly)],
    ['Yearly Growth', formatGrowthCell(salesGrowth.yearly)],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet['!cols'] = [{ wch: 28 }, { wch: 18 }];

  const trendRows = [['Date', 'Sales']];
  salesTrend.forEach(t => trendRows.push([t.date || t.label || '', Number(t.amount || t.value || 0).toFixed(2)]));
  const trendSheet = XLSX.utils.aoa_to_sheet(trendRows);
  trendSheet['!cols'] = [{ wch: 18 }, { wch: 16 }];

  XLSX.utils.book_append_sheet(workbook, buildMetadataSheet('Sales Summary Report', period), 'Metadata');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  XLSX.utils.book_append_sheet(workbook, trendSheet, 'Sales Trend');

  const filename = buildFilename('sales_summary', period);
  XLSX.writeFile(workbook, filename);
  return filename;
};

/**
 * Export the Top Products table.
 */
export const exportTopProductsToExcel = ({ topProducts = [], period = 'monthly' } = {}) => {
  const workbook = XLSX.utils.book_new();

  const rows = [['Rank', 'Product', 'Units Sold', 'Revenue']];
  topProducts.forEach((p, idx) => rows.push([
    idx + 1,
    p.name || '—',
    Number(p.quantity || 0),
    Number(p.revenue || 0).toFixed(2),
  ]));

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 6 }, { wch: 36 }, { wch: 12 }, { wch: 16 }];

  XLSX.utils.book_append_sheet(workbook, buildMetadataSheet('Top Products Report', period, [['Rows', topProducts.length]]), 'Metadata');
  XLSX.utils.book_append_sheet(workbook, sheet, 'Top Products');

  const filename = buildFilename('top_products', period);
  XLSX.writeFile(workbook, filename);
  return filename;
};

/**
 * Export the Category Performance table.
 */
export const exportCategoryPerformanceToExcel = ({ categoryDistribution = [], period = 'monthly' } = {}) => {
  const workbook = XLSX.utils.book_new();

  const totalSales = categoryDistribution.reduce((sum, c) => sum + Number(c.sales || 0), 0);
  const rows = [['Category', 'Sales', 'Share (%)']];
  categoryDistribution.forEach(c => {
    const sales = Number(c.sales || 0);
    const share = totalSales > 0 ? (sales / totalSales) * 100 : 0;
    rows.push([c.category || '—', sales.toFixed(2), share.toFixed(2)]);
  });
  rows.push(['']);
  rows.push(['Total', totalSales.toFixed(2), '100.00']);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }];

  XLSX.utils.book_append_sheet(workbook, buildMetadataSheet('Category Performance Report', period, [['Total Sales', totalSales.toFixed(2)]]), 'Metadata');
  XLSX.utils.book_append_sheet(workbook, sheet, 'Categories');

  const filename = buildFilename('category_performance', period);
  XLSX.writeFile(workbook, filename);
  return filename;
};

/**
 * Export the Dead Stock table.
 */
export const exportDeadStockToExcel = ({ deadStock = [], daysThreshold = 60, period = 'all' } = {}) => {
  const workbook = XLSX.utils.book_new();

  const rows = [[
    'Product',
    'Category',
    'Quantity on Hand',
    'Cost Price',
    'Selling Price',
    'Tied-up Cost',
    'Tied-up Retail',
    'Last Sold',
    'Days Since Last Sale',
    'Total Units Sold (lifetime)',
  ]];

  let totalCost = 0;
  let totalRetail = 0;
  deadStock.forEach(p => {
    const tiedCost = Number(p.tiedUpCost || 0);
    const tiedRetail = Number(p.tiedUpRetail || 0);
    totalCost += tiedCost;
    totalRetail += tiedRetail;
    rows.push([
      p.name || '—',
      p.category_name || p.category || '—',
      Number(p.quantity || 0),
      Number(p.cost || 0).toFixed(2),
      Number(p.price || 0).toFixed(2),
      tiedCost.toFixed(2),
      tiedRetail.toFixed(2),
      p.lastSold ? new Date(p.lastSold).toLocaleDateString() : 'Never',
      p.daysSinceLastSale === null || p.daysSinceLastSale === undefined ? 'N/A' : p.daysSinceLastSale,
      Number(p.totalSold || 0),
    ]);
  });

  rows.push(['']);
  rows.push(['Totals', '', '', '', '', totalCost.toFixed(2), totalRetail.toFixed(2), '', '', '']);

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 32 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(
    workbook,
    buildMetadataSheet('Dead Stock Report', period, [
      ['Threshold (days)', daysThreshold],
      ['Items', deadStock.length],
      ['Total Tied-up Cost', totalCost.toFixed(2)],
      ['Total Tied-up Retail', totalRetail.toFixed(2)],
    ]),
    'Metadata'
  );
  XLSX.utils.book_append_sheet(workbook, sheet, 'Dead Stock');

  const filename = buildFilename(`dead_stock_${daysThreshold}d`, period);
  XLSX.writeFile(workbook, filename);
  return filename;
};

/**
 * Export the ABC Analysis table.
 */
export const exportAbcAnalysisToExcel = ({ abcAnalysis = [], period = 'monthly' } = {}) => {
  const workbook = XLSX.utils.book_new();

  const rows = [[
    'Rank',
    'Product',
    'Units Sold',
    'Revenue',
    'Revenue Share (%)',
    'Cumulative Share (%)',
    'Class',
  ]];

  abcAnalysis.forEach(p => {
    rows.push([
      p.rank,
      p.name || '—',
      Number(p.quantity || 0),
      Number(p.revenue || 0).toFixed(2),
      Number(p.sharePct || 0).toFixed(2),
      Number(p.cumulativePct || 0).toFixed(2),
      p.bucket,
    ]);
  });

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [
    { wch: 6 }, { wch: 32 }, { wch: 12 }, { wch: 14 },
    { wch: 18 }, { wch: 22 }, { wch: 8 },
  ];

  // Class breakdown
  const counts = abcAnalysis.reduce((acc, p) => { acc[p.bucket] = (acc[p.bucket] || 0) + 1; return acc; }, {});
  const revenueByClass = abcAnalysis.reduce((acc, p) => { acc[p.bucket] = (acc[p.bucket] || 0) + Number(p.revenue || 0); return acc; }, {});
  const breakdownRows = [
    ['Class', 'Description', 'Items', 'Revenue', 'Share of Total Revenue (%)']
  ];
  const totalRevenue = abcAnalysis.reduce((sum, p) => sum + Number(p.revenue || 0), 0);
  ['A', 'B', 'C'].forEach(b => {
    const desc = b === 'A' ? 'Top ~80% revenue (high priority)'
      : b === 'B' ? 'Next ~15% revenue (medium priority)'
      : 'Bottom ~5% revenue (low priority)';
    breakdownRows.push([
      b,
      desc,
      counts[b] || 0,
      (revenueByClass[b] || 0).toFixed(2),
      totalRevenue > 0 ? (((revenueByClass[b] || 0) / totalRevenue) * 100).toFixed(2) : '0.00',
    ]);
  });
  const breakdownSheet = XLSX.utils.aoa_to_sheet(breakdownRows);
  breakdownSheet['!cols'] = [{ wch: 8 }, { wch: 38 }, { wch: 10 }, { wch: 16 }, { wch: 26 }];

  XLSX.utils.book_append_sheet(
    workbook,
    buildMetadataSheet('ABC Analysis Report', period, [
      ['Total Products', abcAnalysis.length],
      ['Total Revenue', totalRevenue.toFixed(2)],
    ]),
    'Metadata'
  );
  XLSX.utils.book_append_sheet(workbook, breakdownSheet, 'Class Breakdown');
  XLSX.utils.book_append_sheet(workbook, sheet, 'Products');

  const filename = buildFilename('abc_analysis', period);
  XLSX.writeFile(workbook, filename);
  return filename;
};

export default {
  exportToCSV,
  exportSalesToPDF,
  exportStatisticalReportPDF,
  exportTransactionsToExcel,
  exportSalesToExcel,
  exportProductsToExcel,
  importProductsFromExcel,
  downloadImportTemplate,
  exportSalesSummaryToExcel,
  exportTopProductsToExcel,
  exportCategoryPerformanceToExcel,
  exportDeadStockToExcel,
  exportAbcAnalysisToExcel,
};
