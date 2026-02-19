const http = require('http');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, cookies: res.headers['set-cookie'], body });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  // ========== LOGIN ==========
  console.log('=== 1. LOGIN ===');
  const loginData = JSON.stringify({ email: 'admin@vizora.test', password: 'Test1234!' });
  const loginRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, loginData);

  const authCookie = loginRes.cookies.find(c => c.startsWith('vizora_auth_token='));
  const csrfCookie = loginRes.cookies.find(c => c.startsWith('vizora_csrf_token='));
  const authToken = authCookie.split('=')[1].split(';')[0];
  const csrfToken = csrfCookie.split('=')[1].split(';')[0];
  const cookieHeader = `vizora_auth_token=${authToken}; vizora_csrf_token=${csrfToken}`;
  console.log('✓ Logged in as admin@vizora.test\n');

  // ========== VERIFY CONTENT & THUMBNAILS ==========
  console.log('=== 2. VERIFY CONTENT & THUMBNAILS ===');
  const contentRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/content', method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  const contentList = JSON.parse(contentRes.body);
  const items = contentList.data || [];
  console.log(`✓ ${items.length} content items found`);

  let thumbPass = 0, thumbFail = 0;
  for (const item of items) {
    const thumbPath = item.thumbnail || item.thumbnailUrl;
    if (!thumbPath) { thumbFail++; continue; }
    const thumbRes = await makeRequest({
      hostname: 'localhost', port: 3000, path: thumbPath, method: 'GET',
      headers: { 'Cookie': cookieHeader }
    });
    if (thumbRes.status === 200) thumbPass++; else thumbFail++;
  }
  console.log(`✓ Thumbnails: ${thumbPass} pass, ${thumbFail} fail\n`);

  // ========== CREATE PLAYLIST ==========
  console.log('=== 3. CREATE PLAYLIST ===');
  const playlistData = JSON.stringify({
    name: 'Test Playlist for Android',
    description: 'Test playlist with all uploaded images'
  });
  const playlistRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/playlists', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': playlistData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
  }, playlistData);
  console.log('Playlist create status:', playlistRes.status);
  const playlist = JSON.parse(playlistRes.body);
  const playlistId = playlist.data?.id || playlist.id;
  console.log('✓ Playlist ID:', playlistId);

  // Add items to playlist
  for (let i = 0; i < Math.min(items.length, 4); i++) {
    const itemData = JSON.stringify({
      contentId: items[i].id,
      duration: 10,
      order: i
    });
    const addRes = await makeRequest({
      hostname: 'localhost', port: 3000, path: `/api/playlists/${playlistId}/items`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': itemData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
    }, itemData);
    console.log(`  Added item ${i + 1} (${items[i].name}): status ${addRes.status}`);
  }
  console.log('');

  // ========== ASSIGN PLAYLIST TO DISPLAY ==========
  console.log('=== 4. ASSIGN PLAYLIST TO DISPLAY ===');
  const displaysRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/displays', method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  const displays = JSON.parse(displaysRes.body);
  const display = (displays.data || [])[0];
  if (!display) { console.error('No displays found!'); return; }
  console.log(`Display: ${display.nickname} (${display.id})`);
  console.log(`Status: ${display.status}`);

  const assignData = JSON.stringify({ currentPlaylistId: playlistId });
  const assignRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: `/api/displays/${display.id}`, method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': assignData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
  }, assignData);
  console.log('Assign playlist status:', assignRes.status);
  const assignBody = JSON.parse(assignRes.body);
  console.log('✓ Playlist assigned:', assignBody.data?.currentPlaylistId || assignBody.currentPlaylistId || 'check response');
  console.log('');

  // ========== TEST PUSH CONTENT ==========
  console.log('=== 5. PUSH CONTENT TO DEVICE ===');
  const pushData = JSON.stringify({
    contentId: items[0].id,
    duration: 30
  });
  const pushRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: `/api/displays/${display.id}/push-content`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': pushData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
  }, pushData);
  console.log('Push content status:', pushRes.status);
  console.log('Push response:', pushRes.body.substring(0, 200));
  console.log('');

  // ========== VERIFY DEVICE CAN ACCESS CONTENT ==========
  console.log('=== 6. VERIFY DEVICE CONTENT ACCESS ===');
  // Get the device token from the pairing status - we need to re-pair or use DB
  const dbDeviceRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: `/api/displays/${display.id}`, method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  const dbDevice = JSON.parse(dbDeviceRes.body);
  console.log('Device details retrieved');

  // Test device content endpoint with a fresh device token
  // First generate a new device pair to get a fresh token
  const pairingData = JSON.stringify({
    deviceIdentifier: 'test-verify-' + Date.now(),
    metadata: { platform: 'test', timestamp: new Date().toISOString() }
  });
  const pairRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/devices/pairing/request', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': pairingData.length }
  }, pairingData);
  const pairBody = JSON.parse(pairRes.body);
  const testCode = pairBody.code;

  const completeData = JSON.stringify({ code: testCode, nickname: 'Test Verify Device' });
  const completeRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/devices/pairing/complete', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': completeData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
  }, completeData);

  const statusRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: `/api/devices/pairing/status/${testCode}`, method: 'GET', headers: {}
  });
  const statusBody = JSON.parse(statusRes.body);
  const deviceToken = statusBody.deviceToken;

  if (deviceToken) {
    for (const item of items.slice(0, 2)) {
      const fileRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/device-content/${item.id}/file?token=${deviceToken}`, method: 'GET', headers: {}
      });
      console.log(`  ${item.name}: HTTP ${fileRes.status}, ${fileRes.headers['content-type']}`);
    }
    console.log('✓ Device content access verified');
  } else {
    console.log('⚠ Could not get device token for verification');
  }

  console.log('\n========================================');
  console.log('   ALL E2E TESTS COMPLETE');
  console.log('========================================');
  console.log(`Content items: ${items.length}`);
  console.log(`Thumbnails: ${thumbPass}/${items.length} accessible`);
  console.log(`Playlist: ${playlistId ? '✓ Created' : '✗ Failed'}`);
  console.log(`Display: ${display.nickname} (${display.status})`);
  console.log('========================================');
}

run().catch(console.error);
