import { useEffect, useState, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { auditService, productService } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import {
  ClipboardDocumentListIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CubeIcon,
  ClipboardDocumentCheckIcon,
  MinusIcon,
} from '@heroicons/react/24/outline';
import LazyPageLoader from '../common/LazyPageLoader';

const AuditsScreen = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [audits, setAudits] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(null);
  const [auditInProgress, setAuditInProgress] = useState(false);

  // Audit creation state
  const [auditType, setAuditType] = useState('full');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [auditCounts, setAuditCounts] = useState({});
  const [auditNotes, setAuditNotes] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const auditsPerPage = 10;

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [auditList, productList] = await Promise.all([
        auditService.getAll(),
        productService.getAll()
      ]);
      setAudits(auditList || []);
      setProducts(productList || []);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load audit data');
      setAudits([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startAudit = () => {
    setShowCreateModal(true);
    setAuditType('full');
    setSelectedProducts([]);
    setAuditCounts({});
    setAuditNotes('');
  };

  const initializeAuditCounts = () => {
    const productsToAudit = auditType === 'full' ? products : selectedProducts;
    const counts = {};
    productsToAudit.forEach(p => {
      counts[p.id] = { expectedQty: parseInt(p.quantity || 0), actualQty: '' };
    });
    setAuditCounts(counts);
    setAuditInProgress(true);
  };

  const updateActualCount = (productId, value) => {
    setAuditCounts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        actualQty: value === '' ? '' : parseInt(value) || 0
      }
    }));
  };

  const calculateDiscrepancy = (productId) => {
    const count = auditCounts[productId];
    if (count && count.actualQty !== '') {
      return count.actualQty - count.expectedQty;
    }
    return null;
  };

  const submitAudit = async () => {
    try {
      const productsToAudit = auditType === 'full' ? products : selectedProducts;
      const results = [];
      let discrepanciesFound = 0;
      let totalAdjustments = 0;

      for (const product of productsToAudit) {
        const count = auditCounts[product.id];
        if (count && count.actualQty !== '') {
          const discrepancy = count.actualQty - count.expectedQty;
          if (discrepancy !== 0) {
            discrepanciesFound++;
            totalAdjustments += Math.abs(discrepancy);
          }
          results.push({
            productId: product.id,
            productName: product.name,
            expectedQty: count.expectedQty,
            actualQty: count.actualQty,
            discrepancy
          });
        }
      }

      const auditData = {
        audit_date: new Date().toISOString(),
        audit_type: auditType,
        products_audited: results.length,
        discrepancies_found: discrepanciesFound,
        total_adjustments: totalAdjustments,
        notes: auditNotes,
        results,
        userId: user?.id,
        userName: user?.name,
        userEmail: user?.email,
      };

      await auditService.create(auditData);
      toast.success('Audit completed and saved!');
      setShowCreateModal(false);
      setAuditInProgress(false);
      await loadData();
    } catch (error) {
      console.error('Failed to save audit:', error);
      toast.error('Failed to save audit');
    }
  };

  const cancelAudit = () => {
    setShowCreateModal(false);
    setAuditInProgress(false);
    setAuditCounts({});
    setSelectedProducts([]);
    setAuditNotes('');
  };

  const toggleProductSelection = (product) => {
    setSelectedProducts(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) {
        return prev.filter(p => p.id !== product.id);
      }
      return [...prev, product];
    });
  };

  // Parse results from JSON string if needed
  const parseResults = (audit) => {
    if (!audit.results) return [];
    if (typeof audit.results === 'string') {
      try {
        return JSON.parse(audit.results);
      } catch {
        return [];
      }
    }
    return audit.results;
  };

  // Pagination
  const totalPages = Math.ceil(audits.length / auditsPerPage);
  const startIndex = (currentPage - 1) * auditsPerPage;
  const paginatedAudits = audits.slice(startIndex, startIndex + auditsPerPage);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // formatDate is now imported from utils/formatters.js

  if (isLoading) {
    return (
      <LazyPageLoader
        title="Loading audit data"
        subtitle="Fetching audit history and counts..."
        rows={5}
        centered
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl text-white">
              <ClipboardDocumentListIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Inventory Audits</h1>
              <p className={`text-sm ${colors.text.secondary}`}>
                {audits.length} audit{audits.length !== 1 ? 's' : ''} recorded
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
            >
              <ArrowPathIcon className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={startAudit}
              className="btn-primary inline-flex items-center gap-2"
            >
              <PlusIcon className="h-5 w-5" />
              New Audit
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${colors.card.primary} p-6 rounded-xl shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <ClipboardDocumentCheckIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className={`text-sm ${colors.text.secondary}`}>Total Audits</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{audits.length}</p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-xl shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <CubeIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className={`text-sm ${colors.text.secondary}`}>Products Audited</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>
                {audits.reduce((sum, a) => sum + (parseInt(a.products_audited) || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-xl shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
              <ExclamationTriangleIcon className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className={`text-sm ${colors.text.secondary}`}>Total Discrepancies</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>
                {audits.reduce((sum, a) => sum + (parseInt(a.discrepancies_found) || 0), 0)}
              </p>
            </div>
          </div>
        </div>

        <div className={`${colors.card.primary} p-6 rounded-xl shadow border ${colors.border.primary}`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
              <ArrowPathIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className={`text-sm ${colors.text.secondary}`}>Total Adjustments</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>
                {audits.reduce((sum, a) => sum + (parseInt(a.total_adjustments) || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Audits Table */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Date</th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Type</th>
                <th className={`px-6 py-4 text-center text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Products</th>
                <th className={`px-6 py-4 text-center text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Discrepancies</th>
                <th className={`px-6 py-4 text-center text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Adjustments</th>
                <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Notes</th>
                <th className={`px-6 py-4 text-center text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {paginatedAudits.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <ClipboardDocumentListIcon className={`h-12 w-12 mx-auto mb-4 ${colors.text.tertiary}`} />
                    <p className={`${colors.text.secondary}`}>No audits found. Start a new audit!</p>
                  </td>
                </tr>
              ) : (
                paginatedAudits.map(audit => (
                  <tr key={audit.id} className={`hover:${colors.bg.secondary} transition-colors`}>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.primary}`}>
                      {formatDate(audit.audit_date)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm`}>
                      <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${audit.audit_type === 'full'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                        }`}>
                        {audit.audit_type === 'full' ? 'Full Audit' : 'Partial Audit'}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-center text-sm ${colors.text.secondary}`}>
                      {audit.products_audited}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-sm font-medium ${parseInt(audit.discrepancies_found) > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-green-600 dark:text-green-400'
                        }`}>
                        {audit.discrepancies_found}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-center text-sm ${colors.text.secondary}`}>
                      {audit.total_adjustments}
                    </td>
                    <td className={`px-6 py-4 text-sm ${colors.text.secondary} max-w-xs truncate`}>
                      {audit.notes || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setShowResultsModal(audit)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className={`px-6 py-4 border-t ${colors.border.primary} flex items-center justify-between`}>
            <p className={`text-sm ${colors.text.secondary}`}>
              Showing {startIndex + 1} to {Math.min(startIndex + auditsPerPage, audits.length)} of {audits.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg ${currentPage === 1 ? `${colors.text.tertiary} cursor-not-allowed` : `${colors.text.secondary} hover:${colors.bg.secondary}`}`}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className={`px-4 py-2 text-sm font-medium ${colors.text.primary}`}>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg ${currentPage === totalPages ? `${colors.text.tertiary} cursor-not-allowed` : `${colors.text.secondary} hover:${colors.bg.secondary}`}`}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Audit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={cancelAudit}>
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-4xl max-h-[90vh] flex flex-col`}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-xl font-bold ${colors.text.primary}`}>
                    {auditInProgress ? 'Conduct Audit' : 'New Inventory Audit'}
                  </h3>
                  <p className={`text-sm ${colors.text.secondary} mt-1`}>
                    {auditInProgress ? 'Enter actual stock counts' : 'Select audit type and products'}
                  </p>
                </div>
                <button
                  onClick={cancelAudit}
                  className={`p-2 rounded-lg hover:${colors.bg.secondary} transition-colors`}
                >
                  <XMarkIcon className={`h-6 w-6 ${colors.text.secondary}`} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {!auditInProgress ? (
                <div className="space-y-6">
                  {/* Audit Type Selection */}
                  <div>
                    <label className={`block text-sm font-medium mb-3 ${colors.text.primary}`}>Audit Type</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setAuditType('full')}
                        className={`p-4 rounded-xl border-2 transition-all ${auditType === 'full'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : `${colors.border.primary} hover:${colors.border.secondary}`
                          }`}
                      >
                        <ClipboardDocumentCheckIcon className={`h-8 w-8 mx-auto mb-2 ${auditType === 'full' ? 'text-blue-500' : colors.text.tertiary}`} />
                        <p className={`font-medium ${colors.text.primary}`}>Full Audit</p>
                        <p className={`text-sm ${colors.text.secondary}`}>Audit all {products.length} products</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuditType('partial')}
                        className={`p-4 rounded-xl border-2 transition-all ${auditType === 'partial'
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                          : `${colors.border.primary} hover:${colors.border.secondary}`
                          }`}
                      >
                        <CubeIcon className={`h-8 w-8 mx-auto mb-2 ${auditType === 'partial' ? 'text-purple-500' : colors.text.tertiary}`} />
                        <p className={`font-medium ${colors.text.primary}`}>Partial Audit</p>
                        <p className={`text-sm ${colors.text.secondary}`}>Select specific products</p>
                      </button>
                    </div>
                  </div>

                  {/* Product Selection (for partial audit) */}
                  {auditType === 'partial' && (
                    <div>
                      <label className={`block text-sm font-medium mb-3 ${colors.text.primary}`}>
                        Select Products ({selectedProducts.length} selected)
                      </label>
                      <div className={`max-h-60 overflow-y-auto border rounded-xl ${colors.border.primary}`}>
                        {products.map(product => (
                          <div
                            key={product.id}
                            onClick={() => toggleProductSelection(product)}
                            className={`flex items-center gap-3 p-3 cursor-pointer border-b last:border-b-0 ${colors.border.primary} hover:${colors.bg.secondary} transition-colors ${selectedProducts.find(p => p.id === product.id) ? `${colors.bg.secondary}` : ''
                              }`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedProducts.find(p => p.id === product.id)
                              ? 'border-blue-500 bg-blue-500'
                              : colors.border.primary
                              }`}>
                              {selectedProducts.find(p => p.id === product.id) && (
                                <CheckIcon className="h-3 w-3 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium ${colors.text.primary}`}>{product.name}</p>
                              <p className={`text-sm ${colors.text.secondary}`}>Current Stock: {product.quantity}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>Notes (Optional)</label>
                    <textarea
                      value={auditNotes}
                      onChange={e => setAuditNotes(e.target.value)}
                      rows={3}
                      className={`w-full border rounded-xl px-4 py-3 ${colors.input.primary}`}
                      placeholder="Add any notes about this audit..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Audit Counting */}
                  <div className={`border rounded-xl overflow-hidden ${colors.border.primary}`}>
                    <table className="min-w-full">
                      <thead className={colors.bg.secondary}>
                        <tr>
                          <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Product</th>
                          <th className={`px-4 py-3 text-center text-xs font-medium ${colors.text.secondary} uppercase`}>Expected</th>
                          <th className={`px-4 py-3 text-center text-xs font-medium ${colors.text.secondary} uppercase`}>Actual Count</th>
                          <th className={`px-4 py-3 text-center text-xs font-medium ${colors.text.secondary} uppercase`}>Difference</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${colors.border.primary}`}>
                        {Object.entries(auditCounts).map(([productId, count]) => {
                          const product = products.find(p => p.id === productId);
                          const discrepancy = calculateDiscrepancy(productId);
                          return (
                            <tr key={productId}>
                              <td className={`px-4 py-3 ${colors.text.primary}`}>{product?.name || 'Unknown'}</td>
                              <td className={`px-4 py-3 text-center ${colors.text.secondary}`}>{count.expectedQty}</td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  value={count.actualQty}
                                  onChange={e => updateActualCount(productId, e.target.value)}
                                  className={`w-24 text-center border rounded-lg px-3 py-2 ${colors.input.primary}`}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-4 py-3 text-center">
                                {discrepancy !== null && (
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${discrepancy > 0
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                    : discrepancy < 0
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                      : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                                    }`}>
                                    {discrepancy > 0 ? <PlusIcon className="h-3 w-3" /> : discrepancy < 0 ? <MinusIcon className="h-3 w-3" /> : null}
                                    {Math.abs(discrepancy)}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-between`}>
              <button
                onClick={cancelAudit}
                className="px-6 py-2.5 bg-gray-600 dark:bg-gray-500 text-white rounded-xl hover:bg-gray-700 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Cancel
              </button>
              {!auditInProgress ? (
                <button
                  onClick={initializeAuditCounts}
                  disabled={auditType === 'partial' && selectedProducts.length === 0}
                  className={`px-6 py-2.5 rounded-xl font-medium inline-flex items-center gap-2 transition-colors ${auditType === 'partial' && selectedProducts.length === 0
                    ? 'bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed'
                    : 'btn-primary'
                    }`}
                >
                  <ClipboardDocumentCheckIcon className="h-5 w-5" />
                  Start Counting
                </button>
              ) : (
                <button
                  onClick={submitAudit}
                  className="btn-primary px-6 py-2.5 rounded-xl font-medium inline-flex items-center gap-2"
                >
                  <CheckIcon className="h-5 w-5" />
                  Complete Audit
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowResultsModal(null)}>
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-3xl max-h-[90vh] flex flex-col`}
            onClick={e => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-xl font-bold ${colors.text.primary}`}>Audit Details</h3>
              <p className={`text-sm ${colors.text.secondary}`}>
                {formatDate(showResultsModal.audit_date)} • {showResultsModal.audit_type === 'full' ? 'Full Audit' : 'Partial Audit'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className={`${colors.bg.secondary} p-4 rounded-xl text-center`}>
                  <p className={`text-2xl font-bold ${colors.text.primary}`}>{showResultsModal.products_audited}</p>
                  <p className={`text-sm ${colors.text.secondary}`}>Products Audited</p>
                </div>
                <div className={`${colors.bg.secondary} p-4 rounded-xl text-center`}>
                  <p className={`text-2xl font-bold ${parseInt(showResultsModal.discrepancies_found) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    {showResultsModal.discrepancies_found}
                  </p>
                  <p className={`text-sm ${colors.text.secondary}`}>Discrepancies</p>
                </div>
                <div className={`${colors.bg.secondary} p-4 rounded-xl text-center`}>
                  <p className={`text-2xl font-bold ${colors.text.primary}`}>{showResultsModal.total_adjustments}</p>
                  <p className={`text-sm ${colors.text.secondary}`}>Adjustments</p>
                </div>
              </div>

              {/* Results Table */}
              {parseResults(showResultsModal).length > 0 && (
                <div className={`border rounded-xl overflow-hidden ${colors.border.primary} mb-4`}>
                  <table className="min-w-full">
                    <thead className={colors.bg.secondary}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase`}>Product</th>
                        <th className={`px-4 py-3 text-center text-xs font-medium ${colors.text.secondary} uppercase`}>Expected</th>
                        <th className={`px-4 py-3 text-center text-xs font-medium ${colors.text.secondary} uppercase`}>Actual</th>
                        <th className={`px-4 py-3 text-center text-xs font-medium ${colors.text.secondary} uppercase`}>Difference</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${colors.border.primary}`}>
                      {parseResults(showResultsModal).map((result, idx) => (
                        <tr key={idx}>
                          <td className={`px-4 py-3 ${colors.text.primary}`}>{result.productName}</td>
                          <td className={`px-4 py-3 text-center ${colors.text.secondary}`}>{result.expectedQty}</td>
                          <td className={`px-4 py-3 text-center ${colors.text.secondary}`}>{result.actualQty}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${result.discrepancy > 0
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                              : result.discrepancy < 0
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                              }`}>
                              {result.discrepancy > 0 ? '+' : ''}{result.discrepancy}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Notes */}
              {showResultsModal.notes && (
                <div>
                  <p className={`text-sm font-medium ${colors.text.primary} mb-2`}>Notes</p>
                  <p className={`${colors.text.secondary} ${colors.bg.secondary} p-4 rounded-xl`}>
                    {showResultsModal.notes}
                  </p>
                </div>
              )}
            </div>

            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end`}>
              <button
                onClick={() => setShowResultsModal(null)}
                className="px-6 py-2.5 bg-gray-600 dark:bg-gray-500 text-white rounded-xl hover:bg-gray-700 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditsScreen;
