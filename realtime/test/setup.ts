// Global test setup
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set default test environment variables
process.env.DEVICE_JWT_SECRET = process.env.DEVICE_JWT_SECRET || 'test-device-secret-key';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Increase timeout for E2E tests
jest.setTimeout(30000);
