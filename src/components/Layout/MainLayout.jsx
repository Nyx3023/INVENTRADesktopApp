import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, usePermissions } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalBarcode } from '../../context/BarcodeContext';
import { useNavigationBlocker } from '../../context/NavigationBlockerContext';
import useSystemShortcuts from '../../hooks/useSystemShortcuts';
import {
  HomeIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  CubeIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  CalculatorIcon,
  BellIcon,
  UserCircleIcon,
  SunIcon,
  MoonIcon,
  ArchiveBoxIcon,
  ClipboardDocumentListIcon,
  PrinterIcon
} from '@heroicons/react/24/outline';
import { ClockIcon } from '@heroicons/react/24/outline';
import { JBO_LOGO } from '../../utils/logo';
import NotificationCenter from '../Notifications/NotificationCenter';
// Removed cloud sync indicators

const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { t } = useSettings();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { isScanning } = useGlobalBarcode();
  const { isBlocked, blockNavigation, backAttempted, resetBackAttempt } = useNavigationBlocker();

  const [storeLogo, setStoreLogo] = useState(JBO_LOGO);

  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [showNavModal, setShowNavModal] = useState(false);
  const [attemptedPath, setAttemptedPath] = useState(null);

  const handleShortcutIntercept = (path, shouldLogout) => {
    setAttemptedPath(shouldLogout ? '/login' : path);
    setShowNavModal(true);
  };
  useSystemShortcuts(handleShortcutIntercept);

  const [printerStatus, setPrinterStatus] = useState({
    available: false,
    connected: false,
    label: 'Printer',
    detail: 'Unavailable',
  });

  const mapPrinterStatus = (status) => {
    if (!status) {
      return {
        available: false,
        connected: false,
        label: 'Printer',
        detail: 'Unavailable',
      };
    }

    const transportMap = {
      usb: 'USB',
      usb_serial: 'USB Serial',
      bluetooth: 'Bluetooth',
    };
    const modeLabel = transportMap[status.transport] || 'Printer';
    const connected = !!status.connected;
    const detail = connected
      ? `${modeLabel} connected`
      : (status.lastError || `${modeLabel} disconnected`);

    return {
      available: true,
      connected,
      label: modeLabel,
      detail,
    };
  };

  // Trap the browser back button if blocked
  useEffect(() => {
    if (isBlocked) {
      window.history.pushState(null, '', window.location.href);
    }
  }, [isBlocked]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (isBlocked) {
        // Prevent default native back navigation
        window.history.pushState(null, '', window.location.href);
        // Show our intercept modal, user might want to go to Dashboard or just generally 'Back'
        setAttemptedPath(-1); // -1 signifies a history.back()
        setShowNavModal(true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isBlocked]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Load store logo from localStorage/API
  useEffect(() => {
    try {
      const savedStoreInfo = localStorage.getItem('storeInfo');
      if (savedStoreInfo) {
        const parsed = JSON.parse(savedStoreInfo);
        if (parsed.logoUrl) {
          setStoreLogo(parsed.logoUrl);
        }
      }
    } catch (e) {
      console.error('Error loading store logo:', e);
    }

    // Listen for storage changes (when settings page saves a new logo)
    const handleStorageChange = (e) => {
      if (e.key === 'storeInfo' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.logoUrl) {
            setStoreLogo(parsed.logoUrl);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.printer?.getStatus !== 'function') {
      return;
    }

    let mounted = true;
    const applyStatus = (status) => {
      if (!mounted) return;
      setPrinterStatus(mapPrinterStatus(status));
    };

    const refreshStatus = () => {
      window.printer.getStatus()
        .then((status) => applyStatus(status))
        .catch(() => {
          applyStatus(null);
        });
    };

    refreshStatus();

    const unsubscribe = typeof window.printer?.onStatusChange === 'function'
      ? window.printer.onStatusChange((status) => applyStatus(status))
      : () => undefined;
    const pollId = setInterval(refreshStatus, 2500);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(pollId);
    };
  }, []);

  // Navigation items - Audits and Purchase Products are now inside Inventory
  const navigation = [
    { name: t('dashboard'), icon: HomeIcon, href: '/', gradient: 'from-blue-500 to-blue-600', shortcut: 'F1' },
    { name: t('inventory'), icon: CubeIcon, href: '/inventory', gradient: 'from-emerald-500 to-emerald-600', permission: 'view_inventory', shortcut: 'F3' },
    { name: 'Reports', icon: ChartBarIcon, href: '/statistical-reports', gradient: 'from-teal-500 to-teal-600', permission: 'view_statistical_reports' },
    { name: t('sales'), icon: DocumentTextIcon, href: '/sales', gradient: 'from-amber-500 to-amber-600', permission: 'view_sales_history', shortcut: 'F4' },
    { name: 'Point of Sale', icon: CalculatorIcon, href: '/pos', gradient: 'from-purple-500 to-purple-600', permission: 'process_sales', shortcut: 'F2' },
  ].filter(nav => !nav.permission || hasPermission(nav.permission));

  const isActivePath = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const handleLogout = () => {
    if (isBlocked) {
      setAttemptedPath('/login');
      setShowNavModal(true);
      return;
    }
    logout();
    navigate('/login');
  };

  const handleNavigationClick = (e, path) => {
    if (isBlocked && location.pathname !== path) {
      e.preventDefault();
      setAttemptedPath(path);
      setShowNavModal(true);
    }
  };

  const confirmNavigation = () => {
    setShowNavModal(false);
    blockNavigation(false); // Unblock the route manually
    
    // Slight delay to allow state updates to flush before navigating
    setTimeout(() => {
      if (attemptedPath === '/login') {
        logout();
      }
      if (attemptedPath === -1) {
        navigate(-1);
      } else if (attemptedPath) {
        navigate(attemptedPath);
      }
      setAttemptedPath(null);
    }, 0);
  };

  const cancelNavigation = () => {
    setShowNavModal(false);
    setAttemptedPath(null);
  };

  const getPageTitle = () => {
    const currentNav = navigation.find(nav => isActivePath(nav.href));
    return currentNav?.name || 'Dashboard';
  };

  const isPOS = location.pathname.startsWith('/pos');

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden brand-sand">
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

        {/* Top Header */}
        <header className={`brand-header border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-sm backdrop-blur-sm relative`}>
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <Link to="/" onClick={(e) => handleNavigationClick(e, '/')} className="flex items-center gap-2 flex-shrink-0">
              <img
                src={storeLogo}
                alt="Store Logo"
                className="w-10 h-10 object-contain rounded-lg"
              />
            </Link>
            {/* Page Title */}
            <div>
              <h1 className={`text-2xl font-bold text-white`}>{getPageTitle()}</h1>
              <p className={`text-sm text-white/80`}>Welcome back, {user?.name || 'User'}</p>
            </div>
          </div>
          {/* Tabs */}
          <nav className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            {navigation.map((item) => {
              const active = isActivePath(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`brand-tab ${active ? 'brand-tab-active' : ''}`}
                  onClick={(e) => handleNavigationClick(e, item.href)}
                  title={item.shortcut ? `${item.name} (${item.shortcut})` : item.name}
                >
                  {String(item.name).toUpperCase()}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            {/* Live printer status (desktop bridge only) */}
            {printerStatus.available && (
              <div
                className={`hidden sm:inline-flex relative items-center justify-center p-1.5 rounded-lg border shrink-0 ${
                  printerStatus.connected
                    ? 'bg-emerald-500/20 border-emerald-300/40 text-emerald-100'
                    : 'bg-rose-500/20 border-rose-300/40 text-rose-100'
                }`}
                title={printerStatus.detail}
              >
                <PrinterIcon className="h-5 w-5" />
                <span
                  className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-slate-900/40 ${
                    printerStatus.connected ? 'bg-emerald-300' : 'bg-rose-300'
                  }`}
                />
              </div>
            )}

            {/* Date & Time (compact, Windows 11-like) */}
            <div
              className={`hidden sm:flex flex-col items-end px-2 py-1 rounded-lg bg-white/10 text-white leading-tight`}
              title={currentDateTime.toLocaleString()}
            >
              <span className={`text-sm font-semibold`}>{currentDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className={`text-[10px] text-white/80`}>{currentDateTime.toLocaleDateString()}</span>
            </div>
            {/* Notifications (all types; expiry alerts link to batches) */}
            <NotificationCenter />
            {/* Activity Logs (Admin Only) */}
            {user?.role === 'admin' && (
              <Link
                to="/logs"
                onClick={(e) => handleNavigationClick(e, '/logs')}
                className={`hidden sm:inline-flex p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10 ${isActivePath('/logs') ? 'bg-white/10' : ''
                  }`}
                title="Activity Logs (F6)"
              >
                <ClipboardDocumentListIcon className="h-6 w-6" />
              </Link>
            )}
            {/* Archives (Admin Only) */}
            {user?.role === 'admin' && (
              <Link
                to="/archives"
                onClick={(e) => handleNavigationClick(e, '/archives')}
                className={`hidden sm:inline-flex p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10 ${isActivePath('/archives') ? 'bg-white/10' : ''
                  }`}
                title="Archives"
              >
                <ArchiveBoxIcon className="h-6 w-6" />
              </Link>
            )}
            {/* Settings */}
            <Link
              to="/settings"
              onClick={(e) => handleNavigationClick(e, '/settings')}
              className={`hidden sm:inline-flex p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10 ${isActivePath('/settings') ? 'bg-white/10' : ''
                }`}
              title="Settings (Alt+S)"
            >
              <Cog6ToothIcon className="h-6 w-6" />
            </Link>
            {/* Logout */}
            <button
              onClick={handleLogout}
              className={`hidden sm:inline-flex p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10`}
              title="Logout (Alt+L)"
            >
              <ArrowRightOnRectangleIcon className="h-6 w-6" />
            </button>
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10`}
              title={isDarkMode ? 'Switch to Light Mode (Alt+T)' : 'Switch to Dark Mode (Alt+T)'}
            >
              {isDarkMode ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </header>

        <div className={`flex-1 ${isPOS ? 'overflow-hidden' : 'overflow-y-auto'} transition-colors duration-300 bg-transparent dark:bg-slate-900`}>
          <div className={`${isPOS ? 'w-full h-full p-6' : 'max-w-7xl mx-auto p-6'}`}>
            <Outlet />
          </div>
        </div>
      </main>

      {/* Navigation Interception Modal */}
      {showNavModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm p-6 rounded-2xl shadow-xl ${colors.bg.primary} border ${colors.border.primary}`}>
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex-shrink-0">
                <XMarkIcon className="w-6 h-6" />
              </div>
              <h3 className={`text-lg font-semibold ${colors.text.primary}`}>
                Active Transaction
              </h3>
            </div>
            
            <p className={`text-sm ${colors.text.secondary} mb-6`}>
              You have items in your current cart. If you leave this page, your current transaction will be lost. Are you sure you want to leave?
            </p>
            
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={cancelNavigation}
                className={`px-4 py-2 text-sm font-medium rounded-lg border ${colors.border.primary} ${colors.bg.secondary} ${colors.text.secondary} hover:${colors.bg.tertiary}`}
              >
                Stay on page
              </button>
              <button
                type="button"
                onClick={confirmNavigation}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Leave & Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MainLayout; 