import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  XMarkIcon,
  ClockIcon,
  ArrowPathIcon,
  PencilSquareIcon,
  ScaleIcon,
  ArrowsRightLeftIcon,
  ShoppingCartIcon,
  FunnelIcon,
  CubeIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import { productService } from '../../services/api';
import { formatCurrency } from '../../utils/formatters';
import ModalPortal from '../common/ModalPortal';

const TYPE_CONFIG = {
  activity: {
    label: 'Activity',
    icon: PencilSquareIcon,
    tone: 'blue',
    classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    iconClasses: 'text-blue-600 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30',
  },
  adjustment: {
    label: 'Adjustment',
    icon: ScaleIcon,
    tone: 'purple',
    classes: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    iconClasses: 'text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/30',
  },
  movement: {
    label: 'Movement',
    icon: ArrowsRightLeftIcon,
    tone: 'amber',
    classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    iconClasses: 'text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30',
  },
  sale: {
    label: 'Sale',
    icon: ShoppingCartIcon,
    tone: 'emerald',
    classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    iconClasses: 'text-emerald-600 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30',
  },
};

const formatTimestamp = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const humanizeAction = (action) => {
  if (!action) return '';
  return action
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const renderEventSummary = (event) => {
  const d = event.details || {};
  switch (event.type) {
    case 'adjustment': {
      const change = d.quantityChange;
      const sign = change > 0 ? '+' : '';
      return (
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-semibold">{humanizeAction(d.adjustmentType || 'Adjustment')}</span>
            <span className="mx-2">·</span>
            <span className={`font-semibold ${change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {sign}{change}
            </span>
            <span className="opacity-70"> ({d.quantityBefore} → {d.quantityAfter})</span>
          </p>
          {d.reason && <p className="text-xs opacity-80">Reason: {d.reason}</p>}
          {d.notes && <p className="text-xs opacity-70 italic">"{d.notes}"</p>}
        </div>
      );
    }
    case 'movement': {
      return (
        <div className="space-y-1">
          <p className="text-sm">
            <span className="font-semibold">{humanizeAction(d.movementType || 'Movement')}</span>
            <span className="mx-2">·</span>
            <span>Qty: <span className="font-semibold">{d.quantity}</span></span>
          </p>
          {(d.fromLocation || d.toLocation) && (
            <p className="text-xs opacity-80">
              {d.fromLocation || '—'} → {d.toLocation || '—'}
            </p>
          )}
          {d.referenceNumber && <p className="text-xs opacity-70">Ref: {d.referenceNumber}</p>}
          {d.notes && <p className="text-xs opacity-70 italic">"{d.notes}"</p>}
        </div>
      );
    }
    case 'sale': {
      const profitTone = d.lineProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
      return (
        <div className="space-y-1">
          <p className="text-sm">
            Sold <span className="font-semibold">{d.quantity}</span> @ {formatCurrency(d.unitPrice)}
            <span className="mx-2">·</span>
            Total: <span className="font-semibold">{formatCurrency(d.lineTotal)}</span>
          </p>
          <p className="text-xs">
            <span className={`font-semibold ${profitTone}`}>
              Profit: {formatCurrency(d.lineProfit)}
            </span>
            {d.referenceNumber && <span className="opacity-70 ml-2">· Ref: {d.referenceNumber}</span>}
            {d.status && d.status !== 'completed' && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] uppercase tracking-wider">
                {d.status}
              </span>
            )}
          </p>
        </div>
      );
    }
    case 'activity':
    default: {
      const a = event.action;
      if (a === 'UPDATE_PRODUCT' && (d.before || d.after)) {
        const changed = d.changed_fields || [];
        if (changed.length === 0 && d.message) return <p className="text-sm">{d.message}</p>;
        return (
          <div className="space-y-1">
            <p className="text-sm font-semibold">Updated: {changed.length ? changed.map(humanizeAction).join(', ') : 'fields'}</p>
            {changed.slice(0, 4).map((field) => {
              const bv = d.before?.[field];
              const av = d.after?.[field];
              return (
                <p key={field} className="text-xs opacity-80">
                  <span className="font-medium">{humanizeAction(field)}:</span>{' '}
                  <span className="line-through opacity-70">{String(bv ?? '—')}</span>
                  {' → '}
                  <span className="font-semibold">{String(av ?? '—')}</span>
                </p>
              );
            })}
          </div>
        );
      }
      if (a === 'PRODUCT_PRICE_CHANGE') {
        return (
          <p className="text-sm">
            Price: <span className="line-through opacity-70">{formatCurrency(d.oldPrice)}</span>{' → '}
            <span className="font-semibold">{formatCurrency(d.newPrice)}</span>
          </p>
        );
      }
      if (a === 'CREATE_PRODUCT') return <p className="text-sm">Created product{d.productName ? `: ${d.productName}` : ''}</p>;
      if (a === 'DELETE_PRODUCT') return <p className="text-sm">Soft-deleted product{d.productName ? `: ${d.productName}` : ''}</p>;
      if (a === 'RESTORE_PRODUCT') return <p className="text-sm">Restored product{d.productName ? `: ${d.productName}` : ''}</p>;
      if (a === 'PERMANENT_DELETE_PRODUCT') return <p className="text-sm">Permanently deleted product{d.productName ? `: ${d.productName}` : ''}</p>;
      return <p className="text-sm">{d.message || humanizeAction(a)}</p>;
    }
  }
};

const ProductHistoryDrawer = ({ isOpen, onClose, product }) => {
  const { colors } = useTheme();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState(
    new Set(['activity', 'adjustment', 'movement', 'sale'])
  );

  const load = useCallback(async () => {
    if (!product?.id) return;
    setLoading(true);
    try {
      const types = Array.from(selectedTypes).join(',');
      const res = await productService.getHistory(product.id, { limit: 200, types });
      setEvents(res.rows || []);
    } catch (err) {
      console.error('Failed to load product history', err);
      toast.error('Failed to load product history');
    } finally {
      setLoading(false);
    }
  }, [product?.id, selectedTypes]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const toggleType = (type) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      if (next.size === 0) next.add(type);
      return next;
    });
  };

  if (!isOpen || !product) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-black/50 flex justify-end z-50"
        onClick={onClose}
      >
        <div
          className={`${colors.card.primary} w-full max-w-2xl h-full shadow-2xl border-l ${colors.border.primary} flex flex-col animate-slideInRight`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`px-6 py-4 border-b ${colors.border.primary} flex items-start justify-between`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl text-white">
                <ClockIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Product History</h3>
                <p className={`text-sm ${colors.text.secondary} line-clamp-1`}>{product.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg ${colors.text.tertiary} hover:${colors.text.primary} hover:${colors.bg.secondary}`}
              title="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Filter pills */}
          <div className={`px-6 py-3 border-b ${colors.border.primary} flex items-center gap-2 flex-wrap`}>
            <FunnelIcon className={`h-4 w-4 ${colors.text.tertiary}`} />
            {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
              const active = selectedTypes.has(type);
              const Icon = cfg.icon;
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                    active
                      ? cfg.classes
                      : `${colors.bg.tertiary} ${colors.text.tertiary} opacity-60`
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {cfg.label}
                  {active && <CheckCircleIcon className="h-3 w-3" />}
                </button>
              );
            })}
            <button
              onClick={load}
              className={`ml-auto p-1.5 rounded-lg ${colors.text.tertiary} hover:${colors.text.primary} hover:${colors.bg.secondary}`}
              title="Refresh"
            >
              <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {loading && events.length === 0 ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-3" />
                <p className={colors.text.secondary}>Loading history…</p>
              </div>
            ) : events.length === 0 ? (
              <div className="py-16 text-center">
                <CubeIcon className={`h-12 w-12 mx-auto mb-3 ${colors.text.tertiary}`} />
                <p className={`font-medium ${colors.text.primary}`}>No history yet</p>
                <p className={`text-sm ${colors.text.secondary} mt-1`}>
                  Changes, adjustments, movements, and sales will appear here.
                </p>
              </div>
            ) : (
              <ol className="relative border-l-2 border-dashed border-slate-200 dark:border-slate-700 ml-4 space-y-5">
                {events.map((event) => {
                  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.activity;
                  const Icon = cfg.icon;
                  return (
                    <li key={event.id} className="ml-6 relative">
                      <span className={`absolute -left-[38px] top-1 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900 ${cfg.iconClasses}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className={`${colors.bg.secondary} rounded-xl p-3.5 border ${colors.border.primary}`}>
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded ${cfg.classes}`}>
                              {cfg.label}
                            </span>
                            <span className={`text-xs font-medium ${colors.text.secondary}`}>
                              {humanizeAction(event.action)}
                            </span>
                          </div>
                          <time className={`text-xs ${colors.text.tertiary} whitespace-nowrap`}>
                            {formatTimestamp(event.timestamp)}
                          </time>
                        </div>
                        <div className={colors.text.primary}>{renderEventSummary(event)}</div>
                        {event.userName && (
                          <p className={`text-xs ${colors.text.tertiary} mt-2`}>
                            by {event.userName}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default ProductHistoryDrawer;
