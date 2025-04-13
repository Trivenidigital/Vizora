const http = require('http');

console.log('Testing endpoint: http://localhost:3003/api/displays');

// Make a simple HTTP request to the API
http.get('http://localhost:3003/api/displays', (res) => {
  console.log('Response status code:', res.statusCode);
  console.log('Response headers:', JSON.stringify(res.headers, null, 2));
  
  let data = '';
  
  // A chunk of data has been received
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  // The whole response has been received
  res.on('end', () => {
    console.log('Response body:', data);
    
    try {
      const jsonData = JSON.parse(data);
      console.log('Parsed JSON:', JSON.stringify(jsonData, null, 2));
      
      if (jsonData.success === true && Array.isArray(jsonData.data)) {
        console.log('✅ API endpoint is working correctly!');
        process.exit(0);
      } else {
        console.log('❌ API endpoint response format is incorrect');
        process.exit(1);
      }
    } catch (e) {
      console.error('❌ Error parsing JSON response:', e.message);
      process.exit(1);
    }
  });
}).on('error', (e) => {
  console.error('❌ Error making request:', e.message);
  process.exit(1);
});

// Timeout after 5 seconds
setTimeout(() => {
  console.error('❌ Request timed out after 5 seconds');
  process.exit(1);
}, 5000); 