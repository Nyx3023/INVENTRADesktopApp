import { useState, lazy, Suspense } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth, usePermissions } from '../../context/AuthContext';
import {
  CubeIcon,
  ClipboardDocumentListIcon,
  ShoppingCartIcon,
  TruckIcon,
  ScaleIcon
} from '@heroicons/react/24/outline';
import LazyPageLoader from '../common/LazyPageLoader';

const ProductsTab = lazy(() => import('./InventoryScreen'));
const AuditsTab = lazy(() => import('../Audits/AuditsScreen'));
const SuppliersTab = lazy(() => import('./SuppliersScreen'));
const StockAdjustmentsTab = lazy(() => import('./StockAdjustmentsScreen'));

const LoadingSpinner = () => (
  <LazyPageLoader
    title="Loading tab"
    subtitle="Fetching section content..."
    rows={4}
    centered
  />
);

const InventoryPageWrapper = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('products');

  const tabs = [
    { id: 'products', name: 'Products', icon: CubeIcon, permission: 'view_inventory' },
    { id: 'adjustments', name: 'Stock Adjustments', icon: ScaleIcon, permission: 'adjust_stock' },
    { id: 'audits', name: 'Audits', icon: ClipboardDocumentListIcon, permission: 'perform_audits' },
    { id: 'suppliers', name: 'Suppliers', icon: TruckIcon, permission: 'manage_suppliers' },
  ];

  const visibleTabs = tabs.filter(tab => hasPermission(tab.permission));

  const renderTabContent = () => {
    switch (activeTab) {
      case 'products':
        return hasPermission('view_inventory') ? <ProductsTab /> : null;
      case 'adjustments':
        return hasPermission('adjust_stock') ? <StockAdjustmentsTab /> : null;
      case 'audits':
        return hasPermission('perform_audits') ? <AuditsTab /> : null;
      case 'suppliers':
        return hasPermission('manage_suppliers') ? <SuppliersTab /> : null;
      default:
        return hasPermission('view_inventory') ? <ProductsTab /> : null;
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Tab Navigation */}
      <div className={`${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} p-2`}>
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 ${isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : `${colors.text.secondary} hover:${colors.bg.secondary} hover:${colors.text.primary}`
                  }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={<LoadingSpinner />}>
          {renderTabContent()}
        </Suspense>
      </div>
    </div>
  );
};

export default InventoryPageWrapper;

