import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { transactionService, productService, reportService } from '../../services/api';
import { useAuth, usePermissions } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/formatters';
import {
  DocumentTextIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  BanknotesIcon,
  FireIcon,
  ArchiveBoxXMarkIcon,
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  CubeIcon
} from '@heroicons/react/24/outline';
import ProductHistoryDrawer from '../Inventory/ProductHistoryDrawer';

const ReportsScreen = () => {
  const { colors } = useTheme();
  const { settings } = useSettings();
  const { hasPermission } = usePermissions();
  const [activeReport, setActiveReport] = useState('sales');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState({
    sales: [],
    transactions: [],
    stockMovement: [],
    restocking: [],
    abc: null,
    deadStock: null,
    inventoryValue: null,
    allProducts: [],
  });
  const [abcMetric, setAbcMetric] = useState('revenue');
  const [deadStockDays, setDeadStockDays] = useState(60);
  const [productSearch, setProductSearch] = useState('');
  const [historyProduct, setHistoryProduct] = useState(null);
  const [filters, setFilters] = useState({
    category: '',
    paymentMethod: '',
    minAmount: '',
    maxAmount: ''
  });

  useEffect(() => {
    loadReportData();
  }, [activeReport, dateRange, abcMetric, deadStockDays]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      if (activeReport === 'abc') {
        const res = await reportService.abcAnalysis({
          startDate: new Date(dateRange.startDate).toISOString(),
          endDate: (() => { const d = new Date(dateRange.endDate); d.setHours(23, 59, 59, 999); return d.toISOString(); })(),
          metric: abcMetric,
        });
        setReportData(prev => ({ ...prev, abc: res }));
        return;
      }
      if (activeReport === 'deadStock') {
        const res = await reportService.deadStock({
          days: deadStockDays,
          maxQuantitySold: 0,
          includeZeroStock: false,
        });
        setReportData(prev => ({ ...prev, deadStock: res }));
        return;
      }
      if (activeReport === 'inventoryValue' || activeReport === 'productHistory') {
        const products = await productService.getAll();
        const list = Array.isArray(products) ? products : (products?.rows || []);
        let totalInventoryValue = 0;
        let totalRetailValue = 0;
        const byCategory = {};
        for (const p of list) {
          const qty = Number(p.quantity) || 0;
          const cost = Number(p.cost) || 0;
          const price = Number(p.price) || 0;
          const costVal = qty * cost;
          const retailVal = qty * price;
          totalInventoryValue += costVal;
          totalRetailValue += retailVal;
          const cat = p.category_name || p.category || 'Uncategorized';
          if (!byCategory[cat]) byCategory[cat] = { category: cat, items: 0, units: 0, costValue: 0, retailValue: 0 };
          byCategory[cat].items += 1;
          byCategory[cat].units += qty;
          byCategory[cat].costValue += costVal;
          byCategory[cat].retailValue += retailVal;
        }
        const potentialProfit = totalRetailValue - totalInventoryValue;
        const potentialMarginPct = totalRetailValue > 0 ? (potentialProfit / totalRetailValue) * 100 : 0;
        const categories = Object.values(byCategory)
          .map(c => ({ ...c, profit: c.retailValue - c.costValue, margin: c.retailValue > 0 ? ((c.retailValue - c.costValue) / c.retailValue) * 100 : 0 }))
          .sort((a, b) => b.retailValue - a.retailValue);
        setReportData(prev => ({
          ...prev,
          allProducts: list,
          inventoryValue: {
            totalProducts: list.length,
            totalUnits: list.reduce((s, p) => s + (Number(p.quantity) || 0), 0),
            totalInventoryValue,
            totalRetailValue,
            potentialProfit,
            potentialMarginPct,
            categories,
          },
        }));
        return;
      }

      const [transactions, products] = await Promise.all([
        transactionService.getAll(),
        productService.getAll()
      ]);

      const filteredTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.timestamp);
        const startDate = new Date(dateRange.startDate);
        const endDate = new Date(dateRange.endDate);
        endDate.setHours(23, 59, 59, 999);

        return transactionDate >= startDate && transactionDate <= endDate;
      });

      setReportData(prev => ({
        ...prev,
        sales: generateSalesReport(filteredTransactions),
        transactions: filteredTransactions,
        stockMovement: generateStockMovementReport(filteredTransactions, products),
        restocking: generateRestockingReport(products)
      }));
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateSalesReport = (transactions) => {
    const salesByDate = {};
    const salesByProduct = {};
    const salesByCategory = {};

    transactions.forEach(transaction => {
      const date = new Date(transaction.timestamp).toLocaleDateString();

      // Sales by date
      if (!salesByDate[date]) {
        salesByDate[date] = {
          date,
          transactions: 0,
          revenue: 0,
          itemsSold: 0
        };
      }
      salesByDate[date].transactions++;
      salesByDate[date].revenue += transaction.total;
      salesByDate[date].itemsSold += transaction.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;

      // Sales by product and category
      transaction.items?.forEach(item => {
        if (!salesByProduct[item.productId]) {
          salesByProduct[item.productId] = {
            productId: item.productId,
            name: item.name,
            category: item.category || 'Uncategorized',
            unitsSold: 0,
            revenue: 0
          };
        }
        salesByProduct[item.productId].unitsSold += item.quantity;
        salesByProduct[item.productId].revenue += item.subtotal;

        const category = item.category || 'Uncategorized';
        if (!salesByCategory[category]) {
          salesByCategory[category] = {
            category,
            unitsSold: 0,
            revenue: 0
          };
        }
        salesByCategory[category].unitsSold += item.quantity;
        salesByCategory[category].revenue += item.subtotal;
      });
    });

    return {
      dailySales: Object.values(salesByDate).sort((a, b) => new Date(a.date) - new Date(b.date)),
      productSales: Object.values(salesByProduct).sort((a, b) => b.revenue - a.revenue),
      categorySales: Object.values(salesByCategory).sort((a, b) => b.revenue - a.revenue),
      summary: {
        totalTransactions: transactions.length,
        totalRevenue: transactions.reduce((sum, t) => sum + t.total, 0),
        totalItemsSold: transactions.reduce((sum, t) =>
          sum + (t.items?.reduce((itemSum, item) => itemSum + item.quantity, 0) || 0), 0
        ),
        avgTransactionValue: transactions.length > 0 ?
          transactions.reduce((sum, t) => sum + t.total, 0) / transactions.length : 0
      }
    };
  };

  const generateStockMovementReport = (transactions, products) => {
    const movements = [];
    const productMap = {};

    products.forEach(product => {
      productMap[product.id] = product;
    });

    transactions.forEach(transaction => {
      transaction.items?.forEach(item => {
        movements.push({
          id: `${transaction.id}-${item.productId}`,
          timestamp: transaction.timestamp,
          productId: item.productId,
          productName: item.name,
          category: item.category || 'Uncategorized',
          type: 'SALE',
          quantity: -item.quantity, // Negative for sales
          unitPrice: item.price,
          totalValue: item.subtotal,
          reference: transaction.id,
          description: `Sale - Transaction ${transaction.id}`
        });
      });
    });

    // Sort by timestamp descending
    movements.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return movements;
  };

  const generateRestockingReport = (products) => {
    // This would typically come from inventory management records
    // For now, we'll generate based on current stock levels and thresholds
    return products.map(product => ({
      productId: product.id,
      productName: product.name,
      category: product.category || 'Uncategorized',
      currentStock: product.quantity,
      status: product.quantity <= (settings.lowStockThreshold ?? 10) ? 'LOW_STOCK' : 'ADEQUATE',
      lastRestockDate: product.lastRestockDate || 'N/A',
      supplier: product.supplier || 'N/A'
    })).sort((a, b) => a.currentStock - b.currentStock);
  };

  const exportReport = (format = 'csv') => {
    const data = reportData[activeReport];
    let csvContent = '';
    let headers = [];
    let rows = [];

    switch (activeReport) {
      case 'sales':
        if (data.dailySales) {
          headers = ['Date', 'Transactions', 'Revenue', 'Items Sold'];
          rows = data.dailySales.map(item => [
            item.date,
            item.transactions,
            item.revenue.toFixed(2),
            item.itemsSold
          ]);
        }
        break;
      case 'transactions':
        headers = ['Transaction ID', 'Date', 'Total', 'Payment Method', 'Items Count'];
        rows = data.map(transaction => [
          transaction.id,
          new Date(transaction.timestamp).toLocaleString(),
          transaction.total.toFixed(2),
          transaction.paymentMethod || 'N/A',
          transaction.items?.length || 0
        ]);
        break;
      case 'stockMovement':
        headers = ['Date', 'Product', 'Type', 'Quantity', 'Unit Price', 'Total Value', 'Reference'];
        rows = data.map(movement => [
          new Date(movement.timestamp).toLocaleString(),
          movement.productName,
          movement.type,
          movement.quantity,
          movement.unitPrice.toFixed(2),
          movement.totalValue.toFixed(2),
          movement.reference
        ]);
        break;
      case 'restocking':
        headers = ['Product', 'Category', 'Current Stock', 'Status'];
        rows = data.map(item => [
          item.productName,
          item.category,
          item.currentStock,
          item.status
        ]);
        break;
    }

    csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeReport}_report_${dateRange.startDate}_to_${dateRange.endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Report exported successfully');
  };

  const applyFilters = (data) => {
    if (!Array.isArray(data)) return data;

    return data.filter(item => {
      if (filters.category && item.category !== filters.category) return false;
      if (filters.paymentMethod && item.paymentMethod !== filters.paymentMethod) return false;
      if (filters.minAmount && (item.total || item.revenue || item.totalValue || 0) < parseFloat(filters.minAmount)) return false;
      if (filters.maxAmount && (item.total || item.revenue || item.totalValue || 0) > parseFloat(filters.maxAmount)) return false;
      return true;
    });
  };

  const reportTypes = [
    { key: 'sales', label: 'Sales Summary', icon: ChartBarIcon },
    { key: 'transactions', label: 'Transaction History', icon: BanknotesIcon },
    { key: 'stockMovement', label: 'Stock Movement', icon: ClipboardDocumentListIcon },
    { key: 'restocking', label: 'Restocking Report', icon: TruckIcon },
    { key: 'abc', label: 'ABC Analysis', icon: FireIcon },
    { key: 'deadStock', label: 'Dead Stock', icon: ArchiveBoxXMarkIcon },
    { key: 'inventoryValue', label: 'Inventory Value', icon: CurrencyDollarIcon },
    { key: 'productHistory', label: 'Product History', icon: ClockIcon },
  ];

  const renderSalesReport = () => {
    const data = reportData.sales;

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-sm font-medium text-blue-600">Total Transactions</h3>
            <p className="text-2xl font-bold text-blue-800">{data.summary?.totalTransactions || 0}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="text-sm font-medium text-green-600">Total Revenue</h3>
            <p className="text-2xl font-bold text-green-800">{formatCurrency(data.summary?.totalRevenue || 0)}</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
            <h3 className="text-sm font-medium text-purple-600">Items Sold</h3>
            <p className="text-2xl font-bold text-purple-800">{data.summary?.totalItemsSold || 0}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h3 className="text-sm font-medium text-yellow-600">Avg. Transaction</h3>
            <p className="text-2xl font-bold text-yellow-800">{formatCurrency(data.summary?.avgTransactionValue || 0)}</p>
          </div>
        </div>

        {/* Daily Sales Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium">Daily Sales Breakdown</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transactions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items Sold</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(data.dailySales || []).map((day, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{day.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{day.transactions}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(day.revenue)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{day.itemsSold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium">Top Selling Products</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units Sold</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(data.productSales || []).slice(0, 10).map((product, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.unitsSold}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderTransactionsReport = () => {
    const filteredData = applyFilters(reportData.transactions);

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Transaction History</h3>
          <p className="text-sm text-gray-500 mt-1">
            Showing {filteredData.length} of {reportData.transactions.length} transactions
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((transaction, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{transaction.id}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {transaction.items?.length || 0} items
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs rounded-full ${transaction.paymentMethod === 'cash' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                      {transaction.paymentMethod || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(transaction.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStockMovementReport = () => {
    const filteredData = applyFilters(reportData.stockMovement);

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Stock Movement History</h3>
          <p className="text-sm text-gray-500 mt-1">
            Showing {filteredData.length} of {reportData.stockMovement.length} movements
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredData.map((movement, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(movement.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {movement.productName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`px-2 py-1 text-xs rounded-full ${movement.type === 'SALE' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                      {movement.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={movement.quantity < 0 ? 'text-red-600' : 'text-green-600'}>
                      {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(movement.unitPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatCurrency(Math.abs(movement.totalValue))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {movement.reference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRestockingReport = () => {
    const filteredData = applyFilters(reportData.restocking);
    const lowStockItems = filteredData.filter(item => item.status === 'LOW_STOCK');

    return (
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg border border-red-200">
            <h3 className="text-sm font-medium text-red-600">Low Stock Items</h3>
            <p className="text-2xl font-bold text-red-800">{lowStockItems.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <h3 className="text-sm font-medium text-green-600">Adequate Stock</h3>
            <p className="text-2xl font-bold text-green-800">{filteredData.length - lowStockItems.length}</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="text-sm font-medium text-blue-600">Total Products</h3>
            <p className="text-2xl font-bold text-blue-800">{filteredData.length}</p>
          </div>
        </div>

        {/* Restocking Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium">Inventory Status & Reorder Suggestions</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((item, index) => (
                  <tr key={index} className={item.status === 'LOW_STOCK' ? 'bg-red-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.productName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.currentStock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 text-xs rounded-full ${item.status === 'LOW_STOCK' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                        {item.status === 'LOW_STOCK' ? 'Low Stock' : 'Adequate'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderAbcReport = () => {
    const data = reportData.abc;
    if (!data) return <div className={`${colors.text.secondary} text-center py-10`}>No data</div>;

    const classColor = (c) =>
      c === 'A' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
      : c === 'B' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';

    const metricLabel = data.metric === 'quantity' ? 'Quantity Sold'
      : data.metric === 'profit' ? 'Gross Profit'
      : 'Revenue';
    const metricFmt = (v) => data.metric === 'quantity' ? Number(v || 0).toLocaleString() : formatCurrency(v);

    return (
      <div className="space-y-6">
        {/* Metric picker + summary */}
        <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-4`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className={`text-sm font-medium ${colors.text.primary}`}>Rank by:</label>
              <select
                value={abcMetric}
                onChange={(e) => setAbcMetric(e.target.value)}
                className={`border rounded-lg px-3 py-1.5 text-sm ${colors.input.primary}`}
              >
                <option value="revenue">Revenue</option>
                <option value="profit">Gross Profit</option>
                <option value="quantity">Quantity Sold</option>
              </select>
            </div>
            <p className={`text-sm ${colors.text.secondary}`}>
              {data.totalProducts} products · Grand total: <span className={`font-semibold ${colors.text.primary}`}>{metricFmt(data.grandTotal)}</span>
            </p>
          </div>
        </div>

        {/* Class summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['A', 'B', 'C'].map((cls) => {
            const s = data.summary[cls];
            const sharePct = data.grandTotal > 0 ? (s.value / data.grandTotal) * 100 : 0;
            return (
              <div
                key={cls}
                className={`rounded-xl border p-4 ${
                  cls === 'A' ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800'
                  : cls === 'B' ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${classColor(cls)}`}>CLASS {cls}</span>
                  <span className={`text-xs ${colors.text.secondary}`}>
                    {cls === 'A' ? 'Top 80%' : cls === 'B' ? 'Next 15%' : 'Final 5%'}
                  </span>
                </div>
                <p className={`text-2xl font-bold ${colors.text.primary}`}>{s.count}</p>
                <p className={`text-sm ${colors.text.secondary}`}>products</p>
                <p className={`mt-2 text-sm font-semibold ${colors.text.primary}`}>{metricFmt(s.value)}</p>
                <p className={`text-xs ${colors.text.tertiary}`}>{sharePct.toFixed(1)}% of {metricLabel.toLowerCase()}</p>
              </div>
            );
          })}
        </div>

        {/* Detail table */}
        <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
            <h3 className={`text-lg font-medium ${colors.text.primary}`}>Products by {metricLabel}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={colors.bg.secondary}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Class</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Product</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Category</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Qty Sold</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Revenue</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Profit</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Share</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Cumulative</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${colors.border.primary}`}>
                {data.rows.map((r) => (
                  <tr key={r.productId} className={`hover:${colors.bg.secondary}`}>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 text-xs font-bold rounded ${classColor(r.classification)}`}>{r.classification}</span>
                    </td>
                    <td className={`px-6 py-3 text-sm font-medium ${colors.text.primary}`}>{r.productName}</td>
                    <td className={`px-6 py-3 text-sm ${colors.text.secondary}`}>{r.categoryName}</td>
                    <td className={`px-6 py-3 text-sm text-right ${colors.text.secondary}`}>{r.totalQuantity.toLocaleString()}</td>
                    <td className={`px-6 py-3 text-sm text-right ${colors.text.primary}`}>{formatCurrency(r.totalRevenue)}</td>
                    <td className={`px-6 py-3 text-sm text-right ${r.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {formatCurrency(r.totalProfit)}
                    </td>
                    <td className={`px-6 py-3 text-sm text-right ${colors.text.secondary}`}>{r.sharePct.toFixed(1)}%</td>
                    <td className={`px-6 py-3 text-sm text-right ${colors.text.secondary}`}>{r.cumulativePct.toFixed(1)}%</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`px-6 py-10 text-center ${colors.text.secondary}`}>
                      No sales in the selected date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderDeadStockReport = () => {
    const data = reportData.deadStock;
    if (!data) return <div className={`${colors.text.secondary} text-center py-10`}>No data</div>;

    return (
      <div className="space-y-6">
        {/* Controls + summary */}
        <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-4`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className={`text-sm font-medium ${colors.text.primary}`}>Not sold in last:</label>
              <select
                value={deadStockDays}
                onChange={(e) => setDeadStockDays(parseInt(e.target.value, 10))}
                className={`border rounded-lg px-3 py-1.5 text-sm ${colors.input.primary}`}
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
                <option value={180}>180 days</option>
                <option value={365}>365 days</option>
              </select>
            </div>
            <p className={`text-sm ${colors.text.secondary}`}>
              <span className={`font-semibold ${colors.text.primary}`}>{data.totalFlagged}</span> products · Cost locked: <span className={`font-semibold ${colors.text.primary}`}>{formatCurrency(data.totalCostLocked)}</span>
            </p>
          </div>
        </div>

        {/* Table */}
        <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
            <h3 className={`text-lg font-medium ${colors.text.primary}`}>Dead Stock Candidates</h3>
            <p className={`text-xs mt-0.5 ${colors.text.secondary}`}>
              Products with 0 sales in the window. Sorted by cost tied up.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className={colors.bg.secondary}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Product</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Category</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Qty On Hand</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Cost</th>
                  <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Value Locked</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Last Sold</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${colors.border.primary}`}>
                {data.rows.map((r) => (
                  <tr key={r.productId} className={`hover:${colors.bg.secondary}`}>
                    <td className="px-6 py-3">
                      <p className={`text-sm font-medium ${colors.text.primary}`}>{r.productName}</p>
                      {r.barcode && <p className={`text-xs font-mono ${colors.text.tertiary}`}>{r.barcode}</p>}
                    </td>
                    <td className={`px-6 py-3 text-sm ${colors.text.secondary}`}>{r.categoryName || '—'}</td>
                    <td className={`px-6 py-3 text-sm text-right ${colors.text.secondary}`}>{r.quantityOnHand}</td>
                    <td className={`px-6 py-3 text-sm text-right ${colors.text.secondary}`}>{formatCurrency(r.cost)}</td>
                    <td className={`px-6 py-3 text-sm text-right font-semibold text-red-600 dark:text-red-400`}>
                      {formatCurrency(r.inventoryCostValue)}
                    </td>
                    <td className={`px-6 py-3 text-sm ${colors.text.secondary}`}>
                      {r.lastSoldAt ? (
                        <span title={new Date(r.lastSoldAt).toLocaleString()}>
                          {r.daysSinceLastSale}d ago
                        </span>
                      ) : (
                        <span className="italic opacity-70">Never sold</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className={`px-6 py-10 text-center ${colors.text.secondary}`}>
                      No dead stock in this window. Nice inventory turnover!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderInventoryValueReport = () => {
    const data = reportData.inventoryValue;
    if (!data) {
      return <div className={`text-center py-12 ${colors.text.secondary}`}>Loading inventory value…</div>;
    }
    return (
      <div className="space-y-6">
        <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-5`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50">
              <div className="p-3 rounded-xl bg-slate-200 dark:bg-slate-700">
                <BanknotesIcon className="h-6 w-6 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <p className={`text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Inventory Cost Value</p>
                <p className={`text-xl font-bold ${colors.text.primary}`}>{formatCurrency(data.totalInventoryValue)}</p>
                <p className={`text-xs ${colors.text.tertiary} mt-0.5`}>{data.totalProducts} products · {data.totalUnits} units</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20">
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/40">
                <CurrencyDollarIcon className="h-6 w-6 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-blue-700 dark:text-blue-300">Retail Value</p>
                <p className={`text-xl font-bold ${colors.text.primary}`}>{formatCurrency(data.totalRetailValue)}</p>
                <p className={`text-xs ${colors.text.tertiary} mt-0.5`}>At listed prices</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40">
                <ArrowTrendingUpIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-300" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Potential Profit</p>
                <p className={`text-xl font-bold ${colors.text.primary}`}>
                  {formatCurrency(data.potentialProfit)}
                  <span className={`ml-2 text-sm font-semibold ${data.potentialMarginPct >= 25 ? 'text-emerald-600 dark:text-emerald-400' : data.potentialMarginPct >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                    ({data.potentialMarginPct.toFixed(1)}%)
                  </span>
                </p>
                <p className={`text-xs ${colors.text.tertiary} mt-0.5`}>If entire stock sells at current prices</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
            <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Value by Category</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={`${colors.bg.secondary} ${colors.text.secondary}`}>
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Products</th>
                  <th className="px-4 py-3 text-right font-medium">Units</th>
                  <th className="px-4 py-3 text-right font-medium">Cost Value</th>
                  <th className="px-4 py-3 text-right font-medium">Retail Value</th>
                  <th className="px-4 py-3 text-right font-medium">Profit</th>
                  <th className="px-4 py-3 text-right font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${colors.border.primary}`}>
                {data.categories.map(c => (
                  <tr key={c.category}>
                    <td className={`px-4 py-3 ${colors.text.primary} font-medium`}>{c.category}</td>
                    <td className={`px-4 py-3 text-right ${colors.text.secondary}`}>{c.items}</td>
                    <td className={`px-4 py-3 text-right ${colors.text.secondary}`}>{c.units}</td>
                    <td className={`px-4 py-3 text-right ${colors.text.secondary}`}>{formatCurrency(c.costValue)}</td>
                    <td className={`px-4 py-3 text-right ${colors.text.secondary}`}>{formatCurrency(c.retailValue)}</td>
                    <td className={`px-4 py-3 text-right font-medium ${colors.text.primary}`}>{formatCurrency(c.profit)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${c.margin >= 25 ? 'text-emerald-600 dark:text-emerald-400' : c.margin >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {c.margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {data.categories.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`px-4 py-10 text-center ${colors.text.secondary}`}>
                      No products to summarize.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderProductHistoryReport = () => {
    const products = reportData.allProducts || [];
    const q = productSearch.trim().toLowerCase();
    const filtered = q
      ? products.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q) ||
          (p.category_name || p.category || '').toLowerCase().includes(q)
        )
      : products;

    return (
      <div className="space-y-4">
        <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-5`}>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <ClockIcon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </div>
            <div>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Product History</h3>
              <p className={`text-sm ${colors.text.secondary}`}>
                Select a product to view its full timeline of edits, stock adjustments, movements, and sales.
              </p>
            </div>
          </div>
          <div className="relative">
            <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${colors.text.tertiary}`} />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search product by name, barcode, or category…"
              className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${colors.input.primary}`}
            />
          </div>
        </div>

        <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
          <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className={`${colors.bg.secondary} ${colors.text.secondary} sticky top-0`}>
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Product</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-right font-medium">Stock</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${colors.border.primary}`}>
                {filtered.map(p => (
                  <tr key={p.id} className={`hover:${colors.bg.secondary}`}>
                    <td className={`px-4 py-3 ${colors.text.primary}`}>
                      <div className="flex items-center gap-2">
                        <CubeIcon className={`h-4 w-4 ${colors.text.tertiary}`} />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.barcode && <div className={`text-xs ${colors.text.tertiary}`}>{p.barcode}</div>}
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${colors.text.secondary}`}>{p.category_name || p.category || 'Uncategorized'}</td>
                    <td className={`px-4 py-3 text-right ${colors.text.secondary}`}>{p.quantity}</td>
                    <td className={`px-4 py-3 text-right ${colors.text.secondary}`}>{formatCurrency(p.price)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setHistoryProduct(p)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-xs font-medium"
                      >
                        <ClockIcon className="h-4 w-4" /> View History
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className={`px-4 py-10 text-center ${colors.text.secondary}`}>
                      {products.length === 0 ? 'Loading products…' : 'No products match your search.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReportContent = () => {
    switch (activeReport) {
      case 'sales':
        return renderSalesReport();
      case 'transactions':
        return renderTransactionsReport();
      case 'stockMovement':
        return renderStockMovementReport();
      case 'restocking':
        return renderRestockingReport();
      case 'abc':
        return renderAbcReport();
      case 'deadStock':
        return renderDeadStockReport();
      case 'inventoryValue':
        return renderInventoryValueReport();
      case 'productHistory':
        return renderProductHistoryReport();
      default:
        return <div>Report not found</div>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Reports</h1>
        <div className="flex items-center gap-4">
          {hasPermission('export_reports') && (
            <button
              onClick={() => exportReport('csv')}
              className="flex items-center px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600"
              disabled={isLoading}
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-4 mb-6`}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Date Range */}
          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>Start Date</label>
            <input
              type="date"
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>End Date</label>
            <input
              type="date"
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          {/* Filters */}
          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>Category Filter</label>
            <select
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="">All Categories</option>
              {/* Add category options dynamically */}
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>Payment Method</label>
            <select
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={filters.paymentMethod}
              onChange={(e) => setFilters(prev => ({ ...prev, paymentMethod: e.target.value }))}
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>
      </div>

      {/* Report Type Tabs */}
      <div className="flex space-x-1 mb-6">
        {reportTypes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveReport(key)}
            className={`flex items-center px-4 py-2 rounded-lg transition-colors ${activeReport === key
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white'
              : `${colors.card.primary} ${colors.text.secondary} hover:${colors.text.primary} border ${colors.border.primary}`
              }`}
          >
            <Icon className="h-4 w-4 mr-2" />
            {label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className={`${colors.text.secondary}`}>Loading report data...</p>
            </div>
          </div>
        ) : (
          renderReportContent()
        )}
      </div>

      <ProductHistoryDrawer
        isOpen={!!historyProduct}
        onClose={() => setHistoryProduct(null)}
        product={historyProduct}
      />
    </div>
  );
};

export default ReportsScreen; 