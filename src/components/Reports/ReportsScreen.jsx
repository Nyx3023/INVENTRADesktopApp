import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { analyticsService } from '../../services/api';
import { usePermissions } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { formatCurrency } from '../../utils/formatters';
import LazyPageLoader from '../common/LazyPageLoader';
import {
  DocumentTextIcon,
  CalendarIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  TruckIcon,
  BanknotesIcon
} from '@heroicons/react/24/outline';

const TRANSACTIONS_PAGE_SIZE = 50;
const MOVEMENTS_PAGE_SIZE = 100;

const ReportsScreen = () => {
  const { colors } = useTheme();
  const { hasPermission } = usePermissions();
  const [activeReport, setActiveReport] = useState('sales');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState({
    sales: { dailySales: [], productSales: [], categorySales: [], summary: {} },
    transactions: [],
    stockMovement: [],
    restocking: []
  });
  const [filters, setFilters] = useState({
    category: '',
    paymentMethod: '',
    minAmount: '',
    maxAmount: ''
  });
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [stockMovementPage, setStockMovementPage] = useState(1);
  const [reportMeta, setReportMeta] = useState({
    transactions: { total: 0, page: 1, limit: TRANSACTIONS_PAGE_SIZE, hasNextPage: false },
    stockMovement: { total: 0, page: 1, limit: MOVEMENTS_PAGE_SIZE, hasNextPage: false },
  });

  useEffect(() => {
    loadReportData();
  }, [
    activeReport,
    dateRange.startDate,
    dateRange.endDate,
    transactionsPage,
    stockMovementPage,
    filters.category,
    filters.paymentMethod,
    filters.minAmount,
    filters.maxAmount
  ]);

  useEffect(() => {
    setTransactionsPage(1);
    setStockMovementPage(1);
  }, [dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    setTransactionsPage(1);
    setStockMovementPage(1);
  }, [filters.category, filters.paymentMethod, filters.minAmount, filters.maxAmount]);

  const loadReportData = async () => {
    setIsLoading(true);
    try {
      const data = await analyticsService.getReportsSummary({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        transactionPage: transactionsPage,
        transactionLimit: TRANSACTIONS_PAGE_SIZE,
        movementPage: stockMovementPage,
        movementLimit: MOVEMENTS_PAGE_SIZE,
        category: filters.category || undefined,
        paymentMethod: filters.paymentMethod || undefined,
        minAmount: filters.minAmount || undefined,
        maxAmount: filters.maxAmount || undefined,
      });

      setReportData({
        sales: data.sales || { dailySales: [], productSales: [], categorySales: [], summary: {} },
        transactions: data.transactions?.items || [],
        stockMovement: data.stockMovement?.items || [],
        restocking: data.restocking || [],
      });
      setReportMeta({
        transactions: {
          total: data.transactions?.total || 0,
          page: data.transactions?.page || transactionsPage,
          limit: data.transactions?.limit || TRANSACTIONS_PAGE_SIZE,
          hasNextPage: Boolean(data.transactions?.hasNextPage),
        },
        stockMovement: {
          total: data.stockMovement?.total || 0,
          page: data.stockMovement?.page || stockMovementPage,
          limit: data.stockMovement?.limit || MOVEMENTS_PAGE_SIZE,
          hasNextPage: Boolean(data.stockMovement?.hasNextPage),
        },
      });
      setCategoryOptions(Array.isArray(data.availableCategories) ? data.availableCategories : []);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = (format = 'csv') => {
    const data = reportData[activeReport];
    
    // Check if sales data has the expected structure
    const isSalesObject = activeReport === 'sales' && data && !Array.isArray(data) && data.dailySales;
    
    if ((!data || data.length === 0) && !isSalesObject) {
      toast.error('No data to export');
      return;
    }

    let csvContent = '';
    let headers = [];
    let rows = [];

    switch (activeReport) {
      case 'sales':
        if (isSalesObject || data.dailySales) {
          headers = ['Date', 'Transactions', 'Revenue', 'Items Sold'];
          rows = (isSalesObject ? data.dailySales : data.dailySales).map(item => [
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

  const reportTypes = [
    { key: 'sales', label: 'Sales Summary', icon: ChartBarIcon },
    { key: 'transactions', label: 'Transaction History', icon: BanknotesIcon },
    { key: 'stockMovement', label: 'Stock Movement', icon: ClipboardDocumentListIcon },
    { key: 'restocking', label: 'Restocking Report', icon: TruckIcon }
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
    const totalPages = Math.max(1, Math.ceil((reportMeta.transactions.total || 0) / (reportMeta.transactions.limit || TRANSACTIONS_PAGE_SIZE)));

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Transaction History</h3>
          <p className="text-sm text-gray-500 mt-1">
            Showing page {reportMeta.transactions.page} of {totalPages} ({reportMeta.transactions.total} total transactions)
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
              {reportData.transactions.map((transaction) => (
                <tr key={transaction.id}>
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
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            {renderPaginationControls({
              page: reportMeta.transactions.page,
              totalPages,
              onPrev: () => setTransactionsPage((prev) => Math.max(1, prev - 1)),
              onNext: () => setTransactionsPage((prev) => (reportMeta.transactions.hasNextPage ? prev + 1 : prev)),
              hasNext: reportMeta.transactions.hasNextPage,
            })}
          </div>
        )}
      </div>
    );
  };

  const renderStockMovementReport = () => {
    const totalPages = Math.max(1, Math.ceil((reportMeta.stockMovement.total || 0) / (reportMeta.stockMovement.limit || MOVEMENTS_PAGE_SIZE)));

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Stock Movement History</h3>
          <p className="text-sm text-gray-500 mt-1">
            Showing page {reportMeta.stockMovement.page} of {totalPages} ({reportMeta.stockMovement.total} total movements)
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
              {reportData.stockMovement.map((movement, index) => (
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
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            {renderPaginationControls({
              page: reportMeta.stockMovement.page,
              totalPages,
              onPrev: () => setStockMovementPage((prev) => Math.max(1, prev - 1)),
              onNext: () => setStockMovementPage((prev) => (reportMeta.stockMovement.hasNextPage ? prev + 1 : prev)),
              hasNext: reportMeta.stockMovement.hasNextPage,
            })}
          </div>
        )}
      </div>
    );
  };

  const renderPaginationControls = ({ page, totalPages, onPrev, onNext, hasNext }) => (
    <div className="flex items-center justify-between">
      <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="px-3 py-1.5 rounded border border-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );

  const renderRestockingReport = () => {
    const filteredData = reportData.restocking.filter(item => {
      if (filters.category && item.category !== filters.category) return false;
      return true;
    });
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
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
              {categoryOptions.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
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
              <option value="gcash">GCash / E-Wallet</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>Min Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={filters.minAmount}
              onChange={(e) => setFilters(prev => ({ ...prev, minAmount: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>Max Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={filters.maxAmount}
              onChange={(e) => setFilters(prev => ({ ...prev, maxAmount: e.target.value }))}
              placeholder="Any"
            />
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
          <LazyPageLoader
            title="Loading report data"
            subtitle="Aggregating records for the selected range..."
            rows={5}
            centered={false}
          />
        ) : (
          renderReportContent()
        )}
      </div>
    </div>
  );
};

export default ReportsScreen; 