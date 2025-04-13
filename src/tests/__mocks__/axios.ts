import { vi } from 'vitest';

const mockAxios = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
  create: vi.fn(() => mockAxios),
  defaults: {
    headers: {
      common: {},
    },
  },
  interceptors: {
    request: {
      use: vi.fn(),
      eject: vi.fn(),
    },
    response: {
      use: vi.fn(),
      eject: vi.fn(),
    },
  },
  isAxiosError: vi.fn((error) => {
    return error && error.isAxiosError === true;
  }),
};

// Reset all mocks
export const resetAxiosMocks = () => {
  mockAxios.get.mockReset();
  mockAxios.post.mockReset();
  mockAxios.put.mockReset();
  mockAxios.delete.mockReset();
  mockAxios.patch.mockReset();
  mockAxios.create.mockImplementation(() => mockAxios);
  mockAxios.interceptors.request.use.mockReset();
  mockAxios.interceptors.response.use.mockReset();
  mockAxios.isAxiosError.mockReset();
};

// Export the mock instance
export default mockAxios;

// Export the isAxiosError function separately
export const isAxiosError = mockAxios.isAxiosError; 