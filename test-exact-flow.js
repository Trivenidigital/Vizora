// Exact simulation of browser login flow
const API_BASE = 'http://localhost:3000/api';

class ApiClient {
  constructor() {
    this.token = null;
    this.baseUrl = API_BASE;
  }

  setToken(token) {
    this.token = token;
    console.log('✅ setToken() called with:', token ? token.substring(0, 30) + '...' : 'null');
  }

  clearToken() {
    this.token = null;
    console.log('🗑️  clearToken() called');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    console.log(`\n📤 REQUEST: ${options.method || 'GET'} ${this.baseUrl}${endpoint}`);
    console.log('Headers:', headers);
    if (options.body) {
      console.log('Body:', options.body);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    console.log(`📥 RESPONSE: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        this.clearToken();
      }
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    return data;
  }

  async login(email, password) {
    console.log('\n🔐 === LOGIN METHOD CALLED ===');
    console.log('Email:', email);
    console.log('Password:', password);
    
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    console.log('\n🔍 Extracting token from response...');
    console.log('response:', typeof response);
    console.log('response.data:', typeof response.data);
    console.log('response.data.token:', response.data?.token ? 'EXISTS' : 'MISSING');
    
    if (response.data && response.data.token) {
      console.log('✅ Token path is CORRECT: response.data.token');
      this.setToken(response.data.token);
    } else {
      console.log('❌ Token path is WRONG!');
      console.log('Available paths:');
      console.log('  - response.token:', response.token ? 'EXISTS' : 'missing');
      console.log('  - response.access_token:', response.access_token ? 'EXISTS' : 'missing');
      console.log('  - response.data:', response.data ? 'EXISTS' : 'missing');
    }
    
    return response.data;
  }

  async register(email, password, organizationName, firstName, lastName) {
    console.log('\n📝 === REGISTER METHOD CALLED ===');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('First Name:', firstName);
    console.log('Last Name:', lastName);
    console.log('Organization:', organizationName);
    
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ 
        email, 
        password, 
        organizationName,
        firstName,
        lastName,
      }),
    });
    
    console.log('\n🔍 Extracting token from response...');
    console.log('response:', typeof response);
    console.log('response.data:', typeof response.data);
    console.log('response.data.token:', response.data?.token ? 'EXISTS' : 'MISSING');
    
    if (response.data && response.data.token) {
      console.log('✅ Token path is CORRECT: response.data.token');
      this.setToken(response.data.token);
    } else {
      console.log('❌ Token path is WRONG!');
    }
    
    return response.data;
  }
}

// Test it
async function main() {
  const client = new ApiClient();
  const randomId = Date.now();
  const email = `jstest${randomId}@test.com`;
  const password = 'Test1234!';
  
  console.log('═══════════════════════════════════════════════');
  console.log('🧪 TESTING EXACT BROWSER FLOW');
  console.log('═══════════════════════════════════════════════');
  
  try {
    // Test 1: Register
    console.log('\n\n🎯 TEST 1: REGISTRATION');
    console.log('═══════════════════════════════════════════════');
    await client.register(email, password, `JsTestOrg${randomId}`, 'Js', 'Test');
    
    if (client.token) {
      console.log('\n✅ SUCCESS: Token is set after registration');
      console.log('Token:', client.token.substring(0, 50) + '...');
    } else {
      console.log('\n❌ FAILURE: Token is NOT set after registration');
    }
    
    // Clear token to test login
    client.clearToken();
    
    // Test 2: Login
    console.log('\n\n🎯 TEST 2: LOGIN');
    console.log('═══════════════════════════════════════════════');
    await client.login(email, password);
    
    if (client.token) {
      console.log('\n✅ SUCCESS: Token is set after login');
      console.log('Token:', client.token.substring(0, 50) + '...');
    } else {
      console.log('\n❌ FAILURE: Token is NOT set after login');
    }
    
    console.log('\n\n═══════════════════════════════════════════════');
    console.log('🎉 ALL TESTS COMPLETED');
    console.log('═══════════════════════════════════════════════');
    
  } catch (error) {
    console.error('\n\n❌ ERROR:', error.message);
    console.error(error);
  }
}

main();
