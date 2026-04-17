const envSource =
  (typeof window !== 'undefined' && window.__THESIS_POS_ENV__) ||
  (typeof process !== 'undefined' ? process.env : {}) ||
  {};

export const API_BASE = envSource.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${API_BASE.replace(/\/$/, '')}/api`;

const hasNativeBridge = typeof window !== 'undefined' && !!window.ThesisPOS?.invoke;
const canResolveAssets = typeof window !== 'undefined' && !!window.ThesisPOS?.resolveAsset;

const nativeCall = async (resource, action, payload = {}) => {
  if (!hasNativeBridge || !window.ThesisPOS?.invoke) {
    throw new Error('Native bridge unavailable');
  }
  const response = await window.ThesisPOS.invoke('api:request', {
    resource,
    action,
    payload,
  });
  if (!response?.ok) {
    throw new Error(response?.error || 'Native request failed');
  }
  return response.data;
};

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Request failed');
  }
  return data;
};

const resolveAssetUrl = async (assetPath) => {
  if (!assetPath || typeof assetPath !== 'string') {
    return assetPath;
  }

  if (
    assetPath.startsWith('http://') ||
    assetPath.startsWith('https://') ||
    assetPath.startsWith('file://') ||
    assetPath.startsWith('data:')
  ) {
    return assetPath;
  }

  if (assetPath.startsWith('/uploads/') && canResolveAssets) {
    try {
      const resolved = await window.ThesisPOS.resolveAsset(assetPath);
      if (resolved) {
        return resolved;
      }
    } catch (error) {
      console.warn('[assets] Failed to resolve asset path', assetPath, error);
    }
  }

  return assetPath;
};

const normalizeProduct = async (product) => {
  if (!product) return product;
  const rawImage = product.image_url ?? product.imageUrl ?? '';
  const resolvedImage = await resolveAssetUrl(rawImage || product.imageUrl || '');
  const categoryName = product.category_name ?? product.category ?? null;

  return {
    ...product,
    category_name: categoryName,
    category: categoryName,
    image_url: rawImage || '',
    imageUrl: resolvedImage || rawImage || '',
    status: product.status || 'available',
  };
};

const normalizeProductList = async (products) => {
  if (!Array.isArray(products)) {
    return [];
  }
  return Promise.all(products.map((product) => normalizeProduct(product)));
};

export const authService = {
  login: async ({ email, password }) => {
    if (hasNativeBridge) {
      return nativeCall('auth', 'login', { email, password });
    }
    const data = await fetchJson(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return data;
  },
};

const buildQuery = (params = {}) => {
  const qp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      qp.append(key, value);
    }
  });
  const qs = qp.toString();
  return qs ? `?${qs}` : '';
};

export const productService = {
  // Legacy: returns a plain array (used where pagination is not wanted).
  getAll: async (params) => {
    if (params && typeof params === 'object') {
      return productService.list(params);
    }
    const data = hasNativeBridge
      ? await nativeCall('products', 'list')
      : await fetchJson(`${API_URL}/products`);
    return normalizeProductList(data);
  },

  // Paginated list: returns { rows, total }.
  list: async (params = {}) => {
    if (hasNativeBridge) {
      const data = await nativeCall('products', 'list', params);
      if (data && Array.isArray(data.rows)) {
        data.rows = await normalizeProductList(data.rows);
        return data;
      }
      const rows = await normalizeProductList(data || []);
      return { rows, total: rows.length };
    }
    const data = await fetchJson(`${API_URL}/products${buildQuery(params)}`);
    if (data && Array.isArray(data.rows)) {
      data.rows = await normalizeProductList(data.rows);
      return data;
    }
    const rows = await normalizeProductList(Array.isArray(data) ? data : []);
    return { rows, total: rows.length };
  },

  listDeleted: async (params = {}) => {
    return productService.list({ ...params, includeDeleted: 'only' });
  },

  restore: async (id) => {
    const user = getCurrentUser();
    const payload = {
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
    };
    if (hasNativeBridge) {
      return nativeCall('products', 'restore', { id, ...payload });
    }
    return fetchJson(`${API_URL}/products/${id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  permanentDelete: async (id) => {
    const user = getCurrentUser();
    const payload = {
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
    };
    if (hasNativeBridge) {
      return nativeCall('products', 'permanentDelete', { id, ...payload });
    }
    return fetchJson(`${API_URL}/products/${id}/permanent`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  getHistory: async (id, params = {}) => {
    if (hasNativeBridge) {
      return nativeCall('products', 'history', { id, ...params });
    }
    return fetchJson(`${API_URL}/products/${id}/history${buildQuery(params)}`);
  },

  getById: async (id) => {
    const data = hasNativeBridge
      ? await nativeCall('products', 'get', { id })
      : await fetchJson(`${API_URL}/products/${id}`);
    return normalizeProduct(data);
  },

  create: async (product) => {
    const user = getCurrentUser();
    const payload = {
      ...product,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email
    };

    const data = hasNativeBridge
      ? await nativeCall('products', 'create', { product: payload })
      : await fetchJson(`${API_URL}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    return normalizeProduct(data);
  },

  update: async (id, product) => {
    const user = getCurrentUser();
    const payload = {
      ...product,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email
    };

    const data = hasNativeBridge
      ? await nativeCall('products', 'update', { id, product: payload })
      : await fetchJson(`${API_URL}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    return normalizeProduct(data);
  },

  delete: async (id) => {
    const user = getCurrentUser();
    const payload = {
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email
    };
    
    if (hasNativeBridge) {
      return nativeCall('products', 'delete', { id, ...payload });
    }
    return fetchJson(`${API_URL}/products/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  },

  getReorderSuggestions: async () => {
    try {
      if (hasNativeBridge) {
        return await nativeCall('products', 'getReorderSuggestions');
      }
      // Use AbortController to prevent showing 404 errors in console
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(`${API_URL}/products/reorder-suggestions`, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          // Silently return empty array for any error (404, 500, etc.)
          return [];
        }
        return await response.json();
      } catch (fetchError) {
        clearTimeout(timeoutId);
        // Silently handle all fetch errors (network, abort, 404, etc.)
        return [];
      }
    } catch (error) {
      // Silently return empty array on any error
      return [];
    }
  },

  getInventoryValuation: async () => {
    if (hasNativeBridge) {
      return nativeCall('products', 'getInventoryValuation');
    }
    return fetchJson(`${API_URL}/products/inventory-valuation`);
  },
};

export const transactionService = {
  getAll: async (params = {}) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'list', params);
    }
    return fetchJson(`${API_URL}/transactions${buildQuery(params)}`);
  },

  list: async (params = {}) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'list', params);
    }
    return fetchJson(`${API_URL}/transactions${buildQuery(params)}`);
  },

  getById: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'get', { id });
    }
    return fetchJson(`${API_URL}/transactions/${id}`);
  },

  create: async (transaction) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'create', { transaction });
    }
    return fetchJson(`${API_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
  },

  generateId: async () => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'generateId');
    }
    return fetchJson(`${API_URL}/transactions/generate-id`);
  },

  getByDateRange: async (startDate, endDate) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'list', { startDate, endDate });
    }
    return fetchJson(`${API_URL}/transactions${buildQuery({ startDate, endDate })}`);
  },

  hold: async (transaction) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'hold', { transaction });
    }
    return fetchJson(`${API_URL}/transactions/hold`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
  },

  resume: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'resume', { id });
    }
    return fetchJson(`${API_URL}/transactions/${id}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  deleteHeld: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'deleteHeld', { id });
    }
    return fetchJson(`${API_URL}/transactions/${id}/hold`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  },

  listHeld: async (params = {}) => {
    return transactionService.list({ ...params, status: 'held' });
  },

  listLayaway: async (params = {}) => {
    return transactionService.list({ ...params, status: 'layaway' });
  },

  createLayaway: async (transaction) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'createLayaway', { transaction });
    }
    return fetchJson(`${API_URL}/transactions/layaway`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
  },

  addPayment: async (id, payment) => {
    const user = getCurrentUser();
    const payload = {
      ...payment,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
    };
    if (hasNativeBridge) {
      return nativeCall('transactions', 'addPayment', { id, payment: payload });
    }
    return fetchJson(`${API_URL}/transactions/${id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  getPayments: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'getPayments', { id });
    }
    return fetchJson(`${API_URL}/transactions/${id}/payments`);
  },

  getRefundable: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'getRefundable', { id });
    }
    return fetchJson(`${API_URL}/transactions/${id}/refundable`);
  },

  delete: async (id, userRole) => {
    const user = getCurrentUser();
    if (hasNativeBridge) {
      return nativeCall('transactions', 'archive', { id, userRole, userId: user?.id, userName: user?.name, userEmail: user?.email });
    }
    return fetchJson(`${API_URL}/transactions/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userRole, userId: user?.id, userName: user?.name, userEmail: user?.email }),
    });
  },

  getArchived: async () => {
    if (hasNativeBridge) {
      return nativeCall('transactions', 'list', { archivedOnly: true });
    }
    return fetchJson(`${API_URL}/transactions/archived`);
  },

  restore: async (id, userRole) => {
    const user = getCurrentUser();
    if (hasNativeBridge) {
      return nativeCall('transactions', 'restore', { id, userRole, userId: user?.id, userName: user?.name, userEmail: user?.email });
    }
    return fetchJson(`${API_URL}/transactions/${id}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userRole, userId: user?.id, userName: user?.name, userEmail: user?.email }),
    });
  },

  permanentDelete: async (id, userRole) => {
    const user = getCurrentUser();
    if (hasNativeBridge) {
      return nativeCall('transactions', 'delete', { id, userRole, userId: user?.id, userName: user?.name, userEmail: user?.email });
    }
    return fetchJson(`${API_URL}/transactions/${id}/permanent`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userRole, userId: user?.id, userName: user?.name, userEmail: user?.email }),
    });
  },
};

