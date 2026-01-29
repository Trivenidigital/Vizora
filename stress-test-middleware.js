const axios = require('axios');

let successCount = 0;
let errorCount = 0;
const errors = [];

async function register(index) {
  try {
    const response = await axios.post('http://localhost:3000/api/auth/register', {
      email: `stress-test-${Date.now()}-${index}@test.com`,
      password: 'Test123!@#',
      firstName: 'Stress',
      lastName: `User${index}`,
      organizationName: `Stress Org ${index}`
    });
    
    successCount++;
    if (successCount % 10 === 0) {
      console.log(`✅ ${successCount} registrations successful`);
    }
    return true;
  } catch (error) {
    errorCount++;
    errors.push({
      index,
      error: error.message,
      code: error.code,
      status: error.response?.status
    });
    console.error(`❌ Registration ${index} failed:`, error.message);
    return false;
  }
}

async function runStressTest() {
  console.log('🔥 Starting stress test - 50 rapid registrations');
  console.log('This simulates the load from running E2E tests\n');
  
  const startTime = Date.now();
  
  // Run 50 registrations in parallel (simulating test load)
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(register(i));
    
    // Small delay between starts to avoid overwhelming
    if (i % 5 === 0) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  
  await Promise.all(promises);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n📊 STRESS TEST RESULTS:');
  console.log(`Duration: ${duration}s`);
  console.log(`Success: ${successCount}/50`);
  console.log(`Errors: ${errorCount}/50`);
  console.log(`Pass Rate: ${((successCount/50)*100).toFixed(1)}%`);
  
  if (errors.length > 0) {
    console.log('\n❌ Error Summary:');
    const errorTypes = {};
    errors.forEach(e => {
      const key = e.code || e.status || 'unknown';
      errorTypes[key] = (errorTypes[key] || 0) + 1;
    });
    Object.entries(errorTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });
    
    console.log('\n📝 First 3 errors:');
    errors.slice(0, 3).forEach(e => {
      console.log(`  [${e.index}] ${e.error}`);
    });
  }
  
  // Check if middleware is still responding
  console.log('\n🔍 Checking if middleware is still alive...');
  try {
    await axios.get('http://localhost:3000/api/health');
    console.log('✅ Middleware still responding to health checks');
  } catch (error) {
    console.error('❌ Middleware is DOWN! This is the issue!');
    console.error('   Error:', error.message);
  }
}

runStressTest().catch(console.error);
