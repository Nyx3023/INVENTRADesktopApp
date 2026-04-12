import { createContext, useContext, useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { activityLogService, userService, API_BASE } from '../services/api';
import { io } from 'socket.io-client';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const usePermissions = () => {
  const { user } = useAuth();

  const hasPermission = (permission) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  };

  return { hasPermission };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing user session on app start
    const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // Log automatic login via remember me
        try {
          activityLogService.create({
            userId: parsedUser.id,
            userName: parsedUser.name,
            userEmail: parsedUser.email,
            action: 'LOGIN',
            details: { method: 'remember_me' }
          });
        } catch (error) {
          console.error('Error logging auto-login activity:', error);
        }

        // Fetch fresh user data to ensure live permissions
        userService.getById(parsedUser.id)
          .then(freshUser => {
            if (freshUser) {
              setUser(freshUser);
              if (localStorage.getItem('user')) {
                localStorage.setItem('user', JSON.stringify(freshUser));
              } else if (sessionStorage.getItem('user')) {
                sessionStorage.setItem('user', JSON.stringify(freshUser));
              }
            }
          })
          .catch(err => console.error('Error fetching live user data:', err));
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  // Set up WebSocket connection for live permissions
  useEffect(() => {
    let socket;
    if (user && user.id) {
      socket = io(API_BASE);

      socket.on('connect', () => {
        socket.emit('join', user.id);
      });

      socket.on('permissions_updated', () => {
        console.log('Received live permission update from server');
        userService.getById(user.id)
          .then(freshUser => {
            if (freshUser) {
              setUser(freshUser);
              if (localStorage.getItem('user')) {
                localStorage.setItem('user', JSON.stringify(freshUser));
              } else if (sessionStorage.getItem('user')) {
                sessionStorage.setItem('user', JSON.stringify(freshUser));
              }
              toast?.success('Your permissions were just updated by an administrator.', { duration: 4000 });
            }
          })
          .catch(err => console.error('Error fetching live user data after socket event:', err));
      });
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [user?.id]); // Only re-run if the user ID changes

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    // Log logout activity
    if (user) {
      try {
        await activityLogService.create({
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          action: 'LOGOUT',
          details: { timestamp: new Date().toISOString() }
        });
      } catch (error) {
        console.error('Error logging logout activity:', error);
      }
    }

    setUser(null);
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
  };

  const value = {
    user,
    login,
    logout,
    isAuthenticated: !!user,
    isLoading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 