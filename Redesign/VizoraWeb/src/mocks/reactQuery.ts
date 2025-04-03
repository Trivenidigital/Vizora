import { vi } from 'vitest';

const reactQueryMock = {
  resetReactQueryMocks: vi.fn(),
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn()
  }))
};

export default reactQueryMock; 