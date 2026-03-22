import { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState({
    language: 'en',
    receiptFooter: 'Thank you for your business!',
    theme: 'light',
    taxRate: 12,
    lowStockThreshold: 10
  });

  const [translations, setTranslations] = useState({});

  // Load settings from localStorage on init
  useEffect(() => {
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsedSettings }));
      } catch (error) {
        console.error('Error parsing saved settings:', error);
      }
    }
  }, []);

  // Load translations based on current language
  useEffect(() => {
    loadTranslations(settings.language);
  }, [settings.language]);

  const loadTranslations = (language) => {
    const translations = {
      en: {
        // Common
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        add: 'Add',
        search: 'Search',
        loading: 'Loading...',
        yes: 'Yes',
        no: 'No',
        confirm: 'Confirm',

        // Navigation
        dashboard: 'Dashboard',
        inventory: 'Inventory',
        pos: 'Point of Sale',
        sales: 'Sales',
        reports: 'Reports',
        settings: 'Settings',
        analytics: 'Analytics',

        // Settings
        generalSettings: 'General Settings',
        systemSettings: 'System Settings',
        receiptSettings: 'Receipt Settings',
        language: 'Language',
        lowStockThreshold: 'Low Stock Threshold',
        receiptFooter: 'Receipt Footer Text',
        settingsSaved: 'Settings saved successfully',

        // Receipt & POS
        receipt: 'Receipt',
        total: 'Total',
        subtotal: 'Subtotal',
        tax: 'Tax (12%)',
        change: 'Change',
        cash: 'Cash',
        paymentMethod: 'Payment Method',
        amountReceived: 'Amount Received',
        thankYou: 'Thank you for your business!',

        // Product
        product: 'Product',
        products: 'Products',
        price: 'Price',
        quantity: 'Quantity',
        stock: 'Stock',
        category: 'Category',

        // Actions
        processPayment: 'Process Payment',
        addToCart: 'Add to Cart',
        removeFromCart: 'Remove from Cart',
        clearCart: 'Clear Cart',
        checkout: 'Checkout'
      },
      fil: {
        // Common
        save: 'I-save',
        cancel: 'Kanselahin',
        delete: 'Tanggalin',
        edit: 'I-edit',
        add: 'Magdagdag',
        search: 'Maghanap',
        loading: 'Naglo-load...',
        yes: 'Oo',
        no: 'Hindi',
        confirm: 'Kumpirmahin',

        // Navigation
        dashboard: 'Dashboard',
        inventory: 'Imbentaryo',
        pos: 'Point of Sale',
        sales: 'Mga Benta',
        reports: 'Mga Ulat',
        settings: 'Mga Setting',
        analytics: 'Analytics',

        // Settings
        generalSettings: 'Pangkalahatang Settings',
        systemSettings: 'System Settings',
        receiptSettings: 'Receipt Settings',
        language: 'Wika',
        lowStockThreshold: 'Low Stock Threshold',
        receiptFooter: 'Receipt Footer Text',
        settingsSaved: 'Matagumpay na na-save ang mga setting',

        // Receipt & POS
        receipt: 'Resibo',
        total: 'Kabuuan',
        subtotal: 'Subtotal',
        tax: 'Buwis (12%)',
        change: 'Sukli',
        cash: 'Cash',
        paymentMethod: 'Paraan ng Bayad',
        amountReceived: 'Natatanggap na Halaga',
        thankYou: 'Salamat sa inyong negosyo!',

        // Product
        product: 'Produkto',
        products: 'Mga Produkto',
        price: 'Presyo',
        quantity: 'Dami',
        stock: 'Stock',
        category: 'Kategorya',

        // Actions
        processPayment: 'Prosesahin ang Bayad',
        addToCart: 'Idagdag sa Cart',
        removeFromCart: 'Alisin sa Cart',
        clearCart: 'Linisin ang Cart',
        checkout: 'Checkout'
      }
    };

    setTranslations(translations[language] || translations.en);
  };

  const updateSettings = (newSettings) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    // Save to localStorage
    localStorage.setItem('appSettings', JSON.stringify(updatedSettings));

    return updatedSettings;
  };

  const t = (key) => {
    return translations[key] || key;
  };

  const value = {
    settings,
    updateSettings,
    t, // translation function
    translations
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}; 