/**
 * Test Authentication and Displays Endpoints
 * This script tests both cookie-based and header-based authentication
 * for the /auth/me and /api/displays endpoints
 */

const fetch = require('node-fetch');
const readline = require('readline');

// Configuration
const API_URL = 'http://localhost:3003/api';
const EMAIL = 'admin@vizora.ai'; // Default user for testing
const PASSWORD = 'admin123';     // Default password for testing

// Test scenarios
const testScenarios = [
  {
    name: 'Cookie-based Authentication',
    authMethod: 'cookie',
    description: 'Test authentication using httpOnly cookies'
  },
  {
    name: 'Header-based Authentication', 
    authMethod: 'header',
    description: 'Test authentication using Authorization header'
  }
];

// Helper for prompting
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for credentials
const promptCredentials = () => {
  return new Promise((resolve) => {
    console.log('\n🔑 Authentication Test');
    console.log('====================');
    
    rl.question(`Email [${EMAIL}]: `, (email) => {
      const userEmail = email || EMAIL;
      
      rl.question(`Password [${PASSWORD}]: `, (password) => {
        const userPassword = password || PASSWORD;
        resolve({ email: userEmail, password: userPassword });
      });
    });
  });
};

// Main testing function
const runTests = async () => {
  try {
    // Get user credentials
    const credentials = await promptCredentials();
    
    console.log('\n🧪 Starting API Tests');
    console.log('===================');
    
    // Loop through test scenarios
    for (const scenario of testScenarios) {
      console.log(`\n📋 Test Scenario: ${scenario.name}`);
      console.log(`Description: ${scenario.description}`);
      
      // Step 1: Login
      console.log('\n🔒 Step 1: Logging in...');
      const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password
        }),
        credentials: 'include'  // Important for cookie-based auth
      });
      
      const loginData = await loginResponse.json();
      
      if (!loginResponse.ok) {
        console.error('❌ Login failed:', loginData.message);
        continue;
      }
      
      console.log('✅ Login successful');
      console.log('Token received:', loginData.token ? `${loginData.token.substring(0, 10)}...` : 'None');
      
      // Extract token and cookies
      const token = loginData.token;
      const cookies = loginResponse.headers.get('set-cookie');
      
      console.log('Cookies received:', cookies ? 'Yes' : 'No');
      
      // Step 2: Test /auth/me endpoint
      console.log('\n👤 Step 2: Testing /auth/me endpoint...');
      
      const meResponse = await fetch(`${API_URL}/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(scenario.authMethod === 'header' ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'  // Include cookies
      });
      
      const meData = await meResponse.json();
      
      if (!meResponse.ok) {
        console.error(`❌ /auth/me failed: ${meData.message || 'Unknown error'}`);
        console.error('Status:', meResponse.status);
        continue;
      }
      
      console.log('✅ /auth/me successful');
      console.log(`User: ${meData.user.firstName} ${meData.user.lastName} (${meData.user.email})`);
      
      // Step 3: Test /api/displays endpoint
      console.log('\n🖥️ Step 3: Testing /api/displays endpoint...');
      
      const displaysResponse = await fetch(`${API_URL}/displays`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(scenario.authMethod === 'header' ? { 'Authorization': `Bearer ${token}` } : {})
        },
        credentials: 'include'  // Include cookies
      });
      
      // Check if response is JSON
      const contentType = displaysResponse.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ /api/displays did not return JSON');
        console.error('Status:', displaysResponse.status);
        console.error('Content type:', contentType);
        
        // Try to get text content
        const textContent = await displaysResponse.text();
        console.error('Response body:', textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''));
        continue;
      }
      
      const displaysData = await displaysResponse.json();
      
      if (!displaysResponse.ok) {
        console.error(`❌ /api/displays failed: ${displaysData.message || 'Unknown error'}`);
        console.error('Status:', displaysResponse.status);
        continue;
      }
      
      console.log('✅ /api/displays successful');
      console.log(`Retrieved ${displaysData.count} displays`);
      
      if (displaysData.displays && displaysData.displays.length > 0) {
        console.log('First display:', {
          deviceId: displaysData.displays[0].deviceId,
          name: displaysData.displays[0].name,
          status: displaysData.displays[0].status
        });
      }
    }
    
    console.log('\n✨ Tests completed');
    rl.close();
    
  } catch (error) {
    console.error('\n❌ Test error:', error.message);
    rl.close();
  }
};

// Run the tests
runTests(); 