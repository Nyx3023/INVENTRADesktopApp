import React, { createContext, useContext, useState, useCallback } from 'react';

const NavigationBlockerContext = createContext(null);

export const NavigationBlockerProvider = ({ children }) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [backAttempted, setBackAttempted] = useState(false);

  const blockNavigation = useCallback((blocked) => {
    setIsBlocked(blocked);
  }, []);

  const resetBackAttempt = useCallback(() => {
    setBackAttempted(false);
  }, []);

  return (
    <NavigationBlockerContext.Provider value={{ isBlocked, blockNavigation, backAttempted, resetBackAttempt }}>
      {children}
    </NavigationBlockerContext.Provider>
  );
};

export const useNavigationBlocker = () => {
  const context = useContext(NavigationBlockerContext);
  if (!context) {
    throw new Error('useNavigationBlocker must be used within a NavigationBlockerProvider');
  }
  return context;
};
