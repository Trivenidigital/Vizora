import { vi } from 'vitest';

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  custom: vi.fn(),
  dismiss: vi.fn(),
  promise: vi.fn(),
  remove: vi.fn(),
};

export default toast; 