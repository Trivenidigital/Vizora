import { DisplayMetadata, DisplayRegistration, DisplayToken, DisplayStatus } from '../types/display';
import { ContentSchedule, ContentPlaybackStatus, Content } from '../types/content';
import { ContentType, RepeatMode, ScheduleEntry } from '../types';

export const mockDisplayMetadata: DisplayMetadata = {
  id: 'test-display-1',
  name: 'Test Display',
  location: 'Test Location',
  resolution: {
    width: 1920,
    height: 1080
  },
  model: 'Test Model',
  os: 'Test OS',
  status: 'online'
};

export const mockDisplayRegistration: DisplayRegistration = {
  pairingCode: '123456',
  metadata: {
    id: 'test-display-1',
    name: 'Test Display',
    location: 'Test Location',
    resolution: {
      width: 1920,
      height: 1080
    },
    model: 'Test Model',
    os: 'Test OS',
    status: 'online'
  }
};

export const mockDisplayToken: DisplayToken = {
  token: 'test-token',
  expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
  displayId: 'test-display-1'
};

export const mockDisplayStatus: DisplayStatus = {
  displayId: 'test-display-1',
  status: 'online',
  lastSeen: new Date(),
  contentStatus: {
    currentContentId: 'test-content-1',
    nextContentId: 'test-content-2',
    isPlaying: true,
    lastSync: new Date()
  }
};

export const mockContentItem: Content = {
  id: 'test-content-1',
  title: 'Test Content',
  type: 'image',
  url: 'https://test.com/content.jpg',
  metadata: {
    thumbnailUrl: 'https://test.com/thumbnail.jpg',
    width: 1920,
    height: 1080,
    duration: 0
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

export const mockContentSchedule: ContentSchedule = {
  id: 'test-schedule-1',
  name: 'Test Schedule',
  displayId: 'test-display-1',
  items: [
    {
      contentId: 'test-content-1',
      startTime: new Date(),
      endTime: new Date(Date.now() + 30000),
      priority: 1,
      repeat: 'none',
      active: true,
      createdAt: new Date(Date.now() - 60000),
    },
    {
      contentId: 'test-content-2',
      startTime: new Date(Date.now() + 30000),
      endTime: new Date(Date.now() + 60000),
      priority: 2,
      repeat: 'daily',
      active: true,
      createdAt: new Date(Date.now() - 50000),
    }
  ],
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

export const mockContentPlaybackStatus: ContentPlaybackStatus = {
  contentId: 'test-content-1',
  displayId: 'test-display-1',
  status: 'playing',
  currentTime: 15,
  lastUpdated: new Date()
};

export const mockScheduleEntries: ScheduleEntry[] = [
  {
    contentId: 'test-content-1',
    startTime: new Date('2024-01-01T09:00:00Z'),
    endTime: new Date('2024-01-01T10:00:00Z'),
    priority: 1,
    repeat: 'none',
    active: true,
    createdAt: new Date('2024-01-01T08:00:00Z'),
  },
  {
    contentId: 'test-content-2',
    startTime: new Date('2024-01-01T10:00:00Z'),
    endTime: new Date('2024-01-01T11:00:00Z'),
    priority: 2,
    repeat: 'daily',
    active: true,
    createdAt: new Date('2024-01-01T08:05:00Z'),
  }
]; 