import { vi } from 'vitest';
import { type Mock } from 'vitest';
import { type ReactNode } from 'react';

// Query mocking
export interface QueryResultOptions {
  data?: any;
  isLoading?: boolean;
  isError?: boolean;
  error?: any;
  isSuccess?: boolean;
  isFetching?: boolean;
  status?: 'loading' | 'error' | 'success' | 'idle';
}

const defaultQueryResult = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn().mockResolvedValue({ data: undefined }),
  isSuccess: true,
  isFetching: false,
  status: 'success' as const,
  fetchStatus: 'idle' as const,
};

export const createQueryResult = (overrides: QueryResultOptions = {}) => ({
  ...defaultQueryResult,
  ...overrides,
});

export const useQueryMock = vi.fn().mockImplementation(() => defaultQueryResult);

// Mutation mocking
export interface MutationResultOptions {
  data?: any;
  isLoading?: boolean;
  isError?: boolean;
  error?: any;
  isSuccess?: boolean;
  status?: 'loading' | 'error' | 'success' | 'idle';
}

const defaultMutationResult = {
  mutate: vi.fn(),
  mutateAsync: vi.fn().mockResolvedValue({}),
  isLoading: false,
  isError: false,
  error: null,
  isSuccess: false,
  reset: vi.fn(),
  status: 'idle' as const,
};

export const createMutationResult = (overrides: MutationResultOptions = {}) => ({
  ...defaultMutationResult,
  ...overrides,
});

export const useMutationMock = vi.fn().mockImplementation(() => defaultMutationResult);

// QueryClient mock
interface QueryClientMock {
  invalidateQueries: Mock;
  setQueryData: Mock;
  getQueryData: Mock;
  prefetchQuery: Mock;
  refetchQueries: Mock;
  setQueriesData: Mock;
  resetQueries: Mock;
  clear: Mock;
  removeQueries: Mock;
  isFetching: Mock;
  fetchQuery: Mock;
  [key: string]: any;
}

export const queryClientMock: QueryClientMock = {
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  getQueryData: vi.fn(),
  prefetchQuery: vi.fn(),
  refetchQueries: vi.fn(),
  setQueriesData: vi.fn(),
  resetQueries: vi.fn(),
  clear: vi.fn(),
  removeQueries: vi.fn(),
  isFetching: vi.fn().mockReturnValue(false),
  fetchQuery: vi.fn().mockResolvedValue(undefined),
};

export const resetReactQueryMocks = () => {
  useQueryMock.mockClear();
  useMutationMock.mockClear();
  
  Object.keys(queryClientMock).forEach(key => {
    if (typeof queryClientMock[key] === 'function') {
      queryClientMock[key].mockClear();
    }
  });
  
  useQueryMock.mockImplementation(() => defaultQueryResult);
  useMutationMock.mockImplementation(() => defaultMutationResult);
};

// Export a mock for the entire module
export default {
  useQuery: useQueryMock,
  useMutation: useMutationMock,
  useQueryClient: vi.fn().mockReturnValue(queryClientMock),
  QueryClient: vi.fn().mockImplementation(() => queryClientMock),
  QueryClientProvider: ({ children }: { children: ReactNode }) => children,
  resetReactQueryMocks,
}; 