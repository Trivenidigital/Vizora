import { vi } from 'vitest';

interface Display {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  location: string;
}

const mockDisplays: Display[] = [
  {
    id: '1',
    name: 'Main Lobby Display',
    status: 'online',
    lastSeen: '2024-01-01T00:00:00Z',
    location: 'Main Lobby'
  },
  {
    id: '2',
    name: 'Conference Room A',
    status: 'offline',
    lastSeen: '2024-01-01T00:00:00Z',
    location: 'Conference Room A'
  },
  {
    id: '3',
    name: 'Cafeteria Display',
    status: 'online',
    lastSeen: '2024-01-01T00:00:00Z',
    location: 'Cafeteria'
  }
];

const displayService = {
  getDisplays: vi.fn().mockResolvedValue(mockDisplays),
  getDisplayById: vi.fn().mockResolvedValue(mockDisplays[0]),
  registerDisplay: vi.fn().mockResolvedValue(mockDisplays[0]),
  updateDisplay: vi.fn().mockResolvedValue(mockDisplays[0]),
  deleteDisplay: vi.fn().mockResolvedValue(undefined),
  unpairDisplay: vi.fn().mockResolvedValue(undefined),
  getDisplayStatus: vi.fn().mockResolvedValue({ status: 'online' })
};

export const resetDisplayServiceMocks = () => {
  vi.clearAllMocks();
  displayService.getDisplays.mockResolvedValue(mockDisplays);
  displayService.getDisplayById.mockResolvedValue(mockDisplays[0]);
  displayService.registerDisplay.mockResolvedValue(mockDisplays[0]);
  displayService.updateDisplay.mockResolvedValue(mockDisplays[0]);
  displayService.deleteDisplay.mockResolvedValue(undefined);
  displayService.unpairDisplay.mockResolvedValue(undefined);
  displayService.getDisplayStatus.mockResolvedValue({ status: 'online' });
};

export default displayService; 