/**
 * Test script for the pairing endpoint
 * Run with: node test-pairing.js
 */

const http = require('http');

// Test data
const testData = {
  pairingCode: 'ABC123',
  name: 'Reception Display',
  location: 'Lobby'
};

console.log('===== PAIRING API TEST =====');
console.log('Testing endpoint: http://localhost:3003/api/displays/pair');
console.log('Request data:', JSON.stringify(testData, null, 2));
console.log('============================');

// Prepare the request data
const requestData = JSON.stringify(testData);

// Create the request options
const options = {
  hostname: 'localhost',
  port: 3003,
  path: '/api/displays/pair',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData)
  }
};

console.log('Request options:', JSON.stringify(options, null, 2));

// Create and send the request
try {
  console.log('\nSending request with data:', requestData);
  
  const req = http.request(options, (res) => {
    console.log('\nResponse received:');
    console.log('Status code:', res.statusCode);
    console.log('Response headers:', JSON.stringify(res.headers, null, 2));
    
    let data = '';
    
    // Collect data as it arrives
    res.on('data', (chunk) => {
      data += chunk;
      console.log('Received chunk:', chunk.toString());
    });
    
    // Process the complete response
    res.on('end', () => {
      console.log('\nComplete response body:', data);
      
      try {
        const response = JSON.parse(data);
        console.log('\nParsed response:', JSON.stringify(response, null, 2));
        
        if (response.success === true && response.display) {
          console.log('\n✅ Pairing API endpoint is working correctly!');
          console.log('Display:', response.display.name);
          console.log('Location:', response.display.location);
          process.exit(0);
        } else {
          console.log('\n❌ API response format is incorrect');
          process.exit(1);
        }
      } catch (error) {
        console.error('\n❌ Error parsing response:', error.message);
        process.exit(1);
      }
    });
  });
  
  // Handle request errors
  req.on('error', (error) => {
    console.error('\n❌ Error making request:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('Make sure the server is running on port 3003');
    }
    process.exit(1);
  });
  
  // Send the test data
  req.write(requestData);
  req.end();
  
  // Set a timeout
  setTimeout(() => {
    console.error('\n❌ Request timed out after 5 seconds');
    process.exit(1);
  }, 5000);
} catch (error) {
  console.error('\n❌ Error creating request:', error.message);
  process.exit(1);
} 