export const auditService = {
  create: async (audit) => {
    if (hasNativeBridge) {
      return nativeCall('audits', 'create', { audit });
    }
    return fetchJson(`${API_URL}/audits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(audit),
    });
  },

  getAll: async () => {
    if (hasNativeBridge) {
      return nativeCall('audits', 'list');
    }
    return fetchJson(`${API_URL}/audits`);
  },
};

export const outboxService = {
  list: async (status = 'pending', limit = 50) => {
    const response = await fetch(`${API_URL}/outbox?status=${encodeURIComponent(status)}&limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch outbox');
    return await response.json();
  },
  updateStatus: async (id, status, error) => {
    const response = await fetch(`${API_URL}/outbox/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, error })
    });
    if (!response.ok) throw new Error('Failed to update outbox status');
    return await response.json();
  }
};

export const categoryService = {
  getAll: async () => {
    if (hasNativeBridge) {
      return nativeCall('categories', 'list');
    }
    return fetchJson(`${API_URL}/categories`);
  },
  create: async (name, description) => {
    const user = getCurrentUser();
    if (hasNativeBridge) {
      return nativeCall('categories', 'create', { name, description, userId: user?.id, userName: user?.name, userEmail: user?.email });
    }
    return fetchJson(`${API_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, userId: user?.id, userName: user?.name, userEmail: user?.email }),
    });
  },
  delete: async (name) => {
    const user = getCurrentUser();
    if (hasNativeBridge) {
      return nativeCall('categories', 'delete', { name, userId: user?.id, userName: user?.name, userEmail: user?.email });
    }
    return fetchJson(`${API_URL}/categories/${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user?.id, userName: user?.name, userEmail: user?.email }),
    });
  },
};

export const supplierService = {
  getAll: async () => {
    if (hasNativeBridge) {
      return nativeCall('suppliers', 'list');
    }
    return fetchJson(`${API_URL}/suppliers`);
  },
  create: async (supplier) => {
    if (hasNativeBridge) {
      return nativeCall('suppliers', 'create', { supplier });
    }
    return fetchJson(`${API_URL}/suppliers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplier),
    });
  },
  update: async (id, supplier) => {
    if (hasNativeBridge) {
      return nativeCall('suppliers', 'update', { id, supplier });
    }
    return fetchJson(`${API_URL}/suppliers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(supplier),
    });
  },
  delete: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('suppliers', 'delete', { id });
    }
    return fetchJson(`${API_URL}/suppliers/${id}`, { method: 'DELETE' });
  },
};

export const userService = {
  list: async () => {
    if (hasNativeBridge) {
      return nativeCall('users', 'list');
    }
    return fetchJson(`${API_URL}/users`);
  },
  getById: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('users', 'get', { id });
    }
    return fetchJson(`${API_URL}/users/${id}`);
  },
  create: async (user) => {
    const currentUser = getCurrentUser();
    const payload = { ...user, actingUserId: currentUser?.id, actingUserName: currentUser?.name, actingUserEmail: currentUser?.email };
    if (hasNativeBridge) {
      return nativeCall('users', 'create', payload);
    }
    return fetchJson(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
  update: async (id, user) => {
    const currentUser = getCurrentUser();
    const payload = { ...user, actingUserId: currentUser?.id, actingUserName: currentUser?.name, actingUserEmail: currentUser?.email };
    if (hasNativeBridge) {
      return nativeCall('users', 'update', { id, user: payload });
    }
    return fetchJson(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
  remove: async (id) => {
    const currentUser = getCurrentUser();
    if (hasNativeBridge) {
      return nativeCall('users', 'delete', { id, actingUserId: currentUser?.id, actingUserName: currentUser?.name, actingUserEmail: currentUser?.email });
    }
    return fetchJson(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actingUserId: currentUser?.id, actingUserName: currentUser?.name, actingUserEmail: currentUser?.email }),
    });
  },
};

// Helper to get current user info
const getCurrentUser = () => {
  try {
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) {
      return JSON.parse(storedUser);
    }
  } catch (e) {
    console.warn('Error parsing user from storage:', e);
  }
  return null;
};

export const purchaseOrderService = {
  create: async ({ supplierId, items, notes }) => {
    const user = getCurrentUser();
    const payload = {
      supplierId,
      items,
      notes,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email
    };

    if (hasNativeBridge) {
      return nativeCall('purchaseOrders', 'create', payload);
    }
    const res = await fetch(`${API_URL}/purchase-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create purchase order');
    return await res.json();
  },
  list: async () => {
    if (hasNativeBridge) {
      return nativeCall('purchaseOrders', 'list');
    }
    const res = await fetch(`${API_URL}/purchase-orders`);
    if (!res.ok) throw new Error('Failed to fetch purchase orders');
    return await res.json();
  },
  getById: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('purchaseOrders', 'get', { id });
    }
    const res = await fetch(`${API_URL}/purchase-orders/${id}`);
    if (!res.ok) throw new Error('Failed to fetch purchase order');
    return await res.json();
  },
  cancel: async (id) => {
    const user = getCurrentUser();
    const payload = {
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email
    };

    if (hasNativeBridge) {
      return nativeCall('purchaseOrders', 'cancel', { id, ...payload });
    }
    const res = await fetch(`${API_URL}/purchase-orders/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to cancel purchase order');
    return await res.json();
  },
  receive: async (id) => {
    const user = getCurrentUser();
    const payload = {
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email
    };

    if (hasNativeBridge) {
      return nativeCall('purchaseOrders', 'receive', { id, ...payload });
    }
    const res = await fetch(`${API_URL}/purchase-orders/${id}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to receive purchase order');
    return await res.json();
  }
};

