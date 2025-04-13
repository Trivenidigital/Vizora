import { vi } from 'vitest';

/**
 * Helper functions for creating React Query mock responses
 */

/**
 * Creates a mock response for a loading query
 */
export const createLoadingQueryResponse = () => ({
  data: undefined,
  isLoading: true,
  isError: false,
  error: null,
  refetch: vi.fn(),
  isSuccess: false,
  isFetching: true,
  status: 'loading',
  fetchStatus: 'fetching'
});

/**
 * Creates a mock response for an error query
 * @param error - The error object
 */
export const createErrorQueryResponse = (error: Error = new Error('Failed to fetch')) => ({
  data: undefined,
  isLoading: false,
  isError: true,
  error,
  refetch: vi.fn(),
  isSuccess: false,
  isFetching: false,
  status: 'error',
  fetchStatus: 'idle'
});

/**
 * Creates a mock response for a successful query
 * @param data - The data to return
 */
export const createSuccessQueryResponse = <T>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  isSuccess: true,
  isFetching: false,
  status: 'success',
  fetchStatus: 'idle'
});

/**
 * Creates a mock response for an empty query result
 */
export const createEmptyQueryResponse = () => createSuccessQueryResponse([]);

/**
 * Creates a mock response for an idle query (not yet run)
 */
export const createIdleQueryResponse = () => ({
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  isSuccess: false,
  isFetching: false,
  status: 'idle',
  fetchStatus: 'idle'
});

/**
 * Creates a mock response for a loading mutation
 */
export const createLoadingMutationResponse = () => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: true,
  isLoading: true,
  isError: false,
  isSuccess: false,
  error: null,
  reset: vi.fn(),
  status: 'loading'
});

/**
 * Creates a mock response for an error mutation
 * @param error - The error object
 */
export const createErrorMutationResponse = (error: Error = new Error('Failed to mutate')) => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isLoading: false,
  isError: true,
  isSuccess: false,
  error,
  reset: vi.fn(),
  status: 'error'
});

/**
 * Creates a mock response for a successful mutation
 * @param mutateFn - Optional custom mutate function implementation
 */
export const createSuccessMutationResponse = (mutateFn = vi.fn()) => ({
  mutate: mutateFn,
  mutateAsync: vi.fn().mockResolvedValue({}),
  isPending: false,
  isLoading: false,
  isError: false,
  isSuccess: true,
  error: null,
  reset: vi.fn(),
  status: 'success'
});

/**
 * Creates a mock response for an idle mutation (not yet run)
 * @param mutateFn - Optional custom mutate function implementation
 */
export const createIdleMutationResponse = (mutateFn = vi.fn()) => ({
  mutate: mutateFn,
  mutateAsync: vi.fn(),
  isPending: false,
  isLoading: false,
  isError: false,
  isSuccess: false,
  error: null,
  reset: vi.fn(),
  status: 'idle'
});

/**
 * Creates a mock QueryClient with specified behavior
 * @param options - Optional overrides for QueryClient methods
 */
export const createMockQueryClient = (options: Record<string, any> = {}) => ({
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
  ...options
});

export default {
  createLoadingQueryResponse,
  createErrorQueryResponse,
  createSuccessQueryResponse,
  createEmptyQueryResponse,
  createIdleQueryResponse,
  createLoadingMutationResponse,
  createErrorMutationResponse,
  createSuccessMutationResponse,
  createIdleMutationResponse,
  createMockQueryClient
}; 