import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { useSocket, SocketProvider } from '../useSocket';

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

  it('shares one dashboard socket across provider consumers', () => {
    const io = require('socket.io-client').default;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(SocketProvider, { user: { organizationId: 'org-1' } }, children)
    );

    const { result, unmount } = renderHook(
      () => [
        useSocket(),
        useSocket({ auth: { organizationId: 'org-1' } }),
      ] as const,
      { wrapper },
    );

    expect(io).toHaveBeenCalledTimes(1);
    const connectHandler = mockSocket.on.mock.calls.find(([event]) => event === 'connect')?.[1];
    act(() => {
      connectHandler?.();
    });

    expect(result.current[0].socket).toBe(mockSocket);
    expect(result.current[1].socket).toBe(mockSocket);
    expect(mockSocket.emit).toHaveBeenCalledWith('join:organization', { organizationId: 'org-1' });

    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const firstUnsubscribe = result.current[0].on('device:status', firstListener);
    const secondUnsubscribe = result.current[1].on('device:status', secondListener);

    expect(mockSocket.on).toHaveBeenCalledWith('device:status', firstListener);
    expect(mockSocket.on).toHaveBeenCalledWith('device:status', secondListener);

    firstUnsubscribe();
    expect(mockSocket.off).toHaveBeenCalledWith('device:status', firstListener);
    expect(mockSocket.off).not.toHaveBeenCalledWith('device:status', secondListener);

    secondUnsubscribe();
    expect(mockSocket.off).toHaveBeenCalledWith('device:status', secondListener);

    unmount();
    expect(mockSocket.close).toHaveBeenCalledTimes(1);
  });

  it('uses a standalone socket when the caller opts out of auto connect inside a provider', () => {
    const io = require('socket.io-client').default;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(SocketProvider, { user: { organizationId: 'org-1' } }, children)
    );

    const { result } = renderHook(() => useSocket({ autoConnect: false }), { wrapper });

    expect(io).toHaveBeenCalledTimes(1);
    expect(result.current.socket).toBeNull();
  });

  it('does not create a temporary standalone socket while provider auth is still loading', () => {
    const io = require('socket.io-client').default;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(SocketProvider, { user: null }, children)
    );

    const { result } = renderHook(() => useSocket({ auth: { organizationId: 'org-1' } }), { wrapper });

    expect(io).not.toHaveBeenCalled();
    expect(result.current.socket).toBeNull();
  });

  it('uses a standalone socket when the caller requests a different organization', () => {
    const io = require('socket.io-client').default;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(SocketProvider, { user: { organizationId: 'org-1' } }, children)
    );

    renderHook(() => useSocket({ auth: { organizationId: 'org-2' } }), { wrapper });

    expect(io).toHaveBeenCalledTimes(2);
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3002',
      expect.objectContaining({ auth: { organizationId: 'org-2' } }),
    );
  });

  it('uses a standalone socket when the caller requests a custom URL', () => {
    const io = require('socket.io-client').default;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(SocketProvider, { user: { organizationId: 'org-1' } }, children)
    );

    renderHook(() => useSocket({ url: 'http://localhost:3999' }), { wrapper });

    expect(io).toHaveBeenCalledTimes(2);
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3999',
      expect.objectContaining({ auth: {} }),
    );
  });

  it('uses a standalone socket when the caller customizes reconnection options', () => {
    const io = require('socket.io-client').default;
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      React.createElement(SocketProvider, { user: { organizationId: 'org-1' } }, children)
    );

    renderHook(() => useSocket({ reconnectionAttempts: 1 }), { wrapper });

    expect(io).toHaveBeenCalledTimes(2);
    expect(io).toHaveBeenCalledWith(
      'http://localhost:3002',
      expect.objectContaining({ reconnectionAttempts: 1 }),
    );
  });
});
