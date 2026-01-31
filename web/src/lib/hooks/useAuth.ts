import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: string;
  organization?: {
    name: string;
    subscriptionTier: string;
  };
}

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user from server - this validates the httpOnly cookie
      const userData = await apiClient.getCurrentUser();
      setUser(userData);
      apiClient.setAuthenticated(true);
    } catch (err) {
      // User is not authenticated - this is expected for unauthenticated users
      setUser(null);
      apiClient.setAuthenticated(false);

      // Only set error for unexpected errors, not auth failures
      if (err instanceof Error && !err.message.includes('401') && !err.message.includes('403')) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    logout,
    reload: loadUser,
  };
}
