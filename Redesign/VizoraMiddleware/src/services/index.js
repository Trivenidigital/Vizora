/**
 * Services index - exports all services from a single file
 */

const displayService = require('./displayService');
const controllerService = require('./controllerService');
const pairingService = require('./pairingService');
const socketService = require('./socketService');

// Export all services
module.exports = {
  displayService,
  controllerService,
  pairingService,
  socketService
}; 