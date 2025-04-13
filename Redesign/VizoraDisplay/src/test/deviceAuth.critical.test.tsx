import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceAuthService } from '../services/deviceAuthService';
import { VizoraSocketClient } from '../services/socketClient';
import { render, screen, waitFor } from '@testing-library/react';
import { VizoraDisplay } from '../DisplayApp';

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

vi.mock('../services/deviceAuthService', () => ({
  DeviceAuthService: vi.fn().mockImplementation(() => ({
    registerWithPairingCode: vi.fn(),
    registerWithToken: vi.fn(),
    validateToken: vi.fn(),
    getToken: vi.fn(),
    getDisplayId: vi.fn(),
    saveAuthData: vi.fn(),
    clearAuthData: vi.fn(),
    isAuthenticated: vi.fn(),
  })),
}));

vi.mock('../services/socketClient', () => ({
  VizoraSocketClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

describe('Device Authentication', () => {
  let deviceAuthService: DeviceAuthService;
  let socketClient: VizoraSocketClient;

  const mockMetadata = {
    name: 'Test Display',
    location: 'Test Location',
    resolution: {
      width: 1920,
      height: 1080,
    },
    model: 'Test Model',
    os: 'Test OS',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    socketClient = new VizoraSocketClient();
    deviceAuthService = new DeviceAuthService(socketClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
    deviceAuthService.clearAuthData();
  });

  it('registers display with pairing code', async () => {
    const mockResponse = {
      token: 'test-token',
      displayId: 'test-display-id',
      expiresAt: new Date().toISOString(),
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await deviceAuthService.registerWithPairingCode('test-code', mockMetadata);

    expect(result).toEqual(mockResponse);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('vizora_device_token', mockResponse.token);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('vizora_display_id', mockResponse.displayId);
  });

  it('registers display with existing token', async () => {
    const mockResponse = {
      token: 'test-token',
      displayId: 'test-display-id',
      expiresAt: new Date().toISOString(),
    };

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await deviceAuthService.registerWithToken('existing-token', mockMetadata);

    expect(result).toEqual(mockResponse);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('vizora_device_token', mockResponse.token);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('vizora_display_id', mockResponse.displayId);
  });

  it('handles registration failure', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400,
    });

    await expect(deviceAuthService.registerWithPairingCode('invalid-code', mockMetadata))
      .rejects
      .toThrow('Registration failed');
  });

  it('validates existing token', async () => {
    localStorageMock.getItem.mockReturnValueOnce('test-token');

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
    });

    const isValid = await deviceAuthService.validateToken();
    expect(isValid).toBe(true);
  });

  it('handles invalid token', async () => {
    localStorageMock.getItem.mockReturnValueOnce('invalid-token');

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const isValid = await deviceAuthService.validateToken();
    expect(isValid).toBe(false);
  });

  it('checks authentication status', () => {
    localStorageMock.getItem
      .mockReturnValueOnce('test-token')
      .mockReturnValueOnce('test-display-id');

    expect(deviceAuthService.isAuthenticated()).toBe(true);

    localStorageMock.getItem
      .mockReturnValueOnce(null)
      .mockReturnValueOnce('test-display-id');

    expect(deviceAuthService.isAuthenticated()).toBe(false);
  });

  it('clears authentication data', () => {
    deviceAuthService.clearAuthData();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('vizora_device_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('vizora_display_id');
  });

  it('registers with pairing code', async () => {
    const mockResponse = {
      token: 'test-token',
      displayId: 'test-display-id',
    };
    vi.mocked(deviceAuthService.registerWithPairingCode).mockResolvedValue(mockResponse);
    
    render(<VizoraDisplay />);

    await waitFor(() => {
      expect(deviceAuthService.registerWithPairingCode).toHaveBeenCalled();
    });
  });

  it('validates existing token', async () => {
    vi.mocked(deviceAuthService.getToken).mockReturnValue('test-token');
    vi.mocked(deviceAuthService.validateToken).mockResolvedValue(true);
    
    render(<VizoraDisplay />);

    await waitFor(() => {
      expect(deviceAuthService.validateToken).toHaveBeenCalledWith('test-token');
    });
  });

  it('handles invalid token', async () => {
    vi.mocked(deviceAuthService.getToken).mockReturnValue('invalid-token');
    vi.mocked(deviceAuthService.validateToken).mockResolvedValue(false);
    
    render(<VizoraDisplay />);

    await waitFor(() => {
      expect(screen.getByTestId('registration-screen')).toBeInTheDocument();
    });
  });
}); 