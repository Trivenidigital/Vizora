const axios = require('axios');

let successCount = 0;
let errorCount = 0;
const errors = [];

async function testEndpoint(url, method = 'GET', data = null) {
  try {
    const response = await axios({ method, url, data, validateStatus: () => true });
    successCount++;
    return { success: true, status: response.status };
  } catch (error) {
    errorCount++;
    const errorDetail = {
      url,
      error: error.message,
      code: error.code,
      response: error.response?.status
    };
    errors.push(errorDetail);
    if (errors.length === 1) {
      console.log('\nFirst error detail:', JSON.stringify(errorDetail, null, 2));
    }
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('Testing middleware stability - 100 requests\n');
  
  const endpoints = [
    'http://localhost:3000/health',
    'http://localhost:3000/api/auth/health',
    'http://localhost:3000/api/organizations',
  ];
  
  for (let i = 1; i <= 100; i++) {
    const endpoint = endpoints[i % endpoints.length];
    const result = await testEndpoint(endpoint);
    
    if (i % 10 === 0) {
      console.log(`[${i}/100] Success: ${successCount}, Errors: ${errorCount}`);
    }
    
    // Small delay to simulate real usage
    await new Promise(r => setTimeout(r, 50));
  }
  
  console.log('\nFinal Results:');
  console.log(`  Success: ${successCount}/100`);
  console.log(`  Errors: ${errorCount}/100`);
  
  if (errors.length > 0 && errors.length <= 5) {
    console.log('\nError samples:');
    errors.slice(0, 5).forEach(e => console.log(`  ${e.url}: ${e.error}`));
  }
  
  process.exit(errorCount > 10 ? 1 : 0);
}

runTests();
