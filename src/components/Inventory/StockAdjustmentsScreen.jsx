import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { stockAdjustmentService } from '../../services/api';
import { formatCurrency, formatDate, parseLocalTimestamp } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  ScaleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FunnelIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  InformationCircleIcon,
  CalendarIcon,
  UserIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import ModalPortal from '../common/ModalPortal';
import LazyPageLoader from '../common/LazyPageLoader';
import {
  ScaleIcon as ScaleIconSolid,
} from '@heroicons/react/24/solid';

const StockAdjustmentsScreen = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [adjustments, setAdjustments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const adjustmentsPerPage = 10;

  // Selected adjustment for details modal
  const [selectedAdjustment, setSelectedAdjustment] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  // Reports panel toggle
  const [showReports, setShowReports] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    adjustmentType: '',
    startDate: '',
    endDate: '',
    searchTerm: '',
  });

  const loadAdjustments = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = {};

      if (filters.adjustmentType) {
        queryParams.adjustmentType = filters.adjustmentType;
      }
      if (filters.startDate) {
        queryParams.startDate = filters.startDate;
      }
      if (filters.endDate) {
        queryParams.endDate = filters.endDate;
      }

      const data = await stockAdjustmentService.list(queryParams);

      // Filter by search term if provided
      let filtered = data || [];
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        filtered = filtered.filter(adj =>
          adj.product_name?.toLowerCase().includes(searchLower) ||
          adj.reason?.toLowerCase().includes(searchLower) ||
          adj.adjusted_by?.toLowerCase().includes(searchLower)
        );
      }

      setAdjustments(filtered);
    } catch (error) {
      console.error('Failed to load adjustments:', error);
      toast.error('Failed to load stock adjustments');
      setAdjustments([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadAdjustments();
    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [loadAdjustments]);

  // ─── Report Computations ──────────────────────────────────────────
  const reportData = useMemo(() => {
    if (!adjustments || adjustments.length === 0) {
      return null;
    }

    // --- Adjustments per day (last 7 days) ---
    const now = new Date();
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      last7Days.push(d.toISOString().split('T')[0]);
    }
    const adjustmentsPerDay = last7Days.map(day => {
      const count = adjustments.filter(adj => {
        const adjDate = new Date(adj.created_at).toISOString().split('T')[0];
        return adjDate === day;
      }).length;
      return { date: day, count };
    });

    // --- Breakdown by type ---
    const byType = {};
    adjustments.forEach(adj => {
      const type = adj.adjustment_type || 'other';
      byType[type] = (byType[type] || 0) + 1;
    });

    // --- Top 5 adjusted products ---
    const productCounts = {};
    adjustments.forEach(adj => {
      const name = adj.product_name || 'Unknown';
      productCounts[name] = (productCounts[name] || 0) + 1;
    });
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // --- Net quantity change ---
    let totalPositive = 0;
    let totalNegative = 0;
    adjustments.forEach(adj => {
      const change = Number(adj.quantity_change) || 0;
      if (change > 0) totalPositive += change;
      else totalNegative += change;
    });

    return {
      adjustmentsPerDay,
      byType,
      topProducts,
      totalPositive,
      totalNegative,
      netChange: totalPositive + totalNegative,
      totalAdjustments: adjustments.length,
    };
  }, [adjustments]);

  // ─── Helpers ──────────────────────────────────────────────────────

  const getAdjustmentTypeLabel = (type) => {
    const labels = {
      physical_count: 'Physical Count',
      damage: 'Damage/Defective',
      loss: 'Loss/Theft',
      found: 'Found/Recovered',
      correction: 'Manual Correction',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getAdjustmentTypeColor = (type) => {
    const typeColors = {
      physical_count: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
      damage: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
      loss: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
      found: 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400',
      correction: 'bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400',
      other: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400',
    };
    return typeColors[type] || typeColors.other;
  };

  // Pagination
  const totalPages = Math.ceil(adjustments.length / adjustmentsPerPage);

  // Reset to page 1 if current page is invalid after filtering
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * adjustmentsPerPage;
  const endIndex = startIndex + adjustmentsPerPage;
  const paginatedAdjustments = adjustments.slice(startIndex, endIndex);

  const clearFilters = () => {
    setFilters({
      adjustmentType: '',
      startDate: '',
      endDate: '',
      searchTerm: '',
    });
  };

  const hasActiveFilters = filters.adjustmentType || filters.startDate || filters.endDate || filters.searchTerm;

  const handleRowClick = (adjustment) => {
    setSelectedAdjustment(adjustment);
    setIsDetailsModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedAdjustment(null);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header */}
      <div className={`${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <ScaleIconSolid className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Stock Adjustments</h1>
              <p className={`text-sm ${colors.text.secondary}`}>
                View all inventory adjustments and their reasons
              </p>
            </div>
          </div>
          <div>
            <button
               className={`px-4 py-2 ${showReports ? 'bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-600' : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'} text-white rounded-lg transition-colors flex items-center gap-2`}
               onClick={() => setShowReports(!showReports)}
            >
              <ChartBarIcon className="h-4 w-4" />
              Reports
              {showReports && <XMarkIcon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Reports Panel */}
      {showReports && (
        <div className={`${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} p-6`}>
          <div className="flex items-center gap-2 mb-4">
            <ChartBarIcon className={`h-5 w-5 text-purple-500`} />
            <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Adjustment Reports</h2>
          </div>

          {!reportData ? (
            <p className={`text-sm ${colors.text.secondary}`}>No adjustment data available for reports.</p>
          ) : (
            <div className="space-y-6">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Adjustments */}
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <p className={`text-xs font-medium ${colors.text.secondary} uppercase tracking-wider mb-1`}>Total Adjustments</p>
                  <p className={`text-2xl font-bold ${colors.text.primary}`}>{reportData.totalAdjustments}</p>
                </div>
                {/* Stock Added */}
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <p className={`text-xs font-medium ${colors.text.secondary} uppercase tracking-wider mb-1`}>Stock Added</p>
                  <div className="flex items-center gap-2">
                    <ArrowTrendingUpIcon className="h-5 w-5 text-green-500" />
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">+{reportData.totalPositive}</p>
                  </div>
                </div>
                {/* Stock Removed */}
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <p className={`text-xs font-medium ${colors.text.secondary} uppercase tracking-wider mb-1`}>Stock Removed</p>
                  <div className="flex items-center gap-2">
                    <ArrowTrendingDownIcon className="h-5 w-5 text-red-500" />
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">{reportData.totalNegative}</p>
                  </div>
                </div>
                {/* Net Change */}
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <p className={`text-xs font-medium ${colors.text.secondary} uppercase tracking-wider mb-1`}>Net Change</p>
                  <p className={`text-2xl font-bold ${reportData.netChange >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {reportData.netChange >= 0 ? '+' : ''}{reportData.netChange}
                  </p>
                </div>
              </div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Adjustments per Day (last 7 days) */}
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <h3 className={`text-sm font-semibold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                    <CalendarIcon className="h-4 w-4" />
                    Adjustments per Day (Last 7 Days)
                  </h3>
                  <div className="space-y-2">
                    {reportData.adjustmentsPerDay.map(day => {
                      const maxCount = Math.max(...reportData.adjustmentsPerDay.map(d => d.count), 1);
                      const widthPct = (day.count / maxCount) * 100;
                      const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
                      return (
                        <div key={day.date} className="flex items-center gap-3">
                          <span className={`text-xs ${colors.text.secondary} w-24 text-right flex-shrink-0`}>{dateLabel}</span>
                          <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 dark:bg-purple-400 rounded-full transition-all duration-500"
                              style={{ width: `${day.count > 0 ? Math.max(widthPct, 8) : 0}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${colors.text.primary} w-6 text-right`}>{day.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* By Adjustment Type */}
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <h3 className={`text-sm font-semibold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                    <ScaleIcon className="h-4 w-4" />
                    By Adjustment Type
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(reportData.byType)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const maxCount = Math.max(...Object.values(reportData.byType), 1);
                        const widthPct = (count / maxCount) * 100;
                        return (
                          <div key={type} className="flex items-center gap-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium w-32 text-center flex-shrink-0 ${getAdjustmentTypeColor(type)}`}>
                              {getAdjustmentTypeLabel(type)}
                            </span>
                            <div className="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 dark:bg-blue-400 rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(widthPct, 8)}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold ${colors.text.primary} w-6 text-right`}>{count}</span>
                          </div>
                        );
                    })}
                  </div>
                </div>
              </div>

              {/* Top Adjusted Products */}
              <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                <h3 className={`text-sm font-semibold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                  <CubeIcon className="h-4 w-4" />
                  Top Adjusted Products
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${colors.border.primary}`}>
                        <th className={`text-left py-2 px-3 text-xs font-semibold ${colors.text.secondary} uppercase tracking-wider`}>#</th>
                        <th className={`text-left py-2 px-3 text-xs font-semibold ${colors.text.secondary} uppercase tracking-wider`}>Product</th>
                        <th className={`text-right py-2 px-3 text-xs font-semibold ${colors.text.secondary} uppercase tracking-wider`}>Adjustments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.topProducts.map((product, idx) => (
                        <tr key={product.name} className={`border-b ${colors.border.primary} last:border-b-0`}>
                          <td className={`py-2 px-3 ${colors.text.secondary}`}>{idx + 1}</td>
                          <td className={`py-2 px-3 font-medium ${colors.text.primary}`}>{product.name}</td>
                          <td className={`py-2 px-3 text-right font-semibold ${colors.text.primary}`}>{product.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters and Search */}
      <div className={`${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} p-4`}>
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name, reason, or adjusted by..."
              value={filters.searchTerm}
              onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
              className={`w-full pl-10 pr-4 py-2 rounded-lg border ${colors.input.primary}`}
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg border ${colors.border.primary} ${colors.bg.secondary} ${colors.text.primary} hover:${colors.bg.tertiary} flex items-center gap-2`}
          >
            <FunnelIcon className="h-5 w-5" />
            Filters
            {hasActiveFilters && (
              <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                Active
              </span>
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
            >
              <XMarkIcon className="h-5 w-5" />
              Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                Adjustment Type
              </label>
              <select
                value={filters.adjustmentType}
                onChange={(e) => setFilters({ ...filters, adjustmentType: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
              >
                <option value="">All Types</option>
                <option value="physical_count">Physical Count</option>
                <option value="damage">Damage/Defective</option>
                <option value="loss">Loss/Theft</option>
                <option value="found">Found/Recovered</option>
                <option value="correction">Manual Correction</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
              />
            </div>
          </div>
        )}
      </div>

      {/* Adjustments Table */}
      <div className={`${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} flex-1 overflow-hidden flex flex-col`}>
        {isLoading ? (
          <div className="p-4">
            <LazyPageLoader
              title="Loading adjustments"
              subtitle="Fetching stock adjustment history..."
              rows={4}
              centered={false}
            />
          </div>
        ) : paginatedAdjustments.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <ScaleIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <p className={`text-lg font-medium ${colors.text.primary} mb-2`}>No adjustments found</p>
              <p className={colors.text.secondary}>
                {hasActiveFilters ? 'Try adjusting your filters' : 'Stock adjustments will appear here'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto flex-1">
              <table className="w-full table-fixed">
                <thead className={`${colors.bg.secondary} border-b ${colors.border.primary} sticky top-0 z-10`}>
                  <tr>
                    <th style={{ width: '14%' }} className={`text-left px-4 py-3 text-sm font-semibold ${colors.text.primary}`}>Date & Time</th>
                    <th style={{ width: '18%' }} className={`text-left px-4 py-3 text-sm font-semibold ${colors.text.primary}`}>Product</th>
                    <th style={{ width: '13%' }} className={`text-left px-4 py-3 text-sm font-semibold ${colors.text.primary}`}>Type</th>
                    <th style={{ width: '13%' }} className={`text-center px-4 py-3 text-sm font-semibold ${colors.text.primary}`}>Quantity Change</th>
                    <th style={{ width: '18%' }} className={`text-left px-4 py-3 text-sm font-semibold ${colors.text.primary}`}>Reason</th>
                    <th style={{ width: '12%' }} className={`text-left px-4 py-3 text-sm font-semibold ${colors.text.primary}`}>Adjusted By</th>
                    <th style={{ width: '12%' }} className={`text-left px-4 py-3 text-sm font-semibold ${colors.text.primary}`}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAdjustments.map((adjustment) => (
                    <tr
                      key={adjustment.id}
                      onClick={() => handleRowClick(adjustment)}
                      className={`border-b ${colors.border.primary} hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:shadow-md hover:border-l-4 hover:border-l-blue-500 transition-all duration-200 cursor-pointer active:scale-[0.99] group`}
                      title="Click to view details"
                    >
                      <td className={`px-4 py-3 text-sm ${colors.text.secondary} group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors truncate`}>
                        {formatDate(adjustment.created_at)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${colors.text.primary} group-hover:font-semibold transition-all truncate`}>
                        {adjustment.product_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium inline-block ${getAdjustmentTypeColor(adjustment.adjustment_type)}`}>
                          {getAdjustmentTypeLabel(adjustment.adjustment_type)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-center text-sm font-semibold transition-all ${adjustment.quantity_change > 0
                        ? 'text-green-600 dark:text-green-400'
                        : adjustment.quantity_change < 0
                          ? 'text-red-600 dark:text-red-400'
                          : colors.text.primary
                        }`}>
                        {adjustment.quantity_change > 0 ? '+' : ''}{adjustment.quantity_change}
                        <div className={`text-xs font-normal ${colors.text.secondary} mt-1`}>
                          {adjustment.quantity_before} → {adjustment.quantity_after}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm ${colors.text.primary} group-hover:font-medium transition-all`}>
                        <div className="truncate" title={adjustment.reason || 'No reason provided'}>
                          {adjustment.reason || <span className={colors.text.secondary}>No reason provided</span>}
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-sm ${colors.text.secondary} truncate`}>
                        {adjustment.adjusted_by || 'System'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${colors.text.secondary}`}>
                        <div className="truncate" title={adjustment.notes || ''}>
                          {adjustment.notes || '-'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`px-4 py-3 border-t ${colors.border.primary} flex items-center justify-between`}>
                <div className={`text-sm ${colors.text.secondary}`}>
                  Showing {startIndex + 1} to {Math.min(endIndex, adjustments.length)} of {adjustments.length} adjustments
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg border ${colors.border.primary} ${colors.bg.secondary} ${colors.text.primary} disabled:opacity-50 disabled:cursor-not-allowed hover:${colors.bg.tertiary}`}
                  >
                    <ChevronLeftIcon className="h-5 w-5" />
                  </button>
                  <span className={`px-4 py-2 text-sm ${colors.text.primary}`}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg border ${colors.border.primary} ${colors.bg.secondary} ${colors.text.primary} disabled:opacity-50 disabled:cursor-not-allowed hover:${colors.bg.tertiary}`}
                  >
                    <ChevronRightIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Adjustment Details Modal */}
      {isDetailsModalOpen && selectedAdjustment && (
        <ModalPortal>
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={closeDetailsModal}
        >
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-2xl max-h-[90vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${colors.border.primary} sticky top-0 ${colors.bg.primary} z-10`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <InformationCircleIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Adjustment Details</h3>
                  <p className={`text-sm ${colors.text.secondary}`}>View full adjustment information</p>
                </div>
              </div>
              <button
                onClick={closeDetailsModal}
                className={`p-2 rounded-lg ${colors.bg.secondary} ${colors.text.secondary} hover:${colors.bg.tertiary} hover:${colors.text.primary} transition-colors`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="px-6 py-5 space-y-6">
              {/* Product Information */}
              <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                  <ScaleIcon className="h-4 w-4" />
                  Product Information
                </h4>
                <div className="space-y-2">
                  <div>
                    <p className={`text-xs ${colors.text.secondary} mb-1`}>Product Name</p>
                    <p className={`text-base font-medium ${colors.text.primary}`}>
                      {selectedAdjustment.product_name || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${colors.text.secondary} mb-1`}>Product ID</p>
                    <p className={`text-sm font-mono ${colors.text.secondary}`}>
                      {selectedAdjustment.product_id || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Adjustment Type & Quantity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3`}>Adjustment Type</h4>
                  <span className={`px-3 py-1.5 rounded-md text-sm font-medium inline-block ${getAdjustmentTypeColor(selectedAdjustment.adjustment_type)}`}>
                    {getAdjustmentTypeLabel(selectedAdjustment.adjustment_type)}
                  </span>
                </div>
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3`}>Quantity Change</h4>
                  <p className={`text-2xl font-bold ${selectedAdjustment.quantity_change > 0
                    ? 'text-green-600 dark:text-green-400'
                    : selectedAdjustment.quantity_change < 0
                      ? 'text-red-600 dark:text-red-400'
                      : colors.text.primary
                    }`}>
                    {selectedAdjustment.quantity_change > 0 ? '+' : ''}{selectedAdjustment.quantity_change}
                  </p>
                </div>
              </div>

              {/* Quantity Details */}
              <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3`}>Quantity Details</h4>
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className={`text-xs ${colors.text.secondary} mb-1`}>Before</p>
                    <p className={`text-xl font-semibold ${colors.text.primary}`}>
                      {selectedAdjustment.quantity_before || 0}
                    </p>
                  </div>
                  <div className="flex-1 flex items-center justify-center px-4">
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                    <ChevronRightIcon className="h-5 w-5 text-gray-400 mx-2" />
                    <div className="flex-1 h-px bg-gray-300 dark:bg-gray-600"></div>
                  </div>
                  <div className="text-center">
                    <p className={`text-xs ${colors.text.secondary} mb-1`}>After</p>
                    <p className={`text-xl font-semibold ${selectedAdjustment.quantity_change > 0
                      ? 'text-green-600 dark:text-green-400'
                      : selectedAdjustment.quantity_change < 0
                        ? 'text-red-600 dark:text-red-400'
                        : colors.text.primary
                      }`}>
                      {selectedAdjustment.quantity_after || 0}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reason */}
              {selectedAdjustment.reason && (
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                    <DocumentTextIcon className="h-4 w-4" />
                    Reason
                  </h4>
                  <p className={`text-sm ${colors.text.primary} whitespace-pre-wrap`}>
                    {selectedAdjustment.reason}
                  </p>
                </div>
              )}

              {/* Notes */}
              {selectedAdjustment.notes && (
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                    <DocumentTextIcon className="h-4 w-4" />
                    Additional Notes
                  </h4>
                  <p className={`text-sm ${colors.text.secondary} whitespace-pre-wrap`}>
                    {selectedAdjustment.notes}
                  </p>
                </div>
              )}

              {/* Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                    <CalendarIcon className="h-4 w-4" />
                    Date & Time
                  </h4>
                  <p className={`text-sm ${colors.text.secondary}`}>
                    {formatDate(selectedAdjustment.created_at)}
                  </p>
                </div>
                <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                  <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3 flex items-center gap-2`}>
                    <UserIcon className="h-4 w-4" />
                    Adjusted By
                  </h4>
                  <p className={`text-sm ${colors.text.secondary}`}>
                    {selectedAdjustment.adjusted_by || 'System'}
                  </p>
                  {selectedAdjustment.adjusted_by_id && (
                    <p className={`text-xs font-mono ${colors.text.secondary} mt-1`}>
                      ID: {selectedAdjustment.adjusted_by_id}
                    </p>
                  )}
                </div>
              </div>

              {/* Adjustment ID */}
              <div className={`p-3 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                <p className={`text-xs ${colors.text.secondary} mb-1`}>Adjustment ID</p>
                <p className={`text-xs font-mono ${colors.text.secondary}`}>
                  {selectedAdjustment.id}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end`}>
              <button
                onClick={closeDetailsModal}
                className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default StockAdjustmentsScreen;
