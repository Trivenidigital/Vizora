/**
 * API Load Test: 1000 requests/sec
 * 
 * This script stress-tests the REST API endpoints with high concurrency.
 */

import axios, { AxiosInstance } from 'axios';

interface ApiLoadTestConfig {
  baseUrl: string;
  targetRps: number; // requests per second
  testDuration: number; // ms
  endpoints: EndpointConfig[];
}

interface EndpointConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  weight: number; // probability weight (0-1)
  body?: any;
  headers?: Record<string, string>;
}

interface RequestMetrics {
  endpoint: string;
  method: string;
  statusCode: number;
  latency: number;
  timestamp: number;
  error?: string;
}

class ApiLoadTestRunner {
  private config: ApiLoadTestConfig;
  private client: AxiosInstance;
  private metrics: RequestMetrics[] = [];
  private requestCount = 0;
  private errorCount = 0;
  private startTime = 0;
  private isRunning = false;

  constructor(config: ApiLoadTestConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      validateStatus: () => true, // Don't throw on any status code
    });
  }

  /**
   * Select endpoint based on weights
   */
  private selectEndpoint(): EndpointConfig {
    const totalWeight = this.config.endpoints.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;

    for (const endpoint of this.config.endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }

    return this.config.endpoints[0];
  }

  /**
   * Make a single API request
   */
  private async makeRequest(): Promise<void> {
    const endpoint = this.selectEndpoint();
    const startTime = Date.now();

    try {
      const response = await this.client.request({
        method: endpoint.method,
        url: endpoint.path,
        data: endpoint.body,
        headers: endpoint.headers,
      });

      const latency = Date.now() - startTime;

      this.metrics.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        statusCode: response.status,
        latency,
        timestamp: Date.now(),
      });

      this.requestCount++;

      if (response.status >= 400) {
        this.errorCount++;
      }
    } catch (error: any) {
      const latency = Date.now() - startTime;

      this.metrics.push({
        endpoint: endpoint.path,
        method: endpoint.method,
        statusCode: 0,
        latency,
        timestamp: Date.now(),
        error: error.message,
      });

      this.requestCount++;
      this.errorCount++;
    }
  }

  /**
   * Request generation loop
   */
  private async requestLoop(): Promise<void> {
    const requestsPerBatch = Math.ceil(this.config.targetRps / 10); // 10 batches per second
    const delayBetweenBatches = 100; // ms

    while (this.isRunning) {
      const batchStart = Date.now();

      // Fire batch of concurrent requests
      const promises = [];
      for (let i = 0; i < requestsPerBatch; i++) {
        promises.push(this.makeRequest());
      }

      await Promise.all(promises);

      // Wait to maintain target RPS
      const batchDuration = Date.now() - batchStart;
      const delay = Math.max(0, delayBetweenBatches - batchDuration);

      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Display live progress
   */
  private displayProgress(): NodeJS.Timeout {
    return setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const currentRps = this.requestCount / elapsed;
      const errorRate = this.errorCount / this.requestCount;

      const recentMetrics = this.metrics.slice(-100);
      const avgLatency = recentMetrics.length > 0
        ? recentMetrics.reduce((sum, m) => sum + m.latency, 0) / recentMetrics.length
        : 0;

      process.stdout.write(
        `\r⚡ RPS: ${currentRps.toFixed(0)}/${this.config.targetRps} | ` +
        `Requests: ${this.requestCount} | ` +
        `Errors: ${this.errorCount} (${(errorRate * 100).toFixed(1)}%) | ` +
        `Latency: ${avgLatency.toFixed(0)}ms`
      );
    }, 1000);
  }

  /**
   * Calculate and display statistics
   */
  private displayStats(): void {
    const testDuration = (Date.now() - this.startTime) / 1000;
    const actualRps = this.requestCount / testDuration;

    // Status code distribution
    const statusCodes = new Map<number, number>();
    this.metrics.forEach((m) => {
      statusCodes.set(m.statusCode, (statusCodes.get(m.statusCode) || 0) + 1);
    });

    // Latency stats
    const latencies = this.metrics.map((m) => m.latency).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    const p50Latency = latencies[Math.floor(latencies.length * 0.5)];
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

    // Endpoint breakdown
    const endpointStats = new Map<string, { count: number; totalLatency: number }>();
    this.metrics.forEach((m) => {
      const key = `${m.method} ${m.endpoint}`;
      const stats = endpointStats.get(key) || { count: 0, totalLatency: 0 };
      stats.count++;
      stats.totalLatency += m.latency;
      endpointStats.set(key, stats);
    });

    console.log('\n\n' + '='.repeat(80));
    console.log('📊 API LOAD TEST RESULTS');
    console.log('='.repeat(80));

    console.log(`\n⚡ Throughput:`);
    console.log(`   Target RPS:           ${this.config.targetRps}`);
    console.log(`   Actual RPS:           ${actualRps.toFixed(1)}`);
    console.log(`   Achievement:          ${((actualRps / this.config.targetRps) * 100).toFixed(1)}%`);
    console.log(`   Total Requests:       ${this.requestCount}`);

    console.log(`\n⏱️  Latency:`);
    console.log(`   Average:              ${avgLatency.toFixed(0)}ms`);
    console.log(`   Min:                  ${minLatency.toFixed(0)}ms`);
    console.log(`   Max:                  ${maxLatency.toFixed(0)}ms`);
    console.log(`   P50 (median):         ${p50Latency.toFixed(0)}ms`);
    console.log(`   P95:                  ${p95Latency.toFixed(0)}ms`);
    console.log(`   P99:                  ${p99Latency.toFixed(0)}ms`);

    console.log(`\n✅ Status Codes:`);
    Array.from(statusCodes.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([code, count]) => {
        const percentage = ((count / this.requestCount) * 100).toFixed(1);
        const emoji = code >= 200 && code < 300 ? '✅' : code >= 400 ? '❌' : '⚠️';
        console.log(`   ${emoji} ${code}:${' '.repeat(20 - code.toString().length)}${count} (${percentage}%)`);
      });

    console.log(`\n📡 Endpoint Breakdown:`);
    Array.from(endpointStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([endpoint, stats]) => {
        const avgLatency = stats.totalLatency / stats.count;
        const percentage = ((stats.count / this.requestCount) * 100).toFixed(1);
        console.log(`   ${endpoint}`);
        console.log(`      Requests: ${stats.count} (${percentage}%) | Avg Latency: ${avgLatency.toFixed(0)}ms`);
      });

    console.log(`\n❌ Errors:`);
    console.log(`   Total Errors:         ${this.errorCount}`);
    console.log(`   Error Rate:           ${((this.errorCount / this.requestCount) * 100).toFixed(2)}%`);

    console.log(`\n⏱️  Duration:`);
    console.log(`   Test Duration:        ${testDuration.toFixed(1)}s`);

    console.log('\n' + '='.repeat(80) + '\n');
  }

  /**
   * Run the load test
   */
  async run(): Promise<void> {
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log('║' + ' '.repeat(18) + 'VIZORA API LOAD TEST' + ' '.repeat(40) + '║');
    console.log('╚' + '═'.repeat(78) + '╝');
    console.log(`\n📋 Configuration:`);
    console.log(`   Base URL:             ${this.config.baseUrl}`);
    console.log(`   Target RPS:           ${this.config.targetRps}`);
    console.log(`   Test Duration:        ${this.config.testDuration / 1000}s`);
    console.log(`   Endpoints:            ${this.config.endpoints.length}`);
    console.log('');

    this.startTime = Date.now();
    this.isRunning = true;

    // Start progress display
    const progressTimer = this.displayProgress();

    // Start request generation
    const loopPromise = this.requestLoop();

    // Run for test duration
    await new Promise((resolve) => setTimeout(resolve, this.config.testDuration));

    // Stop
    this.isRunning = false;
    await loopPromise;
    clearInterval(progressTimer);

    // Display results
    this.displayStats();
  }
}

// Main execution
async function main() {
  const config: ApiLoadTestConfig = {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    targetRps: parseInt(process.env.TARGET_RPS || '1000', 10),
    testDuration: parseInt(process.env.TEST_DURATION || '60000', 10),
    endpoints: [
      // Health check
      {
        method: 'GET',
        path: '/health',
        weight: 0.3,
      },
      // Get device status (simulated)
      {
        method: 'GET',
        path: '/api/devices/test-device-001/status',
        weight: 0.2,
      },
      // Get playlist (simulated)
      {
        method: 'GET',
        path: '/api/playlists/test-playlist-001',
        weight: 0.2,
      },
      // Update device config (simulated)
      {
        method: 'POST',
        path: '/api/devices/test-device-001/config',
        weight: 0.15,
        body: {
          setting: 'value',
        },
      },
      // Send command (simulated)
      {
        method: 'POST',
        path: '/api/devices/test-device-001/command',
        weight: 0.15,
        body: {
          type: 'reload',
        },
      },
    ],
  };

  const runner = new ApiLoadTestRunner(config);
  await runner.run();

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ApiLoadTestRunner };
export type { ApiLoadTestConfig };
