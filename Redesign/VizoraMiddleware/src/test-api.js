/**
 * Simple API test script
 * Tests basic functionality of the Middleware API endpoints
 */

const axios = require('axios');

// Base URL for API
const API_URL = process.env.API_URL || 'http://localhost:3003/api';

// Test endpoints
const endpoints = {
  health: '/health',
  dbHealth: '/db/health',
  login: '/auth/login',
  register: '/auth/register'
};

// Test credentials
const testUser = {
  email: 'user@vizora.com',
  password: 'user123'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

/**
 * Run a test against an endpoint
 */
const testEndpoint = async (name, url, method = 'GET', data = null) => {
  try {
    console.log(`${colors.blue}Testing ${name} endpoint: ${url}${colors.reset}`);
    
    const config = {
      method: method,
      url: `${API_URL}${url}`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: data
    };
    
    const response = await axios(config);
    
    console.log(`${colors.green}✓ ${name} test passed!${colors.reset}`);
    console.log(`Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    return { success: true, data: response.data };
  } catch (error) {
    console.log(`${colors.red}✗ ${name} test failed!${colors.reset}`);
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.log(`Status: ${error.response.status}`);
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // The request was made but no response was received
      console.log('No response received from server');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.log('Error setting up request:', error.message);
    }
    
    return { success: false, error };
  }
};

/**
 * Run all tests
 */
const runTests = async () => {
  try {
    console.log(`${colors.yellow}=== Starting API Tests ===${colors.reset}`);
    
    // Test Health Endpoint
    const healthResult = await testEndpoint('Health', endpoints.health);
    
    // Test DB Health Endpoint
    const dbHealthResult = await testEndpoint('DB Health', endpoints.dbHealth);
    
    // Test Login Endpoint
    const loginResult = await testEndpoint('Login', endpoints.login, 'POST', testUser);
    
    // Store token for authenticated requests if login succeeded
    let token = null;
    if (loginResult.success && loginResult.data.token) {
      token = loginResult.data.token;
      console.log(`${colors.green}Authentication successful!${colors.reset}`);
    }
    
    console.log(`${colors.yellow}=== Tests Completed ===${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error running tests:${colors.reset}`, error.message);
  }
};

// Run the tests
runTests(); 