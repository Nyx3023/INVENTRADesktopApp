import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  BanknotesIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  PlusCircleIcon,
  CheckCircleIcon,
  UserIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ReceiptPercentIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { transactionService } from '../../services/api';
import { formatCurrency, formatDate } from '../../utils/formatters';
import ModalPortal from '../common/ModalPortal';
import EmptyState from '../common/EmptyState';

const PAGE_SIZE = 10;

const LayawayScreen = () => {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [activeTransaction, setActiveTransaction] = useState(null);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await transactionService.listLayaway({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: debouncedSearch,
      });
      setRows(res.rows || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load layaway', err);
      toast.error('Failed to load layaway transactions');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const loadPayments = async (transactionId) => {
    setPaymentsLoading(true);
    try {
      const res = await transactionService.getPayments(transactionId);
      setPayments(res.rows || []);
    } catch (err) {
      console.error('Failed to load payments', err);
      toast.error('Failed to load payment history');
      setPayments([]);
    } finally {
      setPaymentsLoading(false);
    }
  };

  const openDetails = async (txn) => {
    setActiveTransaction(txn);
    await loadPayments(txn.id);
  };

  const openPaymentModal = (txn) => {
    setActiveTransaction(txn);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentRef('');
    setPaymentNotes('');
    setShowPaymentModal(true);
  };

  const submitPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    const balance = Number(activeTransaction.balance_due) || 0;
    if (amount > balance + 0.0001) {
      toast.error(`Payment exceeds remaining balance of ${formatCurrency(balance)}`);
      return;
    }
    if (paymentMethod !== 'cash' && !paymentRef.trim()) {
      toast.error('Reference number is required for non-cash payments');
      return;
    }

    setSubmittingPayment(true);
    try {
      const res = await transactionService.addPayment(activeTransaction.id, {
        amount,
        paymentMethod,
        referenceNumber: paymentRef.trim() || null,
        notes: paymentNotes.trim() || null,
      });
      if (res.status === 'paid') {
        toast.success('Layaway fully paid!');
      } else {
        toast.success(`Payment recorded. Remaining balance: ${formatCurrency(res.balanceDue)}`);
      }
      setShowPaymentModal(false);
      setActiveTransaction(null);
      await load();
    } catch (err) {
      console.error('Payment failed', err);
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summary = rows.reduce(
    (acc, r) => {
      acc.totalBalance += Number(r.balance_due) || 0;
      acc.totalPaid += (Number(r.total) || 0) - (Number(r.balance_due) || 0);
      return acc;
    },
    { totalBalance: 0, totalPaid: 0 }
  );

  return (
    <div className="space-y-6">
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl text-white">
              <ReceiptPercentIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className={`text-2xl font-bold ${colors.text.primary}`}>Layaway</h2>
              <p className={`text-sm ${colors.text.secondary}`}>
                {total} active {total === 1 ? 'layaway' : 'layaways'} · {formatCurrency(summary.totalBalance)} outstanding
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
                placeholder="Search by ID or customer..."
                className={`pl-10 pr-3 py-2 rounded-xl border ${colors.input.primary}`}
              />
            </div>
            <button
              onClick={load}
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
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Transaction</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Customer</th>
                <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Opened</th>
                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Total</th>
                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Paid</th>
                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Balance</th>
                <th className={`px-6 py-3 text-right text-xs font-medium uppercase tracking-wider ${colors.text.secondary}`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${colors.border.primary}`}>
              {loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500/30 border-t-indigo-500 mx-auto mb-3" />
                    <p className={colors.text.secondary}>Loading…</p>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState
                      icon={ReceiptPercentIcon}
                      title={debouncedSearch ? 'No matches found' : 'No active layaways'}
                      description={
                        debouncedSearch
                          ? 'Try a different search term.'
                          : 'Create a layaway from the POS by choosing "Layaway" at checkout.'
                      }
                    />
                  </td>
                </tr>
              ) : rows.map((r) => {
                const paid = (Number(r.total) || 0) - (Number(r.balance_due) || 0);
                const progressPct = r.total > 0 ? Math.min(100, (paid / r.total) * 100) : 0;
                return (
                  <tr key={r.id} className={`hover:${colors.bg.secondary} transition-colors`}>
                    <td className="px-6 py-3">
                      <p className={`text-sm font-medium ${colors.text.primary} font-mono`}>{r.id}</p>
                      {r.reference_number && (
                        <p className={`text-xs ${colors.text.tertiary}`}>Ref: {r.reference_number}</p>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <p className={`text-sm ${colors.text.primary}`}>{r.customer_name || '—'}</p>
                      {r.customer_phone && (
                        <p className={`text-xs ${colors.text.tertiary}`}>{r.customer_phone}</p>
                      )}
                    </td>
                    <td className={`px-6 py-3 text-sm ${colors.text.secondary}`}>{formatDate(r.timestamp)}</td>
                    <td className={`px-6 py-3 text-sm text-right font-medium ${colors.text.primary}`}>{formatCurrency(r.total)}</td>
                    <td className="px-6 py-3 text-right">
                      <p className={`text-sm font-medium text-emerald-600 dark:text-emerald-400`}>{formatCurrency(paid)}</p>
                      <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden ml-auto">
                        <div
                          className="h-full bg-emerald-500 transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className={`text-[10px] ${colors.text.tertiary} mt-0.5`}>{progressPct.toFixed(0)}%</p>
                    </td>
                    <td className={`px-6 py-3 text-sm text-right font-bold ${(Number(r.balance_due) || 0) > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatCurrency(r.balance_due)}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetails(r)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
                          title="View payment history"
                        >
                          <ClockIcon className="h-4 w-4" />
                          History
                        </button>
                        <button
                          onClick={() => openPaymentModal(r)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                        >
                          <PlusCircleIcon className="h-4 w-4" />
                          Add Payment
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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

      {/* Payment history drawer */}
      {activeTransaction && !showPaymentModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/50 flex justify-end z-50"
            onClick={() => setActiveTransaction(null)}
          >
            <div
              className={`${colors.card.primary} w-full max-w-md h-full shadow-2xl border-l ${colors.border.primary} flex flex-col`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-6 py-4 border-b ${colors.border.primary} flex items-center justify-between`}>
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Payment History</h3>
                  <p className={`text-xs ${colors.text.tertiary} font-mono`}>{activeTransaction.id}</p>
                </div>
                <button
                  onClick={() => setActiveTransaction(null)}
                  className={`p-2 rounded-lg ${colors.text.tertiary} hover:${colors.text.primary}`}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className={`px-6 py-4 ${colors.bg.secondary} border-b ${colors.border.primary}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={colors.text.secondary}>Total</span>
                  <span className={`font-semibold ${colors.text.primary}`}>{formatCurrency(activeTransaction.total)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={colors.text.secondary}>Paid</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency((Number(activeTransaction.total) || 0) - (Number(activeTransaction.balance_due) || 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={colors.text.secondary}>Balance</span>
                  <span className="font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(activeTransaction.balance_due)}
                  </span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {paymentsLoading ? (
                  <div className="py-16 text-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500/30 border-t-indigo-500 mx-auto mb-3" />
                    <p className={colors.text.secondary}>Loading payments…</p>
                  </div>
                ) : payments.length === 0 ? (
                  <EmptyState
                    icon={BanknotesIcon}
                    title="No payments yet"
                    description="Payments will appear here as they're recorded."
                    size="compact"
                  />
                ) : payments.map((p) => (
                  <div key={p.id} className={`${colors.bg.secondary} rounded-xl p-3 border ${colors.border.primary}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BanknotesIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className={`font-semibold ${colors.text.primary}`}>{formatCurrency(p.amount)}</span>
                        <span className={`px-2 py-0.5 text-[10px] rounded uppercase tracking-wider ${colors.bg.tertiary} ${colors.text.secondary}`}>
                          {p.payment_method}
                        </span>
                      </div>
                      <span className={`text-xs ${colors.text.tertiary}`}>{formatDate(p.created_at)}</span>
                    </div>
                    {p.reference_number && (
                      <p className={`text-xs mt-1 ${colors.text.tertiary}`}>Ref: {p.reference_number}</p>
                    )}
                    {p.user_name && (
                      <p className={`text-xs mt-0.5 ${colors.text.tertiary} flex items-center gap-1`}>
                        <UserIcon className="h-3 w-3" /> {p.user_name}
                      </p>
                    )}
                    {p.notes && <p className={`text-xs italic mt-1 ${colors.text.tertiary}`}>"{p.notes}"</p>}
                  </div>
                ))}
              </div>

              <div className={`p-4 border-t ${colors.border.primary}`}>
                <button
                  onClick={() => {
                    setShowPaymentModal(true);
                  }}
                  disabled={(Number(activeTransaction.balance_due) || 0) <= 0}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold inline-flex items-center justify-center gap-2"
                >
                  <PlusCircleIcon className="h-5 w-5" />
                  Add Payment
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Payment modal */}
      {showPaymentModal && activeTransaction && (
        <ModalPortal>
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => !submittingPayment && setShowPaymentModal(false)}
          >
            <div
              className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Record Payment</h3>
                <p className={`text-sm ${colors.text.secondary}`}>
                  Balance remaining: <span className="font-semibold text-red-600 dark:text-red-400">{formatCurrency(activeTransaction.balance_due)}</span>
                </p>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className={`block text-xs font-medium ${colors.text.secondary} mb-1`}>Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
                    placeholder="0.00"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(String(activeTransaction.balance_due))}
                    className="mt-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Pay full balance ({formatCurrency(activeTransaction.balance_due)})
                  </button>
                </div>
                <div>
                  <label className={`block text-xs font-medium ${colors.text.secondary} mb-1`}>Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['cash', 'card', 'gcash'].map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 px-3 rounded-lg border text-sm font-medium capitalize ${
                          paymentMethod === m
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : `${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary}`
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                {paymentMethod !== 'cash' && (
                  <div>
                    <label className={`block text-xs font-medium ${colors.text.secondary} mb-1`}>Reference Number</label>
                    <input
                      type="text"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
                      placeholder="e.g. GCASH-1234-5678"
                    />
                  </div>
                )}
                <div>
                  <label className={`block text-xs font-medium ${colors.text.secondary} mb-1`}>Notes (optional)</label>
                  <textarea
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    rows={2}
                    className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary} resize-none`}
                  />
                </div>
              </div>
              <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  disabled={submittingPayment}
                  className={`px-4 py-2 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button
                  onClick={submitPayment}
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium inline-flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  {submittingPayment ? 'Recording…' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default LayawayScreen;
