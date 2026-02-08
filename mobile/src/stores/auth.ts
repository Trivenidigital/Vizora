import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'vizora_auth_token';
const USER_KEY = 'vizora_user';

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  setAuth: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ token, user, isAuthenticated: true, isLoading: false });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ token: null, user: null, isAuthenticated: false, isLoading: false });
  },

  loadStoredAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userJson = await SecureStore.getItemAsync(USER_KEY);
      if (token && userJson) {
        const user = JSON.parse(userJson) as User;
        set({ token, user, isAuthenticated: true, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
}));
