import { useState, useEffect } from 'react';
import {
  MagnifyingGlassIcon,
  ArrowPathIcon,
  TrashIcon,
  CalendarIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArchiveBoxIcon,
  EyeIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';
import { transactionService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'react-hot-toast';
import { formatCurrency, formatDate, parseLocalTimestamp } from '../../utils/formatters';
import ReceiptModal from './ReceiptModal';

const ArchivesScreen = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [archivedTransactions, setArchivedTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToProcess, setTransactionToProcess] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadArchivedTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [archivedTransactions, searchTerm]);

  const loadArchivedTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await transactionService.getArchived();
      console.log('Loaded archived transactions:', data);
      setArchivedTransactions(data || []);
    } catch (error) {
      console.error('Error loading archived transactions:', error);
      toast.error('Failed to load archived transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...archivedTransactions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(transaction =>
        transaction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.items?.some(item =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    setFilteredTransactions(filtered);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const viewReceipt = (transaction) => {
    setSelectedTransaction(transaction);
    setShowReceiptModal(true);
  };

  const initiateRestore = (transaction) => {
    setTransactionToProcess(transaction);
    setShowRestoreModal(true);
  };

  const confirmRestore = async () => {
    if (!transactionToProcess) return;

    try {
      await transactionService.restore(transactionToProcess.id, user.role);

      // Update the archived transactions list
      const updatedTransactions = archivedTransactions.filter(t => t.id !== transactionToProcess.id);
      setArchivedTransactions(updatedTransactions);

      toast.success('Transaction restored successfully');
      setShowRestoreModal(false);
      setTransactionToProcess(null);
    } catch (error) {
      console.error('Error restoring transaction:', error);
      toast.error(error.message || 'Failed to restore transaction');
    }
  };

  const initiateDelete = (transaction) => {
    setTransactionToProcess(transaction);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!transactionToProcess) return;

    try {
      await transactionService.permanentDelete(transactionToProcess.id, user.role);

      // Update the archived transactions list
      const updatedTransactions = archivedTransactions.filter(t => t.id !== transactionToProcess.id);
      setArchivedTransactions(updatedTransactions);

      toast.success('Transaction permanently deleted');
      setShowDeleteModal(false);
      setTransactionToProcess(null);
    } catch (error) {
      console.error('Error permanently deleting transaction:', error);
      toast.error(error.message || 'Failed to permanently delete transaction');
    }
  };

  // formatDate is now imported from utils/formatters.js


  const getDaysUntilDeletion = (archivedDate) => {
    const archived = parseLocalTimestamp(archivedDate);
    const deletionDate = new Date(archived);
    deletionDate.setDate(deletionDate.getDate() + 60);

    const now = new Date();
    const daysRemaining = Math.ceil((deletionDate - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
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
          <p className={`${colors.text.secondary}`}>Loading archived transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Archived Sales</h1>
          <p className={`text-sm ${colors.text.secondary} mt-1`}>
            Archived transactions are automatically deleted after 60 days
          </p>
        </div>
        <div className={`text-sm ${colors.text.secondary}`}>
          Total Archives: {filteredTransactions.length}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <ArchiveBoxIcon className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Total Archived</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{archivedTransactions.length}</p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Archived Value</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>
                {formatCurrency(archivedTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0))}
              </p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CalendarIcon className="h-8 w-8 text-red-600 dark:text-red-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Expiring Soon</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>
                {archivedTransactions.filter(t => getDaysUntilDeletion(t.archived_at) < 7).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className={`h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 ${colors.text.tertiary}`} />
            <input
              type="text"
              placeholder="Search by transaction ID or product..."
              className={`w-full pl-10 pr-4 py-2 border rounded-lg ${colors.input.primary}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <button
            onClick={loadArchivedTransactions}
            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 inline-flex items-center gap-2"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Archived Transactions Table */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Transaction ID
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Original Date
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Archived Date
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Days Until Deletion
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Payment
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Total
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className={`px-6 py-8 text-center ${colors.text.secondary}`}>
                    No archived transactions found
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((transaction) => {
                  const daysLeft = getDaysUntilDeletion(transaction.archived_at);
                  return (
                    <tr
                      key={transaction.id}
                      className={`${colors.bg.hover}`}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                        {transaction.id}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                        {formatDate(transaction.timestamp)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                        {formatDate(transaction.archived_at)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm`}>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${daysLeft < 7
                            ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                            : daysLeft < 30
                              ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
                              : 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                          }`}>
                          {daysLeft} days
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${(transaction.payment_method || transaction.paymentMethod) === 'cash'
                            ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                            : 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                          }`}>
                          {(transaction.payment_method || transaction.paymentMethod || 'cash').toUpperCase()}
                        </span>
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                        {formatCurrency(transaction.total)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => viewReceipt(transaction)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title="View Receipt"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => initiateRestore(transaction)}
                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300 p-1 rounded hover:bg-green-50 dark:hover:bg-green-900/20"
                            title="Restore Transaction"
                          >
                            <ArrowUturnLeftIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => initiateDelete(transaction)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Permanently Delete"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
              Showing {startIndex + 1} to {Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} archived transactions
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

      {/* Restore Confirmation Modal */}
      {showRestoreModal && transactionToProcess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowRestoreModal(false)}>
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Restore Transaction</h3>
            </div>

            <div className="px-6 py-4">
              <p className={`${colors.text.secondary} mb-4`}>
                Are you sure you want to restore this archived transaction? It will be moved back to the active sales list.
              </p>
              <div className={`p-4 rounded-lg ${colors.bg.secondary}`}>
                <p className={`text-sm ${colors.text.secondary}`}>Transaction ID</p>
                <p className={`text-sm font-medium ${colors.text.primary}`}>{transactionToProcess.id}</p>
                <p className={`text-sm ${colors.text.secondary} mt-2`}>Total</p>
                <p className={`text-sm font-medium ${colors.text.primary}`}>{formatCurrency(transactionToProcess.total)}</p>
              </div>
            </div>

            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmRestore}
                className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && transactionToProcess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowDeleteModal(false)}>
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Permanently Delete Transaction</h3>
            </div>

            <div className="px-6 py-4">
              <div className={`p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 mb-4`}>
                <p className={`text-sm text-red-800 dark:text-red-300`}>
                  <strong>Warning:</strong> This action cannot be undone. The transaction will be permanently deleted from the system.
                </p>
              </div>
              <div className={`p-4 rounded-lg ${colors.bg.secondary}`}>
                <p className={`text-sm ${colors.text.secondary}`}>Transaction ID</p>
                <p className={`text-sm font-medium ${colors.text.primary}`}>{transactionToProcess.id}</p>
                <p className={`text-sm ${colors.text.secondary} mt-2`}>Total</p>
                <p className={`text-sm font-medium ${colors.text.primary}`}>{formatCurrency(transactionToProcess.total)}</p>
              </div>
            </div>

            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArchivesScreen;

