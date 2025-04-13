/**
 * Script to restart the server with folder support
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('Restarting the Vizora Middleware server...');

try {
  // Find any running servers on port 3003
  console.log('Checking for existing server processes...');
  const processData = execSync('netstat -ano | findstr :3003').toString();
  const pidMatches = processData.match(/LISTENING\s+(\d+)/);
  
  if (pidMatches && pidMatches[1]) {
    const pid = pidMatches[1];
    console.log(`Found process ${pid} using port 3003, stopping it...`);
    execSync(`taskkill /F /PID ${pid}`);
    console.log(`Successfully stopped process ${pid}`);
  }
} catch (error) {
  console.log('No existing server process found.');
}

// Start the server in a new process
console.log('Starting server with folder support...');
try {
  execSync('node direct-fix.js', { 
    stdio: 'inherit',
    detached: true 
  });
} catch (error) {
  console.error('Error starting server:', error);
}

console.log('Server restart command issued successfully.');
console.log('To test the folders endpoint, try:');
console.log('curl http://localhost:3003/api/folders'); 