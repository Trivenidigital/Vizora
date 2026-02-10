const http = require('http');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookies: res.headers['set-cookie'],
          body: body
        });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== STEP 1: Login to get auth token ===');
  const loginData = JSON.stringify({
    email: 'admin@vizora.test',
    password: 'Test1234!'
  });

  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, loginData);

  console.log('Login status:', loginRes.status);
  const loginBody = JSON.parse(loginRes.body);
  console.log('User:', loginBody.data?.user?.email);

  // Extract cookies
  const authCookie = loginRes.cookies.find(c => c.startsWith('vizora_auth_token='));
  const csrfCookie = loginRes.cookies.find(c => c.startsWith('vizora_csrf_token='));
  const authToken = authCookie.split('=')[1].split(';')[0];
  const csrfToken = csrfCookie.split('=')[1].split(';')[0];

  console.log('\nAuth token (first 20 chars):', authToken.substring(0, 20) + '...');
  console.log('CSRF token (first 20 chars):', csrfToken.substring(0, 20) + '...');

  console.log('\n=== STEP 2: Device requests pairing code (simulating Android app) ===');
  const pairingData = JSON.stringify({
    deviceIdentifier: 'android-1080x1920-' + Date.now(),
    nickname: 'Android Emulator Display',
    metadata: {
      platform: 'android_tv',
      userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36',
      language: 'en-US',
      screenWidth: 1080,
      screenHeight: 1920,
      colorDepth: 24,
      pixelRatio: 2.75,
      networkType: 'wifi',
      timestamp: new Date().toISOString()
    }
  });

  const pairingRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/devices/pairing/request',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': pairingData.length }
  }, pairingData);

  console.log('Pairing request status:', pairingRes.status);
  const pairingBody = JSON.parse(pairingRes.body);
  console.log('Pairing response:', JSON.stringify(pairingBody, null, 2));

  if (pairingRes.status !== 201 && pairingRes.status !== 200) {
    console.error('Pairing request failed!');
    return;
  }

  const pairingCode = pairingBody.code || pairingBody.data?.code;
  console.log('\n>>> PAIRING CODE:', pairingCode, '<<<');

  console.log('\n=== STEP 3: Complete pairing (simulating dashboard user) ===');
  const completeData = JSON.stringify({
    code: pairingCode,
    nickname: 'Android Emulator Display'
  });

  const cookieHeader = `vizora_auth_token=${authToken}; vizora_csrf_token=${csrfToken}`;

  const completeRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/devices/pairing/complete',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': completeData.length,
      'Cookie': cookieHeader,
      'X-CSRF-Token': csrfToken
    }
  }, completeData);

  console.log('Complete pairing status:', completeRes.status);
  const completeBody = JSON.parse(completeRes.body);
  console.log('Complete response:', JSON.stringify(completeBody, null, 2));

  console.log('\n=== STEP 4: Check pairing status (simulating device polling) ===');
  const statusRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: `/api/devices/pairing/status/${pairingCode}`,
    method: 'GET',
    headers: {}
  });

  console.log('Status check:', statusRes.status);
  const statusBody = JSON.parse(statusRes.body);
  console.log('Status response:', JSON.stringify(statusBody, null, 2));

  if (statusBody.status === 'paired' || statusBody.deviceToken) {
    console.log('\n>>> DEVICE PAIRED SUCCESSFULLY! <<<');
    console.log('Device Token (first 30 chars):', (statusBody.deviceToken || '').substring(0, 30) + '...');
    console.log('Display ID:', statusBody.displayId);
  }

  console.log('\n=== STEP 5: List displays to verify ===');
  const displaysRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/displays',
    method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });

  console.log('Displays status:', displaysRes.status);
  const displaysBody = JSON.parse(displaysRes.body);
  console.log('Displays:', JSON.stringify(displaysBody, null, 2));
}

run().catch(console.error);
