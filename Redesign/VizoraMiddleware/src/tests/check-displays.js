/**
 * Check Connected Displays
 * This script checks all connected displays and socket details
 */

const http = require('http');

// Configuration
const SERVER_URL = 'http://localhost:3003';

// Log with timestamp
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Simple HTTP request
function httpRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Main function
async function checkDisplays() {
  log('Checking connected displays...');
  
  try {
    // Check the debug endpoint
    const debugResponse = await httpRequest('GET', '/api/displays/debug/connected');
    
    log('\n===== Debug Response =====');
    if (debugResponse.success) {
      log(`Connected displays: ${debugResponse.connectedCount}`);
      
      if (debugResponse.displays && debugResponse.displays.length > 0) {
        log('\nConnected Display Details:');
        debugResponse.displays.forEach(display => {
          console.log(`- Device ID: ${display.deviceId}`);
          console.log(`  Display ID: ${display.displayId || 'Not registered in DB'}`);
          console.log(`  QR Code: ${display.qrCode || 'N/A'}`);
          console.log(`  Name: ${display.name || 'N/A'}`);
          console.log(`  Paired: ${display.isPaired ? 'Yes' : 'No'}`);
          console.log('');
        });
      } else {
        log('No connected displays found.');
      }
      
      if (debugResponse.rooms && debugResponse.rooms.length > 0) {
        log('\nSocket Rooms:');
        debugResponse.rooms.forEach(room => {
          console.log(`- Room: ${room.room}`);
          console.log(`  Socket Count: ${room.socketCount}`);
          console.log(`  Sockets: ${room.sockets.join(', ')}`);
          console.log('');
        });
      } else {
        log('No socket rooms found.');
      }
    } else {
      log('Failed to get debug response');
      console.log(debugResponse);
    }
    
    // Try manual socket rooms check
    log('\n===== Socket Check =====');
    const manualResponse = await httpRequest('POST', '/api/displays/debug/sockets');
    
    if (manualResponse.success) {
      log(`Total connections: ${manualResponse.connectionsCount || 0}`);
      
      if (manualResponse.connections && manualResponse.connections.length > 0) {
        log('\nSocket Connections:');
        manualResponse.connections.forEach(conn => {
          console.log(`- Socket ID: ${conn.id}`);
          console.log(`  Connected: ${conn.connected ? 'Yes' : 'No'}`);
          console.log(`  Rooms: ${Object.keys(conn.rooms || {}).join(', ')}`);
          console.log('');
        });
      }
    }
  } catch (error) {
    log(`Error checking displays: ${error.message}`);
    console.error(error);
  }
}

// Run the check
checkDisplays(); 