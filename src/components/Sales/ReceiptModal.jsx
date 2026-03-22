import { useState } from 'react';
import { XMarkIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { useSettings } from '../../context/SettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toast } from 'react-hot-toast';
import { printerService } from '../../utils/printerService';
import ModalPortal from '../common/ModalPortal';

const ReceiptModal = ({ transaction, onClose, onPrint }) => {
  const { settings, t } = useSettings();
  const { colors } = useTheme();
  const [isPrinting, setIsPrinting] = useState(false);

  // formatDate is now imported from utils/formatters.js

  const handlePrint = async () => {
    if (!transaction) return;
    try {
      setIsPrinting(true);
      await printerService.printReceipt(transaction);
      onPrint?.(transaction);
      toast.success('Receipt printed successfully!');
    } catch (error) {
      console.error('Print failed:', error);
      toast.error('Failed to print receipt: ' + (error.message || 'Please check the printer connection.'));
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <ModalPortal>
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${colors.card.primary} rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border ${colors.border.primary}`}>
        {/* Modal Header */}
        <div className={`flex justify-between items-center p-4 border-b ${colors.border.primary}`}>
          <h2 className={`text-lg font-semibold ${colors.text.primary}`}>{t('receipt')} #{transaction.id}</h2>
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              title="Print Receipt"
              disabled={isPrinting}
            >
              <PrinterIcon className="h-5 w-5" />
            </button>
            <button
              onClick={onClose}
              className={`p-2 ${colors.text.tertiary} hover:${colors.bg.tertiary} rounded-full`}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Receipt Content - Dark mode compatible, prints in light mode */}
        <div id="receipt-content" className={`p-6 ${colors.text.primary} print:bg-white print:text-black`}>
          <div className="text-center mb-6">
            {(() => {
              // Get store info from localStorage
              let storeInfo = {
                storeName: 'JBO Arts & Crafts Trading',
                address: '#303 B1A J.R. Blvd Tagapo, Santa Rosa',
                phone: '0932 868 7911'
              };
              try {
                const savedStoreInfo = localStorage.getItem('storeInfo');
                if (savedStoreInfo) {
                  const parsed = JSON.parse(savedStoreInfo);
                  storeInfo = {
                    storeName: parsed.storeName || storeInfo.storeName,
                    address: parsed.address || storeInfo.address,
                    phone: parsed.phone || storeInfo.phone
                  };
                }
              } catch (e) {
                console.error('Error parsing store info:', e);
              }
              const addressParts = storeInfo.address.split(',').map(s => s.trim());
              return (
                <>
                  <h1 className={`text-xl font-bold ${colors.text.primary} print:text-black`}>{storeInfo.storeName.toUpperCase()}</h1>
                  <p className={`text-sm ${colors.text.secondary} print:text-gray-600`}>{addressParts[0]}</p>
                  {addressParts.length > 1 && (
                    <p className={`text-sm ${colors.text.secondary} print:text-gray-600`}>{addressParts.slice(1).join(', ')}</p>
                  )}
                  <p className={`text-sm ${colors.text.secondary} print:text-gray-600`}>Tel: {storeInfo.phone}</p>
                  <p className={`text-sm ${colors.text.secondary} print:text-gray-600 mt-2`}>Point of Sale {t('receipt')}</p>
                  <div className={`border-b border-dashed ${colors.border.primary} print:border-gray-400 my-4`}></div>
                </>
              );
            })()}
          </div>

          {/* Transaction Info */}
          <div className="mb-6 space-y-2">
            <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
              <span className="font-medium">{t('receipt')} #:</span>
              <span className="font-mono">{transaction.id}</span>
            </div>
            <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
              <span className="font-medium">Date & Time:</span>
              <span>{formatDate(transaction.timestamp)}</span>
            </div>
            <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
              <span className="font-medium">Payment Method:</span>
              <span className="uppercase">{transaction.payment_method || transaction.paymentMethod || 'CASH'}</span>
            </div>
            {/** Reference number (for card/gcash) with field name fallbacks */}
            {(transaction.referenceNumber || transaction.reference_number) && (
              <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
                <span className="font-medium">Reference No.:</span>
                <span className="font-mono">{transaction.referenceNumber || transaction.reference_number}</span>
              </div>
            )}
          </div>

          <div className={`border-b border-dashed ${colors.border.primary} print:border-gray-400 my-4`}></div>

          {/* Items */}
          <div className="mb-6">
            <h3 className={`font-medium mb-3 text-sm ${colors.text.primary} print:text-black`}>ITEMS PURCHASED</h3>
            <div className="space-y-2">
              {transaction.items?.map((item, index) => (
                <div key={index} className={`flex justify-between items-start text-sm ${colors.text.primary} print:text-black`}>
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className={`text-xs ${colors.text.secondary} print:text-gray-600`}>
                      {item.quantity} × {formatCurrency(item.price)}
                    </div>
                  </div>
                  <div className="font-medium ml-2">
                    {formatCurrency(item.subtotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`border-b border-dashed ${colors.border.primary} print:border-gray-400 my-4`}></div>

          {/* Totals */}
          <div className="space-y-2 mb-6">
            <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
              <span>Subtotal:</span>
              <span>{formatCurrency(transaction.subtotal)}</span>
            </div>
            {/* Show Discount if applicable */}
            {(transaction.discount_percentage > 0 || transaction.discountPercentage > 0) && (
              <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
                <span>Discount ({transaction.discount_percentage || transaction.discountPercentage}%):</span>
                <span>-{formatCurrency(transaction.discount_amount || transaction.discountAmount || 0)}</span>
              </div>
            )}
            {settings.taxRate !== undefined && settings.taxRate > 0 && (
              <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
                <span>Tax ({settings.taxRate}%):</span>
                <span>{formatCurrency(transaction.tax)}</span>
              </div>
            )}
            <div className={`border-t ${colors.border.primary} print:border-gray-300 pt-2`}>
              <div className={`flex justify-between font-bold ${colors.text.primary} print:text-black`}>
                <span>{t('total').toUpperCase()}:</span>
                <span>{formatCurrency(transaction.total)}</span>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          {transaction.payment_method === 'cash' && (
            <div className="space-y-2 mb-6">
              <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
                <span>Amount Received:</span>
                <span>{formatCurrency(transaction.received_amount)}</span>
              </div>
              <div className={`flex justify-between text-sm ${colors.text.primary} print:text-black`}>
                <span>{t('change')}:</span>
                <span>{formatCurrency(transaction.change_amount)}</span>
              </div>
            </div>
          )}

          <div className={`border-b border-dashed ${colors.border.primary} print:border-gray-400 my-4`}></div>

          {/* Footer */}
          <div className={`text-center text-xs ${colors.text.secondary} print:text-gray-600 space-y-1`}>
            <p>{settings.receiptFooter || t('thankYou')}</p>
            <p>Please keep this receipt for your records</p>
            <p className="mt-4 font-medium opacity-80">
              Powered by INVENTRA
            </p>
            <p className="mt-1">
              {new Date().toLocaleDateString()} | System Generated Receipt
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`border-t ${colors.border.primary} p-4 flex justify-end space-x-3`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 ${colors.text.secondary} border ${colors.border.primary} rounded-lg hover:${colors.bg.secondary}`}
          >
            {t('cancel')}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isPrinting}
          >
            <PrinterIcon className="h-4 w-4 mr-2" />
            {isPrinting ? 'Printing...' : `Print ${t('receipt')}`}
          </button>
        </div>
      </div>

      {/* Print Styles - Hide everything except receipt content */}
      <style>{`
        @media print {
          /* Hide all body content */
          body * {
            visibility: hidden;
          }
          
          /* Show only the receipt content */
          #receipt-content,
          #receipt-content * {
            visibility: visible;
          }
          
          /* Position receipt at top of page */
          #receipt-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px;
          }
          
          /* Force light mode colors for print */
          #receipt-content * {
            background: white !important;
            color: black !important;
            border-color: #e5e7eb !important;
          }
          
          /* Darker dashed borders for visibility */
          .border-dashed {
            border-color: #9ca3af !important;
          }
          
          /* Hide all buttons during print */
          button {
            display: none !important;
          }
          
          /* Clean page margins */
          @page {
            margin: 0.5cm;
          }
        }
      `}</style>
    </div>
    </ModalPortal>
  );
};

export default ReceiptModal; 