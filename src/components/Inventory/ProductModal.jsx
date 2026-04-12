import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PhotoIcon, CloudArrowUpIcon, CubeIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { categoryService } from '../../services/api';
import ModalPortal from '../common/ModalPortal';

const ProductModal = ({ product, onClose, onSave, prefilledBarcode }) => {
  const { colors } = useTheme();
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
    barcode: '',
    status: 'available'
  });

  const [imageState, setImageState] = useState({
    file: null,
    preview: null,
    dataUrl: null,
    originalUrl: null
  });

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const list = await categoryService.getAll();
        const names = (list || []).map(c => c.name);
        setCategories(names.length ? names : ['Uncategorized']);
      } catch (e) {
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
        barcode: product.barcode || '',
        status: product.status || 'available'
      });

      const relativeImage = product.image_url && product.image_url.trim() !== '' ? product.image_url : null;
      const previewImage = product.imageUrl || relativeImage;

      setImageState({
        originalUrl: relativeImage,
        preview: previewImage || null,
        file: null,
        dataUrl: null
      });
    } else {
      setFormData({
        name: '',
        description: '',
        category: categories[0] || 'Foods',
        price: '',
        cost: '',
        quantity: '',
        barcode: prefilledBarcode || '',
        status: 'available'
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
        body: JSON.stringify({ imageUrl })
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
          setFormData(prev => ({ ...prev, barcode: barcodeBufferRef.current.trim() }));
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
            setFormData(prev => ({ ...prev, barcode: barcodeBufferRef.current.trim() }));
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

  const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Please select an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image size must be less than 5MB');

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageState(prev => ({ ...prev, file, preview: reader.result, dataUrl: reader.result }));
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
    try {
      let finalFormData = { ...formData };
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

  // Modern input classes
  const labelClass = `block text-sm font-semibold mb-1 ${colors.text.primary}`;
  const inputClass = `w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all outline-none ${colors.text.primary} shadow-sm`;
  const disabledInputClass = `w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl opacity-70 cursor-not-allowed ${colors.text.primary} shadow-sm`;

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
        <div className={`w-full max-w-2xl max-h-[90vh] flex flex-col ${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} overflow-hidden`}>

          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${colors.border.primary} bg-slate-50/50 dark:bg-slate-800/20`}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg">
                <CubeIcon className="w-6 h-6" />
              </div>
              <h2 className={`text-xl font-bold ${colors.text.primary}`}>
                {product ? 'Edit Product' : 'New Product'}
              </h2>
            </div>
            <button onClick={onClose} className={`p-2 rounded-xl transition-colors ${colors.text.secondary} hover:${colors.bg.secondary} hover:text-red-500`}>
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Form Body */}
          <div className="overflow-y-auto p-6 scrollbar-thin">
            <form id="productForm" onSubmit={handleSubmit} className="space-y-6">

              {/* General Information */}
              <div className="space-y-4">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${colors.text.secondary} pb-2 border-b ${colors.border.primary}`}>
                  General Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass} htmlFor="name">Product Name *</label>
                    <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required className={inputClass} placeholder="e.g. Classic T-Shirt" />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="category">Category *</label>
                    <select id="category" name="category" value={formData.category} onChange={handleChange} required className={inputClass}>
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="barcode">Barcode</label>
                    <div className="flex gap-2">
                      <input ref={barcodeInputRef} type="text" id="barcode" name="barcode" value={formData.barcode} onChange={handleChange} className={inputClass} placeholder="Scan or type..." />
                      <button type="button" onClick={() => setIsScanningBarcode(!isScanningBarcode)} className={`px-4 rounded-xl flex items-center justify-center transition-colors font-medium ${isScanningBarcode ? 'bg-green-500 text-white shadow-inner' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}>
                        {isScanningBarcode ? 'Stop' : 'Scan'}
                      </button>
                    </div>
                    {isScanningBarcode && <p className="text-xs text-green-500 mt-1.5 font-medium animate-pulse">Waiting for scanner input...</p>}
                  </div>
                </div>

                <div>
                  <label className={labelClass} htmlFor="description">Description (Optional)</label>
                  <textarea id="description" name="description" value={formData.description} onChange={handleChange} rows="2" className={inputClass} placeholder="Add product details..." />
                </div>

                {/* Status Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <div>
                    <p className={`text-sm font-semibold ${colors.text.primary}`}>Availability</p>
                    <p className={`text-xs mt-0.5 ${colors.text.secondary}`}>
                      {formData.status === 'available' ? 'This product is visible in POS' : 'This product is hidden from POS'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, status: prev.status === 'available' ? 'unavailable' : 'available' }))}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${formData.status === 'available'
                      ? 'bg-green-500 focus:ring-green-500'
                      : 'bg-slate-300 dark:bg-slate-600 focus:ring-slate-400'
                      }`}
                    role="switch"
                    aria-checked={formData.status === 'available'}
                    aria-label="Product availability"
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${formData.status === 'available' ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="space-y-4 pt-2">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${colors.text.secondary} pb-2 border-b ${colors.border.primary}`}>
                  Pricing & Inventory
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass} htmlFor="cost">Unit Cost (₱) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-400">₱</span>
                      <input type="number" id="cost" name="cost" min="0.01" step="0.01" value={formData.cost} onChange={handleChange} required className={`${inputClass} pl-10`} placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="price">Selling Price (₱) *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-medium text-slate-400">₱</span>
                      <input type="number" id="price" name="price" min="0" step="0.01" value={formData.price} onChange={handleChange} required className={`${inputClass} pl-10`} placeholder="0.00" />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="quantity">
                      {product ? 'Current Quantity' : 'Initial Quantity *'}
                    </label>
                    <input
                      type="number"
                      id="quantity"
                      name="quantity"
                      min="0"
                      value={formData.quantity}
                      onChange={handleChange}
                      required={!product}
                      disabled={!!product}
                      className={!!product ? disabledInputClass : inputClass}
                      placeholder="0"
                      title={product ? "Use Stock Adjustments to modify quantity" : ""}
                    />
                    {product && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1">🔒 Locked. Use Stock Mode to add.</p>}
                  </div>
                </div>
              </div>

              {/* Media Upload */}
              <div className="space-y-4 pt-2">
                <h3 className={`text-sm font-bold uppercase tracking-wider ${colors.text.secondary} pb-2 border-b ${colors.border.primary}`}>
                  Product Media
                </h3>

                <div className="flex items-start gap-6">
                  <div className="shrink-0 relative group">
                    {imageState.preview ? (
                      <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 shadow-sm relative">
                        <img src={imageState.preview} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button type="button" onClick={() => setImageState({ file: null, preview: null, dataUrl: null, originalUrl: imageState.originalUrl })} className="p-2 bg-red-500 text-white rounded-full hover:scale-110 transition-transform shadow-lg">
                            <XMarkIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="w-32 h-32 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400">
                        <PhotoIcon className="w-8 h-8 mb-2 opacity-50" />
                        <span className="text-xs font-medium">No Image</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <input type="file" id="imageFile" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    <label htmlFor="imageFile" className="inline-flex items-center px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-500/20 cursor-pointer font-medium transition-colors">
                      <CloudArrowUpIcon className="w-5 h-5 mr-2" />
                      Upload Photo
                    </label>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-3">
                      Supported formats: JPG, PNG, WEBP.
                      <br />Maximum file size: 5MB.
                    </p>
                  </div>
                </div>
              </div>

            </form>
          </div>

          {/* Footer */}
          <div className={`px-6 py-4 flex items-center justify-end gap-3 border-t ${colors.border.primary} bg-slate-50/50 dark:bg-slate-800/20`}>
            <button type="button" onClick={onClose} className={`px-5 py-2.5 rounded-xl font-medium transition-colors ${colors.text.secondary} hover:bg-slate-200 dark:hover:bg-slate-700`}>
              Cancel
            </button>
            <button type="submit" form="productForm" disabled={isUploading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-sm shadow-blue-500/30 hover:shadow-blue-500/50 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:shadow-sm">
              {isUploading ? 'Uploading...' : product ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProductModal;