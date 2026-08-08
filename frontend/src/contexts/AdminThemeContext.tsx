// Minimal admin theme context — persists to localStorage, scoped to the admin root.
// Sets data-admin-theme on the element referenced by rootRef; never touches <html>.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const KEY = 'ldc_admin_theme';

interface AdminThemeContextValue {
  theme: Theme;
  toggle: () => void;
  rootRef: React.RefObject<HTMLDivElement | null>;
}

const AdminThemeContext = createContext<AdminThemeContextValue | undefined>(undefined);

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem(KEY);
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    rootRef.current.dataset.adminTheme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  const toggle = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <AdminThemeContext.Provider value={{ theme, toggle, rootRef }}>
      {children}
    </AdminThemeContext.Provider>
  );
}

export function useAdminTheme(): AdminThemeContextValue {
  const ctx = useContext(AdminThemeContext);
  if (!ctx) throw new Error('useAdminTheme must be used within AdminThemeProvider');
  return ctx;
}
