/**
 * Socket.IO implementation
 */

// In test environment, use the mock socket implementation
if (process.env.NODE_ENV === 'test') {
  module.exports = require('../tests/mocks/socket');
} else {
  // This would normally be the real socket implementation
  // For now, we'll just re-export the mock for compatibility
  module.exports = require('../tests/mocks/socket');
} 