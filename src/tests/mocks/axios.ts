import { vi } from 'vitest';

const mockAxios = {
  get: vi.fn().mockResolvedValue({ data: {} }),
  post: vi.fn().mockResolvedValue({ data: {} }),
  put: vi.fn().mockResolvedValue({ data: {} }),
  delete: vi.fn().mockResolvedValue({ data: {} }),
  patch: vi.fn().mockResolvedValue({ data: {} }),
  create: vi.fn().mockReturnThis(),
  isAxiosError: vi.fn().mockImplementation((error: any) => {
    return error && error.isAxiosError === true;
  }),
  interceptors: {
    request: {
      use: vi.fn(),
      eject: vi.fn()
    },
    response: {
      use: vi.fn(),
      eject: vi.fn()
    }
  }
};

export default mockAxios; 