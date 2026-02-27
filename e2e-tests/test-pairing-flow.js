#!/usr/bin/env node

/**
 * Vizora Device Pairing Flow Test Script
 * This script tests the complete device pairing flow for the Vizora application
 * Usage: node test-pairing-flow.js
 */

const http = require('http');
const https = require('https');
const readline = require('readline');

// Configuration
const config = {
  middlewareUrl: 'http://localhost:3000',
  webUrl: 'http://localhost:3001',
  email: 'bro@triveni.com',
  password: 'Srini78$$',
  deviceId: 'test-display-001',
  deviceName: 'Test Display Unit',
  deviceHostname: 'test-machine',
  deviceOs: 'Windows',
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// State
let pairingCode = null;
let qrCode = null;
let pairingUrl = null;
let expiresAt = null;

// Utility functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function printHeader(title) {
  console.log(`\n${colors.blue}${'='.repeat(50)}${colors.reset}`);
  log(title, 'blue');
  console.log(`${colors.blue}${'='.repeat(50)}${colors.reset}\n`);
}

function printSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function printError(message) {
  log(`✗ ${message}`, 'red');
}

function printWarning(message) {
  log(`⚠ ${message}`, 'yellow');
}

function printInfo(message) {
  log(`ℹ ${message}`, 'cyan');
}

// HTTP helper functions
function makeRequest(url, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = client.request(urlObj, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = data ? JSON.parse(data) : null;
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsedData,
            rawBody: data,
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            rawBody: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Test service connectivity
async function testServiceConnectivity() {
  printHeader('Testing Service Connectivity');

  printInfo(`Checking Middleware API at ${config.middlewareUrl}...`);
  try {
    const response = await makeRequest(`${config.middlewareUrl}/health`).catch(
      () => makeRequest(`${config.middlewareUrl}`)
    );
    if (response.status >= 200 && response.status < 500) {
      printSuccess('Middleware API is running');
    } else {
      throw new Error('Not responding');
    }
  } catch (error) {
    printError(
      `Middleware API is not responding at ${config.middlewareUrl}`
    );
    printInfo(
      'Make sure the middleware server is running with: npm run dev (in middleware directory)'
    );
    process.exit(1);
  }

  printInfo(`Checking Web App at ${config.webUrl}...`);
  try {
    const response = await makeRequest(`${config.webUrl}`);
    if (response.status >= 200 && response.status < 500) {
      printSuccess('Web App is running');
    }
  } catch (error) {
    printWarning(
      `Web App is not responding at ${config.webUrl} (You'll need to test UI manually)`
    );
  }
}

// Step 1: Request Pairing Code
async function stepRequestPairing() {
  printHeader('Step 1: Request Pairing Code');

  printInfo('Sending POST request to /api/devices/pairing/request');
  printInfo(`Device Identifier: ${config.deviceId}`);
  printInfo(`Device Nickname: ${config.deviceName}`);

  try {
    const response = await makeRequest(
      `${config.middlewareUrl}/api/devices/pairing/request`,
      'POST',
      {
        deviceIdentifier: config.deviceId,
        nickname: config.deviceName,
        metadata: {
          hostname: config.deviceHostname,
          os: config.deviceOs,
        },
      }
    );

    console.log('\nResponse:');
    console.log(JSON.stringify(response.body, null, 2));

    if (
      !response.body ||
      !response.body.code ||
      response.status >= 400
    ) {
      printError('Failed to generate pairing code');
      console.error('Status:', response.status);
      process.exit(1);
    }

    pairingCode = response.body.code;
    qrCode = response.body.qrCode;
    expiresAt = response.body.expiresAt;
    pairingUrl = response.body.pairingUrl;

    printSuccess('Pairing code generated successfully');
    log(`Pairing Code: ${pairingCode}`, 'green');
    console.log(`Pairing URL: ${pairingUrl}`);
    console.log(`Expires At: ${expiresAt}`);

    if (qrCode) {
      printSuccess('QR code generated');
      printInfo('QR code data saved (too large to display in console)');
    } else {
      printWarning('QR code not available in response');
    }
  } catch (error) {
    printError(`Request failed: ${error.message}`);
    process.exit(1);
  }
}

// Step 2: Check Pairing Status (pending)
async function stepCheckStatusPending() {
  printHeader('Step 2: Check Pairing Status (Pending)');

  printInfo(`Sending GET request to /api/devices/pairing/status/${pairingCode}`);

  try {
    const response = await makeRequest(
      `${config.middlewareUrl}/api/devices/pairing/status/${pairingCode}`
    );

    console.log('\nResponse:');
    console.log(JSON.stringify(response.body, null, 2));

    const status = response.body?.status;

    if (status === 'pending') {
      printSuccess('Pairing status is pending (as expected)');
    } else {
      printWarning(`Expected status 'pending', got: ${status}`);
    }
  } catch (error) {
    printError(`Request failed: ${error.message}`);
  }
}

// Step 3: UI Instructions
async function stepUIInstructions() {
  printHeader('Step 3: Web UI Testing Instructions');

  console.log('To complete the pairing through the web UI, follow these steps:\n');
  console.log('1. Open ' + colors.cyan + config.webUrl + colors.reset + ' in your browser');
  console.log('2. Login with credentials:');
  console.log(`   Email: ${config.email}`);
  console.log(`   Password: ${config.password}`);
  console.log('\n3. Navigate to: Dashboard → Devices → Pair New Device');
  log(`   Or use direct URL: ${config.webUrl}${pairingUrl}`, 'cyan');
  console.log(`\n4. Enter the pairing code: ${colors.green}${pairingCode}${colors.reset}`);
  console.log(`5. Enter device name: ${config.deviceName}`);
  console.log('6. Click "Pair Device" button\n');

  await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      'After completing the UI steps, press ENTER to continue...',
      () => {
        rl.close();
        resolve();
      }
    );
  });
}

