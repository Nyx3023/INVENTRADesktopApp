import React from 'react';

const formatCurrency = (amt) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amt || 0));

/** Convert snake_case / camelCase keys into readable labels */
const humanizeKey = (key) => {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * Transforms an activity log into a brief singular string for the Logs table row.
 * @param {Object} log - The activity log object
 * @returns {string} - A short readable string summarizing the log detail
 */
export const formatDetailsForTable = (log) => {
  if (!log) return '-';
  const { action, details } = log;

  if (!details) return '-';
  if (typeof details === 'string') return details;

  try {
    switch (action) {
      case 'LOGIN':
        return `Logged in${details.via ? ` via ${details.via}` : ''}${details.method ? ` (${details.method})` : ''}`;

      case 'LOGOUT':
        return 'Logged out of the system';

      case 'LOGIN_FAILED':
        return `Login failed${details.reason ? `: ${details.reason}` : ''}`;

      case 'ADMIN_OVERRIDE_VERIFIED':
        return `Admin override verified${details.via ? ` via ${details.via}` : ''}`;

      case 'CREATE_PRODUCT':
        return `Created "${details.name || details.productName || details.product_name || 'product'}" — ${formatCurrency(details.price)}, ${details.quantity || 0} in stock`;

      case 'UPDATE_PRODUCT': {
        const name = details.name || details.productName || '';
        if (Array.isArray(details.changed_fields) && details.changed_fields.length) {
          return `Updated ${name ? `"${name}" — ` : ''}${details.changed_fields.map(humanizeKey).join(', ')}`;
        }
        if (details.changes) {
          const keys = Object.keys(details.changes);
          return `Updated ${name ? `"${name}" — ` : ''}${keys.map(humanizeKey).join(', ')}`;
        }
        return `Updated product${name ? ` "${name}"` : ''}`;
      }

      case 'PRODUCT_PRICE_CHANGE':
        return `Price changed${details.productName ? ` for "${details.productName}"` : ''}: ${formatCurrency(details.old_price)} → ${formatCurrency(details.new_price)}`;

      case 'RESTORE_PRODUCT':
        return `Restored "${details.name || details.productName || details.product_name || 'product'}"`;

      case 'PERMANENT_DELETE_PRODUCT':
        return `Permanently deleted "${details.name || details.productName || details.product_name || 'product'}"`;

      case 'STOCK_MOVEMENT':
        return `Stock movement (${details.movementType || 'transfer'}) for "${details.productName || 'product'}": ${details.quantity || 0} units`;

      case 'SALE_HELD':
        return `Held sale${details.transaction_id ? ` #${details.transaction_id}` : ''}${details.itemCount ? ` — ${details.itemCount} items` : ''}`;

      case 'SALE_RESUMED':
        return `Resumed held sale${details.transaction_id ? ` #${details.transaction_id}` : ''}`;

      case 'PAYMENT_ADDED':
        return `Payment of ${formatCurrency(details.amount)} applied${details.transaction_id ? ` to #${details.transaction_id}` : ''}${details.balance_due !== undefined ? ` (balance: ${formatCurrency(details.balance_due)})` : ''}`;

      case 'REFUND_ISSUED':
        return `Refund issued${details.transaction_id ? ` for #${details.transaction_id}` : ''} — ${formatCurrency(details.total_amount)}${details.reason ? ` (${details.reason})` : ''}`;

      case 'ADMIN_OVERRIDE':
        return `Admin override${details.context ? ` — ${details.context}` : ''}`;

      case 'DELETE_PRODUCT':
        return `Deleted "${details.name || details.productName || details.product_name || 'product'}"`;

      case 'STOCK_IN':
        return `Added ${details.quantityChange || details.quantity || details.quantity_changed || details.difference || 0} units to "${details.productName || details.product_name || details.name || 'product'}"${details.reason ? ` — ${details.reason}` : ''}`;

      case 'STOCK_OUT':
        return `Removed ${Math.abs(details.quantityChange || details.quantity || details.quantity_changed || details.difference || 0)} units from "${details.productName || details.product_name || details.name || 'product'}"${details.reason ? ` — ${details.reason}` : ''}`;

      case 'STOCK_ADJUSTMENT':
        return `Adjusted stock for "${details.productName || details.product_name || details.name || 'product'}" by ${details.quantityChange || details.quantity || details.quantity_changed || details.difference || 0} units${details.reason ? ` — ${details.reason}` : ''}`;

      case 'CREATE_SALE':
        return `Processed sale for ${formatCurrency(details.total_amount || details.total || 0)}${details.receipt_number ? ` (Receipt #${details.receipt_number})` : ''}`;

      case 'VOID_SALE':
        return `Voided sale${details.receipt_number ? ` #${details.receipt_number}` : ''}${details.reason ? ` — ${details.reason}` : ''}`;

      case 'ARCHIVE_TRANSACTION':
        return `Archived transaction${details.receipt_number ? ` #${details.receipt_number}` : ''}`;

      case 'RESTORE_TRANSACTION':
        return `Restored transaction${details.receipt_number ? ` #${details.receipt_number}` : ''}`;

      case 'DELETE_TRANSACTION':
        return `Permanently deleted transaction${details.receipt_number ? ` #${details.receipt_number}` : ''}`;

      case 'CREATE_CATEGORY':
        return `Created category "${details.name || details.category_name || ''}"`;

      case 'DELETE_CATEGORY':
        return `Deleted category "${details.name || details.category_name || ''}"`;

      case 'CREATE_SUPPLIER':
        return `Added supplier "${details.name || details.supplier_name || ''}"`;

      case 'UPDATE_SUPPLIER':
        return `Updated supplier "${details.name || details.supplier_name || ''}"`;

      case 'DELETE_SUPPLIER':
        return `Deleted supplier "${details.name || details.supplier_name || ''}"`;

      case 'CREATE_PURCHASE_ORDER':
        return `Created purchase order${details.po_number ? ` #${details.po_number}` : ''}${details.supplier_name ? ` from ${details.supplier_name}` : ''}`;

      case 'RECEIVE_PURCHASE_ORDER':
        return `Received purchase order${details.po_number ? ` #${details.po_number}` : ''}`;

      case 'CANCEL_PURCHASE_ORDER':
        return `Cancelled purchase order${details.po_number ? ` #${details.po_number}` : ''}`;

      case 'CREATE_USER':
        return `Created user "${details.username || details.name || details.email || ''}"${details.role ? ` as ${details.role}` : ''}`;

      case 'UPDATE_USER':
        return `Updated user "${details.username || details.name || details.email || ''}"`;

      case 'DELETE_USER':
        return `Deleted user "${details.username || details.name || details.email || ''}"`;

      case 'CREATE_AUDIT':
        return `Started inventory audit${details.audit_name ? `: ${details.audit_name}` : ''}`;

      case 'UPDATE_SETTINGS':
        if (details.setupCompleted) return 'Completed initial system setup';
        if (details.changes) {
          const keys = Object.keys(details.changes);
          return `Updated ${keys.map(humanizeKey).join(', ')}`;
        }
        return 'Updated system settings';

      case 'PRINT_RECEIPT':
        return `Printed receipt${details.receipt_number ? ` #${details.receipt_number}` : ''}`;

      default: {
        // Generic human-readable fallback
        if (details.message) return details.message;
        if (details.name) return details.name;
        if (details.reason) return details.reason;
        // Build a short readable summary from top-level string values
        const readable = Object.entries(details)
          .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
          .slice(0, 3)
          .map(([k, v]) => `${humanizeKey(k)}: ${v}`)
          .join(' · ');
        return readable || '-';
      }
    }
  } catch (err) {
    return details.message || details.name || '-';
  }
};

/**
 * Transforms an activity log into a structured React element for the detailed Modal view.
 * @param {Object} log - The activity log object
 * @returns {React.ReactNode} - Formatted bullet points or readable text highlighting all changes
 */
export const formatDetailsForModal = (log) => {
  if (!log || !log.details) return <span>No additional details.</span>;
  const { action, details } = log;

  if (typeof details === 'string') {
    return <span className="text-sm whitespace-pre-wrap">{details}</span>;
  }

  try {
    const renderList = (items) => (
      <ul className="space-y-2 mt-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <span className="text-blue-500 mt-0.5">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );

    switch (action) {
      case 'LOGIN':
        return renderList([
          details.via ? `Login method: ${details.via}` : null,
          details.method ? `Authentication: ${details.method}` : null,
          details.rememberMe !== undefined ? `Remember me: ${details.rememberMe ? 'Yes' : 'No'}` : null,
        ].filter(Boolean));

      case 'LOGOUT':
        return renderList(['User signed out of the system']);

      case 'LOGIN_FAILED':
        return renderList([
          details.reason ? `Reason: ${details.reason}` : 'Authentication failed',
        ]);

      case 'ADMIN_OVERRIDE_VERIFIED':
        return renderList([
          details.via ? `Verified via: ${details.via}` : 'Admin identity confirmed',
        ]);

      case 'CREATE_PRODUCT':
        return renderList([
          `Product name: ${details.name || details.productName || details.product_name || 'N/A'}`,
          `Selling price: ${formatCurrency(details.price)}`,
          `Unit cost: ${formatCurrency(details.cost)}`,
          `Initial stock: ${details.quantity || 0} units`,
          details.category_name ? `Category: ${details.category_name}` : null,
          details.barcode ? `Barcode: ${details.barcode}` : null,
        ].filter(Boolean));

      case 'UPDATE_PRODUCT': {
        // New shape: { before: {...}, after: {...}, changed_fields: [...] }
        if (Array.isArray(details.changed_fields) && details.before && details.after) {
          const changeList = details.changed_fields.map((k) => {
            const oldVal = details.before[k];
            const newVal = details.after[k];
            const label = humanizeKey(k);
            if (['price', 'cost'].includes(k)) {
              return `${label}: ${formatCurrency(oldVal)} → ${formatCurrency(newVal)}`;
            }
            const fmt = (v) => (v === null || v === undefined || v === '') ? '—' : String(v);
            return `${label}: "${fmt(oldVal)}" → "${fmt(newVal)}"`;
          });
          return (
            <div>
              <p className="text-sm font-medium mb-1">Changes made:</p>
              {renderList(changeList)}
            </div>
          );
        }
        // Legacy shape: details.changes
        if (details.changes) {
          const changeList = Object.entries(details.changes).map(([k, v]) => {
            const oldVal = v.old !== undefined ? v.old : 'None';
            const newVal = v.new !== undefined ? v.new : 'None';
            const label = humanizeKey(k);
            if (['price', 'cost'].includes(k)) {
              return `${label}: ${formatCurrency(oldVal)} → ${formatCurrency(newVal)}`;
            }
            return `${label}: "${oldVal}" → "${newVal}"`;
          });
          return (
            <div>
              <p className="text-sm font-medium mb-1">Changes made:</p>
              {renderList(changeList)}
            </div>
          );
        }
        return renderList(
          Object.entries(details)
            .filter(([k, v]) => v !== null && v !== undefined && !['before', 'after'].includes(k))
            .map(([k, v]) => `${humanizeKey(k)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
        );
      }

      case 'PRODUCT_PRICE_CHANGE':
        return renderList([
          details.productName ? `Product: ${details.productName}` : null,
          `Old price: ${formatCurrency(details.old_price)}`,
          `New price: ${formatCurrency(details.new_price)}`,
          details.delta !== undefined ? `Change: ${(details.delta >= 0 ? '+' : '')}${formatCurrency(details.delta)}` : null,
        ].filter(Boolean));

      case 'RESTORE_PRODUCT':
      case 'PERMANENT_DELETE_PRODUCT':
        return renderList([
          `Product: ${details.name || details.productName || details.product_name || 'Unknown'}`,
          details.reason ? `Reason: ${details.reason}` : null,
        ].filter(Boolean));

      case 'STOCK_MOVEMENT':
        return renderList([
          `Product: ${details.productName || 'Unknown'}`,
          `Movement type: ${details.movementType || 'transfer'}`,
          `Quantity: ${details.quantity || 0} units`,
          details.fromLocation ? `From: ${details.fromLocation}` : null,
          details.toLocation ? `To: ${details.toLocation}` : null,
          details.referenceNumber ? `Reference: ${details.referenceNumber}` : null,
          details.notes ? `Notes: ${details.notes}` : null,
        ].filter(Boolean));

      case 'SALE_HELD':
      case 'SALE_RESUMED':
        return renderList([
          details.transaction_id ? `Transaction: ${details.transaction_id}` : null,
          details.itemCount ? `Items: ${details.itemCount}` : null,
          details.total ? `Total: ${formatCurrency(details.total)}` : null,
          details.customerName ? `Customer: ${details.customerName}` : null,
        ].filter(Boolean));

      case 'PAYMENT_ADDED':
        return renderList([
          details.transaction_id ? `Transaction: ${details.transaction_id}` : null,
          `Amount: ${formatCurrency(details.amount)}`,
          details.payment_method ? `Method: ${details.payment_method}` : null,
          details.balance_due !== undefined ? `Balance remaining: ${formatCurrency(details.balance_due)}` : null,
          details.new_status ? `New status: ${humanizeKey(details.new_status)}` : null,
        ].filter(Boolean));

      case 'REFUND_ISSUED':
        return renderList([
          details.transaction_id ? `Transaction: ${details.transaction_id}` : null,
          details.refund_id ? `Refund ID: ${details.refund_id}` : null,
          `Total refunded: ${formatCurrency(details.total_amount)}`,
          details.reason ? `Reason: ${details.reason}` : null,
          details.items_count !== undefined ? `Line items: ${details.items_count}` : null,
          details.return_to_stock_count !== undefined ? `Returned to stock: ${details.return_to_stock_count}` : null,
        ].filter(Boolean));

      case 'ADMIN_OVERRIDE':
        return renderList([
          details.context ? `Context: ${details.context}` : null,
          details.triggered_by_user_name ? `Triggered by: ${details.triggered_by_user_name}` : null,
          details.verified_admin_name ? `Approved by: ${details.verified_admin_name}` : null,
        ].filter(Boolean));

      case 'DELETE_PRODUCT':
        return renderList([
          `Product: ${details.name || details.productName || details.product_name || 'Unknown'}`,
        ]);

      case 'STOCK_IN':
      case 'STOCK_OUT':
      case 'STOCK_ADJUSTMENT': {
        const verb = action === 'STOCK_IN' ? 'Added' : action === 'STOCK_OUT' ? 'Removed' : 'Adjusted by';
        const qBefore = details.before?.quantity ?? details.previousQuantity ?? details.quantityBefore;
        const qAfter = details.after?.quantity ?? details.newQuantity ?? details.quantityAfter;
        return renderList([
          `Product: ${details.productName || details.product_name || details.name || 'Unknown'}`,
          `${verb}: ${Math.abs(details.quantityChange || details.quantity || details.quantity_changed || details.difference || 0)} units`,
          qBefore !== undefined ? `Previous stock: ${qBefore}` : null,
          qAfter !== undefined ? `New stock: ${qAfter}` : null,
          details.adjustmentType ? `Type: ${humanizeKey(details.adjustmentType)}` : null,
          details.reason ? `Reason: ${details.reason}` : null,
          details.notes ? `Notes: ${details.notes}` : null,
          details.reference_number ? `Reference: ${details.reference_number}` : null,
        ].filter(Boolean));
      }

      case 'CREATE_SALE':
        return renderList([
          details.receipt_number ? `Receipt number: ${details.receipt_number}` : null,
          `Total amount: ${formatCurrency(details.total_amount || details.total || 0)}`,
          details.payment_method ? `Payment method: ${details.payment_method}` : null,
          details.items ? `Items purchased: ${Array.isArray(details.items) ? details.items.length : details.items}` : null,
          details.received_amount ? `Amount received: ${formatCurrency(details.received_amount)}` : null,
          details.change ? `Change given: ${formatCurrency(details.change)}` : null,
        ].filter(Boolean));

      case 'VOID_SALE':
        return renderList([
          details.receipt_number ? `Receipt number: ${details.receipt_number}` : null,
          details.reason ? `Reason: ${details.reason}` : null,
          details.total_amount ? `Amount voided: ${formatCurrency(details.total_amount)}` : null,
        ].filter(Boolean));

      case 'CREATE_CATEGORY':
      case 'DELETE_CATEGORY':
        return renderList([
          `Category: ${details.name || details.category_name || 'Unknown'}`,
          details.description ? `Description: ${details.description}` : null,
        ].filter(Boolean));

      case 'CREATE_SUPPLIER':
      case 'UPDATE_SUPPLIER':
      case 'DELETE_SUPPLIER':
        return renderList([
          `Supplier: ${details.name || details.supplier_name || 'Unknown'}`,
          details.contact ? `Contact: ${details.contact}` : null,
          details.email ? `Email: ${details.email}` : null,
          details.phone ? `Phone: ${details.phone}` : null,
        ].filter(Boolean));

      case 'CREATE_USER':
      case 'UPDATE_USER':
      case 'DELETE_USER':
        return renderList([
          `User: ${details.username || details.name || 'Unknown'}`,
          details.email ? `Email: ${details.email}` : null,
          details.role ? `Role: ${details.role}` : null,
        ].filter(Boolean));

      case 'UPDATE_SETTINGS':
        if (details.setupCompleted) {
          return renderList([
            'Initial system setup completed',
            details.printerConfigured !== undefined ? `Printer configured: ${details.printerConfigured ? 'Yes' : 'No'}` : null,
          ].filter(Boolean));
        }
        if (details.changes) {
          const settingChanges = Object.entries(details.changes).map(([k, v]) => {
            const newVal = v.new !== undefined ? v.new : v;
            return `${humanizeKey(k)}: ${newVal}`;
          });
          return (
            <div>
              <p className="text-sm font-medium mb-1">Settings changed:</p>
              {renderList(settingChanges)}
            </div>
          );
        }
        return renderList(
          Object.entries(details)
            .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
            .map(([k, v]) => `${humanizeKey(k)}: ${typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v}`)
        );

      case 'PRINT_RECEIPT':
        return renderList([
          details.receipt_number ? `Receipt: ${details.receipt_number}` : null,
          details.printer ? `Printer: ${details.printer}` : null,
        ].filter(Boolean));

      default: {
        // Generic human-readable fallback — never show raw JSON
        const pairs = Object.entries(details)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => {
            if (typeof v === 'boolean') return `${humanizeKey(k)}: ${v ? 'Yes' : 'No'}`;
            if (typeof v === 'object') return `${humanizeKey(k)}: ${Array.isArray(v) ? `${v.length} item(s)` : 'See details'}`;
            return `${humanizeKey(k)}: ${v}`;
          });
        return pairs.length > 0 ? renderList(pairs) : <span>No additional details.</span>;
      }
    }
  } catch (err) {
    // Absolute last resort — still no raw JSON
    const fallbackPairs = Object.entries(details)
      .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
      .map(([k, v]) => `${humanizeKey(k)}: ${v}`);
    return fallbackPairs.length > 0
      ? <ul className="space-y-1 mt-2">{fallbackPairs.map((p, i) => <li key={i} className="text-sm">• {p}</li>)}</ul>
      : <span>No additional details.</span>;
  }
};
