import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../context/ThemeContext';
import { formatCurrency } from '../../utils/formatters';
import { 
  DocumentArrowDownIcon, 
  PaperAirplaneIcon, 
  XMarkIcon,
  CheckIcon,
  PencilSquareIcon,
  CubeIcon,
  BuildingStorefrontIcon,
  ClipboardDocumentListIcon
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex">
      {/* LEFT SIDEBAR - Controls & Info */}
      <div 
        className={`w-[320px] flex-shrink-0 ${colors.bg.primary} border-r ${colors.border.primary} flex flex-col h-full`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar Header */}
        <div className={`px-5 py-4 border-b ${colors.border.primary} flex items-center justify-between flex-shrink-0`}>
          <div className="flex items-center gap-2">
            <PencilSquareIcon className="h-5 w-5 text-blue-500" />
            <h2 className={`text-lg font-bold ${colors.text.primary}`}>Invoice Editor</h2>
          </div>
          <button 
            onClick={onDiscard}
            className={`p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors`}
            title="Close Preview"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Status Badge */}
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full dark:bg-blue-900 dark:text-blue-300">
              Editable Draft
            </span>
            <span className={`text-xs ${colors.text.tertiary}`}>
              {new Date().toLocaleDateString()}
            </span>
          </div>

          {/* Supplier Info */}
          <div className={`${colors.bg.secondary} rounded-xl p-4 border ${colors.border.primary}`}>
            <div className="flex items-center gap-2 mb-3">
              <BuildingStorefrontIcon className={`h-4 w-4 ${colors.text.secondary}`} />
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${colors.text.secondary}`}>Supplier</h3>
            </div>
            {supplier ? (
              <div className="space-y-1.5">
                <p className={`text-sm font-semibold ${colors.text.primary}`}>{supplier.name}</p>
                {supplier.phone && <p className={`text-xs ${colors.text.secondary}`}>📞 {supplier.phone}</p>}
                {supplier.email && <p className={`text-xs ${colors.text.secondary}`}>✉️ {supplier.email}</p>}
                {supplier.address && <p className={`text-xs ${colors.text.secondary}`}>📍 {supplier.address}</p>}
              </div>
            ) : (
              <p className={`text-sm italic ${colors.text.tertiary}`}>No supplier selected</p>
            )}
          </div>

          {/* Order Summary */}
          <div className={`${colors.bg.secondary} rounded-xl p-4 border ${colors.border.primary}`}>
            <div className="flex items-center gap-2 mb-3">
              <ClipboardDocumentListIcon className={`h-4 w-4 ${colors.text.secondary}`} />
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${colors.text.secondary}`}>Order Summary</h3>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className={`text-xs ${colors.text.secondary}`}>Items</span>
                <span className={`text-sm font-semibold ${colors.text.primary}`}>{draft.items.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-xs ${colors.text.secondary}`}>Total Qty</span>
                <span className={`text-sm font-semibold ${colors.text.primary}`}>
                  {draft.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
                </span>
              </div>
              <div className={`h-px ${colors.border.primary}`}></div>
              <div className="flex justify-between items-center">
                <span className={`text-xs ${colors.text.secondary}`}>Subtotal</span>
                <span className={`text-sm font-semibold ${colors.text.primary}`}>{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-xs ${colors.text.secondary}`}>Discount</span>
                <span className={`text-sm ${colors.text.secondary}`}>0.00</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-xs ${colors.text.secondary}`}>Tax</span>
                <span className={`text-sm ${colors.text.secondary}`}>0.00</span>
              </div>
              <div className={`h-px ${colors.border.primary}`}></div>
              <div className="flex justify-between items-center">
                <span className={`text-sm font-bold ${colors.text.primary}`}>Grand Total</span>
                <span className={`text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent`}>
                  {formatCurrency(calculateSubtotal())}
                </span>
              </div>
            </div>
          </div>

          {/* Items List Mini */}
          <div className={`${colors.bg.secondary} rounded-xl p-4 border ${colors.border.primary}`}>
            <div className="flex items-center gap-2 mb-3">
              <CubeIcon className={`h-4 w-4 ${colors.text.secondary}`} />
              <h3 className={`text-xs font-semibold uppercase tracking-wider ${colors.text.secondary}`}>Items ({draft.items.length})</h3>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {draft.items.map((item, idx) => (
                <div key={idx} className={`flex justify-between items-center text-xs py-1.5 px-2 rounded-lg ${colors.bg.primary}`}>
                  <span className={`${colors.text.primary} font-medium truncate flex-1 mr-2`}>{item.productName || 'Unnamed'}</span>
                  <span className={`${colors.text.secondary} flex-shrink-0`}>x{item.quantity}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Footer - Action Buttons */}
        <div className={`px-5 py-4 border-t ${colors.border.primary} flex-shrink-0 space-y-2.5 ${colors.bg.secondary}`}>
          {supplier && (supplier.facebook_url || supplier.messenger_url || supplier.facebookUrl || supplier.messengerUrl) && (
            <button 
              onClick={onSendTo}
              className="w-full btn-secondary inline-flex items-center justify-center gap-2 !border-blue-500 !text-blue-600 hover:!bg-blue-50 dark:!text-blue-400 dark:hover:!bg-blue-900/30 py-2.5 rounded-xl text-sm font-medium"
            >
              <PaperAirplaneIcon className="h-4 w-4" />
              Send To {supplier.name.split(' ')[0]}
            </button>
          )}
          <button 
            onClick={onSaveOnly}
            className="w-full btn-secondary inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
          >
            <CheckIcon className="h-4 w-4" />
            Save to Database
          </button>
          <button 
            onClick={onDownload}
            className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-3 rounded-xl text-sm font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Confirm & Download PDF
          </button>
        </div>
      </div>

      {/* RIGHT SIDE - Invoice Preview (Full remaining space) */}
      <div 
        className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-100 dark:bg-gray-900 flex justify-center items-start"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Virtual Form Container matching PDF */}
        <div className="bg-white w-full max-w-[900px] min-h-[700px] shadow-2xl p-8 md:p-10 font-sans text-gray-900 relative border hover:border-gray-300 flex flex-col transition-all my-4 rounded-sm">
          
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
             <div>
                <p className="text-sm mb-1 text-gray-600">Purchase Order #</p>
                <p className="border-b border-gray-400 pb-0.5 w-48 font-bold text-lg">{draft?.id || '—'}</p>
             </div>
             <div className="text-right">
                <h1 className="text-3xl font-black text-gray-800 tracking-tight">{storeInfo.storeName}</h1>
                <p className="text-sm text-gray-700 mt-2">{storeInfo.address}</p>
                <p className="text-sm text-gray-700">{storeInfo.email}</p>
                <p className="text-sm text-gray-700">{storeInfo.phone}</p>
             </div>
          </div>

          {/* Grid Form */}
          <div className="grid grid-cols-2 border border-gray-400 mb-6 text-sm">
              {/* Left Side */}
              <div className="border-r border-gray-400">
                <div className="flex border-b border-gray-400">
                  <div className="w-24 py-1.5 px-3 border-r border-gray-400 text-gray-600">Name:</div>
                  <div className="py-1.5 px-3 flex-1 font-semibold">{supplier?.name || '—'}</div>
                </div>
                <div className="flex border-b border-gray-400">
                  <div className="w-24 py-1.5 px-3 border-r border-gray-400 text-gray-600">Phone:</div>
                  <div className="py-1.5 px-3 flex-1 font-semibold">{supplier?.phone || '—'}</div>
                </div>
                <div className="flex border-b border-gray-400">
                  <div className="w-24 py-1.5 px-3 border-r border-gray-400 text-gray-600">Email:</div>
                  <div className="py-1.5 px-3 flex-1 font-semibold">{supplier?.email || '—'}</div>
                </div>
                <div className="flex">
                  <div className="w-24 py-1.5 px-3 border-r border-gray-400 text-gray-600">Address:</div>
                  <div className="py-1.5 px-3 flex-1 font-semibold">{supplier?.address || '—'}</div>
                </div>
              </div>

              {/* Right Side */}
              <div>
                <div className="flex border-b border-gray-400">
                  <div className="w-28 py-1.5 px-3 border-r border-gray-400 text-gray-600">Date:</div>
                  <div className="py-1.5 px-3 flex-1 font-semibold">{new Date().toLocaleDateString()}</div>
                </div>
                <div className="flex border-b border-gray-400">
                  <div className="w-28 py-1.5 px-3 border-r border-gray-400 text-gray-600">Order Status:</div>
                  <div className="py-1.5 px-3 flex-1 font-bold text-amber-600">DRAFT</div>
                </div>
                <div className="flex border-b border-gray-400">
                  <div className="w-28 py-1.5 px-3 border-r border-gray-400 text-gray-600">Tracking Ref:</div>
                  <div className="py-1.5 px-3 flex-1 text-gray-400">—</div>
                </div>
                <div className="flex">
                  <div className="w-28 py-1.5 px-3 border-r border-gray-400 text-gray-600">Delivery Term:</div>
                  <div className="py-1.5 px-3 flex-1 text-gray-400">—</div>
                </div>
              </div>
          </div>

          {/* Interactive Items Table */}
          <div className="mb-auto">
             <table className="w-full text-left border-collapse border border-gray-400">
                <thead>
                   <tr className="bg-[#b4b4b4] text-black text-sm border-b border-gray-400">
                      <th className="py-2 px-3 border-r border-gray-400 font-bold w-1/2 text-center">Item Description</th>
                      <th className="py-2 px-3 border-r border-gray-400 font-bold text-center w-24">Quantity</th>
                      <th className="py-2 px-3 border-r border-gray-400 font-bold text-center w-32">Unit price</th>
                      <th className="py-2 px-3 font-bold text-center">Amount</th>
                   </tr>
                </thead>
                <tbody>
                   {draft.items.length === 0 ? (
                      <tr>
                         <td colSpan="4" className="py-8 text-center text-gray-400 italic">No items added to draft</td>
                      </tr>
                   ) : (
                      draft.items.map((item, idx) => (
                         <tr key={idx} className="border-b border-gray-400 hover:bg-gray-50 transition-colors group">
                            <td className="py-1.5 px-3 border-r border-gray-400">
                               <input 
                                  type="text" 
                                  value={item.productName} 
                                  onChange={(e) => handleUpdateItem(idx, 'productName', e.target.value)}
                                  className="w-full bg-transparent border-none focus:ring-0 p-0 text-sm focus:outline-none font-medium"
                                  placeholder="Product Name"
                               />
                            </td>
                            <td className="py-1.5 px-3 border-r border-gray-400 text-center">
                               <input 
                                  type="number" 
                                  min="1"
                                  value={item.quantity} 
                                  onChange={(e) => handleUpdateItem(idx, 'quantity', e.target.value)}
                                  className="w-full text-center bg-transparent border-none focus:ring-0 p-0 text-sm focus:outline-none text-gray-800"
                               />
                            </td>
                            <td className="py-1.5 px-3 border-r border-gray-400 text-right">
                               <div className="flex items-center justify-end">
                                  <input 
                                     type="number" 
                                     min="0"
                                     step="0.01"
                                     value={item.unitCost} 
                                     onChange={(e) => handleUpdateItem(idx, 'unitCost', e.target.value)}
                                     className="w-full text-right bg-transparent border-none focus:ring-0 p-0 text-sm focus:outline-none text-gray-800"
                                  />
                               </div>
                            </td>
                            <td className="py-1.5 px-3 text-right text-sm font-medium">
                               {formatCurrency(Number(item.quantity) * Number(item.unitCost || 0))}
                            </td>
                         </tr>
                      ))
                   )}
                   {/* Padding rows similar to PDF template */}
                   {[...Array(Math.max(0, 10 - draft.items.length))].map((_, i) => (
                      <tr key={`pad-${i}`} className="border-b border-gray-400 h-8">
                        <td className="border-r border-gray-400 bg-gray-50/50"></td>
                        <td className="border-r border-gray-400 bg-gray-50/50"></td>
                        <td className="border-r border-gray-400 bg-gray-50/50"></td>
                        <td className="bg-gray-50/50"></td>
                      </tr>
                   ))}
                </tbody>
             </table>
          </div>

          {/* Bottom Section */}
          <div className="flex justify-between items-start mt-8 pb-4">
             
             {/* Notes Box */}
             <div className="w-[45%]">
                <div className="bg-[#b4b4b4] border border-gray-400 border-b-0 py-1 text-center font-bold text-sm text-black">
                  Notes
                </div>
                <textarea
                   value={draft.notes}
                   onChange={(e) => handleUpdateNotes(e.target.value)}
                   className="w-full bg-white border border-gray-400 p-2 text-sm text-gray-800 focus:outline-none resize-none h-20"
                   placeholder="Enter any notes or instructions..."
                />
             </div>
             
             {/* Totals Box */}
             <div className="w-[45%] text-sm">
                <div className="flex justify-between py-1">
                   <span className="w-24 text-gray-600">Subtotal:</span>
                   <span className="flex-1 border-b border-black text-right pr-1 pb-0.5">{formatCurrency(calculateSubtotal())}</span>
                </div>
                <div className="flex justify-between py-1 mt-1">
                   <span className="w-24 text-gray-600">Discount:</span>
                   <span className="flex-1 border-b border-black text-right pr-1 pb-0.5">0.00</span>
                </div>
                <div className="flex justify-between py-1 mt-1">
                   <span className="w-24 text-gray-600">Tax:</span>
                   <span className="flex-1 border-b border-black text-right pr-1 pb-0.5">0.00</span>
                </div>
                <div className="flex justify-between py-1 mt-2 font-bold">
                   <span className="w-24">Grand total:</span>
                   <span className="flex-1 border-b-[1.5px] border-black text-right pr-1 pb-0.5 text-base">{formatCurrency(calculateSubtotal())}</span>
                </div>
             </div>
          </div>

          {/* Print Footer */}
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 font-sans tracking-wide">
            {storeInfo.phone} • {storeInfo.email}
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

export default InvoicePreviewModal;
