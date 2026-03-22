import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { formatDate } from '../../utils/formatters';
import { formatDetailsForTable, formatDetailsForModal } from '../../utils/logFormatters';
import { activityLogService } from '../../services/api';
import {
  ClipboardDocumentListIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  UserIcon,
  ShoppingCartIcon,
  CubeIcon,
  ArrowRightOnRectangleIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  TrashIcon,
  PlusIcon,
  PencilIcon,
  ArchiveBoxIcon,
  PrinterIcon,
  TruckIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';

// Action icon mapping
const ACTION_ICONS = {
  LOGIN: ArrowRightOnRectangleIcon,
  LOGOUT: ArrowRightOnRectangleIcon,
  LOGIN_FAILED: ArrowRightOnRectangleIcon,
  CREATE_PRODUCT: PlusIcon,
  UPDATE_PRODUCT: PencilIcon,
  DELETE_PRODUCT: TrashIcon,
  STOCK_IN: PlusIcon,
  STOCK_OUT: TrashIcon,
  STOCK_ADJUSTMENT: CubeIcon,
  CREATE_SALE: ShoppingCartIcon,
  VOID_SALE: TrashIcon,
  ARCHIVE_TRANSACTION: ArchiveBoxIcon,
  RESTORE_TRANSACTION: ArchiveBoxIcon,
  DELETE_TRANSACTION: TrashIcon,
  CREATE_CATEGORY: PlusIcon,
  DELETE_CATEGORY: TrashIcon,
  CREATE_SUPPLIER: TruckIcon,
  UPDATE_SUPPLIER: PencilIcon,
  DELETE_SUPPLIER: TrashIcon,
  CREATE_PURCHASE_ORDER: DocumentTextIcon,
  RECEIVE_PURCHASE_ORDER: ClipboardDocumentCheckIcon,
  CANCEL_PURCHASE_ORDER: TrashIcon,
  CREATE_USER: UserIcon,
  UPDATE_USER: PencilIcon,
  DELETE_USER: TrashIcon,
  CREATE_AUDIT: ClipboardDocumentListIcon,
  UPDATE_SETTINGS: Cog6ToothIcon,
  PRINT_RECEIPT: PrinterIcon,
};

// Action color mapping
const ACTION_COLORS = {
  LOGIN: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  LOGOUT: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30',
  LOGIN_FAILED: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  CREATE_PRODUCT: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  UPDATE_PRODUCT: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
  DELETE_PRODUCT: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  STOCK_IN: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30',
  STOCK_OUT: 'text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/30',
  STOCK_ADJUSTMENT: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30',
  CREATE_SALE: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  VOID_SALE: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  ARCHIVE_TRANSACTION: 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30',
  RESTORE_TRANSACTION: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  DELETE_TRANSACTION: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  CREATE_CATEGORY: 'text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/30',
  DELETE_CATEGORY: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  CREATE_SUPPLIER: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/30',
  UPDATE_SUPPLIER: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
  DELETE_SUPPLIER: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  CREATE_PURCHASE_ORDER: 'text-violet-600 bg-violet-100 dark:text-violet-400 dark:bg-violet-900/30',
  RECEIVE_PURCHASE_ORDER: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30',
  CANCEL_PURCHASE_ORDER: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  CREATE_USER: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30',
  UPDATE_USER: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30',
  DELETE_USER: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30',
  CREATE_AUDIT: 'text-sky-600 bg-sky-100 dark:text-sky-400 dark:bg-sky-900/30',
  UPDATE_SETTINGS: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30',
  PRINT_RECEIPT: 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30',
};

const formatActionName = (action) => {
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

// formatDate is now imported from utils/formatters.js

const LogsScreen = () => {
  const { colors } = useTheme();
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [actionTypes, setActionTypes] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const logsPerPage = 20;

  // Filters
  const [filters, setFilters] = useState({
    action: '',
    startDate: '',
    endDate: '',
  });

  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const offset = (currentPage - 1) * logsPerPage;

      const params = {
        limit: logsPerPage,
        offset,
        ...(filters.action && { action: filters.action }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      };

      const response = await activityLogService.list(params);
      setLogs(response.logs || []);
      setTotalLogs(response.total || 0);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, filters]);

  const loadActionTypes = useCallback(async () => {
    try {
      const types = await activityLogService.getActionTypes();
      setActionTypes(types || []);
    } catch (error) {
      console.error('Error loading action types:', error);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    loadActionTypes();
  }, [loadActionTypes]);

  const totalPages = Math.ceil(totalLogs / logsPerPage);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ action: '', startDate: '', endDate: '' });
    setCurrentPage(1);
  };

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-6"></div>
          <p className={`text-lg font-medium ${colors.text.primary}`}>Loading activity logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white">
              <ClipboardDocumentListIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Activity Logs</h1>
              <p className={`text-sm ${colors.text.secondary}`}>
                {totalLogs} total activities recorded
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${showFilters
                  ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                  : `${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`
                }`}
            >
              <FunnelIcon className="h-5 w-5" />
              <span>Filters</span>
            </button>

            <button
              onClick={loadLogs}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
            >
              <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className={`mt-6 pt-6 border-t ${colors.border.primary}`}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                  Action Type
                </label>
                <select
                  name="action"
                  value={filters.action}
                  onChange={handleFilterChange}
                  className={`w-full p-3 rounded-xl border ${colors.input.primary}`}
                >
                  <option value="">All Actions</option>
                  {actionTypes.map((action) => (
                    <option key={action} value={action}>
                      {formatActionName(action)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                  Start Date
                </label>
                <input
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                  className={`w-full p-3 rounded-xl border ${colors.input.primary}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                  End Date
                </label>
                <input
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                  className={`w-full p-3 rounded-xl border ${colors.input.primary}`}
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className={`w-full px-4 py-3 rounded-xl font-medium ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className={colors.bg.secondary}>
              <tr>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Time
                </th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  User
                </th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Action
                </th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Details
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${colors.border.primary}`}>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <ClipboardDocumentListIcon className={`h-12 w-12 mx-auto mb-4 ${colors.text.tertiary}`} />
                    <p className={colors.text.secondary}>No activity logs found</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const IconComponent = ACTION_ICONS[log.action] || DocumentTextIcon;
                  const colorClass = ACTION_COLORS[log.action] || 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-900/30';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => {
                        setSelectedLog(log);
                        setShowDetailsModal(true);
                      }}
                      className={`hover:${colors.bg.secondary} transition-colors cursor-pointer`}
                    >
                      <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-full ${colors.bg.tertiary}`}>
                            <UserIcon className={`h-4 w-4 ${colors.text.secondary}`} />
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${colors.text.primary}`}>
                              {log.user_name || 'System'}
                            </p>
                            <p className={`text-xs ${colors.text.tertiary}`}>
                              {log.user_email || '-'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`p-2 rounded-lg ${colorClass}`}>
                            <IconComponent className="h-4 w-4" />
                          </span>
                          <span className={`text-sm font-medium ${colors.text.primary}`}>
                            {formatActionName(log.action)}
                          </span>
                        </div>
                      </td>
                      <td className={`px-6 py-4 text-sm ${colors.text.secondary}`}>
                        <div className="max-w-md truncate">
                          {log.entity_type && (
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${colors.bg.tertiary} ${colors.text.secondary} mr-2`}>
                              {log.entity_type}
                            </span>
                          )}
                          <span className="truncate font-medium block">
                            {formatDetailsForTable(log)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`px-6 py-4 border-t ${colors.border.primary} flex items-center justify-between`}>
            <p className={`text-sm ${colors.text.secondary}`}>
              Showing {(currentPage - 1) * logsPerPage + 1} to{' '}
              {Math.min(currentPage * logsPerPage, totalLogs)} of {totalLogs} logs
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg ${currentPage === 1
                    ? `${colors.text.tertiary} cursor-not-allowed`
                    : `${colors.text.secondary} hover:${colors.bg.secondary}`
                  }`}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>

              <span className={`px-4 py-2 text-sm font-medium ${colors.text.primary}`}>
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg ${currentPage === totalPages
                    ? `${colors.text.tertiary} cursor-not-allowed`
                    : `${colors.text.secondary} hover:${colors.bg.secondary}`
                  }`}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${colors.card.primary} rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden`}>
            <div className={`${colors.bg.secondary} px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-xl font-bold ${colors.text.primary}`}>Activity Log Details</h3>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              {/* Action */}
              <div>
                <label className={`block text-sm font-medium ${colors.text.secondary} mb-1`}>Action</label>
                <div className="flex items-center gap-2">
                  {(() => {
                    const IconComponent = ACTION_ICONS[selectedLog.action] || DocumentTextIcon;
                    const colorClass = ACTION_COLORS[selectedLog.action] || 'text-gray-600 bg-gray-100';
                    return (
                      <>
                        <span className={`p-2 rounded-lg ${colorClass}`}>
                          <IconComponent className="h-5 w-5" />
                        </span>
                        <span className={`text-lg font-medium ${colors.text.primary}`}>
                          {formatActionName(selectedLog.action)}
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* User Info */}
              <div>
                <label className={`block text-sm font-medium ${colors.text.secondary} mb-1`}>Performed By</label>
                <div className={`p-3 ${colors.bg.secondary} rounded-lg`}>
                  <p className={`font-medium ${colors.text.primary}`}>{selectedLog.user_name || 'System'}</p>
                  <p className={`text-sm ${colors.text.secondary}`}>{selectedLog.user_email || '-'}</p>
                </div>
              </div>

              {/* Timestamp */}
              <div>
                <label className={`block text-sm font-medium ${colors.text.secondary} mb-1`}>Timestamp</label>
                <p className={`${colors.text.primary}`}>{formatDate(selectedLog.created_at)}</p>
              </div>

              {/* Details (Prioritized) */}
              <div>
                <label className={`block text-sm font-medium ${colors.text.secondary} mb-2`}>Details</label>
                <div className={`p-4 ${colors.bg.secondary} rounded-lg overflow-x-auto`}>
                  <div className={`text-sm ${colors.text.primary} whitespace-pre-wrap break-words`}>
                    {formatDetailsForModal(selectedLog)}
                  </div>
                </div>
              </div>

              {/* Technical Details */}
              {(selectedLog.entity_type || selectedLog.ip_address) && (
                <div className={`mt-6 pt-4 border-t ${colors.border.primary}`}>
                  <h4 className={`text-sm font-medium ${colors.text.secondary} mb-3`}>Technical Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedLog.entity_type && (
                      <div>
                        <label className={`block text-xs font-medium ${colors.text.tertiary} mb-1`}>Entity Type</label>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${colors.bg.tertiary} ${colors.text.secondary}`}>
                          {selectedLog.entity_type}
                        </span>
                      </div>
                    )}
                    {selectedLog.entity_id && (
                      <div>
                        <label className={`block text-xs font-medium ${colors.text.tertiary} mb-1`}>Entity ID</label>
                        <p className={`${colors.text.secondary} font-mono text-xs truncate`} title={selectedLog.entity_id}>{selectedLog.entity_id}</p>
                      </div>
                    )}
                    {selectedLog.ip_address && (
                      <div>
                        <label className={`block text-xs font-medium ${colors.text.tertiary} mb-1`}>IP Address</label>
                        <p className={`${colors.text.secondary} font-mono text-xs`}>{selectedLog.ip_address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={`${colors.bg.secondary} px-6 py-4 border-t ${colors.border.primary} flex justify-end`}>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedLog(null);
                }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogsScreen;






