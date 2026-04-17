import { useState, useEffect, useMemo } from 'react';
import {
  XMarkIcon,
  ArrowUturnLeftIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PrinterIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import { refundService, transactionService } from '../../services/api';
import { toast } from 'react-hot-toast';
import { formatCurrency, formatDate } from '../../utils/formatters';
import ModalPortal from '../common/ModalPortal';
import EmptyState from '../common/EmptyState';

const REFUND_REASONS = [
  'Defective / damaged product',
  'Wrong item delivered',
  'Customer changed mind',
  'Pricing error',
  'Duplicate charge',
  'Expired product',
  'Other',
];

const RefundModal = ({ transaction, onClose, onRefunded }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refundable, setRefundable] = useState(null);
  const [lineState, setLineState] = useState({});
  const [reason, setReason] = useState(REFUND_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!transaction?.id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await transactionService.getRefundable(transaction.id);
        if (cancelled) return;
        setRefundable(data);
        const initial = {};
        for (const it of data.items || []) {
          initial[it.productId] = { quantity: 0, returnToStock: true };
        }
        setLineState(initial);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load refundable items');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [transaction?.id]);

  const setLineQty = (productId, raw, max) => {
    let q = Number(raw);
    if (!Number.isFinite(q) || q < 0) q = 0;
    if (q > max) q = max;
    setLineState(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || { returnToStock: true }), quantity: q },
    }));
  };

  const toggleReturnToStock = (productId) => {
    setLineState(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { quantity: 0 }),
        returnToStock: !prev[productId]?.returnToStock,
      },
    }));
  };

  const setAll = (pct) => {
    if (!refundable) return;
    setLineState(prev => {
      const next = { ...prev };
      for (const it of refundable.items || []) {
        const max = it.refundableQuantity;
        const qty = Math.floor(max * pct);
        next[it.productId] = {
          ...(next[it.productId] || { returnToStock: true }),
          quantity: qty,
        };
      }
      return next;
    });
  };

  const totals = useMemo(() => {
    if (!refundable) return { amount: 0, count: 0 };
    let amount = 0;
    let count = 0;
    for (const it of refundable.items || []) {
      const qty = lineState[it.productId]?.quantity || 0;
      amount += qty * (it.unitPrice || 0);
      count += qty;
    }
    return { amount, count };
  }, [refundable, lineState]);

  const effectiveReason = reason === 'Other' ? customReason.trim() : reason;
  const canSubmit =
    !submitting &&
    !loading &&
    totals.count > 0 &&
    effectiveReason.length > 0 &&
    !success;

  const printRefundReceipt = () => {
    if (!success || !refundable) return;
    const items = (refundable.items || [])
      .map(it => {
        const state = lineState[it.productId];
        if (!state || !state.quantity) return null;
        return {
          name: it.name,
          quantity: state.quantity,
          unitPrice: it.unitPrice,
          subtotal: state.quantity * it.unitPrice,
          returnToStock: state.returnToStock !== false,
        };
      })
      .filter(Boolean);

    const storeName = 'INVENTRA';
    const dateStr = formatDate(new Date().toISOString());
    const rows = items
      .map(it => `
        <tr>
          <td style="padding:2px 0">
            ${it.name}<br>
            <span style="font-size:10px;color:#666">
              ${it.quantity} × ${formatCurrency(it.unitPrice)}
              ${it.returnToStock ? ' • returned to stock' : ' • NOT returned to stock'}
            </span>
          </td>
          <td style="padding:2px 0;text-align:right;vertical-align:top">${formatCurrency(it.subtotal)}</td>
        </tr>
      `)
      .join('');

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Refund Receipt ${success.id}</title>
          <style>
            body { font-family: 'Courier New', monospace; font-size: 12px; max-width: 320px; margin: 12px auto; color: #111; }
            h1 { font-size: 16px; text-align: center; margin: 0 0 4px; }
            h2 { font-size: 13px; text-align: center; margin: 0 0 12px; letter-spacing: 2px; }
            hr { border: 0; border-top: 1px dashed #000; margin: 8px 0; }
            table { width: 100%; border-collapse: collapse; }
            .right { text-align: right; }
            .muted { color: #555; font-size: 11px; }
            .total { font-size: 14px; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>${storeName}</h1>
          <h2>REFUND RECEIPT</h2>
          <div class="muted">Refund ID: ${success.id}</div>
          <div class="muted">Original Txn: ${transaction.id}</div>
          <div class="muted">Date: ${dateStr}</div>
          <div class="muted">Reason: ${effectiveReason}</div>
          ${notes ? `<div class="muted">Notes: ${notes}</div>` : ''}
          <hr>
          <table>${rows}</table>
          <hr>
          <table>
            <tr>
              <td class="total">TOTAL REFUND</td>
              <td class="right total">${formatCurrency(success.totalAmount || totals.amount)}</td>
            </tr>
          </table>
          <hr>
          <div class="muted" style="text-align:center">
            New status: ${success.transactionStatus}<br>
            Thank you — please keep this receipt for your records.
          </div>
          <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 100); };<\/script>
        </body>
      </html>
    `;

    const w = window.open('', '_blank', 'width=380,height=600');
    if (!w) {
      toast.error('Could not open print window. Please allow popups.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      setSubmitting(true);
      setError(null);
      const items = [];
      for (const it of refundable.items || []) {
        const state = lineState[it.productId];
        if (!state || !state.quantity) continue;
        items.push({
          productId: it.productId,
          quantity: state.quantity,
          unitPrice: it.unitPrice,
          returnToStock: state.returnToStock !== false,
        });
      }
      if (items.length === 0) {
        throw new Error('Select at least one item to refund');
      }
      const res = await refundService.create({
        transactionId: transaction.id,
        reason: effectiveReason,
        notes: notes.trim() || undefined,
        items,
      });
      setSuccess(res);
      toast.success(`Refunded ${formatCurrency(res.totalAmount || totals.amount)}`);
      if (onRefunded) onRefunded(res);
    } catch (e) {
      setError(e.message || 'Failed to create refund');
      toast.error(e.message || 'Failed to create refund');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
        onClick={() => !submitting && onClose && onClose()}
      >
        <div
          className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-3xl max-h-[90vh] flex flex-col`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`px-6 py-4 border-b ${colors.border.primary} flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
                <ArrowUturnLeftIcon className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>
                  {success ? 'Refund Complete' : 'Issue Refund'}
                </h3>
                <p className={`text-xs ${colors.text.tertiary}`}>
                  Transaction #{transaction?.id}
                  {refundable?.transactionDate ? ` • ${formatDate(refundable.transactionDate)}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={submitting}
              className={`p-2 rounded-lg ${colors.text.tertiary} hover:${colors.bg.secondary} disabled:opacity-50`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className={`animate-pulse ${colors.text.tertiary}`}>Loading refundable items…</div>
              </div>
            ) : error && !success ? (
              <div className="p-6">
                <div className="p-4 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-3">
                  <ExclamationTriangleIcon className="h-5 w-5 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-rose-700 dark:text-rose-300">{error}</div>
                </div>
              </div>
            ) : success ? (
              <div className="p-6">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-start gap-3">
                  <CheckCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-emerald-700 dark:text-emerald-300">
                    <div className="font-semibold">Refund issued successfully.</div>
                    <div className="mt-1">
                      Refund ID: <span className="font-mono">{success.id}</span>
                    </div>
                    <div>Total refunded: {formatCurrency(success.totalAmount || totals.amount)}</div>
                    <div>New transaction status: {success.transactionStatus}</div>
                  </div>
                </div>
              </div>
            ) : !refundable || (refundable.items || []).length === 0 ? (
              <EmptyState
                title="No refundable items"
                description="This transaction has no items available to refund."
              />
            ) : (
              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className={`text-sm ${colors.text.secondary}`}>
                    Select quantities to refund.
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setAll(0)}
                      className={`text-xs px-2 py-1 rounded border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary}`}
                    >
                      None
                    </button>
                    <button
                      type="button"
                      onClick={() => setAll(1)}
                      className={`text-xs px-2 py-1 rounded border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary}`}
                    >
                      Refund All
                    </button>
                  </div>
                </div>

                <div className={`border ${colors.border.primary} rounded-lg overflow-hidden`}>
                  <table className="w-full text-sm">
                    <thead className={`${colors.bg.secondary} ${colors.text.secondary}`}>
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Product</th>
                        <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                        <th className="px-3 py-2 text-right font-medium">Sold</th>
                        <th className="px-3 py-2 text-right font-medium">Refunded</th>
                        <th className="px-3 py-2 text-right font-medium">Refund Qty</th>
                        <th className="px-3 py-2 text-center font-medium">Return to Stock</th>
                        <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${colors.border.primary}`}>
                      {(refundable.items || []).map(it => {
                        const state = lineState[it.productId] || { quantity: 0, returnToStock: true };
                        const max = it.refundableQuantity;
                        const disabled = max <= 0;
                        return (
                          <tr key={it.productId} className={disabled ? 'opacity-50' : ''}>
                            <td className={`px-3 py-2 ${colors.text.primary}`}>
                              <div className="font-medium">{it.name}</div>
                              {it.barcode && (
                                <div className={`text-xs ${colors.text.tertiary}`}>{it.barcode}</div>
                              )}
                            </td>
                            <td className={`px-3 py-2 text-right ${colors.text.secondary}`}>
                              {formatCurrency(it.unitPrice)}
                            </td>
                            <td className={`px-3 py-2 text-right ${colors.text.secondary}`}>
                              {it.quantity}
                            </td>
                            <td className={`px-3 py-2 text-right ${colors.text.secondary}`}>
                              {it.refundedQuantity || 0}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min="0"
                                max={max}
                                value={state.quantity}
                                disabled={disabled}
                                onChange={(e) => setLineQty(it.productId, e.target.value, max)}
                                className={`w-20 px-2 py-1 text-right rounded border ${colors.input.primary} disabled:opacity-50`}
                              />
                              <div className={`text-xs ${colors.text.tertiary}`}>of {max}</div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={state.returnToStock !== false}
                                disabled={disabled || state.quantity === 0}
                                onChange={() => toggleReturnToStock(it.productId)}
                                className="h-4 w-4"
                              />
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${colors.text.primary}`}>
                              {formatCurrency((state.quantity || 0) * (it.unitPrice || 0))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div>
                  <label className={`block text-xs font-medium ${colors.text.secondary} mb-1`}>
                    Reason *
                  </label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
                  >
                    {REFUND_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  {reason === 'Other' && (
                    <input
                      type="text"
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Enter custom reason"
                      className={`w-full mt-2 px-3 py-2 rounded-lg border ${colors.input.primary}`}
                    />
                  )}
                </div>

                <div>
                  <label className={`block text-xs font-medium ${colors.text.secondary} mb-1`}>
                    Notes (optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary}`}
                    placeholder="Any additional details"
                  />
                </div>

                <div className={`${colors.bg.secondary} p-4 rounded-lg flex items-center justify-between`}>
                  <div>
                    <div className={`text-xs ${colors.text.tertiary}`}>Items to refund</div>
                    <div className={`text-lg font-semibold ${colors.text.primary}`}>{totals.count}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs ${colors.text.tertiary}`}>Refund amount</div>
                    <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                      {formatCurrency(totals.amount)}
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg text-sm text-rose-700 dark:text-rose-300">
                    {error}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={`px-4 py-2 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} disabled:opacity-50`}
            >
              {success ? 'Close' : 'Cancel'}
            </button>
            {success && (
              <button
                type="button"
                onClick={printRefundReceipt}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-medium inline-flex items-center gap-2"
              >
                <PrinterIcon className="h-5 w-5" />
                Print Refund Receipt
              </button>
            )}
            {!success && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 dark:disabled:bg-rose-900 text-white rounded-lg font-medium inline-flex items-center gap-2"
              >
                <ArrowUturnLeftIcon className="h-5 w-5" />
                {submitting ? 'Processing…' : `Refund ${formatCurrency(totals.amount)}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default RefundModal;
