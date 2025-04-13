import { vi } from 'vitest';

export interface Schedule {
  id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  startTime: string;
  endTime: string;
  timezone: string;
  daysOfWeek: number[];
  repeatType: 'daily' | 'weekly' | 'monthly' | 'once';
  priority: number;
  status: 'active' | 'inactive' | 'expired';
  content: {
    id: string;
    name: string;
    type: string;
  }[];
  displays: {
    id: string;
    name: string;
  }[];
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  };
}

// Mock data
export const mockSchedules: Schedule[] = [
  {
    id: '1',
    name: 'Welcome Message',
    description: 'Morning welcome message for lobby displays',
    startDate: '2023-01-01',
    startTime: '08:00',
    endTime: '12:00',
    timezone: 'America/New_York',
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    repeatType: 'daily',
    priority: 10,
    status: 'active',
    content: [
      { id: '1', name: 'Welcome Video', type: 'video' }
    ],
    displays: [
      { id: 'd1', name: 'Lobby Display' }
    ],
    createdAt: '2022-12-15T00:00:00Z',
    updatedAt: '2022-12-15T00:00:00Z',
    createdBy: {
      id: 'u1',
      name: 'Admin User'
    }
  },
  {
    id: '2',
    name: 'Weekend Content',
    description: 'Special content for weekends',
    startDate: '2023-01-07',
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'America/New_York',
    daysOfWeek: [0, 6], // Saturday and Sunday
    repeatType: 'weekly',
    priority: 5,
    status: 'active',
    content: [
      { id: '2', name: 'Weekend Promo', type: 'video' },
      { id: '3', name: 'Special Offers', type: 'image' }
    ],
    displays: [
      { id: 'd1', name: 'Lobby Display' },
      { id: 'd2', name: 'Meeting Room Display' }
    ],
    createdAt: '2022-12-20T00:00:00Z',
    updatedAt: '2022-12-28T00:00:00Z',
    createdBy: {
      id: 'u2',
      name: 'Regular User'
    }
  },
  {
    id: '3',
    name: 'Special Event',
    description: 'One-time event content',
    startDate: '2023-02-15',
    endDate: '2023-02-15',
    startTime: '10:00',
    endTime: '16:00',
    timezone: 'America/New_York',
    daysOfWeek: [3], // Wednesday
    repeatType: 'once',
    priority: 20,
    status: 'inactive',
    content: [
      { id: '4', name: 'Event Announcement', type: 'video' }
    ],
    displays: [
      { id: 'd1', name: 'Lobby Display' },
      { id: 'd2', name: 'Meeting Room Display' }
    ],
    createdAt: '2023-01-05T00:00:00Z',
    updatedAt: '2023-01-05T00:00:00Z',
    createdBy: {
      id: 'u1',
      name: 'Admin User'
    }
  }
];

// Mock functions
export const scheduleService = {
  getSchedules: vi.fn().mockResolvedValue(mockSchedules),
  getScheduleById: vi.fn().mockImplementation((id: string) => {
    const schedule = mockSchedules.find(s => s.id === id);
    if (schedule) {
      return Promise.resolve(schedule);
    }
    return Promise.reject(new Error('Schedule not found'));
  }),
  createSchedule: vi.fn().mockImplementation((scheduleData: Partial<Schedule>) => {
    const newSchedule = {
      id: String(mockSchedules.length + 1),
      name: scheduleData.name || 'New Schedule',
      startDate: scheduleData.startDate || new Date().toISOString().split('T')[0],
      startTime: scheduleData.startTime || '09:00',
      endTime: scheduleData.endTime || '17:00',
      timezone: scheduleData.timezone || 'UTC',
      daysOfWeek: scheduleData.daysOfWeek || [1, 2, 3, 4, 5],
      repeatType: scheduleData.repeatType || 'daily',
      priority: scheduleData.priority || 0,
      status: 'inactive',
      content: scheduleData.content || [],
      displays: scheduleData.displays || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: {
        id: 'u1',
        name: 'Admin User'
      }
    };
    return Promise.resolve(newSchedule);
  }),
  updateSchedule: vi.fn().mockImplementation((id: string, scheduleData: Partial<Schedule>) => {
    const schedule = mockSchedules.find(s => s.id === id);
    if (!schedule) {
      return Promise.reject(new Error('Schedule not found'));
    }
    return Promise.resolve({
      ...schedule,
      ...scheduleData,
      updatedAt: new Date().toISOString()
    });
  }),
  deleteSchedule: vi.fn().mockResolvedValue(true),
  activateSchedule: vi.fn().mockImplementation((id: string) => {
    const schedule = mockSchedules.find(s => s.id === id);
    if (!schedule) {
      return Promise.reject(new Error('Schedule not found'));
    }
    return Promise.resolve({
      ...schedule,
      status: 'active',
      updatedAt: new Date().toISOString()
    });
  }),
  deactivateSchedule: vi.fn().mockImplementation((id: string) => {
    const schedule = mockSchedules.find(s => s.id === id);
    if (!schedule) {
      return Promise.reject(new Error('Schedule not found'));
    }
    return Promise.resolve({
      ...schedule,
      status: 'inactive',
      updatedAt: new Date().toISOString()
    });
  }),
  getSchedulesByDisplay: vi.fn().mockImplementation((displayId: string) => {
    const relevantSchedules = mockSchedules.filter(s => 
      s.displays.some(d => d.id === displayId));
    return Promise.resolve(relevantSchedules);
  }),
  getSchedulesByContent: vi.fn().mockImplementation((contentId: string) => {
    const relevantSchedules = mockSchedules.filter(s => 
      s.content.some(c => c.id === contentId));
    return Promise.resolve(relevantSchedules);
  }),
  getActiveSchedules: vi.fn().mockResolvedValue(
    mockSchedules.filter(s => s.status === 'active')
  ),
  getUpcomingSchedules: vi.fn().mockResolvedValue(
    mockSchedules.filter(s => new Date(s.startDate) > new Date())
  )
}; 