/**
 * Jest Configuration
 * Optimized for memory usage and test isolation
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test files pattern
  testMatch: ['**/*.test.js'],
  
  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/'],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/db/seeder.js',
    '!src/server.js'
  ],
  coveragePathIgnorePatterns: ['/node_modules/'],
  
  // Setup files
  setupFilesAfterEnv: ['./tests/setup.js'],
  
  // Memory optimizations
  maxWorkers: '50%', // Limit parallel workers to half available CPUs
  
  // Test isolation
  maxConcurrency: 5, // Limit concurrent test files
  
  // Test timeout
  testTimeout: 60000, // 60 seconds timeout for tests
  
  // Verbose output for debugging
  verbose: true,
  
  // Exit test suite immediately after a test fails
  bail: 0,
  
  // Force exit after tests complete
  forceExit: true,
  
  // Better failure reporting
  errorOnDeprecated: true,
  
  // Detect open handles to close them properly
  detectOpenHandles: true,
  
  // Disable watchman for file watching
  watchman: false,
  
  // Global setup
  globalSetup: undefined,
  
  // Global teardown
  globalTeardown: undefined,
  
  // Test environment options
  testEnvironmentOptions: {
    url: 'http://localhost'
  }
}; 