#!/usr/bin/env node

/**
 * Verify E2E test setup is ready
 */

const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

console.log('🔍 Verifying E2E Test Setup...\n');

let allOk = true;

// Check if test directory exists
console.log('📁 Checking test directory...');
if (fs.existsSync(path.join(__dirname, 'test'))) {
  console.log('✅ test/ directory exists');
} else {
  console.log('❌ test/ directory not found');
  allOk = false;
}

// Check if test files exist
console.log('\n📄 Checking test files...');
const requiredFiles = [
  'test/device-gateway.e2e-spec.ts',
  'test/setup.ts',
  'test/README.md',
  'jest.e2e.config.js',
  '.env.test'
];

requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} not found`);
    allOk = false;
  }
});

// Check Redis connection
console.log('\n🗄️  Checking Redis connection...');
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: () => null,
  lazyConnect: true,
});

redis.connect()
  .then(() => {
    console.log('✅ Redis is running and accessible');
    return redis.ping();
  })
  .then(() => {
    console.log('✅ Redis PING successful');
    return redis.quit();
  })
  .then(() => {
    console.log('\n' + (allOk ? '🎉 All checks passed! Ready to run tests.' : '⚠️  Some checks failed. See above.'));
    console.log('\n📝 To run tests:');
    console.log('   pnpm test:e2e         # Run all tests');
    console.log('   pnpm test:e2e:watch   # Watch mode');
    console.log('   pnpm test:e2e:cov     # With coverage');
    process.exit(allOk ? 0 : 1);
  })
  .catch((error) => {
    console.log('❌ Redis connection failed:', error.message);
    console.log('\n⚠️  Redis is required for E2E tests!');
    console.log('\n📝 To start Redis:');
    console.log('   # Via Docker:');
    console.log('   docker run -d -p 6379:6379 redis:7-alpine');
    console.log('   ');
    console.log('   # Via WSL:');
    console.log('   wsl redis-server');
    console.log('   ');
    console.log('   # Or install Redis for Windows');
    redis.disconnect();
    process.exit(1);
  });
