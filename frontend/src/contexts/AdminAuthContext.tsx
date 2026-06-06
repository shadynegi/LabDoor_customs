import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, setUnauthorizedHandler } from '../config';

const ADMIN_DASHBOARD_PATH = '/adminshivamdashboard';

interface AdminAuthContextValue {
  isAuthenticated: boolean | null;
  verify: () => Promise<boolean>;
  setAuthenticated: (value: boolean) => void;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const verify = useCallback(async () => {
    try {
      const response = await apiFetch('/admin/verify');
      const ok = response.ok;
      setIsAuthenticated(ok);
      return ok;
    } catch {
      setIsAuthenticated(false);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/admin/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setIsAuthenticated(false);
  }, []);

  useEffect(() => {
    void verify();
  }, [verify]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setIsAuthenticated(false);
      // Only leave the admin dashboard on session expiry — never hijack the storefront.
      if (window.location.pathname === ADMIN_DASHBOARD_PATH) {
        navigate('/admin/login', { replace: true });
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
