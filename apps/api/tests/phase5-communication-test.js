#!/usr/bin/env node

/**
 * Phase 5 Reviews & Featured Content Communication Test
 * Tests reviews service and featured products service integration
 */

const https = require('https');
const http = require('http');

class Phase5CommunicationTest {
  constructor() {
    this.baseURL = 'http://localhost:4000';
    this.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64';
    this.results = {
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testResults: []
    };
  }

  async makeRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 4000,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        }
      };

      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({
              status: res.statusCode,
              data: data
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              data: body,
              error: error.message
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  async runTest(testName, method, endpoint, data = null, expectedStatus = 200) {
    this.results.totalTests++;
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest(method, endpoint, data);
      const duration = Date.now() - startTime;
      
      const passed = response.status === expectedStatus;
      
      if (passed) {
        this.results.passedTests++;
        console.log(`  ✅ ${testName} (${duration}ms) - ${method.toUpperCase()} ${endpoint}`);
      } else {
        this.results.failedTests++;
        console.log(`  ❌ ${testName} (${duration}ms) - ${method.toUpperCase()} ${endpoint} - Status: ${response.status}`);
        if (response.error) {
          console.log(`     Error: ${response.error}`);
        }
      }
      
      this.results.testResults.push({
        test: testName,
        method,
        endpoint,
        status: response.status,
        passed,
        duration,
        error: response.error || null
      });
      
    } catch (error) {
      this.results.failedTests++;
      const duration = Date.now() - startTime;
      console.log(`  ❌ ${testName} (${duration}ms) - ${method.toUpperCase()} ${endpoint} - Error: ${error.message}`);
      
      this.results.testResults.push({
        test: testName,
        method,
        endpoint,
        status: 'ERROR',
        passed: false,
        duration,
        error: error.message
      });
    }
  }

  async testReviewsService() {
    console.log('\n⭐ Testing Reviews Service...');
    
    await this.runTest('Get Product Reviews', 'GET', '/api/reviews-singleton');
    await this.runTest('Get Product Reviews by ID', 'GET', '/api/reviews-singleton/product/inv-001');
    await this.runTest('Get Reviews Statistics', 'GET', '/api/reviews-singleton/stats');
    await this.runTest('Create Product Review', 'POST', '/api/reviews-singleton', {
      tenantId: 'tid-m8ijkrnk',
      rating: 5,
      reviewText: 'Excellent Product',
      verifiedPurchase: true
    });
    await this.runTest('Update Review', 'PUT', '/api/reviews-singleton/00000000-0000-0000-0000-000000000000', {
      rating: 4,
      reviewText: 'Updated Review'
    });
  }

  async testFeaturedProductsService() {
    console.log('\n🌟 Testing Featured Products Service...');
    
    await this.runTest('Get Featured Products', 'GET', '/api/featured-products-singleton');
    await this.runTest('Get Featured Products by Tenant', 'GET', '/api/featured-products-singleton/tenant/tid-m8ijkrnk');
    await this.runTest('Get Featured Products by Type', 'GET', '/api/featured-products-singleton/type/store_selection');
    await this.runTest('Get Featured Products Stats', 'GET', '/api/featured-products-singleton/stats');
    await this.runTest('Create Featured Product', 'POST', '/api/featured-products-singleton', {
      tenantId: 'tid-m8ijkrnk',
      featuredType: 'store_selection',
      priority: 1
    });
    await this.runTest('Update Featured Product', 'PUT', '/api/featured-products-singleton/00000000-0000-0000-0000-000000000000', {
      priority: 2,
      featuredType: 'new_arrival'
    });
    await this.runTest('Remove Featured Product', 'DELETE', '/api/featured-products-singleton/00000000-0000-0000-0000-000000000000');
  }

  async runAllTests() {
    console.log('🚀 PHASE 5 REVIEWS & FEATURED CONTENT COMMUNICATION TEST');
    console.log('===============================================');
    console.log('📊 Testing reviews and featured products service integration');
    console.log('🔑 Using real authentication and HTTP requests');
    
    const startTime = Date.now();
    
    try {
      await this.testReviewsService();
      await this.testFeaturedProductsService();
    } catch (error) {
      console.error('Test execution failed:', error);
    }
    
    const totalDuration = Date.now() - startTime;
    
    console.log('\n📊 PHASE 5 COMMUNICATION TEST RESULTS:');
    console.log('=====================================');
    console.log(`✅ Passed Tests: ${this.results.passedTests}/${this.results.totalTests}`);
    console.log(`📈 Success Rate: ${((this.results.passedTests / this.results.totalTests) * 100).toFixed(1)}%`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    
    if (this.results.failedTests === 0) {
      console.log('🎉 ALL TESTS PASSED! Phase 5 reviews and featured content communication is working perfectly!');
    } else {
      console.log('⚠️  Some tests failed. Check the failed endpoints above.');
      console.log('\n🔍 Failed Tests:');
      this.results.testResults
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  ❌ ${test.test} - Status: ${test.status}${test.error ? ` - Error: ${test.error}` : ''}`);
        });
    }
    
    return {
      success: this.results.failedTests === 0,
      totalTests: this.results.totalTests,
      passedTests: this.results.passedTests,
      failedTests: this.results.failedTests,
      successRate: (this.results.passedTests / this.results.totalTests) * 100,
      duration: totalDuration,
      results: this.results.testResults
    };
  }
}

// Run the tests
if (require.main === module) {
  const test = new Phase5CommunicationTest();
  test.runAllTests().catch(console.error);
}

module.exports = Phase5CommunicationTest;
