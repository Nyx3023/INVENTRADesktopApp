import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PhotoIcon, CloudArrowUpIcon, CubeIcon, HashtagIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { categoryService } from '../../services/api';
import ModalPortal from '../common/ModalPortal';

const ProductModal = ({ onClose, onSave, product, prefilledBarcode }) => {
  const [categories, setCategories] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);

  const barcodeBufferRef = useRef('');
  const barcodeTimeoutRef = useRef(null);
  const barcodeInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Foods',
    price: '',
    cost: '',
    quantity: '',
    batchNumber: '',
    expiryDate: '',
    barcode: '',
    status: 'available',
  });

  const [imageState, setImageState] = useState({
    file: null,
    preview: null,
    dataUrl: null,
    originalUrl: null,
  });

  const isCreate = !product;

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const list = await categoryService.getAll();
        const names = (list || []).map((c) => c.name);
        setCategories(names.length ? names : ['Uncategorized']);
      } catch {
        setCategories(['Uncategorized']);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        category: product.category || 'Foods',
        price: product.price || '',
        cost: product.cost || '',
        quantity: product.quantity || '',
        batchNumber: product.batchNumber || product.batch_number || '',
        expiryDate: product.expiryDate || product.expiry_date || '',
        barcode: product.barcode || '',
        status: product.status || 'available',
      });

      const relativeImage = product.image_url && product.image_url.trim() !== '' ? product.image_url : null;
      const previewImage = product.imageUrl || relativeImage;

      setImageState({
        originalUrl: relativeImage,
        preview: previewImage || null,
        file: null,
        dataUrl: null,
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: categories[0] || 'Foods',
        price: '',
        cost: '',
        quantity: '',
        batchNumber: '',
        expiryDate: '',
        barcode: prefilledBarcode || '',
        status: 'available',
      });
      setImageState({ file: null, preview: null, dataUrl: null, originalUrl: null });
    }
  }, [product, prefilledBarcode, categories]);

  const deleteOldImage = async (imageUrl) => {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) return;
    try {
      if (window.ThesisPOS?.deleteImage) {
        await window.ThesisPOS.deleteImage({ path: imageUrl });
        return;
      }
      await fetch('/api/delete-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      });
    } catch (e) {
      console.warn('Silent fail deleting old image', e);
    }
  };

  useEffect(() => {
    const handleBarcodeKeyDown = (event) => {
      if (!isScanningBarcode) return;
      if (event.target !== barcodeInputRef.current && (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) return;

      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current);

      if (event.key === 'Enter') {
        event.preventDefault();
        if (barcodeBufferRef.current.length > 6) {
          setFormData((prev) => ({ ...prev, barcode: barcodeBufferRef.current.trim() }));
          toast.success('Barcode scanned!');
          barcodeBufferRef.current = '';
          setIsScanningBarcode(false);
        }
        return;
      }

      if (/^[a-zA-Z0-9]$/.test(event.key)) {
        event.preventDefault();
        barcodeBufferRef.current += event.key;
        barcodeTimeoutRef.current = setTimeout(() => {
          if (barcodeBufferRef.current.length > 6) {
            setFormData((prev) => ({ ...prev, barcode: barcodeBufferRef.current.trim() }));
            toast.success('Barcode scanned!');
            setIsScanningBarcode(false);
          }
          barcodeBufferRef.current = '';
        }, 100);
      }
    };

    if (isScanningBarcode) {
      window.addEventListener('keydown', handleBarcodeKeyDown);
      barcodeInputRef.current?.focus();
    }
    return () => window.removeEventListener('keydown', handleBarcodeKeyDown);
  }, [isScanningBarcode]);

  const handleChange = (e) => setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image size must be less than 5MB');

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageState((prev) => ({ ...prev, file, preview: reader.result, dataUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const uploadImageToServer = async () => {
    if (!imageState.file) return null;
    setIsUploading(true);
    try {
      if (window.ThesisPOS?.saveImage && imageState.dataUrl) {
        return await window.ThesisPOS.saveImage({ dataUrl: imageState.dataUrl, originalName: imageState.file.name });
      }

      const fd = new FormData();
      fd.append('productName', formData.name || 'product');
      fd.append('image', imageState.file);

      const res = await fetch('/api/upload-image', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data.imageUrl;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedBatch = String(formData.batchNumber || '').trim();

    if (isCreate) {
      if (!trimmedBatch) {
        toast.error('Batch / lot number is required for every new product.');
        return;
      }
      const q = Number.parseInt(formData.quantity, 10);
      if (Number.isNaN(q) || q < 0) {
        toast.error('Enter a valid initial quantity (0 or more).');
        return;
      }
    }

    try {
      let finalFormData = {
        ...formData,
        batchNumber: trimmedBatch,
      };
      let oldImageToDelete = null;

      if (imageState.file) {
        const uploadedUrl = await uploadImageToServer();
        if (uploadedUrl) {
          finalFormData.imageUrl = uploadedUrl;
          if (imageState.originalUrl && imageState.originalUrl !== uploadedUrl) {
            oldImageToDelete = imageState.originalUrl;
          }
        }
      } else if (imageState.preview && imageState.originalUrl) {
        finalFormData.imageUrl = imageState.originalUrl;
      } else if (!imageState.preview && product && imageState.originalUrl) {
        finalFormData.imageUrl = '';
        oldImageToDelete = imageState.originalUrl;
      } else if (!imageState.preview && !product) {
        finalFormData.imageUrl = '';
      }

      await onSave(finalFormData);

      if (oldImageToDelete) {
        await deleteOldImage(oldImageToDelete);
      }
    } catch (error) {
      toast.error(error.message || 'Error saving product');
    }
  };

  const labelClass =
    'block text-sm font-semibold mb-1.5 text-slate-800 dark:text-slate-100';
  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border transition-all outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400';
  const disabledInputClass =
    'w-full px-4 py-2.5 rounded-xl border opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800/80 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200';
  const sectionTitle =
    'text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 pb-2 border-b border-slate-200 dark:border-slate-700';

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/55 backdrop-blur-sm">
        <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl border overflow-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0">
                <CubeIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-bold truncate text-slate-900 dark:text-slate-50">
                  {isCreate ? 'Add product' : 'Edit product'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  {isCreate ? 'Initial batch number is required. Stock is tracked per batch.' : 'Update details; use Stock / Batches for quantity changes.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl shrink-0 text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 p-6 space-y-8 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            <form id="productForm" onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-4">
                <h3 className={sectionTitle}>Product</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="name">
                      Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      placeholder="Product name"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="category">
                      Category *
                    </label>
                    <select id="category" name="category" value={formData.category} onChange={handleChange} required className={inputClass}>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="barcode">
                      Barcode
                    </label>
                    <div className="flex gap-2">
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        id="barcode"
                        name="barcode"
                        value={formData.barcode}
                        onChange={handleChange}
                        className={`${inputClass} flex-1 min-w-0`}
                        placeholder="Scan or type"
                      />
                      <button
                        type="button"
                        onClick={() => setIsScanningBarcode(!isScanningBarcode)}
                        className={`px-4 rounded-xl font-medium shrink-0 ${
                          isScanningBarcode
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isScanningBarcode ? 'Stop' : 'Scan'}
                      </button>
                    </div>
                    {isScanningBarcode && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Listening for scanner…</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="description">
                      Description
                    </label>
                    <textarea
                      id="description"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={2}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">POS availability</p>
                    <p className="text-xs mt-0.5 text-slate-600 dark:text-slate-300">
                      {formData.status === 'available' ? 'Visible in POS' : 'Hidden from POS'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        status: prev.status === 'available' ? 'unavailable' : 'available',
                      }))
                    }
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      formData.status === 'available' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                    role="switch"
                    aria-checked={formData.status === 'available'}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                        formData.status === 'available' ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className={sectionTitle}>Initial batch & stock</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {isCreate
                    ? 'Every product must have a batch / lot number. An inventory batch row is created for tracking and expiry alerts.'
                    : 'Batch on file (edit to align with your labels). Add more batches from Batch management or product batches.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass} htmlFor="batchNumber">
                      Batch / lot number {isCreate ? '*' : ''}
                    </label>
                    <div className="relative">
                      <HashtagIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        id="batchNumber"
                        name="batchNumber"
                        value={formData.batchNumber}
                        onChange={handleChange}
                        required={isCreate}
                        className={`${inputClass} pl-10 font-mono text-sm`}
                        placeholder={isCreate ? 'e.g. LOT-2026-001' : 'Batch or lot code'}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="quantity">
                      {isCreate ? 'Initial quantity *' : 'Quantity (read-only)'}
                    </label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      min="0"
                      value={formData.quantity}
                      onChange={handleChange}
                      required={isCreate}
                      disabled={!isCreate}
                      className={!isCreate ? disabledInputClass : inputClass}
                      placeholder="0"
                    />
                    {!isCreate && (
                      <p className="text-xs mt-1 text-slate-500 dark:text-slate-500">
                        Use stock adjustment or batches to change quantity.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="expiryDate">
                      Expiry date
                    </label>
                    <input type="date" id="expiryDate" name="expiryDate" value={formData.expiryDate} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className={sectionTitle}>Pricing</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass} htmlFor="cost">
                      Unit cost (₱) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">₱</span>
                      <input
                        type="number"
                        id="cost"
                        name="cost"
                        min="0"
                        step="0.01"
                        value={formData.cost}
                        onChange={handleChange}
                        required
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="price">
                      Selling price (₱) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-slate-500">₱</span>
                      <input
                        type="number"
                        id="price"
                        name="price"
                        min="0"
                        step="0.01"
                        value={formData.price}
                        onChange={handleChange}
                        required
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className={sectionTitle}>Photo</h3>
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="shrink-0 relative group">
                    {imageState.preview ? (
                      <div className="w-28 h-28 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-600">
                        <img src={imageState.preview} alt="" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                          <button
                            type="button"
                            onClick={() =>
                              setImageState({ file: null, preview: null, dataUrl: null, originalUrl: imageState.originalUrl })
                            }
                            className="p-2 bg-red-600 text-white rounded-full"
                          >
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="w-28 h-28 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500"
                      >
                        <PhotoIcon className="w-8 h-8 mb-1 opacity-50" />
                        <span className="text-xs">No image</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <input type="file" id="imageFile" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <label
                      htmlFor="imageFile"
                      className="inline-flex items-center px-4 py-2.5 rounded-xl cursor-pointer font-medium bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 hover:bg-blue-600/20"
                    >
                      <CloudArrowUpIcon className="w-5 h-5 mr-2" />
                      Upload
                    </label>
                    <p className="text-xs mt-2 text-slate-600 dark:text-slate-400">JPG, PNG, WEBP · max 5MB</p>
                  </div>
                </div>
              </div>
            </form>
          </div>

          <div className="px-6 py-4 flex flex-wrap justify-end gap-2 border-t shrink-0 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-slate-600 dark:text-slate-300 hover:opacity-90"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="productForm"
              disabled={isUploading}
              className="px-6 py-2.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            >
              {isUploading ? 'Uploading…' : isCreate ? 'Create product' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProductModal;
