import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { App } from '../App';
import { VizoraSocketClient } from '@vizora/common';
import { DisplaySettings } from '../types';

describe('App', () => {
  let mockSocket: jest.Mocked<VizoraSocketClient>;
  let mockQueueService: any;
  const initialSettings: DisplaySettings = {
    name: 'Test Display',
    location: 'Test Location',
    resolution: '1920x1080',
    playbackMode: 'scheduled',
    groupId: 'test-group',
    settings: {
      brightness: 80,
      volume: 50,
      autoplay: true,
      contentFit: 'contain',
      rotation: 0,
    },
  };

  beforeEach(() => {
    mockSocket = {
      connected: true,
      on: jest.fn(),
      off: jest.fn(),
    } as any;

    mockQueueService = {
      enqueueStatusReport: jest.fn(),
      enqueueHealthUpdate: jest.fn(),
      enqueueSettingsUpdate: jest.fn(),
      getQueueStatus: jest.fn().mockReturnValue({ total: 0 }),
    };

    jest.spyOn(React, 'useState').mockImplementation((initial) => {
      if (typeof initial === 'function') {
        return [mockQueueService, jest.fn()];
      }
      return [initial, jest.fn()];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial settings', () => {
    render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('0 pending actions')).toBeInTheDocument();
  });

  it('registers socket event listeners', () => {
    render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    expect(mockSocket.on).toHaveBeenCalledWith('settings:update', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('content:update', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('schedule:update', expect.any(Function));
  });

  it('reports initial status on mount', () => {
    render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    expect(mockQueueService.enqueueStatusReport).toHaveBeenCalledWith({
      status: 'online',
      settings: initialSettings,
      timestamp: expect.any(Number),
    });
  });

  it('starts health monitoring interval', () => {
    jest.useFakeTimers();
    render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    
    expect(mockQueueService.enqueueHealthUpdate).toHaveBeenCalledWith({
      cpu: expect.any(Number),
      memory: expect.any(Number),
      disk: expect.any(Number),
      timestamp: expect.any(Number),
    });
    
    jest.useRealTimers();
  });

  it('handles settings updates', async () => {
    render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    const settingsUpdate = {
      brightness: 90,
      volume: 60,
    };
    
    await act(async () => {
      const settingsCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'settings:update'
      )[1];
      settingsCallback({ ...initialSettings, settings: settingsUpdate });
    });
    
    expect(screen.getByText('Display settings updated')).toBeInTheDocument();
  });

  it('handles content updates', async () => {
    render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    await act(async () => {
      const contentCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'content:update'
      )[1];
      contentCallback('test-content-id');
    });
    
    expect(screen.getByText('Content updated')).toBeInTheDocument();
  });

  it('handles schedule updates', async () => {
    render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    await act(async () => {
      const scheduleCallback = mockSocket.on.mock.calls.find(
        (call) => call[0] === 'schedule:update'
      )[1];
      scheduleCallback('test-schedule-id');
    });
    
    expect(screen.getByText('Schedule updated')).toBeInTheDocument();
  });

  it('updates settings and queues the update', async () => {
    render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    const newSettings = {
      brightness: 90,
      volume: 60,
    };
    
    await act(async () => {
      const handleSettingsUpdate = screen.getByTestId('settings-update');
      handleSettingsUpdate(newSettings);
    });
    
    expect(mockQueueService.enqueueSettingsUpdate).toHaveBeenCalledWith({
      ...initialSettings,
      settings: {
        ...initialSettings.settings,
        ...newSettings,
      },
    });
  });

  it('cleans up event listeners and intervals on unmount', () => {
    jest.useFakeTimers();
    const { unmount } = render(<App socket={mockSocket} initialSettings={initialSettings} />);
    
    unmount();
    
    expect(mockSocket.off).toHaveBeenCalledWith('settings:update');
    expect(mockSocket.off).toHaveBeenCalledWith('content:update');
    expect(mockSocket.off).toHaveBeenCalledWith('schedule:update');
    
    jest.useRealTimers();
  });
}); 