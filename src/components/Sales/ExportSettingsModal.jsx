import { useState } from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../context/ThemeContext';
import ModalPortal from '../common/ModalPortal';

const ExportSettingsModal = ({ isOpen, onClose, onExport, totalRecords, filteredRecords }) => {
  const { colors } = useTheme();
  
  const [exportSettings, setExportSettings] = useState({
    dateRange: {
      startDate: '',
      endDate: ''
    },
    dataSource: 'filtered', // 'all' or 'filtered'
    columns: {
      transactionId: true,
      date: true,
      time: true,
      items: true,
      itemDetails: false, // Detailed item breakdown
      subtotal: true,
      tax: true,
      total: true,
      paymentMethod: true,
      receivedAmount: true,
      change: true,
      referenceNumber: false,
      cashier: true
    },
    includeSummary: true,
    filename: `Sales_Export_${new Date().toISOString().split('T')[0]}`
  });

  if (!isOpen) return null;

  const handleColumnToggle = (columnKey) => {
    setExportSettings(prev => ({
      ...prev,
      columns: {
        ...prev.columns,
        [columnKey]: !prev.columns[columnKey]
      }
    }));
  };

  const handleExport = () => {
    onExport(exportSettings);
    onClose();
  };

  const selectedColumnsCount = Object.values(exportSettings.columns).filter(Boolean).length;

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${colors.card.primary} rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border ${colors.border.primary}`}>
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${colors.border.primary}`}>
          <div className="flex items-center space-x-3">
            <ArrowDownTrayIcon className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            <h2 className={`text-xl font-semibold ${colors.text.primary}`}>Export Sales to Excel</h2>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg hover:${colors.bg.secondary} transition-colors`}
          >
            <XMarkIcon className={`h-5 w-5 ${colors.text.secondary}`} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Data Source Selection */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${colors.text.primary}`}>
              Data Source
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="dataSource"
                  value="filtered"
                  checked={exportSettings.dataSource === 'filtered'}
                  onChange={(e) => setExportSettings(prev => ({ ...prev, dataSource: e.target.value }))}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <span className={colors.text.secondary}>
                  Filtered Results ({filteredRecords} records)
                </span>
              </label>
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="dataSource"
                  value="all"
                  checked={exportSettings.dataSource === 'all'}
                  onChange={(e) => setExportSettings(prev => ({ ...prev, dataSource: e.target.value }))}
                  className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                />
                <span className={colors.text.secondary}>
                  All Transactions ({totalRecords} records)
                </span>
              </label>
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${colors.text.primary}`}>
              Date Range (Optional)
            </label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs mb-1 ${colors.text.secondary}`}>Start Date</label>
                <input
                  type="date"
                  value={exportSettings.dateRange.startDate}
                  onChange={(e) => setExportSettings(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, startDate: e.target.value }
                  }))}
                  className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 ${colors.text.secondary}`}>End Date</label>
                <input
                  type="date"
                  value={exportSettings.dateRange.endDate}
                  onChange={(e) => setExportSettings(prev => ({
                    ...prev,
                    dateRange: { ...prev.dateRange, endDate: e.target.value }
                  }))}
                  className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
                />
              </div>
            </div>
            <p className={`text-xs mt-2 ${colors.text.tertiary}`}>
              Leave empty to export all dates. Date range will be applied on top of data source selection.
            </p>
          </div>

          {/* Column Selection */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${colors.text.primary}`}>
              Columns to Include ({selectedColumnsCount} selected)
            </label>
            <div className={`border rounded-lg p-4 space-y-3 max-h-64 overflow-y-auto ${colors.border.primary}`}>
              {[
                { key: 'transactionId', label: 'Transaction ID' },
                { key: 'date', label: 'Date' },
                { key: 'time', label: 'Time' },
                { key: 'items', label: 'Items Summary' },
                { key: 'itemDetails', label: 'Item Details (separate rows)' },
                { key: 'subtotal', label: 'Subtotal' },
                { key: 'tax', label: 'Tax' },
                { key: 'total', label: 'Total' },
                { key: 'paymentMethod', label: 'Payment Method' },
                { key: 'receivedAmount', label: 'Received Amount' },
                { key: 'change', label: 'Change' },
                { key: 'referenceNumber', label: 'Reference Number' },
                { key: 'cashier', label: 'Cashier' }
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportSettings.columns[key]}
                    onChange={() => handleColumnToggle(key)}
                    className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                  />
                  <span className={colors.text.secondary}>{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Options */}
          <div>
            <label className={`block text-sm font-medium mb-3 ${colors.text.primary}`}>
              Additional Options
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exportSettings.includeSummary}
                  onChange={(e) => setExportSettings(prev => ({ ...prev, includeSummary: e.target.checked }))}
                  className="w-4 h-4 text-teal-600 rounded focus:ring-teal-500"
                />
                <span className={colors.text.secondary}>Include Summary Sheet</span>
              </label>
            </div>
          </div>

          {/* Filename */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
              Filename
            </label>
            <input
              type="text"
              value={exportSettings.filename}
              onChange={(e) => setExportSettings(prev => ({ ...prev, filename: e.target.value }))}
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
              placeholder="Enter filename"
            />
            <p className={`text-xs mt-1 ${colors.text.tertiary}`}>
              File will be saved as: {exportSettings.filename}.xlsx
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={`flex justify-end space-x-3 p-6 border-t ${colors.border.primary}`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-lg border ${colors.border.primary} ${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selectedColumnsCount === 0}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <ArrowDownTrayIcon className="h-5 w-5" />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};

export default ExportSettingsModal;
