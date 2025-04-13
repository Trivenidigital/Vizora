import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DisplayApp } from '../src/DisplayApp';
import * as displayService from '../src/services/displayService';
import * as contentService from '../src/services/contentService';
import * as scheduleService from '../src/services/scheduleService';

// Mock services
vi.mock('../src/services/displayService');
vi.mock('../src/services/contentService');
vi.mock('../src/services/scheduleService');

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

const mockContent = [
  {
    id: 'content-001',
    title: 'Test Image',
    type: 'image',
    url: 'https://example.com/image.jpg',
    thumbnail: 'https://example.com/thumb.jpg',
    status: 'published',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    userId: 'user1',
  },
  {
    id: 'content-002',
    title: 'Test Video',
    type: 'video',
    url: 'https://example.com/video.mp4',
    thumbnail: 'https://example.com/thumb-video.jpg',
    status: 'published',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    userId: 'user1',
  },
];

const mockSchedule = [
  {
    _id: 'sched-001',
    name: 'Business Hours',
    contentId: 'content-001',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    repeat: 'weekly',
    priority: 1,
  },
];

describe('Display Application', () => {
  let displayApp: DisplayApp;

  beforeEach(() => {
    vi.clearAllMocks();
    (displayService.getDisplayInfo as any).mockResolvedValue(mockDisplay);
    (contentService.getContentList as any).mockResolvedValue(mockContent);
    (scheduleService.getSchedules as any).mockResolvedValue(mockSchedule);
    displayApp = new DisplayApp();
  });

  it('initializes display application', async () => {
    await displayApp.initialize();

    expect(displayService.getDisplayInfo).toHaveBeenCalled();
    expect(contentService.getContentList).toHaveBeenCalled();
    expect(scheduleService.getSchedules).toHaveBeenCalled();
  });

  it('registers display with server', async () => {
    const mockRegistration = {
      ...mockDisplay,
      status: 'registered',
    };
    (displayService.registerDisplay as any).mockResolvedValue(mockRegistration);

    await displayApp.initialize();
    await displayApp.registerDisplay();

    expect(displayService.registerDisplay).toHaveBeenCalledWith({
      name: mockDisplay.name,
      location: mockDisplay.location,
      type: mockDisplay.type,
      resolution: mockDisplay.resolution,
      orientation: mockDisplay.orientation,
    });
  });

  it('handles content playback', async () => {
    await displayApp.initialize();
    await displayApp.startPlayback();

    // Verify content is being played
    expect(displayApp.getCurrentContent()).toBeDefined();
    expect(displayApp.getCurrentContent()?.id).toBe('content-001');
  });

  it('handles schedule execution', async () => {
    await displayApp.initialize();
    await displayApp.startPlayback();

    // Simulate schedule check
    const currentTime = new Date();
    currentTime.setHours(10, 0, 0, 0); // Set to 10:00 AM
    await displayApp.checkSchedule(currentTime);

    // Verify schedule is being followed
    expect(displayApp.getCurrentSchedule()).toBeDefined();
    expect(displayApp.getCurrentSchedule()?.contentId).toBe('content-001');
  });

  it('handles network disconnection', async () => {
    await displayApp.initialize();
    await displayApp.startPlayback();

    // Simulate network disconnection
    await displayApp.handleNetworkDisconnect();

    // Verify offline mode is activated
    expect(displayApp.isOfflineMode()).toBe(true);
    expect(displayApp.getCurrentContent()).toBeDefined();
  });

  it('handles content caching', async () => {
    await displayApp.initialize();
    await displayApp.startPlayback();

    // Simulate content caching
    await displayApp.cacheContent(mockContent[0]);

    // Verify content is cached
    expect(displayApp.isContentCached(mockContent[0].id)).toBe(true);
  });

  it('handles error recovery', async () => {
    const error = new Error('API Error');
    (displayService.getDisplayInfo as any).mockRejectedValue(error);

    await displayApp.initialize();

    // Verify error handling
    expect(displayApp.getError()).toBeDefined();
    expect(displayApp.getError()?.message).toBe('API Error');
  });

  it('handles display shutdown', async () => {
    await displayApp.initialize();
    await displayApp.startPlayback();

    // Simulate shutdown
    await displayApp.shutdown();

    // Verify cleanup
    expect(displayApp.isRunning()).toBe(false);
    expect(displayService.updateDisplayStatus).toHaveBeenCalledWith(mockDisplay._id, 'inactive');
  });

  it('handles content updates', async () => {
    await displayApp.initialize();
    await displayApp.startPlayback();

    // Simulate content update
    const updatedContent = {
      ...mockContent[0],
      url: 'https://example.com/updated-image.jpg',
    };
    await displayApp.handleContentUpdate(updatedContent);

    // Verify content is updated
    expect(displayApp.getCurrentContent()?.url).toBe(updatedContent.url);
  });

  it('handles schedule updates', async () => {
    await displayApp.initialize();
    await displayApp.startPlayback();

    // Simulate schedule update
    const updatedSchedule = {
      ...mockSchedule[0],
      endTime: '18:00',
    };
    await displayApp.handleScheduleUpdate(updatedSchedule);

    // Verify schedule is updated
    expect(displayApp.getCurrentSchedule()?.endTime).toBe(updatedSchedule.endTime);
  });
}); 