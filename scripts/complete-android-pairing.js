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
  // Step 1: Login
  console.log('=== Login ===');
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
  console.log('Logged in');

  // Step 2: Get active pairing requests
  console.log('\n=== Active Pairing Requests ===');
  const activeRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/devices/pairing/active', method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  console.log('Status:', activeRes.status);
  const activeBody = JSON.parse(activeRes.body);
  console.log('Active pairings:', JSON.stringify(activeBody, null, 2));

  // If no active pairings found via that endpoint, let's check the displays
  console.log('\n=== Current Displays ===');
  const displaysRes = await makeRequest({
    hostname: 'localhost', port: 3000, path: '/api/displays', method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });
  const displays = JSON.parse(displaysRes.body);
  const allDisplays = displays.data || [];
  console.log(`Total displays: ${allDisplays.length}`);
  allDisplays.forEach(d => {
    console.log(`  - ${d.nickname} (${d.id}) status=${d.status} pairingCode=${d.pairingCode || 'none'}`);
  });

  // The Android app's pairing code should be visible. Let me try to get it from the screenshot.
  // Looking at the screenshot, the code appears to be partially visible.
  // Let's try to find it by checking active codes

  // Step 3: Try to complete pairing with the code we can see from the emulator
  // The code from the screenshot looks like it starts with B/R - let me try the endpoint
  // that lists pending pairing requests

  // Actually, let me just check all potential codes by looking at what the device sent
  // The Android device uses a unique deviceIdentifier pattern: android-{width}x{height}-{timestamp}

  // Let me find the right pairing code by checking active requests
  if (activeBody.data && activeBody.data.length > 0) {
    const latestPairing = activeBody.data[activeBody.data.length - 1];
    const pairingCode = latestPairing.code;
    console.log(`\n=== Completing pairing with code: ${pairingCode} ===`);

    const completeData = JSON.stringify({
      code: pairingCode,
      nickname: 'Android TV Emulator'
    });

    const completeRes = await makeRequest({
      hostname: 'localhost', port: 3000, path: '/api/devices/pairing/complete', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': completeData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
    }, completeData);

    console.log('Complete status:', completeRes.status);
    const completeBody = JSON.parse(completeRes.body);
    console.log('Response:', JSON.stringify(completeBody, null, 2));

    if (completeRes.status === 201 || completeRes.status === 200) {
      const displayId = completeBody.display?.id;
      console.log(`\n✓ Device paired! Display ID: ${displayId}`);

      // Step 4: Wait for device to pick up the token, then assign playlist
      console.log('\nWaiting 5 seconds for device to connect...');
      await new Promise(r => setTimeout(r, 5000));

      // Check device status
      const deviceStatusRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/displays/${displayId}`, method: 'GET',
        headers: { 'Cookie': cookieHeader }
      });
      const deviceStatus = JSON.parse(deviceStatusRes.body);
      const device = deviceStatus.data || deviceStatus;
      console.log(`Device status: ${device.status}`);

      // Step 5: Get existing content and create/assign playlist
      const contentRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/content', method: 'GET',
        headers: { 'Cookie': cookieHeader }
      });
      const content = JSON.parse(contentRes.body);
      const items = content.data || [];

      // Create a new playlist for this device
      const playlistData = JSON.stringify({
        name: 'Android Emulator Playlist',
        description: 'Playlist for testing on Android emulator'
      });
      const playlistRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: '/api/playlists', method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': playlistData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
      }, playlistData);
      const playlist = JSON.parse(playlistRes.body);
      const playlistId = playlist.data?.id || playlist.id;
      console.log(`\nCreated playlist: ${playlistId}`);

      // Add content items to playlist
      for (let i = 0; i < Math.min(items.length, 3); i++) {
        const itemData = JSON.stringify({ contentId: items[i].id, duration: 10, order: i });
        await makeRequest({
          hostname: 'localhost', port: 3000, path: `/api/playlists/${playlistId}/items`, method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': itemData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
        }, itemData);
        console.log(`  Added: ${items[i].name}`);
      }

      // Assign playlist to display
      const assignData = JSON.stringify({ currentPlaylistId: playlistId });
      const assignRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/displays/${displayId}`, method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Content-Length': assignData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
      }, assignData);
      console.log(`\nPlaylist assigned: status ${assignRes.status}`);

      // Step 6: Push content directly
      console.log('\n=== Pushing content to device ===');
      const pushData = JSON.stringify({ contentId: items[0].id, duration: 30 });
      const pushRes = await makeRequest({
        hostname: 'localhost', port: 3000, path: `/api/displays/${displayId}/push-content`, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': pushData.length, 'Cookie': cookieHeader, 'X-CSRF-Token': csrfToken }
      }, pushData);
      console.log(`Push status: ${pushRes.status}`);
      console.log(`Push response: ${pushRes.body}`);

      console.log('\n========================================');
      console.log('   PAIRING + CONTENT PUSH COMPLETE');
      console.log('========================================');
    }
  } else if (Array.isArray(activeBody)) {
    // activeBody might be an array directly
    console.log('Active pairings (array):', activeBody.length);
    if (activeBody.length > 0) {
      console.log('First code:', activeBody[0].code);
    }
  } else {
    console.log('No active pairing requests found via API.');
    console.log('You may need to enter the code manually from the emulator screen.');
    console.log('Full response:', JSON.stringify(activeBody));
  }
}

run().catch(console.error);
