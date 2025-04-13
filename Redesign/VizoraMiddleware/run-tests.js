/**
 * Test runner script to run each test file individually
 * Helps avoid memory issues by isolating test execution
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');

const readdir = util.promisify(fs.readdir);
const stat = util.promisify(fs.stat);

// Memory optimization settings
const NODE_OPTIONS = '--max-old-space-size=2048 --expose-gc';

// Configuration
const TEST_DIRECTORY = './tests';
const IGNORE_DIRECTORIES = ['helpers', 'fixtures', 'mocks'];
const BATCH_SIZE = 3; // Number of test files to run in parallel
const TEST_TIMEOUT = 120000; // 2 minutes timeout per test file

/**
 * Find all test files recursively
 */
async function findTestFiles(directory) {
  const entries = await readdir(directory);
  const files = [];
  
  for (const entry of entries) {
    if (IGNORE_DIRECTORIES.includes(entry)) continue;
    
    const fullPath = path.join(directory, entry);
    const stats = await stat(fullPath);
    
    if (stats.isDirectory()) {
      const nestedFiles = await findTestFiles(fullPath);
      files.push(...nestedFiles);
    } else if (entry.endsWith('.test.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Run a single test file with proper memory settings
 */
function runTestFile(testFile) {
  return new Promise((resolve) => {
    console.log(`\n\n========== Running test: ${testFile} ==========\n`);
    
    // Convert Windows paths to Unix format for Jest
    const normalizedPath = testFile.replace(/\\/g, '/');
    
    const env = { ...process.env, NODE_OPTIONS };
    const child = spawn('npx', ['jest', normalizedPath, '--runInBand', '--detectOpenHandles'], { 
      env,
      stdio: 'inherit',
      shell: true
    });
    
    // Set timeout to avoid hanging tests
    const timeout = setTimeout(() => {
      console.error(`\n⚠️ Test timed out after ${TEST_TIMEOUT/1000} seconds: ${testFile}`);
      child.kill('SIGTERM');
      resolve({ file: testFile, success: false, timedOut: true });
    }, TEST_TIMEOUT);
    
    child.on('exit', (code) => {
      clearTimeout(timeout);
      const success = code === 0;
      console.log(`\n${success ? '✅' : '❌'} Test ${success ? 'passed' : 'failed'}: ${testFile}\n`);
      resolve({ file: testFile, success, code });
    });
  });
}

/**
 * Run tests in batches to control memory usage
 */
async function runTestsInBatches(testFiles) {
  const results = {
    passed: [],
    failed: [],
    timedOut: []
  };
  
  // Process files in batches
  for (let i = 0; i < testFiles.length; i += BATCH_SIZE) {
    const batch = testFiles.slice(i, i + BATCH_SIZE);
    console.log(`\nRunning batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(testFiles.length/BATCH_SIZE)}`);
    
    const batchResults = await Promise.all(batch.map(file => runTestFile(file)));
    
    // Categorize results
    batchResults.forEach(result => {
      if (result.timedOut) {
        results.timedOut.push(result.file);
      } else if (result.success) {
        results.passed.push(result.file);
      } else {
        results.failed.push(result.file);
      }
    });
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('\nForcing garbage collection between batches...');
      global.gc();
    }
  }
  
  return results;
}

/**
 * Main function to run all tests
 */
async function runAllTests() {
  console.log('Finding test files...');
  const testFiles = await findTestFiles(TEST_DIRECTORY);
  console.log(`Found ${testFiles.length} test files to run`);
  
  console.log('Running tests with memory optimization...');
  const startTime = Date.now();
  const results = await runTestsInBatches(testFiles);
  const duration = (Date.now() - startTime) / 1000;
  
  // Print summary
  console.log('\n============= TEST SUMMARY =============');
  console.log(`Total test files: ${testFiles.length}`);
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Timed out: ${results.timedOut.length}`);
  console.log(`Total duration: ${duration.toFixed(2)} seconds`);
  
  if (results.failed.length > 0) {
    console.log('\nFailed tests:');
    results.failed.forEach(file => console.log(`- ${file}`));
  }
  
  if (results.timedOut.length > 0) {
    console.log('\nTimed out tests:');
    results.timedOut.forEach(file => console.log(`- ${file}`));
  }
  
  // Exit with appropriate code
  process.exit(results.failed.length > 0 || results.timedOut.length > 0 ? 1 : 0);
}

// Run the tests
runAllTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 