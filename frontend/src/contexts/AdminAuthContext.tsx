import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, setUnauthorizedHandler } from '../config';

export const ADMIN_DASHBOARD_PATH = '/adminshivamdashboard';
export const ADMIN_LOGIN_PATH = '/admin/login';
export const ADMIN_ENTRY_PATH = '/admin';

function isAdminRoute(pathname: string): boolean {
  return (
    pathname === ADMIN_ENTRY_PATH ||
    pathname === `${ADMIN_ENTRY_PATH}/` ||
    pathname === ADMIN_LOGIN_PATH ||
    pathname === ADMIN_DASHBOARD_PATH
  );
}

interface AdminAuthContextValue {
  isAuthenticated: boolean | null;
  verify: () => Promise<boolean>;
  setAuthenticated: (value: boolean) => void;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const verify = useCallback(async () => {
    try {
      const response = await apiFetch('/admin/verify');
      const data = await response.json().catch(() => ({}));
      const ok = response.ok && data.authenticated === true;
      setIsAuthenticated(ok);
      return ok;
    } catch {
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    setIsAuthenticated(false);
    try {
      await apiFetch('/admin/logout', { method: 'POST' });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (isAdminRoute(location.pathname)) {
      void verify();
    } else {
      setIsAuthenticated(false);
    }
  }, [location.pathname, verify]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIsAuthenticated(false);
      // Only leave the admin dashboard on session expiry — never hijack the storefront.
      if (window.location.pathname === ADMIN_DASHBOARD_PATH) {
        navigate(ADMIN_LOGIN_PATH, { replace: true });
      }
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  return (
    <AdminAuthContext.Provider
      value={{
        isAuthenticated,
        verify,
        setAuthenticated: setIsAuthenticated,
        logout,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}
