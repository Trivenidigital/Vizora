import { vi } from 'vitest';

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  status: number;
  statusText: string;
  data?: any;
}

export const createApiMock = <T>(data: T, status = 200): ApiResponse<T> => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {
    'content-type': 'application/json'
  }
});

export const createErrorMock = (message: string, status = 400): ApiError => ({
  message,
  status,
  statusText: 'Error',
  data: { message }
});

export const mockApiCall = <T>(data: T, status = 200) => {
  return vi.fn().mockResolvedValue(createApiMock(data, status));
};

export const mockApiError = (message: string, status = 400) => {
  return vi.fn().mockRejectedValue(createErrorMock(message, status));
};

export const mockApiDelay = (ms: number) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

export const mockApiWithDelay = <T>(data: T, delayMs: number = 100, status = 200) => {
  return vi.fn().mockImplementation(async () => {
    await mockApiDelay(delayMs);
    return createApiMock(data, status);
  });
};

export const mockApiWithErrorAndDelay = (message: string, delayMs: number = 100, status = 400) => {
  return vi.fn().mockImplementation(async () => {
    await mockApiDelay(delayMs);
    throw createErrorMock(message, status);
  });
}; 