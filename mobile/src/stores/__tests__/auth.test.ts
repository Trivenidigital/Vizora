import { useAuthStore } from '../auth';

// The jest.setup.ts already mocks expo-secure-store with an in-memory store
const SecureStore = require('expo-secure-store');

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'admin',
  organizationId: 'org-1',
};

const initialState = {
  token: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,
};

describe('useAuthStore', () => {
  beforeEach(() => {
    SecureStore.__reset();
    jest.clearAllMocks();
    useAuthStore.setState(initialState);
  });

  describe('initial state', () => {
    it('should have isLoading=true, isAuthenticated=false, token=null, user=null', () => {
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
    });
  });

  describe('setAuth', () => {
    it('should store token and user in SecureStore and update state', async () => {
      await useAuthStore.getState().setAuth('my-token', mockUser);

      // Verify SecureStore was called
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('vizora_auth_token', 'my-token');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
        'vizora_user',
        JSON.stringify(mockUser),
      );

      // Verify zustand state updated
      const state = useAuthStore.getState();
      expect(state.token).toBe('my-token');
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear SecureStore and reset state', async () => {
      // First set auth so there is something to clear
      await useAuthStore.getState().setAuth('my-token', mockUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      await useAuthStore.getState().logout();

      // Verify SecureStore deletions
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('vizora_auth_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('vizora_user');

      // Verify state is cleared
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });
  });

  describe('loadStoredAuth', () => {
    it('should restore auth from SecureStore', async () => {
      // Pre-populate SecureStore
      await SecureStore.setItemAsync('vizora_auth_token', 'stored-token');
      await SecureStore.setItemAsync('vizora_user', JSON.stringify(mockUser));

      await useAuthStore.getState().loadStoredAuth();

      const state = useAuthStore.getState();
      expect(state.token).toBe('stored-token');
      expect(state.user).toEqual(mockUser);
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it('should set isLoading=false when no stored auth exists', async () => {
      await useAuthStore.getState().loadStoredAuth();

      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
    });

    it('should handle corrupt JSON gracefully', async () => {
      // Store a valid token but invalid JSON for user
      await SecureStore.setItemAsync('vizora_auth_token', 'some-token');
      await SecureStore.setItemAsync('vizora_user', '{not valid json!!!');

      await useAuthStore.getState().loadStoredAuth();

      // Should catch the parse error and just set isLoading false
      const state = useAuthStore.getState();
      expect(state.isLoading).toBe(false);
      // Token and user should remain null since the catch block fires
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
