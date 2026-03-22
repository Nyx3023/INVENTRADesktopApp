import React from 'react';

const formatCurrency = (amt) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amt || 0));

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
      case 'CREATE_PRODUCT':
        return `Created product ${details.name || details.productName || details.product_name || ''} at ${formatCurrency(details.price)} with ${details.quantity || 0} stock.`;
      
      case 'UPDATE_PRODUCT':
        if (details.changes) {
          const keys = Object.keys(details.changes);
          return `Updated ${keys.length} fields: ${keys.join(', ')}`;
        }
        return `Updated product ${details.name || ''}`;
      
      case 'DELETE_PRODUCT':
        return `Deleted product ${details.name || details.productName || details.product_name || details.productId || ''}`;
      
      case 'STOCK_IN':
      case 'STOCK_OUT':
      case 'STOCK_ADJUSTMENT':
        return `${action === 'STOCK_IN' ? 'Added' : action === 'STOCK_OUT' ? 'Removed' : 'Adjusted'} ${details.quantityChange || details.quantity || details.quantity_changed || details.difference || 0} units for ${details.productName || details.product_name || details.name || 'product'}${details.reason ? ` (${details.reason})` : ''}`;
      
      case 'CREATE_SALE':
        return `Processed sale for ${formatCurrency(details.total_amount || details.total || 0)}`;

      case 'VOID_SALE':
        return `Voided sale ${details.transaction_id || details.receipt_number || ''}${details.reason ? ` - ${details.reason}` : ''}`;

      case 'CREATE_CATEGORY':
      case 'DELETE_CATEGORY':
        return `${action.split('_')[0]} category: ${details.name || details.category_name || ''}`;
        
      case 'CREATE_USER':
      case 'UPDATE_USER':
      case 'DELETE_USER':
        return `${action.split('_')[0].charAt(0) + action.split('_')[0].slice(1).toLowerCase()} user ${details.username || details.name || details.email || ''}`;

      case 'UPDATE_SETTINGS':
        return `Updated system settings`;

      case 'LOGIN':
      case 'LOGOUT':
      case 'LOGIN_FAILED':
        return details.message || 'Authentication activity';

      default:
        // Generic fallback for objects
        if (details.name) return details.name;
        if (details.message) return details.message;
        const stringified = JSON.stringify(details);
        if (stringified.length > 50) return stringified.slice(0, 50) + '...';
        return stringified;
    }
  } catch (err) {
    return JSON.stringify(details).slice(0, 50) + '...';
  }
};

/**
 * Transforms an activity log into a structured React element for the detailed Modal view.
 * @param {Object} log - The activity log object
 * @returns {React.ReactNode} - Formatted bullet points or readable text highlighting all changes
 */
export const formatDetailsForModal = (log) => {
  if (!log || !log.details) return <span>No details provided.</span>;
  const { action, details } = log;

  if (typeof details === 'string') {
    return <span className="text-sm whitespace-pre-wrap">{details}</span>;
  }

  try {
    const renderList = (items) => (
      <ul className="list-disc list-inside space-y-1 mt-2">
        {items.map((item, idx) => <li key={idx} className="text-sm">{item}</li>)}
      </ul>
    );

    switch (action) {
      case 'CREATE_PRODUCT':
        return renderList([
          `Name: ${details.name || details.productName || details.product_name || 'N/A'}`,
          `Price: ${formatCurrency(details.price)}`,
          `Cost: ${formatCurrency(details.cost)}`,
          `Initial Stock: ${details.quantity || 0}`,
          details.category_name ? `Category: ${details.category_name}` : null,
          details.barcode ? `Barcode: ${details.barcode}` : null
        ].filter(Boolean));

      case 'UPDATE_PRODUCT':
        if (details.changes) {
          const changeList = Object.entries(details.changes).map(([k, v]) => {
            const oldVal = v.old !== undefined ? v.old : 'None';
            const newVal = v.new !== undefined ? v.new : 'None';
            // Simple formatting for known money fields
            if (['price', 'cost'].includes(k)) {
               return `Changed ${k} from ${formatCurrency(oldVal)} to ${formatCurrency(newVal)}`;
            }
            return `Changed ${k} from "${oldVal}" to "${newVal}"`;
          });
          return (
            <div>
              <p className="text-sm font-medium">Modified Fields:</p>
              {renderList(changeList)}
            </div>
          );
        }
        return renderList(Object.entries(details).map(([k,v]) => `${k}: ${v}`));

      case 'DELETE_PRODUCT':
        return renderList([
          `Name: ${details.name || details.productName || details.product_name || 'Unknown'}`,
          `Product ID: ${details.productId || 'N/A'}`
        ].filter(Boolean));

      case 'STOCK_IN':
      case 'STOCK_OUT':
      case 'STOCK_ADJUSTMENT':
        return renderList([
          `Product: ${details.productName || details.product_name || details.name || 'Unknown'}`,
          `Adjustment: ${details.quantityChange || details.quantity || details.quantity_changed || details.difference || 0} units`,
          details.reason ? `Reason: ${details.reason}` : null,
          details.reference_number ? `Ref #: ${details.reference_number}` : null
        ].filter(Boolean));

      case 'CREATE_SALE':
        return renderList([
          `Receipt Number: ${details.receipt_number || 'N/A'}`,
          `Total Amount: ${formatCurrency(details.total_amount || details.total || 0)}`,
          details.payment_method ? `Payment Method: ${details.payment_method}` : null,
          details.items ? `Items Purchased: ${Array.isArray(details.items) ? details.items.length : details.items}` : null
        ].filter(Boolean));

      case 'UPDATE_SETTINGS':
        if (details.changes) {
          const settingChanges = Object.entries(details.changes).map(([k, v]) => {
            return `Changed setting "${k.replace(/_/g, ' ')}" to "${v.new !== undefined ? v.new : v}"`;
          });
          return renderList(settingChanges);
        }
        return renderList(Object.entries(details).map(([k,v]) => `${k}: ${v}`));

      default:
        // Generic fallback to nice key-value listing
        const pairs = Object.entries(details).map(([k, v]) => {
          if (typeof v === 'object' && v !== null) {
            return `${k}: ${JSON.stringify(v)}`;
          }
          return `${k}: ${v}`;
        });
        return renderList(pairs);
    }
  } catch (err) {
    return <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(details, null, 2)}</pre>;
  }
};
