import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
  ArrowPathIcon,
  CubeIcon,
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  ChevronDownIcon,
  FunnelIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  ListBulletIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  QrCodeIcon,
  ArrowUpIcon,
  ScaleIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline';
import ProductModal from './ProductModal';
import InventoryAuditModal from './InventoryAuditModal';
import ImportProductsModal from './ImportProductsModal';
import { productService, categoryService, auditService, stockAdjustmentService } from '../../services/api';
import { exportProductsToExcel } from '../../utils/exportUtils';
import { useAuth, usePermissions } from '../../context/AuthContext';
import AsyncImage from '../common/AsyncImage';
import { formatCurrency } from '../../utils/formatters';
import { useGlobalBarcode } from '../../context/BarcodeContext';
import { useTheme } from '../../context/ThemeContext';
import { useSettings } from '../../context/SettingsContext';
import ModalPortal from '../common/ModalPortal';

const InventoryScreen = () => {
  console.log('InventoryScreen rendering');

  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { refreshProducts: refreshBarcodeProducts } = useGlobalBarcode();
  const { colors } = useTheme();
  const { settings } = useSettings();
  const lowStockThreshold = settings.lowStockThreshold ?? 10;

  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isQuickStockOpen, setIsQuickStockOpen] = useState(false);
  const [quickStockType, setQuickStockType] = useState('in');
  const [quickStockQty, setQuickStockQty] = useState(1);
  const [isStockAdjustmentOpen, setIsStockAdjustmentOpen] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({
    type: 'physical_count',
    newQuantity: 0,
    reason: '',
    notes: ''
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [reorderSuggestions, setReorderSuggestions] = useState([]);
  const [showReorderPanel, setShowReorderPanel] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [prefilledBarcode, setPrefilledBarcode] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    priceRange: '',
    stockStatus: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [sortMode, setSortMode] = useState(null); // null, 'outOfStock', 'lowStock', 'inStock'

  // Multi-select for bulk delete
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Single product delete confirmation
  const [productToDelete, setProductToDelete] = useState(null);

  // Stock Mode - for quick barcode scanning to add quantities
  const [stockMode, setStockMode] = useState(false);
  const [stockModeQty, setStockModeQty] = useState(1);
  const [stockModeBarcode, setStockModeBarcode] = useState('');
  const stockModeBarcodeRef = useRef(null);
  const stockModeLastScan = useRef(null);

  // Handle URL parameters for barcode scanning
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const action = urlParams.get('action');
    const barcode = urlParams.get('barcode');

    if (action === 'add' && barcode) {
      console.log('Opening add product modal with barcode:', barcode);
      setPrefilledBarcode(barcode);
      setSelectedProduct(null);
      setIsModalOpen(true);

      // Clear URL parameters to prevent reopening on refresh
      navigate('/inventory', { replace: true });
    }
  }, [location.search, navigate]);



  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load products first
      const data = await productService.getAll();
      console.log('Products loaded:', data);
      const productList = data || [];
      setProducts(productList);
      setLastRefresh(new Date());

      // Load reorder suggestions functionality removed
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();

    // Set up real-time monitoring - refresh every 2 minutes instead of 30 seconds
    const interval = setInterval(() => {
      loadProducts();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [loadProducts]);

  const handleAddProduct = async (productData) => {
    try {
      console.log('Adding product:', productData);
      const newProduct = await productService.create(productData);
      console.log('Product added:', newProduct);
      const updatedProducts = [...products, newProduct];
      setProducts(updatedProducts);

      // Refresh barcode context products for scanning
      refreshBarcodeProducts();

      toast.success('Product added successfully');
      setIsModalOpen(false);
      setPrefilledBarcode('');
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Error adding product');
    }
  };

  const handleEditProduct = async (productData) => {
    try {
      console.log('Editing product:', productData);
      const updatedProduct = await productService.update(selectedProduct.id, productData);
      const updatedProducts = products.map(p => p.id === selectedProduct.id ? updatedProduct : p);
      setProducts(updatedProducts);

      // Refresh barcode context products for scanning
      refreshBarcodeProducts();

      toast.success('Product updated successfully');
      setIsModalOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Error updating product');
    }
  };

  const handleDeleteProduct = (productId) => {
    const product = safeProducts.find(p => p.id === productId);
    setProductToDelete(product || { id: productId, name: 'this product' });
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    const productId = productToDelete.id;
    setProductToDelete(null);
    try {
      const result = await productService.delete(productId);
      console.log('Delete result:', result);

      // Always refresh from server to ensure consistency
      await loadProducts();

      // Refresh barcode context products for scanning
      refreshBarcodeProducts();

      toast.success('Product deleted successfully');
    } catch (error) {
      console.error('Error deleting product:', error);
      // Still try to refresh in case deletion succeeded but response failed
      try {
        await loadProducts();
      } catch (refreshError) {
        console.error('Error refreshing products:', refreshError);
      }
      toast.error(error.message || 'Failed to delete product');
    }
  };

  // Multi-select handlers
  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === paginatedProducts.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(paginatedProducts.map(p => p.id));
    }
  };

  const handleBulkDelete = async () => {
    try {
      setShowBulkDeleteModal(false);
      const deletePromises = selectedProducts.map(id => productService.delete(id));
      await Promise.all(deletePromises);

      const updatedProducts = products.filter(p => !selectedProducts.includes(p.id));
      setProducts(updatedProducts);
      checkLowStock(updatedProducts);

      // Refresh barcode context products for scanning
      refreshBarcodeProducts();

      toast.success(`${selectedProducts.length} product(s) deleted successfully`);
      setSelectedProducts([]);
    } catch (error) {
      console.error('Error deleting products:', error);
      toast.error('Error deleting some products');
    }
  };

  const handleAuditComplete = (auditData) => {
    // Process audit results and update inventory
    loadProducts();
    setIsAuditModalOpen(false);
    toast.success('Inventory audit completed successfully');
  };

  const openQuickStock = (product) => {
    setSelectedProduct(product);
    setQuickStockType('in');
    setQuickStockQty(1);
    setIsQuickStockOpen(true);
  };

  const submitQuickStock = async () => {
    if (!selectedProduct) return;
    const qty = Math.max(1, parseInt(quickStockQty, 10) || 0);

    try {
      if (quickStockType === 'in') {
        // Add stock directly - ensure numeric addition
        const currentQty = Number(selectedProduct.quantity) || 0;
        const newQuantity = currentQty + qty;
        await productService.update(selectedProduct.id, {
          ...selectedProduct,
          quantity: newQuantity,
        });

        // Log as stock in activity
        await stockAdjustmentService.create({
          productId: selectedProduct.id,
          adjustmentType: 'correction',
          newQuantity: newQuantity,
          reason: `Quick stock in: +${qty}`,
          notes: 'Quick stock adjustment',
          adjustedBy: user?.name || 'System',
          adjustedById: user?.id,
        });

        toast.success(`Stock added: ${qty}`);
      } else {
        // Remove stock directly - ensure numeric calculation
        const currentQty = Number(selectedProduct.quantity) || 0;
        const newQuantity = Math.max(0, currentQty - qty);
        if (currentQty < qty) {
          toast.error('Insufficient stock');
          return;
        }

        await productService.update(selectedProduct.id, {
          ...selectedProduct,
          quantity: newQuantity,
        });

        // Log as stock out activity
        await stockAdjustmentService.create({
          productId: selectedProduct.id,
          adjustmentType: 'correction',
          newQuantity: newQuantity,
          reason: `Quick stock out: -${qty}`,
          notes: 'Quick stock adjustment',
          adjustedBy: user?.name || 'System',
          adjustedById: user?.id,
        });

        toast.success(`Stock removed: ${qty}`);
      }

      setIsQuickStockOpen(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (e) {
      console.error('Error updating stock:', e);
      toast.error(e.message || 'Failed to update stock');
    }
  };

  const openStockAdjustment = (product) => {
    setSelectedProduct(product);
    setAdjustmentData({
      type: 'physical_count',
      newQuantity: product.quantity || 0,
      reason: '',
      notes: ''
    });
    setIsStockAdjustmentOpen(true);
  };

  const submitStockAdjustment = async () => {
    if (!selectedProduct) return;

    const newQty = Math.max(0, parseInt(adjustmentData.newQuantity, 10) || 0);
    const oldQty = selectedProduct.quantity || 0;

    if (newQty === oldQty) {
      toast.error('New quantity is the same as current quantity');
      return;
    }

    // Require reason only when adjustment type is "other"
    if (adjustmentData.type === 'other' && (!adjustmentData.reason || adjustmentData.reason.trim() === '')) {
      toast.error('Please provide a reason for this adjustment');
      return;
    }

    try {
      await stockAdjustmentService.create({
        productId: selectedProduct.id,
        adjustmentType: adjustmentData.type,
        newQuantity: newQty,
        reason: adjustmentData.reason,
        notes: adjustmentData.notes,
        adjustedBy: user?.name || 'System',
        adjustedById: user?.id,
      });

      const difference = newQty - oldQty;
      const prefix = difference > 0 ? '+' : '';
      toast.success(`Stock adjusted: ${prefix}${difference} | New total: ${newQty}`);

      setIsStockAdjustmentOpen(false);
      setSelectedProduct(null);
      await loadProducts();
    } catch (e) {
      console.error('Error creating stock adjustment:', e);
      toast.error(e.message || 'Failed to create stock adjustment');
    }
  };

  // Stock Mode: Handle barcode scan to add quantity
  const handleStockModeBarcodeScan = async (barcode) => {
    if (!barcode || !stockMode) return;

    // Prevent duplicate scans within 500ms
    const now = Date.now();
    if (stockModeLastScan.current && now - stockModeLastScan.current < 500) {
      return;
    }
    stockModeLastScan.current = now;

    // Find product by barcode
    const product = safeProducts.find(p => p.barcode === barcode);

    if (product) {
      // Product found - add quantity using FIFO batches
      const qty = Math.max(1, parseInt(stockModeQty, 10) || 1);

      try {
        // Add stock directly - ensure numeric addition
        const currentQty = Number(product.quantity) || 0;
        const newQuantity = currentQty + qty;
        await productService.update(product.id, {
          ...product,
          quantity: newQuantity,
        });

        // Log the adjustment automatically
        await stockAdjustmentService.create({
          productId: product.id,
          adjustmentType: 'physical_count',
          newQuantity: newQuantity,
          reason: 'Stock Mode entry',
          notes: 'Added via barcode scanner in Stock Mode'
        });

        toast.success(
          <div>
            <strong>+{qty}</strong> added to <strong>{product.name}</strong>
            <br />
            <span className="text-sm opacity-75">New stock: {newQuantity}</span>
          </div>,
          { duration: 2000 }
        );

        await loadProducts();
      } catch (e) {
        console.error('Error updating stock:', e);
        toast.error(e.message || 'Failed to update stock');
      }
    } else {
      // Product not found - open add product modal with barcode prefilled
      setPrefilledBarcode(barcode);
      setSelectedProduct(null);
      setIsModalOpen(true);
      toast('New barcode detected! Add this product.', { icon: '📦', duration: 3000 });
    }

    // Clear the barcode input
    setStockModeBarcode('');
    if (stockModeBarcodeRef.current) {
      stockModeBarcodeRef.current.focus();
    }
  };

  // Handle stock mode barcode input
  const handleStockModeBarcodeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleStockModeBarcodeScan(stockModeBarcode.trim());
    }
  };

  // Toggle stock mode
  const toggleStockMode = () => {
    setStockMode(!stockMode);
    if (!stockMode) {
      // Entering stock mode - focus the barcode input
      setTimeout(() => {
        if (stockModeBarcodeRef.current) {
          stockModeBarcodeRef.current.focus();
        }
      }, 100);
      toast.success('Stock Mode enabled! Scan barcodes to add quantity.', { duration: 3000, icon: '📦' });
    } else {
      toast('Stock Mode disabled', { duration: 2000 });
    }
  };

  const handleExportProducts = () => {
    try {
      const filename = exportProductsToExcel(safeProducts);
      toast.success(`Products exported successfully: ${filename}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export products: ' + (error.message || 'Unknown error'));
    }
  };

  const handleImportProducts = async (productsToImport) => {
    try {
      let successCount = 0;
      let errorCount = 0;

      for (const product of productsToImport) {
        try {
          // Map imported product shape to API payload shape
          const payload = {
            name: product.name,
            description: product.description || '',
            category: product.category || product.category_name || '',
            price: product.price,
            cost: product.cost || 0,
            quantity: product.quantity,
            lowStockThreshold: product.lowStockThreshold ?? product.low_stock_threshold ?? 0,
            reorderPoint: product.reorderPoint ?? product.lowStockThreshold ?? product.low_stock_threshold ?? 15,
            barcode: product.barcode || null,
            imageUrl: product.imageUrl || product.image_url || null,
          };

          await productService.create(payload);
          successCount++;
        } catch (error) {
          console.error(`Failed to import product ${product.name}:`, error);
          errorCount++;
        }
      }

      // Refresh products list
      await loadProducts();
      refreshBarcodeProducts();

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} product(s)`);
      }
      if (errorCount > 0) {
        toast.error(`Failed to import ${errorCount} product(s)`);
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast.error('Failed to import products: ' + (error.message || 'Unknown error'));
    }
  };

  const getStockStatus = (product) => {
    if (product.quantity <= 0) return {
      status: 'Out of Stock',
      color: 'text-red-700 dark:text-red-300',
      bg: 'bg-red-100 dark:bg-red-900'
    };
    if (product.quantity <= lowStockThreshold) return {
      status: 'Low Stock',
      color: 'text-amber-700 dark:text-amber-300',
      bg: 'bg-amber-100 dark:bg-amber-900'
    };
    return {
      status: 'In Stock',
      color: 'text-green-700 dark:text-green-300',
      bg: 'bg-green-100 dark:bg-green-900'
    };
  };

  // Ensure products is always an array
  const safeProducts = Array.isArray(products) ? products : [];
  console.log('Current products:', safeProducts);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to first page when search changes
    }, 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters.category, filters.stockStatus]);

  const filteredProducts = safeProducts.filter(product => {
    // Search filter
    if (debouncedSearch && !product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
      !product.barcode?.toLowerCase().includes(debouncedSearch.toLowerCase())) {
      return false;
    }

    // Category filter
    if (filters.category && product.category_name !== filters.category) return false;

    // Stock status filter
    if (filters.stockStatus) {
      if (filters.stockStatus === 'inStock' && product.quantity <= 0) return false;
      if (filters.stockStatus === 'outOfStock' && product.quantity > 0) return false;
      if (filters.stockStatus === 'lowStock' && (product.quantity <= 0 || product.quantity > lowStockThreshold)) return false;
    }

    return true;
  });

  // Sort products based on sort mode
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortMode === 'outOfStock') {
      // Out of stock first, then low stock, then in stock
      const aOutOfStock = a.quantity <= 0;
      const bOutOfStock = b.quantity <= 0;
      const aLowStock = a.quantity > 0 && a.quantity <= lowStockThreshold;
      const bLowStock = b.quantity > 0 && b.quantity <= lowStockThreshold;

      if (aOutOfStock && !bOutOfStock) return -1;
      if (!aOutOfStock && bOutOfStock) return 1;
      if (aLowStock && !bLowStock && !bOutOfStock) return -1;
      if (!aLowStock && bLowStock && !aOutOfStock) return 1;

      // If same category, sort by quantity ascending
      return a.quantity - b.quantity;
    } else if (sortMode === 'lowStock') {
      // Low stock first (but not out of stock)
      const aLowStock = a.quantity > 0 && a.quantity <= lowStockThreshold;
      const bLowStock = b.quantity > 0 && b.quantity <= lowStockThreshold;
      const aOutOfStock = a.quantity <= 0;
      const bOutOfStock = b.quantity <= 0;

      if (aLowStock && !bLowStock && !bOutOfStock) return -1;
      if (!aLowStock && bLowStock && !aOutOfStock) return 1;
      if (aOutOfStock && !bOutOfStock) return 1;
      if (!aOutOfStock && bOutOfStock) return -1;
      if (aLowStock && bLowStock) return a.quantity - b.quantity;

      return 0;
    } else if (sortMode === 'inStock') {
      // In stock first, sorted by quantity descending
      const aInStock = a.quantity > lowStockThreshold;
      const bInStock = b.quantity > lowStockThreshold;

      if (aInStock && !bInStock) return -1;
      if (!aInStock && bInStock) return 1;

      // If both in stock, sort by quantity descending (highest first)
      if (aInStock && bInStock) return b.quantity - a.quantity;

      return 0;
    }

    // Default: natural/numeric alphabetical order by product name
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const getUniqueCategories = () => {
    const categories = safeProducts.map(p => p.category_name).filter(Boolean);
    return [...new Set(categories)];
  };

  const getInventoryStats = () => {
    const totalProducts = sortedProducts.length;
    const lowStock = sortedProducts.filter(p => p.quantity > 0 && p.quantity <= lowStockThreshold).length;
    const outOfStock = sortedProducts.filter(p => p.quantity <= 0).length;
    const inStock = totalProducts - outOfStock - lowStock;

    return { totalProducts, lowStock, outOfStock, inStock };
  };

  const stats = getInventoryStats();

  // Pagination calculations
  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = sortedProducts.slice(startIndex, endIndex);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const VerticalPagination = () => {
    if (totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 7;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex flex-col gap-3 sticky top-24">
        {/* Page Navigator */}
        <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-3`}>
          <div className="flex flex-col space-y-2">
            <div className={`text-xs font-medium ${colors.text.secondary} text-center mb-2`}>
              Page {currentPage} of {totalPages}
            </div>

            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg transition-all duration-200 ${currentPage === 1
                ? `${colors.text.tertiary} cursor-not-allowed opacity-50`
                : `${colors.text.secondary} hover:${colors.bg.secondary}`
                }`}
              title="Previous page"
            >
              <ChevronLeftIcon className="h-5 w-5 mx-auto rotate-90" />
            </button>

            {startPage > 1 && (
              <>
                <button
                  onClick={() => goToPage(1)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${colors.text.secondary} hover:${colors.bg.secondary}`}
                >
                  1
                </button>
                {startPage > 2 && (
                  <div className={`text-center ${colors.text.tertiary}`}>⋮</div>
                )}
              </>
            )}

            {pageNumbers.map(page => (
              <button
                key={page}
                onClick={() => goToPage(page)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${currentPage === page
                  ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md'
                  : `${colors.text.secondary} hover:${colors.bg.secondary}`
                  }`}
              >
                {page}
              </button>
            ))}

            {endPage < totalPages && (
              <>
                {endPage < totalPages - 1 && (
                  <div className={`text-center ${colors.text.tertiary}`}>⋮</div>
                )}
                <button
                  onClick={() => goToPage(totalPages)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${colors.text.secondary} hover:${colors.bg.secondary}`}
                >
                  {totalPages}
                </button>
              </>
            )}

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`p-2 rounded-lg transition-all duration-200 ${currentPage === totalPages
                ? `${colors.text.tertiary} cursor-not-allowed opacity-50`
                : `${colors.text.secondary} hover:${colors.bg.secondary}`
                }`}
              title="Next page"
            >
              <ChevronRightIcon className="h-5 w-5 mx-auto -rotate-90" />
            </button>
          </div>
        </div>

        {/* Bulk Actions - Shows when products are selected */}
        {selectedProducts.length > 0 && (
          <div className={`${colors.card.primary} rounded-2xl shadow-sm border-2 border-blue-500 dark:border-blue-400 p-3`}>
            <div className="flex flex-col gap-2">
              {hasPermission('delete_product') && (
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="relative w-full p-2.5 bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-600 rounded-lg transition-all duration-200 flex items-center justify-center"
                  title={`Delete ${selectedProducts.length} selected product(s)`}
                >
                  <TrashIcon className="h-5 w-5" />
                  <span className="absolute -top-2 -right-2 bg-white dark:bg-slate-800 text-red-600 dark:text-red-400 text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-red-600 dark:border-red-400">
                    {selectedProducts.length}
                  </span>
                </button>
              )}

              <button
                onClick={() => setSelectedProducts([])}
                className={`w-full p-2.5 rounded-lg transition-all duration-200 flex items-center justify-center ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
                title="Clear selection"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ProductCard = ({ product }) => {
    const stockInfo = getStockStatus(product);
    const isSelected = selectedProducts.includes(product.id);

    return (
      <div
        className={`${colors.card.primary} rounded-2xl shadow-sm border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500' : colors.border.primary
          } overflow-hidden hover:shadow-lg transition-all duration-300 group relative ${selectedProducts.length > 0 ? 'cursor-pointer' : ''
          }`}
        onClick={() => {
          if (selectedProducts.length > 0) {
            toggleProductSelection(product.id);
          }
        }}
      >
        {/* Selection Checkbox */}
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleProductSelection(product.id)}
            className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        </div>

        {/* Product Image - Fixed height with object-contain for uniform display */}
        <div className="relative h-48 bg-white dark:bg-slate-800 flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <AsyncImage
              src={product.imageUrl}
              alt={product.name}
              className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              fallback={
                <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
                  <CubeIcon className="h-16 w-16 text-slate-400 dark:text-slate-500" />
                </div>
              }
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center">
              <CubeIcon className="h-16 w-16 text-slate-400 dark:text-slate-500" />
            </div>
          )}

          {/* Stock Status Badge - Bottom Right of Image */}
          <div className="absolute bottom-3 right-3 z-20">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full shadow-sm ${stockInfo.bg} ${stockInfo.color}`}>
              {stockInfo.status}
            </span>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-6 flex flex-col">
          {/* Product Name & Category */}
          <div className="mb-4">
            <h3 className={`font-semibold ${colors.text.primary} text-lg mb-1 line-clamp-2 min-h-[3.5rem]`}>{product.name}</h3>
            <p className={`text-sm ${colors.text.secondary}`}>{product.category_name || 'Uncategorized'}</p>
          </div>

          {/* Price & Stock */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className={`text-sm ${colors.text.secondary} mb-1`}>Price</p>
              <p className={`font-semibold ${colors.text.primary}`}>{formatCurrency(parseFloat(product.price || 0))}</p>
            </div>
            <div>
              <p className={`text-sm ${colors.text.secondary} mb-1`}>Stock</p>
              <p className={`font-semibold ${stockInfo.color}`}>
                {product.quantity || 0}
                {product.quantity <= (product.lowStockThreshold || 10) && (
                  <ExclamationTriangleIcon className="inline h-4 w-4 ml-1" />
                )}
              </p>
            </div>
          </div>

          {/* Barcode - Always takes up space for consistency */}
          <div className={`mb-4 p-3 rounded-lg min-h-[3.25rem] flex flex-col justify-center ${product.barcode ? colors.bg.secondary : 'transparent'
            }`}>
            {product.barcode ? (
              <>
                <p className={`text-xs ${colors.text.secondary} mb-0.5`}>Barcode</p>
                <p className={`font-mono text-sm ${colors.text.primary}`}>{product.barcode}</p>
              </>
            ) : (
              <p className={`text-xs ${colors.text.tertiary} text-center`}>No barcode</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            {hasPermission('adjust_stock') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openStockAdjustment(product);
                }}
                className="p-2.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors flex items-center justify-center col-span-2"
                title="Stock Adjustment"
              >
                <ScaleIcon className="h-5 w-5 inline mr-1" /> Adjust
              </button>
            )}
            {hasPermission('edit_product') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProduct(product);
                  setIsModalOpen(true);
                }}
                className={`p-2.5 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center ${hasPermission('delete_product') ? '' : 'col-span-2'}`}
                title="Edit Product"
              >
                <PencilIcon className="h-5 w-5 inline mr-1" /> Edit
              </button>
            )}
            {hasPermission('delete_product') && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProduct(product.id);
                }}
                className={`p-2.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center ${hasPermission('edit_product') ? '' : 'col-span-2'}`}
                title="Delete Product"
              >
                <TrashIcon className="h-5 w-5 inline mr-1" /> Delete
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TableView = () => (
    <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y ${colors.border.primary}`}>
          <thead className={`${colors.bg.secondary}`}>
            <tr>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider w-12`}>
                <input
                  type="checkbox"
                  checked={selectedProducts.length === paginatedProducts.length && paginatedProducts.length > 0}
                  onChange={toggleSelectAll}
                  className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                />
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Product
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Category
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Price
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Stock
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Status
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
            {paginatedProducts.map((product) => {
              const stockInfo = getStockStatus(product);
              const isSelected = selectedProducts.includes(product.id);
              return (
                <tr key={product.id} className={`hover:${colors.bg.secondary} transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleProductSelection(product.id)}
                      className="w-5 h-5 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {product.imageUrl ? (
                          <AsyncImage
                            src={product.imageUrl}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover"
                            fallback={
                              <div className={`h-10 w-10 ${colors.bg.secondary} rounded-lg flex items-center justify-center`}>
                                <CubeIcon className={`h-6 w-6 ${colors.text.tertiary}`} />
                              </div>
                            }
                          />
                        ) : (
                          <div className={`h-10 w-10 ${colors.bg.secondary} rounded-lg flex items-center justify-center`}>
                            <CubeIcon className={`h-6 w-6 ${colors.text.tertiary}`} />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className={`text-sm font-medium ${colors.text.primary}`}>{product.name}</div>
                        {product.barcode && (
                          <div className={`text-sm ${colors.text.secondary}`}>{product.barcode}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                    {product.category_name || 'Uncategorized'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                    {formatCurrency(parseFloat(product.price || 0))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={stockInfo.color}>
                      {product.quantity || 0}
                      {product.quantity <= (product.lowStockThreshold || 10) && (
                        <ExclamationTriangleIcon className="inline h-4 w-4 ml-1" />
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${stockInfo.bg} ${stockInfo.color}`}>
                      {stockInfo.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {hasPermission('adjust_stock') && (
                        <button
                          onClick={() => openStockAdjustment(product)}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-900 dark:hover:text-purple-300 transition-colors p-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          title="Stock Adjustment"
                        >
                          <ScaleIcon className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission('edit_product') && (
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="Edit Product"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                      )}
                      {hasPermission('delete_product') && (
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Delete Product"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-6"></div>
          <p className={`text-lg font-medium ${colors.text.primary}`}>Loading inventory...</p>
          <p className={`text-sm ${colors.text.secondary} mt-2`}>Please wait while we fetch your products</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <button
          onClick={() => {
            setSortMode(sortMode === null ? null : null);
            setCurrentPage(1);
          }}
          className={`bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white text-left transition-all duration-200 hover:shadow-lg hover:scale-105 ${sortMode === null ? 'ring-4 ring-blue-300' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Products</p>
              <p className="text-3xl font-bold">{stats.totalProducts}</p>
            </div>
            <CubeIcon className="h-10 w-10 text-blue-200" />
          </div>
        </button>

        <button
          onClick={() => {
            setSortMode(sortMode === 'inStock' ? null : 'inStock');
            setCurrentPage(1);
          }}
          className={`bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white text-left transition-all duration-200 hover:shadow-lg hover:scale-105 ${sortMode === 'inStock' ? 'ring-4 ring-green-300' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">In Stock</p>
              <p className="text-3xl font-bold">{stats.inStock}</p>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-green-200" />
          </div>
        </button>

        <button
          onClick={() => {
            setSortMode(sortMode === 'lowStock' ? null : 'lowStock');
            setCurrentPage(1);
          }}
          className={`bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white text-left transition-all duration-200 hover:shadow-lg hover:scale-105 ${sortMode === 'lowStock' ? 'ring-4 ring-amber-300' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Low Stock</p>
              <p className="text-3xl font-bold">{stats.lowStock}</p>
            </div>
            <ExclamationTriangleIcon className="h-10 w-10 text-amber-200" />
          </div>
        </button>

        <button
          onClick={() => {
            setSortMode(sortMode === 'outOfStock' ? null : 'outOfStock');
            setCurrentPage(1);
          }}
          className={`bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 text-white text-left transition-all duration-200 hover:shadow-lg hover:scale-105 ${sortMode === 'outOfStock' ? 'ring-4 ring-red-300' : ''}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Out of Stock</p>
              <p className="text-3xl font-bold">{stats.outOfStock}</p>
            </div>
            <XCircleIcon className="h-10 w-10 text-red-200" />
          </div>
        </button>
      </div>

      {/* Actions Bar */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          {/* Left side - Search */}
          <div className="flex-1 max-w-md lg:mr-4">
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${colors.text.tertiary}`} />
              <input
                type="text"
                placeholder="Search products, barcodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all duration-200 ${colors.input.primary}`}
              />
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${showFilters
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                : `${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`
                }`}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              <span>Filters</span>
            </button>

            <div className={`flex items-center rounded-xl p-1 ${colors.bg.tertiary}`}>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'grid'
                  ? `${colors.card.primary} text-blue-600 dark:text-blue-400 shadow-sm`
                  : `${colors.text.secondary} hover:${colors.text.primary}`
                  }`}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'table'
                  ? `${colors.card.primary} text-blue-600 dark:text-blue-400 shadow-sm`
                  : `${colors.text.secondary} hover:${colors.text.primary}`
                  }`}
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>

            {reorderSuggestions.length > 0 && (
              <button
                onClick={() => setShowReorderPanel(!showReorderPanel)}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 relative ${showReorderPanel
                  ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400'
                  : `${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`
                  }`}
                title="View reorder suggestions"
              >
                <ExclamationTriangleIcon className="h-5 w-5" />
                <span>Reorder ({reorderSuggestions.length})</span>
                {reorderSuggestions.filter(p => p.stockoutRisk === 'critical').length > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </button>
            )}

            <button
              onClick={loadProducts}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
            >
              <ArrowPathIcon className="h-5 w-5" />
              <span>Refresh</span>
            </button>

            {hasPermission('adjust_stock') && (
              <button
                onClick={toggleStockMode}
                className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${stockMode
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : `${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`
                  }`}
                title="Stock Mode - Scan barcodes to quickly add stock"
              >
                <QrCodeIcon className="h-5 w-5" />
                <span>Stock Mode</span>
              </button>
            )}

            <button
              onClick={handleExportProducts}
              className="p-2 bg-teal-600 dark:bg-teal-500 text-white hover:bg-teal-700 dark:hover:bg-teal-600 rounded-xl transition-all duration-200 relative group"
              title="Export Products to Excel"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                Export Products
              </span>
            </button>

            {hasPermission('add_product') && (
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="p-2 bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 rounded-xl transition-all duration-200 relative group"
                title="Import Products from Excel"
              >
                <ArrowUpTrayIcon className="h-5 w-5" />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  Import Products
                </span>
              </button>
            )}

            {hasPermission('add_product') && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2"
              >
                <PlusIcon className="h-5 w-5" />
                <span>Add Product</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className={`mt-6 pt-6 border-t ${colors.border.primary}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({ ...filters, category: e.target.value })}
                  className={`w-full p-3 rounded-xl border transition-all duration-200 ${colors.input.primary}`}
                >
                  <option value="">All Categories</option>
                  {getUniqueCategories().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>Stock Status</label>
                <select
                  value={filters.stockStatus}
                  onChange={(e) => setFilters({ ...filters, stockStatus: e.target.value })}
                  className={`w-full p-3 rounded-xl border transition-all duration-200 ${colors.input.primary}`}
                >
                  <option value="">All Status</option>
                  <option value="inStock">In Stock</option>
                  <option value="lowStock">Low Stock</option>
                  <option value="outOfStock">Out of Stock</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ category: '', priceRange: '', stockStatus: '' })}
                  className={`w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reorder Suggestions Panel */}
      {showReorderPanel && reorderSuggestions.length > 0 && (
        <div className={`${colors.card.primary} rounded-2xl shadow-sm border-2 border-orange-500 dark:border-orange-400 p-6`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${colors.text.primary}`}>Reorder Suggestions</h3>
                <p className={`text-sm ${colors.text.secondary}`}>
                  {reorderSuggestions.length} product{reorderSuggestions.length > 1 ? 's' : ''} need{reorderSuggestions.length === 1 ? 's' : ''} attention
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReorderPanel(false)}
              className={`p-2 rounded-lg hover:${colors.bg.secondary}`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reorderSuggestions.slice(0, 9).map((suggestion) => (
              <div
                key={suggestion.id}
                className={`p-4 rounded-xl border-2 ${suggestion.stockoutRisk === 'critical'
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/10'
                  : suggestion.stockoutRisk === 'high'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                    : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/10'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className={`font-semibold ${colors.text.primary} line-clamp-2`}>{suggestion.name}</h4>
                    <p className={`text-xs ${colors.text.secondary}`}>{suggestion.category_name}</p>
                  </div>
                  <span className={`ml-2 px-2 py-1 text-xs font-bold rounded-full ${suggestion.stockoutRisk === 'critical'
                    ? 'bg-red-600 text-white'
                    : suggestion.stockoutRisk === 'high'
                      ? 'bg-orange-600 text-white'
                      : 'bg-yellow-600 text-white'
                    }`}>
                    {suggestion.stockoutRisk.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className={`text-sm ${colors.text.secondary}`}>Current:</span>
                    <span className={`text-sm font-bold ${colors.text.primary}`}>{suggestion.quantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`text-sm ${colors.text.secondary}`}>Avg Daily Sales:</span>
                    <span className={`text-sm font-medium ${colors.text.primary}`}>{suggestion.avgDailySales}</span>
                  </div>
                  {suggestion.daysUntilStockout !== null && (
                    <div className="flex justify-between">
                      <span className={`text-sm ${colors.text.secondary}`}>Days to stockout:</span>
                      <span className={`text-sm font-bold text-red-600 dark:text-red-400`}>
                        {Math.max(0, suggestion.daysUntilStockout)} days
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t ${colors.border.primary}">
                    <span className={`text-sm font-medium ${colors.text.secondary}`}>Suggested Reorder:</span>
                    <span className={`text-sm font-bold text-blue-600 dark:text-blue-400`}>{suggestion.suggestedReorderQty} units</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    navigate('/inventory/purchase-orders');
                    toast('Opening Purchase Orders...', { icon: '📦' });
                  }}
                  className="w-full mt-3 px-3 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 text-sm font-medium transition-colors"
                >
                  Create Purchase Order
                </button>
              </div>
            ))}
          </div>

          {reorderSuggestions.length > 9 && (
            <div className={`mt-4 text-center text-sm ${colors.text.secondary}`}>
              + {reorderSuggestions.length - 9} more products need reordering
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {filteredProducts.length === 0 ? (
        <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-12 text-center`}>
          <CubeIcon className={`h-16 w-16 mx-auto mb-4 ${colors.text.tertiary}`} />
          <h3 className={`text-xl font-semibold mb-2 ${colors.text.primary}`}>No products found</h3>
          <p className={`mb-6 ${colors.text.secondary}`}>
            {searchTerm || filters.category || filters.stockStatus
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first product'
            }
          </p>
          {hasPermission('add_product') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 mx-auto"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add Product</span>
            </button>
          )}
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Vertical Pagination - Hidden on mobile */}
          <div className="hidden lg:block flex-shrink-0">
            <VerticalPagination />
          </div>

          {/* Products Grid/Table */}
          <div className="flex-1">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {paginatedProducts.map(product => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <TableView />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {isModalOpen && (
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProduct(null);
            setPrefilledBarcode('');
          }}
          onSave={selectedProduct ? handleEditProduct : handleAddProduct}
          product={selectedProduct}
          prefilledBarcode={prefilledBarcode}
        />
      )}

      {isAuditModalOpen && (
        <InventoryAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          onComplete={handleAuditComplete}
          products={safeProducts}
        />
      )}

      {isImportModalOpen && (
        <ImportProductsModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImport={handleImportProducts}
          existingProducts={safeProducts}
        />
      )}

      {isQuickStockOpen && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${colors.border.primary}`}>
              <div>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Quick Stock</h3>
                <p className={`text-sm ${colors.text.secondary}`}>{selectedProduct.name}</p>
              </div>
              <button onClick={() => setIsQuickStockOpen(false)} className={`p-2 rounded-lg hover:${colors.bg.secondary}`}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setQuickStockType('in')} className={`px-3 py-2 rounded-lg border text-sm font-medium ${quickStockType === 'in' ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : colors.input.primary}`}>Stock In</button>
                <button onClick={() => setQuickStockType('out')} className={`px-3 py-2 rounded-lg border text-sm font-medium ${quickStockType === 'out' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300' : colors.input.primary}`}>Stock Out</button>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text.primary}`}>Quantity</label>
                <input type="number" min="1" value={quickStockQty} onChange={(e) => setQuickStockQty(e.target.value)} className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setIsQuickStockOpen(false)} className={`px-4 py-2 rounded-lg ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}>Cancel</button>
                <button onClick={submitQuickStock} className={`px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600`}>Apply</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isStockAdjustmentOpen && selectedProduct && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-lg`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${colors.border.primary}`}>
              <div>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Stock Adjustment</h3>
                <p className={`text-sm ${colors.text.secondary}`}>{selectedProduct.name}</p>
              </div>
              <button onClick={() => setIsStockAdjustmentOpen(false)} className={`p-2 rounded-lg hover:${colors.bg.secondary}`}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Current Stock Display */}
              <div className={`p-4 rounded-lg ${colors.bg.secondary} border ${colors.border.primary}`}>
                <p className={`text-sm ${colors.text.secondary}`}>Current Stock</p>
                <p className={`text-3xl font-bold ${colors.text.primary}`}>{selectedProduct.quantity || 0}</p>
              </div>

              {/* Adjustment Type */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>Adjustment Type</label>
                <select
                  value={adjustmentData.type}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, type: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
                >
                  <option value="physical_count">Physical Count</option>
                  <option value="damage">Damage/Defective</option>
                  <option value="loss">Loss/Theft</option>
                  <option value="found">Found/Recovered</option>
                  <option value="correction">Manual Correction</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* New Quantity */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                  New Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  value={adjustmentData.newQuantity}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, newQuantity: e.target.value })}
                  className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
                />
                {/* Show difference */}
                {adjustmentData.newQuantity !== selectedProduct.quantity && (
                  <p className={`text-sm mt-1 ${parseInt(adjustmentData.newQuantity) > selectedProduct.quantity
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                    }`}>
                    {parseInt(adjustmentData.newQuantity) > selectedProduct.quantity ? '+' : ''}
                    {parseInt(adjustmentData.newQuantity || 0) - selectedProduct.quantity} units
                  </p>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                  Reason {adjustmentData.type === 'other' && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={adjustmentData.reason}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                  placeholder={adjustmentData.type === 'other' ? 'Please provide a reason (required)' : 'e.g., Physical inventory count, damaged goods, etc. (optional)'}
                  className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
                />
                {adjustmentData.type === 'other' && (
                  <p className={`text-xs mt-1 ${colors.text.secondary}`}>
                    Reason is required when adjustment type is "Other"
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>Notes (Optional)</label>
                <textarea
                  value={adjustmentData.notes}
                  onChange={(e) => setAdjustmentData({ ...adjustmentData, notes: e.target.value })}
                  placeholder="Additional details about this adjustment..."
                  rows="3"
                  className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
                />
              </div>
            </div>

            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-3`}>
              <button
                onClick={() => setIsStockAdjustmentOpen(false)}
                className={`px-4 py-2 rounded-lg ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
              >
                Cancel
              </button>
              <button
                onClick={submitStockAdjustment}
                className="px-4 py-2 rounded-lg bg-purple-600 dark:bg-purple-500 text-white hover:bg-purple-700 dark:hover:bg-purple-600 inline-flex items-center gap-2"
              >
                <ScaleIcon className="h-5 w-5" />
                Submit Adjustment
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowBulkDeleteModal(false)}>
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Delete Multiple Products</h3>
              <p className={`text-sm ${colors.text.secondary} mt-1`}>
                Are you sure you want to delete the selected products?
              </p>
            </div>

            <div className="px-6 py-4">
              <div className={`p-4 rounded-lg ${colors.bg.secondary} mb-4`}>
                <p className={`text-sm font-medium ${colors.text.primary}`}>
                  {selectedProducts.length} product(s) selected for deletion
                </p>
              </div>

              <div className={`p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800`}>
                <p className={`text-sm text-amber-800 dark:text-amber-300`}>
                  <strong>Note:</strong> Deleted products will be removed from your inventory. Products that have been used in transactions will be marked as deleted but preserved for record keeping.
                </p>
              </div>
            </div>

            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 inline-flex items-center gap-2"
              >
                <TrashIcon className="h-5 w-5" />
                Delete {selectedProducts.length} Product(s)
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Stock Mode Floating Panel */}
      {stockMode && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className={`${colors.card.primary} rounded-2xl shadow-2xl border-2 border-green-500 p-4 w-80`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <QrCodeIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className={`font-semibold ${colors.text.primary}`}>Stock Mode</h3>
                  <p className={`text-xs ${colors.text.secondary}`}>Scan barcode to add stock</p>
                </div>
              </div>
              <button
                onClick={toggleStockMode}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <XMarkIcon className={`h-5 w-5 ${colors.text.secondary}`} />
              </button>
            </div>

            <div className="space-y-3">
              {/* Quantity per scan */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>
                  Quantity per scan
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setStockModeQty(Math.max(1, stockModeQty - 1))}
                    className={`p-2 rounded-lg ${colors.bg.secondary} hover:${colors.bg.tertiary}`}
                  >
                    <MinusIcon className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    value={stockModeQty}
                    onChange={(e) => setStockModeQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className={`w-20 text-center border rounded-lg px-3 py-2 ${colors.input.primary}`}
                    min="1"
                  />
                  <button
                    onClick={() => setStockModeQty(stockModeQty + 1)}
                    className={`p-2 rounded-lg ${colors.bg.secondary} hover:${colors.bg.tertiary}`}
                  >
                    <ArrowUpIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Barcode input */}
              <div>
                <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>
                  Scan or enter barcode
                </label>
                <input
                  ref={stockModeBarcodeRef}
                  type="text"
                  value={stockModeBarcode}
                  onChange={(e) => setStockModeBarcode(e.target.value)}
                  onKeyDown={handleStockModeBarcodeKeyDown}
                  placeholder="Scan barcode here..."
                  className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-green-500`}
                  autoFocus
                />
              </div>

              <div className={`text-xs ${colors.text.tertiary} text-center`}>
                Press Enter after scanning to add stock
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Single Product Delete Confirmation Modal ── */}
      {productToDelete && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${colors.card.primary} rounded-2xl shadow-2xl max-w-md w-full overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b border-red-100 dark:border-red-900/30">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Delete Product</h3>
                <p className={`text-sm ${colors.text.secondary}`}>This action cannot be undone</p>
              </div>
              <button
                onClick={() => setProductToDelete(null)}
                className={`p-2 rounded-lg ${colors.text.tertiary} hover:${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Product details */}
            <div className="p-6">
              <div className={`${colors.bg.secondary} rounded-xl p-4 mb-5`}>
                <p className={`text-xs font-medium ${colors.text.secondary} uppercase tracking-wider mb-1`}>Product</p>
                <p className={`font-semibold ${colors.text.primary} text-base truncate`}>{productToDelete.name}</p>
                {productToDelete.category_name && (
                  <p className={`text-sm ${colors.text.secondary} mt-0.5`}>{productToDelete.category_name}</p>
                )}
              </div>

              {/* Warning */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">Warning</p>
                    <ul className="text-sm text-red-700 dark:text-red-400 mt-1 space-y-1 list-disc pl-4">
                      <li>Product will be permanently removed</li>
                      <li>All associated data will be deleted</li>
                      <li>This action cannot be reversed</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setProductToDelete(null)}
                  className={`flex-1 px-4 py-2.5 border ${colors.border.primary} rounded-xl text-sm font-medium ${colors.text.secondary} hover:${colors.bg.secondary} transition-all duration-200`}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteProduct}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete Product
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ── Bulk Delete Confirmation Modal ── */}
      {showBulkDeleteModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${colors.card.primary} rounded-2xl shadow-2xl max-w-md w-full overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center gap-4 p-6 border-b border-red-100 dark:border-red-900/30">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <TrashIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Delete Products</h3>
                <p className={`text-sm ${colors.text.secondary}`}>This action cannot be undone</p>
              </div>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                className={`p-2 rounded-lg ${colors.text.tertiary} hover:${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Count details */}
            <div className="p-6">
              <div className={`${colors.bg.secondary} rounded-xl p-4 mb-5`}>
                <p className={`text-xs font-medium ${colors.text.secondary} uppercase tracking-wider mb-1`}>Selected</p>
                <p className={`font-semibold ${colors.text.primary} text-base`}>
                  {selectedProducts.length} product{selectedProducts.length !== 1 ? 's' : ''} selected for deletion
                </p>
              </div>

              {/* Warning */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
                <div className="flex gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">Warning</p>
                    <ul className="text-sm text-red-700 dark:text-red-400 mt-1 space-y-1 list-disc pl-4">
                      <li>All selected products will be permanently removed</li>
                      <li>All associated data will be deleted</li>
                      <li>This action cannot be reversed</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowBulkDeleteModal(false)}
                  className={`flex-1 px-4 py-2.5 border ${colors.border.primary} rounded-xl text-sm font-medium ${colors.text.secondary} hover:${colors.bg.secondary} transition-all duration-200`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-lg shadow-red-600/20 flex items-center justify-center gap-2"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete {selectedProducts.length} Product{selectedProducts.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default InventoryScreen; 