import { useState, useEffect } from 'react';
import { XMarkIcon, CheckIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { productService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import ModalPortal from '../common/ModalPortal';

const InventoryAuditModal = ({ products, onClose, onComplete }) => {
  const { colors } = useTheme();
  const [auditData, setAuditData] = useState([]);
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [auditMode, setAuditMode] = useState('full'); // 'full' or 'spot'
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [auditStarted, setAuditStarted] = useState(false);
  const [auditNotes, setAuditNotes] = useState('');

  useEffect(() => {
    if (products && products.length > 0) {
      initializeAuditData();
    }
  }, [products]);

  const initializeAuditData = () => {
    let productsToAudit = products;
    
    if (auditMode === 'spot' && selectedCategories.length > 0) {
      productsToAudit = products.filter(product => 
        selectedCategories.includes(product.category)
      );
    }

    const audit = productsToAudit.map(product => ({
      id: product.id,
      name: product.name,
      category: product.category,
      currentStock: product.quantity,
      countedStock: product.quantity,
      discrepancy: 0,
      notes: '',
      verified: false,
      barcode: product.barcode
    }));
    
    setAuditData(audit);
  };

  const handleStockChange = (productId, newCount) => {
    setAuditData(prev => prev.map(item => {
      if (item.id === productId) {
        const discrepancy = newCount - item.currentStock;
        return {
          ...item,
          countedStock: newCount,
          discrepancy,
          verified: false
        };
      }
      return item;
    }));
  };

  const handleVerifyProduct = (productId) => {
    setAuditData(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, verified: true };
      }
      return item;
    }));
  };

  const handleProductNotes = (productId, notes) => {
    setAuditData(prev => prev.map(item => {
      if (item.id === productId) {
        return { ...item, notes };
      }
      return item;
    }));
  };

  const nextProduct = () => {
    if (currentProductIndex < auditData.length - 1) {
      setCurrentProductIndex(prev => prev + 1);
    }
  };

  const previousProduct = () => {
    if (currentProductIndex > 0) {
      setCurrentProductIndex(prev => prev - 1);
    }
  };

  const completeAudit = async () => {
    try {
      setIsProcessing(true);
      
      // Update inventory with audit results
      const promises = auditData
        .filter(item => item.discrepancy !== 0)
        .map(async (item) => {
          const updatedProduct = products.find(p => p.id === item.id);
          return await productService.update(item.id, {
            ...updatedProduct,
            quantity: item.countedStock
          });
        });

      await Promise.all(promises);

      // Save audit record
      const auditRecord = {
        auditId: `AUDIT-${Date.now()}`,
        date: new Date().toISOString(),
        mode: auditMode,
        productsAudited: auditData.length,
        discrepancies: auditData.filter(item => item.discrepancy !== 0).length,
        totalAdjustments: auditData.reduce((sum, item) => sum + Math.abs(item.discrepancy), 0),
        notes: auditNotes,
        results: auditData
      };

      // Store audit record (you might want to save this to database)
      console.log('Audit completed:', auditRecord);
      
      toast.success(`Audit completed! ${auditRecord.discrepancies} discrepancies found and resolved.`);
      onComplete(auditRecord);
      
    } catch (error) {
      console.error('Error completing audit:', error);
      toast.error('Error completing audit');
    } finally {
      setIsProcessing(false);
    }
  };

  const getUniqueCategories = () => {
    return [...new Set(products.map(p => p.category).filter(Boolean))];
  };

  const getDiscrepancySummary = () => {
    const positive = auditData.filter(item => item.discrepancy > 0).length;
    const negative = auditData.filter(item => item.discrepancy < 0).length;
    const totalItems = auditData.filter(item => item.discrepancy !== 0).length;
    
    return { positive, negative, totalItems };
  };

  if (!auditStarted) {
    return (
      <ModalPortal>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-xl font-bold">Start Inventory Audit</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audit Type
              </label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={auditMode}
                onChange={(e) => setAuditMode(e.target.value)}
              >
                <option value="full">Full Inventory Audit</option>
                <option value="spot">Spot Check (Selected Categories)</option>
              </select>
            </div>

            {auditMode === 'spot' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Categories
                </label>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {getUniqueCategories().map(category => (
                    <label key={category} className="flex items-center">
                      <input
                        type="checkbox"
                        className="mr-2"
                        checked={selectedCategories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories(prev => [...prev, category]);
                          } else {
                            setSelectedCategories(prev => prev.filter(c => c !== category));
                          }
                        }}
                      />
                      {category}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audit Notes (Optional)
              </label>
              <textarea
                className="w-full border rounded-lg px-3 py-2"
                rows="3"
                placeholder="Add any notes about this audit..."
                value={auditNotes}
                onChange={(e) => setAuditNotes(e.target.value)}
              />
            </div>

            <div className="text-sm text-gray-600">
              <p>Products to audit: {auditMode === 'full' ? products.length : 
                auditMode === 'spot' && selectedCategories.length > 0 ? 
                products.filter(p => selectedCategories.includes(p.category)).length : 0}</p>
            </div>
          </div>

          <div className="flex justify-end space-x-3 p-6 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (auditMode === 'spot' && selectedCategories.length === 0) {
                  toast.error('Please select at least one category for spot check');
                  return;
                }
                initializeAuditData();
                setAuditStarted(true);
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Start Audit
            </button>
          </div>
        </div>
      </div>
      </ModalPortal>
    );
  }

  if (auditData.length === 0) {
    return (
      <ModalPortal>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">No products found for audit</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      </ModalPortal>
    );
  }

  const currentProduct = auditData[currentProductIndex];
  const { positive, negative, totalItems } = getDiscrepancySummary();
  const progress = Math.round(((currentProductIndex + 1) / auditData.length) * 100);

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`${colors.card.primary} rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden border ${colors.border.primary}`}>
        {/* Header */}
        <div className={`flex justify-between items-center p-6 border-b ${colors.border.primary}`}>
          <div>
            <h2 className={`text-xl font-bold ${colors.text.primary}`}>Inventory Audit</h2>
            <p className={`text-sm ${colors.text.secondary}`}>
              Product {currentProductIndex + 1} of {auditData.length} ({progress}%)
            </p>
          </div>
          <button onClick={onClose} className={`${colors.text.tertiary} hover:${colors.text.secondary} transition-colors`}>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-2">
          <div className={`w-full ${colors.bg.tertiary} rounded-full h-2`}>
            <div 
              className="bg-indigo-600 dark:bg-indigo-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Current Product */}
        <div className="p-6 space-y-4">
          <div className={`${colors.bg.secondary} p-4 rounded-lg`}>
            <h3 className={`text-lg font-semibold ${colors.text.primary}`}>{currentProduct.name}</h3>
            <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
              <div>
                <span className={`${colors.text.secondary}`}>Category:</span> <span className={colors.text.primary}>{currentProduct.category}</span>
              </div>
              <div>
                <span className={`${colors.text.secondary}`}>Barcode:</span> <span className={colors.text.primary}>{currentProduct.barcode}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                System Stock Count
              </label>
              <div className={`text-2xl font-bold ${colors.text.primary}`}>
                {currentProduct.currentStock}
              </div>
            </div>
            
            <div>
              <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                Physical Count
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleStockChange(currentProduct.id, Math.max(0, currentProduct.countedStock - 1))}
                  className="p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                >
                  <MinusIcon className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  min="0"
                  className={`w-20 text-center border rounded-lg px-2 py-1 ${colors.input.primary}`}
                  value={currentProduct.countedStock}
                  onChange={(e) => handleStockChange(currentProduct.id, Math.max(0, parseInt(e.target.value) || 0))}
                />
                <button
                  onClick={() => handleStockChange(currentProduct.id, currentProduct.countedStock + 1)}
                  className="p-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {currentProduct.discrepancy !== 0 && (
            <div className={`p-3 rounded-lg ${
              currentProduct.discrepancy > 0 
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700' 
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700'
            }`}>
              <div className={`font-semibold ${
                currentProduct.discrepancy > 0 
                  ? 'text-green-800 dark:text-green-300' 
                  : 'text-red-800 dark:text-red-300'
              }`}>
                Discrepancy: {currentProduct.discrepancy > 0 ? '+' : ''}{currentProduct.discrepancy}
              </div>
              <div className={`text-sm ${colors.text.secondary} mt-1`}>
                {currentProduct.discrepancy > 0 ? 'Surplus inventory found' : 'Inventory shortage detected'}
              </div>
            </div>
          )}

          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
              Notes (Optional)
            </label>
            <textarea
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              rows="2"
              placeholder="Add notes about this product count..."
              value={currentProduct.notes}
              onChange={(e) => handleProductNotes(currentProduct.id, e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="verified"
              checked={currentProduct.verified}
              onChange={() => handleVerifyProduct(currentProduct.id)}
              className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="verified" className={`text-sm font-medium ${colors.text.primary}`}>
              Count verified and accurate
            </label>
            {currentProduct.verified && (
              <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-gray-50 border-t">
          <h4 className="font-semibold mb-2">Audit Summary</h4>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Discrepancies:</span>
              <div className="font-semibold">{totalItems}</div>
            </div>
            <div>
              <span className="text-green-600">Surplus:</span>
              <div className="font-semibold text-green-600">+{positive}</div>
            </div>
            <div>
              <span className="text-red-600">Shortage:</span>
              <div className="font-semibold text-red-600">-{negative}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className={`border-t ${colors.border.primary} p-6`}>
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={previousProduct}
              disabled={currentProductIndex === 0}
              className={`px-4 py-2 ${colors.text.secondary} border ${colors.border.primary} rounded-lg hover:${colors.bg.secondary} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              Previous
            </button>
            
            <span className={`text-sm ${colors.text.secondary}`}>
              {currentProductIndex + 1} of {auditData.length}
            </span>
            
            <button
              onClick={nextProduct}
              disabled={currentProductIndex === auditData.length - 1}
              className={`px-4 py-2 ${colors.text.secondary} border ${colors.border.primary} rounded-lg hover:${colors.bg.secondary} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
            >
              Next
            </button>
          </div>

          <div className="flex space-x-2">
            <button
              onClick={onClose}
              className={`px-4 py-2 ${colors.text.secondary} border ${colors.border.primary} rounded-lg hover:${colors.bg.secondary} transition-colors`}
            >
              Cancel
            </button>
            
            {currentProductIndex === auditData.length - 1 ? (
              <button
                onClick={completeAudit}
                disabled={isProcessing}
                className="px-6 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Complete Audit'}
              </button>
            ) : (
              <button
                onClick={nextProduct}
                className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default InventoryAuditModal; 