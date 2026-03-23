import { useState, useEffect, useRef, useCallback, memo, useMemo, startTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { productService, transactionService } from '../../services/api';
import { useGlobalBarcode } from '../../context/BarcodeContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth, usePermissions } from '../../context/AuthContext';
import { MagnifyingGlassIcon, XMarkIcon, ShoppingCartIcon, BanknotesIcon, CameraIcon, ReceiptPercentIcon, TrashIcon } from '@heroicons/react/24/outline';
import AsyncImage, { preloadImages } from '../common/AsyncImage';
import { useSettings } from '../../context/SettingsContext';
import { formatCurrency } from '../../utils/formatters';
import { printerService } from '../../utils/printerService';
import AdminOverrideModal from '../common/AdminOverrideModal';
import { useNavigationBlocker } from '../../context/NavigationBlockerContext';

const BARCODE_ENTER_SUPPRESSION_MS = 500;

const POSScreen = () => {
  const { t, settings } = useSettings();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const { blockNavigation } = useNavigationBlocker();

  const [cart, setCart] = useState([]);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideAction, setOverrideAction] = useState(null);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [visibleProductCount, setVisibleProductCount] = useState(80);
  const [discount, setDiscount] = useState({ type: 'none', percentage: 0 });
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showDiscountPasswordModal, setShowDiscountPasswordModal] = useState(false);
  const [customDiscountInput, setCustomDiscountInput] = useState('');
  const [showRestartPasswordModal, setShowRestartPasswordModal] = useState(false);
  const [showRestartConfirmation, setShowRestartConfirmation] = useState(false);
  const [autoPrintReceipt, setAutoPrintReceipt] = useState(() => {
    // Load from localStorage, default to true for backward compatibility
    try {
      const saved = localStorage.getItem('autoPrintReceipt');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const [isPrinterReady, setIsPrinterReady] = useState(true);
  const hasDesktopPrinterBridge =
    typeof window !== 'undefined' &&
    typeof window.printer?.getStatus === 'function';

  const location = useLocation();
  const { barcodeData, clearBarcodeData } = useGlobalBarcode();
  const processedBarcodeRef = useRef(null);
  const cartEndRef = useRef(null);
  const prevCartLengthRef = useRef(0);
  const lastNavigationProductRef = useRef(null);
  const lastScannerInteractionRef = useRef(0);
  const lastTransactionTimeRef = useRef(null);
  const lastTransactionCounterRef = useRef(0);

  const productsById = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      if (product?.id != null) {
        map.set(product.id, product);
      }
    });
    return map;
  }, [products]);

  const getAvailableStock = useCallback((productId, fallbackQuantity = 0) => {
    if (!productId) return fallbackQuantity;
    const product = productsById.get(productId);
    if (typeof product?.quantity === 'number') {
      return product.quantity;
    }
    return fallbackQuantity;
  }, [productsById]);

  const getProductSnapshot = useCallback((product) => {
    if (!product?.id) return product;
    return productsById.get(product.id) ?? product;
  }, [productsById]);

  const getTransactionId = useCallback(async () => {
    try {
      const response = await transactionService.generateId();
      if (response?.id) {
        return response.id;
      }
    } catch (error) {
      console.warn('Failed to fetch transaction ID from server, falling back', error);
    }

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const stamp = `${month}${day}${year}-${hours}${minutes}`;

    if (lastTransactionTimeRef.current === stamp) {
      lastTransactionCounterRef.current += 1;
    } else {
      lastTransactionTimeRef.current = stamp;
      lastTransactionCounterRef.current = 1;
    }

    const suffix = `-${lastTransactionCounterRef.current}`;
    return `TXN-${stamp}${suffix}`;
  }, []);

  // Scroll to bottom whenever items are added or removed from the cart, and handle navigation blocking
  useEffect(() => {
    if (cart.length > prevCartLengthRef.current && cartEndRef.current) {
      cartEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    prevCartLengthRef.current = cart.length;

    // Block navigation if cart has items
    const hasItems = cart.length > 0;
    blockNavigation(hasItems);

    const handleBeforeUnload = (e) => {
      if (hasItems) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    if (hasItems) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [cart, blockNavigation]);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    if (!hasDesktopPrinterBridge) {
      return;
    }

    let mounted = true;
    const applyStatus = (status) => {
      if (!mounted) return;
      setIsPrinterReady(!!status?.connected);
    };

    const refreshStatus = () => {
      window.printer.getStatus()
        .then((status) => applyStatus(status))
        .catch(() => applyStatus({ connected: false }));
    };

    refreshStatus();
    const pollId = setInterval(refreshStatus, 2500);
    const unsubscribe = typeof window.printer?.onStatusChange === 'function'
      ? window.printer.onStatusChange((status) => applyStatus(status))
      : () => undefined;

    return () => {
      mounted = false;
      clearInterval(pollId);
      unsubscribe();
    };
  }, [hasDesktopPrinterBridge]);

  // Global key handling for POS: Enter opens checkout, Enter in modal submits if valid, Escape closes modal
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (e.defaultPrevented) {
        return;
      }
      if (e.key === 'Escape') {
        if (showCheckout) {
          e.preventDefault();
          setShowCheckout(false);
        }
        return;
      }
      if (e.key === 'Enter') {
        const now = Date.now();
        if (now - lastScannerInteractionRef.current < BARCODE_ENTER_SUPPRESSION_MS) {
          e.preventDefault();
          return;
        }
        // If modal open, attempt checkout only when eligible
        if (showCheckout) {
          e.preventDefault();
          const total = calculateTotal();
          const canCheckout = !isProcessing && cart.length > 0 && (
            (paymentMethod === 'cash' && parseFloat(receivedAmount || '0') >= total) ||
            (paymentMethod !== 'cash' && referenceNumber.trim().length > 0)
          );
          if (canCheckout) {
            handleCheckout();
          }
        } else {
          // Do not trigger checkout if user is actively typing in an input field (Search, Quantity)
          if (
            document.activeElement &&
            (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
          ) {
            return;
          }

          // Open modal if cart has items
          if (cart.length > 0) {
            e.preventDefault();
            setShowCheckout(true);
          }
        }
      }
    };
    document.addEventListener('keydown', handleGlobalKeys, true);
    return () => document.removeEventListener('keydown', handleGlobalKeys, true);
  }, [showCheckout, cart, isProcessing, paymentMethod, receivedAmount, referenceNumber]);

  // Handle global barcode scanning
  useEffect(() => {
    if (barcodeData && barcodeData.product && barcodeData.timestamp) {
      // Prevent processing the same barcode data twice
      if (processedBarcodeRef.current !== barcodeData.timestamp) {
        console.log('POS: Processing barcode data from context:', barcodeData);
        processedBarcodeRef.current = barcodeData.timestamp;
        handleBarcodeScanned(barcodeData.product);
        clearBarcodeData();
      }
    }
  }, [barcodeData]);

  // Handle product passed from navigation (when coming from other pages via barcode)
  useEffect(() => {
    if (location.state?.barcodeProduct) {
      const product = location.state.barcodeProduct;
      // Prevent processing the same navigation product twice
      if (lastNavigationProductRef.current !== product.id) {
        console.log('POS: Processing product from navigation:', product);
        lastNavigationProductRef.current = product.id;
        handleBarcodeScanned(product);

        // Clear the state to prevent re-adding on page refresh
        const newState = { ...location.state };
        delete newState.barcodeProduct;
        window.history.replaceState(newState, document.title);

        // Reset the navigation ref after a delay to allow quantity increases
        setTimeout(() => {
          lastNavigationProductRef.current = null;
        }, 1000);
      }
    }
  }, [location.state]);

  const loadProducts = async () => {
    try {
      const data = await productService.getAll();
      const productList = data || [];
      setProducts(productList);

      // Preload first 20 product images in the background for faster initial render
      const imageUrls = productList
        .slice(0, 20)
        .map(p => p.imageUrl || p.image_url)
        .filter(Boolean);
      if (imageUrls.length > 0) {
        preloadImages(imageUrls);
      }
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  const addToCart = (product) => {
    if (!product) {
      toast.error('Product data unavailable');
      return false;
    }

    const availableQuantity = getAvailableStock(product.id, product.quantity ?? 0);
    let wasAdded = false;

    startTransition(() => {
      setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id === product.id);
        const currentCartQuantity = existingItem ? existingItem.quantity : 0;
        const nextQuantity = currentCartQuantity + 1;

        if (nextQuantity > availableQuantity) {
          toast.error(`Insufficient stock. Only ${availableQuantity} available.`);
          return prevCart;
        }

        wasAdded = true;

        if (existingItem) {
          return prevCart.map(item =>
            item.id === product.id
              ? { ...item, quantity: nextQuantity }
              : item
          );
        }
        return [...prevCart, { ...product, quantity: 1 }];
      });
    });

    return wasAdded;
  };

  const handleBarcodeScanned = (product) => {
    lastScannerInteractionRef.current = Date.now();
    try {
      console.log('POS: handleBarcodeScanned called with:', product);

      const productData = getProductSnapshot(product);
      if (!productData) {
        toast.error('Product not found');
        return;
      }

      const availableQuantity = getAvailableStock(productData.id, productData.quantity ?? 0);

      if (availableQuantity > 0) {
        const added = addToCart(productData);
        if (added) {
          toast.success(`${productData.name} added to cart!`, {
            icon: '✅',
            duration: 1500
          });
        }
      } else {
        toast.error(`${productData.name} is out of stock`);
      }
    } catch (error) {
      console.error('Error processing barcode in POS:', error);
      toast.error('Error processing barcode');
    }
  };

  const executeRemoveFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const executeUpdateQuantity = (productId, newQuantity) => {
    startTransition(() => {
      setCart(prevCart =>
        prevCart.map(item =>
          item.id === productId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    });
  };

  const removeFromCart = (productId) => {
    if (!hasPermission('void_item')) {
      setOverrideAction({ type: 'remove_item', payload: productId });
      setShowOverrideModal(true);
      return;
    }
    executeRemoveFromCart(productId);
  };

  const updateCartItemQuantity = (productId, newQuantity) => {
    const fallbackQuantity = cart.find(item => item.id === productId)?.quantity ?? 0;

    // If decreasing quantity, check permission
    if (newQuantity < fallbackQuantity && !hasPermission('void_item')) {
      setOverrideAction({ type: 'update_quantity', payload: { productId, newQuantity } });
      setShowOverrideModal(true);
      return;
    }

    if (newQuantity < 1) {
      executeRemoveFromCart(productId);
      return;
    }

    const availableQuantity = getAvailableStock(productId, fallbackQuantity);

    if (newQuantity > availableQuantity) {
      toast.error(`Insufficient stock. Only ${availableQuantity} available.`);
      return;
    }

    executeUpdateQuantity(productId, newQuantity);
  };

  const handleOverrideSuccess = () => {
    if (!overrideAction) return;

    if (overrideAction.type === 'remove_item') {
      executeRemoveFromCart(overrideAction.payload);
    } else if (overrideAction.type === 'update_quantity') {
      const { productId, newQuantity } = overrideAction.payload;
      if (newQuantity < 1) {
        executeRemoveFromCart(productId);
      } else {
        executeUpdateQuantity(productId, newQuantity);
      }
    }
    setOverrideAction(null);
  };

  const calculateSubtotal = () => {
    return cart.reduce(
      (total, item) => total + (parseFloat(item.price || 0) * item.quantity),
      0
    );
  };

  const calculateTax = (subtotal) => {
    const taxRate = settings.taxRate !== undefined ? settings.taxRate : 12; // Get tax rate from settings, default to 12%
    if (taxRate === 0) return 0; // Handle 0% tax explicitly
    return subtotal * (taxRate / 100);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = subtotal * (discount.percentage / 100);
    const discountedSubtotal = subtotal - discountAmount;
    return discountedSubtotal + calculateTax(discountedSubtotal);
  };

  const calculateDiscountAmount = () => {
    return calculateSubtotal() * (discount.percentage / 100);
  };

  const getChange = () => {
    if (receivedAmount) {
      return parseFloat(receivedAmount) - calculateTotal();
    }
    return 0;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const total = calculateTotal();
    let received = parseFloat(receivedAmount);
    if (paymentMethod === 'cash') {
      if (!received || received < total) {
        toast.error('Insufficient payment amount');
        return;
      }
    } else {
      // Card/GCash: require reference number, auto-set received
      if (!referenceNumber.trim()) {
        toast.error('Please enter the reference number');
        return;
      }
      received = total;
    }

    try {
      setIsProcessing(true);

      // Generate transaction ID in requested format
      const transactionId = await getTransactionId();

      // Process transaction with user info for activity logging
      // Create timestamp in local timezone by constructing it directly
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

      // Create ISO-like string but without timezone indicator (will be treated as local)
      const localTimestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;

      const transactionData = {
        id: transactionId,
        timestamp: localTimestamp,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          category: item.category || item.category_name || 'Uncategorized',
          price: parseFloat(item.price || 0),
          cost: parseFloat(item.cost || 0),
          quantity: item.quantity,
          subtotal: parseFloat(item.price || 0) * item.quantity
        })),
        subtotal: calculateSubtotal(),
        tax: calculateTax(calculateSubtotal() - calculateDiscountAmount()),
        total: calculateTotal(),
        paymentMethod,
        receivedAmount: received,
        change: paymentMethod === 'cash' ? getChange() : 0,
        referenceNumber: paymentMethod === 'cash' ? undefined : referenceNumber.trim(),
        // Discount info
        discountType: discount.type !== 'none' ? discount.type : undefined,
        discountPercentage: discount.type !== 'none' ? discount.percentage : undefined,
        discountAmount: discount.type !== 'none' ? calculateDiscountAmount() : undefined,
        // Include user info for activity logging
        userId: user?.id,
        userName: user?.name,
        userEmail: user?.email
      };

      console.log('Transaction data to save:', transactionData);

      // Save transaction
      const savedTransaction = await transactionService.create(transactionData);
      console.log('Transaction saved successfully:', savedTransaction);

      // Refresh products to reflect updated inventory
      await loadProducts();

      toast.success('Transaction completed successfully!', {
        duration: 4000,
        icon: '✅'
      });

      // Print receipt only if auto-print is enabled
      if (autoPrintReceipt && (!hasDesktopPrinterBridge || isPrinterReady)) {
        printerService.printReceipt(transactionData).catch((printError) => {
          console.error('Receipt printing failed:', printError);
          toast.error('Receipt printing failed: ' + (printError.message || 'Please check the printer connection.'));
        });
      } else if (autoPrintReceipt && hasDesktopPrinterBridge && !isPrinterReady) {
        toast('Receipt not printed: printer is offline.', { icon: '🖨️' });
      }

      // Receipt available in Sales page
      console.log('Receipt data:', transactionData);

      // Reset cart and checkout
      setCart([]);
      setShowCheckout(false);
      setReceivedAmount('');
      setReferenceNumber('');
      setDiscount({ type: 'none', percentage: 0 });
      setCustomDiscountInput('');

    } catch (error) {
      console.error('Error processing transaction:', error);

      // Provide more specific error messages
      if (error.message?.includes('Failed to create transaction')) {
        toast.error('Failed to save transaction. Please check server connection.');
      } else if (error.message?.includes('Failed to fetch')) {
        toast.error('Cannot connect to server. Please check if server is running.');
      } else if (error.message?.includes('database')) {
        toast.error('Database error. Please check database connection.');
      } else {
        toast.error(`Transaction failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualBarcodeSubmit = (e) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      console.log('Manual barcode input:', manualBarcode.trim());

      // Find product by barcode
      const product = products.find(p =>
        p.barcode === manualBarcode.trim() ||
        p.barcode?.toString() === manualBarcode.trim() ||
        p.id?.toString() === manualBarcode.trim()
      );

      if (product) {
        console.log('Manual barcode - found product:', product);
        handleBarcodeScanned(product);
        setManualBarcode('');
      } else {
        console.log('Manual barcode - product not found:', manualBarcode.trim());
        toast.error(`Product with barcode "${manualBarcode}" not found`, { icon: '❌' });
      }
    }
  };

  const filteredProducts = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    let filtered = products.filter(product => {
      const matchesSearch = !term || product.name.toLowerCase().includes(term);
      const matchesCategory = !selectedCategory || product.category_name === selectedCategory;
      const isAvailable = product.status !== 'unavailable';
      return matchesSearch && matchesCategory && isAvailable;
    });

    // Prioritize products without barcodes (they appear first)
    filtered.sort((a, b) => {
      const hasBarcodeA = a.barcode && a.barcode.trim() !== '';
      const hasBarcodeB = b.barcode && b.barcode.trim() !== '';

      // Products without barcodes come first
      if (!hasBarcodeA && hasBarcodeB) return -1; // a (no barcode) comes before b (has barcode)
      if (hasBarcodeA && !hasBarcodeB) return 1;  // b (no barcode) comes before a (has barcode)
      return 0; // Maintain original order if both have/don't have barcodes
    });

    return filtered;
  }, [products, searchTerm, selectedCategory]);

  const visibleProducts = useMemo(() => {
    if (visibleProductCount >= filteredProducts.length) {
      return filteredProducts;
    }
    return filteredProducts.slice(0, visibleProductCount);
  }, [filteredProducts, visibleProductCount]);

  useEffect(() => {
    // Reset visible product count when filters change
    setVisibleProductCount(80);
  }, [searchTerm, selectedCategory]);

  const getUniqueCategories = () => {
    const categories = [...new Set(products.map(p => p.category_name))];
    return categories.filter(Boolean);
  };

  const getStockWarning = (product) => {
    if (product.quantity <= 0) return 'Out of stock';
    if (product.quantity <= (settings.lowStockThreshold ?? 10)) return 'Low stock';
    return null;
  };

  const handleProductSelect = (product) => {
    addToCart(product);
  };


  const paymentPalette = {
    cash: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 dark:border-emerald-400 text-emerald-800 dark:text-emerald-100',
    card: 'bg-blue-100 dark:bg-blue-900/40 border-blue-500 dark:border-blue-400 text-blue-800 dark:text-blue-100',
    gcash: 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-500 dark:border-indigo-400 text-indigo-800 dark:text-indigo-100'
  };

  const paymentButtonClass = (method) => {
    const base = 'flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors duration-200';
    if (paymentMethod === method) {
      return `${base} ${paymentPalette[method]} font-semibold`;
    }
    return `${base} ${colors.bg.secondary} ${colors.border.primary} ${colors.text.secondary} hover:opacity-90`;
  };

  const ProductCard = memo(({ product, onSelect, colors: cardColors }) => {
    const stockWarning = getStockWarning(product);
    const isOutOfStock = stockWarning === 'Out of stock';

    const handleClick = useCallback((e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isOutOfStock) {
        onSelect(product);
      }
    }, [isOutOfStock, onSelect, product]);

    return (
      <div
        className={`${cardColors.card.primary} rounded-xl p-3 cursor-pointer transition-all duration-300 border ${cardColors.border.primary} ${isOutOfStock
          ? 'opacity-50 cursor-not-allowed grayscale-[50%]'
          : 'hover:shadow-md hover:border-blue-400/50 hover:-translate-y-1 hover:shadow-blue-500/10 dark:hover:border-blue-500/50 dark:hover:shadow-blue-400/10 hover:bg-gradient-to-br hover:from-slate-50 hover:to-white dark:hover:from-slate-800 dark:hover:to-slate-900'
          }`}
        style={{ contentVisibility: 'auto', containIntrinsicSize: '0 280px' }}
        onClick={handleClick}
      >
        {/* Fixed aspect ratio container for uniform image sizes */}
        <div className="relative w-full pb-[100%] mb-3 overflow-hidden rounded-lg bg-slate-100/50 dark:bg-slate-700/50 flex-shrink-0 group">
          <div className="absolute inset-0 flex items-center justify-center p-2">
            {product.imageUrl ? (
              <AsyncImage
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-contain drop-shadow-sm transition-transform duration-500 group-hover:scale-110"
                decoding="async"
                loading="lazy"
                fetchpriority="low"
                draggable={false}
                sizes="(max-width: 1024px) 50vw, 25vw"
                fallback={
                  <div className={`w-full h-full rounded-lg ${cardColors.bg.tertiary} flex items-center justify-center`}>
                    <CameraIcon className={`h-8 w-8 ${cardColors.text.tertiary} opacity-50`} />
                  </div>
                }
              />
            ) : (
              <div className={`w-full h-full rounded-lg ${cardColors.bg.tertiary} flex items-center justify-center`}>
                <CameraIcon className={`h-8 w-8 ${cardColors.text.tertiary} opacity-50`} />
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 flex flex-col px-1">
          <h3 className={`font-semibold text-sm mb-1 line-clamp-2 h-10 ${cardColors.text.primary} leading-tight`}>{product.name}</h3>
          <p className={`text-lg font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-1`}>{formatCurrency(parseFloat(product.price || 0))}</p>
          <div className="flex items-center justify-between mt-auto">
            <p className={`text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 ${cardColors.text.secondary}`}>Stock: {product.quantity}</p>
            {stockWarning && (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${stockWarning === 'Out of stock' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                {stockWarning}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    // Only re-render if product data actually changed
    return prevProps.product.id === nextProps.product.id &&
      prevProps.product.quantity === nextProps.product.quantity &&
      prevProps.product.price === nextProps.product.price &&
      prevProps.product.name === nextProps.product.name &&
      prevProps.product.imageUrl === nextProps.product.imageUrl;
  });

  const CartItem = memo(({ item, onUpdateQuantity, onRemove, availableStock, colors: itemColors }) => {
    const [localQuantity, setLocalQuantity] = useState(item.quantity);
    const [isFocused, setIsFocused] = useState(false);
    const [isError, setIsError] = useState(false);

    // Sync with true quantity if it changes externally
    useEffect(() => {
      setLocalQuantity(item.quantity);
      setIsError(false);
    }, [item.quantity]);

    const handleRemove = useCallback((e) => {
      e.preventDefault();
      e.stopPropagation();
      onRemove(item.id);
    }, [item.id, onRemove]);

    const handleDecrement = useCallback((e) => {
      e.preventDefault();
      e.stopPropagation();
      onUpdateQuantity(item.id, item.quantity - 1);
    }, [item.id, item.quantity, onUpdateQuantity]);

    const handleIncrement = useCallback((e) => {
      e.preventDefault();
      e.stopPropagation();
      onUpdateQuantity(item.id, item.quantity + 1);
    }, [item.id, item.quantity, onUpdateQuantity]);

    const handleQuantityChange = (e) => {
      const val = e.target.value.replace(/[^0-9]/g, '');
      const numVal = parseInt(val, 10);

      if (!isNaN(numVal) && numVal > availableStock) {
        setLocalQuantity(availableStock.toString());
        setIsError(true);
        setTimeout(() => setIsError(false), 500); // Reset error shake after animation
      } else {
        setLocalQuantity(val);
        setIsError(false);
      }
    };

    const commitQuantity = () => {
      const newQty = parseInt(localQuantity, 10);
      if (isNaN(newQty) || newQty <= 0) {
        setLocalQuantity(item.quantity); // revert
      } else if (newQty > availableStock) {
        setLocalQuantity(availableStock.toString());
        onUpdateQuantity(item.id, availableStock);
      } else {
        if (newQty !== item.quantity) {
          onUpdateQuantity(item.id, newQty);
        }
      }
    };

    const handleKeyDown = (e) => {
      // Disable 'Escape' acting on the POS Screen while editing quantity
      if (e.key === 'Escape') {
        e.stopPropagation();
        setLocalQuantity(item.quantity);
        e.target.blur();
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        e.target.blur();
      }
    };

    return (
      <div className={`${itemColors.card.secondary} rounded-lg p-2.5 shadow-sm border ${itemColors.border.primary} transition-all hover:shadow-md max-w-full flex flex-col gap-2`}>
        {/* Top Row: Name and Remove */}
        <div className="flex items-start justify-between">
          <div className="flex-1 pr-2 min-w-0">
            <h3 className={`font-semibold text-sm leading-tight truncate ${itemColors.text.primary}`} title={item.name}>{item.name}</h3>
            <p className={`text-xs mt-0.5 ${itemColors.text.secondary} font-medium tracking-wide`}>{formatCurrency(parseFloat(item.price || 0))}</p>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full p-1 transition-colors flex-shrink-0"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom Row: Quantity Controls and Total */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center rounded-md border transition-all overflow-hidden ${isError ? 'ring-1 ring-red-500/50 border-red-500 animate-pulse' : (isFocused ? 'ring-1 ring-blue-500/50 border-blue-500 bg-white dark:bg-slate-800' : `${itemColors.bg.tertiary} ${itemColors.border.primary}`)}`}>
            <button
              type="button"
              className={`w-7 h-7 flex items-center justify-center ${itemColors.text.secondary} hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:bg-slate-300 dark:active:bg-slate-600`}
              onClick={handleDecrement}
            >
              <span className="text-base font-medium leading-none mb-0.5">-</span>
            </button>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              className={`w-10 h-7 text-center text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-0 p-0 ${itemColors.text.primary} appearance-none`}
              style={{ MozAppearance: 'textfield' }}
              value={localQuantity}
              onChange={handleQuantityChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                setIsFocused(false);
                commitQuantity();
              }}
              onClick={(e) => e.target.select()}
            />
            <button
              type="button"
              className={`w-7 h-7 flex items-center justify-center ${itemColors.text.secondary} hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:bg-slate-300 dark:active:bg-slate-600`}
              onClick={handleIncrement}
            >
              <span className="text-base font-medium leading-none mb-0.5">+</span>
            </button>
          </div>
          <span className={`font-bold text-[15px] bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent`}>
            {formatCurrency(parseFloat(item.price || 0) * item.quantity)}
          </span>
        </div>
      </div>
    );
  }, (prevProps, nextProps) => {
    return prevProps.item.id === nextProps.item.id &&
      prevProps.item.quantity === nextProps.item.quantity &&
      prevProps.item.price === nextProps.item.price &&
      prevProps.item.name === nextProps.item.name;
  });

  const handleRestartTransaction = () => {
    setCart([]);
    setShowCheckout(false);
    setReceivedAmount('');
    setReferenceNumber('');
    setDiscount({ type: 'none', percentage: 0 });
    setCustomDiscountInput('');
    setShowRestartConfirmation(false);
    setShowRestartPasswordModal(false);
    toast.success('Transaction restarted.');
  };

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full max-w-7xl mx-auto px-4 lg:px-6 flex gap-4">
        {/* Left Side - Products */}
        <div className="flex-1 flex flex-col min-w-0 h-full">
          {/* Search and Filters - Fixed at top */}
          <div className={`${colors.card.primary} rounded-xl p-3 mb-3 shadow-sm border ${colors.border.primary} flex-shrink-0`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-2.5 lg:space-y-0 lg:space-x-3">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${colors.text.tertiary}`} />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 rounded-lg border ${colors.input.primary}`}
                  />
                </div>
              </div>

              {/* Category Filter */}
              <div className="flex-1 max-w-xs">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`w-full p-2.5 rounded-lg border ${colors.input.primary}`}
                >
                  <option value="">All Categories</option>
                  {getUniqueCategories().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Products Grid - Scrollable content */}
          <div className={`flex-1 min-h-0 ${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
            <div className="h-full overflow-y-auto p-3 scrollbar-thin">
              {filteredProducts.length === 0 ? (
                <div className="text-center py-8">
                  <CameraIcon className={`h-12 w-12 mx-auto mb-4 ${colors.text.tertiary}`} />
                  <p className={`${colors.text.secondary}`}>No products found</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {visibleProducts.map(product => (
                      <ProductCard key={product.id} product={product} onSelect={handleProductSelect} colors={colors} />
                    ))}
                  </div>
                  {visibleProductCount < filteredProducts.length && (
                    <div className="mt-4 flex justify-center">
                      <button
                        type="button"
                        className="px-4 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => setVisibleProductCount(count => count + 80)}
                      >
                        Load more products
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Cart */}
        <div className="w-80 flex flex-col h-full">
          <div className={`flex-1 ${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} flex flex-col overflow-hidden`}>
            {/* Cart Header */}
            <div className={`p-4 border-b ${colors.border.primary} flex-shrink-0 flex items-center justify-between`}>
              <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Current Order</h2>
              <button
                type="button"
                className={`p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ${cart.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={cart.length === 0}
                onClick={() => {
                  if (user?.role === 'admin') {
                    setShowRestartConfirmation(true);
                  } else {
                    setShowRestartPasswordModal(true);
                  }
                }}
                title="Restart Transaction"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Cart Items - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
              {cart.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingCartIcon className={`h-12 w-12 mx-auto mb-4 ${colors.text.tertiary}`} />
                  <p className={`${colors.text.secondary}`}>Your cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <CartItem
                      key={item.id}
                      item={item}
                      availableStock={getAvailableStock(item.id, item.quantity)}
                      onUpdateQuantity={updateCartItemQuantity}
                      onRemove={removeFromCart}
                      colors={colors}
                    />
                  ))}
                </div>
              )}
              {/* Invisible element to auto-scroll to */}
              <div ref={cartEndRef} />
            </div>

            {/* Cart Footer - Fixed at bottom */}
            <div className={`p-4 border-t ${colors.border.primary} flex-shrink-0`}>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-medium ${colors.text.secondary}`}>Subtotal</span>
                  <span className={`text-sm font-semibold ${colors.text.primary}`}>{formatCurrency(calculateSubtotal())}</span>
                </div>
                {/* Discount Button */}
                <div>
                  {discount.type !== 'none' ? (
                    <div className={`flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700`}>
                      <div className="flex items-center gap-2">
                        <ReceiptPercentIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          {discount.type === 'pwd' ? 'PWD' : discount.type === 'senior' ? 'Senior' : 'Custom'} ({discount.percentage}%)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-green-700 dark:text-green-300">-{formatCurrency(calculateDiscountAmount())}</span>
                        <button
                          type="button"
                          onClick={() => { setDiscount({ type: 'none', percentage: 0 }); setCustomDiscountInput(''); }}
                          className="text-red-400 hover:text-red-600 p-0.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (user?.role === 'admin') {
                          setShowDiscountModal(true);
                        } else {
                          setShowDiscountPasswordModal(true);
                        }
                      }}
                      disabled={cart.length === 0}
                      className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-dashed transition-all duration-200 ${cart.length === 0
                        ? `${colors.border.primary} ${colors.text.tertiary} cursor-not-allowed opacity-50`
                        : `border-blue-400 dark:border-blue-500 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20`
                        }`}
                    >
                      <ReceiptPercentIcon className="h-4 w-4" />
                      <span className="text-sm font-medium">Add Discount</span>
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  {settings.taxRate !== undefined && settings.taxRate > 0 ? (
                    <>
                      <span className={`text-sm font-medium ${colors.text.secondary}`}>Tax ({settings.taxRate}%)</span>
                      <span className={`text-sm font-semibold ${colors.text.primary}`}>{formatCurrency(calculateTax(calculateSubtotal() - calculateDiscountAmount()))}</span>
                    </>
                  ) : (
                    <>
                      <span className={`text-sm font-medium ${colors.text.secondary}`}>Tax</span>
                      <span className={`text-sm font-semibold ${colors.text.primary}`}>₱0.00</span>
                    </>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-base font-medium ${colors.text.primary}`}>Total</span>
                  <span className={`text-xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent drop-shadow-sm`}>{formatCurrency(calculateTotal())}</span>
                </div>
                <button
                  onClick={() => setShowCheckout(true)}
                  disabled={cart.length === 0}
                  className={`w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-500 dark:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all duration-300 transform active:scale-[0.98] mt-2`}
                >
                  Proceed to Checkout
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Checkout Modal */}
        {showCheckout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`${colors.card.primary} rounded-lg shadow-xl max-w-md w-full mx-4 border ${colors.border.primary}`}>
              <div className={`flex justify-between items-center p-6 border-b ${colors.border.primary}`}>
                <h2 className={`text-xl font-bold ${colors.text.primary}`}>{t('checkout')}</h2>
                <button
                  onClick={() => setShowCheckout(false)}
                  className={`${colors.text.tertiary} hover:${colors.text.secondary} transition-colors`}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className={`${colors.bg.secondary} p-4 rounded-lg`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className={`font-semibold ${colors.text.primary}`}>{t('total')} Amount:</span>
                    <span className={`text-xl font-bold ${colors.text.primary}`}>{formatCurrency(calculateTotal())}</span>
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                    {t('paymentMethod')}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => setPaymentMethod('cash')} className={paymentButtonClass('cash')}>
                      <BanknotesIcon className="h-5 w-5" /> Cash
                    </button>
                    <button type="button" onClick={() => setPaymentMethod('card')} className={paymentButtonClass('card')}>
                      Card
                    </button>
                    <button type="button" onClick={() => setPaymentMethod('gcash')} className={paymentButtonClass('gcash')}>
                      GCash
                    </button>
                  </div>
                </div>

                {/* Auto-Print Receipt Toggle */}
                <div className={`${colors.bg.secondary} p-4 rounded-lg border ${colors.border.primary}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>
                        Print Receipt
                      </label>
                      <p className={`text-xs ${colors.text.secondary}`}>
                        {(hasDesktopPrinterBridge && !isPrinterReady)
                          ? 'Printer offline. Reconnect printer to enable auto-print.'
                          : 'Automatically print receipt after transaction.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (hasDesktopPrinterBridge && !isPrinterReady) {
                          return;
                        }
                        const newValue = !autoPrintReceipt;
                        setAutoPrintReceipt(newValue);
                        localStorage.setItem('autoPrintReceipt', JSON.stringify(newValue));
                      }}
                      disabled={hasDesktopPrinterBridge && !isPrinterReady}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${autoPrintReceipt
                        ? 'bg-blue-600 dark:bg-blue-500'
                        : 'bg-gray-300 dark:bg-gray-600'
                        } ${(hasDesktopPrinterBridge && !isPrinterReady) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoPrintReceipt ? 'translate-x-6' : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                </div>

                <div>
                  {paymentMethod === 'cash' ? (
                    <div>
                      <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                        {t('amountReceived')}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
                        placeholder="0.00"
                        value={receivedAmount}
                        onChange={(e) => setReceivedAmount(e.target.value)}
                      />
                      {receivedAmount && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                          <div className="flex justify-between">
                            <span className={colors.text.primary}>{t('change')}:</span>
                            <span className={`font-semibold ${getChange() < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                              {formatCurrency(getChange())}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                        Reference Number
                      </label>
                      <input
                        type="text"
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
                        placeholder="Enter reference number"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className={`flex gap-3 p-6 border-t ${colors.border.primary}`}>
                <button
                  onClick={() => setShowCheckout(false)}
                  className={`flex-1 px-4 py-2 ${colors.text.secondary} border ${colors.border.primary} rounded-lg hover:${colors.bg.secondary} transition-colors`}
                  disabled={isProcessing}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleCheckout}
                  disabled={isProcessing || getChange() < 0}
                  className="flex-1 px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
                >
                  {isProcessing ? 'Processing...' : 'Complete Sale'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* No post-checkout receipt; view in Sales page */}
      </div>
      <AdminOverrideModal
        isOpen={showOverrideModal}
        onClose={() => {
          setShowOverrideModal(false);
          setOverrideAction(null);
        }}
        onSuccess={handleOverrideSuccess}
        actionDescription="void this item from the cart"
      />

      {/* Discount Password Gate (non-admin users) */}
      <AdminOverrideModal
        isOpen={showDiscountPasswordModal}
        onClose={() => setShowDiscountPasswordModal(false)}
        onSuccess={() => {
          setShowDiscountPasswordModal(false);
          setShowDiscountModal(true);
        }}
        actionDescription="apply a discount"
      />

      {/* Discount Selection Modal */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-sm`}>
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-bold ${colors.text.primary}`}>Apply Discount</h3>
              <p className={`text-sm ${colors.text.secondary} mt-1`}>Select a discount type</p>
            </div>
            <div className="p-6 space-y-3">
              {/* PWD Discount */}
              <button
                type="button"
                onClick={() => {
                  setDiscount({ type: 'pwd', percentage: 20 });
                  setShowDiscountModal(false);
                  setCustomDiscountInput('');
                }}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${discount.type === 'pwd'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : `${colors.border.primary} hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10`
                  }`}
              >
                <div>
                  <p className={`font-semibold ${colors.text.primary}`}>PWD Discount</p>
                  <p className={`text-sm ${colors.text.secondary}`}>Person with Disability</p>
                </div>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">20%</span>
              </button>

              {/* Senior Citizen Discount */}
              <button
                type="button"
                onClick={() => {
                  setDiscount({ type: 'senior', percentage: 20 });
                  setShowDiscountModal(false);
                  setCustomDiscountInput('');
                }}
                className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${discount.type === 'senior'
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : `${colors.border.primary} hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50/50 dark:hover:bg-green-900/10`
                  }`}
              >
                <div>
                  <p className={`font-semibold ${colors.text.primary}`}>Senior Citizen</p>
                  <p className={`text-sm ${colors.text.secondary}`}>Senior citizen discount</p>
                </div>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">20%</span>
              </button>

              {/* Custom Discount */}
              <div className={`p-4 rounded-xl border-2 transition-all ${discount.type === 'custom'
                ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                : `${colors.border.primary}`
                }`}>
                <p className={`font-semibold ${colors.text.primary} mb-2`}>Custom Discount</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="Enter %"
                    value={customDiscountInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomDiscountInput(val);
                    }}
                    className={`flex-1 border rounded-lg px-3 py-2 text-center ${colors.input.primary}`}
                  />
                  <span className={`font-bold ${colors.text.secondary}`}>%</span>
                  <button
                    type="button"
                    onClick={() => {
                      const pct = parseFloat(customDiscountInput);
                      if (isNaN(pct) || pct < 0 || pct > 100) {
                        toast.error('Enter a valid percentage (0-100)');
                        return;
                      }
                      setDiscount({ type: 'custom', percentage: pct });
                      setShowDiscountModal(false);
                    }}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-between`}>
              <button
                type="button"
                onClick={() => {
                  setDiscount({ type: 'none', percentage: 0 });
                  setCustomDiscountInput('');
                  setShowDiscountModal(false);
                }}
                className={`px-4 py-2 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
              >
                Remove Discount
              </button>
              <button
                type="button"
                onClick={() => setShowDiscountModal(false)}
                className={`px-4 py-2 rounded-lg ${colors.bg.secondary} ${colors.text.primary} hover:opacity-80 transition-colors font-medium`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restart Transaction Password Gate (non-admin users) */}
      <AdminOverrideModal
        isOpen={showRestartPasswordModal}
        onClose={() => setShowRestartPasswordModal(false)}
        onSuccess={() => {
          setShowRestartPasswordModal(false);
          setShowRestartConfirmation(true);
        }}
        actionDescription="restart this transaction"
      />

      {/* Restart Transaction Confirmation */}
      {showRestartConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-sm`}>
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-bold text-red-600 dark:text-red-400 flex items-center gap-2`}>
                <TrashIcon className="h-5 w-5" />
                Restart Transaction
              </h3>
            </div>
            <div className="p-6">
              <p className={`text-base font-medium ${colors.text.primary} mb-2`}>
                Are you sure you want to restart this transaction?
              </p>
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 text-sm text-yellow-800 dark:text-yellow-300">
                ⚠️ Warning: This will clear all items in the cart, remove applied discounts, and discard unsaved progress. This action cannot be undone.
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-3`}>
              <button
                type="button"
                onClick={() => setShowRestartConfirmation(false)}
                className={`px-4 py-2 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} transition-colors font-medium`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRestartTransaction}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
              >
                Restart Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSScreen; 