import { useEffect, useMemo, useState, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { inventoryBatchService, productService } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  RectangleStackIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline';
import LazyPageLoader from '../common/LazyPageLoader';
import { exportToCSV } from '../../utils/exportUtils';
import { toast } from 'react-hot-toast';
import {
  BATCH_STATUS_CONFIG,
  getBatchDisplayStatus,
  getDaysUntilExpiry,
} from '../../utils/batchStatus';
import BatchFormModal from './BatchFormModal';
import ModalPortal from '../common/ModalPortal';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'near_expiry', label: 'Near Expiry' },
  { value: 'critical', label: 'Critical' },
  { value: 'expired', label: 'Expired' },
  { value: 'depleted', label: 'Depleted' },
];

const BatchManagementScreen = () => {
  const { colors } = useTheme();

  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // covers active/near/critical/expired/depleted
  const [productFilter, setProductFilter] = useState('all');
  const [expiryFrom, setExpiryFrom] = useState('');
  const [expiryTo, setExpiryTo] = useState('');
  const [sortOrder, setSortOrder] = useState('expiry_asc'); // default: nearest expiry first
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modals
  const [showForm, setShowForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [batchStats, setBatchStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Deep-link highlight (batchId from URL ?batchId=...)
  const [highlightedBatchId, setHighlightedBatchId] = useState(null);
  const highlightRowRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get('batchId');
    if (batchId) {
      setHighlightedBatchId(batchId);
      // Auto-clear highlight after 5s
      const t = setTimeout(() => setHighlightedBatchId(null), 5000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, []);

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const params = {
        sort: sortOrder,
        search: searchTerm || undefined,
        productId: productFilter !== 'all' ? productFilter : undefined,
        expiryFrom: expiryFrom || undefined,
        expiryTo: expiryTo || undefined,
      };
      // Server understands `displayStatus` for the 4 expiry-derived buckets and `status` for active/depleted.
      if (statusFilter === 'depleted') params.status = 'depleted';
      else if (statusFilter === 'active') params.displayStatus = 'active';
      else if (['near_expiry', 'critical', 'expired'].includes(statusFilter)) {
        params.displayStatus = statusFilter;
      }
      const data = await inventoryBatchService.getAll(params);
      setBatches(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load inventory batches:', error);
      toast.error('Failed to load batches');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const data = await productService.getAll();
      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  };

  const loadBatchStats = async () => {
    setStatsLoading(true);
    try {
      const data = await inventoryBatchService.getStats();
      setBatchStats(data);
    } catch (error) {
      console.error('Failed to load batch stats:', error);
      toast.error('Failed to load batch status summary');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    loadBatches();
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder, statusFilter, productFilter, expiryFrom, expiryTo]);

  // Search is debounced lightly via the existing pattern (refresh as user finishes typing)
  useEffect(() => {
    const t = setTimeout(() => {
      loadBatches();
      setCurrentPage(1);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  // Scroll the highlighted row into view once batches load
  useEffect(() => {
    if (!highlightedBatchId) return;
    if (!highlightRowRef.current) return;
    try {
      highlightRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (_) { /* no-op */ }
  }, [highlightedBatchId, batches]);

  const totalPages = Math.max(1, Math.ceil(batches.length / itemsPerPage));
  const paginatedBatches = useMemo(
    () => batches.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [batches, currentPage]
  );

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (searchTerm.trim()) n += 1;
    if (statusFilter !== 'all') n += 1;
    if (productFilter !== 'all') n += 1;
    if (expiryFrom || expiryTo) n += 1;
    return n;
  }, [searchTerm, statusFilter, productFilter, expiryFrom, expiryTo]);

  const handleExport = () => {
    const columns = [
      { header: 'Batch ID', accessor: 'batchNumber' },
      { header: 'Product Name', accessor: 'productName' },
      { header: 'Category', accessor: 'categoryName' },
      { header: 'Quantity', accessor: 'quantity' },
      { header: 'Unit Cost', accessor: (row) => Number(row.unitCost || 0).toFixed(2) },
      { header: 'Received Date', accessor: (row) => row.receivedDate ? new Date(row.receivedDate).toLocaleDateString() : 'N/A' },
      { header: 'Expiry Date', accessor: (row) => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : 'N/A' },
      { header: 'Supplier', accessor: 'supplierName' },
      { header: 'Storage Location', accessor: 'storageLocation' },
      { header: 'Status', accessor: (row) => BATCH_STATUS_CONFIG[getBatchDisplayStatus(row)]?.label || 'Unknown' },
    ];
    exportToCSV(batches, columns, 'Inventory_Batches');
    toast.success('Batches exported successfully');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setProductFilter('all');
    setExpiryFrom('');
    setExpiryTo('');
    setSortOrder('expiry_asc');
  };

  const toggleExpirySort = () => {
    setSortOrder((prev) => (prev === 'expiry_asc' ? 'expiry_desc' : 'expiry_asc'));
  };

  const handleAdd = () => {
    setEditingBatch(null);
    setShowForm(true);
  };
  const handleEdit = (batch) => {
    setEditingBatch(batch);
    setShowForm(true);
  };
  const handleDelete = (batch) => setConfirmDelete(batch);

  const confirmDeleteBatch = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await inventoryBatchService.delete(confirmDelete.id);
      toast.success('Batch deleted');
      setConfirmDelete(null);
      await loadBatches();
      loadBatchStats();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Failed to delete batch');
    } finally {
      setDeleting(false);
    }
  };

  if (isLoading && batches.length === 0) {
    return (
      <LazyPageLoader
        title="Loading Batches"
        subtitle="Fetching inventory batch records..."
        rows={5}
        centered
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Toolbar */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className={`text-xl font-bold ${colors.text.primary}`}>Batch Management</h2>
            <span className={`text-sm ${colors.text.secondary}`}>
              {batches.length} batch{batches.length === 1 ? '' : 'es'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowStatusModal(true);
                loadBatchStats();
              }}
              className={`px-3 py-2.5 rounded-xl font-medium transition-all duration-200 inline-flex items-center gap-2 ${colors.bg.secondary} hover:${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary} border ${colors.border.primary}`}
            >
              <RectangleStackIcon className="h-5 w-5" />
              <span>Batch status</span>
            </button>
            <button
              type="button"
              onClick={() => setShowFiltersModal(true)}
              className={`px-3 py-2.5 rounded-xl font-medium transition-all duration-200 inline-flex items-center gap-2 ${colors.bg.secondary} hover:${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary} border ${colors.border.primary} relative`}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <button
              onClick={loadBatches}
              className={`p-2.5 rounded-xl font-medium transition-all duration-200 ${colors.bg.secondary} hover:${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
              title="Refresh"
            >
              <ArrowPathIcon className="h-5 w-5" />
            </button>
            <button
              onClick={handleExport}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all duration-200 inline-flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span>Export</span>
            </button>
            <button
              onClick={handleAdd}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all duration-200 inline-flex items-center gap-2 shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global batch status summary modal */}
      {showStatusModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowStatusModal(false)}
          >
            <div
              className={`${colors.card.primary} w-full max-w-lg rounded-2xl shadow-2xl border ${colors.border.primary} overflow-hidden`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-6 py-4 border-b ${colors.border.primary} flex items-center justify-between gap-3`}>
                <div className="flex items-center gap-2">
                  <RectangleStackIcon className={`h-6 w-6 ${colors.text.secondary}`} />
                  <div>
                    <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Batch status</h3>
                    <p className={`text-xs ${colors.text.secondary}`}>
                      All inventory batches (not limited by table filters)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className={`p-2 rounded-lg ${colors.text.secondary} hover:bg-white/10`}
                  aria-label="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {statsLoading ? (
                  <p className={`text-sm ${colors.text.secondary}`}>Loading summary…</p>
                ) : batchStats ? (
                  <>
                    <div className={`grid grid-cols-2 gap-3 text-sm ${colors.text.secondary}`}>
                      <div className={`rounded-xl p-3 ${colors.bg.secondary}`}>
                        <p className="text-xs uppercase tracking-wide opacity-80">Total batches</p>
                        <p className={`text-2xl font-bold ${colors.text.primary}`}>{batchStats.totalBatches ?? 0}</p>
                      </div>
                      <div className={`rounded-xl p-3 ${colors.bg.secondary}`}>
                        <p className="text-xs uppercase tracking-wide opacity-80">Products with batches</p>
                        <p className={`text-2xl font-bold ${colors.text.primary}`}>{batchStats.productsWithBatches ?? 0}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(['active', 'near_expiry', 'critical', 'expired', 'depleted']).map((key) => {
                        const cfg = BATCH_STATUS_CONFIG[key];
                        const n = batchStats.byStatus?.[key] ?? 0;
                        return (
                          <div
                            key={key}
                            className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${colors.border.primary} ${cfg.badge}`}
                          >
                            <span className="inline-flex items-center gap-2 text-sm font-medium">
                              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                            <span className="text-sm font-bold tabular-nums">{n}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className={`text-sm ${colors.text.secondary}`}>No data.</p>
                )}
              </div>
              <div className={`px-6 py-3 border-t ${colors.border.primary} flex justify-end`}>
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Filters modal */}
      {showFiltersModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowFiltersModal(false)}
          >
            <div
              className={`${colors.card.primary} w-full max-w-xl rounded-2xl shadow-2xl border ${colors.border.primary} max-h-[90vh] overflow-y-auto`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-6 py-4 border-b ${colors.border.primary} flex items-center justify-between`}>
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Filter batches</h3>
                  <p className={`text-xs ${colors.text.secondary}`}>Search and narrow the list below</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFiltersModal(false)}
                  className={`p-2 rounded-lg ${colors.text.secondary} hover:bg-white/10`}
                  aria-label="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${colors.text.secondary}`}>Search</label>
                  <div className="relative">
                    <MagnifyingGlassIcon className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${colors.text.tertiary}`} />
                    <input
                      type="text"
                      placeholder="Product, batch #, ID…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={`w-full pl-9 pr-9 py-2.5 rounded-xl border text-sm ${colors.input.primary}`}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${colors.text.tertiary} hover:text-red-500`}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${colors.text.secondary}`}>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm ${colors.input.primary}`}
                  >
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${colors.text.secondary}`}>Product</label>
                  <select
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm ${colors.input.primary}`}
                  >
                    <option value="all">All Products</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${colors.text.secondary}`}>Expiry date range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={expiryFrom}
                      onChange={(e) => setExpiryFrom(e.target.value)}
                      className={`flex-1 px-3 py-2.5 rounded-xl border text-sm ${colors.input.primary}`}
                      title="From"
                    />
                    <span className={`text-xs ${colors.text.tertiary}`}>→</span>
                    <input
                      type="date"
                      value={expiryTo}
                      onChange={(e) => setExpiryTo(e.target.value)}
                      className={`flex-1 px-3 py-2.5 rounded-xl border text-sm ${colors.input.primary}`}
                      title="To"
                    />
                  </div>
                </div>
              </div>
              <div className={`px-6 py-4 border-t ${colors.border.primary} flex flex-wrap gap-2 justify-end`}>
                <button
                  type="button"
                  onClick={() => {
                    clearFilters();
                  }}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium inline-flex items-center gap-2 ${colors.bg.secondary} ${colors.text.secondary}`}
                >
                  <FunnelIcon className="h-4 w-4" />
                  Clear all
                </button>
                <button
                  type="button"
                  onClick={() => setShowFiltersModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Table */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Batch ID</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Product</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Qty</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Unit Cost</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Received</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  <button
                    onClick={toggleExpirySort}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase"
                    title={`Sort by expiry: ${sortOrder === 'expiry_asc' ? 'Soonest first' : 'Latest first'}`}
                  >
                    Expiry
                    {sortOrder === 'expiry_asc' ? (
                      <ArrowUpIcon className="h-3.5 w-3.5" />
                    ) : sortOrder === 'expiry_desc' ? (
                      <ArrowDownIcon className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                </th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Supplier</th>
                <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Status</th>
                <th className={`px-4 py-3 text-right text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan="9" className={`px-6 py-10 text-center text-sm ${colors.text.tertiary}`}>
                    No batches match your filters.
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((batch) => {
                  const ds = getBatchDisplayStatus(batch);
                  const cfg = BATCH_STATUS_CONFIG[ds] || BATCH_STATUS_CONFIG.active;
                  const days = getDaysUntilExpiry(batch.expiryDate);
                  const isHighlighted = highlightedBatchId === batch.id;
                  return (
                    <tr
                      key={batch.id}
                      ref={isHighlighted ? highlightRowRef : null}
                      className={`transition-colors ${isHighlighted ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400 ring-inset' : `hover:${colors.bg.secondary}`}`}
                    >
                      <td className={`px-4 py-3 whitespace-nowrap text-sm font-mono ${colors.text.primary}`}>
                        {batch.batchNumber || (
                          <span className={`italic ${colors.text.tertiary}`}>{batch.id.slice(0, 8)}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${colors.text.primary}`}>
                        <div>{batch.productName || 'Unknown Product'}</div>
                        <div className={`text-xs ${colors.text.tertiary}`}>{batch.categoryName || 'Uncategorized'}</div>
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-right text-sm font-semibold ${colors.text.primary}`}>
                        {batch.quantity}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-right text-sm ${colors.text.secondary}`}>
                        {formatCurrency(parseFloat(batch.unitCost || 0))}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                        {batch.receivedDate ? formatDate(batch.receivedDate) : '—'}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                        {batch.expiryDate ? (
                          <div className="flex flex-col">
                            <span>{formatDate(batch.expiryDate)}</span>
                            {days !== null && (
                              <span className={`text-xs ${cfg.text}`}>
                                {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? 'today' : `in ${days}d`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="italic text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                        {batch.supplierName || <span className="italic text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${cfg.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEdit(batch)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                            title="Edit batch"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(batch)}
                            className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            title="Delete batch"
                          >
                            <TrashIcon className="h-4 w-4" />
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`px-6 py-4 border-t ${colors.border.primary} flex items-center justify-between`}>
            <div className={`text-sm ${colors.text.secondary}`}>
              Showing {((currentPage - 1) * itemsPerPage) + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, batches.length)} of {batches.length} batches
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg transition-colors ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : `hover:${colors.bg.secondary}`}`}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <div className={`text-sm font-medium ${colors.text.primary}`}>
                Page {currentPage} of {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg transition-colors ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : `hover:${colors.bg.secondary}`}`}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <BatchFormModal
          isOpen={showForm}
          mode={editingBatch ? 'edit' : 'create'}
          batch={editingBatch}
          onClose={() => {
            setShowForm(false);
            setEditingBatch(null);
          }}
          onSaved={() => {
            loadBatches();
            loadBatchStats();
          }}
        />
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setConfirmDelete(null)}
          >
            <div
              className={`${colors.card.primary} w-full max-w-md rounded-2xl shadow-2xl border ${colors.border.primary} overflow-hidden`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-6 py-4 border-b ${colors.border.primary} flex items-center gap-3`}>
                <div className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Delete batch?</h3>
                  <p className={`text-sm ${colors.text.secondary}`}>
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="px-6 py-4">
                <div className={`p-3 rounded-lg ${colors.bg.secondary} text-sm`}>
                  <p className={`${colors.text.primary} font-medium`}>
                    Batch #{confirmDelete.batchNumber || confirmDelete.id.slice(0, 8)}
                  </p>
                  <p className={`${colors.text.secondary} mt-0.5`}>
                    Product: {confirmDelete.productName}
                  </p>
                  <p className={`${colors.text.secondary}`}>
                    Quantity: {confirmDelete.quantity}
                  </p>
                </div>
                <p className={`text-xs ${colors.text.secondary} mt-3`}>
                  The remaining stock for this batch ({confirmDelete.quantity}) will be deducted from the product's on-hand quantity.
                </p>
              </div>
              <div className={`px-6 py-3 border-t ${colors.border.primary} flex justify-end gap-2`}>
                <button
                  onClick={() => setConfirmDelete(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBatch}
                  disabled={deleting}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium inline-flex items-center gap-2 transition-colors"
                >
                  <TrashIcon className="h-4 w-4" />
                  {deleting ? 'Deleting...' : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default BatchManagementScreen;
