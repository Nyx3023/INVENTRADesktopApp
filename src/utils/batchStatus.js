// Single source of truth for batch expiry display status across the app.

export const BATCH_STATUSES = {
  ACTIVE: 'active',
  NEAR_EXPIRY: 'near_expiry',
  CRITICAL: 'critical',
  EXPIRED: 'expired',
  DEPLETED: 'depleted',
};

export const BATCH_STATUS_CONFIG = {
  active: {
    label: 'Active',
    short: 'Active',
    dot: 'bg-green-500',
    badge:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-700',
    border: 'border-green-500',
    text: 'text-green-700 dark:text-green-400',
  },
  near_expiry: {
    label: 'Near Expiry',
    short: 'Near Expiry',
    dot: 'bg-yellow-500',
    badge:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700',
    border: 'border-yellow-500',
    text: 'text-yellow-700 dark:text-yellow-400',
  },
  critical: {
    label: 'Critical',
    short: 'Critical',
    dot: 'bg-orange-500',
    badge:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200 border border-orange-200 dark:border-orange-700',
    border: 'border-orange-500',
    text: 'text-orange-700 dark:text-orange-400',
  },
  expired: {
    label: 'Expired',
    short: 'Expired',
    dot: 'bg-red-500',
    badge:
      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 border border-red-200 dark:border-red-700',
    border: 'border-red-500',
    text: 'text-red-700 dark:text-red-400',
  },
  depleted: {
    label: 'Depleted',
    short: 'Depleted',
    dot: 'bg-gray-400',
    badge:
      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-600',
    border: 'border-gray-400',
    text: 'text-gray-600 dark:text-gray-400',
  },
};

/** Difference in whole days between expiry date and local "today" (midnight basis). */
export function getDaysUntilExpiry(expiryDate) {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return null;
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  return Math.round((startOfExp - startOfToday) / (1000 * 60 * 60 * 24));
}

/**
 * Resolve display status from batch fields (matches server computeBatchDisplayStatus).
 * Honors optional batch.displayStatus from API when present.
 */
export function getBatchDisplayStatus(batch) {
  if (!batch) return BATCH_STATUSES.ACTIVE;
  if (batch.displayStatus && BATCH_STATUS_CONFIG[batch.displayStatus]) {
    return batch.displayStatus;
  }
  const qty = Number(batch.quantity) || 0;
  if (batch.status === 'depleted' || qty <= 0) {
    return BATCH_STATUSES.DEPLETED;
  }
  if (!batch.expiryDate) return BATCH_STATUSES.ACTIVE;
  const exp = new Date(batch.expiryDate);
  if (Number.isNaN(exp.getTime())) return BATCH_STATUSES.ACTIVE;
  const days = getDaysUntilExpiry(batch.expiryDate);
  if (days === null) return BATCH_STATUSES.ACTIVE;
  if (days < 0) return BATCH_STATUSES.EXPIRED;
  if (days <= 3) return BATCH_STATUSES.CRITICAL;
  if (days <= 7) return BATCH_STATUSES.NEAR_EXPIRY;
  return BATCH_STATUSES.ACTIVE;
}
