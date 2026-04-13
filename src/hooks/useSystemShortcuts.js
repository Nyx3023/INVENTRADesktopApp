import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, usePermissions } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigationBlocker } from '../context/NavigationBlockerContext';

const useSystemShortcuts = (onNavigationIntercepted) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { hasPermission } = usePermissions();
  const { toggleTheme } = useTheme();
  const { isBlocked, blockNavigation } = useNavigationBlocker();

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input
      if (
        e.target.tagName === 'INPUT' ||
        e.target.tagName === 'TEXTAREA' ||
        e.target.tagName === 'SELECT'
      ) {
        return;
      }

      // Check if we need to navigate
      let targetPath = null;
      let shouldLogout = false;
      let actionToRun = null;

      if (!e.altKey && !e.ctrlKey) {
        switch (e.key) {
          case 'F1':
            e.preventDefault();
            targetPath = '/';
            break;
          case 'F2':
            if (hasPermission('process_sales')) {
              e.preventDefault();
              targetPath = '/pos';
            }
            break;
          case 'F3':
            if (hasPermission('view_inventory')) {
              e.preventDefault();
              targetPath = '/inventory';
            }
            break;
          case 'F4':
            if (hasPermission('view_sales_history')) {
              e.preventDefault();
              targetPath = '/sales';
            }
            break;
          case 'F6':
            if (user?.role === 'admin') {
              e.preventDefault();
              targetPath = '/logs';
            }
            break;
          default:
            break;
        }
      } else if (e.altKey) {
        switch (e.key.toLowerCase()) {
          case 's': // Alt + S
            e.preventDefault();
            targetPath = '/settings';
            break;
          case 't': // Alt + T
            e.preventDefault();
            actionToRun = toggleTheme;
            break;
          case 'l': // Alt + L
            e.preventDefault();
            targetPath = '/login';
            shouldLogout = true;
            break;
          default:
            break;
        }
      }

      // Handle simple actions
      if (actionToRun) {
        actionToRun();
        return;
      }

      // Handle navigation
      if (targetPath) {
        // If navigation is blocked by an active POS transaction
        if (isBlocked && window.location.pathname !== targetPath) {
          if (onNavigationIntercepted) {
            onNavigationIntercepted(targetPath, shouldLogout);
          }
        } else {
          if (shouldLogout) logout();
          navigate(targetPath);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, user, logout, hasPermission, toggleTheme, isBlocked, onNavigationIntercepted]);
};

export default useSystemShortcuts;
