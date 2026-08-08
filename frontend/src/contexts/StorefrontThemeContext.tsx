// Minimal storefront theme context — persists to localStorage
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'ldc_storefront_theme';

interface StorefrontThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const StorefrontThemeContext = createContext<StorefrontThemeContextValue | undefined>(undefined);

export function StorefrontThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <StorefrontThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </StorefrontThemeContext.Provider>
  );
}

export function useStorefrontTheme(): StorefrontThemeContextValue {
  const ctx = useContext(StorefrontThemeContext);
  if (!ctx) throw new Error('useStorefrontTheme must be used within StorefrontThemeProvider');
  return ctx;
}