// Step 4: Check Pairing Status (paired)
async function stepCheckStatusPaired() {
  printHeader('Step 4: Verify Pairing Status (Paired)');

  printInfo(`Sending GET request to /api/devices/pairing/status/${pairingCode}`);

  try {
    const response = await makeRequest(
      `${config.middlewareUrl}/api/devices/pairing/status/${pairingCode}`
    );

    console.log('\nResponse:');
    console.log(JSON.stringify(response.body, null, 2));

    const status = response.body?.status;

    if (status === 'paired') {
      printSuccess('Device has been paired successfully!');
      console.log(`Device Token: ${response.body.deviceToken}`);
      console.log(`Display ID: ${response.body.deviceId}`);
    } else if (status === 'pending') {
      printWarning(
        'Pairing is still pending. The web UI step may not have been completed.'
      );
    } else {
      printWarning(`Unexpected status: ${status}`);
    }
  } catch (error) {
    printError(`Request failed: ${error.message}`);
  }
}

// Print summary
function printSummary() {
  printHeader('Test Summary');

  console.log('Pairing Flow Test Results:');
  console.log(`- Pairing Code: ${colors.green}${pairingCode}${colors.reset}`);
  console.log(`- Pairing URL: ${config.webUrl}${pairingUrl}`);
  console.log(`- Device ID: ${config.deviceId}`);
  console.log(`- Device Name: ${config.deviceName}`);
  console.log('\nNext steps:');
  console.log(
    '1. If testing through web UI, verify the device appears in Dashboard → Devices'
  );
  console.log('2. Check that the device status is "online"');
  console.log('3. Verify you can assign playlists to the paired device');
  console.log();
}

// Prompt user for web UI test
async function promptForWebUITest() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(
      `\n${colors.yellow}Do you want to test the pairing through the web UI? (y/n) ${colors.reset}`,
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      }
    );
  });
}

// Main execution
async function main() {
  printHeader('Vizora Device Pairing Flow Test');
  console.log('This script will test the complete device pairing flow');
  console.log('Make sure your services are running:');
  console.log(`- Middleware API: ${config.middlewareUrl}`);
  console.log(`- Web App: ${config.webUrl}`);

  // Test connectivity
  await testServiceConnectivity();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 1: Request pairing
  await stepRequestPairing();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Step 2: Check status (pending)
  await stepCheckStatusPending();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Ask if user wants to test UI
  const testUI = await promptForWebUITest();

  if (testUI) {
    await stepUIInstructions();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await stepCheckStatusPaired();
  } else {
    printInfo(`Skipping web UI testing`);
    console.log(`You can manually test through: ${config.webUrl}${pairingUrl}`);
  }

  printSummary();
}

// Run the main function
main().catch((error) => {
  printError(`Fatal error: ${error.message}`);
  process.exit(1);
});
