import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  BellIcon,
  XMarkIcon,
  CheckIcon,
  TrashIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import { notificationService } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { BATCH_STATUS_CONFIG } from '../../utils/batchStatus';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'expiry', label: 'Expiry alerts' },
  { value: 'other', label: 'Other' },
];

const severityRank = { expired: 0, critical: 1, near_expiry: 2 };

const NotificationCenter = () => {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState({
    total: 0,
    near_expiry: 0,
    critical: 0,
    expired: 0,
    byType: {},
  });
  const [filter, setFilter] = useState('all');

  const fetchUnreadCount = useCallback(async () => {
    try {
      const data = await notificationService.unreadCount();
      setCounts((prev) => ({
        ...prev,
        total: data.total ?? 0,
        near_expiry: data.near_expiry ?? 0,
        critical: data.critical ?? 0,
        expired: data.expired ?? 0,
        byType: data.byType ?? {},
      }));
    } catch {
      /* ignore */
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (filter === 'expiry') params.category = 'expiry';
      else if (filter === 'other') params.category = 'other';
      const data = await notificationService.list(params);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const t = setInterval(() => {
      fetchUnreadCount();
      fetchNotifications();
    }, 45000);
    return () => clearInterval(t);
  }, [open, fetchUnreadCount, fetchNotifications]);

  const maybeToastUrgent = useCallback(() => {
    const unread = notifications.filter((n) => !n.isRead);
    if (unread.length === 0) return;
    const sorted = [...unread].sort((a, b) => {
      const ar = severityRank[a.severity] ?? 99;
      const br = severityRank[b.severity] ?? 99;
      if (ar !== br) return ar - br;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    const top = sorted[0];
    if (top.severity === 'expired' || top.severity === 'critical') {
      const key = `urgent-toast-${top.id}`;
      if (!sessionStorage.getItem(key)) {
        toast.error(top.message, { duration: 6000, icon: '!' });
        sessionStorage.setItem(key, '1');
      }
    }
  }, [notifications]);

  useEffect(() => {
    if (notifications.length > 0) maybeToastUrgent();
  }, [notifications, maybeToastUrgent]);

  const handleMarkRead = async (n) => {
    if (n.isRead) return;
    try {
      await notificationService.markRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      fetchUnreadCount();
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      setNotifications((prev) => prev.map((x) => ({ ...x, isRead: true })));
      setCounts((c) => ({
        ...c,
        total: 0,
        near_expiry: 0,
        critical: 0,
        expired: 0,
        byType: {},
      }));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (e, n) => {
    e.stopPropagation();
    try {
      await notificationService.remove(n.id);
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      if (!n.isRead) fetchUnreadCount();
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleOpenNotification = async (n) => {
    await handleMarkRead(n);
    setOpen(false);
    if (n.batchId) {
      navigate(`/inventory?tab=batches&batchId=${encodeURIComponent(n.batchId)}`);
    } else {
      navigate('/inventory?tab=batches');
    }
  };

  const badgeText = counts.total > 99 ? '99+' : String(counts.total);
  const hasUrgent = counts.expired > 0 || counts.critical > 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative inline-flex p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10 ${open ? 'bg-white/10' : ''}`}
        title="Notifications"
        aria-label="Notifications"
      >
        <BellIcon className="h-6 w-6" />
        {counts.total > 0 && (
          <span
            className={`absolute -top-0.5 -right-0.5 min-w-[1.25rem] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center border border-slate-900/40 ${
              hasUrgent ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-900 dark:bg-slate-600 dark:text-white'
            }`}
          >
            {badgeText}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" aria-hidden onClick={() => setOpen(false)} />
          <div
            className={`absolute right-0 mt-2 w-[min(100vw-1rem,22rem)] max-h-[min(70vh,520px)] z-[70] flex flex-col rounded-2xl border shadow-2xl overflow-hidden ${colors.card.primary} ${colors.border.primary}`}
          >
            <div className={`px-4 py-3 border-b ${colors.border.primary} flex items-start justify-between gap-2`}>
              <div>
                <h3 className={`text-sm font-bold ${colors.text.primary}`}>Notifications</h3>
                <p className={`text-xs ${colors.text.secondary}`}>
                  {counts.total > 0 ? `${counts.total} unread` : 'All caught up'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  disabled={counts.total === 0}
                  className="p-1.5 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 disabled:opacity-40"
                  title="Mark all read"
                >
                  <CheckIcon className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={`p-1.5 rounded-lg ${colors.text.secondary} hover:bg-white/10`}
                  title="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className={`px-3 py-2 border-b ${colors.border.primary} flex flex-wrap gap-1.5`}>
              {FILTER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilter(opt.value)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === opt.value
                      ? 'bg-blue-600 text-white'
                      : `${colors.bg.secondary} ${colors.text.secondary}`
                  }`}
                >
                  <FunnelIcon className="h-3.5 w-3.5 opacity-80" />
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 min-h-0">
              {loading ? (
                <div className={`px-4 py-8 text-center text-sm ${colors.text.secondary}`}>Loading…</div>
              ) : notifications.length === 0 ? (
                <div className={`px-4 py-8 text-center text-sm ${colors.text.secondary}`}>
                  {filter === 'all' ? 'No notifications yet.' : 'Nothing in this filter.'}
                </div>
              ) : (
                <ul className={`divide-y ${colors.border.primary}`}>
                  {notifications.map((n) => {
                    const cfg = BATCH_STATUS_CONFIG[n.severity] || BATCH_STATUS_CONFIG.active;
                    return (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => handleOpenNotification(n)}
                          className={`w-full text-left px-4 py-3 flex gap-3 hover:opacity-95 transition-colors ${
                            !n.isRead ? `${colors.bg.secondary}/80` : ''
                          }`}
                        >
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold ${colors.text.primary}`}>{n.title}</p>
                            <p className={`text-xs mt-0.5 ${colors.text.secondary} line-clamp-3`}>{n.message}</p>
                            <p className={`text-[10px] mt-1 ${colors.text.tertiary}`}>
                              {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {!n.isRead && (
                              <button
                                type="button"
                                onClick={() => handleMarkRead(n)}
                                className="p-1 rounded text-blue-500 hover:bg-blue-500/10"
                                title="Mark read"
                              >
                                <CheckIcon className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, n)}
                              className="p-1 rounded text-red-500 hover:bg-red-500/10"
                              title="Dismiss"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className={`px-3 py-2 border-t ${colors.border.primary}`}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/inventory?tab=batches');
                }}
                className={`w-full text-center text-xs font-medium py-2 rounded-lg ${colors.bg.secondary} ${colors.text.secondary}`}
              >
                View batch management
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationCenter;
