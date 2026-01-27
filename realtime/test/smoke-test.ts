/**
 * Smoke Test: Quick validation before full load tests
 * 
 * Tests with minimal load (5 devices, 50 RPS for 10 seconds)
 */

import { LoadTestRunner } from './load-test';
import type { LoadTestConfig } from './load-test';
import { ApiLoadTestRunner } from './api-load-test';
import type { ApiLoadTestConfig } from './api-load-test';

async function runSmokeTest() {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(22) + 'SMOKE TEST' + ' '.repeat(46) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('\n🔍 Quick validation with minimal load...\n');

  // WebSocket smoke test
  console.log('1️⃣  Testing WebSocket with 5 devices...\n');
  
  const wsConfig: LoadTestConfig = {
    serverUrl: process.env.SERVER_URL || 'http://localhost:3000',
    deviceCount: 5,
    heartbeatInterval: 5000,
    testDuration: 10000,
    rampUpTime: 2000,
  };

  try {
    const wsRunner = new LoadTestRunner(wsConfig);
    await wsRunner.run();
    console.log('✅ WebSocket test passed!\n');
  } catch (error) {
    console.error('❌ WebSocket test failed:', error);
    process.exit(1);
  }

  // API smoke test
  console.log('2️⃣  Testing API with 50 RPS...\n');

  const apiConfig: ApiLoadTestConfig = {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    targetRps: 50,
    testDuration: 10000,
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        weight: 1.0,
      },
    ],
  };

  try {
    const apiRunner = new ApiLoadTestRunner(apiConfig);
    await apiRunner.run();
    console.log('✅ API test passed!\n');
  } catch (error) {
    console.error('❌ API test failed:', error);
    process.exit(1);
  }

  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(26) + '✅ SMOKE TEST PASSED' + ' '.repeat(32) + '║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log('\n🚀 System ready for full load testing!\n');
}

runSmokeTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
