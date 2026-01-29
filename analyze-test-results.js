const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'test-results', 'results.json');

if (!fs.existsSync(resultsPath)) {
  console.log('❌ No test results found. Run tests first.');
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  flaky: 0,
};

const failedTests = [];
const suites = {};

results.suites.forEach(suite => {
  const suiteName = suite.title || suite.file;
  suites[suiteName] = { passed: 0, failed: 0, total: 0 };
  
  suite.specs.forEach(spec => {
    spec.tests.forEach(test => {
      stats.total++;
      suites[suiteName].total++;
      
      const lastResult = test.results[test.results.length - 1];
      
      if (test.results.some(r => r.status === 'passed')) {
        stats.passed++;
        suites[suiteName].passed++;
        if (test.results.length > 1) {
          stats.flaky++;
        }
      } else if (lastResult.status === 'failed') {
        stats.failed++;
        suites[suiteName].failed++;
        failedTests.push({
          suite: suiteName,
          test: spec.title,
          error: lastResult.error?.message || 'Unknown error',
        });
      } else if (lastResult.status === 'skipped') {
        stats.skipped++;
      }
    });
  });
});

console.log('\n📊 Test Results Summary\n');
console.log(`Total Tests: ${stats.total}`);
console.log(`✅ Passed: ${stats.passed} (${((stats.passed / stats.total) * 100).toFixed(1)}%)`);
console.log(`❌ Failed: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)`);
console.log(`⏭️  Skipped: ${stats.skipped}`);
if (stats.flaky > 0) {
  console.log(`⚠️  Flaky: ${stats.flaky}`);
}

console.log('\n📦 By Test Suite:\n');
Object.entries(suites).forEach(([name, suite]) => {
  const passRate = ((suite.passed / suite.total) * 100).toFixed(0);
  const icon = suite.failed === 0 ? '✅' : '⚠️';
  console.log(`${icon} ${name}: ${suite.passed}/${suite.total} (${passRate}%)`);
});

if (failedTests.length > 0) {
  console.log('\n❌ Failed Tests:\n');
  failedTests.forEach(({ suite, test, error }) => {
    console.log(`${suite} → ${test}`);
    console.log(`   ${error.split('\n')[0]}\n`);
  });
}

console.log('\n📈 Platform Coverage Estimate:');
const coverage = (stats.passed / stats.total) * 100;
console.log(`${coverage.toFixed(1)}% of planned UI flows tested and working`);

if (coverage >= 70) {
  console.log('✅ Target coverage (70%) achieved!');
} else if (coverage >= 65) {
  console.log('⚠️  Near target (65-70%), needs minor fixes');
} else {
  console.log('❌ Below target, significant issues found');
}
