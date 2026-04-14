import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { UserIcon, Cog6ToothIcon, Squares2X2Icon, PrinterIcon, PencilIcon, CheckIcon, XMarkIcon, PhotoIcon, PlusIcon, CircleStackIcon, QuestionMarkCircleIcon } from '@heroicons/react/24/outline';
import { categoryService } from '../../services/api';
import UserManagement from './UserManagement';
import BackupRestoreScreen from './BackupRestoreScreen';
import { useGlobalBarcode } from '../../context/BarcodeContext';
import HelpManualScreen from './HelpManualScreen';
import { savePrinterSettings, getPrinterSettings } from '../../constants/thermalPrinter';
import jboLogo from '../../assets/jbologo.png';

const SettingsScreen = () => {
  const { user } = useAuth();
  const { suspendScanning, resumeScanning } = useGlobalBarcode();
  useEffect(() => {
    suspendScanning();
    return () => {
      resumeScanning();
    };
  }, []);
  const { settings, updateSettings, t } = useSettings();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [localSettings, setLocalSettings] = useState({
    theme: settings.theme || 'light',
    language: settings.language || 'en',
    receiptFooter: settings.receiptFooter || '',
    taxRate: settings.taxRate ?? 12,
    lowStockThreshold: settings.lowStockThreshold ?? 10
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      // Update the global settings
      updateSettings(localSettings);
      toast.success(t('settingsSaved'));
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Error saving settings:', error);
    }
  };

  const tabs = [
    {
      id: 'general',
      name: t('generalSettings'),
      icon: Cog6ToothIcon,
      component: GeneralSettings
    },
    {
      id: 'printer',
      name: 'Printer',
      icon: PrinterIcon,
      component: PrinterSettings
    }
  ];

  // Add User Management tab only for admins
  if (user?.role === 'admin') {
    tabs.push({
      id: 'categories',
      name: 'Categories',
      icon: Squares2X2Icon,
      component: CategoryManager
    });
    tabs.push({
      id: 'users',
      name: 'User Management',
      icon: UserIcon,
      component: UserManagement
    });
    tabs.push({
      id: 'backup',
      name: 'Backup & Restore',
      icon: CircleStackIcon,
      component: BackupRestoreScreen
    });
  }

  // Help & Manual — visible to all users
  tabs.push({
    id: 'manual',
    name: 'Help & Manual',
    icon: QuestionMarkCircleIcon,
    component: HelpManualScreen
  });

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || GeneralSettings;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${colors.text.primary}`}>{t('settings')}</h1>

      {/* Tab Navigation */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} mb-6`}>
        <div className={`border-b ${colors.border.primary}`}>
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${activeTab === tab.id
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                  : `border-transparent ${colors.text.secondary} hover:${colors.text.primary} hover:border-gray-300 dark:hover:border-gray-600`
                  }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <ActiveComponent
        settings={localSettings}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        colors={colors}
        user={user}
      />
    </div>
  );
};

