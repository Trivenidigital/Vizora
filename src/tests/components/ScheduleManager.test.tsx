import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { createSuccessQueryResponse } from '../helpers/queryMockHelpers';
import reactQueryMock from '../../mocks/reactQuery';
import ScheduleManager from '../../components/ScheduleManager';

// Define interfaces
interface ScheduleItem {
  id: string;
  contentId: string;
  startTime: string;
  endTime: string;
  daysOfWeek: string[];
  isActive: boolean;
}

interface ContentItem {
  id: string;
  title: string;
  type: string;
  url: string;
}

// Mock Scheduler Service
const schedulerService = {
  getSchedule: vi.fn(),
  addScheduleItem: vi.fn(),
  updateScheduleItem: vi.fn(),
  deleteScheduleItem: vi.fn(),
  activateScheduleItem: vi.fn(),
  deactivateScheduleItem: vi.fn()
};

vi.mock('../../services/schedulerService', () => ({
  default: schedulerService
}));

// Mock content service
const contentService = {
  getContentList: vi.fn(),
  getContentById: vi.fn()
};

vi.mock('../../services/contentService', () => ({
  default: contentService
}));

// Mock time utilities
const mockNow = new Date('2023-05-15T12:00:00Z');
const realDateNow = Date.now;

describe('ScheduleManager', () => {
  const mockSchedule: ScheduleItem[] = [
    {
      id: 'schedule-1',
      contentId: 'content-1',
      startTime: '08:00',
      endTime: '17:00',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      isActive: true
    }
  ];

  const mockContent: ContentItem[] = [
    {
      id: 'content-1',
      title: 'Test Content',
      type: 'image',
      url: 'https://example.com/image.jpg'
    }
  ];

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock Date.now
    Date.now = vi.fn(() => mockNow.getTime());
    
    // Setup default mock responses
    schedulerService.getSchedule.mockResolvedValue(mockSchedule);
    contentService.getContentList.mockResolvedValue(mockContent);
    contentService.getContentById.mockResolvedValue(mockContent[0]);
  });

  afterEach(() => {
    // Restore Date.now
    Date.now = realDateNow;
  });

  it('displays loading state initially', () => {
    render(<ScheduleManager />);
    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
  });

  it('displays schedule list when data is loaded', async () => {
    render(<ScheduleManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('schedule-list')).toBeInTheDocument();
      expect(screen.getByTestId('schedule-item-schedule-1')).toBeInTheDocument();
      expect(screen.getByTestId('content-title-schedule-1')).toHaveTextContent('Test Content');
    });
  });

  it('displays error state when schedule loading fails', async () => {
    schedulerService.getSchedule.mockRejectedValue(new Error('Failed to load schedule'));
    
    render(<ScheduleManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('error-state')).toBeInTheDocument();
    });
  });

  it('allows adding a new schedule', async () => {
    render(<ScheduleManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('add-schedule')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('add-schedule'));
    
    expect(screen.getByTestId('schedule-form')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-form-title')).toHaveTextContent('Add Schedule');
  });

  it('allows editing an existing schedule', async () => {
    render(<ScheduleManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('edit-button-schedule-1')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('edit-button-schedule-1'));
    
    expect(screen.getByTestId('schedule-form')).toBeInTheDocument();
    expect(screen.getByTestId('schedule-form-title')).toHaveTextContent('Edit Schedule');
  });

  it('allows deleting a schedule', async () => {
    render(<ScheduleManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('delete-button-schedule-1')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('delete-button-schedule-1'));
    
    expect(schedulerService.deleteScheduleItem).toHaveBeenCalledWith('schedule-1');
  });

  it('allows toggling schedule active state', async () => {
    render(<ScheduleManager />);
    
    await waitFor(() => {
      expect(screen.getByTestId('toggle-button-schedule-1')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByTestId('toggle-button-schedule-1'));
    
    expect(schedulerService.deactivateScheduleItem).toHaveBeenCalledWith('schedule-1');
  });
}); 