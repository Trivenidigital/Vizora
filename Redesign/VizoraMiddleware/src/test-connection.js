const http = require('http');
const https = require('https');

console.log('Testing connectivity from middleware server...');

// Function to check if a port is in use
function checkPortInUse(port) {
  return new Promise((resolve) => {
    const server = http.createServer();
    
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is in use, something is already running there`);
        resolve(true);
      } else {
        console.error(`Error checking port ${port}:`, err);
        resolve(false);
      }
    });
    
    server.once('listening', () => {
      server.close();
      console.log(`Port ${port} is available (not in use)`);
      resolve(false);
    });
    
    server.listen(port);
  });
}

// Function to test HTTP connection
function testHttpConnection(host, port, path) {
  return new Promise((resolve) => {
    console.log(`Testing HTTP connection to ${host}:${port}${path}`);
    
    const req = http.request({
      host,
      port,
      path,
      method: 'GET',
      timeout: 5000
    }, (res) => {
      console.log(`Response from ${host}:${port}${path} - Status: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.error(`Failed to connect to ${host}:${port}${path}:`, err.message);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.error(`Connection to ${host}:${port}${path} timed out`);
      req.destroy();
      resolve(false);
    });
    
    req.end();
  });
}

async function runTests() {
  // Check if our own port is in use
  const port3003Used = await checkPortInUse(3003);
  console.log(`Port 3003 in use: ${port3003Used}`);
  
  // Check if the Vite development server ports are in use
  const port5173Used = await checkPortInUse(5173);
  console.log(`Port 5173 in use: ${port5173Used}`);
  
  // Try to connect to our own server
  await testHttpConnection('localhost', 3003, '/health');
  
  // Try to connect to the Vite development server
  await testHttpConnection('localhost', 5173, '/');
  
  console.log('Connectivity tests completed');
}

runTests(); 