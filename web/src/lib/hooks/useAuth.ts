import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';

interface User {
  id: string;
  email: string;
  organizationId: string;
  organizationName?: string;
  role?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      setLoading(true);
      // Try to get user info from token or API
      const token = localStorage.getItem('authToken');
      if (!token) {
        setUser(null);
        return;
      }

      // Decode JWT to get user info (basic implementation)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.sub || payload.userId,
          email: payload.email,
          organizationId: payload.organizationId,
          organizationName: payload.organizationName,
          role: payload.role,
        });
      } catch (e) {
        console.error('Failed to decode token:', e);
        setUser(null);
      }
    } catch (err: any) {
      setError(err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiClient.clearToken();
    setUser(null);
    window.location.href = '/login';
  };

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    logout,
    reload: loadUser,
  };
}
