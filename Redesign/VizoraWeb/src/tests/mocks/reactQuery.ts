// Basic React Query mock with query and mutation support
import { vi } from 'vitest';

// Query mocking
const defaultQueryResult = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  isSuccess: true,
  isFetching: false,
  status: 'success',
};

export const createQueryResult = (overrides = {}) => ({
  ...defaultQueryResult,
  ...overrides,
});

export const useQueryMock = vi.fn().mockImplementation(() => defaultQueryResult);

// Mutation mocking
const defaultMutationResult = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isLoading: false,
  isError: false,
  error: null,
  isSuccess: false,
  reset: vi.fn(),
  status: 'idle',
};

export const createMutationResult = (overrides = {}) => ({
  ...defaultMutationResult,
  ...overrides,
});

export const useMutationMock = vi.fn().mockImplementation(() => defaultMutationResult);

// QueryClient mock
export const queryClientMock = {
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  getQueryData: vi.fn(),
  prefetchQuery: vi.fn(),
  refetchQueries: vi.fn(),
};

export const resetReactQueryMocks = () => {
  useQueryMock.mockClear();
  useMutationMock.mockClear();
  queryClientMock.invalidateQueries.mockClear();
  queryClientMock.setQueryData.mockClear();
  queryClientMock.getQueryData.mockClear();
  queryClientMock.prefetchQuery.mockClear();
  queryClientMock.refetchQueries.mockClear();
  
  useQueryMock.mockImplementation(() => defaultQueryResult);
  useMutationMock.mockImplementation(() => defaultMutationResult);
};

export default {
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: () => queryClientMock,
  QueryClient: vi.fn().mockImplementation(() => queryClientMock),
  resetReactQueryMocks,
}; 