// Global test setup - must be first
import 'reflect-metadata';
import 'tslib';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console.error to reduce noise in tests
const originalError = console.error;
console.error = (...args: any[]) => {
  // Filter out expected test errors
  if (args[0]?.includes?.('UnauthorizedException')) return;
  if (args[0]?.includes?.('ConflictException')) return;
  originalError.apply(console, args);
};

// Clean up after all tests
afterAll(async () => {
  // Allow pending async operations to complete
  await new Promise((resolve) => setTimeout(resolve, 100));
});
