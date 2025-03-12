// Simple server for device pairing
import http from 'http';
import { initPairingServer } from './pairingServer.js';

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Vizora Device Management Server');
});

// Initialize pairing server
const pairingIo = initPairingServer(server);

// Start the server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Vizora device management server running on port ${PORT}`);
  console.log(`- Device pairing endpoint: http://localhost:${PORT}/pairing`);
});
