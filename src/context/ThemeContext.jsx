import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const colors = {
    bg: {
      primary: 'bg-sand-100 dark:bg-slate-900',
      secondary: 'bg-sand-50 dark:bg-slate-800',
      tertiary: 'bg-sand-200 dark:bg-slate-700',
      hover: 'hover:bg-sand-300 dark:hover:bg-slate-700'
    },
    text: {
      primary: 'text-slate-900 dark:text-slate-100',
      secondary: 'text-slate-700 dark:text-slate-300',
      tertiary: 'text-slate-600 dark:text-slate-400'
    },
    border: {
      primary: 'border-sand-400 dark:border-slate-700',
      secondary: 'border-sand-500 dark:border-slate-600'
    },
    card: {
      primary: 'bg-white dark:bg-slate-800 border-sand-300/70 dark:border-slate-700/50',
      secondary: 'bg-sand-50 dark:bg-slate-700'
    },
    input: {
      primary: 'bg-white dark:bg-slate-800 border-sand-500 dark:border-slate-600 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-olive-600 dark:focus:ring-olive-400'
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}; 