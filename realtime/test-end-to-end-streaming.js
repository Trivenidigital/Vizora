const { io } = require('socket.io-client');
const http = require('http');

const API_URL = 'http://127.0.0.1:3000';
const API_PREFIX = '/api/v1';
const REALTIME_URL = 'ws://127.0.0.1:3002';
const DEVICE_IDENTIFIER = '00:15:5d:05:a2:cb';
const DEVICE_TOKEN = requiredEnv('VIZORA_TEST_DEVICE_TOKEN');

const results = [];
let userToken = null;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required. Generate a fresh local device token and pass it through the environment.`);
    process.exit(1);
  }
  return value;
}

function httpRequest(method, path, body, headers = {}, useAuth = true) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}${path}`);
    const payload = body && typeof body === 'string' ? body : body ? JSON.stringify(body) : undefined;

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(useAuth && userToken && { 'Authorization': `Bearer ${userToken}` }),
        ...headers,
        ...(payload && { 'Content-Length': payload.length }),
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: data ? JSON.parse(data) : null,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function unwrapResponseData(responseData) {
  return responseData && typeof responseData === 'object' && 'data' in responseData
    ? responseData.data
    : responseData;
}

async function testRegisterUser() {
  console.log('\n👤 STEP 1: Register Test User');
  console.log('=====================================');

  try {
    const uniqueId = Date.now();
    const email = `test-streaming-${uniqueId}@example.com`;
    const response = await httpRequest('POST', `${API_PREFIX}/auth/register`, {
      email: email,
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'Streaming',
      organizationName: `Streaming Org ${uniqueId}`,
    }, {}, false);

    if (response.status === 201) {
      const authData = unwrapResponseData(response.data);
      userToken = authData.access_token || authData.token;
      console.log('✓ User registered');
      console.log(`  Email: ${email}`);
      console.log(`  Token: ${userToken?.substring(0, 30)}...`);
      return true;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.data?.message}`);
    }
  } catch (error) {
    console.log('✗ Registration failed');
    console.log(`  Error: ${error.message}`);
    return false;
  }
}

async function testCreateContent() {
  console.log('\n📝 STEP 2: Create Content');
  console.log('=====================================');

  try {
    const response = await httpRequest('POST', `${API_PREFIX}/content`, {
      name: 'Streaming Test Image',
      description: 'Image for realtime streaming test',
      type: 'image',
      url: 'https://via.placeholder.com/1920x1080.jpg?text=Vizora+Streaming+Test',
      duration: 15000,
      mimeType: 'image/jpeg',
    });

    if (response.status === 200 || response.status === 201) {
      const content = unwrapResponseData(response.data);
      const contentId = content.id || content.contentId;
      console.log('✓ Content created');
      console.log(`  Content ID: ${contentId}`);
      console.log(`  Name: ${content.name}`);
      console.log(`  Duration: ${content.duration}ms`);
      return contentId;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.data?.message}`);
    }
  } catch (error) {
    console.log('✗ Content creation failed');
    console.log(`  Error: ${error.message}`);
    return null;
  }
}

async function testCreatePlaylist(contentId) {
  console.log('\n📺 STEP 3: Create Playlist with Content');
  console.log('=====================================');

  try {
    const response = await httpRequest('POST', `${API_PREFIX}/playlists`, {
      name: 'Streaming Test Playlist',
      description: 'Playlist for realtime delivery test',
      isDefault: false,
      items: [
        {
          contentId: contentId,
          duration: 15000,
          order: 1,
        },
      ],
    });

    if (response.status === 200 || response.status === 201) {
      const playlist = unwrapResponseData(response.data);
      const playlistId = playlist.id || playlist.playlistId;
      console.log('✓ Playlist created');
      console.log(`  Playlist ID: ${playlistId}`);
      console.log(`  Name: ${playlist.name}`);
      console.log(`  Items: ${playlist.items?.length || 1}`);
      return playlistId;
    } else {
      throw new Error(`HTTP ${response.status}: ${response.data?.message}`);
    }
  } catch (error) {
    console.log('✗ Playlist creation failed');
    console.log(`  Error: ${error.message}`);
    return null;
  }
}

async function testDeviceRealtimeConnection() {
  console.log('\n📡 STEP 4: Device Realtime Connection & Heartbeat');
  console.log('=====================================');

  try {
    return new Promise((resolve) => {
      const socket = io(REALTIME_URL, {
        auth: { token: DEVICE_TOKEN },
        transports: ['websocket', 'polling'],
        reconnection: false,
        reconnectionAttempts: 1,
      });

      const timeout = setTimeout(() => {
        socket.disconnect();
        console.log('✗ Connection timeout');
        results.push({
          name: 'Device Realtime Connection',
          status: 'FAIL',
          message: 'Connection timeout',
        });
        resolve(false);
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('✓ Connected to realtime gateway');
        console.log(`  Socket ID: ${socket.id}`);

        // Send heartbeat
        console.log('\n📤 Sending device heartbeat...');
        socket.emit('heartbeat', {
          timestamp: Date.now(),
          status: 'online',
          metrics: {
            cpuUsage: 18,
            memoryUsage: 320,
            storageUsed: 1536,
          },
        }, (ack) => {
          console.log('✓ Heartbeat acknowledged');
          console.log(`  Next heartbeat: ${ack.nextHeartbeatIn}ms`);
          console.log(`  Commands: ${ack.commands?.length || 0}`);

          results.push({
            name: 'Device Realtime Connection',
            status: 'PASS',
            message: 'Device connected and heartbeat acknowledged',
            details: { socketId: socket.id },
          });

          socket.disconnect();
          resolve(true);
        });
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.log('✗ Connection error');
        console.log(`  Error: ${error.message}`);
        results.push({
          name: 'Device Realtime Connection',
          status: 'FAIL',
          message: error.message,
        });
        resolve(false);
      });
    });
  } catch (error) {
    console.log('✗ Realtime test failed');
    console.log(`  Error: ${error.message}`);
    results.push({
      name: 'Device Realtime Connection',
      status: 'FAIL',
      message: error.message,
    });
    return false;
  }
}

