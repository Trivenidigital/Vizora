import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as displayService from '../../src/services/displayService';

const mockDisplay = {
  _id: 'disp-001',
  name: 'Test Display',
  location: 'Test Location',
  qrCode: 'TEST01',
  status: 'active',
  lastConnected: new Date().toISOString(),
  type: 'digital-signage',
  resolution: '1920x1080',
  orientation: 'landscape',
};

describe('Display Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('gets display information', async () => {
    const display = await displayService.getDisplayInfo('disp-001');
    expect(display).toEqual(mockDisplay);
  });

  it('registers a new display', async () => {
    const displayData = {
      name: 'New Display',
      location: 'New Location',
      type: 'digital-signage',
      resolution: '1920x1080',
      orientation: 'landscape',
    };

    const registeredDisplay = await displayService.registerDisplay(displayData);
    expect(registeredDisplay).toEqual({
      ...displayData,
      _id: expect.any(String),
      qrCode: expect.any(String),
      status: 'registered',
      lastConnected: expect.any(String),
    });
  });

  it('updates display status', async () => {
    const updatedDisplay = await displayService.updateDisplayStatus('disp-001', 'inactive');
    expect(updatedDisplay.status).toBe('inactive');
  });

  it('updates display heartbeat', async () => {
    const updatedDisplay = await displayService.updateDisplayHeartbeat('disp-001');
    expect(updatedDisplay.lastConnected).toBeDefined();
  });

  it('handles API errors', async () => {
    const error = new Error('API Error');
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(error);

    await expect(displayService.getDisplayInfo('disp-001')).rejects.toThrow('API Error');
  });

  it('handles network timeouts', async () => {
    vi.spyOn(global, 'fetch').mockImplementationOnce(() => 
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Network timeout')), 100)
      )
    );

    await expect(displayService.getDisplayInfo('disp-001')).rejects.toThrow('Network timeout');
  });

  it('handles invalid display data', async () => {
    const invalidData = {
      name: '', // Invalid empty name
      location: 'Test Location',
      type: 'invalid-type', // Invalid type
      resolution: 'invalid', // Invalid resolution
      orientation: 'invalid', // Invalid orientation
    };

    await expect(displayService.registerDisplay(invalidData)).rejects.toThrow();
  });

  it('handles display disconnection', async () => {
    const disconnectedDisplay = await displayService.handleDisplayDisconnect('disp-001');
    expect(disconnectedDisplay.status).toBe('disconnected');
    expect(disconnectedDisplay.lastConnected).toBeDefined();
  });

  it('handles display reconnection', async () => {
    const reconnectedDisplay = await displayService.handleDisplayReconnect('disp-001');
    expect(reconnectedDisplay.status).toBe('active');
    expect(reconnectedDisplay.lastConnected).toBeDefined();
  });

  it('validates display configuration', async () => {
    const config = {
      resolution: '1920x1080',
      orientation: 'landscape',
      refreshRate: 60,
      brightness: 80,
    };

    const validatedConfig = await displayService.validateDisplayConfig(config);
    expect(validatedConfig).toEqual(config);
  });

  it('handles invalid display configuration', async () => {
    const invalidConfig = {
      resolution: 'invalid',
      orientation: 'invalid',
      refreshRate: -1,
      brightness: 101,
    };

    await expect(displayService.validateDisplayConfig(invalidConfig)).rejects.toThrow();
  });
}); 