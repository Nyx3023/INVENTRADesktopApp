import { useEffect, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { supplierService } from '../../services/api';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  PhoneIcon, 
  EnvelopeIcon, 
  MapPinIcon, 
  UserIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import ModalPortal from '../common/ModalPortal';

// Facebook/Messenger Icon
const FacebookIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.04C6.5 2.04 2 6.53 2 12.06C2 17.06 5.66 21.21 10.44 21.96V14.96H7.9V12.06H10.44V9.85C10.44 7.34 11.93 5.96 14.22 5.96C15.31 5.96 16.45 6.15 16.45 6.15V8.62H15.19C13.95 8.62 13.56 9.39 13.56 10.18V12.06H16.34L15.89 14.96H13.56V21.96A10 10 0 0 0 22 12.06C22 6.53 17.5 2.04 12 2.04Z"/>
  </svg>
);

const SuppliersScreen = () => {
  const { colors } = useTheme();
  const [suppliers, setSuppliers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ 
    id: null, 
    name: '', 
    contactPerson: '', 
    phone: '', 
    email: '', 
    address: '', 
    notes: '',
    // Social media links
    facebookUrl: '',
    messengerUrl: '',
    websiteUrl: ''
  });

  const load = async () => {
    try {
      setIsLoading(true);
      const list = await supplierService.getAll();
      setSuppliers(list || []);
    } catch (e) {
      toast.error('Failed to load suppliers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ 
      id: null, 
      name: '', 
      contactPerson: '', 
      phone: '', 
      email: '', 
      address: '', 
      notes: '',
      facebookUrl: '',
      messengerUrl: '',
      websiteUrl: ''
    });
    setShowModal(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!form.name.trim()) return toast.error('Supplier name is required');
      
      const supplierData = {
        name: form.name,
        contact_person: form.contactPerson,
        phone: form.phone,
        email: form.email,
        address: form.address,
        notes: form.notes,
        facebook_url: form.facebookUrl,
        messenger_url: form.messengerUrl,
        website_url: form.websiteUrl
      };

      if (form.id) {
        await supplierService.update(form.id, supplierData);
        toast.success('Supplier updated');
      } else {
        await supplierService.create(supplierData);
        toast.success('Supplier added');
      }
      resetForm();
      await load();
    } catch (e) {
      toast.error('Save failed');
    }
  };

  const edit = (s) => {
    setForm({
      id: s.id, 
      name: s.name || '', 
      contactPerson: s.contact_person || s.contactPerson || '',
      phone: s.phone || '', 
      email: s.email || '', 
      address: s.address || '', 
      notes: s.notes || '',
      facebookUrl: s.facebook_url || s.facebookUrl || '',
      messengerUrl: s.messenger_url || s.messengerUrl || '',
      websiteUrl: s.website_url || s.websiteUrl || ''
    });
    setShowModal(true);
  };

  const [supplierToDelete, setSupplierToDelete] = useState(null);

  const remove = (id) => {
    const supplier = suppliers.find(s => s.id === id);
    setSupplierToDelete(supplier);
  };

  const confirmRemove = async () => {
    if (!supplierToDelete) return;
    try {
      await supplierService.delete(supplierToDelete.id);
      toast.success('Supplier deleted');
      setSupplierToDelete(null);
      await load();
    } catch {
      toast.error('Delete failed');
    }
  };

  // Open messenger with the supplier
  const openMessenger = (supplier) => {
    const messengerUrl = supplier.messenger_url || supplier.messengerUrl;
    const facebookUrl = supplier.facebook_url || supplier.facebookUrl;
    
    if (messengerUrl) {
      window.open(messengerUrl, '_blank');
    } else if (facebookUrl) {
      // Convert Facebook URL to Messenger URL if possible
      const fbId = facebookUrl.match(/facebook\.com\/([^/?]+)/)?.[1];
      if (fbId) {
        window.open(`https://m.me/${fbId}`, '_blank');
      } else {
        window.open(facebookUrl, '_blank');
      }
    } else {
      toast.error('No messenger link available for this supplier');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Suppliers</h1>
            <p className={`text-sm ${colors.text.secondary} mt-1`}>Manage your product suppliers and their contact information</p>
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="btn-primary flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Suppliers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className={`col-span-full text-center py-12 ${colors.text.secondary}`}>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-4"></div>
            Loading suppliers...
          </div>
        ) : suppliers.length === 0 ? (
          <div className={`col-span-full text-center py-12 ${colors.text.secondary}`}>
            No suppliers yet. Add your first supplier!
          </div>
        ) : (
          suppliers.map((s) => (
            <div 
              key={s.id} 
              className={`${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} p-5 hover:shadow-md transition-shadow h-full flex flex-col`}
            >
              {/* Header + contact info */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className={`text-lg font-semibold ${colors.text.primary}`}>{s.name}</h3>
                    {(s.contact_person || s.contactPerson) && (
                      <p className={`text-sm ${colors.text.secondary} flex items-center gap-1 mt-1`}>
                        <UserIcon className="h-4 w-4" />
                        {s.contact_person || s.contactPerson}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button 
                      onClick={() => edit(s)} 
                      className={`p-2 rounded-lg ${colors.bg.tertiary} text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30`}
                      title="Edit"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => remove(s.id)} 
                      className={`p-2 rounded-lg ${colors.bg.tertiary} text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30`}
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {s.phone && (
                    <p className={`flex items-center gap-2 ${colors.text.secondary}`}>
                      <PhoneIcon className="h-4 w-4 text-green-600" />
                      {s.phone}
                    </p>
                  )}
                  {s.email && (
                    <p className={`flex items-center gap-2 ${colors.text.secondary}`}>
                      <EnvelopeIcon className="h-4 w-4 text-blue-600" />
                      {s.email}
                    </p>
                  )}
                  {s.address && (
                    <p className={`flex items-start gap-2 ${colors.text.secondary}`}>
                      <MapPinIcon className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                      <span className="break-words line-clamp-2 overflow-hidden text-ellipsis">{s.address}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Social Media Links / Footer */}
              <div className={`flex items-center gap-2 mt-4 pt-4 border-t ${colors.border.primary}`}>
                {(s.messenger_url || s.messengerUrl || s.facebook_url || s.facebookUrl) && (
                  <button
                    onClick={() => openMessenger(s)}
                    className={`flex items-center gap-2 px-3 py-1.5 ${colors.bg.tertiary} ${colors.text.primary} rounded-lg text-sm hover:${colors.bg.hover} transition-colors`}
                    title="Open Messenger"
                  >
                    <ChatBubbleLeftRightIcon className="h-4 w-4" />
                    Message
                  </button>
                )}
                {(s.facebook_url || s.facebookUrl) && (
                  <a
                    href={s.facebook_url || s.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-2 rounded-lg ${colors.bg.secondary} ${colors.text.secondary} hover:${colors.bg.tertiary} hover:${colors.text.primary} transition-colors`}
                    title="Facebook"
                  >
                    <FacebookIcon />
                  </a>
                )}
                {(s.website_url || s.websiteUrl) && (
                  <a
                    href={s.website_url || s.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-2 rounded-lg ${colors.bg.secondary} ${colors.text.secondary} hover:${colors.bg.tertiary} hover:${colors.text.primary} transition-colors`}
                    title="Website"
                  >
                    <GlobeAltIcon className="h-5 w-5" />
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <ModalPortal>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={resetForm}>
          <div 
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-2xl max-h-[90vh] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <div className="flex items-center justify-between">
                <h3 className={`text-xl font-bold ${colors.text.primary}`}>
                  {form.id ? 'Edit Supplier' : 'Add New Supplier'}
                </h3>
                <button 
                  onClick={resetForm}
                  className={`p-2 rounded-lg hover:${colors.bg.secondary} transition-colors`}
                >
                  <XMarkIcon className={`h-6 w-6 ${colors.text.secondary}`} />
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                {/* Basic Info */}
                <div>
                  <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3`}>Basic Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>Supplier Name *</label>
                      <input 
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                        placeholder="Enter supplier name" 
                        value={form.name} 
                        onChange={(e) => setForm({ ...form, name: e.target.value })} 
                        required
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>Contact Person</label>
                      <input 
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                        placeholder="Contact person name" 
                        value={form.contactPerson} 
                        onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} 
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>Phone</label>
                      <input 
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                        placeholder="Phone number" 
                        value={form.phone} 
                        onChange={(e) => setForm({ ...form, phone: e.target.value })} 
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>Email</label>
                      <input 
                        type="email"
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                        placeholder="Email address" 
                        value={form.email} 
                        onChange={(e) => setForm({ ...form, email: e.target.value })} 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>Address</label>
                      <input 
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                        placeholder="Full address" 
                        value={form.address} 
                        onChange={(e) => setForm({ ...form, address: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                {/* Social Media Links */}
                <div>
                  <h4 className={`text-sm font-semibold ${colors.text.primary} mb-3`}>Social Media & Links</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>
                        <span className="flex items-center gap-2">
                          <FacebookIcon /> Facebook URL
                        </span>
                      </label>
                      <input 
                        type="url"
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                        placeholder="https://facebook.com/supplier" 
                        value={form.facebookUrl} 
                        onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })} 
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>
                        <span className="flex items-center gap-2">
                          <ChatBubbleLeftRightIcon className="h-5 w-5" /> Messenger URL
                        </span>
                      </label>
                      <input 
                        type="url"
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                        placeholder="https://m.me/supplier" 
                        value={form.messengerUrl} 
                        onChange={(e) => setForm({ ...form, messengerUrl: e.target.value })} 
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>
                        <span className="flex items-center gap-2">
                          <GlobeAltIcon className="h-5 w-5" /> Website URL
                        </span>
                      </label>
                      <input 
                        type="url"
                        className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                        placeholder="https://supplier-website.com" 
                        value={form.websiteUrl} 
                        onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} 
                      />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className={`block text-sm font-medium mb-1 ${colors.text.secondary}`}>Notes</label>
                  <textarea 
                    className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`} 
                    placeholder="Additional notes about this supplier" 
                    rows={3}
                    value={form.notes} 
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} 
                  />
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-3`}>
              <button 
                type="button"
                onClick={resetForm} 
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button 
                onClick={handleSubmit}
                className="btn-primary flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                {form.id ? 'Update Supplier' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {supplierToDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSupplierToDelete(null)}
        >
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-sm`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Delete Supplier</h3>
            </div>
            <div className="px-6 py-4">
              <p className={`${colors.text.secondary}`}>
                Are you sure you want to delete <strong className={colors.text.primary}>{supplierToDelete.name}</strong>?
              </p>
            </div>
            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
              <button
                onClick={() => setSupplierToDelete(null)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuppliersScreen;
