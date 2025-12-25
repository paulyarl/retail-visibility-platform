#!/usr/bin/env node

/**
 * Performance Testing Script
 * Measures API endpoint response times and generates performance reports
 * 
 * Usage:
 *   node scripts/performance-test.js
 *   node scripts/performance-test.js --endpoint=/api/directory/mv/search
 *   node scripts/performance-test.js --iterations=50
 */

const http = require('http');
const https = require('https');

// Configuration
const config = {
  baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  iterations: parseInt(process.env.ITERATIONS) || 10,
  warmupIterations: 2,
};

// Parse command line arguments
const args = process.argv.slice(2);
args.forEach(arg => {
  if (arg.startsWith('--endpoint=')) {
    config.singleEndpoint = arg.split('=')[1];
  } else if (arg.startsWith('--iterations=')) {
    config.iterations = parseInt(arg.split('=')[1]);
  } else if (arg.startsWith('--url=')) {
    config.baseUrl = arg.split('=')[1];
  }
});

// Endpoints to test
const endpoints = [
  { path: '/health', name: 'Health Check' },
  { path: '/health/db', name: 'Database Health' },
  { path: '/platform-settings', name: 'Platform Settings' },
  { path: '/api/directory/mv/search', name: 'Directory Search (MV)' },
  { path: '/api/directory/categories-optimized/counts-by-name', name: 'Category Counts' },
  { path: '/api/directory/store-types', name: 'Store Types' },
  { path: '/api/directory-optimized', name: 'Directory Optimized' },
  { path: '/api/recommendations/for-directory', name: 'Recommendations' },
];

// Filter to single endpoint if specified
const endpointsToTest = config.singleEndpoint
  ? endpoints.filter(e => e.path === config.singleEndpoint)
  : endpoints;

/**
 * Make HTTP request and measure response time
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        resolve({
          statusCode: res.statusCode,
          duration,
          size: data.length,
          success: res.statusCode >= 200 && res.statusCode < 300,
        });
      });
    });
    
    req.on('error', (error) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      resolve({
        statusCode: 0,
        duration,
        size: 0,
        success: false,
        error: error.message,
      });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

/**
 * Calculate statistics from an array of numbers
 */
function calculateStats(numbers) {
  if (numbers.length === 0) return null;
  
  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / numbers.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

/**
 * Test a single endpoint multiple times
 */
async function testEndpoint(endpoint) {
  const url = `${config.baseUrl}${endpoint.path}`;
  const results = [];
  
  console.log(`\nTesting: ${endpoint.name}`);
  console.log(`URL: ${url}`);
  console.log(`Iterations: ${config.iterations} (+ ${config.warmupIterations} warmup)`);
  
  // Warmup iterations (not counted)
  for (let i = 0; i < config.warmupIterations; i++) {
    process.stdout.write('.');
    await makeRequest(url);
  }
  
  // Actual test iterations
  for (let i = 0; i < config.iterations; i++) {
    process.stdout.write('.');
    const result = await makeRequest(url);
    results.push(result);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(' Done!\n');
  
  // Calculate statistics
  const successfulResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  
  if (successfulResults.length === 0) {
    console.log('❌ All requests failed!');
    if (failedResults.length > 0 && failedResults[0].error) {
      console.log(`Error: ${failedResults[0].error}`);
    }
    return null;
  }
  
  const durations = successfulResults.map(r => r.duration);
  const sizes = successfulResults.map(r => r.size);
  
  const stats = {
    endpoint: endpoint.name,
    path: endpoint.path,
    totalRequests: results.length,
    successfulRequests: successfulResults.length,
    failedRequests: failedResults.length,
    successRate: (successfulResults.length / results.length * 100).toFixed(2) + '%',
    responseTime: calculateStats(durations),
    responseSize: calculateStats(sizes),
  };
  
  return stats;
}

/**
 * Format statistics for display
 */
function formatStats(stats) {
  if (!stats) return '';
  
  const rt = stats.responseTime;
  const rs = stats.responseSize;
  
  return `
Results for: ${stats.endpoint}
${'='.repeat(60)}
Requests:
  Total:      ${stats.totalRequests}
  Successful: ${stats.successfulRequests}
  Failed:     ${stats.failedRequests}
  Success Rate: ${stats.successRate}

Response Time (ms):
  Min:    ${rt.min.toFixed(2)}ms
  Max:    ${rt.max.toFixed(2)}ms
  Avg:    ${rt.avg.toFixed(2)}ms
  Median: ${rt.median.toFixed(2)}ms
  P90:    ${rt.p90.toFixed(2)}ms
  P95:    ${rt.p95.toFixed(2)}ms
  P99:    ${rt.p99.toFixed(2)}ms

Response Size (bytes):
  Min:    ${rs.min}
  Max:    ${rs.max}
  Avg:    ${rs.avg.toFixed(0)}
  Median: ${rs.median}

Status: ${getStatusEmoji(rt.avg)}
`;
}

/**
 * Get status emoji based on average response time
 */
function getStatusEmoji(avgTime) {
  if (avgTime < 100) return '✅ Excellent';
  if (avgTime < 300) return '✅ Good';
  if (avgTime < 500) return '⚠️  Acceptable';
  if (avgTime < 1000) return '⚠️  Slow';
  return '❌ Very Slow';
}

/**
 * Generate summary table
 */
function generateSummaryTable(allStats) {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log('Endpoint'.padEnd(35) + 'Avg (ms)'.padEnd(12) + 'P95 (ms)'.padEnd(12) + 'Success'.padEnd(10) + 'Status');
  console.log('-'.repeat(80));
  
  allStats.forEach(stats => {
    if (!stats) return;
    
    const name = stats.endpoint.substring(0, 34).padEnd(35);
    const avg = stats.responseTime.avg.toFixed(1).padEnd(12);
    const p95 = stats.responseTime.p95.toFixed(1).padEnd(12);
    const success = stats.successRate.padEnd(10);
    const status = getStatusEmoji(stats.responseTime.avg);
    
    console.log(`${name}${avg}${p95}${success}${status}`);
  });
  
  console.log('='.repeat(80));
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 Performance Testing Script');
  console.log(`Base URL: ${config.baseUrl}`);
  console.log(`Testing ${endpointsToTest.length} endpoint(s)`);
  
  const allStats = [];
  
  for (const endpoint of endpointsToTest) {
    const stats = await testEndpoint(endpoint);
    if (stats) {
      allStats.push(stats);
      console.log(formatStats(stats));
    }
  }
  
  if (allStats.length > 1) {
    generateSummaryTable(allStats);
  }
  
  // Calculate overall statistics
  const allDurations = allStats
    .filter(s => s && s.responseTime)
    .flatMap(s => Array(s.successfulRequests).fill(s.responseTime.avg));
  
  if (allDurations.length > 0) {
    const overallAvg = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;
    console.log(`\n📊 Overall Average Response Time: ${overallAvg.toFixed(2)}ms`);
  }
  
  console.log('\n✅ Performance testing complete!');
}

// Run the script
main().catch(error => {
  console.error('❌ Error running performance tests:', error);
  process.exit(1);
});
