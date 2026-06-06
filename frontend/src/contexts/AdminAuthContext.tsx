import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiFetch } from '../config';

interface AdminAuthContextValue {
  isAuthenticated: boolean | null;
  verify: () => Promise<boolean>;
  setAuthenticated: (value: boolean) => void;
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
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
