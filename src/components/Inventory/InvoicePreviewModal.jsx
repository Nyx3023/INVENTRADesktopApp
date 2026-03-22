import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../context/ThemeContext';
import { formatCurrency } from '../../utils/formatters';
import { 
  DocumentArrowDownIcon, 
  PaperAirplaneIcon, 
  XMarkIcon,
  CheckIcon,
  PencilSquareIcon 
} from '@heroicons/react/24/outline';

const InvoicePreviewModal = ({ 
  isOpen, 
  onClose, 
  draft, 
  setDraft,
  supplier,
  onDownload,
  onSaveOnly,
  onDiscard,
  onSendTo
}) => {
  const { colors } = useTheme();
  const [storeInfo, setStoreInfo] = useState({
    storeName: 'JBO Arts & Crafts Trading',
    address: '#303 B1A J.R. Blvd Tagapo, Santa Rosa, Philippines',
    phone: '0932 868 7911',
    email: 'jboartsandcrafts@gmail.com'
  });

  useEffect(() => {
    try {
      const savedStoreInfo = localStorage.getItem('storeInfo');
      if (savedStoreInfo) {
        setStoreInfo({ ...storeInfo, ...JSON.parse(savedStoreInfo) });
      }
    } catch (e) {
      // Ignored
    }
  }, []);

  if (!isOpen) return null;

  const handleUpdateItem = (index, field, value) => {
    const newItems = [...draft.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setDraft({ ...draft, items: newItems });
  };

  const handleUpdateNotes = (notes) => {
    setDraft({ ...draft, notes });
  };

  const calculateSubtotal = () => {
    return draft.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitCost || 0)), 0);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] overflow-y-auto">
      <div 
        className={`${colors.bg.primary} w-full max-w-4xl min-h-[90vh] my-8 rounded-2xl shadow-2xl flex flex-col relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar */}
        <div className={`sticky top-0 z-10 flex flex-wrap items-center justify-between p-4 border-b ${colors.border.primary} ${colors.bg.secondary} rounded-t-2xl shadow-sm gap-4`}>
          <div className="flex items-center gap-2">
            <h2 className={`text-lg font-bold ${colors.text.primary} flex items-center gap-2`}>
              <PencilSquareIcon className="h-5 w-5text-blue-500" />
              Invoice Preview Editor
            </h2>
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300 ml-2">Editable</span>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {supplier && (supplier.facebook_url || supplier.messenger_url || supplier.facebookUrl || supplier.messengerUrl) && (
               <button 
                  onClick={onSendTo}
                  className="btn-secondary inline-flex items-center gap-2 !border-blue-500 !text-blue-600 hover:!bg-blue-50 dark:!text-blue-400 dark:hover:!bg-blue-900/30"
               >
                 <PaperAirplaneIcon className="h-4 w-4" />
                 Send To {supplier.name.split(' ')[0]}
               </button>
            )}
            <button 
              onClick={onSaveOnly}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <CheckIcon className="h-4 w-4" />
              Save to Database
            </button>
            <button 
              onClick={onDownload}
              className="btn-primary inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              Confirm & Download PDF
            </button>
            <button 
              onClick={onDiscard}
              className="ml-2 p-2 rounded-full hover:bg-red-100 text-red-500 transition-colors"
              title="Discard Order"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Paper Container */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-100 dark:bg-gray-900 flex justify-center`}>
          
          {/* Virtual A4 Paper Container */}
          <div className="bg-white w-full max-w-[800px] min-h-[600px] shadow-2xl p-6 sm:p-10 font-sans text-gray-900 relative">
            
            {/* Paper Header */}
            <div className="flex justify-between items-start border-b-[3px] border-yellow-500 pb-6 mb-8">
               <div>
                  <h1 className="text-3xl font-black text-gray-800 tracking-tight">{storeInfo.storeName}</h1>
                  <div className="mt-2 text-sm text-gray-500 space-y-1">
                     <p>{storeInfo.address}</p>
                     <p>{storeInfo.phone} • {storeInfo.email}</p>
                  </div>
               </div>
               <div className="text-right">
                  <h2 className="text-4xl font-bold text-gray-300 tracking-widest uppercase mb-2">Invoice</h2>
                  <p className="text-sm font-semibold text-gray-600">No. <span className="text-gray-400 font-normal">DRAFT</span></p>
                  <p className="text-sm font-semibold text-gray-600">Date: <span className="text-gray-400 font-normal">{new Date().toLocaleDateString()}</span></p>
               </div>
            </div>

            {/* Bill To & Supplier */}
            <div className="grid grid-cols-2 gap-8 mb-10 text-sm">
                <div>
                  <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">BILL TO</h3>
                  <p className="font-semibold">{storeInfo.storeName}</p>
                  <p className="text-gray-600 mt-1">{storeInfo.address}</p>
                  <p className="text-gray-600">{storeInfo.phone}</p>
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">SUPPLIER</h3>
                  {!supplier ? (
                     <p className="text-gray-400 italic">No supplier selected</p>
                  ) : (
                     <>
                        <p className="font-semibold text-blue-600 underline decoration-dotted">{supplier.name}</p>
                        <p className="text-gray-600 mt-1">{supplier.address || 'No address provided'}</p>
                        <p className="text-gray-600">{supplier.phone || ''}</p>
                     </>
                  )}
                </div>
            </div>

            {/* Interactive Items Table */}
            <div className="mb-10">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-yellow-50 text-gray-800 text-sm">
                        <th className="py-3 px-4 border-b-2 border-yellow-200 font-bold w-1/2">ITEM DESCRIPTION</th>
                        <th className="py-3 px-4 border-b-2 border-yellow-200 font-bold text-center w-24">QTY</th>
                        <th className="py-3 px-4 border-b-2 border-yellow-200 font-bold text-right w-32">UNIT PRICE</th>
                        <th className="py-3 px-4 border-b-2 border-yellow-200 font-bold text-right">LINE TOTAL</th>
                     </tr>
                  </thead>
                  <tbody>
                     {draft.items.length === 0 ? (
                        <tr>
                           <td colSpan="4" className="py-8 text-center text-gray-400 italic border-b">No items added to draft</td>
                        </tr>
                     ) : (
                        draft.items.map((item, idx) => (
                           <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors group">
                              <td className="py-3 px-4">
                                 <input 
                                    type="text" 
                                    value={item.productName} 
                                    onChange={(e) => handleUpdateItem(idx, 'productName', e.target.value)}
                                    className="w-full bg-transparent border-0 border-b border-transparent focus:border-blue-300 focus:ring-0 p-0 text-sm font-semibold text-gray-800 transition-colors"
                                    placeholder="Product Name"
                                 />
                              </td>
                              <td className="py-3 px-4 text-center">
                                 <input 
                                    type="number" 
                                    min="1"
                                    value={item.quantity} 
                                    onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                    className="w-full text-center bg-transparent border-0 border-b border-transparent focus:border-blue-300 focus:ring-0 p-0 text-sm text-gray-700 hover:bg-white rounded transition-colors"
                                 />
                              </td>
                              <td className="py-3 px-4 text-right">
                                 <div className="flex items-center justify-end">
                                    <span className="text-gray-400 text-xs mr-1">₱</span>
                                    <input 
                                       type="number" 
                                       min="0"
                                       step="0.01"
                                       value={item.unitCost} 
                                       onChange={(e) => handleUpdateItem(idx, 'unitCost', e.target.value)}
                                       className="w-20 text-right bg-transparent border-0 border-b border-transparent focus:border-blue-300 focus:ring-0 p-0 text-sm text-gray-700 hover:bg-white rounded transition-colors"
                                    />
                                 </div>
                              </td>
                              <td className="py-3 px-4 text-right text-sm font-medium text-gray-800">
                                 {formatCurrency(Number(item.quantity) * Number(item.unitCost || 0))}
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>

            {/* Totals Section */}
            <div className="flex justify-between items-start">
               <div className="w-1/2 pr-8">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Notes / Instructions</label>
                  <textarea
                     value={draft.notes}
                     onChange={(e) => handleUpdateNotes(e.target.value)}
                     className="w-full bg-gray-50 border border-gray-100 rounded p-3 text-sm text-gray-600 focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 resize-none h-24 transition-shadow"
                     placeholder="Enter any notes, terms, or order instructions here..."
                  />
               </div>
               
               <div className="w-1/3">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                     <span className="text-sm font-semibold text-gray-600">Subtotal</span>
                     <span className="text-sm text-gray-800">{formatCurrency(calculateSubtotal())}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                     <span className="text-sm font-semibold text-gray-600">Discount</span>
                     <span className="text-sm text-gray-400">0.00</span>
                  </div>
                  <div className="flex justify-between py-3 mt-2 border-t-2 border-yellow-400">
                     <span className="text-lg font-black text-yellow-600">TOTAL</span>
                     <span className="text-lg font-black text-gray-900">{formatCurrency(calculateSubtotal())}</span>
                  </div>
               </div>
            </div>

            {/* Absolute Footer (relative to paper bottom padding) */}
            <div className="absolute bottom-6 left-6 right-6 sm:bottom-10 sm:left-10 sm:right-10 border-t border-gray-200 pt-4 flex flex-wrap justify-between gap-4 text-xs text-gray-400">
               <span>{storeInfo.phone} • {storeInfo.email}</span>
               <span>Thank you for your business!</span>
            </div>

          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InvoicePreviewModal;