export const activityLogService = {
  list: async (params = {}) => {
    if (hasNativeBridge) {
      return nativeCall('activityLogs', 'list', params);
    }
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    return fetchJson(`${API_URL}/activity-logs?${queryParams.toString()}`);
  },

  create: async (logData) => {
    if (hasNativeBridge) {
      return nativeCall('activityLogs', 'create', logData);
    }
    return fetchJson(`${API_URL}/activity-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData),
    });
  },

  getActionTypes: async () => {
    if (hasNativeBridge) {
      return nativeCall('activityLogs', 'getActionTypes');
    }
    return fetchJson(`${API_URL}/activity-logs/action-types`);
  },
};

// inventoryBatchService removed - FIFO system no longer used

export const stockAdjustmentService = {
  create: async (adjustmentData) => {
    if (hasNativeBridge) {
      return nativeCall('stockAdjustments', 'create', adjustmentData);
    }
    return fetchJson(`${API_URL}/stock-adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(adjustmentData),
    });
  },

  list: async (filters = {}) => {
    if (hasNativeBridge) {
      return nativeCall('stockAdjustments', 'list', filters);
    }
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    return fetchJson(`${API_URL}/stock-adjustments?${queryParams.toString()}`);
  },

  getById: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('stockAdjustments', 'get', { id });
    }
    return fetchJson(`${API_URL}/stock-adjustments/${id}`);
  },
};

