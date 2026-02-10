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
  // Login
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
  console.log('✓ Logged in');

  // Get active pairing code
  const activeRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/devices/pairing/active', method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  const activePairings = JSON.parse(activeRes.body);
  const pairings = Array.isArray(activePairings) ? activePairings : (activePairings.data || []);

  if (pairings.length === 0) {
    console.error('No active pairing requests found!');
    return;
  }

  const pairingCode = pairings[pairings.length - 1].code;
  console.log(`✓ Found pairing code: ${pairingCode}`);

  // Complete pairing
  const completeData = JSON.stringify({ code: pairingCode, nickname: 'Android TV Emulator' });
  const completeRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/devices/pairing/complete', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': completeData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
  }, completeData);
  console.log('Pairing status:', completeRes.status);
  const completeBody = JSON.parse(completeRes.body);
  console.log('Response:', JSON.stringify(completeBody, null, 2));

  const displayId = completeBody.display?.id;
  if (!displayId) {
    console.error('Pairing failed - no display ID returned');
    return;
  }
  console.log(`\n✓ DEVICE PAIRED! Display ID: ${displayId}`);

  // Wait for Android device to pick up token and connect via WebSocket
  console.log('\nWaiting 8 seconds for Android device to connect via WebSocket...');
  await new Promise(r => setTimeout(r, 8000));

  // Check device status
  const statusRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: `/api/displays/${displayId}`, method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  const device = JSON.parse(statusRes.body);
  const deviceData = device.data || device;
  console.log(`Device status: ${deviceData.status}`);
  console.log(`Socket ID: ${deviceData.socketId || 'none'}`);
  console.log(`Last heartbeat: ${deviceData.lastHeartbeat || 'none'}`);

  // Get content
  const contentRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/content', method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  const items = (JSON.parse(contentRes.body)).data || [];
  console.log(`\n✓ ${items.length} content items available`);

  // Create playlist
  const playlistData = JSON.stringify({ name: 'Android Stream Test', description: 'Testing streaming to emulator' });
  const playlistRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/playlists', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': playlistData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
  }, playlistData);
  const playlist = JSON.parse(playlistRes.body);
  const playlistId = playlist.data?.id || playlist.id;
  console.log(`✓ Created playlist: ${playlistId}`);

  // Add items
  for (let i = 0; i < Math.min(items.length, 3); i++) {
    const itemData = JSON.stringify({ contentId: items[i].id, duration: 10, order: i });
    await makeRequest({
      hostname: 'localhost', port: 3000, path: `/api/playlists/${playlistId}/items`, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': itemData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
    }, itemData);
    console.log(`  + ${items[i].name}`);
  }

  // Assign playlist to display
  const assignData = JSON.stringify({ currentPlaylistId: playlistId });
  const assignRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: `/api/displays/${displayId}`, method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Content-Length': assignData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
  }, assignData);
  console.log(`\n✓ Playlist assigned (status ${assignRes.status})`);

  // Push content directly
  const pushData = JSON.stringify({ contentId: items[0].id, duration: 30 });
  const pushRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: `/api/displays/${displayId}/push-content`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': pushData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
  }, pushData);
  console.log(`✓ Content pushed (status ${pushRes.status}): ${pushRes.body}`);

  console.log('\n========================================');
  console.log('   COMPLETE - Check emulator screen');
  console.log('========================================');
}

run().catch(console.error);
