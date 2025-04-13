/**
 * Simple script to verify the /api/displays endpoint is working
 * Run with: node verify-api.js
 */

const http = require('http');
console.log('Testing endpoint: http://localhost:3003/api/displays');

// Make a GET request to the API endpoint
const req = http.get('http://localhost:3003/api/displays', (res) => {
  console.log('Status code:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  
  // Collect data as it arrives
  res.on('data', (chunk) => {
    data += chunk;
    console.log('Received chunk:', chunk.toString());
  });
  
  // Process the complete response
  res.on('end', () => {
    console.log('Response body:', data);
    
    if (!data) {
      console.error('❌ No data received from the server');
      process.exit(1);
    }
    
    try {
      const parsedData = JSON.parse(data);
      console.log('Parsed data:', JSON.stringify(parsedData, null, 2));
      
      if (parsedData.success === true && Array.isArray(parsedData.data)) {
        console.log('✅ API working correctly!');
        process.exit(0);
      } else {
        console.log('❌ API response format is incorrect');
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error making request:', error.message);
  process.exit(1);
});

// Set a timeout in case the request hangs
setTimeout(() => {
  console.error('❌ Request timed out after 5 seconds');
  process.exit(1);
}, 5000);

// Add this to make sure we see error messages before exiting
process.on('exit', (code) => {
  console.log(`Exiting with code ${code}`);
}); 