/**
 * Combined Load Test: 100 Concurrent Devices + 1000 API requests/sec
 * 
 * Runs both WebSocket and API load tests simultaneously.
 */

import { LoadTestRunner } from './load-test';
import type { LoadTestConfig } from './load-test';
import { ApiLoadTestRunner } from './api-load-test';
import type { ApiLoadTestConfig } from './api-load-test';

interface CombinedLoadTestConfig {
  serverUrl: string;
  apiBaseUrl: string;
  deviceCount: number;
  targetRps: number;
  testDuration: number;
}

class CombinedLoadTestRunner {
  private config: CombinedLoadTestConfig;

  constructor(config: CombinedLoadTestConfig) {
    this.config = config;
  }

  async run(): Promise<void> {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(16) + 'VIZORA COMBINED LOAD TEST' + ' '.repeat(37) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log('\n🎯 Running simultaneous tests:');
    console.log(`   • ${this.config.deviceCount} concurrent WebSocket devices`);
    console.log(`   • ${this.config.targetRps} API requests/second`);
    console.log(`   • Duration: ${this.config.testDuration / 1000}s\n`);

    const startTime = Date.now();

    // Configure WebSocket load test
    const wsConfig: LoadTestConfig = {
      serverUrl: this.config.serverUrl,
      deviceCount: this.config.deviceCount,
      heartbeatInterval: 15000,
      testDuration: this.config.testDuration,
      rampUpTime: 10000,
    };

    // Configure API load test
    const apiConfig: ApiLoadTestConfig = {
      baseUrl: this.config.apiBaseUrl,
      targetRps: this.config.targetRps,
      testDuration: this.config.testDuration,
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          weight: 0.3,
        },
        {
          method: 'GET',
          path: '/api/devices/test-device-001/status',
          weight: 0.2,
        },
        {
          method: 'GET',
          path: '/api/playlists/test-playlist-001',
          weight: 0.2,
        },
        {
          method: 'POST',
          path: '/api/devices/test-device-001/config',
          weight: 0.15,
          body: { setting: 'value' },
        },
        {
          method: 'POST',
          path: '/api/devices/test-device-001/command',
          weight: 0.15,
          body: { type: 'reload' },
        },
      ],
    };

    // Run both tests in parallel
    const wsRunner = new LoadTestRunner(wsConfig);
    const apiRunner = new ApiLoadTestRunner(apiConfig);

    console.log('🚀 Starting both load tests...\n');

    try {
      await Promise.all([
        wsRunner.run(),
        apiRunner.run(),
      ]);

      const totalDuration = (Date.now() - startTime) / 1000;

      console.log('\n' + '='.repeat(80));
      console.log('🎉 COMBINED LOAD TEST COMPLETE');
      console.log('='.repeat(80));
      console.log(`\n⏱️  Total Duration: ${totalDuration.toFixed(1)}s`);
      console.log('\n✅ Both WebSocket and API tests completed successfully!');
      console.log('   Check individual test results above for detailed metrics.\n');
    } catch (error) {
      console.error('\n❌ Combined load test failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const config: CombinedLoadTestConfig = {
    serverUrl: process.env.WS_SERVER_URL || 'http://localhost:3000',
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    deviceCount: parseInt(process.env.DEVICE_COUNT || '100', 10),
    targetRps: parseInt(process.env.TARGET_RPS || '1000', 10),
    testDuration: parseInt(process.env.TEST_DURATION || '60000', 10),
  };

  const runner = new CombinedLoadTestRunner(config);
  await runner.run();

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { CombinedLoadTestRunner };
export type { CombinedLoadTestConfig };
