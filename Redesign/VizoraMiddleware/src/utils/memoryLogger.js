/**
 * Memory monitoring utility for tracking and logging memory usage
 * Helps identify potential memory leaks in the application
 */

/**
 * Convert bytes to human-readable format (MB with decimal precision)
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Decimal precision (default: 2)
 * @returns {string} Human-readable size with MB unit
 */
const formatMemoryUsage = (bytes, decimals = 2) => {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(decimals)} MB`;
};

/**
 * Get current memory usage statistics
 * @returns {object} Object containing memory stats in bytes and formatted
 */
const getMemoryUsage = () => {
  const memoryUsage = process.memoryUsage();
  
  // Return both raw values and formatted values
  return {
    raw: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
      arrayBuffers: memoryUsage.arrayBuffers
    },
    formatted: {
      rss: formatMemoryUsage(memoryUsage.rss),
      heapTotal: formatMemoryUsage(memoryUsage.heapTotal),
      heapUsed: formatMemoryUsage(memoryUsage.heapUsed),
      external: formatMemoryUsage(memoryUsage.external),
      arrayBuffers: formatMemoryUsage(memoryUsage.arrayBuffers)
    }
  };
};

/**
 * Log current memory usage with optional context info
 * @param {string} context - Context information (e.g., function name)
 * @param {object} additionalInfo - Any additional information to log
 */
const logMemoryUsage = (context = 'General memory check', additionalInfo = {}) => {
  const memoryUsage = getMemoryUsage();
  
  console.log(`\n=== MEMORY USAGE [${context}] ===`);
  console.log(`RSS (total memory): ${memoryUsage.formatted.rss}`);
  console.log(`Heap Total: ${memoryUsage.formatted.heapTotal}`);
  console.log(`Heap Used: ${memoryUsage.formatted.heapUsed}`);
  console.log(`External: ${memoryUsage.formatted.external}`);
  console.log(`Array Buffers: ${memoryUsage.formatted.arrayBuffers}`);
  
  if (Object.keys(additionalInfo).length > 0) {
    console.log('Additional info:', additionalInfo);
  }
  
  // Alert if memory usage is high (over 3000 MB heap)
  if (memoryUsage.raw.heapUsed > 3000 * 1024 * 1024) {
    console.warn('\n⚠️ WARNING: High memory usage detected! Consider garbage collection.');
    
    // If garbage collection is available, suggest running it
    if (global.gc) {
      console.log('Suggestion: Run global.gc() to force garbage collection');
    }
  }
  
  return memoryUsage;
};

/**
 * Create a diff between two memory snapshots to track changes
 * @param {object} before - Memory usage before operation
 * @param {object} after - Memory usage after operation
 * @returns {object} Differences in memory usage
 */
const getMemoryDiff = (before, after) => {
  return {
    raw: {
      rss: after.raw.rss - before.raw.rss,
      heapTotal: after.raw.heapTotal - before.raw.heapTotal,
      heapUsed: after.raw.heapUsed - before.raw.heapUsed,
      external: after.raw.external - before.raw.external,
      arrayBuffers: after.raw.arrayBuffers - before.raw.arrayBuffers
    },
    formatted: {
      rss: formatMemoryUsage(after.raw.rss - before.raw.rss),
      heapTotal: formatMemoryUsage(after.raw.heapTotal - before.raw.heapTotal),
      heapUsed: formatMemoryUsage(after.raw.heapUsed - before.raw.heapUsed),
      external: formatMemoryUsage(after.raw.external - before.raw.external),
      arrayBuffers: formatMemoryUsage(after.raw.arrayBuffers - before.raw.arrayBuffers)
    }
  };
};

/**
 * Log memory usage before and after an operation
 * @param {Function} operation - The operation to measure
 * @param {string} context - Context information (e.g., function name)
 * @returns {Promise<any>} The result of the operation
 */
const trackMemoryUsage = async (operation, context = 'Operation') => {
  const before = getMemoryUsage();
  console.log(`\n→ Starting operation: ${context}`);
  logMemoryUsage(`Before ${context}`);
  
  let result;
  try {
    result = await operation();
  } catch (error) {
    const after = getMemoryUsage();
    const diff = getMemoryDiff(before, after);
    
    console.log(`\n→ Operation failed: ${context}`);
    console.log(`\n=== MEMORY CHANGE [${context}] ===`);
    console.log(`RSS change: ${diff.formatted.rss}`);
    console.log(`Heap Total change: ${diff.formatted.heapTotal}`);
    console.log(`Heap Used change: ${diff.formatted.heapUsed}`);
    console.log(`External change: ${diff.formatted.external}`);
    console.log(`Array Buffers change: ${diff.formatted.arrayBuffers}`);
    
    throw error;
  }
  
  const after = getMemoryUsage();
  const diff = getMemoryDiff(before, after);
  
  console.log(`\n→ Completed operation: ${context}`);
  console.log(`\n=== MEMORY CHANGE [${context}] ===`);
  console.log(`RSS change: ${diff.formatted.rss}`);
  console.log(`Heap Total change: ${diff.formatted.heapTotal}`);
  console.log(`Heap Used change: ${diff.formatted.heapUsed}`);
  console.log(`External change: ${diff.formatted.external}`);
  console.log(`Array Buffers change: ${diff.formatted.arrayBuffers}`);
  
  if (diff.raw.heapUsed > 50 * 1024 * 1024) {
    console.warn(`\n⚠️ WARNING: Operation "${context}" consumed significant memory (${formatMemoryUsage(diff.raw.heapUsed)})!`);
    console.log('This might indicate a memory leak. Consider optimizing this operation.');
  }
  
  return result;
};

module.exports = {
  formatMemoryUsage,
  getMemoryUsage,
  logMemoryUsage,
  getMemoryDiff,
  trackMemoryUsage
}; 