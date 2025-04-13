/**
 * API Test Utility
 * 
 * This script tests all critical API endpoints to ensure they are returning valid JSON responses.
 * Run with: node api-test.js
 */

// Use older import technique for node-fetch v2
const fetch = require('node-fetch').default; // Note: use .default for CommonJS
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3003';
const ENDPOINTS = [
  '/api/health',
  '/api/displays',
  '/api/folders',
  '/folders',
  '/api/content',
  '/content',
  '/api/content/content-1',
  '/api/folders/folder-1',
  '/api/folders/folder-1/content'
];

// Test configuration
const UPLOAD_SERVER_URL = 'http://localhost:3006';
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.jpg');

// Create a test image if not exists
if (!fs.existsSync(TEST_IMAGE_PATH)) {
  console.log('Creating test image...');
  // Create a simple 1x1 pixel JPEG
  const buffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
    0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xc2, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00,
    0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01,
    0x01, 0x00, 0x01, 0x3f, 0x10
  ]);
  fs.writeFileSync(TEST_IMAGE_PATH, buffer);
}

async function testEndpoint(endpoint) {
  console.log(`\n🔍 Testing: ${endpoint}`);
  
  try {
    const fullUrl = `${BASE_URL}${endpoint}`;
    console.log(`  Requesting: ${fullUrl}`);
    
    const response = await fetch(fullUrl);
    const contentType = response.headers.get('content-type');
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  Content-Type: ${contentType || 'none'}`);
    
    if (!contentType || !contentType.includes('application/json')) {
      console.log('❌ ERROR: Response is not JSON');
      const text = await response.text();
      console.log(`  First 100 chars: ${text.substring(0, 100)}...`);
      return false;
    }
    
    const data = await response.json();
    console.log('✅ Success: Valid JSON response');
    console.log(`  Data keys: ${Object.keys(data).join(', ')}`);
    return true;
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    return false;
  }
}

async function runTests() {
  console.log('🔧 API ENDPOINT TEST UTILITY');
  console.log(`📡 Base URL: ${BASE_URL}\n`);
  
  let successCount = 0;
  let failureCount = 0;
  
  for (const endpoint of ENDPOINTS) {
    const success = await testEndpoint(endpoint);
    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }
  
  console.log('\n📊 TEST SUMMARY');
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`🔍 Total: ${ENDPOINTS.length}`);
  
  if (failureCount === 0) {
    console.log('\n🎉 ALL TESTS PASSED! The API is functioning correctly.');
  } else {
    console.log('\n⚠️ SOME TESTS FAILED. Please check the logs above for details.');
  }
}

/**
 * Run a test against the upload API
 */
async function testUploadEndpoint() {
  console.log('Testing single file upload endpoint...');
  
  try {
    const form = new FormData();
    
    // Add test file
    form.append('file', fs.createReadStream(TEST_IMAGE_PATH));
    
    // Add metadata
    form.append('title', 'Test Upload');
    form.append('description', 'This is a test upload');
    form.append('category', 'Testing');
    form.append('tags', 'test,api,upload');
    
    // Make request
    const response = await fetch(`${UPLOAD_SERVER_URL}/api/content/upload`, {
      method: 'POST',
      body: form
    });
    
    // Check response
    if (!response.ok) {
      throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Single file upload response:', JSON.stringify(data, null, 2));
    console.log('✅ Single file upload test PASSED');
    
    // Test multiple file upload
    await testMultipleUploadEndpoint();
    
  } catch (error) {
    console.error('❌ Single file upload test FAILED:', error.message);
  }
}

/**
 * Run a test against the multiple files upload API
 */
async function testMultipleUploadEndpoint() {
  console.log('\nTesting multiple files upload endpoint...');
  
  try {
    const form = new FormData();
    
    // Add test files (same file twice for testing)
    form.append('files', fs.createReadStream(TEST_IMAGE_PATH));
    form.append('files', fs.createReadStream(TEST_IMAGE_PATH));
    
    // Add metadata
    form.append('titlePrefix', 'Test Upload');
    form.append('description', 'This is a test upload');
    form.append('category', 'Testing');
    form.append('tags', 'test,api,upload');
    
    // Make request
    const response = await fetch(`${UPLOAD_SERVER_URL}/api/content/upload`, {
      method: 'POST',
      body: form
    });
    
    // Check response
    if (!response.ok) {
      throw new Error(`Multiple upload failed with status ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Multiple files upload response:', JSON.stringify(data, null, 2));
    console.log('✅ Multiple files upload test PASSED');
    
  } catch (error) {
    console.error('❌ Multiple files upload test FAILED:', error.message);
  }
}

// Run the tests
console.log('Starting API tests...');
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
testUploadEndpoint(); 