/**
 * Multi-Location Availability API Test Script
 * Tests all endpoints with a real product slug
 * 
 * Usage: node scripts/test-location-availability.js
 */

const http = require('http');
const https = require('https');

// Configuration
const BASE_URL = process.env.API_URL || 'http://localhost:4000';
const PRODUCT_SLUG = "frozen-foods/amy's-kitchen-amy's-cheese-pizza,-single-serve-9f5d53";

// Test coordinates (Indianapolis - closer to Kansas City for realistic distance testing)
const LAT = 39.7684;
const LNG = -86.1581;

// Colors for console
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

console.log('========================================');
console.log('Multi-Location Availability API Tests');
console.log('========================================');
console.log(`Base URL: ${BASE_URL}`);
console.log(`Product Slug: ${PRODUCT_SLUG}`);
console.log(`Test Location: Indianapolis (${LAT}, ${LNG})`);
console.log('========================================\n');

// URL encode the slug
const encodedSlug = encodeURIComponent(PRODUCT_SLUG);
console.log(`Encoded Slug: ${encodedSlug}\n`);

// Helper function to make HTTP requests
function makeRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data
        });
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Test function
async function testEndpoint(name, method, endpoint, body = null) {
  console.log(`${colors.yellow}Testing: ${name}${colors.reset}`);
  console.log(`Endpoint: ${method} ${endpoint}`);
  
  try {
    const url = `${BASE_URL}${endpoint}`;
    const response = await makeRequest(url, method, body);
    
    if (response.statusCode >= 200 && response.statusCode < 300) {
      console.log(`${colors.green}✓ Status: ${response.statusCode}${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Status: ${response.statusCode}${colors.reset}`);
    }
    
    // Try to parse and pretty-print JSON
    try {
      const json = JSON.parse(response.body);
      console.log('Response:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Response:', response.body);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Error: ${error.message}${colors.reset}`);
  }
  
  console.log('');
}

// Run all tests
async function runTests() {
  // Test 1: Basic availability query
  await testEndpoint(
    'Basic Availability Query',
    'GET',
    `/api/catalog/availability?slug=${encodedSlug}`
  );

  // Test 2: Availability with user location
  await testEndpoint(
    'Availability with User Location',
    'GET',
    `/api/catalog/availability?slug=${encodedSlug}&lat=${LAT}&lng=${LNG}`
  );

  // Test 3: Availability with distance limit
  await testEndpoint(
    'Availability with Distance Limit (25mi)',
    'GET',
    `/api/catalog/availability?slug=${encodedSlug}&lat=${LAT}&lng=${LNG}&maxDistance=25`
  );

  // Test 3b: Availability with larger distance limit (500mi)
  await testEndpoint(
    'Availability with Distance Limit (500mi)',
    'GET',
    `/api/catalog/availability?slug=${encodedSlug}&lat=${LAT}&lng=${LNG}&maxDistance=500`
  );

  // Test 4: Exclude out of stock
  await testEndpoint(
    'Exclude Out of Stock',
    'GET',
    `/api/catalog/availability?slug=${encodedSlug}&includeOutOfStock=false`
  );

  // Test 5: Limited results
  await testEndpoint(
    'Limited Results (3)',
    'GET',
    `/api/catalog/availability?slug=${encodedSlug}&lat=${LAT}&lng=${LNG}&maxResults=3`
  );

  // Test 6: Sort by price
  await testEndpoint(
    'Sort by Price',
    'GET',
    `/api/catalog/availability?slug=${encodedSlug}&lat=${LAT}&lng=${LNG}&sortBy=price`
  );

  // Test 7: Sort by stock
  await testEndpoint(
    'Sort by Stock',
    'GET',
    `/api/catalog/availability?slug=${encodedSlug}&lat=${LAT}&lng=${LNG}&sortBy=stock`
  );

  // Test 8: Batch availability (cart)
  await testEndpoint(
    'Batch Availability (Cart)',
    'POST',
    '/api/catalog/availability/batch',
    {
      items: [{ productSlug: PRODUCT_SLUG, quantity: 1 }],
      lat: LAT,
      lng: LNG
    }
  );

  // Test 9: Invalid slug (error handling)
  await testEndpoint(
    'Invalid Slug (Error Handling)',
    'GET',
    '/api/catalog/availability?slug=invalid-product-12345'
  );

  // Test 10: Missing slug parameter
  await testEndpoint(
    'Missing Slug Parameter',
    'GET',
    '/api/catalog/availability'
  );

  console.log('========================================');
  console.log('All tests completed!');
  console.log('========================================');
}

// Run tests
runTests().catch(console.error);
