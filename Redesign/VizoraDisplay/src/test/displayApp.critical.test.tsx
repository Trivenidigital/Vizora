import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DisplayApp } from '../DisplayApp';
import { DeviceAuthService } from '../services/deviceAuthService';
import { VizoraSocketClient } from '../services/socketClient';
import { ContentService } from '../services/contentService';

// Mock services
vi.mock('../services/socketClient', () => ({
  VizoraSocketClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

vi.mock('../services/contentService', () => ({
  ContentService: vi.fn().mockImplementation(() => ({
    preloadContent: vi.fn(),
    getContent: vi.fn(),
    handleContentTransition: vi.fn(),
    isOffline: vi.fn(),
  })),
}));

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

describe('DisplayApp', () => {
  let mockDeviceAuthService: jest.Mocked<DeviceAuthService>;
  let mockSocketClient: jest.Mocked<VizoraSocketClient>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock DeviceAuthService
    mockDeviceAuthService = {
      getToken: vi.fn(),
      getDisplayId: vi.fn(),
      validateToken: vi.fn(),
      registerWithPairingCode: vi.fn(),
      registerWithToken: vi.fn(),
      clearAuthData: vi.fn(),
      isAuthenticated: vi.fn(),
    } as any;

    // Mock SocketClient
    mockSocketClient = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
      removeAllListeners: vi.fn(),
      clear: vi.fn(),
    } as any;

    // Mock service constructors
    (DeviceAuthService as jest.Mock).mockImplementation(() => mockDeviceAuthService);
    (VizoraSocketClient as jest.Mock).mockImplementation(() => mockSocketClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading screen initially', () => {
    render(<DisplayApp />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('shows registration screen when no token exists', async () => {
    mockDeviceAuthService.getToken.mockReturnValue(null);
    mockDeviceAuthService.getDisplayId.mockReturnValue(null);

    render(<DisplayApp />);

    await waitFor(() => {
      expect(screen.getByText(/display registration/i)).toBeInTheDocument();
    });
  });

  it('shows registration screen when token is invalid', async () => {
    mockDeviceAuthService.getToken.mockReturnValue('invalid-token');
    mockDeviceAuthService.getDisplayId.mockReturnValue('test-id');
    mockDeviceAuthService.validateToken.mockResolvedValue(false);

    render(<DisplayApp />);

    await waitFor(() => {
      expect(screen.getByText(/display registration/i)).toBeInTheDocument();
    });
  });

  it('handles successful registration', async () => {
    const mockResponse = {
      token: 'valid-token',
      displayId: 'test-id',
      expiresAt: new Date().toISOString(),
    };

    mockDeviceAuthService.getToken.mockReturnValue(null);
    mockDeviceAuthService.getDisplayId.mockReturnValue(null);
    mockDeviceAuthService.registerWithPairingCode.mockResolvedValue(mockResponse);
    mockDeviceAuthService.validateToken.mockResolvedValue(true);

    render(<DisplayApp />);

    // Wait for registration screen
    await waitFor(() => {
      expect(screen.getByText(/display registration/i)).toBeInTheDocument();
    });

    // Enter pairing code
    const input = screen.getByLabelText(/pairing code/i);
    fireEvent.change(input, { target: { value: 'test-code' } });
    fireEvent.click(screen.getByText(/register display/i));

    // Wait for registration to complete
    await waitFor(() => {
      expect(mockDeviceAuthService.registerWithPairingCode).toHaveBeenCalledWith(
        'test-code',
        expect.any(Object)
      );
    });
  });

  it('handles registration failure', async () => {
    mockDeviceAuthService.getToken.mockReturnValue(null);
    mockDeviceAuthService.getDisplayId.mockReturnValue(null);
    mockDeviceAuthService.registerWithPairingCode.mockRejectedValue(
      new Error('Registration failed')
    );

    render(<DisplayApp />);

    // Wait for registration screen
    await waitFor(() => {
      expect(screen.getByText(/display registration/i)).toBeInTheDocument();
    });

    // Enter pairing code
    const input = screen.getByLabelText(/pairing code/i);
    fireEvent.change(input, { target: { value: 'invalid-code' } });
    fireEvent.click(screen.getByText(/register display/i));

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
    });
  });

  it('initializes display with valid token', async () => {
    mockDeviceAuthService.getToken.mockReturnValue('valid-token');
    mockDeviceAuthService.getDisplayId.mockReturnValue('test-id');
    mockDeviceAuthService.validateToken.mockResolvedValue(true);

    render(<DisplayApp />);

    await waitFor(() => {
      expect(screen.queryByText(/display registration/i)).not.toBeInTheDocument();
    });
  });

  it('initializes services correctly', async () => {
    render(<DisplayApp />);

    await waitFor(() => {
      expect(VizoraSocketClient).toHaveBeenCalled();
      expect(ContentService).toHaveBeenCalled();
      expect(DeviceAuthService).toHaveBeenCalled();
    });
  });

  it('attempts to validate token on mount', async () => {
    const deviceAuthService = new DeviceAuthService();
    vi.mocked(deviceAuthService.getToken).mockReturnValue('test-token');
    
    render(<DisplayApp />);

    await waitFor(() => {
      expect(deviceAuthService.validateToken).toHaveBeenCalledWith('test-token');
    });
  });
}); 