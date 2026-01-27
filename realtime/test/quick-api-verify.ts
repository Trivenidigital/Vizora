/**
 * Quick API P95 Latency Verification
 */

import axios, { AxiosInstance } from 'axios';

async function verifyP95Latency() {
  const baseUrl = 'http://localhost:3001';
  const targetRps = 1000;
  const testDuration = 30000; // 30 seconds
  
  const client: AxiosInstance = axios.create({
    baseURL: baseUrl,
    timeout: 30000,
    validateStatus: () => true,
  });

  const latencies: number[] = [];
  const startTime = Date.now();
  let requestCount = 0;
  let successCount = 0;
  let errorCount = 0;

  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║' + ' '.repeat(22) + 'P95 LATENCY VERIFICATION' + ' '.repeat(32) + '║');
  console.log('╚' + '═'.repeat(78) + '╝\n');
  console.log(`🎯 Target: P95 latency < 200ms`);
  console.log(`📍 Endpoint: ${baseUrl}/api/health`);
  console.log(`⚡ Target RPS: ${targetRps}`);
  console.log(`⏱️  Duration: ${testDuration/1000}s\n`);
  console.log('Testing...\n');

  const requestsPerBatch = Math.ceil(targetRps / 10);
  const delayBetweenBatches = 100;

  let isRunning = true;
  setTimeout(() => { isRunning = false; }, testDuration);

  while (isRunning) {
    const batchStart = Date.now();
    const promises = [];

    for (let i = 0; i < requestsPerBatch; i++) {
      promises.push((async () => {
        const reqStart = Date.now();
        try {
          const response = await client.get('/api/health');
          const latency = Date.now() - reqStart;
          latencies.push(latency);
          requestCount++;
          
          if (response.status >= 200 && response.status < 400) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          const latency = Date.now() - reqStart;
          latencies.push(latency);
          requestCount++;
          errorCount++;
        }
      })());
    }

    await Promise.all(promises);

    const batchDuration = Date.now() - batchStart;
    const delay = Math.max(0, delayBetweenBatches - batchDuration);
    if (delay > 0 && isRunning) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  const totalDuration = (Date.now() - startTime) / 1000;
  const actualRps = requestCount / totalDuration;

  // Calculate latency percentiles
  latencies.sort((a, b) => a - b);
  const avg = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  const min = Math.min(...latencies);
  const max = Math.max(...latencies);
  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  console.log('═'.repeat(80));
  console.log('📊 RESULTS\n');
  
  console.log(`⚡ Throughput:`);
  console.log(`   Target RPS:           ${targetRps}`);
  console.log(`   Actual RPS:           ${actualRps.toFixed(1)}`);
  console.log(`   Total Requests:       ${requestCount}`);
  console.log(`   Success Rate:         ${((successCount/requestCount)*100).toFixed(1)}%\n`);

  console.log(`⏱️  Latency:`);
  console.log(`   Average:              ${avg.toFixed(0)}ms`);
  console.log(`   Min:                  ${min}ms`);
  console.log(`   Max:                  ${max}ms`);
  console.log(`   P50 (median):         ${p50}ms`);
  console.log(`   P95:                  ${p95}ms ` + (p95 < 200 ? '✅' : '❌'));
  console.log(`   P99:                  ${p99}ms\n`);

  console.log('═'.repeat(80));
  console.log(`\n${p95 < 200 ? '✅ PASSED' : '❌ FAILED'}: P95 latency is ${p95}ms (target: <200ms)`);
  console.log(`   Margin: ${200 - p95}ms below target\n`);

  process.exit(p95 < 200 ? 0 : 1);
}

verifyP95Latency().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
