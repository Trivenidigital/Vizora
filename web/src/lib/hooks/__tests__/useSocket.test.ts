import { renderHook, act } from '@testing-library/react';
import { useSocket } from '../useSocket';

// Create mock socket instance
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  once: jest.fn(),
  close: jest.fn(),
  id: 'test-socket-id',
  io: {
    on: jest.fn(),
  },
};

jest.mock('socket.io-client', () => ({
  __esModule: true,
  default: jest.fn(() => mockSocket),
}));

describe('useSocket', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all on/off handlers
    mockSocket.on.mockReset();
    mockSocket.off.mockReset();
    mockSocket.emit.mockReset();
    mockSocket.once.mockReset();
    mockSocket.close.mockReset();
    mockSocket.io.on.mockReset();
  });

  it('starts disconnected', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }));
    expect(result.current.isConnected).toBe(false);
    expect(result.current.socket).toBeNull();
  });

  it('creates socket connection when autoConnect is true', () => {
    const io = require('socket.io-client').default;
    renderHook(() => useSocket({ url: 'http://localhost:3002' }));
    expect(io).toHaveBeenCalledWith('http://localhost:3002', expect.any(Object));
  });

  it('registers event handlers on connect', () => {
    renderHook(() => useSocket({ url: 'http://localhost:3002' }));
    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
  });

  it('emit does nothing when not connected', () => {
    const { result } = renderHook(() => useSocket({ autoConnect: false }));
    act(() => {
      result.current.emit('test', { data: 'hello' });
    });
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('on returns an unsubscribe function', () => {
    renderHook(() => useSocket({ url: 'http://localhost:3002' }));
    // The socket is created but since on() uses socketRef.current which is set
    // during effect, we just verify the hook returns an on function
    const { result } = renderHook(() => useSocket({ url: 'http://localhost:3002' }));
    const callback = jest.fn();
    const unsub = result.current.on('test', callback);
    expect(typeof unsub).toBe('function');
  });

  it('closes socket on unmount', () => {
    const { unmount } = renderHook(() => useSocket({ url: 'http://localhost:3002' }));
    unmount();
    expect(mockSocket.close).toHaveBeenCalled();
  });
});
