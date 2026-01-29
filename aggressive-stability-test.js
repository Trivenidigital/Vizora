const axios = require('axios');

// Test Configuration
const TOTAL_REQUESTS = 200; // Much more aggressive
const CONCURRENT_BATCHES = 10; // 10 requests at once
const TEST_DURATION_MINUTES = 3;

let stats = {
  register: { success: 0, fail: 0, errors: {} },
  login: { success: 0, fail: 0, errors: {} },
  total: 0,
  startTime: Date.now()
};

function trackError(category, error) {
  const key = error.response?.status || error.code || 'unknown';
  if (!stats[category].errors[key]) {
    stats[category].errors[key] = 0;
  }
  stats[category].errors[key]++;
}

async function testRegister(index) {
  try {
    await axios.post('http://localhost:3000/api/auth/register', {
      email: `stress-${Date.now()}-${index}-${Math.random()}@test.com`,
      password: 'Test123!@#',
      firstName: 'Stress',
      lastName: `User${index}`,
      organizationName: `Stress Org ${index}`
    }, { timeout: 10000 });
    
    stats.register.success++;
    return true;
  } catch (error) {
    stats.register.fail++;
    trackError('register', error);
    return false;
  }
}

async function testLogin(email, password) {
  try {
    await axios.post('http://localhost:3000/api/auth/login', {
      email,
      password
    }, { timeout: 10000 });
    
    stats.login.success++;
    return true;
  } catch (error) {
    stats.login.fail++;
    trackError('login', error);
    return false;
  }
}

async function checkHealth() {
  try {
    const response = await axios.get('http://localhost:3000/api/health', { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

function printProgress() {
  const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  const rps = (stats.total / (elapsed || 1)).toFixed(1);
  
  console.log(`\n⏱️  [${elapsed}s] Progress:`);
  console.log(`   Register: ${stats.register.success}✅ ${stats.register.fail}❌`);
  console.log(`   Login: ${stats.login.success}✅ ${stats.login.fail}❌`);
  console.log(`   Rate: ${rps} req/s`);
}

async function aggressiveTest() {
  console.log('🔥 AGGRESSIVE STABILITY TEST');
  console.log('===============================================');
  console.log(`Target: ${TOTAL_REQUESTS} requests`);
  console.log(`Concurrency: ${CONCURRENT_BATCHES} simultaneous requests`);
  console.log(`Duration: Up to ${TEST_DURATION_MINUTES} minutes`);
  console.log('===============================================\n');
  
  // Initial health check
  console.log('🏥 Initial health check...');
  if (!await checkHealth()) {
    console.error('❌ Middleware is not responding! Aborting test.');
    process.exit(1);
  }
  console.log('✅ Middleware is healthy\n');
  
  const progressInterval = setInterval(printProgress, 5000);
  
  try {
    // Phase 1: Registration stress test
    console.log('📝 Phase 1: Registration Stress Test');
    const registerPromises = [];
    
    for (let i = 0; i < TOTAL_REQUESTS; i++) {
      registerPromises.push(testRegister(i));
      stats.total++;
      
      // Send in batches to simulate concurrent users
      if ((i + 1) % CONCURRENT_BATCHES === 0) {
        await Promise.all(registerPromises.splice(0, CONCURRENT_BATCHES));
        await new Promise(r => setTimeout(r, 50)); // Small breathing room
      }
    }
    
    // Wait for remaining
    await Promise.all(registerPromises);
    
    console.log('\n✅ Phase 1 Complete\n');
    
    // Phase 2: Login stress test (using successful registrations)
    console.log('🔐 Phase 2: Login Stress Test');
    const loginPromises = [];
    const loginCount = Math.min(100, stats.register.success);
    
    for (let i = 0; i < loginCount; i++) {
      loginPromises.push(testLogin(`stress-test-${i}@test.com`, 'Test123!@#'));
      stats.total++;
      
      if ((i + 1) % CONCURRENT_BATCHES === 0) {
        await Promise.all(loginPromises.splice(0, CONCURRENT_BATCHES));
        await new Promise(r => setTimeout(r, 50));
      }
    }
    
    await Promise.all(loginPromises);
    
    console.log('\n✅ Phase 2 Complete\n');
    
  } finally {
    clearInterval(progressInterval);
  }
  
  // Final health check
  console.log('🏥 Final health check...');
  const stillAlive = await checkHealth();
  
  // Print final results
  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
  const avgRps = (stats.total / duration).toFixed(1);
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════');
  console.log('         FINAL STABILITY TEST RESULTS          ');
  console.log('═══════════════════════════════════════════════');
  console.log(`Duration: ${duration}s`);
  console.log(`Total Requests: ${stats.total}`);
  console.log(`Average Rate: ${avgRps} req/s`);
  console.log('');
  console.log('📝 REGISTRATION:');
  console.log(`   Success: ${stats.register.success} (${((stats.register.success/(stats.register.success + stats.register.fail))*100).toFixed(1)}%)`);
  console.log(`   Failed: ${stats.register.fail}`);
  if (Object.keys(stats.register.errors).length > 0) {
    console.log('   Errors:', JSON.stringify(stats.register.errors, null, 2));
  }
  console.log('');
  console.log('🔐 LOGIN:');
  console.log(`   Success: ${stats.login.success} (${stats.login.success > 0 ? ((stats.login.success/(stats.login.success + stats.login.fail))*100).toFixed(1) : 0}%)`);
  console.log(`   Failed: ${stats.login.fail}`);
  if (Object.keys(stats.login.errors).length > 0) {
    console.log('   Errors:', JSON.stringify(stats.login.errors, null, 2));
  }
  console.log('');
  console.log(`🏥 MIDDLEWARE STATUS: ${stillAlive ? '✅ STILL ALIVE' : '❌ CRASHED'}`);
  console.log('═══════════════════════════════════════════════');
  
  if (!stillAlive) {
    console.error('\n❌ CRITICAL: Middleware crashed during stress test!');
    console.error('   This is a production blocker.');
    process.exit(1);
  }
  
  if (stats.register.fail + stats.login.fail > stats.total * 0.1) {
    console.warn('\n⚠️  WARNING: >10% failure rate detected');
    console.warn('   Middleware may not be production ready');
  } else {
    console.log('\n🎉 SUCCESS: Middleware is stable under load!');
    console.log('   Ready for E2E testing');
  }
}

aggressiveTest().catch(error => {
  console.error('\n💥 TEST CRASHED:', error.message);
  process.exit(1);
});
