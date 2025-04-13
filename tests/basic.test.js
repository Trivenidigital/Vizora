/**
 * Basic test to verify that the test environment is set up correctly
 */

const { connectDB, disconnectDB } = require('../database');

describe('Basic Test Environment', () => {
  it('should run tests successfully', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have access to the database module', () => {
    expect(typeof connectDB).toBe('function');
    expect(typeof disconnectDB).toBe('function');
  });

  it('should be running in test environment', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
}); 