// General Settings Component
const GeneralSettings = ({ settings, handleChange, handleSubmit, colors, user }) => {
  const { t, updateSettings } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [showDefaultsModal, setShowDefaultsModal] = useState(false);
  const [storeInfo, setStoreInfo] = useState({
    storeName: 'JBO Arts & Crafts Trading',
    tagline: 'Your trusted partner for arts and crafts supplies',
    email: 'jboartsandcrafts@gmail.com',
    phone: '0932 868 7911',
    address: '#303 B1A J.R. Blvd Tagapo, Santa Rosa, Philippines',
    businessHours: 'Mon-Sat: 8:00 AM - 6:00 PM',
    logoUrl: jboLogo
  });
  const fileInputRef = useRef(null);

  // Load store info from API on mount
  useEffect(() => {
    const fetchStoreInfo = async () => {
      try {
        const response = await fetch('/api/store-info');
        if (response.ok) {
          const data = await response.json();
          if (Object.keys(data).length > 0) {
            setStoreInfo(prev => ({ ...prev, ...data }));
            localStorage.setItem('storeInfo', JSON.stringify(data));
            return;
          }
        }
      } catch (e) {
        console.error('Error fetching store info from API:', e);
      }
      
      // Fallback to localStorage
      const savedStoreInfo = localStorage.getItem('storeInfo');
      if (savedStoreInfo) {
        try {
          const parsed = JSON.parse(savedStoreInfo);
          setStoreInfo(prev => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error('Error parsing store info from localStorage:', e);
        }
      }
    };
    fetchStoreInfo();
  }, []);

  const handleStoreInfoChange = (field, value) => {
    setStoreInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveStoreInfo = async () => {
    try {
      const response = await fetch('/api/store-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storeInfo),
      });
      if (response.ok) {
        localStorage.setItem('storeInfo', JSON.stringify(storeInfo));
        setIsEditing(false);
        toast.success('Store information saved!');
      } else {
        toast.error('Failed to save store info to server');
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Error saving store info');
      // Fallback: still save locally
      localStorage.setItem('storeInfo', JSON.stringify(storeInfo));
      setIsEditing(false);
    }
  };

  const handleCancelEdit = async () => {
    try {
      const response = await fetch('/api/store-info');
      if (response.ok) {
        const data = await response.json();
        if (Object.keys(data).length > 0) {
          setStoreInfo(prev => ({ ...prev, ...data }));
          setIsEditing(false);
          return;
        }
      }
    } catch (e) {}
    
    // Reload from localStorage
    const savedStoreInfo = localStorage.getItem('storeInfo');
    if (savedStoreInfo) {
      try {
        setStoreInfo(prev => ({ ...prev, ...JSON.parse(savedStoreInfo) }));
      } catch (e) { }
    }
    setIsEditing(false);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image must be less than 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setStoreInfo(prev => ({ ...prev, logoUrl: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Business Information</h2>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              title="Edit store information"
            >
              <PencilIcon className="h-5 w-5" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Cancel"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleSaveStoreInfo}
                className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                title="Save changes"
              >
                <CheckIcon className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center space-y-6">
          {/* Business Logo */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              {storeInfo.logoUrl ? (
                <img
                  src={storeInfo.logoUrl}
                  alt="Store Logo"
                  className="w-32 h-32 object-contain rounded-full shadow-lg border-4 border-yellow-300"
                />
              ) : (
                <div className="w-32 h-32 rounded-full shadow-lg border-4 border-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">JBO</div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400">Arts & Crafts</div>
                  </div>
                </div>
              )}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                  title="Change logo"
                >
                  <PhotoIcon className="h-4 w-4" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
            </div>
            <div className="text-center">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={storeInfo.storeName}
                    onChange={(e) => handleStoreInfoChange('storeName', e.target.value)}
                    className={`text-2xl font-bold text-center w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
                    placeholder="Store Name"
                  />
                  <input
                    type="text"
                    value={storeInfo.tagline}
                    onChange={(e) => handleStoreInfoChange('tagline', e.target.value)}
                    className={`text-center w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
                    placeholder="Tagline"
                  />
                </div>
              ) : (
                <>
                  <h3 className={`text-2xl font-bold ${colors.text.primary} mb-2`}>{storeInfo.storeName}</h3>
                  <p className={`${colors.text.secondary}`}>{storeInfo.tagline}</p>
                </>
              )}
            </div>
          </div>

          {/* Business Contact Information */}
          <div className={`w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t ${colors.border.primary}`}>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${colors.text.secondary}`}>Email</p>
                  {isEditing ? (
                    <input
                      type="email"
                      value={storeInfo.email}
                      onChange={(e) => handleStoreInfoChange('email', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-1 ${colors.input.primary}`}
                    />
                  ) : (
                    <p className={`font-medium ${colors.text.primary}`}>{storeInfo.email}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${colors.text.secondary}`}>Phone</p>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={storeInfo.phone}
                      onChange={(e) => handleStoreInfoChange('phone', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-1 ${colors.input.primary}`}
                    />
                  ) : (
                    <p className={`font-medium ${colors.text.primary}`}>{storeInfo.phone}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${colors.text.secondary}`}>Address</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={storeInfo.address}
                      onChange={(e) => handleStoreInfoChange('address', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-1 ${colors.input.primary}`}
                    />
                  ) : (
                    <p className={`font-medium ${colors.text.primary}`}>{storeInfo.address}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${colors.text.secondary}`}>Business Hours</p>
                  {isEditing ? (
                    <input
                      type="text"
                      value={storeInfo.businessHours}
                      onChange={(e) => handleStoreInfoChange('businessHours', e.target.value)}
                      className={`w-full border rounded-lg px-3 py-1 ${colors.input.primary}`}
                    />
                  ) : (
                    <p className={`font-medium ${colors.text.primary}`}>{storeInfo.businessHours}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>{t('systemSettings')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`} htmlFor="taxRate">
              Tax Rate (%) {user?.role === 'admin' && <span className="text-xs text-gray-500">(Admin Only)</span>}
            </label>
            <input
              type="number"
              id="taxRate"
              name="taxRate"
              value={settings.taxRate ?? 12}
              onChange={handleChange}
              className={`block w-full rounded-lg border-2 ${colors.border.primary} shadow-md ${colors.card.primary}
                focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:shadow-lg sm:text-sm
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                placeholder:${colors.text.tertiary} px-4 py-3 font-medium ${colors.text.primary}
                hover:${colors.border.secondary} hover:shadow-lg`}
              min="0"
              max="100"
              step="0.01"
              disabled={user?.role !== 'admin'}
            />
            <p className={`text-xs ${colors.text.secondary} mt-1`}>
              Tax rate for tax-inclusive pricing (0-100%)
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`} htmlFor="lowStockThreshold">
              {t('lowStockThreshold')}
            </label>
            <input
              type="number"
              id="lowStockThreshold"
              name="lowStockThreshold"
              value={settings.lowStockThreshold ?? 10}
              onChange={handleChange}
              className={`block w-full rounded-lg border-2 ${colors.border.primary} shadow-md ${colors.card.primary}
                focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:shadow-lg sm:text-sm
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                placeholder:${colors.text.tertiary} px-4 py-3 font-medium ${colors.text.primary}
                hover:${colors.border.secondary} hover:shadow-lg`}
              min="1"
              max="1000"
              step="1"
            />
            <p className={`text-xs ${colors.text.secondary} mt-1`}>
              Products at or below this quantity will be flagged as low stock
            </p>
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`} htmlFor="language">
              {t('language')}
            </label>
            <select
              id="language"
              name="language"
              value={settings.language}
              onChange={handleChange}
              className={`block w-full rounded-lg border-2 ${colors.border.primary} shadow-md ${colors.card.primary}
                focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:shadow-lg sm:text-sm
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                px-4 py-3 font-medium ${colors.text.primary}
                hover:${colors.border.secondary} hover:shadow-lg`}
            >
              <option value="en">English</option>
              <option value="fil">Filipino</option>
            </select>
          </div>
        </div>
      </div>

      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>{t('receiptSettings')}</h2>
        <div>
          <label className={`block text-sm font-medium ${colors.text.primary} mb-1`} htmlFor="receiptFooter">
            {t('receiptFooter')}
          </label>
          <textarea
            id="receiptFooter"
            name="receiptFooter"
            value={settings.receiptFooter}
            onChange={handleChange}
            className={`block w-full rounded-lg border-2 ${colors.border.primary} shadow-md ${colors.card.primary}
              focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:shadow-lg sm:text-sm
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
              placeholder:${colors.text.tertiary} px-4 py-3 font-medium ${colors.text.primary}
              hover:${colors.border.secondary} hover:shadow-lg resize-vertical`}
            rows="3"
            placeholder={t('thankYou')}
          />
          <p className={`text-sm ${colors.text.secondary} mt-2`}>
            This message will appear at the bottom of all receipts
          </p>
        </div>
      </div>
      <div className="flex justify-between">
        <button
          type="button"
          onClick={() => setShowDefaultsModal(true)}
          className="px-4 py-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 font-medium transition-colors"
        >
          Restore Defaults
        </button>
        <button type="submit" className="btn-primary">
          {t('save')} Settings
        </button>
      </div>
    </form>

    {/* Restore Defaults Confirmation Modal */}
    {showDefaultsModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm">
        <div className={`${colors.card.primary} rounded-2xl shadow-2xl max-w-md w-full border ${colors.border.primary}`}>
          <div className={`flex items-center gap-3 p-6 border-b ${colors.border.primary}`}>
            <div className="p-2 bg-amber-100 dark:bg-amber-900/20 rounded-full">
              <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className={`text-lg font-bold ${colors.text.primary}`}>Restore Default Settings</h3>
          </div>
          <div className="p-6">
            <p className={`${colors.text.secondary} mb-4`}>
              This will reset the following to their default values:
            </p>
            <ul className={`text-sm ${colors.text.secondary} space-y-1.5 mb-2 list-disc list-inside`}>
              <li>Store information (name, email, phone, address, hours)</li>
              <li>Store logo</li>
              <li>Tax rate (0%)</li>
              <li>Low stock threshold (10)</li>
              <li>Receipt footer</li>
            </ul>
          </div>
          <div className={`flex justify-end gap-3 p-6 border-t ${colors.border.primary}`}>
            <button
              type="button"
              onClick={() => setShowDefaultsModal(false)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${colors.text.secondary} hover:bg-gray-100 dark:hover:bg-slate-700`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setShowDefaultsModal(false);
                const defaultStoreInfo = {
                  storeName: 'JBO Arts & Crafts Trading',
                  tagline: 'Your trusted partner for arts and crafts supplies',
                  email: 'jboartsandcrafts@gmail.com',
                  phone: '0932 868 7911',
                  address: '#303 B1A J.R. Blvd Tagapo, Santa Rosa, Philippines',
                  businessHours: 'Mon-Sat: 8:00 AM - 6:00 PM',
                  logoUrl: jboLogo
                };
                setStoreInfo(defaultStoreInfo);
                try {
                  await fetch('/api/store-info', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(defaultStoreInfo),
                  });
                } catch (e) {
                  console.error('Error saving default store info:', e);
                }
                localStorage.setItem('storeInfo', JSON.stringify(defaultStoreInfo));
                handleChange({ target: { name: 'taxRate', value: 0 } });
                handleChange({ target: { name: 'lowStockThreshold', value: 10 } });
                handleChange({ target: { name: 'receiptFooter', value: '' } });
                updateSettings({ taxRate: 0, lowStockThreshold: 10, receiptFooter: '' });
                setIsEditing(false);
                toast.success('All settings restored to defaults!');
              }}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
            >
              Restore Defaults
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default SettingsScreen;

// Lightweight, stable CategoryManager (admin-only)
function CategoryManager() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryToDelete, setCategoryToDelete] = useState(null);

  const load = async () => {
    try {
      const list = await categoryService.getAll();
      setCategories(list || []);
    } catch { }
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }
    try {
      await categoryService.create(name.trim(), description.trim());
      toast.success('Category added successfully');
      setName('');
      setDescription('');
      setIsModalOpen(false);
      await load();
    } catch (error) {
      toast.error('Failed to add category');
      console.error('Error adding category:', error);
    }
  };

  const remove = (catName) => {
    setCategoryToDelete(catName);
  };

  const confirmRemove = async () => {
    if (!categoryToDelete) return;
    try {
      await categoryService.delete(categoryToDelete);
      toast.success('Category removed successfully');
      setCategoryToDelete(null);
      await load();
    } catch (error) {
      toast.error('Failed to remove category');
      console.error('Error removing category:', error);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setName('');
    setDescription('');
  };

  return (
    <>
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Manage Categories</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 rounded-lg font-medium transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Add Category
          </button>
        </div>

        <div className="divide-y">
          {categories.map((c) => (
            <div key={c.name} className="flex items-center justify-between py-3">
              <div>
                <div className={`font-medium ${colors.text.primary}`}>{c.name}</div>
                {c.description && <div className={`text-sm ${colors.text.secondary}`}>{c.description}</div>}
              </div>
              <button
                onClick={() => remove(c.name)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-700/50 dark:text-red-300 dark:hover:bg-red-900/20 transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
          {categories.length === 0 && (
            <div className={`text-sm ${colors.text.secondary} py-6 text-center`}>
              No categories yet. Click "Add Category" to create one.
            </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={handleCloseModal}
        >
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-md`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-6 py-4 border-b ${colors.border.primary}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                  <PlusIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Add New Category</h3>
                  <p className={`text-sm ${colors.text.secondary}`}>Create a new product category</p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className={`p-2 rounded-lg ${colors.bg.secondary} ${colors.text.secondary} hover:${colors.bg.tertiary} hover:${colors.text.primary} transition-colors`}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={add} className="px-6 py-5 space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary} focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="e.g., Electronics, Clothing, Food"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>
                  Description <span className={`text-xs ${colors.text.secondary}`}>(Optional)</span>
                </label>
                <textarea
                  className={`w-full px-3 py-2 rounded-lg border ${colors.input.primary} focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                  placeholder="Brief description of this category..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={`px-4 py-2 rounded-lg ${colors.bg.secondary} ${colors.text.secondary} hover:${colors.bg.tertiary} hover:${colors.text.primary} transition-colors`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors inline-flex items-center gap-2"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setCategoryToDelete(null)}
        >
          <div
            className={`${colors.card.primary} rounded-2xl shadow-2xl border ${colors.border.primary} w-full max-w-sm`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`px-6 py-4 border-b ${colors.border.primary}`}>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Remove Category</h3>
            </div>
            <div className="px-6 py-4">
              <p className={`${colors.text.secondary}`}>
                Are you sure you want to remove <strong className={colors.text.primary}>"{categoryToDelete}"</strong>?
              </p>
            </div>
            <div className={`px-6 py-4 border-t ${colors.border.primary} flex justify-end gap-2`}>
              <button
                onClick={() => setCategoryToDelete(null)}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemove}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// Printer Settings Component
const PrinterSettings = ({ colors }) => {
  const hasDesktopPrinterBridge =
    typeof window !== 'undefined' &&
    typeof window.printer?.listPrinters === 'function';
  const [printerSettings, setPrinterSettings] = useState({
    selectedPrinter: '',
    selectedPrinterType: 'usb', // usb or bluetooth
    silentPrint: true,
    paperWidth: '58mm',
    autoPrintReceipt: true,
    autoConnectBluetooth: true,
    bluetoothDeviceId: null
  });
  const [usbPrinters, setUsbPrinters] = useState([]);
  const [bluetoothPrinters, setBluetoothPrinters] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testPrintStatus, setTestPrintStatus] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [usbRawPrinterConnected, setUsbRawPrinterConnected] = useState(false);
  const [isSelectingUsb, setIsSelectingUsb] = useState(false);
  const activeUsbPrinter = (hasDesktopPrinterBridge
    ? (usbPrinters.find((printer) => printer.id === printerSettings.selectedPrinter) ||
      usbPrinters.find((printer) => printer.type === 'usb_raw' || printer.type === 'usb_serial') ||
      null)
    : null);
  const displayedUsbPrinters = hasDesktopPrinterBridge
    ? (activeUsbPrinter ? [activeUsbPrinter] : [])
    : usbPrinters;

  // Load saved settings and detect printers on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load saved printer settings
        const saved = getPrinterSettings();

        // Detect USB printers
        await detectUSBPrinters();
        if (hasDesktopPrinterBridge && typeof window.printer?.autoConnect === 'function') {
          try {
            await window.printer.autoConnect();
            await detectUSBPrinters();
          } catch (autoConnectError) {
            console.warn('Desktop auto-connect failed:', autoConnectError);
          }
        }

        // Check USB RAW printer connection status and restore selection
        try {
          if (hasDesktopPrinterBridge) {
            const detected = await window.printer.listPrinters();
            const usbCount = (detected?.usbPrinters || []).length + (detected?.usbSerialPorts || []).length;
            const hasUsb = usbCount > 0;
            setUsbRawPrinterConnected(hasUsb);
            if (hasUsb) {
              const preferred = detected.usbPrinters?.[0] || detected.usbSerialPorts?.[0];
              setPrinterSettings(prev => ({
                ...prev,
                ...(saved || {}),
                selectedPrinter: preferred.id,
                selectedPrinterType: preferred.transport === 'usb_serial' ? 'usb_serial' : 'usb_raw'
              }));
            }
            throw new Error('desktop-bridge-skip-webusb');
          }
          const { usbRawPrinter } = await import('../../utils/usbRawPrinter');
          const isUsbRawConnected = usbRawPrinter.isConnected && usbRawPrinter.device;
          setUsbRawPrinterConnected(isUsbRawConnected);

          // If USB RAW is connected, restore it as selected (even if not in saved settings)
          if (isUsbRawConnected) {
            setPrinterSettings(prev => ({
              ...prev,
              ...(saved || {}),
              selectedPrinter: 'usb-raw',
              selectedPrinterType: 'usb_raw'
            }));
          }
        } catch (error) {
          if (error?.message === 'desktop-bridge-skip-webusb') {
            // handled above for desktop bridge
          } else {
            console.warn('USB RAW printer not available:', error);
          }
          if (!hasDesktopPrinterBridge) {
            setUsbRawPrinterConnected(false);
          }
        }

        // Check Bluetooth connection status first
        let bluetoothConnected = false;
        let connectedBluetoothDevice = null;
        try {
          if (hasDesktopPrinterBridge) {
            throw new Error('desktop-bridge-skip-webbluetooth');
          }
          const { bluetoothPrinter } = await import('../../utils/bluetoothPrinter');
          // Check both isConnected flag and actual GATT connection
          bluetoothConnected = bluetoothPrinter.isConnected &&
            bluetoothPrinter.device &&
            bluetoothPrinter.device.gatt?.connected;
          if (bluetoothConnected && bluetoothPrinter.device) {
            connectedBluetoothDevice = {
              id: bluetoothPrinter.device.id,
              name: bluetoothPrinter.device.name,
              device: bluetoothPrinter.device
            };
          }
        } catch (error) {
          if (error?.message !== 'desktop-bridge-skip-webbluetooth') {
            console.warn('Bluetooth printer check failed:', error);
          }
        }

        // Detect Bluetooth printers (this gets previously authorized devices)
        await detectBluetoothPrinters();

        // If Bluetooth is connected, add it to the list and restore selection
        if (bluetoothConnected && connectedBluetoothDevice) {
          setBluetoothPrinters(prev => {
            // Check if device is already in the list
            const exists = prev.find(p => p.id === connectedBluetoothDevice.id);
            if (!exists) {
              return [...prev, {
                id: connectedBluetoothDevice.id,
                name: connectedBluetoothDevice.name,
                type: 'bluetooth',
                device: connectedBluetoothDevice.device
              }];
            }
            return prev;
          });

          // Restore Bluetooth selection if connected (even if not in saved settings)
          setPrinterSettings(prev => ({
            ...prev,
            ...(saved || {}),
            selectedPrinter: connectedBluetoothDevice.id,
            selectedPrinterType: 'bluetooth',
            bluetoothDeviceId: connectedBluetoothDevice.id
          }));
        }

        // Apply saved settings if we haven't already restored connection-based settings
        if (saved) {
          setPrinterSettings(prev => {
            // Only apply saved settings if we didn't just restore based on active connections
            const shouldApplySaved = !bluetoothConnected && !usbRawPrinterConnected;
            if (shouldApplySaved) {
              return { ...prev, ...saved };
            }
            // If we restored connection-based settings, merge with saved but keep connection settings
            return { ...prev, ...saved };
          });
        }

        // Auto-connect to Bluetooth if enabled and not already connected
        if (!bluetoothConnected && saved?.autoConnectBluetooth && saved?.bluetoothDeviceId) {
          setTimeout(() => autoConnectBluetooth(saved.bluetoothDeviceId), 1000);
        }
      } catch (error) {
        console.error('[PrinterSettings] Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const detectUSBPrinters = async () => {
    try {
      if (typeof window !== 'undefined' && typeof window.printer?.listPrinters === 'function') {
        const detected = await window.printer.listPrinters();
        const mappedUsb = (detected?.usbPrinters || []).map((printer) => ({
          id: printer.id || `usb-${printer.vendorIdHex}-${printer.productIdHex}-${printer.deviceAddress}`,
          name: printer.isXprinter
            ? `XPRINTER USB (${printer.vendorIdHex}:${printer.productIdHex})`
            : `USB Thermal Printer (${printer.vendorIdHex}:${printer.productIdHex})`,
          type: 'usb_raw',
          isRaw: true,
          vendorIdHex: printer.vendorIdHex,
          productIdHex: printer.productIdHex
        }));
        const mappedUsbSerial = (detected?.usbSerialPorts || []).map((port) => ({
          id: port.id || `usb-serial-${port.path}`,
          name: `${port.friendlyName || 'USB Serial Printer'} (${port.path})`,
          type: 'usb_serial',
          isRaw: true
        }));

        const merged = [...mappedUsb, ...mappedUsbSerial];
        setUsbPrinters(merged);
        setUsbRawPrinterConnected(merged.length > 0);
        return;
      }

      // Add system default printer and USB RAW (WebUSB) option
      const printers = [
        { id: 'system-default', name: 'System Default Printer (Windows Dialog)', type: 'usb', isDefault: true },
        { id: 'usb-raw', name: 'USB RAW/ESC Mode (WebUSB - Direct USB)', type: 'usb_raw', isRaw: true }
      ];
      setUsbPrinters(printers);
    } catch (error) {
      console.error('Failed to detect USB printers:', error);
    }
  };

  const detectBluetoothPrinters = async () => {
    try {
      if (hasDesktopPrinterBridge) {
        const detected = await window.printer.listPrinters();
        const printers = (detected?.bluetoothPorts || []).map((port) => ({
          id: port.path,
          name: port.friendlyName || port.path,
          type: 'bluetooth',
          portPath: port.path
        }));
        setBluetoothPrinters(printers);
        return;
      }

      // Check if Bluetooth is supported
      if (!('bluetooth' in navigator)) {
        return;
      }

      // Get previously paired Bluetooth devices
      const devices = await navigator.bluetooth.getDevices();
      let printers = devices
        .filter(d => d.name && (d.name.toLowerCase().includes('printer') || d.name.toLowerCase().includes('bt')))
        .map(d => ({
          id: d.id,
          name: d.name,
          type: 'bluetooth',
          device: d
        }));

      // Check if there's a currently connected Bluetooth printer and merge it
      try {
        const { bluetoothPrinter } = await import('../../utils/bluetoothPrinter');
        // Only include connected devices - remove disconnected ones
        if (bluetoothPrinter.isConnected && bluetoothPrinter.device && bluetoothPrinter.device.gatt?.connected) {
          const connectedDevice = {
            id: bluetoothPrinter.device.id,
            name: bluetoothPrinter.device.name,
            type: 'bluetooth',
            device: bluetoothPrinter.device
          };

          // Check if it's already in the list
          const exists = printers.find(p => p.id === connectedDevice.id);
          if (!exists) {
            printers.push(connectedDevice);
          } else {
            // Update existing entry with the actual connected device object
            const index = printers.findIndex(p => p.id === connectedDevice.id);
            printers[index] = connectedDevice;
          }
        } else {
          // Remove disconnected devices from the list
          printers = printers.filter(p => {
            // If this device was connected but is now disconnected, remove it
            if (bluetoothPrinter.device && p.id === bluetoothPrinter.device.id) {
              return bluetoothPrinter.isConnected && bluetoothPrinter.device.gatt?.connected;
            }
            // Keep previously paired devices (they might reconnect)
            return true;
          });
        }
      } catch (error) {
        // Ignore if bluetoothPrinter is not available
      }

      setBluetoothPrinters(printers);
    } catch (error) {
      console.error('Failed to detect Bluetooth printers:', error);
    }
  };

  const autoConnectBluetooth = async (deviceId) => {
    try {
      const { bluetoothPrinter } = await import('../../utils/bluetoothPrinter');

      // Check if already connected
      if (bluetoothPrinter.isConnected && bluetoothPrinter.device?.id === deviceId) {
        console.log('Bluetooth printer already connected');
        return;
      }

      // Get the device from the list
      const device = bluetoothPrinters.find(p => p.id === deviceId);
      if (device?.device) {
        // Try to reconnect using the existing device
        try {
          if (device.device.gatt) {
            const server = await device.device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

            bluetoothPrinter.device = device.device;
            bluetoothPrinter.characteristic = characteristic;
            bluetoothPrinter.isConnected = true;

            toast.success(`Auto-connected to ${device.name}`);
          }
        } catch (error) {
          console.error('Reconnection failed, may need to scan again:', error);
          // If reconnection fails, user will need to scan again
        }
      }
    } catch (error) {
      console.error('Auto-connect failed:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPrinterSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const success = savePrinterSettings(printerSettings);
    if (success) {
      toast.success('Printer settings saved successfully');
    } else {
      toast.error('Failed to save printer settings');
    }
  };

  const handleScanBluetooth = async () => {
    setIsScanning(true);
    try {
      if (hasDesktopPrinterBridge) {
        await detectBluetoothPrinters();
        toast.success('Bluetooth COM ports refreshed. Select a port to use Bluetooth printing.');
        return;
      }

      const { bluetoothPrinter } = await import('../../utils/bluetoothPrinter');
      const device = await bluetoothPrinter.connect();

      // Add to Bluetooth printers list if not already there, including device object
      setBluetoothPrinters(prev => {
        const exists = prev.find(p => p.id === device.id);
        if (!exists) {
          return [...prev, {
            id: device.id,
            name: device.name,
            type: 'bluetooth',
            device: bluetoothPrinter.device // Include the actual device object
          }];
        } else {
          // Update existing entry with device object
          return prev.map(p =>
            p.id === device.id
              ? { ...p, device: bluetoothPrinter.device }
              : p
          );
        }
      });

      // Select this printer and save settings
      const newSettings = {
        selectedPrinter: device.id,
        selectedPrinterType: 'bluetooth',
        bluetoothDeviceId: device.id
      };
      setPrinterSettings(prev => ({ ...prev, ...newSettings }));

      // Save to localStorage
      savePrinterSettings({ ...printerSettings, ...newSettings });

      toast.success(`Connected to ${device.name}`);
      await detectBluetoothPrinters(); // Refresh list
    } catch (error) {
      console.error('Bluetooth scan failed:', error);
      toast.error(error.message || 'Failed to connect to Bluetooth printer');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectPrinter = (printer) => {
    setPrinterSettings(prev => ({
      ...prev,
      selectedPrinter: printer.id,
      selectedPrinterType: printer.type,
      bluetoothDeviceId: printer.type === 'bluetooth' ? printer.id : null
    }));
  };

  const handleConnectUSBRaw = async () => {
    try {
      if (hasDesktopPrinterBridge) {
        setIsSelectingUsb(true);
        const selectedResponse = await window.printer.selectUsbPrinter(printerSettings.selectedPrinter || undefined);
        const selectedUsb = selectedResponse?.selected;
        if (!selectedUsb) {
          toast.error('No USB thermal printer detected. Connect your XPRINTER and try again.');
          setIsSelectingUsb(false);
          return;
        }

        await detectUSBPrinters();
        setUsbRawPrinterConnected(true);
        const newSettings = {
          selectedPrinter: selectedUsb.id,
          selectedPrinterType: selectedUsb.transport === 'usb_serial' ? 'usb_serial' : 'usb_raw'
        };
        setPrinterSettings(prev => {
          const updated = { ...prev, ...newSettings };
          savePrinterSettings(updated);
          return updated;
        });
        const label = selectedUsb.transport === 'usb_serial'
          ? `${selectedUsb.friendlyName || selectedUsb.path}`
          : `${selectedUsb.vendorIdHex}:${selectedUsb.productIdHex}`;
        toast.success(`USB printer selected: ${label}`);
        setIsSelectingUsb(false);
        return;
      }

      const { usbRawPrinter } = await import('../../utils/usbRawPrinter');
      if (!usbRawPrinter.isSupported()) {
        toast.error('WebUSB is not supported. Please use Chrome, Edge, or Opera browser.');
        return;
      }

      toast.loading('Select your USB printer from the device list...', { id: 'usb-connect' });

      await usbRawPrinter.requestDevice();
      setUsbRawPrinterConnected(true);
      toast.success('USB printer connected successfully!', { id: 'usb-connect' });

      // Update settings and save
      const newSettings = {
        selectedPrinter: 'usb-raw',
        selectedPrinterType: 'usb_raw'
      };
      setPrinterSettings(prev => {
        const updated = { ...prev, ...newSettings };
        console.log('[Settings] Saving USB RAW settings:', updated);
        savePrinterSettings(updated);
        return updated;
      });
    } catch (error) {
      console.error('USB RAW connection failed:', error);
      setUsbRawPrinterConnected(false);
      setIsSelectingUsb(false);
      toast.dismiss('usb-connect');

      if (error.message === 'DEVICE_CLAIMED_BY_WINDOWS' ||
        error.message.includes('Access denied') ||
        error.message.includes('denied')) {
        const detailedMessage = `⚠️ USB Printer Access Denied

The printer is currently claimed by Windows drivers. To use WebUSB:

STEP 1: Remove from Windows
• Open Windows Settings → Devices → Printers & Scanners
• Find your printer and click "Remove device"
• If it doesn't appear, check Device Manager (Win+X → Device Manager)
• Look under "Print queues" or "Universal Serial Bus devices"
• Right-click your printer → Uninstall device (check "Delete driver" if prompted)

STEP 2: Disable Windows Printer Service (Optional)
• Press Win+R, type: services.msc
• Find "Print Spooler" service
• Right-click → Stop (temporarily)
• Try connecting again
• Restart service after testing

STEP 3: Physical Steps
• Unplug USB cable
• Wait 5 seconds
• Plug back in
• Try connecting again

STEP 4: Browser Permissions
• Make sure you grant USB device access when browser prompts
• Check Chrome: chrome://settings/content/usbDevices

If still not working, the printer may require special drivers that conflict with WebUSB.`;

        alert(detailedMessage);
        toast.error('Access denied. See alert for detailed instructions.', { duration: 10000 });
      } else if (error.message && error.message.includes('SecurityError')) {
        toast.error('Permission denied. Please grant USB device access when prompted by your browser.', { duration: 5000 });
      } else if (error.message && error.message.includes('No suitable')) {
        toast.error('Device selected is not a compatible ESC/POS printer. Please select a thermal receipt printer.', { duration: 6000 });
      } else if (error.message && error.message.includes('NotFoundError')) {
        toast.error('No device selected. Please select your printer from the device list.', { duration: 5000 });
      } else {
        toast.error(error.message || 'Failed to connect USB printer', { duration: 5000 });
      }
    }
  };

  const handleDisconnectUSBRaw = async () => {
    try {
      if (typeof window !== 'undefined' && typeof window.printer?.listPrinters === 'function') {
        setUsbRawPrinterConnected(false);
        const newSettings = {
          selectedPrinter: 'system-default',
          selectedPrinterType: 'usb'
        };
        setPrinterSettings(prev => {
          const updated = { ...prev, ...newSettings };
          savePrinterSettings(updated);
          return updated;
        });
        toast.success('USB printer deselected');
        return;
      }

      const { usbRawPrinter } = await import('../../utils/usbRawPrinter');

      // Disconnect the printer
      if (usbRawPrinter.isConnected && usbRawPrinter.device) {
        await usbRawPrinter.disconnect();
      }

      setUsbRawPrinterConnected(false);

      // Reset to USB printer and save settings
      const newSettings = {
        selectedPrinter: 'system-default',
        selectedPrinterType: 'usb'
      };
      setPrinterSettings(prev => {
        const updated = { ...prev, ...newSettings };
        savePrinterSettings(updated);
        return updated;
      });

      toast.success('USB printer disconnected');
    } catch (error) {
      console.error('USB RAW disconnect failed:', error);
      setUsbRawPrinterConnected(false);
      toast.error('Failed to disconnect USB printer: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDisconnectBluetooth = async () => {
    try {
      if (hasDesktopPrinterBridge) {
        const newSettings = {
          selectedPrinter: 'system-default',
          selectedPrinterType: 'usb',
          bluetoothDeviceId: null
        };
        setPrinterSettings(prev => {
          const updated = { ...prev, ...newSettings };
          savePrinterSettings(updated);
          return updated;
        });
        toast.success('Bluetooth printer deselected');
        return;
      }

      const { bluetoothPrinter } = await import('../../utils/bluetoothPrinter');

      // Disconnect the printer
      if (bluetoothPrinter.device && bluetoothPrinter.device.gatt?.connected) {
        await bluetoothPrinter.disconnect();
      }

      // Clear the device reference
      bluetoothPrinter.device = null;
      bluetoothPrinter.characteristic = null;
      bluetoothPrinter.isConnected = false;

      // Reset to USB printer and save settings
      const newSettings = {
        selectedPrinter: 'system-default',
        selectedPrinterType: 'usb',
        bluetoothDeviceId: null
      };
      setPrinterSettings(prev => {
        const updated = { ...prev, ...newSettings };
        savePrinterSettings(updated);
        return updated;
      });

      // Remove disconnected device from the list
      const disconnectedDeviceId = printerSettings.bluetoothDeviceId;
      setBluetoothPrinters(prev => prev.filter(p => p.id !== disconnectedDeviceId));

      toast.success('Disconnected from Bluetooth printer');
      await detectBluetoothPrinters(); // Refresh list
    } catch (error) {
      console.error('Bluetooth disconnect failed:', error);
      toast.error('Failed to disconnect: ' + (error.message || 'Unknown error'));
    }
  };

  const handleTestPrint = async () => {
    setTestPrintStatus('printing');
    try {
      const { printerService } = await import('../../utils/printerService');

      // Update config with current settings
      printerService.saveConfig({
        ...printerSettings,
        silentPrint: printerSettings.silentPrint
      });

      // Run test print
      const result = await printerService.testPrint();

      setTestPrintStatus('success');
      toast.success(`Test print sent via ${result.method}!`);
    } catch (error) {
      console.error('[PrinterSettings] Test print failed:', error);
      setTestPrintStatus('error');
      toast.error('Test print failed: ' + (error.message || 'Unknown error'));
    }

    // Reset status after 3 seconds
    setTimeout(() => setTestPrintStatus(null), 3000);
  };

  if (isLoading) {
    return (
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-500/30 border-t-blue-500"></div>
          <span className={`ml-3 ${colors.text.secondary}`}>Loading printer settings...</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Available Printers List */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <div className="flex items-center justify-between mb-6">
          <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Available Printers</h2>
          {!hasDesktopPrinterBridge && (
            <button
              type="button"
              onClick={handleScanBluetooth}
              disabled={isScanning}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2
                bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/30
                disabled:opacity-50`}
            >
              <PrinterIcon className={`h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
              {isScanning ? 'Scanning...' : 'Scan Bluetooth'}
            </button>
          )}
        </div>

        {/* USB Printers Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className={`text-sm font-semibold ${colors.text.primary} uppercase tracking-wide flex items-center gap-2`}>
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              USB Printers
            </h3>
            {hasDesktopPrinterBridge ? (
              <button
                type="button"
                onClick={handleConnectUSBRaw}
                disabled={isSelectingUsb}
                className="px-3 py-1.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 text-sm font-medium disabled:opacity-50"
              >
                {isSelectingUsb ? 'Selecting...' : 'Select USB Printer'}
              </button>
            ) : (
              <div className={`text-xs ${colors.text.secondary} px-3 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800`}>
                ⚠️ WebUSB requires printer to be removed from Windows Printers & Scanners
              </div>
            )}
          </div>
          <div className="space-y-2">
            {displayedUsbPrinters.map((printer) => (
              <div
                key={printer.id}
                onClick={() => handleSelectPrinter(printer)}
                className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${printerSettings.selectedPrinter === printer.id
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : `border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700`
                  }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <PrinterIcon className={`h-5 w-5 ${printerSettings.selectedPrinter === printer.id
                      ? 'text-blue-600 dark:text-blue-400'
                      : colors.text.secondary
                      }`} />
                    <div>
                      <p className={`font-medium ${colors.text.primary}`}>{printer.name}</p>
                      <p className={`text-xs ${colors.text.secondary}`}>
                        {printer.isRaw ? 'WebUSB Direct Connection' : 'USB Connection'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {printerSettings.selectedPrinter === printer.id && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">
                        Selected
                      </span>
                    )}
                    {printer.isRaw && printerSettings.selectedPrinter === printer.id && (
                      <>
                        {usbRawPrinterConnected ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDisconnectUSBRaw();
                            }}
                            className="px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 text-sm font-medium"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleConnectUSBRaw();
                            }}
                            className="px-3 py-1.5 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/30 text-sm font-medium"
                          >
                            Connect USB
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {hasDesktopPrinterBridge && displayedUsbPrinters.length === 0 && (
              <div className={`p-4 rounded-lg border-2 border-dashed ${colors.border.primary} text-center`}>
                <p className={`text-sm ${colors.text.secondary}`}>
                  No USB printer detected yet. Click "Select USB Printer".
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Bluetooth Printers Section */}
        {!hasDesktopPrinterBridge && (
          <div>
          <h3 className={`text-sm font-semibold ${colors.text.primary} uppercase tracking-wide mb-3 flex items-center gap-2`}>
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Bluetooth Printers
          </h3>
          {bluetoothPrinters.length === 0 ? (
            <div className={`p-4 rounded-lg border-2 border-dashed ${colors.border.primary} text-center`}>
              <p className={`text-sm ${colors.text.secondary}`}>
                No Bluetooth printers found. Click "Scan Bluetooth" to search.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {bluetoothPrinters.map((printer) => (
                <div
                  key={printer.id}
                  className={`p-4 rounded-lg border-2 transition-all ${printerSettings.selectedPrinter === printer.id
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : `border-gray-200 dark:border-gray-700`
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 cursor-pointer"
                      onClick={() => handleSelectPrinter(printer)}
                    >
                      <PrinterIcon className={`h-5 w-5 ${printerSettings.selectedPrinter === printer.id
                        ? 'text-purple-600 dark:text-purple-400'
                        : colors.text.secondary
                        }`} />
                      <div>
                        <p className={`font-medium ${colors.text.primary}`}>{printer.name}</p>
                        <p className={`text-xs ${colors.text.secondary}`}>Bluetooth Connection</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {printerSettings.selectedPrinter === printer.id && (
                        <>
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium">
                            Selected
                          </span>
                          <button
                            type="button"
                            onClick={handleDisconnectBluetooth}
                            className="px-3 py-1.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 text-sm font-medium"
                          >
                            Disconnect
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        )}
      </div>

      {/* Test & Save */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleTestPrint}
            disabled={testPrintStatus === 'printing'}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2
              ${testPrintStatus === 'success'
                ? 'bg-green-600 text-white'
                : testPrintStatus === 'error'
                  ? 'bg-red-600 text-white'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }
              disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <PrinterIcon className="h-5 w-5" />
            {testPrintStatus === 'printing' ? 'Printing...' :
              testPrintStatus === 'success' ? 'Success!' :
                testPrintStatus === 'error' ? 'Failed' :
                  'Test Print'}
          </button>

          <button
            type="submit"
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </form>
  );
};