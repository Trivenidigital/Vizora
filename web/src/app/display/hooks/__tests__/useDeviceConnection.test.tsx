import { act, renderHook } from '@testing-library/react';
import { io } from 'socket.io-client';
import { useDeviceConnection } from '../useDeviceConnection';

jest.mock('socket.io-client', () => ({
  io: jest.fn(),
}));

describe('useDeviceConnection', () => {
  const credentials = {
    deviceToken: 'device-token',
    deviceId: 'display-1',
    organizationId: 'org-1',
  };

  const createSocket = () => ({
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
    auth: {},
  });

  const renderConnection = (overrides: Partial<Parameters<typeof useDeviceConnection>[0]> = {}) => {
    const handlers = {
      credentials,
      onPlaylistUpdate: jest.fn(),
      onCommand: jest.fn(),
      onConfig: jest.fn(),
      onUnauthorized: jest.fn(),
      currentContentId: null,
      ...overrides,
    };

    renderHook(() => useDeviceConnection(handlers));
    return handlers;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('acknowledges playlist updates after applying them', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);

    const handlers = renderConnection();
    const playlistHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'playlist:update',
    )?.[1];
    const ack = jest.fn();
    const playlist = { id: 'playlist-1', name: 'Menu', items: [] };

    act(() => {
      playlistHandler({ playlist }, ack);
    });

    expect(handlers.onPlaylistUpdate).toHaveBeenCalledWith(playlist);
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  it('negative-acknowledges playlist updates when applying them fails', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);

    renderConnection({
      onPlaylistUpdate: jest.fn(() => {
        throw new Error('apply failed');
      }),
    });
    const playlistHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'playlist:update',
    )?.[1];
    const ack = jest.fn();

    act(() => {
      playlistHandler({ playlist: { id: 'playlist-1', name: 'Menu', items: [] } }, ack);
    });

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: 'apply failed',
    });
  });

  it('acknowledges commands after applying them', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);

    const handlers = renderConnection();
    const commandHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'command',
    )?.[1];
    const ack = jest.fn();
    const command = { type: 'reload' };

    act(() => {
      commandHandler(command, ack);
    });

    expect(handlers.onCommand).toHaveBeenCalledWith(command);
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  it('passes push_content duration through as minutes with a 5 minute default', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);
    const onContentPush = jest.fn();

    renderConnection({ onContentPush });
    const commandHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'command',
    )?.[1];
    const ack = jest.fn();
    const content = { id: 'content-1', name: 'Emergency', type: 'image', url: '/emergency.png' };

    act(() => {
      commandHandler({ type: 'push_content', payload: { content, duration: 60 } }, ack);
      commandHandler({ type: 'push_content', payload: { content } }, ack);
    });

    expect(onContentPush).toHaveBeenNthCalledWith(1, content, 60);
    expect(onContentPush).toHaveBeenNthCalledWith(2, content, 5);
    expect(ack).toHaveBeenCalledWith({ ok: true });
  });

  it('negative-acknowledges commands when applying them fails', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);

    renderConnection({
      onCommand: jest.fn(() => {
        throw new Error('command failed');
      }),
    });
    const commandHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'command',
    )?.[1];
    const ack = jest.fn();

    act(() => {
      commandHandler({ type: 'reload' }, ack);
    });

    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: 'command failed',
    });
  });

  it('persists refreshed device tokens for future reconnects', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);
    const onTokenRefresh = jest.fn();
    localStorage.setItem(
      'vizora_display_credentials',
      JSON.stringify({ deviceToken: 'old-token', deviceId: 'display-1', organizationId: 'org-1' }),
    );

    renderConnection({ onTokenRefresh });
    const refreshHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'token:refresh',
    )?.[1];

    act(() => {
      refreshHandler({ token: 'new-token' });
    });

    expect(JSON.parse(localStorage.getItem('vizora_display_credentials') || '{}')).toEqual(
      expect.objectContaining({ deviceToken: 'new-token', deviceId: 'display-1' }),
    );
    expect(socket.auth).toEqual(
      expect.objectContaining({
        token: 'new-token',
        capabilities: expect.objectContaining({ deliveryAck: true }),
      }),
    );
    expect(onTokenRefresh).toHaveBeenCalledWith('new-token');
  });

  it('still adopts refreshed tokens when stored credentials JSON is corrupt', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);
    const onTokenRefresh = jest.fn();
    localStorage.setItem('vizora_display_credentials', '{not-json');

    renderConnection({ onTokenRefresh });
    const refreshHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'token:refresh',
    )?.[1];

    act(() => {
      refreshHandler({ token: 'new-token' });
    });

    expect(socket.auth).toEqual(
      expect.objectContaining({
        token: 'new-token',
        capabilities: expect.objectContaining({ deliveryAck: true }),
      }),
    );
    expect(onTokenRefresh).toHaveBeenCalledWith('new-token');
    expect(JSON.parse(localStorage.getItem('vizora_display_credentials') || '{}')).toEqual({
      deviceToken: 'new-token',
    });
  });

  it('resets pairing when connect_error reports a stale device token', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);

    const handlers = renderConnection();
    const errorHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'connect_error',
    )?.[1];

    act(() => {
      errorHandler({ message: 'device_token_stale' });
    });

    expect(handlers.onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('disconnects and resets pairing when socket error reports a missing device', () => {
    const socket = createSocket();
    (io as jest.Mock).mockReturnValue(socket);

    const handlers = renderConnection();
    const errorHandler = socket.on.mock.calls.find(
      (call: any[]) => call[0] === 'error',
    )?.[1];

    act(() => {
      errorHandler({ message: 'device_not_found' });
    });

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(handlers.onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
