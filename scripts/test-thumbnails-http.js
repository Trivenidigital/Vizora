const http = require('http');

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
      hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
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
      hostname: 'localhost', port: 3000, path: '/api/content', method: 'GET',
      headers: { 'Cookie': cookieHeader }
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });

  const items = contentRes.data || contentRes;
  console.log(`\n=== Thumbnail HTTP Verification (${items.length} items) ===\n`);

  for (const item of items) {
    const thumbnailPath = item.thumbnail || item.thumbnailUrl;
    if (!thumbnailPath) {
      console.log(`[FAIL] ${item.name} - No thumbnail path set`);
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
      console.log(`[${status}] ${item.name}`);
      console.log(`   Path: ${thumbnailPath}`);
      console.log(`   HTTP Status: ${thumbRes.status}`);
      console.log(`   Content-Type: ${thumbRes.contentType}`);
      console.log(`   Size: ${thumbRes.bodyLength} bytes`);
    } catch (e) {
      console.log(`[FAIL] ${item.name} - Error: ${e.message}`);
    }
  }

  // Also test content file serving via device endpoint
  console.log('\n=== Device Content File Access Verification ===\n');

  // Use the device token from the pairing flow
  const deviceToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlZDc3NmU5Zi1hNWI3LTQ1OTQtYjI1NS1kMDYzMjFhMTUwNmUiLCJkZXZpY2VJZGVudGlmaWVyIjoiYW5kcm9pZC0xMDgweDE5MjAtMTc3MDU1ODQ5NzMzMiIsIm9yZ2FuaXphdGlvbklkIjoiNjJhNTVmZTItMzIyNC00MDQ0LTgxODctNzQ3MWVkZDUyOWIyIiwidHlwZSI6ImRldmljZSIsImlhdCI6MTc3MDU1ODQ5NywiZXhwIjoxODAyMDk0NDk3fQ.oOuTGNqWbapKhR3fYHbiZY1mzzJUn2Xo2okFMOH4Gc4';

  for (const item of items.slice(0, 2)) {  // Test first 2
    try {
      const fileRes = await makeRequest({
        hostname: 'localhost',
        port: 3000,
        path: `/api/device-content/${item.id}/file?token=${deviceToken}`,
        method: 'GET',
        headers: {}
      });

      const status = fileRes.status === 200 ? 'PASS' : 'FAIL';
      console.log(`[${status}] ${item.name}`);
      console.log(`   HTTP Status: ${fileRes.status}`);
      console.log(`   Content-Type: ${fileRes.contentType}`);
      console.log(`   Size: ${fileRes.bodyLength} bytes`);
    } catch (e) {
      console.log(`[FAIL] ${item.name} - Error: ${e.message}`);
    }
  }
}

run().catch(console.error);
