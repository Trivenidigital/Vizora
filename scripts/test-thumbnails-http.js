const http = require('http');
const DEVICE_TOKEN = requiredEnv('VIZORA_TEST_DEVICE_TOKEN');
const API_PREFIX = '/api/v1';
let failures = 0;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required. Generate a fresh local device token and pass it through the environment.`);
    process.exit(1);
  }
  return value;
}

function recordFailure(message) {
  failures += 1;
  console.log(message);
}

function extractCollection(payload) {
  const queue = [payload];
  const seen = new Set();

  while (queue.length > 0) {
    const value = queue.shift();
    if (Array.isArray(value)) return value;
    if (!value || typeof value !== 'object' || seen.has(value)) continue;

    seen.add(value);
    for (const key of ['data', 'items', 'content', 'results']) {
      if (key in value) queue.push(value[key]);
    }
  }

  return [];
}

function makeRequest(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          bodyLength: Buffer.concat(chunks).length,
          contentType: res.headers['content-type']
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  // Login first
  const loginData = JSON.stringify({ email: 'admin@vizora.test', password: 'Test1234!' });
  const loginRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path: `${API_PREFIX}/auth/login`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ cookies: res.headers['set-cookie'], body }));
    });
    req.on('error', reject);
    req.write(loginData);
    req.end();
  });

  const authCookie = loginRes.cookies.find(c => c.startsWith('vizora_auth_token='));
  const csrfCookie = loginRes.cookies.find(c => c.startsWith('vizora_csrf_token='));
  const authToken = authCookie.split('=')[1].split(';')[0];
  const csrfToken = csrfCookie.split('=')[1].split(';')[0];
  const cookieHeader = `vizora_auth_token=${authToken}; vizora_csrf_token=${csrfToken}`;

  // Get content list
  const contentRes = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost', port: 3000, path: `${API_PREFIX}/content`, method: 'GET',
      headers: { 'Cookie': cookieHeader }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });

  const items = extractCollection(contentRes);
  console.log(`\n=== Thumbnail HTTP Verification (${items.length} items) ===\n`);

  for (const item of items) {
    const thumbnailPath = item.thumbnail || item.thumbnailUrl;
    if (!thumbnailPath) {
      recordFailure(`[FAIL] ${item.name} - No thumbnail path set`);
      continue;
    }

    // Test thumbnail via middleware API (static file serving)
    try {
      const thumbRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: thumbnailPath,
        method: 'GET',
        headers: { 'Cookie': cookieHeader }
      });

      const status = thumbRes.status === 200 ? 'PASS' : 'FAIL';
      if (status === 'FAIL') failures += 1;
      console.log(`[${status}] ${item.name}`);
      console.log(`   Path: ${thumbnailPath}`);
      console.log(`   HTTP Status: ${thumbRes.status}`);
      console.log(`   Content-Type: ${thumbRes.contentType}`);
      console.log(`   Size: ${thumbRes.bodyLength} bytes`);
    } catch (e) {
      recordFailure(`[FAIL] ${item.name} - Error: ${e.message}`);
    }
  }

  // Also test content file serving via device endpoint
  console.log('\n=== Device Content File Access Verification ===\n');

  for (const item of items.slice(0, 2)) {  // Test first 2
    try {
      const fileRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `${API_PREFIX}/device-content/${item.id}/file?token=${DEVICE_TOKEN}`,
        method: 'GET',
        headers: {}
      });

      const status = fileRes.status === 200 ? 'PASS' : 'FAIL';
      if (status === 'FAIL') failures += 1;
      console.log(`[${status}] ${item.name}`);
      console.log(`   HTTP Status: ${fileRes.status}`);
      console.log(`   Content-Type: ${fileRes.contentType}`);
      console.log(`   Size: ${fileRes.bodyLength} bytes`);
    } catch (e) {
      recordFailure(`[FAIL] ${item.name} - Error: ${e.message}`);
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} thumbnail/content verification checks failed`);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
