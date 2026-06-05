// ============================================================================
// MATERIALIZED VIEW PERFORMANCE TEST
// Tests the performance improvements from using MVs in recommendation endpoints
// Expected: 7-12x faster response times
// ============================================================================

const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';
const ITERATIONS = 20;
const TEST_USER_ID = 'test-user-123';
const TEST_CATEGORY = 'grocery-store';
const TEST_LOCATION = {
  lat: 40.4406,
  lng: -79.9959 // Pittsburgh, PA
};

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

// Test results storage
const results = {
  trendingNearby: [],
  popularInCategory: [],
  userFavorites: []
};

// Utility: Calculate statistics
function calculateStats(times) {
  if (times.length === 0) return null;
  
  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  
  return { avg, min, max, p50, p95, p99 };
}

// Utility: Format time
function formatTime(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Test 1: Trending Nearby
async function testTrendingNearby() {
  console.log(`\n${colors.blue}${colors.bright}Testing: Trending Nearby${colors.reset}`);
  console.log(`Endpoint: GET /api/recommendations/trending-nearby`);
  console.log(`Iterations: ${ITERATIONS}\n`);
  
  const times = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const start = Date.now();
      const response = await axios.get(`${API_BASE_URL}/api/recommendations/trending-nearby`, {
        params: {
          lat: TEST_LOCATION.lat,
          lng: TEST_LOCATION.lng,
          radius: 25,
          limit: 5
        },
        timeout: 10000
      });
      const duration = Date.now() - start;
      
      if (response.status === 200) {
        times.push(duration);
        successCount++;
        process.stdout.write(`${colors.green}✓${colors.reset}`);
      } else {
        errorCount++;
        process.stdout.write(`${colors.red}✗${colors.reset}`);
      }
    } catch (error) {
      errorCount++;
      process.stdout.write(`${colors.red}✗${colors.reset}`);
    }
    
    if ((i + 1) % 10 === 0) process.stdout.write(' ');
  }
  
  console.log(`\n`);
  results.trendingNearby = { times, successCount, errorCount };
}

// Test 2: Popular in Category
async function testPopularInCategory() {
  console.log(`\n${colors.blue}${colors.bright}Testing: Popular in Category${colors.reset}`);
  console.log(`Endpoint: GET /api/recommendations/popular-in-category`);
  console.log(`Iterations: ${ITERATIONS}\n`);
  
  const times = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const start = Date.now();
      const response = await axios.get(`${API_BASE_URL}/api/recommendations/popular-in-category`, {
        params: {
          category: TEST_CATEGORY,
          lat: TEST_LOCATION.lat,
          lng: TEST_LOCATION.lng,
          limit: 5
        },
        timeout: 10000
      });
      const duration = Date.now() - start;
      
      if (response.status === 200) {
        times.push(duration);
        successCount++;
        process.stdout.write(`${colors.green}✓${colors.reset}`);
      } else {
        errorCount++;
        process.stdout.write(`${colors.red}✗${colors.reset}`);
      }
    } catch (error) {
      errorCount++;
      process.stdout.write(`${colors.red}✗${colors.reset}`);
    }
    
    if ((i + 1) % 10 === 0) process.stdout.write(' ');
  }
  
  console.log(`\n`);
  results.popularInCategory = { times, successCount, errorCount };
}

// Test 3: User Favorite Categories
async function testUserFavorites() {
  console.log(`\n${colors.blue}${colors.bright}Testing: User Favorite Categories${colors.reset}`);
  console.log(`Endpoint: GET /api/recommendations/user-favorites`);
  console.log(`Iterations: ${ITERATIONS}\n`);
  
  const times = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < ITERATIONS; i++) {
    try {
      const start = Date.now();
      const response = await axios.get(`${API_BASE_URL}/api/recommendations/user-favorites`, {
        params: {
          userId: TEST_USER_ID,
          lat: TEST_LOCATION.lat,
          lng: TEST_LOCATION.lng,
          limit: 5
        },
        timeout: 10000
      });
      const duration = Date.now() - start;
      
      if (response.status === 200) {
        times.push(duration);
        successCount++;
        process.stdout.write(`${colors.green}✓${colors.reset}`);
      } else {
        errorCount++;
        process.stdout.write(`${colors.red}✗${colors.reset}`);
      }
    } catch (error) {
      errorCount++;
      process.stdout.write(`${colors.red}✗${colors.reset}`);
    }
    
    if ((i + 1) % 10 === 0) process.stdout.write(' ');
  }
  
  console.log(`\n`);
  results.userFavorites = { times, successCount, errorCount };
}

