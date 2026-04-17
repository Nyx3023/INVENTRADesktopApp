import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  ArchiveBoxIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  TrashIcon,
  MagnifyingGlassIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import { usePermissions } from '../../context/AuthContext';
import { productService } from '../../services/api';
import { formatDate, formatCurrency } from '../../utils/formatters';
import ModalPortal from '../common/ModalPortal';
import AdminOverrideModal from '../common/AdminOverrideModal';
import EmptyState from '../common/EmptyState';

const PAGE_SIZE = 15;

const DeletedProductsScreen = () => {
  const { colors } = useTheme();
  const { hasPermission } = usePermissions();

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [restoreCandidate, setRestoreCandidate] = useState(null);
  const [permanentCandidate, setPermanentCandidate] = useState(null);
  const [showAdminOverride, setShowAdminOverride] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productService.listDeleted({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: debouncedSearch,
        sort: 'deleted_desc',
      });
      setItems(res.rows || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load deleted products', err);
      toast.error('Failed to load deleted products');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleRestore = async (product) => {
    setProcessing(true);
    try {
      await productService.restore(product.id);
      toast.success(`Restored "${product.name}"`);
      setRestoreCandidate(null);
      await loadItems();
    } catch (err) {
      console.error('Restore failed', err);
      toast.error(err.message || 'Failed to restore product');
    } finally {
      setProcessing(false);
    }
  };

  const handlePermanentDelete = async (product) => {
    setProcessing(true);
    try {
      await productService.permanentDelete(product.id);
      toast.success(`Permanently deleted "${product.name}"`);
      setPermanentCandidate(null);
      await loadItems();
    } catch (err) {
      console.error('Permanent delete failed', err);
      if (err.message?.includes('referenced')) {
        toast.error('Cannot permanently delete: referenced by past transactions');
      } else {
        toast.error(err.message || 'Failed to permanently delete product');
      }
    } finally {
      setProcessing(false);
    }
  };

  const canPermanentlyDelete = hasPermission('delete_product');

  return (
    <div className="space-y-6">
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-gray-500 to-gray-700 rounded-xl text-white">
              <ArchiveBoxIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${colors.text.primary}`}>Deleted Products</h2>
              <p className={`text-sm ${colors.text.secondary}`}>
                {total} archived {total === 1 ? 'product' : 'products'} available to restore
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <MagnifyingGlassIcon className={`h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 ${colors.text.tertiary}`} />
              <input
                type="text"
                value={search}
                onChange={(e) => { setPage(1); setSearch(e.target.value); }}
                placeholder="Search deleted products..."
                className={`pl-10 pr-3 py-2 rounded-xl border ${colors.input.primary}`}
              />
            </div>
            <button
              onClick={loadItems}
              className={`px-4 py-2 rounded-xl font-medium flex items-center gap-2 ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
            >
              <ArrowPathIcon className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className={colors.bg.secondary}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Product</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Category</th>
                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Price</th>
                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Qty</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Deleted At</th>
                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${colors.border.primary}`}>
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-3" />
                    <p className={colors.text.secondary}>Loading…</p>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={ArchiveBoxIcon}
                      title={debouncedSearch ? 'No matches found' : 'No deleted products'}
                      description={
                        debouncedSearch
                          ? 'Try a different search term.'
                          : 'Products you delete will appear here and can be restored.'
                      }
                    />
                  </td>
                </tr>
              ) : items.map((p) => (
                <tr key={p.id} className={`hover:${colors.bg.secondary} transition-colors`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                      ) : (
                        <div className={`h-10 w-10 rounded-lg ${colors.bg.tertiary} flex items-center justify-center`}>
                          <ArchiveBoxIcon className={`h-5 w-5 ${colors.text.tertiary}`} />
                        </div>
                      )}
                      <div>
                        <p className={`text-sm font-medium ${colors.text.primary}`}>{p.name}</p>
                        {p.barcode && (
                          <p className={`text-xs ${colors.text.tertiary} font-mono`}>{p.barcode}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-3 text-sm ${colors.text.secondary}`}>{p.category_name || '—'}</td>
                  <td className={`px-6 py-3 text-sm text-right ${colors.text.primary}`}>{formatCurrency(p.price)}</td>
                  <td className={`px-6 py-3 text-sm text-right ${colors.text.secondary}`}>{p.quantity}</td>
                  <td className={`px-6 py-3 text-sm ${colors.text.secondary}`}>
                    {p.deleted_at ? formatDate(p.deleted_at) : '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setRestoreCandidate(p)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium"
                      >
                        <ArrowUturnLeftIcon className="h-4 w-4" />
                        Restore
                      </button>
                      {canPermanentlyDelete && (
                        <button
                          onClick={() => setPermanentCandidate(p)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className={`px-6 py-4 border-t ${colors.border.primary} flex items-center justify-between`}>
            <p className={`text-sm ${colors.text.secondary}`}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`p-2 rounded-lg ${page === 1 ? `${colors.text.tertiary} cursor-not-allowed` : `${colors.text.secondary} hover:${colors.bg.secondary}`}`}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
              <span className={`px-4 py-2 text-sm font-medium ${colors.text.primary}`}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className={`p-2 rounded-lg ${page === totalPages ? `${colors.text.tertiary} cursor-not-allowed` : `${colors.text.secondary} hover:${colors.bg.secondary}`}`}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Restore confirmation */}
      {restoreCandidate && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => !processing && setRestoreCandidate(null)}
          >
            <div
              className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Restore Product</h3>
              </div>
              <div className="px-6 py-4">
                <p className={`text-sm ${colors.text.secondary} mb-4`}>
                  Restore <span className={`font-semibold ${colors.text.primary}`}>{restoreCandidate.name}</span> to the active inventory?
                </p>
              </div>
              <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
                <button
                  onClick={() => setRestoreCandidate(null)}
                  disabled={processing}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRestore(restoreCandidate)}
                  disabled={processing}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <ArrowUturnLeftIcon className="h-5 w-5" />
                  {processing ? 'Restoring...' : 'Restore'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Permanent delete confirmation (requires admin override) */}
      {permanentCandidate && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => !processing && setPermanentCandidate(null)}
          >
            <div
              className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-6 py-4 border-b ${colors.border.primary} flex items-center gap-2`}>
                <ExclamationTriangleIcon className="h-6 w-6 text-red-500" />
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Permanently Delete Product</h3>
              </div>
              <div className="px-6 py-4">
                <p className={`text-sm ${colors.text.secondary} mb-3`}>
                  This will <strong className="text-red-600">permanently remove</strong> <span className={`font-semibold ${colors.text.primary}`}>{permanentCandidate.name}</span> from the database.
                </p>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-sm text-red-800 dark:text-red-300">
                    This cannot be undone. Products referenced by past transactions cannot be permanently deleted.
                  </p>
                </div>
              </div>
              <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
                <button
                  onClick={() => setPermanentCandidate(null)}
                  disabled={processing}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowAdminOverride(true)}
                  disabled={processing}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  <TrashIcon className="h-5 w-5" />
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      <AdminOverrideModal
        isOpen={showAdminOverride}
        onClose={() => setShowAdminOverride(false)}
        onSuccess={() => {
          setShowAdminOverride(false);
          if (permanentCandidate) {
            handlePermanentDelete(permanentCandidate);
          }
        }}
        actionDescription={`permanently delete "${permanentCandidate?.name || 'product'}"`}
        context="permanent_delete_product"
      />
    </div>
  );
};

export default DeletedProductsScreen;
