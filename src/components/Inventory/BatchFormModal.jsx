import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  XMarkIcon,
  CubeIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ClipboardDocumentListIcon,
  CalendarIcon,
  TruckIcon,
  MapPinIcon,
  PencilSquareIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import { productService, supplierService, inventoryBatchService } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import ModalPortal from '../common/ModalPortal';

// Pure-helper: today's date in YYYY-MM-DD (local).
const todayLocalISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const suggestBatchNumber = () => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const seq = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  return `BATCH-${yy}${mm}${dd}-${seq}`;
};

// `mode` is 'create' (multi-product) or 'edit' (single batch).
// In 'create', `lockedProduct` (optional) preselects a product and hides the catalog.
const BatchFormModal = ({
  isOpen,
  onClose,
  onSaved,
  mode = 'create',
  batch = null,           // for edit mode
  lockedProduct = null,   // for per-product create mode
}) => {
  const { colors } = useTheme();

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [shared, setShared] = useState({
    batchNumber: '',
    receivedDate: todayLocalISO(),
    expiryDate: '',
    supplierId: '',
    notes: '',
    storageLocation: '',
  });

  // Each row: { productId, productName, quantity, unitCost }
  const [items, setItems] = useState([]);

  // Initialize when opened
  useEffect(() => {
    if (!isOpen) return;
    setSubmitting(false);
    if (mode === 'edit' && batch) {
      setShared({
        batchNumber: batch.batchNumber || '',
        receivedDate: batch.receivedDate ? String(batch.receivedDate).slice(0, 10) : todayLocalISO(),
        expiryDate: batch.expiryDate ? String(batch.expiryDate).slice(0, 10) : '',
        supplierId: batch.supplierId || '',
        notes: batch.notes || '',
        storageLocation: batch.storageLocation || '',
      });
      setItems([
        {
          productId: batch.productId,
          productName: batch.productName,
          quantity: batch.quantity ?? 1,
          unitCost: batch.unitCost ?? 0,
        },
      ]);
    } else {
      setShared({
        batchNumber: suggestBatchNumber(),
        receivedDate: todayLocalISO(),
        expiryDate: '',
        supplierId: '',
        notes: '',
        storageLocation: '',
      });
      if (lockedProduct) {
        setItems([
          {
            productId: lockedProduct.id,
            productName: lockedProduct.name,
            quantity: 1,
            unitCost: lockedProduct.price ?? lockedProduct.cost ?? 0,
          },
        ]);
      } else {
        setItems([]);
      }
    }
    setProductSearch('');
  }, [isOpen, mode, batch, lockedProduct]);

  // Load products + suppliers once when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingMeta(true);
    Promise.all([productService.getAll(), supplierService.getAll()])
      .then(([p, s]) => {
        if (cancelled) return;
        setProducts(Array.isArray(p) ? p : []);
        setSuppliers(Array.isArray(s) ? s : []);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load products / suppliers');
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => { cancelled = true; };
  }, [isOpen]);

  // Esc-to-close
  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const filteredCatalog = useMemo(() => {
    if (!productSearch) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode && String(p.barcode).toLowerCase().includes(q)) ||
        (p.sku && String(p.sku).toLowerCase().includes(q))
    );
  }, [products, productSearch]);

  const addProductToList = (product) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.productId === product.id);
      if (idx >= 0) {
        return prev.map((it, i) =>
          i === idx ? { ...it, quantity: Number(it.quantity || 0) + 1 } : it
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitCost: product.price ?? product.cost ?? 0,
        },
      ];
    });
  };

  const updateItem = (idx, patch) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const removeItem = (idx) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  // Validation
  const expiryError = useMemo(() => {
    if (!shared.expiryDate) return null;
    if (!shared.receivedDate) return 'Received date is required when expiry is set';
    if (new Date(shared.expiryDate) <= new Date(shared.receivedDate)) {
      return 'Expiry date must be later than received date';
    }
    return null;
  }, [shared.expiryDate, shared.receivedDate]);

  const itemErrors = useMemo(() => {
    return items.map((it) => {
      const errs = {};
      const qty = Number.parseInt(it.quantity, 10);
      if (!it.productId) errs.product = 'Product required';
      if (!Number.isFinite(qty) || qty <= 0) errs.quantity = 'Quantity must be > 0';
      return errs;
    });
  }, [items]);

  const hasItemError = itemErrors.some((e) => Object.keys(e).length > 0);
  const noItems = items.length === 0;
  const canSubmit =
    !submitting &&
    !noItems &&
    !hasItemError &&
    !expiryError &&
    !!shared.receivedDate;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (mode === 'edit' && batch) {
        const it = items[0];
        await inventoryBatchService.update(batch.id, {
          batchNumber: shared.batchNumber,
          quantity: Number.parseInt(it.quantity, 10),
          unitCost: Number(it.unitCost) || 0,
          receivedDate: shared.receivedDate,
          expiryDate: shared.expiryDate || null,
          supplierId: shared.supplierId || null,
          notes: shared.notes || null,
          storageLocation: shared.storageLocation || null,
        });
        toast.success('Batch updated');
      } else {
        await inventoryBatchService.create({
          products: items.map((it) => ({
            productId: it.productId,
            quantity: Number.parseInt(it.quantity, 10),
            unitCost: Number(it.unitCost) || 0,
          })),
          batchNumber: shared.batchNumber || null,
          receivedDate: shared.receivedDate,
          expiryDate: shared.expiryDate || null,
          supplierId: shared.supplierId || null,
          notes: shared.notes || null,
          storageLocation: shared.storageLocation || null,
        });
        toast.success(items.length === 1 ? 'Batch created' : `${items.length} batches created`);
      }
      onSaved?.();
      onClose?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Failed to save batch');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const showCatalog = mode === 'create' && !lockedProduct;
  const isEdit = mode === 'edit';
  const totalQty = items.reduce((s, it) => s + (Number.parseInt(it.quantity, 10) || 0), 0);

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className={`${colors.card.primary} w-full ${showCatalog ? 'max-w-7xl' : 'max-w-2xl'} h-[92vh] flex flex-col rounded-2xl shadow-2xl border ${colors.border.primary} overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div className={`px-6 py-4 border-b ${colors.border.primary} flex-shrink-0 flex items-center justify-between`}>
            <div>
              <h3 className={`text-xl font-bold ${colors.text.primary}`}>
                {isEdit ? 'Edit Batch' : lockedProduct ? `Add Batch · ${lockedProduct.name}` : 'Add Batch'}
              </h3>
              <p className={`text-sm ${colors.text.secondary} mt-0.5`}>
                {isEdit
                  ? 'Update batch details. Quantity changes adjust product stock automatically.'
                  : showCatalog
                    ? 'Pick one or more products on the right; share dates/supplier/notes on the left.'
                    : 'Fill in the batch details below.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
              title="Close (Esc)"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* BODY */}
          <div className="flex flex-1 min-h-0">
            {/* LEFT PANEL: Form + selected items */}
            <div className={`${showCatalog ? 'w-[42%] border-r ' + colors.border.primary : 'w-full'} flex flex-col min-h-0`}>
              {/* Shared fields */}
              <div className={`px-5 py-4 border-b ${colors.border.primary} flex-shrink-0 space-y-3 overflow-y-auto max-h-[55vh]`}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider ${colors.text.secondary} mb-1.5`}>
                      <ClipboardDocumentListIcon className="h-3.5 w-3.5 inline mr-1" />
                      Batch Number
                    </label>
                    <input
                      type="text"
                      value={shared.batchNumber}
                      onChange={(e) => setShared((s) => ({ ...s, batchNumber: e.target.value }))}
                      placeholder="e.g. BATCH-251104-0830"
                      className={`w-full border rounded-xl px-3 py-2 text-sm ${colors.input.primary}`}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider ${colors.text.secondary} mb-1.5`}>
                      <TruckIcon className="h-3.5 w-3.5 inline mr-1" />
                      Supplier <span className="opacity-70 font-normal">(opt)</span>
                    </label>
                    <select
                      value={shared.supplierId}
                      onChange={(e) => setShared((s) => ({ ...s, supplierId: e.target.value }))}
                      className={`w-full border rounded-xl px-3 py-2 text-sm ${colors.input.primary}`}
                      disabled={loadingMeta}
                    >
                      <option value="">— None —</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider ${colors.text.secondary} mb-1.5`}>
                      <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />
                      Received Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={shared.receivedDate}
                      onChange={(e) => setShared((s) => ({ ...s, receivedDate: e.target.value }))}
                      className={`w-full border rounded-xl px-3 py-2 text-sm ${colors.input.primary}`}
                      max={todayLocalISO()}
                    />
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold uppercase tracking-wider ${colors.text.secondary} mb-1.5`}>
                      <CalendarIcon className="h-3.5 w-3.5 inline mr-1" />
                      Expiry Date <span className="opacity-70 font-normal">(opt)</span>
                    </label>
                    <input
                      type="date"
                      value={shared.expiryDate}
                      onChange={(e) => setShared((s) => ({ ...s, expiryDate: e.target.value }))}
                      className={`w-full border rounded-xl px-3 py-2 text-sm ${colors.input.primary} ${expiryError ? 'border-red-500' : ''}`}
                      min={shared.receivedDate || undefined}
                    />
                    {expiryError && (
                      <p className="text-xs text-red-500 mt-1">{expiryError}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider ${colors.text.secondary} mb-1.5`}>
                    <MapPinIcon className="h-3.5 w-3.5 inline mr-1" />
                    Storage Location <span className="opacity-70 font-normal">(opt)</span>
                  </label>
                  <input
                    type="text"
                    value={shared.storageLocation}
                    onChange={(e) => setShared((s) => ({ ...s, storageLocation: e.target.value }))}
                    placeholder="e.g. Aisle 3, Shelf B"
                    className={`w-full border rounded-xl px-3 py-2 text-sm ${colors.input.primary}`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider ${colors.text.secondary} mb-1.5`}>
                    <PencilSquareIcon className="h-3.5 w-3.5 inline mr-1" />
                    Batch Notes <span className="opacity-70 font-normal">(opt)</span>
                  </label>
                  <textarea
                    value={shared.notes}
                    onChange={(e) => setShared((s) => ({ ...s, notes: e.target.value }))}
                    rows={2}
                    placeholder="Optional details about this batch..."
                    className={`w-full border rounded-xl px-3 py-2 text-sm ${colors.input.primary} resize-none`}
                  />
                </div>
              </div>

              {/* Selected items list */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
                <p className={`text-xs font-semibold uppercase tracking-wider ${colors.text.secondary} mb-1`}>
                  {isEdit ? 'Batch Item' : `Selected Products (${items.length})`}
                </p>
                {noItems ? (
                  <div className={`rounded-xl p-8 text-center border-2 border-dashed ${colors.border.primary}`}>
                    <CubeIcon className={`h-10 w-10 mx-auto mb-2 ${colors.text.tertiary}`} />
                    <p className={`text-sm font-semibold ${colors.text.primary}`}>
                      {showCatalog ? 'No products selected yet' : 'No product selected'}
                    </p>
                    <p className={`text-xs ${colors.text.secondary} mt-1`}>
                      {showCatalog ? 'Pick one or more from the catalog →' : 'Add a product to continue.'}
                    </p>
                  </div>
                ) : (
                  items.map((it, idx) => {
                    const errs = itemErrors[idx] || {};
                    const subtotal = (Number.parseInt(it.quantity, 10) || 0) * (Number(it.unitCost) || 0);
                    return (
                      <div
                        key={it.productId + '-' + idx}
                        className={`${colors.card.primary} border ${errs.quantity ? 'border-red-400' : colors.border.primary} rounded-xl p-3 group`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                            {idx + 1}
                          </span>
                          <p className={`flex-1 text-sm font-semibold ${colors.text.primary} truncate`} title={it.productName}>
                            {it.productName || 'Unknown'}
                          </p>
                          {!isEdit && !lockedProduct && (
                            <button
                              onClick={() => removeItem(idx)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                              title="Remove"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <label className={`block text-[10px] font-medium ${colors.text.secondary} mb-1`}>Qty *</label>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === '') return updateItem(idx, { quantity: '' });
                                const n = Number.parseInt(v, 10);
                                updateItem(idx, { quantity: Number.isFinite(n) ? n : '' });
                              }}
                              onBlur={(e) => {
                                const n = Number.parseInt(e.target.value, 10);
                                if (!Number.isFinite(n) || n < 1) updateItem(idx, { quantity: 1 });
                              }}
                              className={`w-full border rounded-lg px-2 py-1.5 text-center text-sm font-semibold ${colors.input.primary} ${errs.quantity ? 'border-red-500' : ''}`}
                            />
                          </div>
                          <div className="flex-1">
                            <label className={`block text-[10px] font-medium ${colors.text.secondary} mb-1`}>Unit Cost</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.unitCost}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                updateItem(idx, { unitCost: Number.isFinite(v) && v >= 0 ? v : 0 });
                              }}
                              className={`w-full border rounded-lg px-2 py-1.5 text-sm ${colors.input.primary}`}
                            />
                          </div>
                          <div className="flex-1">
                            <label className={`block text-[10px] font-medium ${colors.text.secondary} mb-1`}>Subtotal</label>
                            <div className={`border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-2 py-1.5 text-sm font-bold text-right ${colors.text.primary}`}>
                              {formatCurrency(subtotal)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer actions */}
              <div className={`px-5 py-4 border-t-2 ${colors.border.primary} flex-shrink-0 ${colors.bg.secondary}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className={`text-[10px] uppercase tracking-wider ${colors.text.secondary}`}>Items</p>
                      <p className={`text-base font-bold ${colors.text.primary}`}>{items.length}</p>
                    </div>
                    <div className="h-8 w-px bg-gray-300 dark:bg-gray-700" />
                    <div>
                      <p className={`text-[10px] uppercase tracking-wider ${colors.text.secondary}`}>Total Quantity</p>
                      <p className={`text-base font-bold ${colors.text.primary}`}>{totalQty}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 bg-gray-500 hover:bg-gray-600 text-white rounded-xl text-sm font-medium transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all shadow-md ${
                      !canSubmit
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                    }`}
                  >
                    <CheckIcon className="h-4 w-4" />
                    {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Batch'}
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: Product catalog (create + multi only) */}
            {showCatalog && (
              <div className="flex-1 flex flex-col min-h-0">
                <div className={`px-5 py-4 border-b ${colors.border.primary} flex-shrink-0`}>
                  <div className="relative">
                    <MagnifyingGlassIcon className={`h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.tertiary}`} />
                    <input
                      type="text"
                      placeholder="Search products by name, barcode, or SKU..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className={`w-full pl-9 pr-9 py-2.5 border rounded-xl text-sm ${colors.input.primary}`}
                    />
                    {productSearch && (
                      <button
                        onClick={() => setProductSearch('')}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${colors.text.tertiary} hover:text-red-500 transition-colors`}
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className={`text-xs ${colors.text.secondary} mt-1.5`}>
                    {filteredCatalog.length} product{filteredCatalog.length === 1 ? '' : 's'} · Click a card to add
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {loadingMeta ? (
                    <p className={`text-center text-sm ${colors.text.secondary} py-8`}>Loading products...</p>
                  ) : filteredCatalog.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MagnifyingGlassIcon className={`h-12 w-12 mb-3 ${colors.text.tertiary}`} />
                      <p className={`font-semibold ${colors.text.primary}`}>No products found</p>
                      <p className={`text-sm ${colors.text.secondary} mt-1`}>Try a different search term</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                      {filteredCatalog.map((product) => {
                        const inList = items.find((it) => it.productId === product.id);
                        const inListQty = inList ? Number(inList.quantity) || 0 : 0;
                        return (
                          <button
                            key={product.id}
                            onClick={() => addProductToList(product)}
                            className={`text-left p-3 rounded-xl border-2 transition-all hover:shadow-md active:scale-95 ${
                              inList
                                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                : `${colors.card.primary} ${colors.border.primary} hover:border-blue-300 dark:hover:border-blue-600`
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div
                                className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                                  inList ? 'bg-blue-500 text-white' : `${colors.bg.secondary} ${colors.text.secondary}`
                                }`}
                              >
                                {inList ? (
                                  <span className="text-sm font-black">{inListQty}</span>
                                ) : (
                                  <CubeIcon className="h-5 w-5" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-semibold leading-tight line-clamp-2 ${colors.text.primary}`}>
                                  {product.name}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                                  (product.quantity || 0) > 0
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                }`}
                              >
                                Stock: {product.quantity || 0}
                              </span>
                              <span className={`text-[10px] font-bold ${colors.text.primary}`}>
                                {formatCurrency(parseFloat(product.price || 0))}
                              </span>
                            </div>
                            {inList && (
                              <div className="mt-1.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                ✓ Selected · tap to add more
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default BatchFormModal;
