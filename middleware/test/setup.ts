/**
 * Jest Setup File for E2E Tests
 * Configures environment and initializes test database
 */

// Load test environment variables
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test before any other modules
dotenv.config({
  path: path.resolve(__dirname, '../.env.test'),
});

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Suppress console errors during tests (optional)
// Note: This happens at setup time, before beforeAll hook
const originalError = console.error;
console.error = (...args: any[]) => {
  // Filter out specific warnings
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('ts-jest') ||
      args[0].includes('isDeprecated') ||
      args[0].includes('isolatedModules'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};
