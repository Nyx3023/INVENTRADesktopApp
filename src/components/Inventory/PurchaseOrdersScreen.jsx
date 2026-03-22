import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { supplierService, productService, purchaseOrderService } from '../../services/api';
import { formatCurrency, formatDate, parseLocalTimestamp } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  XCircleIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  ShoppingBagIcon,
  CalendarIcon,
  XMarkIcon,
  TrashIcon,
  CubeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';
import { downloadPurchaseOrderPDF } from '../../utils/pdfGenerator';
import InvoicePreviewModal from './InvoicePreviewModal';
import ModalPortal from '../common/ModalPortal';

const PurchaseOrdersScreen = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState({ supplierId: '', items: [], notes: '' });
  const [showReceipt, setShowReceipt] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [productSearchTerms, setProductSearchTerms] = useState({});
  const [showProductDropdown, setShowProductDropdown] = useState({});

  // Date filtering and sorting states
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [dateSortOrder, setDateSortOrder] = useState('desc'); // desc = newest first, asc = oldest first

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [summary, setSummary] = useState({
    totalPurchases: 0,
    totalOrders: 0,
    pendingOrders: 0,
    receivedToday: 0
  });

  const load = async () => {
    try {
      setIsLoading(true);
      const [s, p, o] = await Promise.all([
        supplierService.getAll(),
        productService.getAll(),
        purchaseOrderService.list()
      ]);
      setSuppliers(s || []);
      setProducts(p || []);
      setOrders(o || []);
      calculateSummary(o || []);
    } catch (e) {
      toast.error('Failed to load purchase orders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    applyFilters();
    setCurrentPage(1); // Reset to first page when filters change
  }, [orders, searchTerm, statusFilter, dateFilter, dateSortOrder]);

  const calculateSummary = (orderList) => {
    const totalPurchases = orderList
      .filter(o => o.status === 'received')
      .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
    const totalOrders = orderList.length;
    const pendingOrders = orderList.filter(o => o.status === 'pending' || o.status === 'ordered').length;

    // Get today's date
    const today = new Date();
    const todayDateString = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');

    const receivedToday = orderList
      .filter(o => {
        if (o.status !== 'received') return false;
        const orderDate = parseLocalTimestamp(o.order_date);
        const orderDateString = orderDate.getFullYear() + '-' +
          String(orderDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(orderDate.getDate()).padStart(2, '0');
        return orderDateString === todayDateString;
      })
      .reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);

    setSummary({
      totalPurchases,
      totalOrders,
      pendingOrders,
      receivedToday
    });
  };

  const applyFilters = () => {
    let filtered = [...orders];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(order =>
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (order.supplierName || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter.startDate || dateFilter.endDate) {
      filtered = filtered.filter(order => {
        const orderDate = parseLocalTimestamp(order.order_date);

        if (dateFilter.startDate) {
          const startDate = new Date(dateFilter.startDate);
          startDate.setHours(0, 0, 0, 0);
          if (orderDate < startDate) return false;
        }

        if (dateFilter.endDate) {
          const endDate = new Date(dateFilter.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (orderDate > endDate) return false;
        }

        return true;
      });
    }

    // Sort by date
    filtered.sort((a, b) => {
      const dateA = parseLocalTimestamp(a.order_date);
      const dateB = parseLocalTimestamp(b.order_date);
      return dateSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    setFilteredOrders(filtered);
  };

  const addItem = () => {
    const newIdx = draft.items.length;
    setDraft(prev => ({ ...prev, items: [...prev.items, { productId: '', productName: '', quantity: 1, unitCost: 0 }] }));
    setProductSearchTerms(prev => ({ ...prev, [newIdx]: '' }));
  };

  const updateItem = (idx, patch) => setDraft(prev => ({ ...prev, items: prev.items.map((it, i) => i === idx ? { ...it, ...patch } : it) }));

  const removeItem = (idx) => {
    setDraft(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
    setProductSearchTerms(prev => {
      const newTerms = { ...prev };
      delete newTerms[idx];
      return newTerms;
    });
    setShowProductDropdown(prev => {
      const newDropdown = { ...prev };
      delete newDropdown[idx];
      return newDropdown;
    });
  };

  const getFilteredProducts = (idx) => {
    const searchTerm = productSearchTerms[idx] || '';
    if (!searchTerm) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const selectProduct = (idx, product) => {
    // Use the actual selling price
    const suggestedCost = product.price && product.price > 0
      ? product.price
      : 0;

    updateItem(idx, {
      productId: product.id,
      productName: product.name,
      unitCost: suggestedCost
    });
    setProductSearchTerms(prev => ({ ...prev, [idx]: product.name }));
    setShowProductDropdown(prev => ({ ...prev, [idx]: false }));
  };

  const draftTotal = useMemo(() => draft.items.reduce((sum, it) => sum + (Number(it.quantity) * Number(it.unitCost || 0)), 0), [draft.items]);

  const executePO = async (mode = 'DOWNLOAD') => { // modes: 'DOWNLOAD', 'SAVE_ONLY', 'SEND'
    try {
      if (draft.items.length === 0) return toast.error('Add at least one item');

      // Validate all items have product and valid quantity
      for (const item of draft.items) {
        if (!item.productId) {
          return toast.error('Please select a product for all items');
        }
        if (!item.quantity || item.quantity <= 0) {
          return toast.error('Please enter valid quantities for all items');
        }
        if (!item.unitCost || item.unitCost <= 0) {
          return toast.error('Please enter valid unit costs for all items');
        }
      }

      // Create the purchase order
      const result = await purchaseOrderService.create({ supplierId: draft.supplierId, items: draft.items, notes: draft.notes });
      const supplier = suppliers.find(s => s.id === draft.supplierId);

      if (mode === 'SAVE_ONLY') {
        toast.success(`Purchase order saved! No PDF generated.`);
      } else {
        // Generate and download PDF
        try {
          const pdfOrder = {
            id: result?.id || `PO-${Date.now()}`,
            order_date: new Date().toISOString(),
            notes: draft.notes
          };

          const pdfItems = draft.items.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            unitCost: item.unitCost
          }));

          const filename = downloadPurchaseOrderPDF(pdfOrder, pdfItems, supplier);
          toast.success(`Purchase order created! PDF downloaded: ${filename}`);

          // Handle sending via Messenger
          if (mode === 'SEND' && supplier) {
            const messengerUrl = supplier.messenger_url || supplier.messengerUrl;
            const facebookUrl = supplier.facebook_url || supplier.facebookUrl;
            let urlToOpen = messengerUrl;

            if (!urlToOpen && facebookUrl) {
              const fbId = facebookUrl.match(/facebook\.com\/([^/?]+)/)?.[1];
              urlToOpen = fbId ? `https://m.me/${fbId}` : facebookUrl;
            }

            if (urlToOpen) {
              if (window.ThesisPOS?.invoke) {
                window.ThesisPOS.invoke('shell:open-external', urlToOpen).catch(() => window.open(urlToOpen, '_blank'));
              } else {
                window.open(urlToOpen, '_blank');
              }
              toast.success('Opening supplier messenger...');
            } else {
               toast.error('No valid messenger URL found for this supplier');
            }
          }
        } catch (pdfError) {
          console.error('Failed to generate PDF:', pdfError);
          toast.error('Failed to generate PDF. You can download it later.');
        }
      }

      setDraft({ supplierId: '', items: [], notes: '' });
      setProductSearchTerms({});
      setShowProductDropdown({});
      setShowPreviewModal(false);
      setShowCreateModal(false);
      await load();
    } catch (error) {
      toast.error(error.message || 'Failed to create purchase order');
    }
  };

  const handleReviewInvoice = () => {
    if (draft.items.length === 0) return toast.error('Add at least one item');
    setShowPreviewModal(true);
  };

  const receivePO = async (id) => {
    try {
      await purchaseOrderService.receive(id);
      toast.success('Purchase order received');
      await load();
    } catch {
      toast.error('Failed to receive purchase order');
    }
  };

  const initiateCancelPO = (order) => {
    setOrderToCancel(order);
    setShowCancelModal(true);
  };

  const confirmCancelPO = async () => {
    if (!orderToCancel) return;
    try {
      await purchaseOrderService.cancel(orderToCancel.id);
      toast.success('Purchase order cancelled successfully');
      setShowCancelModal(false);
      setOrderToCancel(null);
      await load();
    } catch (error) {
      console.error('Error cancelling purchase order:', error);
      toast.error(error.message || 'Failed to cancel purchase order');
    }
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setOrderToCancel(null);
  };


  // formatDate is now imported from utils/formatters.js

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setDateFilter({ startDate: '', endDate: '' });
    setDateSortOrder('desc');
  };

  const toggleDateSort = () => {
    setDateSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className={`${colors.text.secondary}`}>Loading purchase orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Purchase Products</h1>
        <div className="flex items-center gap-3">
          <div className={`text-sm ${colors.text.secondary}`}>
            Total Records: {filteredOrders.length}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Create Purchase Order
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Total Purchases</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(summary.totalPurchases)}</p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <ShoppingBagIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Total Orders</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{summary.totalOrders}</p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CalendarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Received Today</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(summary.receivedToday)}</p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <ClipboardDocumentListIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Pending Orders</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{summary.pendingOrders}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative md:col-span-1">
            <MagnifyingGlassIcon className={`h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 ${colors.text.tertiary}`} />
            <input
              type="text"
              placeholder="Search by PO # or supplier..."
              className={`w-full pl-10 pr-4 py-2 border rounded-lg ${colors.input.primary}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="md:col-span-1">
            <select
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 md:col-span-2">
            <input
              type="date"
              className={`flex-1 border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
              placeholder="Start Date"
            />
            <span className={`${colors.text.secondary}`}>to</span>
            <input
              type="date"
              className={`flex-1 border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
              placeholder="End Date"
            />
          </div>

          <button
            onClick={clearAllFilters}
            className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 md:col-span-1"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Purchase Orders Table */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  PO Number
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  <button
                    onClick={toggleDateSort}
                    className="inline-flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title={`Sort by date: ${dateSortOrder === 'desc' ? 'Newest first' : 'Oldest first'}`}
                  >
                    Date & Time
                    {dateSortOrder === 'desc' ? (
                      <ArrowDownIcon className="h-4 w-4" />
                    ) : (
                      <ArrowUpIcon className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Supplier
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Status
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
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="6" className={`px-6 py-8 text-center ${colors.text.secondary}`}>
                    {searchTerm || statusFilter !== 'all' || dateFilter.startDate || dateFilter.endDate
                      ? 'No purchase orders match your filters'
                      : 'No purchase orders yet'}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`${colors.bg.hover} cursor-pointer`}
                    onClick={async () => {
                      const po = await purchaseOrderService.getById(order.id);
                      setShowReceipt(po);
                    }}
                    title="Click to view receipt"
                  >
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                      {order.id}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      {formatDate(order.order_date)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm`}>
                      {order.supplier_id && order.supplier_id !== 'na-supplier-default' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const supplier = suppliers.find(s => s.id === order.supplier_id);
                            if (supplier) {
                              const messengerUrl = supplier.messenger_url || supplier.messengerUrl;
                              const facebookUrl = supplier.facebook_url || supplier.facebookUrl;

                              if (messengerUrl) {
                                window.open(messengerUrl, '_blank');
                              } else if (facebookUrl) {
                                // Convert Facebook URL to Messenger URL if possible
                                const fbId = facebookUrl.match(/facebook\.com\/([^/?]+)/)?.[1];
                                if (fbId) {
                                  window.open(`https://m.me/${fbId}`, '_blank');
                                } else {
                                  window.open(facebookUrl, '_blank');
                                }
                              } else {
                                toast.error('No messenger link available for this supplier');
                              }
                            } else {
                              toast.error('Supplier information not found');
                            }
                          }}
                          className={`${colors.text.primary} hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted hover:decoration-solid transition-all`}
                          title="Open supplier's messenger or social links"
                        >
                          {order.supplierName || order.supplier_id}
                        </button>
                      ) : (
                        <span className={`${colors.text.secondary}`}>
                          {order.supplierName || '—'}
                        </span>
                      )}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${order.status === 'received'
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : order.status === 'cancelled'
                          ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                          : (order.status === 'pending' || order.status === 'ordered')
                            ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300'
                        }`}>
                        {order.status.toUpperCase()}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            purchaseOrderService.getById(order.id).then(po => setShowReceipt(po));
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          title="View Receipt"
                        >
                          <EyeIcon className="h-5 w-5" />
                        </button>

                        {(order.status === 'pending' || order.status === 'ordered') && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                receivePO(order.id);
                              }}
                              className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                              title="Receive Purchase Order"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                initiateCancelPO(order);
                              }}
                              className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                              title="Cancel Purchase Order"
                            >
                              <XCircleIcon className="h-5 w-5" />
                            </button>
                          </>
                        )}
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
              Showing {startIndex + 1} to {Math.min(endIndex, filteredOrders.length)} of {filteredOrders.length} orders
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

      {/* Create Purchase Order Modal - REDESIGNED */}
      {showCreateModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => {
          setShowCreateModal(false);
          setDraft({ supplierId: '', items: [], notes: '' });
          setProductSearchTerms({});
          setShowProductDropdown({});
        }}>
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-6xl h-[90vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* FIXED HEADER */}
            <div className={`px-6 py-4 border-b ${colors.border.primary} flex-shrink-0`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-xl font-bold ${colors.text.primary}`}>Create Purchase Order</h3>
                  <p className={`text-sm ${colors.text.secondary} mt-1`}>Add products quickly and finalize your order</p>
                </div>
                <button
                  onClick={() => {
                    setDraft({ supplierId: '', items: [], notes: '' });
                    setShowCreateModal(false);
                    setProductSearchTerms({});
                    setShowProductDropdown({});
                  }}
                  className={`p-2 rounded-lg hover:${colors.bg.secondary} transition-colors`}
                >
                  <XMarkIcon className={`h-6 w-6 ${colors.text.secondary}`} />
                </button>
              </div>
            </div>

            {/* FIXED TOP SECTION - Supplier & Add Button */}
            <div className={`px-6 py-4 border-b ${colors.border.primary} flex-shrink-0 ${colors.bg.secondary}`}>
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className={`block text-sm font-medium ${colors.text.secondary} mb-2`}>
                    Supplier <span className="text-xs opacity-75">(Optional)</span>
                  </label>
                  <select
                    className={`w-full border rounded-lg px-4 py-3 ${colors.input.primary} text-base`}
                    value={draft.supplierId}
                    onChange={(e) => setDraft({ ...draft, supplierId: e.target.value })}
                  >
                    <option value="">Select supplier...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button
                  onClick={addItem}
                  className="btn-primary px-6 py-3 inline-flex items-center gap-2 text-base font-semibold"
                >
                  <PlusIcon className="h-6 w-6" /> Add Product
                </button>
              </div>
            </div>

            {/* SCROLLABLE ITEMS LIST */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {draft.items.length === 0 ? (
                <div className={`${colors.bg.secondary} rounded-xl p-12 text-center border-2 border-dashed ${colors.border.primary}`}>
                  <CubeIcon className={`h-16 w-16 mx-auto mb-4 ${colors.text.tertiary}`} />
                  <h3 className={`text-lg font-semibold mb-2 ${colors.text.primary}`}>No items added yet</h3>
                  <p className={`${colors.text.secondary}`}>Click "Add Product" button above to start</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {draft.items.map((it, idx) => {
                    const subtotal = Number(it.quantity) * Number(it.unitCost || 0);
                    const filteredProducts = getFilteredProducts(idx);
                    return (
                      <div key={idx} className={`${colors.card.primary} border-2 ${colors.border.primary} rounded-xl p-4 hover:border-blue-400 transition-all`}>
                        <div className="flex items-start gap-3">
                          {/* Item Number Badge */}
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                            {idx + 1}
                          </div>

                          {/* Product Search - Flex grow */}
                          <div className="flex-1 relative">
                            <label className={`block text-xs font-medium ${colors.text.secondary} mb-1.5`}>Product Name</label>
                            <input
                              type="text"
                              className={`w-full border-2 rounded-lg px-4 py-2.5 text-base ${colors.input.primary} focus:border-blue-500 focus:ring-2 focus:ring-blue-200`}
                              placeholder="Type to search products..."
                              value={productSearchTerms[idx] || ''}
                              onChange={(e) => {
                                setProductSearchTerms(prev => ({ ...prev, [idx]: e.target.value }));
                                setShowProductDropdown(prev => ({ ...prev, [idx]: true }));
                              }}
                              onFocus={() => setShowProductDropdown(prev => ({ ...prev, [idx]: true }))}
                              onBlur={() => {
                                setTimeout(() => {
                                  setShowProductDropdown(prev => ({ ...prev, [idx]: false }));
                                }, 200);
                              }}
                            />
                            {showProductDropdown[idx] && filteredProducts.length > 0 && (
                              <div className={`absolute z-50 w-full mt-2 max-h-64 overflow-y-auto ${colors.card.primary} border-2 ${colors.border.primary} rounded-xl shadow-2xl`}>
                                {filteredProducts.slice(0, 10).map(product => (
                                  <div
                                    key={product.id}
                                    className={`px-4 py-3 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${colors.text.primary} border-b ${colors.border.primary} last:border-b-0 transition-colors`}
                                    onClick={() => selectProduct(idx, product)}
                                  >
                                    <div className="font-semibold text-base">{product.name}</div>
                                    <div className={`text-xs ${colors.text.secondary} mt-1.5 flex items-center gap-3`}>
                                      {product.barcode && <span className="bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">📦 {product.barcode}</span>}
                                      <span>Stock: <strong>{product.quantity || 0}</strong></span>
                                      <span>Price: <strong>{formatCurrency(parseFloat(product.price || 0))}</strong></span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quantity */}
                          <div className="w-24">
                            <label className={`block text-xs font-medium ${colors.text.secondary} mb-1.5`}>Qty</label>
                            <input
                              type="number"
                              min="1"
                              className={`w-full border-2 rounded-lg px-3 py-2.5 text-center text-base font-semibold ${colors.input.primary} focus:border-blue-500`}
                              value={it.quantity}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                // Allow empty string for deletion
                                if (inputValue === '') {
                                  updateItem(idx, { quantity: '' });
                                  return;
                                }
                                const value = parseInt(inputValue, 10);
                                // Only update if value is valid and greater than 0
                                if (!isNaN(value) && value > 0) {
                                  updateItem(idx, { quantity: value });
                                }
                              }}
                              onBlur={(e) => {
                                // Ensure minimum value of 1 when field loses focus
                                const value = parseInt(e.target.value, 10);
                                if (isNaN(value) || value < 1) {
                                  updateItem(idx, { quantity: 1 });
                                }
                              }}
                            />
                          </div>

                          {/* Unit Cost */}
                          <div className="w-32">
                            <label className={`block text-xs font-medium ${colors.text.secondary} mb-1.5`}>Unit Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className={`w-full border-2 rounded-lg px-3 py-2.5 text-base ${colors.input.primary} focus:border-blue-500`}
                              value={it.unitCost}
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                updateItem(idx, { unitCost: value >= 0 ? value : 0 });
                              }}
                            />
                          </div>

                          {/* Subtotal */}
                          <div className="w-32">
                            <label className={`block text-xs font-medium ${colors.text.secondary} mb-1.5`}>Total</label>
                            <div className={`w-full border-2 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2.5 ${colors.text.primary} font-bold text-base text-right`}>
                              {formatCurrency(subtotal)}
                            </div>
                          </div>

                          {/* Remove Button */}
                          <div className="flex-shrink-0 flex items-end">
                            <button
                              onClick={() => removeItem(idx)}
                              className="p-2.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                              title="Remove"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Notes Section - Always visible at bottom of items */}
              {draft.items.length > 0 && (
                <div className="mt-6">
                  <label className={`block text-sm font-medium ${colors.text.secondary} mb-2`}>
                    Order Notes <span className="text-xs opacity-75">(Optional)</span>
                  </label>
                  <textarea
                    className={`w-full border rounded-lg px-4 py-3 ${colors.input.primary} resize-none`}
                    placeholder="Add any special instructions or notes about this order..."
                    value={draft.notes}
                    onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    rows={2}
                  />
                </div>
              )}
            </div>

            {/* FIXED FOOTER - Order Summary & Actions */}
            <div className={`px-6 py-4 border-t-2 ${colors.border.primary} flex-shrink-0`} style={{ backgroundColor: colors.bg.secondary === 'bg-gray-50' ? '#f9fafb' : '#1f2937' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div>
                    <p className={`text-xs ${colors.text.secondary} mb-1`}>Total Items</p>
                    <p className={`text-lg font-bold ${colors.text.primary}`}>{draft.items.length}</p>
                  </div>
                  <div className={`h-10 w-px bg-gray-300 dark:bg-gray-700`}></div>
                  <div>
                    <p className={`text-xs ${colors.text.secondary} mb-1`}>Order Total</p>
                    <p className={`text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent`}>
                      {formatCurrency(draftTotal)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setDraft({ supplierId: '', items: [], notes: '' });
                      setShowCreateModal(false);
                      setProductSearchTerms({});
                      setShowProductDropdown({});
                    }}
                    className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReviewInvoice}
                    disabled={draft.items.length === 0}
                    className={`px-8 py-3 rounded-xl font-semibold inline-flex items-center gap-2 transition-all shadow-lg ${draft.items.length === 0
                      ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                      }`}
                  >
                    <EyeIcon className="h-6 w-6" />
                    Review Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && orderToCancel && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={closeCancelModal}>
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Cancel Purchase Order</h3>
              <p className={`text-sm ${colors.text.secondary} mt-1`}>
                Are you sure you want to cancel this purchase order?
              </p>
            </div>

            <div className="px-6 py-4">
              <div className={`p-4 rounded-lg ${colors.bg.secondary} mb-4`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className={`text-xs ${colors.text.secondary}`}>PO Number</p>
                    <p className={`text-sm font-medium ${colors.text.primary}`}>{orderToCancel.id}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${colors.text.secondary}`}>Supplier</p>
                    {orderToCancel.supplier_id && orderToCancel.supplier_id !== 'na-supplier-default' ? (
                      <button
                        onClick={() => window.open('/suppliers', '_blank')}
                        className={`text-sm font-medium ${colors.text.primary} hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted hover:decoration-solid transition-all`}
                        title="Open Suppliers page in new tab"
                      >
                        {orderToCancel.supplierName || orderToCancel.supplier_id}
                      </button>
                    ) : (
                      <p className={`text-sm font-medium ${colors.text.secondary}`}>
                        {orderToCancel.supplierName || '—'}
                      </p>
                    )}
                  </div>
                  <div>
                    <p className={`text-xs ${colors.text.secondary}`}>Date</p>
                    <p className={`text-sm font-medium ${colors.text.primary}`}>
                      {formatDate(orderToCancel.order_date)}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs ${colors.text.secondary}`}>Total Amount</p>
                    <p className={`text-sm font-medium ${colors.text.primary}`}>
                      {formatCurrency(orderToCancel.total)}
                    </p>
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800`}>
                <p className={`text-sm text-red-800 dark:text-red-300`}>
                  <strong>Warning:</strong> This action cannot be undone. The purchase order will be marked as cancelled.
                </p>
              </div>
            </div>

            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
              <button
                onClick={closeCancelModal}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
              >
                No, Keep It
              </button>
              <button
                onClick={confirmCancelPO}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 inline-flex items-center gap-2"
              >
                <XCircleIcon className="h-5 w-5" />
                Yes, Cancel Order
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Receipt Modal */}
      {showReceipt && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowReceipt(null)}>
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-lg`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Purchase Order Receipt</h3>
              <p className={`${colors.text.secondary} text-sm`}>
                PO #: {showReceipt.id} • {formatDate(showReceipt.order_date)}
              </p>
            </div>

            <div className="px-6 py-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className={`text-xs ${colors.text.secondary}`}>Supplier</p>
                  {showReceipt.supplier_id && showReceipt.supplier_id !== 'na-supplier-default' ? (
                    <button
                      onClick={() => {
                        const supplier = suppliers.find(s => s.id === showReceipt.supplier_id);
                        if (supplier) {
                          const messengerUrl = supplier.messenger_url || supplier.messengerUrl;
                          const facebookUrl = supplier.facebook_url || supplier.facebookUrl;

                          if (messengerUrl) {
                            window.open(messengerUrl, '_blank');
                          } else if (facebookUrl) {
                            const fbId = facebookUrl.match(/facebook\.com\/([^/?]+)/)?.[1];
                            if (fbId) {
                              window.open(`https://m.me/${fbId}`, '_blank');
                            } else {
                              window.open(facebookUrl, '_blank');
                            }
                          } else {
                            toast.error('No messenger link available for this supplier');
                          }
                        } else {
                          toast.error('Supplier information not found');
                        }
                      }}
                      className={`text-sm font-medium ${colors.text.primary} hover:text-blue-600 dark:hover:text-blue-400 underline decoration-dotted hover:decoration-solid transition-all`}
                      title="Open supplier's messenger or social links"
                    >
                      {showReceipt.supplierName || showReceipt.supplier_id}
                    </button>
                  ) : (
                    <p className={`text-sm font-medium ${colors.text.secondary}`}>
                      {showReceipt.supplierName || '—'}
                    </p>
                  )}
                </div>
                <div>
                  <p className={`text-xs ${colors.text.secondary}`}>Status</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${showReceipt.status === 'received'
                    ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                    : showReceipt.status === 'cancelled'
                      ? 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                      : 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
                    }`}>
                    {showReceipt.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {showReceipt.notes && (
                <div className="mb-4">
                  <p className={`text-xs ${colors.text.secondary}`}>Notes</p>
                  <p className={`text-sm ${colors.text.primary}`}>{showReceipt.notes}</p>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border ${colors.border.primary}">
                <table className={`min-w-full divide-y ${colors.border.primary}`}>
                  <thead className={`${colors.bg.secondary}`}>
                    <tr>
                      <th className={`px-3 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Product</th>
                      <th className={`px-3 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Qty</th>
                      <th className={`px-3 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Unit Cost</th>
                      <th className={`px-3 py-2 text-right text-xs font-medium ${colors.text.secondary} uppercase`}>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
                    {showReceipt.items?.map((it) => (
                      <tr key={it.id}>
                        <td className={`px-3 py-2 ${colors.text.primary} whitespace-normal break-words max-w-[220px]`}>{it.productName}</td>
                        <td className={`px-3 py-2 text-right ${colors.text.secondary}`}>{it.quantity}</td>
                        <td className={`px-3 py-2 text-right ${colors.text.secondary}`}>{formatCurrency(it.unit_cost)}</td>
                        <td className={`px-3 py-2 text-right ${colors.text.secondary}`}>{formatCurrency(it.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end mt-4 pt-4 border-t ${colors.border.primary}">
                <div className={`text-lg font-semibold ${colors.text.primary}`}>
                  Total: {formatCurrency(showReceipt.total || 0)}
                </div>
              </div>
            </div>

            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-between`}>
              <button
                onClick={() => {
                  try {
                    const supplier = suppliers.find(s => s.id === showReceipt.supplier_id);
                    const pdfItems = showReceipt.items?.map(item => ({
                      productName: item.productName,
                      quantity: item.quantity,
                      unitCost: item.unit_cost
                    })) || [];
                    downloadPurchaseOrderPDF(showReceipt, pdfItems, supplier);
                    toast.success('PDF downloaded successfully!');
                  } catch (error) {
                    console.error('Failed to download PDF:', error);
                    toast.error('Failed to download PDF');
                  }
                }}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 inline-flex items-center gap-2"
              >
                <DocumentArrowDownIcon className="h-5 w-5" />
                Download PDF
              </button>
              <button
                onClick={() => setShowReceipt(null)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Interactive Invoice Preview */}
      {showPreviewModal && (
        <InvoicePreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          draft={draft}
          setDraft={setDraft}
          supplier={suppliers.find(s => s.id === draft.supplierId)}
          onDownload={() => executePO('DOWNLOAD')}
          onSaveOnly={() => executePO('SAVE_ONLY')}
          onSendTo={() => executePO('SEND')}
          onDiscard={() => {
             setShowPreviewModal(false);
          }}
        />
      )}
    </div>
  );
};

export default PurchaseOrdersScreen;


