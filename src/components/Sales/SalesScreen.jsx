import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  EyeIcon,
  PrinterIcon,
  ArchiveBoxIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowDownTrayIcon,
  FunnelIcon,
  UserIcon,
  CreditCardIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { transactionService } from '../../services/api';
import { useAuth, usePermissions } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import { toast } from 'react-hot-toast';
import { formatCurrency, formatDate, parseLocalTimestamp } from '../../utils/formatters';
import ReceiptModal from './ReceiptModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import ExportSettingsModal from './ExportSettingsModal';
import { printerService } from '../../utils/printerService';
import { exportSalesToExcel } from '../../utils/exportUtils';
import AdminOverrideModal from '../common/AdminOverrideModal';

const SalesScreen = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { colors } = useTheme();
  const { settings } = useSettings();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [isAdminOverride, setIsAdminOverride] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [cashierFilter, setCashierFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [summary, setSummary] = useState({
    totalSales: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    todaySales: 0
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page when filters change
  }, [transactions, searchTerm, dateFilter, cashierFilter, paymentMethodFilter]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await transactionService.getAll();
      console.log('Loaded transactions:', data);
      setTransactions(data || []);
      calculateSummary(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSummary = (transactionList) => {
    const totalSales = transactionList.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const totalTransactions = transactionList.length;
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;

    // Get today's date in local timezone
    const today = new Date();
    const todayDateString = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    const todaySales = transactionList
      .filter(t => {
        const transactionDate = parseLocalTimestamp(t.timestamp);
        const transactionDateString = transactionDate.getFullYear() + '-' +
          String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(transactionDate.getDate()).padStart(2, '0');
        return transactionDateString === todayDateString;
      })
      .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

    console.log('Today sales calculation:', {
      todayDateString,
      totalTransactions: transactionList.length,
      todaysTransactions: transactionList.filter(t => {
        const transactionDate = parseLocalTimestamp(t.timestamp);
        const transactionDateString = transactionDate.getFullYear() + '-' +
          String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(transactionDate.getDate()).padStart(2, '0');
        return transactionDateString === todayDateString;
      }).length,
      todaySales
    });

    setSummary({
      totalSales,
      totalTransactions,
      averageTransaction,
      todaySales
    });
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(transaction =>
        transaction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.items?.some(item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Date filter
    if (dateFilter.startDate || dateFilter.endDate) {
      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.timestamp);

        if (dateFilter.startDate) {
          const startDate = new Date(dateFilter.startDate);
          startDate.setHours(0, 0, 0, 0);
          if (transactionDate < startDate) return false;
        }

        if (dateFilter.endDate) {
          const endDate = new Date(dateFilter.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (transactionDate > endDate) return false;
        }

        return true;
      });
    }

    // Cashier filter
    if (cashierFilter) {
      filtered = filtered.filter(transaction => {
        const cashierName = transaction.user_name || transaction.userName || 'System';
        return cashierName.toLowerCase() === cashierFilter.toLowerCase();
      });
    }

    // Payment method filter
    if (paymentMethodFilter) {
      filtered = filtered.filter(transaction => {
        const paymentMethod = (transaction.payment_method || transaction.paymentMethod || 'cash').toLowerCase();
        return paymentMethod === paymentMethodFilter.toLowerCase();
      });
    }

    setFilteredTransactions(filtered);
    // Don't recalculate summary when filtering - it should always show totals from all transactions
    // calculateSummary(filtered);
  };

  // Get unique cashiers from transactions
  const getUniqueCashiers = () => {
    const cashiers = new Set();
    transactions.forEach(transaction => {
      const cashierName = transaction.user_name || transaction.userName || 'System';
      if (cashierName) {
        cashiers.add(cashierName);
      }
    });
    return Array.from(cashiers).sort();
  };

  // Get unique payment methods from transactions
  const getUniquePaymentMethods = () => {
    const methods = new Set();
    transactions.forEach(transaction => {
      const method = transaction.payment_method || transaction.paymentMethod || 'cash';
      if (method) {
        methods.add(method.toLowerCase());
      }
    });
    return Array.from(methods).sort();
  };

  const viewReceipt = (transaction) => {
    setSelectedTransaction(transaction);
    setShowReceiptModal(true);
  };

  const printReceipt = async (transaction) => {
    if (!transaction) return;
    setSelectedTransaction(transaction);
    try {
      // Print using beautiful layout
      await printerService.printReceipt(transaction);

      // Log print activity
      try {
        await fetch('/api/activity-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user?.id,
            userName: user?.name,
            userEmail: user?.email,
            action: 'PRINT_RECEIPT',
            entityType: 'transaction',
            entityId: transaction.id,
            details: {
              transactionId: transaction.id,
              total: transaction.total,
              paymentMethod: transaction.payment_method || transaction.paymentMethod
            }
          })
        });
      } catch (logError) {
        console.error('Failed to log print activity:', logError);
      }

      toast.success('Receipt printed successfully!');
    } catch (error) {
      console.error('Print failed:', error);
      toast.error('Failed to print receipt: ' + (error.message || 'Please check the printer connection.'));
    }
  };

  const initiateDeleteTransaction = (transaction) => {
    setTransactionToDelete(transaction);
    if (!hasPermission('void_transaction')) {
      setShowOverrideModal(true);
      return;
    }
    setShowDeleteModal(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    try {
      const roleToUse = isAdminOverride ? 'admin' : user.role;
      await transactionService.delete(transactionToDelete.id, roleToUse);

      // Update the transactions list
      const updatedTransactions = transactions.filter(t => t.id !== transactionToDelete.id);
      setTransactions(updatedTransactions);


      toast.success('Transaction archived successfully. It will be permanently deleted after 60 days.');
      setShowDeleteModal(false);
      setTransactionToDelete(null);
      setIsAdminOverride(false);
    } catch (error) {
      console.error('Error archiving transaction:', error);
      toast.error(error.message || 'Failed to archive transaction');
    }
  };

  const cancelDeleteTransaction = () => {
    setShowDeleteModal(false);
    setTransactionToDelete(null);
    setIsAdminOverride(false);
  };

  const handleOverrideSuccess = () => {
    setIsAdminOverride(true);
    setShowDeleteModal(true);
  };

  // formatDate is now imported from utils/formatters.js

  const handleExport = async (exportSettings) => {
    try {
      const dataToExport = exportSettings.dataSource === 'all' ? transactions : filteredTransactions;
      const filename = exportSalesToExcel(dataToExport, exportSettings);
      toast.success(`Sales data exported successfully: ${filename}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export sales data: ' + (error.message || 'Unknown error'));
    }
  };


  // Pagination calculations
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className={`${colors.text.secondary}`}>Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Sales Management</h1>
        <div className="flex items-center gap-3">
          <span className={`text-sm ${colors.text.secondary}`}>
            {filteredTransactions.length} records
          </span>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Total Sales</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(summary.totalSales)}</p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <ShoppingBagIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Transactions</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{summary.totalTransactions}</p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CalendarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Today's Sales</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(summary.todaySales)}</p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Average Sale</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(summary.averageTransaction)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Button */}
      <div className={`${colors.card.primary} p-4 rounded-lg shadow border ${colors.border.primary}`}>
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className={`h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 ${colors.text.tertiary}`} />
            <input
              type="text"
              placeholder="Search by transaction ID or product..."
              className={`w-full pl-10 pr-4 py-2.5 border rounded-lg ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Button */}
          <button
            onClick={() => setShowFiltersModal(true)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg ${colors.border.primary} ${colors.bg.secondary} ${colors.text.primary} hover:${colors.bg.tertiary} transition-colors relative`}
          >
            <FunnelIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Filters</span>
            {(dateFilter.startDate || dateFilter.endDate || cashierFilter || paymentMethodFilter) && (
              <span className="absolute -top-1 -right-1 h-4 w-4 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-bold">!</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filters Modal */}
      {showFiltersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowFiltersModal(false)}>
          <div
            className={`${colors.card.primary} rounded-lg shadow-xl max-w-2xl w-full mx-4 border ${colors.border.primary}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex justify-between items-center p-6 border-b ${colors.border.primary}`}>
              <div className="flex items-center gap-2">
                <FunnelIcon className={`h-6 w-6 ${colors.text.primary}`} />
                <h2 className={`text-xl font-bold ${colors.text.primary}`}>Filters</h2>
              </div>
              <button
                onClick={() => setShowFiltersModal(false)}
                className={`${colors.text.tertiary} hover:${colors.text.secondary} transition-colors`}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Filter Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date Range - Start */}
                <div>
                  <label className={`block text-sm font-medium ${colors.text.secondary} mb-2`}>
                    <CalendarIcon className="h-4 w-4 inline mr-1" />
                    Start Date
                  </label>
                  <input
                    type="date"
                    className={`w-full border rounded-lg px-3 py-2.5 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    value={dateFilter.startDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>

                {/* Date Range - End */}
                <div>
                  <label className={`block text-sm font-medium ${colors.text.secondary} mb-2`}>
                    <CalendarIcon className="h-4 w-4 inline mr-1" />
                    End Date
                  </label>
                  <input
                    type="date"
                    className={`w-full border rounded-lg px-3 py-2.5 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    value={dateFilter.endDate}
                    onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>

                {/* Cashier Filter */}
                <div>
                  <label className={`block text-sm font-medium ${colors.text.secondary} mb-2`}>
                    <UserIcon className="h-4 w-4 inline mr-1" />
                    Cashier
                  </label>
                  <select
                    className={`w-full border rounded-lg px-3 py-2.5 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    value={cashierFilter}
                    onChange={(e) => setCashierFilter(e.target.value)}
                  >
                    <option value="">All Cashiers</option>
                    {getUniqueCashiers().map(cashier => (
                      <option key={cashier} value={cashier}>{cashier}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label className={`block text-sm font-medium ${colors.text.secondary} mb-2`}>
                    <CreditCardIcon className="h-4 w-4 inline mr-1" />
                    Payment Method
                  </label>
                  <select
                    className={`w-full border rounded-lg px-3 py-2.5 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  >
                    <option value="">All Payment Methods</option>
                    {getUniquePaymentMethods().map(method => (
                      <option key={method} value={method}>
                        {method.charAt(0).toUpperCase() + method.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`flex justify-between items-center p-6 border-t ${colors.border.primary}`}>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setDateFilter({ startDate: '', endDate: '' });
                  setCashierFilter('');
                  setPaymentMethodFilter('');
                }}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
                Clear All Filters
              </button>
              <button
                onClick={() => setShowFiltersModal(false)}
                className="px-6 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Transaction ID
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Date & Time
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider w-64`}>
                  Items
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Payment
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Cashier
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Total
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider whitespace-nowrap`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className={`px-6 py-8 text-center ${colors.text.secondary}`}>
                    No transactions found
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className={`${colors.bg.hover} cursor-pointer`}
                    onClick={() => viewReceipt(transaction)}
                    title="Click to view receipt"
                  >
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                      {transaction.id}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      {formatDate(transaction.timestamp)}
                    </td>
                    <td className={`px-6 py-4 text-sm ${colors.text.secondary} w-64`}>
                      <div className="max-w-full break-words">
                        {transaction.items?.slice(0, 2).map((item, index) => (
                          <div key={index} className="break-words word-wrap break-all mb-1">
                            <span className="font-medium">{item.quantity}x</span> {item.name}
                          </div>
                        ))}
                        {transaction.items?.length > 2 && (
                          <div className={`text-xs ${colors.text.tertiary} mt-1`}>
                            +{transaction.items.length - 2} more items
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${(transaction.payment_method || transaction.paymentMethod) === 'cash'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                        }`}>
                        {(transaction.payment_method || transaction.paymentMethod || 'cash').toUpperCase()}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded-full ${colors.bg.tertiary}`}>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="font-medium">
                          {transaction.user_name || transaction.userName || 'System'}
                        </span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                      {formatCurrency(transaction.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2 items-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); printReceipt(transaction); }}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 flex-shrink-0"
                          title="Print Receipt"
                        >
                          <PrinterIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); initiateDeleteTransaction(transaction); }}
                          className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 flex-shrink-0"
                          title="Archive Transaction"
                        >
                          <ArchiveBoxIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={`${colors.card.primary} p-4 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${colors.text.secondary}`}>
              Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} transactions
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-lg transition-all duration-200 ${currentPage === 1
                  ? `${colors.text.tertiary} cursor-not-allowed opacity-50`
                  : `${colors.text.secondary} hover:${colors.bg.secondary}`
                  }`}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>

              {/* Page numbers */}
              {(() => {
                const pageNumbers = [];
                const maxVisiblePages = 5;

                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                if (endPage - startPage < maxVisiblePages - 1) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }

                if (startPage > 1) {
                  pageNumbers.push(
                    <button
                      key={1}
                      onClick={() => goToPage(1)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${colors.text.secondary} hover:${colors.bg.secondary}`}
                    >
                      1
                    </button>
                  );
                  if (startPage > 2) {
                    pageNumbers.push(
                      <span key="ellipsis1" className={`px-2 ${colors.text.tertiary}`}>...</span>
                    );
                  }
                }

                for (let i = startPage; i <= endPage; i++) {
                  pageNumbers.push(
                    <button
                      key={i}
                      onClick={() => goToPage(i)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${currentPage === i
                        ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md'
                        : `${colors.text.secondary} hover:${colors.bg.secondary}`
                        }`}
                    >
                      {i}
                    </button>
                  );
                }

                if (endPage < totalPages) {
                  if (endPage < totalPages - 1) {
                    pageNumbers.push(
                      <span key="ellipsis2" className={`px-2 ${colors.text.tertiary}`}>...</span>
                    );
                  }
                  pageNumbers.push(
                    <button
                      key={totalPages}
                      onClick={() => goToPage(totalPages)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${colors.text.secondary} hover:${colors.bg.secondary}`}
                    >
                      {totalPages}
                    </button>
                  );
                }

                return pageNumbers;
              })()}

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 rounded-lg transition-all duration-200 ${currentPage === totalPages
                  ? `${colors.text.tertiary} cursor-not-allowed opacity-50`
                  : `${colors.text.secondary} hover:${colors.bg.secondary}`
                  }`}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Settings Modal */}
      <ExportSettingsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExport}
        totalRecords={transactions.length}
        filteredRecords={filteredTransactions.length}
      />

      {/* Receipt Modal */}
      {showReceiptModal && selectedTransaction && (
        <ReceiptModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedTransaction(null);
          }}
          onPrint={() => {
            setShowReceiptModal(false);
            setSelectedTransaction(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && transactionToDelete && (
        <DeleteConfirmationModal
          transaction={transactionToDelete}
          onConfirm={confirmDeleteTransaction}
          onCancel={cancelDeleteTransaction}
        />
      )}

      {/* Admin Override Modal */}
      <AdminOverrideModal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        onSuccess={handleOverrideSuccess}
        actionDescription="archive this transaction"
      />
    </div>
  );
};

export default SalesScreen; 