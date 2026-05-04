import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import { inventoryBatchService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { formatDate } from '../../utils/formatters';
import {
  BATCH_STATUS_CONFIG,
  getBatchDisplayStatus,
  getDaysUntilExpiry,
} from '../../utils/batchStatus';

const TopExpiringBatches = ({ refreshKey = 0 }) => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // Pull active batches with an expiry date, soonest first; cap at 5
      const data = await inventoryBatchService.getAll({
        sort: 'expiry_asc',
        status: 'active',
        limit: 50,
      });
      const filtered = (Array.isArray(data) ? data : [])
        .filter((b) => b.expiryDate && (Number(b.quantity) || 0) > 0)
        .slice(0, 5);
      setBatches(filtered);
    } catch (err) {
      console.error('Failed to load expiring batches:', err);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  return (
    <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <ClockIcon className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className={`text-lg font-bold ${colors.text.primary} leading-tight`}>Top 5 Expiring Batches</h3>
            <p className={`text-xs ${colors.text.secondary}`}>Soonest first</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/inventory?tab=batches')}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-700 text-sm font-semibold inline-flex items-center gap-1"
        >
          View All <ArrowTrendingUpIcon className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-12 rounded-lg ${colors.bg.secondary} animate-pulse`} />
          ))}
        </div>
      ) : batches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <ClipboardDocumentListIcon className={`h-10 w-10 mb-2 ${colors.text.tertiary}`} />
          <p className={`text-sm font-medium ${colors.text.primary}`}>No batches with upcoming expiry</p>
          <p className={`text-xs ${colors.text.secondary} mt-0.5`}>Add batches to start tracking.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {batches.map((b) => {
            const ds = getBatchDisplayStatus(b);
            const cfg = BATCH_STATUS_CONFIG[ds] || BATCH_STATUS_CONFIG.active;
            const days = getDaysUntilExpiry(b.expiryDate);
            return (
              <li
                key={b.id}
                onClick={() => navigate(`/inventory?tab=batches&batchId=${encodeURIComponent(b.id)}`)}
                className={`group cursor-pointer flex items-center gap-3 p-2.5 rounded-xl border-l-4 ${cfg.border} ${colors.bg.secondary} hover:${colors.bg.tertiary} transition-all`}
                title="Click to view in Batches"
              >
                <span className={`flex-shrink-0 inline-flex items-center justify-center w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-semibold ${colors.text.primary} truncate`}>
                      {b.productName || 'Unknown'}
                    </p>
                    {ds === 'expired' && (
                      <ExclamationTriangleIcon className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className={`text-xs ${colors.text.secondary} truncate`}>
                    Batch #{b.batchNumber || b.id.slice(0, 8)} · Exp {formatDate(b.expiryDate)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <span className={`text-[11px] font-semibold ${cfg.text}`}>
                    {days === null
                      ? '—'
                      : days < 0
                        ? `${Math.abs(days)}d ago`
                        : days === 0
                          ? 'today'
                          : `in ${days}d`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default TopExpiringBatches;
