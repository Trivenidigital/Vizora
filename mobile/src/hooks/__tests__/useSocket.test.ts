import { renderHook, act } from '@testing-library/react-native';
import { io } from 'socket.io-client';
import { useSocket } from '../useSocket';
import { useAuthStore } from '../../stores/auth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Override the jest.setup.ts mock of socket.io-client with a richer version
// that captures event handlers so we can simulate socket events in tests.
jest.mock('socket.io-client');

// Override the jest.setup.ts mock of stores/auth so we control it per-test
jest.mock('../../stores/auth');

const mockIo = io as jest.Mock;
const mockUseAuthStore = useAuthStore as unknown as jest.Mock;

// Creates a mock socket that tracks event listeners
function createMockSocket() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  const socket = {
    on: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
      return socket;
    }),
    off: jest.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((fn) => fn !== cb);
      }
      return socket;
    }),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
    removeAllListeners: jest.fn(() => {
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    }),
    // Test helper: simulate a socket event
    __emit(event: string, ...args: unknown[]) {
      (listeners[event] ?? []).forEach((cb) => cb(...args));
    },
    __listeners: listeners,
  };

  return socket;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set what useAuthStore returns when called as a selector hook.
 * useAuthStore is called with selector functions: useAuthStore((s) => s.token)
 * We mock it so that each call invokes the selector against our fake state.
 */
function setAuthState(state: { token: string | null; user: { organizationId: string } | null }) {
  mockUseAuthStore.mockImplementation((selector: (s: typeof state) => unknown) => {
    return selector(state);
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSocket', () => {
  let mockSocket: ReturnType<typeof createMockSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = createMockSocket();
    mockIo.mockReturnValue(mockSocket);
    // Default: no auth
    setAuthState({ token: null, user: null });
  });

  describe('when no token is available', () => {
    it('does not create a socket connection', () => {
      setAuthState({ token: null, user: null });

      renderHook(() => useSocket());

      expect(mockIo).not.toHaveBeenCalled();
    });

    it('returns isConnected=false and null socket', () => {
      setAuthState({ token: null, user: null });

      const { result } = renderHook(() => useSocket());

      expect(result.current.isConnected).toBe(false);
      expect(result.current.socket).toBeNull();
      expect(result.current.connectionError).toBeNull();
    });
  });

  describe('when no organizationId is available', () => {
    it('does not create a socket connection', () => {
      setAuthState({ token: 'some-token', user: null });

      renderHook(() => useSocket());

      expect(mockIo).not.toHaveBeenCalled();
    });
  });

  describe('when token and organizationId are available', () => {
    beforeEach(() => {
      setAuthState({
        token: 'test-token',
        user: { organizationId: 'org-1' },
      });
    });

    it('creates a socket connection with correct config', () => {
      renderHook(() => useSocket());

      expect(mockIo).toHaveBeenCalledWith('http://localhost:3002', {
        auth: { token: 'test-token' },
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        autoConnect: true,
      });
    });

    it('sets isConnected=true on connect event', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        mockSocket.__emit('connect');
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('emits join:organization on connect', () => {
      renderHook(() => useSocket());

      act(() => {
        mockSocket.__emit('connect');
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join:organization', {
        organizationId: 'org-1',
      });
    });

    it('clears connectionError on connect', () => {
      const { result } = renderHook(() => useSocket());

      // First trigger an error
      act(() => {
        mockSocket.__emit('connect_error', new Error('Connection refused'));
      });
      expect(result.current.connectionError).toBe('Connection refused');

      // Then connect
      act(() => {
        mockSocket.__emit('connect');
      });
      expect(result.current.connectionError).toBeNull();
    });

    it('sets isConnected=false on disconnect event', () => {
      const { result } = renderHook(() => useSocket());

      // Connect first
      act(() => {
        mockSocket.__emit('connect');
      });
      expect(result.current.isConnected).toBe(true);

      // Then disconnect
      act(() => {
        mockSocket.__emit('disconnect');
      });
      expect(result.current.isConnected).toBe(false);
    });

    it('sets connectionError on connect_error event', () => {
      const { result } = renderHook(() => useSocket());

      act(() => {
        mockSocket.__emit('connect_error', new Error('Auth failed'));
      });

      expect(result.current.connectionError).toBe('Auth failed');
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('on() method — event subscription', () => {
    beforeEach(() => {
      setAuthState({
        token: 'test-token',
        user: { organizationId: 'org-1' },
      });
    });

    it('subscribes to events and returns unsubscribe function', () => {
      const { result } = renderHook(() => useSocket());
      const callback = jest.fn();

      let unsub: () => void;
      act(() => {
        unsub = result.current.on('device:status', callback);
      });

      expect(mockSocket.on).toHaveBeenCalledWith('device:status', callback);

      // Unsubscribe
      act(() => {
        unsub();
      });

      expect(mockSocket.off).toHaveBeenCalledWith('device:status', callback);
    });

    it('returns a no-op unsubscribe when socket is null', () => {
      // No auth → no socket
      setAuthState({ token: null, user: null });

      const { result } = renderHook(() => useSocket());
      const callback = jest.fn();

      let unsub: () => void;
      act(() => {
        unsub = result.current.on('some:event', callback);
      });

      // Should not throw
      act(() => {
        unsub();
      });

      expect(mockSocket.on).not.toHaveBeenCalled();
    });
  });

  describe('cleanup on unmount', () => {
    it('disconnects socket and removes listeners on unmount', () => {
      setAuthState({
        token: 'test-token',
        user: { organizationId: 'org-1' },
      });

      const { unmount } = renderHook(() => useSocket());

      unmount();

      expect(mockSocket.removeAllListeners).toHaveBeenCalled();
      expect(mockSocket.disconnect).toHaveBeenCalled();
    });
  });

  describe('cleanup on auth change', () => {
    it('disconnects old socket when token changes', () => {
      setAuthState({
        token: 'token-1',
        user: { organizationId: 'org-1' },
      });

      const { rerender } = renderHook(() => useSocket());

      // Change auth state
      const oldSocket = mockSocket;
      mockSocket = createMockSocket();
      mockIo.mockReturnValue(mockSocket);

      setAuthState({
        token: 'token-2',
        user: { organizationId: 'org-1' },
      });

      rerender({});

      // Old socket should have been cleaned up
      expect(oldSocket.removeAllListeners).toHaveBeenCalled();
      expect(oldSocket.disconnect).toHaveBeenCalled();
    });
  });
});
