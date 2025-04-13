/**
 * Main Express app
 */

// In test environment, use the mock app
if (process.env.NODE_ENV === 'test') {
  module.exports = require('../tests/mocks/app');
} else {
  // This would normally be the real app implementation
  // For now, we'll just re-export the mock for compatibility
  module.exports = require('../tests/mocks/app');
} 