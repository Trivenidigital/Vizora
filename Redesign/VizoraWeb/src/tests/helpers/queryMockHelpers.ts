export const createSuccessQueryResponse = <T>(data: T) => ({
  data,
  isLoading: false,
  isError: false,
  error: null
});

export const createErrorQueryResponse = (error: Error) => ({
  data: null,
  isLoading: false,
  isError: true,
  error
}); 