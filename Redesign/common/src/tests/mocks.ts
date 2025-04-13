import { Display, Content, Schedule } from '../types';
import { vi } from 'vitest';

export const mockDisplay: Display = {
  id: 'disp-001',
  deviceId: 'device-001',
  name: 'Test Display',
  location: 'Test Location',
  status: 'online',
  _id: 'disp-001', // MongoDB compatibility
  lastPing: new Date().toISOString(),
  ipAddress: '192.168.1.1',
  model: 'Test Model'
};

export const mockContent: Content = {
  id: 'content-001',
  title: 'Test Image',
  type: 'image',
  url: 'https://example.com/image.jpg',
  metadata: {
    width: 1920,
    height: 1080,
    duration: 0,
    thumbnailUrl: 'https://example.com/thumb.jpg'
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  userId: 'user1'
};

export const mockSchedule: Schedule = {
  id: 'schedule-1',
  name: 'Test Schedule',
  contentId: 'content-1',
  displayId: 'display-1',
  startTime: '2024-01-01T00:00:00Z',
  endTime: '2024-12-31T23:59:59Z',
  repeat: 'weekly',
  priority: 1,
  active: true,
  createdAt: '2024-01-01T00:00:00Z'
};

export const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: false,
  disconnect: vi.fn()
};

export const mockWebSocketClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  sendHeartbeat: vi.fn()
}; 