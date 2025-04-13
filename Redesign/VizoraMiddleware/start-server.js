/**
 * Server starter script for easy restart
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const http = require('http');

// Kill any existing process on port 3003
async function killExistingProcess() {
  console.log('Checking for existing process on port 3003...');
  
  return new Promise((resolve, reject) => {
    const isWindows = os.platform() === 'win32';
    const killCommand = isWindows ? 'npx' : 'fuser';
    const args = isWindows 
      ? ['kill-port', '3003'] 
      : ['-k', '3003/tcp'];
    
    const kill = spawn(killCommand, args, { 
      shell: true,
      stdio: 'inherit'
    });
    
    kill.on('close', (code) => {
      console.log(`Kill process exited with code ${code}`);
      resolve();
    });
    
    kill.on('error', (err) => {
      console.warn('Error killing process:', err);
      resolve(); // Still try to continue
    });
  });
}

// Start the server
async function startServer() {
  try {
    await killExistingProcess();
    
    console.log('Starting the server...');
    const server = spawn('node', ['src/server.js'], { 
      stdio: 'inherit',
      cwd: __dirname
    });
    
    server.on('close', (code) => {
      console.log(`Server process exited with code ${code}`);
    });
    
    server.on('error', (err) => {
      console.error('Failed to start server:', err);
    });
    
    // Print access URLs after server starts
    setTimeout(() => {
      console.log('\nAccess URLs:');
      console.log('Main API: http://localhost:3003/api');
      console.log('Socket.IO Diagnostic: http://localhost:3003/socket-diagnostic.html');
      console.log('TV App Test: http://localhost:3003/tv-app-test.html');
    }, 3000);

    // After the server starts and console.log message about the server
    console.log(`
======================================================
🚀 Vizora Middleware Server Started
======================================================
API: http://localhost:${process.env.PORT || 3003}/api
WebSockets: ws://localhost:${process.env.PORT || 3003}/socket.io
Socket.IO Diagnostic: http://localhost:${process.env.PORT || 3003}/socket-diagnostic.html

Try GET /api/status for health check
Try GET /api/socket-diagnostic for WebSocket status
======================================================
`);
  } catch (error) {
    console.error('Error starting server:', error);
  }
}

// Check if server is already running
function checkServerRunning() {
  return new Promise((resolve) => {
    http.get('http://localhost:3003/api', (res) => {
      console.log('Server is already running (status:', res.statusCode, ')');
      resolve(true);
    }).on('error', () => {
      console.log('Server is not running');
      resolve(false);
    });
  });
}

// Main function
async function main() {
  console.log('===== Vizora Middleware Server =====');
  const isRunning = await checkServerRunning();
  
  if (isRunning) {
    console.log('Restarting server...');
  } else {
    console.log('Starting server...');
  }
  
  await startServer();
}

// Run the main function
main().catch(console.error); 