/**
 * Test Authentication and Displays API
 * This script tests that the displays endpoint works with cookies/tokens
 */

const fetch = require('node-fetch');

// Configuration
const API_URL = 'http://localhost:3003/api';
const EMAIL = 'test@example.com';
const PASSWORD = 'password123';

// Helper to print response details
const printResponseDetails = (response, data) => {
  console.log('Status:', response.status);
  console.log('Headers:', Object.fromEntries([...response.headers.entries()]));
  console.log('Body:', JSON.stringify(data, null, 2).substring(0, 500) + (JSON.stringify(data, null, 2).length > 500 ? '...' : ''));
};

// Main function
const testDisplaysEndpoint = async () => {
  try {
    // Step 1: Login to get token
    console.log('\n🔑 Step 1: Login');
    console.log('----------------');
    
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: EMAIL,
        password: PASSWORD
      }),
      credentials: 'include'
    });
    
    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      throw new Error(`Login failed: ${loginData.message || 'Unknown error'}`);
    }
    
    console.log('✅ Login successful');
    const token = loginData.token;
    console.log('Token (first 20 chars):', token.substring(0, 20) + '...');
    
    // Extract cookies
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Cookies received:', cookies ? 'Yes' : 'No');
    
    if (cookies) {
      console.log('Cookie details:', cookies);
    }
    
    // Step 2: Test /displays with Authorization header
    console.log('\n🔐 Step 2: Test /displays with Authorization header');
    console.log('--------------------------------------------------');
    
    const headerAuthResponse = await fetch(`${API_URL}/displays`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const headerAuthData = await headerAuthResponse.json();
    console.log('Response with Authorization header:');
    printResponseDetails(headerAuthResponse, headerAuthData);
    
    // Step 3: Test /displays with cookie auth
    console.log('\n🍪 Step 3: Test /displays with cookie auth');
    console.log('----------------------------------------');
    
    const cookieAuthResponse = await fetch(`${API_URL}/displays`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies // Manually pass cookies
      },
      credentials: 'include'
    });
    
    const cookieAuthData = await cookieAuthResponse.json();
    console.log('Response with cookie authentication:');
    printResponseDetails(cookieAuthResponse, cookieAuthData);
    
    // Step 4: Test /auth/me with cookie auth (for comparison)
    console.log('\n🔍 Step 4: Test /auth/me with cookie auth');
    console.log('----------------------------------------');
    
    const authMeResponse = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies // Manually pass cookies
      },
      credentials: 'include'
    });
    
    const authMeData = await authMeResponse.json();
    console.log('Response from /auth/me with cookie authentication:');
    printResponseDetails(authMeResponse, authMeData);
    
    // End test
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
};

// Run the test
testDisplaysEndpoint(); 