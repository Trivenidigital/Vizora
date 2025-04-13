import { describe, it, expect, beforeEach, afterEach, vi, act } from 'vitest';
import { DisplayService } from '../services/displayService';
import { VizoraSocketClient } from '../services/socketClient';
import type { DisplayStatus, DisplaySettings } from '../types';

// Mock socket client
vi.mock('../services/socketClient', () => ({
  VizoraSocketClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
    clear: vi.fn(),
  })),
}));

describe('Display Management', () => {
  let displayService: DisplayService;
  let mockSocket: VizoraSocketClient;

  const mockStatus: DisplayStatus = {
    id: 'test-display-1',
    status: 'online',
    lastSeen: new Date().toISOString(),
  };

  const mockSettings: DisplaySettings = {
    id: 'test-display-1',
    name: 'Test Display',
    brightness: 80,
    volume: 50,
    autoPlay: true,
    offlineMode: true,
    retryInterval: 5000,
    maxRetries: 3,
  };

  beforeEach(() => {
    vi.useFakeTimers();
    mockSocket = new VizoraSocketClient();
    displayService = new DisplayService(mockSocket);
  });

  afterEach(async () => {
    try {
      // Stop the display service
      displayService.stop();
      
      // Clean up socket listeners
      mockSocket.removeAllListeners();
      mockSocket.clear();
      
      // Disconnect socket
      mockSocket.disconnect();
      
      // Clean up timers
      vi.clearAllTimers();
      await vi.runOnlyPendingTimersAsync();
      vi.useRealTimers();
    } catch (error) {
      console.error('Error in afterEach:', error);
    }
  });

  it('should register display with server', async () => {
    const onRegistered = vi.fn();
    displayService.on('display:registered', onRegistered);

    await displayService.register(mockSettings);

    expect(mockSocket.emit).toHaveBeenCalledWith('display:register', mockSettings);
    expect(onRegistered).toHaveBeenCalledWith(mockSettings);
  });

  it('should handle settings updates', async () => {
    const onSettingsUpdate = vi.fn();
    displayService.on('display:settings', onSettingsUpdate);

    await displayService.register(mockSettings);

    // Simulate settings update from server
    const updateHandler = (mockSocket.on as jest.Mock).mock.calls.find(
      (call: [string, Function]) => call[0] === 'display:settings'
    )[1];
    updateHandler(mockSettings);

    expect(onSettingsUpdate).toHaveBeenCalledWith(mockSettings);
  });

  it('should handle status updates', async () => {
    const onStatusUpdate = vi.fn();
    displayService.on('display:status', onStatusUpdate);

    await displayService.register(mockSettings);

    // Simulate status update from server
    const updateHandler = (mockSocket.on as jest.Mock).mock.calls.find(
      (call: [string, Function]) => call[0] === 'display:status'
    )[1];
    updateHandler(mockStatus);

    expect(onStatusUpdate).toHaveBeenCalledWith(mockStatus);
  });

  it('should handle error events', async () => {
    const onError = vi.fn();
    displayService.on('error', onError);

    await displayService.register(mockSettings);

    // Simulate error from server
    const errorHandler = (mockSocket.on as jest.Mock).mock.calls.find(
      (call: [string, Function]) => call[0] === 'error'
    )[1];
    const error = new Error('Test error');
    
    errorHandler(error);
    await vi.runOnlyPendingTimersAsync();

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('should fetch display status', async () => {
    await displayService.register(mockSettings);

    // Simulate status response from server
    const statusHandler = (mockSocket.on as jest.Mock).mock.calls.find(
      (call: [string, Function]) => call[0] === 'display:status'
    )[1];
    statusHandler(mockStatus);

    const status = displayService.getStatus();
    expect(status).toEqual(mockStatus);
  });

  it('should fetch display settings', async () => {
    await displayService.register(mockSettings);

    // Simulate settings response from server
    const settingsHandler = (mockSocket.on as jest.Mock).mock.calls.find(
      (call: [string, Function]) => call[0] === 'display:settings'
    )[1];
    settingsHandler(mockSettings);

    const settings = displayService.getSettings();
    expect(settings).toEqual(mockSettings);
  });
}); 