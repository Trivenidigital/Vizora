# Testing React Query Components

This guide explains the recommended approach for testing components that use React Query in our application.

## Table of Contents

1. [Testing Infrastructure](#testing-infrastructure)
2. [Mocking React Query](#mocking-react-query)
3. [Testing Components with Queries](#testing-components-with-queries)
4. [Testing Components with Mutations](#testing-components-with-mutations)
5. [Testing Complex Interactions](#testing-complex-interactions)
6. [Best Practices](#best-practices)

## Testing Infrastructure

We use the following tools for testing:

- **Vitest**: Fast testing framework compatible with Vite
- **React Testing Library**: For rendering components in tests
- **jsdom**: For simulating a browser environment

## Mocking React Query

All React Query hooks are mocked to provide consistent, deterministic test behavior:

### Mock Implementation

Our mocks are located in `src/mocks/reactQuery.ts` and include:

- `useQuery`: Mock implementation for data fetching
- `useMutation`: Mock implementation for data mutations
- `useQueryClient`: Mock client with methods like `invalidateQueries`

### Example of Basic Mock Usage

```typescript
import reactQueryMock from '../../mocks/reactQuery';

// Mock a successful query response
reactQueryMock.useQuery.mockReturnValue({
  data: mockData,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
  isSuccess: true,
  isFetching: false,
  status: 'success',
  fetchStatus: 'idle'
});

// Mock a successful mutation
reactQueryMock.useMutation.mockReturnValue({
  mutate: mutateMock,
  isPending: false,
  isLoading: false,
  isError: false,
  isSuccess: true,
  error: null,
  reset: vi.fn(),
  status: 'success'
});
```

## Testing Components with Queries

When testing components that use queries, you need to mock the response state for each render:

### Testing Loading State

```typescript
it('displays loading state initially', () => {
  reactQueryMock.useQuery.mockReturnValue({
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

  render(<YourComponent />);
  expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
});
```

### Testing Error State

```typescript
it('displays error state when query fails', () => {
  reactQueryMock.useQuery.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: true,
    error: new Error('Failed to fetch'),
    refetch: vi.fn(),
    isSuccess: false,
    isFetching: false,
    status: 'error',
    fetchStatus: 'idle'
  });

  render(<YourComponent />);
  expect(screen.getByTestId('error-message')).toBeInTheDocument();
});
```

### Testing Success State

```typescript
it('displays data when query succeeds', () => {
  const mockData = [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }];
  
  reactQueryMock.useQuery.mockReturnValue({
    data: mockData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isSuccess: true,
    isFetching: false,
    status: 'success',
    fetchStatus: 'idle'
  });

  render(<YourComponent />);
  expect(screen.getByText('Item 1')).toBeInTheDocument();
  expect(screen.getByText('Item 2')).toBeInTheDocument();
});
```

## Testing Components with Mutations

For mutations, we focus on testing the user interactions and verifying the mutation function is called correctly:

```typescript
it('submits the form and calls mutation with correct data', () => {
  const mutateMock = vi.fn();
  
  reactQueryMock.useMutation.mockReturnValue({
    mutate: mutateMock,
    isPending: false,
    isLoading: false,
    isError: false,
    isSuccess: false,
    error: null,
    reset: vi.fn(),
    status: 'idle'
  });

  render(<YourFormComponent />);
  
  // Fill out the form
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Test Name' } });
  
  // Submit the form
  fireEvent.click(screen.getByText('Submit'));
  
  // Verify mutation was called with correct data
  expect(mutateMock).toHaveBeenCalledWith({ name: 'Test Name' });
});
```

## Testing Complex Interactions

For components that have complex interactions with React Query, such as those that change query keys or invalidate queries:

```typescript
it('invalidates queries after successful mutation', () => {
  // Mock mutation with success state
  const mockInvalidateQueries = vi.fn();
  const queryClient = { invalidateQueries: mockInvalidateQueries };
  
  reactQueryMock.useQueryClient.mockReturnValue(queryClient);
  
  reactQueryMock.useMutation.mockReturnValue({
    mutate: vi.fn((data, options) => {
      // Simulate successful mutation and callback
      options.onSuccess();
    }),
    isPending: false,
    isLoading: false,
    isError: false,
    isSuccess: true,
    error: null,
    reset: vi.fn(),
    status: 'success'
  });

  render(<YourComponent />);
  
  // Trigger mutation
  fireEvent.click(screen.getByText('Save'));
  
  // Verify invalidateQueries was called
  expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['yourQueryKey'] });
});
```

## Best Practices

1. **Reset mocks between tests**: Always use `beforeEach` to reset all mocks.
   ```typescript
   beforeEach(() => {
     vi.clearAllMocks();
     reactQueryMock.resetReactQueryMocks();
   });
   ```

2. **Test each query state**: Test loading, error, and success states for complete coverage.

3. **Use testids for selection**: Prefer data-testid attributes to make tests resilient to UI changes.

4. **Chain mock implementations**: For multiple useQuery/useMutation calls in the same component:
   ```typescript
   reactQueryMock.useQuery
     .mockReturnValueOnce({/* first query */})
     .mockReturnValueOnce({/* second query */});
   ```

5. **Rerender for state changes**: When testing components that change state and cause React Query refetches, use the rerender function:
   ```typescript
   const { rerender } = render(<YourComponent />);
   
   // Trigger state change
   fireEvent.click(screen.getByText('Select'));
   
   // Setup new mocks for the rerender
   reactQueryMock.useQuery.mockReturnValue({/* updated response */});
   
   // Trigger rerender
   rerender(<YourComponent />);
   ```

6. **Keep tests focused**: Test one specific behavior per test case.

7. **Avoid testing the library**: Focus on testing your component's behavior, not React Query itself.

8. **Use helper functions**: Create helper functions for common query/mutation response patterns.

By following these guidelines, you'll create maintainable, reliable tests for your React Query components. 