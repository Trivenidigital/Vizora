/**
 * Simple API test for content upload endpoints
 */
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

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
testUploadEndpoint(); 