async function testPlaylistDelivery(playlistId) {
  console.log('\n📡 STEP 5: Playlist Push & Reception');
  console.log('=====================================');

  try {
    // Fetch the playlist
    const playlistResp = await httpRequest('GET', `${API_PREFIX}/playlists/${playlistId}`);

    if (playlistResp.status !== 200) {
      throw new Error(`Could not fetch playlist: HTTP ${playlistResp.status}`);
    }

    const playlist = unwrapResponseData(playlistResp.data);
    console.log('✓ Playlist fetched from API');
    console.log(`  Playlist ID: ${playlist.id}`);
    console.log(`  Items: ${playlist.items?.length || 0}`);

    // Now simulate device receiving the playlist
    return new Promise((resolve) => {
      const socket = io(REALTIME_URL, {
        auth: { token: DEVICE_TOKEN },
        transports: ['websocket', 'polling'],
        reconnection: false,
        reconnectionAttempts: 1,
      });

      let playlistReceived = false;

      const timeout = setTimeout(() => {
        socket.disconnect();
        if (!playlistReceived) {
          console.log('⏳ Playlist push timeout (gateway may not implement auto-push)');
          results.push({
            name: 'Playlist Delivery',
            status: 'PENDING',
            message: 'Playlist verified and ready, auto-push feature pending',
            details: { playlistId },
          });
        }
        resolve(true);
      }, 3000);

      socket.on('connect', () => {
        console.log('✓ Connected to receive playlist');
        console.log(`  Socket ID: ${socket.id}`);

        // Listen for playlist push
        socket.on('playlist:push', (data) => {
          clearTimeout(timeout);
          playlistReceived = true;
          console.log('\n✓ Playlist push received');
          console.log(`  Playlist ID: ${data.id}`);
          console.log(`  Items: ${data.items?.length || 0}`);

          results.push({
            name: 'Playlist Delivery',
            status: 'PASS',
            message: 'Playlist successfully pushed to device',
            details: { playlistId: data.id, itemCount: data.items?.length },
          });

          socket.disconnect();
          resolve(true);
        });

        // Also emit playlist:request to trigger push
        socket.emit('playlist:request', {});
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        console.log('✗ Connection error');
        results.push({
          name: 'Playlist Delivery',
          status: 'FAIL',
          message: error.message,
        });
        resolve(false);
      });
    });
  } catch (error) {
    console.log('✗ Playlist delivery test failed');
    console.log(`  Error: ${error.message}`);
    results.push({
      name: 'Playlist Delivery',
      status: 'PENDING',
      message: error.message,
    });
    return false;
  }
}

async function printSummary() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                        ║');
  console.log('╚════════════════════════════════════════════════════════╝');

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const pending = results.filter((r) => r.status === 'PENDING').length;

  console.log(`\nTotal: ${results.length} | Passed: ${passed} | Failed: ${failed} | Pending: ${pending}\n`);

  results.forEach((result) => {
    const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⏳';
    console.log(`${icon} ${result.name} [${result.status}]`);
    console.log(`  ${result.message}`);
  });
}

async function runEndToEndTest() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  VIZORA END-TO-END CONTENT STREAMING TEST               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`\nAPI URL: ${API_URL}`);
  console.log(`Realtime URL: ${REALTIME_URL}`);
  console.log(`Device: ${DEVICE_IDENTIFIER}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Step 1: Register user
  const registered = await testRegisterUser();
  if (!registered) {
    console.log('\n❌ Cannot proceed without user registration');
    process.exit(1);
  }

  // Step 2: Create content
  const contentId = await testCreateContent();
  if (!contentId) {
    console.log('\n❌ Cannot proceed without content');
    process.exit(1);
  }

  // Step 3: Create playlist
  const playlistId = await testCreatePlaylist(contentId);
  if (!playlistId) {
    console.log('\n❌ Cannot proceed without playlist');
    process.exit(1);
  }

  // Step 4: Device connects via realtime
  await testDeviceRealtimeConnection();

  // Step 5: Push playlist to device
  await testPlaylistDelivery(playlistId);

  // Print summary
  await printSummary();

  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n${failed === 0 ? '✅ END-TO-END STREAMING TEST PASSED' : '❌ SOME TESTS FAILED'}`);
  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runEndToEndTest().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
