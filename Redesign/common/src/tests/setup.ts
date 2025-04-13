import { vi } from 'vitest';
import { mockSocket, mockWebSocketClient } from './mocks';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date: Date) => date.toISOString()),
  isWithinInterval: vi.fn((date: Date, interval: { start: Date; end: Date }) => {
    return date >= interval.start && date <= interval.end;
  }),
  setHours: vi.fn((date: Date, hours: number) => {
    const newDate = new Date(date);
    newDate.setHours(hours);
    return newDate;
  }),
  setMinutes: vi.fn((date: Date, minutes: number) => {
    const newDate = new Date(date);
    newDate.setMinutes(minutes);
    return newDate;
  }),
}));

// Mock WebSocket client
vi.mock('../sockets/client', () => ({
  VizoraSocketClient: vi.fn().mockImplementation(() => mockWebSocketClient),
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
global.sessionStorage = sessionStorageMock as any;

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
}); 