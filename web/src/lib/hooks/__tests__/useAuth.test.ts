import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from '../useAuth';

const mockGetCurrentUser = jest.fn();
const mockSetAuthenticated = jest.fn();
const mockLogout = jest.fn();

jest.mock('@/lib/api', () => ({
  apiClient: {
    getCurrentUser: () => mockGetCurrentUser(),
    setAuthenticated: (v: boolean) => mockSetAuthenticated(v),
    logout: () => mockLogout(),
  },
}));

// Mock window.location
const originalLocation = window.location;
beforeAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: { ...originalLocation, href: '' },
  });
});
afterAll(() => {
  Object.defineProperty(window, 'location', {
    writable: true,
    value: originalLocation,
  });
});

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.location.href = '';
  });

  it('starts in loading state', () => {
    mockGetCurrentUser.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('sets user when API returns user data', async () => {
    const mockUser = {
      id: 'u1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      organizationId: 'org1',
      role: 'admin',
    };
    mockGetCurrentUser.mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockSetAuthenticated).toHaveBeenCalledWith(true);
  });

  it('sets user to null when API fails with auth error', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('401 Unauthorized'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeNull(); // 401 is not an "error"
  });

  it('sets error for non-auth failures', async () => {
    mockGetCurrentUser.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('logout calls API and redirects', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1' });
    mockLogout.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockLogout).toHaveBeenCalled();
    expect(window.location.href).toBe('/login');
  });

  it('reload fetches user again', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u1' });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    mockGetCurrentUser.mockResolvedValue({ id: 'u2' });

    await act(async () => {
      await result.current.reload();
    });

    expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
  });
});