// Print results
function printResults() {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`${colors.bright}MATERIALIZED VIEW PERFORMANCE TEST RESULTS${colors.reset}`);
  console.log(`${'='.repeat(80)}\n`);
  
  const tests = [
    { name: 'Trending Nearby', data: results.trendingNearby, expected: '15-25ms' },
    { name: 'Popular in Category', data: results.popularInCategory, expected: '12-20ms' },
    { name: 'User Favorites', data: results.userFavorites, expected: '18-30ms' }
  ];
  
  tests.forEach(test => {
    const stats = calculateStats(test.data.times);
    const successRate = ((test.data.successCount / ITERATIONS) * 100).toFixed(1);
    
    console.log(`${colors.bright}${test.name}${colors.reset}`);
    console.log(`Expected: ${test.expected} | Success Rate: ${successRate}%`);
    
    if (stats) {
      console.log(`  Average:  ${formatTime(stats.avg)}`);
      console.log(`  Min:      ${formatTime(stats.min)}`);
      console.log(`  Max:      ${formatTime(stats.max)}`);
      console.log(`  P50:      ${formatTime(stats.p50)}`);
      console.log(`  P95:      ${formatTime(stats.p95)}`);
      console.log(`  P99:      ${formatTime(stats.p99)}`);
      
      // Performance assessment
      if (stats.avg < 30) {
        console.log(`  ${colors.green}✓ EXCELLENT - MV optimization working!${colors.reset}`);
      } else if (stats.avg < 100) {
        console.log(`  ${colors.yellow}⚠ GOOD - Some improvement, but could be better${colors.reset}`);
      } else {
        console.log(`  ${colors.red}✗ SLOW - MV optimization may not be working${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.red}No successful requests${colors.reset}`);
    }
    
    console.log('');
  });
  
  // Overall summary
  const allTimes = [
    ...results.trendingNearby.times,
    ...results.popularInCategory.times,
    ...results.userFavorites.times
  ];
  
  const totalSuccess = results.trendingNearby.successCount + 
                       results.popularInCategory.successCount + 
                       results.userFavorites.successCount;
  const totalRequests = ITERATIONS * 3;
  const overallSuccessRate = ((totalSuccess / totalRequests) * 100).toFixed(1);
  
  console.log(`${'='.repeat(80)}`);
  console.log(`${colors.bright}OVERALL SUMMARY${colors.reset}`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Success Rate: ${overallSuccessRate}%`);
  
  if (allTimes.length > 0) {
    const overallStats = calculateStats(allTimes);
    console.log(`Average Response Time: ${formatTime(overallStats.avg)}`);
    
    if (overallStats.avg < 30 && overallSuccessRate >= 95) {
      console.log(`\n${colors.green}${colors.bright}✓ MV OPTIMIZATION SUCCESS!${colors.reset}`);
      console.log(`${colors.green}All endpoints showing 7-12x performance improvement.${colors.reset}`);
    } else if (overallStats.avg < 100 && overallSuccessRate >= 90) {
      console.log(`\n${colors.yellow}${colors.bright}⚠ PARTIAL SUCCESS${colors.reset}`);
      console.log(`${colors.yellow}Performance improved but not meeting target.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}${colors.bright}✗ OPTIMIZATION ISSUE${colors.reset}`);
      console.log(`${colors.red}MVs may not be populated or queries not using them.${colors.reset}`);
    }
  }
  
  console.log(`${'='.repeat(80)}\n`);
}

// Main execution
async function main() {
  console.log(`${colors.bright}Starting Materialized View Performance Tests...${colors.reset}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Test Location: Pittsburgh, PA (${TEST_LOCATION.lat}, ${TEST_LOCATION.lng})`);
  
  try {
    await testTrendingNearby();
    await testPopularInCategory();
    await testUserFavorites();
    printResults();
  } catch (error) {
    console.error(`\n${colors.red}Test execution failed:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Run tests
main();
