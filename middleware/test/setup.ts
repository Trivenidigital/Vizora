/**
 * Jest Setup File for E2E Tests
 * Configures environment and initializes test database
 */

// Globally mock isomorphic-dompurify so no e2e suite transitively loads
// jsdom. jsdom@28 pulls in several ESM-only deps (@csstools/css-calc,
// @asamuzakjp/css-color, @exodus/bytes, etc.) that Jest's CJS runtime
// can't execute without --experimental-vm-modules. The mock preserves
// the behavior unit-test expectations rely on: strip <script> tags.
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) =>
      html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
          .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
          .replace(/javascript:[^"'\s>]*/gi, ''),
    ),
  },
}));

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
