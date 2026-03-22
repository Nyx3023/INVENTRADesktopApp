import { useState, useRef } from 'react';
import {
  XMarkIcon,
  ArrowUpTrayIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import { importProductsFromExcel, downloadImportTemplate } from '../../utils/exportUtils';
import ModalPortal from '../common/ModalPortal';

const ImportProductsModal = ({ isOpen, onClose, onImport, existingProducts = [] }) => {
  const { colors } = useTheme();
  const fileInputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [errors, setErrors] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [detailsModal, setDetailsModal] = useState(null); // 'valid' | 'duplicates' | 'errors' | 'warnings'

  if (!isOpen) return null;

  // Create maps for quick lookup - recalculate when errors/warnings/duplicates change
  const errorsByRow = new Map((errors || []).map(e => [e.row, e]));
  const warningsByRow = new Map((warnings || []).map(w => [w.row, w]));
  const duplicatesByRow = new Map((duplicates || []).map(d => [d.row, d]));

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.name.match(/\.(xlsx|xls)$/i)) {
      alert('Please select a valid Excel file (.xlsx or .xls)');
      return;
    }

    setFile(selectedFile);
    setErrors([]);
    setWarnings([]);
    setDuplicates([]);
    setPreviewData(null);

    // Process file for preview
    try {
      setIsProcessing(true);
      const result = await importProductsFromExcel(selectedFile, existingProducts);

      // Set all result data
      setErrors(result.errors || []);
      setWarnings(result.warnings || []);
      setDuplicates(result.duplicates || []);
      setPreviewData(result);
    } catch (error) {
      alert(`Error processing file: ${error.message}`);
      setFile(null);
      setPreviewData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (!file || !previewData) return;

    try {
      setIsProcessing(true);
      // Import only selected products (or all if none selected)
      const productsToImport = selectedProducts.size > 0
        ? previewData.products.filter((_, idx) => selectedProducts.has(idx))
        : previewData.products;

      await onImport(productsToImport);
      onClose();
      setFile(null);
      setPreviewData(null);
      setErrors([]);
      setWarnings([]);
      setDuplicates([]);
      setSelectedProducts(new Set());
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      alert(`Error importing products: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleProductSelection = (index) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedProducts(newSelected);
  };

  const getProductStatus = (product, idx) => {
    // Use the Excel row number stored in the product, or calculate from index
    const excelRow = product._excelRow || (idx + 2);
    if (duplicatesByRow.has(excelRow)) {
      return { type: 'duplicate', icon: XCircleIcon, color: 'text-orange-600 dark:text-orange-400', data: duplicatesByRow.get(excelRow) };
    }
    if (errorsByRow.has(excelRow)) {
      return { type: 'error', icon: XCircleIcon, color: 'text-red-600 dark:text-red-400', data: errorsByRow.get(excelRow) };
    }
    if (warningsByRow.has(excelRow)) {
      return { type: 'warning', icon: ExclamationTriangleIcon, color: 'text-yellow-600 dark:text-yellow-400', data: warningsByRow.get(excelRow) };
    }
    return null;
  };

  const toggleSelectAll = () => {
    // Count valid products
    const validProducts = previewData.products.filter((product, idx) => {
      const status = getProductStatus(product, idx);
      return !status || (status.type !== 'duplicate' && status.type !== 'error');
    });

    if (selectedProducts.size === validProducts.length) {
      setSelectedProducts(new Set());
    } else {
      // Only select valid products (not duplicates or errors)
      const validIndices = previewData.products
        .map((product, idx) => ({ product, idx }))
        .filter(({ product, idx }) => {
          const status = getProductStatus(product, idx);
          return !status || (status.type !== 'duplicate' && status.type !== 'error');
        })
        .map(({ idx }) => idx);
      setSelectedProducts(new Set(validIndices));
    }
  };

  const excludeSelected = () => {
    const newSelected = new Set();
    previewData.products.forEach((product, idx) => {
      if (!selectedProducts.has(idx)) {
        const status = getProductStatus(product, idx);
        // Only include valid products (not duplicates or errors)
        if (!status || (status.type !== 'duplicate' && status.type !== 'error')) {
          newSelected.add(idx);
        }
      }
    });
    setSelectedProducts(newSelected);
  };

  const includeAllValid = () => {
    const allValidIndices = new Set();
    previewData.products.forEach((product, idx) => {
      const status = getProductStatus(product, idx);
      // Only include valid products (not duplicates or errors)
      if (!status || (status.type !== 'duplicate' && status.type !== 'error')) {
        allValidIndices.add(idx);
      }
    });
    setSelectedProducts(allValidIndices);
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData(null);
    setErrors([]);
    setWarnings([]);
    setDuplicates([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${colors.card.primary} rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border ${colors.border.primary}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${colors.border.primary}`}>
          <div className="flex items-center space-x-3">
            <ArrowUpTrayIcon className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            <h2 className={`text-xl font-semibold ${colors.text.primary}`}>Import Products from Excel</h2>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-lg hover:${colors.bg.secondary} transition-colors`}
          >
            <XMarkIcon className={`h-5 w-5 ${colors.text.secondary}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* File Upload */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${colors.text.primary}`}>
              Select Excel File
            </label>
            <div className={`border-2 border-dashed rounded-lg p-6 text-center ${colors.border.primary} hover:border-teal-500 transition-colors`}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <DocumentArrowDownIcon className="h-12 w-12 mx-auto mb-3 text-teal-600 dark:text-teal-400" />
                <p className={`${colors.text.secondary} mb-2`}>
                  {file ? file.name : 'Click to select Excel file'}
                </p>
                <p className={`text-xs ${colors.text.tertiary}`}>
                  Supported formats: .xlsx, .xls
                </p>
              </label>
            </div>
            {/* Download Template Button */}
            <div className="mt-4 flex flex-row-reverse">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  downloadImportTemplate();
                }}
                className={`text-sm px-4 py-2 flex items-center gap-2 rounded-lg border border-teal-500 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors`}
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Download Template
              </button>
            </div>
          </div>

          {/* Required Format Info */}
          <div className={`${colors.bg.secondary} rounded-lg p-4 border ${colors.border.primary}`}>
            <h3 className={`text-sm font-semibold mb-2 ${colors.text.primary}`}>Required Columns:</h3>
            <ul className={`text-sm space-y-1 ${colors.text.secondary} list-disc list-inside`}>
              <li><strong>ProdName</strong> - Product name (required)</li>
              <li><strong>Category</strong> - Product category (required)</li>
              <li><strong>Selling Price</strong> - Price in decimal format (required)</li>
              <li><strong>Cost Price</strong> - Cost price in decimal format (optional)</li>
              <li><strong>Quantity</strong> - Initial stock quantity (required)</li>
              <li><strong>Low Stock Alerts</strong> - Minimum stock threshold (required)</li>
              <li><strong>Barcode</strong> - Product barcode (optional)</li>
              <li><strong>ProductImage</strong> - Image URL or path (optional)</li>
            </ul>
          </div>

          {/* Processing Indicator */}
          {isProcessing && !previewData && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
              <p className={colors.text.secondary}>Processing file...</p>
            </div>
          )}

          {/* Preview Data */}
          {previewData && (
            <div className="space-y-4">
              {/* Summary */}
              <div className={`${colors.bg.secondary} rounded-lg p-4 border ${colors.border.primary} relative z-10`}>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div>
                    <p className={`text-xs ${colors.text.secondary}`}>Total Rows</p>
                    <p className={`text-lg font-semibold ${colors.text.primary}`}>{previewData.totalRows}</p>
                  </div>
                  <div
                    onClick={() => previewData.validProducts > 0 && setDetailsModal('valid')}
                    className={`cursor-pointer transition-all hover:opacity-80 ${previewData.validProducts > 0 ? 'hover:scale-105' : ''}`}
                  >
                    <p className={`text-xs ${colors.text.secondary}`}>Valid Products</p>
                    <p className={`text-lg font-semibold text-green-600 dark:text-green-400`}>{previewData.validProducts}</p>
                  </div>
                  <div
                    onClick={() => duplicates.length > 0 && setDetailsModal('duplicates')}
                    className={`cursor-pointer transition-all hover:opacity-80 ${duplicates.length > 0 ? 'hover:scale-105' : ''}`}
                  >
                    <p className={`text-xs ${colors.text.secondary}`}>Skipped (Duplicates)</p>
                    <p className={`text-lg font-semibold ${duplicates.length > 0 ? 'text-orange-600 dark:text-orange-400' : colors.text.primary}`}>
                      {duplicates.length}
                    </p>
                  </div>
                  <div
                    onClick={() => errors.length > 0 && setDetailsModal('errors')}
                    className={`cursor-pointer transition-all hover:opacity-80 ${errors.length > 0 ? 'hover:scale-105' : ''}`}
                  >
                    <p className={`text-xs ${colors.text.secondary}`}>Errors</p>
                    <p className={`text-lg font-semibold ${errors.length > 0 ? 'text-red-600 dark:text-red-400' : colors.text.primary}`}>
                      {errors.length}
                    </p>
                  </div>
                  <div
                    onClick={() => warnings.length > 0 && setDetailsModal('warnings')}
                    className={`cursor-pointer transition-all hover:opacity-80 ${warnings.length > 0 ? 'hover:scale-105' : ''}`}
                  >
                    <p className={`text-xs ${colors.text.secondary}`}>Warnings</p>
                    <p className={`text-lg font-semibold ${warnings.length > 0 ? 'text-yellow-600 dark:text-yellow-400' : colors.text.primary}`}>
                      {warnings.length}
                    </p>
                  </div>
                </div>
              </div>


              {/* Preview Products */}
              {previewData.products.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className={`font-semibold ${colors.text.primary}`}>
                      Select Products to Import ({previewData.products.length} total)
                    </h4>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={toggleSelectAll}
                        className={`text-sm px-3 py-1 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
                      >
                        {(() => {
                          const validCount = previewData.products.filter((product, idx) => {
                            const status = getProductStatus(product, idx);
                            return !status || (status.type !== 'duplicate' && status.type !== 'error');
                          }).length;
                          return selectedProducts.size === validCount ? 'Deselect All' : 'Select All';
                        })()}
                      </button>
                      {selectedProducts.size > 0 && (
                        <button
                          onClick={excludeSelected}
                          className={`text-sm px-3 py-1 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
                        >
                          Exclude Selected
                        </button>
                      )}
                      <button
                        onClick={includeAllValid}
                        className={`text-sm px-3 py-1 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
                      >
                        Include All Valid
                      </button>
                    </div>
                  </div>
                  <div className={`border rounded-lg ${colors.border.primary} relative`} style={{ maxHeight: '500px', overflowY: 'auto', overflowX: 'hidden' }}>
                    <div className="overflow-x-auto">
                      <table className={`min-w-full divide-y ${colors.border.primary}`}>
                        <thead className={`${colors.bg.secondary} sticky top-0 z-20`}>
                          <tr>
                            <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase w-12`}>
                              <input
                                type="checkbox"
                                checked={selectedProducts.size === previewData.products.length && previewData.products.length > 0}
                                onChange={toggleSelectAll}
                                className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                              />
                            </th>
                            <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase w-16`}>Status</th>
                            <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Name</th>
                            <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Category</th>
                            <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Price</th>
                            <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Qty</th>
                            <th className={`px-4 py-2 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Barcode</th>
                          </tr>
                        </thead>
                        <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
                          {previewData.products.map((product, idx) => {
                            // Use the Excel row number stored in the product, or calculate from index
                            const excelRow = product._excelRow || (idx + 2);
                            const status = getProductStatus(product, idx);
                            const isSelected = selectedProducts.has(idx);
                            const isDisabled = status?.type === 'duplicate' || status?.type === 'error';
                            // Determine if this row is near the bottom of the list
                            // Show tooltip above for last 3 rows or if row is in bottom 40%
                            const totalRows = previewData.products.length;
                            const isBottomRow = idx >= totalRows - 3 || idx >= totalRows * 0.6; // Last 3 rows OR bottom 40%
                            const tooltipPosition = isBottomRow ? 'bottom-full mb-2' : 'top-full mt-2';
                            const arrowPosition = isBottomRow ? 'top-full mt-0' : 'bottom-full mb-0';
                            const arrowDirection = isBottomRow ? 'border-t-gray-900' : 'border-b-gray-900';

                            return (
                              <tr
                                key={idx}
                                className={`${isSelected ? colors.bg.secondary : ''} ${isDisabled ? 'opacity-100' : ''} ${!isDisabled ? 'cursor-pointer hover:' + colors.bg.secondary : ''}`}
                                onClick={() => !isDisabled && toggleProductSelection(idx)}
                              >
                                <td className="px-4 py-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => !isDisabled && toggleProductSelection(idx)}
                                    disabled={isDisabled}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-4 py-2">
                                  {status ? (
                                    <div className="relative group z-50">
                                      <status.icon className={`h-5 w-5 ${status.color} cursor-help`} />
                                      <div className={`absolute left-0 ${tooltipPosition} hidden group-hover:block z-[9999] w-80 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl pointer-events-none`}>
                                        <div className="font-semibold mb-2 text-sm">
                                          {status.type === 'duplicate' && '⚠️ Duplicate - Skipped'}
                                          {status.type === 'error' && '❌ Error - Cannot Import'}
                                          {status.type === 'warning' && '⚠️ Warning'}
                                        </div>
                                        <div className="space-y-1">
                                          {status.type === 'duplicate' && (
                                            <>
                                              <div className="text-gray-300">Row {excelRow}: {product.name}</div>
                                              <div className="text-gray-400">{status.data.message}</div>
                                            </>
                                          )}
                                          {status.type === 'error' && (
                                            <>
                                              <div className="text-gray-300">Row {excelRow}: {product.name}</div>
                                              <div className="text-red-300">{status.data.errors.join(', ')}</div>
                                            </>
                                          )}
                                          {status.type === 'warning' && (
                                            <>
                                              <div className="text-gray-300">Row {excelRow}: {product.name}</div>
                                              <div className="text-yellow-300">{status.data.warning || status.data}</div>
                                            </>
                                          )}
                                        </div>
                                        <div className={`absolute left-4 ${arrowPosition} w-0 h-0 border-l-4 border-r-4 ${isBottomRow ? 'border-t-4 border-transparent border-t-gray-900' : 'border-b-4 border-transparent border-b-gray-900'}`}></div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-center">
                                      <CheckCircleIcon
                                        className="h-5 w-5 text-green-500 dark:text-green-400 opacity-80"
                                        title="Ready to import"
                                      />
                                    </div>
                                  )}
                                </td>
                                <td className={`px-4 py-2 text-sm ${colors.text.primary}`}>{product.name}</td>
                                <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>{product.category_name}</td>
                                <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>₱{product.price.toFixed(2)}</td>
                                <td className={`px-4 py-2 text-sm ${colors.text.secondary}`}>{product.quantity}</td>
                                <td className={`px-4 py-2 text-sm font-mono ${colors.text.secondary}`}>{product.barcode || '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex justify-end space-x-3 p-6 border-t ${colors.border.primary}`}>
          <button
            onClick={handleClose}
            className={`px-4 py-2 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!previewData || (selectedProducts.size === 0 && previewData.validProducts === 0) || isProcessing}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Importing...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-5 w-5" />
                <span>Import {selectedProducts.size > 0 ? selectedProducts.size : previewData?.validProducts || 0} Products</span>
                {duplicates.length > 0 && (
                  <span className="text-xs opacity-75 ml-1">({duplicates.length} skipped)</span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Details Modal */}
      {detailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4">
          <div className={`${colors.card.primary} rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-hidden border ${colors.border.primary}`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-6 border-b ${colors.border.primary}`}>
              <div className="flex items-center space-x-3">
                {detailsModal === 'valid' && <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />}
                {detailsModal === 'duplicates' && <XCircleIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />}
                {detailsModal === 'errors' && <XCircleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />}
                {detailsModal === 'warnings' && <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />}
                <h2 className={`text-xl font-semibold ${colors.text.primary}`}>
                  {detailsModal === 'valid' && 'Valid Products'}
                  {detailsModal === 'duplicates' && 'Skipped Duplicates'}
                  {detailsModal === 'errors' && 'Errors'}
                  {detailsModal === 'warnings' && 'Warnings'}
                </h2>
              </div>
              <button
                onClick={() => setDetailsModal(null)}
                className={`p-2 rounded-lg hover:${colors.bg.secondary} transition-colors`}
              >
                <XMarkIcon className={`h-5 w-5 ${colors.text.secondary}`} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {detailsModal === 'valid' && (
                <div className="space-y-3">
                  {previewData.products
                    .map((product, idx) => {
                      const status = getProductStatus(product, idx);
                      return { product, idx, status };
                    })
                    .filter(({ status }) => !status || (status.type !== 'duplicate' && status.type !== 'error'))
                    .map(({ product, idx }) => (
                      <div key={idx} className={`p-4 rounded-lg border ${colors.border.primary} ${colors.bg.secondary}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className={`font-semibold ${colors.text.primary}`}>{product.name}</p>
                            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              <div>
                                <span className={colors.text.secondary}>Category: </span>
                                <span className={colors.text.primary}>{product.category_name}</span>
                              </div>
                              <div>
                                <span className={colors.text.secondary}>Price: </span>
                                <span className={colors.text.primary}>₱{product.price.toFixed(2)}</span>
                              </div>
                              <div>
                                <span className={colors.text.secondary}>Quantity: </span>
                                <span className={colors.text.primary}>{product.quantity}</span>
                              </div>
                              <div>
                                <span className={colors.text.secondary}>Barcode: </span>
                                <span className={colors.text.primary}>{product.barcode || '-'}</span>
                              </div>
                            </div>
                          </div>
                          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 ml-2 flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {detailsModal === 'duplicates' && (
                <div className="space-y-3">
                  {duplicates.map((dup, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border border-orange-500/50 ${colors.bg.secondary}`}>
                      <div className="flex items-start space-x-3">
                        <XCircleIcon className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className={`font-semibold ${colors.text.primary}`}>Row {dup.row}: {dup.productName}</p>
                          <p className={`text-sm mt-1 ${colors.text.secondary}`}>{dup.message}</p>
                          {dup.barcode && (
                            <p className={`text-xs mt-1 font-mono ${colors.text.secondary}`}>Barcode: {dup.barcode}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detailsModal === 'errors' && (
                <div className="space-y-3">
                  {errors.map((error, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border border-red-500/50 ${colors.bg.secondary}`}>
                      <div className="flex items-start space-x-3">
                        <XCircleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className={`font-semibold ${colors.text.primary}`}>Row {error.row}: {error.productName}</p>
                          <div className="mt-2 space-y-1">
                            {error.errors.map((err, errIdx) => (
                              <p key={errIdx} className={`text-sm text-red-600 dark:text-red-400`}>• {err}</p>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {detailsModal === 'warnings' && (
                <div className="space-y-3">
                  {warnings.map((warning, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border border-yellow-500/50 ${colors.bg.secondary}`}>
                      <div className="flex items-start space-x-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className={`font-semibold ${colors.text.primary}`}>Row {warning.row}: {warning.productName}</p>
                          <p className={`text-sm mt-1 text-yellow-600 dark:text-yellow-400`}>{warning.warning || warning}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </ModalPortal>
  );
};

export default ImportProductsModal;
