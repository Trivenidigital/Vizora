const http = require('http');

// Test login with direct HTTP request
function testLoginApi() {
  return new Promise((resolve, reject) => {
    // Credentials
    const credentials = {
      email: 'advi@gmail.com',
      password: 'Srini78$$'
    };
    
    const data = JSON.stringify(credentials);
    
    console.log('Testing login API with:', data);
    
    // Setup request options
    const options = {
      hostname: 'localhost',
      port: 3003,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'Origin': 'http://localhost:5173'
      }
    };
    
    // Make the request
    const req = http.request(options, (res) => {
      console.log(`STATUS: ${res.statusCode}`);
      console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
      
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          console.log('Response data:', parsedData);
          resolve(parsedData);
        } catch (e) {
          console.log('Raw response:', responseData);
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => {
      console.error(`Request error: ${e.message}`);
      reject(e);
    });
    
    // Write data and end request
    req.write(data);
    req.end();
  });
}

// Run the test
testLoginApi()
  .then(() => console.log('Test completed'))
  .catch(err => console.error('Test failed:', err)); 