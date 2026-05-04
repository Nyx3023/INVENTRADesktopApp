import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import {
  XMarkIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import { inventoryBatchService } from '../../services/api';
import { formatDate } from '../../utils/formatters';
import {
  BATCH_STATUS_CONFIG,
  getBatchDisplayStatus,
  getDaysUntilExpiry,
} from '../../utils/batchStatus';
import ModalPortal from '../common/ModalPortal';
import BatchFormModal from './BatchFormModal';

const ProductBatchesModal = ({ product, onClose, onChanged }) => {
  const { colors } = useTheme();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!product?.id) return;
    setLoading(true);
    try {
      const data = await inventoryBatchService.getByProduct(product.id);
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load batches');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  // Esc closes top-level modal (only when no nested confirm/form is open)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && !showForm && !confirmDelete) onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showForm, confirmDelete]);

  const sortedBatches = useMemo(() => {
    return [...batches].sort((a, b) => {
      const aD = a.expiryDate ? new Date(a.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      const bD = b.expiryDate ? new Date(b.expiryDate).getTime() : Number.POSITIVE_INFINITY;
      return aD - bD;
    });
  }, [batches]);

  const totals = useMemo(() => {
    const active = batches.filter((b) => b.status !== 'depleted' && (b.quantity || 0) > 0);
    const totalQty = active.reduce((s, b) => s + (Number(b.quantity) || 0), 0);
    const expiringSoon = active.filter((b) => {
      const ds = getBatchDisplayStatus(b);
      return ds === 'near_expiry' || ds === 'critical';
    }).length;
    const expired = active.filter((b) => getBatchDisplayStatus(b) === 'expired').length;
    return { totalQty, count: active.length, expiringSoon, expired };
  }, [batches]);

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
      await load();
      onChanged?.();
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Failed to delete batch');
    } finally {
      setDeleting(false);
    }
  };

  const handleSaved = async () => {
    await load();
    onChanged?.();
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      >
        <div
          className={`w-full max-w-5xl max-h-[92vh] flex flex-col ${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${colors.border.primary} bg-slate-50/50 dark:bg-slate-800/20`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <ClipboardDocumentListIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className={`text-xl font-bold ${colors.text.primary}`}>
                  Batches · {product?.name || 'Product'}
                </h2>
                <p className={`text-xs ${colors.text.secondary} mt-0.5`}>
                  {totals.count} active · {totals.totalQty} units in stock
                  {totals.expiringSoon > 0 && (
                    <> · <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{totals.expiringSoon} expiring soon</span></>
                  )}
                  {totals.expired > 0 && (
                    <> · <span className="text-red-600 dark:text-red-400 font-semibold">{totals.expired} expired</span></>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className={`p-2 rounded-xl transition-colors hover:${colors.bg.secondary}`}
                title="Refresh"
              >
                <ArrowPathIcon className={`h-5 w-5 ${colors.text.secondary}`} />
              </button>
              <button
                onClick={handleAdd}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Add Batch
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
                title="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className={`p-12 text-center text-sm ${colors.text.secondary}`}>
                Loading batches...
              </div>
            ) : sortedBatches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardDocumentListIcon className={`h-14 w-14 mb-3 ${colors.text.tertiary}`} />
                <p className={`text-base font-semibold ${colors.text.primary}`}>No batches yet</p>
                <p className={`text-sm ${colors.text.secondary} mt-1 mb-4`}>
                  Track inventory by lot number, supplier, and expiry date.
                </p>
                <button
                  onClick={handleAdd}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add the first batch
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className={`min-w-full divide-y ${colors.border.primary}`}>
                  <thead className={`${colors.bg.secondary}`}>
                    <tr>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Batch ID</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Product</th>
                      <th className={`px-4 py-3 text-right text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Quantity</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Received</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Expiry</th>
                      <th className={`px-4 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Status</th>
                      <th className={`px-4 py-3 text-right text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
                    {sortedBatches.map((batch) => {
                      const ds = getBatchDisplayStatus(batch);
                      const cfg = BATCH_STATUS_CONFIG[ds] || BATCH_STATUS_CONFIG.active;
                      const days = getDaysUntilExpiry(batch.expiryDate);
                      return (
                        <tr key={batch.id} className={`hover:${colors.bg.secondary} transition-colors`}>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-mono ${colors.text.primary}`}>
                            {batch.batchNumber || (
                              <span className={`italic ${colors.text.tertiary}`}>{batch.id.slice(0, 8)}</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                            {batch.productName || product?.name || '—'}
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-semibold ${colors.text.primary}`}>
                            {batch.quantity}
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
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${cfg.badge}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
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
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className={`px-6 py-3 border-t ${colors.border.primary} ${colors.bg.secondary} flex justify-end`}>
            <button
              onClick={onClose}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${colors.text.primary} hover:${colors.bg.tertiary} transition-colors`}
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Nested: Add/Edit form modal */}
      {showForm && (
        <BatchFormModal
          isOpen={showForm}
          mode={editingBatch ? 'edit' : 'create'}
          batch={editingBatch}
          lockedProduct={!editingBatch ? product : null}
          onClose={() => {
            setShowForm(false);
            setEditingBatch(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {/* Nested: Delete confirmation */}
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
                    Product: {confirmDelete.productName || product?.name}
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
    </ModalPortal>
  );
};

export default ProductBatchesModal;