export const refundService = {
  create: async (refund) => {
    const user = getCurrentUser();
    const payload = {
      ...refund,
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
    };
    if (hasNativeBridge) {
      return nativeCall('refunds', 'create', payload);
    }
    return fetchJson(`${API_URL}/refunds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },

  list: async (params = {}) => {
    if (hasNativeBridge) {
      return nativeCall('refunds', 'list', params);
    }
    return fetchJson(`${API_URL}/refunds${buildQuery(params)}`);
  },

  getById: async (id) => {
    if (hasNativeBridge) {
      return nativeCall('refunds', 'get', { id });
    }
    return fetchJson(`${API_URL}/refunds/${id}`);
  },
};

export const adminOverrideService = {
  verify: async ({ password, context }) => {
    const user = getCurrentUser();
    const payload = {
      password,
      context,
      triggeredByUserId: user?.id,
      triggeredByUserName: user?.name,
      triggeredByUserEmail: user?.email,
    };
    if (hasNativeBridge) {
      return nativeCall('auth', 'verifyAdmin', payload);
    }
    return fetchJson(`${API_URL}/auth/verify-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  },
};

export const reportService = {
  abcAnalysis: async (params = {}) => {
    if (hasNativeBridge) {
      return nativeCall('reports', 'abcAnalysis', params);
    }
    return fetchJson(`${API_URL}/reports/abc-analysis${buildQuery(params)}`);
  },

  deadStock: async (params = {}) => {
    if (hasNativeBridge) {
      return nativeCall('reports', 'deadStock', params);
    }
    return fetchJson(`${API_URL}/reports/dead-stock${buildQuery(params)}`);
  },

  profit: async (params = {}) => {
    if (hasNativeBridge) {
      return nativeCall('reports', 'profit', params);
    }
    return fetchJson(`${API_URL}/reports/profit${buildQuery(params)}`);
  },
};

export const stockMovementService = {
  create: async (movementData) => {
    if (hasNativeBridge) {
      return nativeCall('stockMovements', 'create', movementData);
    }
    return fetchJson(`${API_URL}/stock-movements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movementData),
    });
  },

  list: async (filters = {}) => {
    if (hasNativeBridge) {
      return nativeCall('stockMovements', 'list', filters);
    }
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value);
      }
    });
    return fetchJson(`${API_URL}/stock-movements?${queryParams.toString()}`);
  },
};