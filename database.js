/**
 * Database module - redirects to mocks in test environment
 */

// In test environment, use the mock database
if (process.env.NODE_ENV === 'test') {
  module.exports = require('./tests/mocks/database');
} else {
  // This would normally be the real database module
  // For now, we'll just re-export the mock for compatibility
  module.exports = require('./tests/mocks/database');
} 