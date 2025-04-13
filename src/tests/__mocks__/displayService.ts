import { vi } from 'vitest';
import type { Display, DisplayFilters } from '../../types/display';

const mockDisplay = {
  id: '1',
  name: 'Test Display',
  status: 'online',
  lastSeen: new Date().toISOString(),
  ipAddress: '192.168.1.1',
};

const getDisplays = vi.fn().mockResolvedValue([mockDisplay]);
const getDisplay = vi.fn().mockResolvedValue(mockDisplay);
const createDisplay = vi.fn().mockResolvedValue(mockDisplay);
const updateDisplay = vi.fn().mockResolvedValue(mockDisplay);
const deleteDisplay = vi.fn().mockResolvedValue(undefined);
const registerDisplay = vi.fn().mockResolvedValue(mockDisplay);
const unpairDisplay = vi.fn().mockResolvedValue(undefined);
const getDisplayStats = vi.fn().mockResolvedValue({ total: 1, online: 1 });

// Reset all mocks
export const resetDisplayServiceMocks = () => {
  getDisplays.mockClear();
  getDisplay.mockClear();
  createDisplay.mockClear();
  updateDisplay.mockClear();
  deleteDisplay.mockClear();
  registerDisplay.mockClear();
  unpairDisplay.mockClear();
  getDisplayStats.mockClear();
};

// Default export
const displayService = {
  getDisplays,
  getDisplay,
  createDisplay,
  updateDisplay,
  deleteDisplay,
  registerDisplay,
  unpairDisplay,
  getDisplayStats,
};

export default displayService; 