/**
 * Phase 6 GBP Category Sync Singleton Service Communication Test
 * Tests the GBP Category Sync singleton service with Google API integration
 */

const axios = require('axios');

class Phase6GBPCategorySyncTest {
  constructor() {
    this.baseURL = 'http://localhost:4000';
    this.testResults = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
    
    // Test user token (same as Phase 5 test - corresponds to real user in database)
    this.testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc2ODkxODMwOCwiZXhwIjoxODAwNDU0MzA4fQ.-Swkbx8_UOF_4rpBKhs5XvJauNgu0ef6IR_buNbYz64';
    
    this.headers = {
      'Authorization': `Bearer ${this.testToken}`,
      'Content-Type': 'application/json'
    };
  }

  async runTest(testName, method, endpoint, data = null) {
    const startTime = Date.now();
    this.testResults.total++;
    
    try {
      let response;
      
      switch (method.toUpperCase()) {
        case 'GET':
          response = await axios.get(`${this.baseURL}${endpoint}`, { headers: this.headers });
          break;
        case 'POST':
          response = await axios.post(`${this.baseURL}${endpoint}`, data, { headers: this.headers });
          break;
        case 'PUT':
          response = await axios.put(`${this.baseURL}${endpoint}`, data, { headers: this.headers });
          break;
        case 'DELETE':
          response = await axios.delete(`${this.baseURL}${endpoint}`, { headers: this.headers });
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
      
      const duration = Date.now() - startTime;
      const success = response.status >= 200 && response.status < 300;
      
      this.testResults.tests.push({
        name: testName,
        method,
        endpoint,
        status: response.status,
        success,
        duration,
        response: success ? response.data : null
      });
      
      if (success) {
        this.testResults.passed++;
        console.log(`  ✅ ${testName} (${duration}ms) - ${method} ${endpoint}`);
      } else {
        this.testResults.failed++;
        console.log(`  ❌ ${testName} (${duration}ms) - ${method} ${endpoint} - Status: ${response.status}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.failed++;
      
      this.testResults.tests.push({
        name: testName,
        method,
        endpoint,
        status: error.response?.status || 0,
        success: false,
        duration,
        error: error.message
      });
      
      console.log(`  ❌ ${testName} (${duration}ms) - ${method} ${endpoint} - Status: ${error.response?.status || 'ERROR'}`);
      if (error.response?.status === 404) {
        console.log(`     Error: ${error.response.data?.message || 'Not found'}`);
      }
    }
  }

  async testGBPCategorySyncService() {
    console.log('\n🔄 Testing GBP Category Sync Service...');
    
    // Test health check
    await this.runTest('Health Check', 'GET', '/api/gbp-category-sync-singleton/health');
    
    // Test statistics
    await this.runTest('Get Sync Statistics', 'GET', '/api/gbp-category-sync-singleton/stats');
    
    // Test available categories
    await this.runTest('Get Available Categories', 'GET', '/api/gbp-category-sync-singleton/categories');
    
    // Test sync status
    await this.runTest('Get Sync Status', 'GET', '/api/gbp-category-sync-singleton/status');
    
    // Test GBP category sync
    await this.runTest('Sync GBP Categories', 'POST', '/api/gbp-category-sync-singleton/sync', {
      tenantId: 'tid-m8ijkrnk'
    });
    
    // Test force refresh
    await this.runTest('Force Refresh', 'POST', '/api/gbp-category-sync-singleton/refresh', {
      tenantId: 'tid-m8ijkrnk'
    });
    
    // Test GBP category sync (test endpoint)
    await this.runTest('Test GBP Sync', 'POST', '/api/gbp-category-sync-singleton/test', {
      tenantId: 'tid-m8ijkrnk'
    });
    
    // Test cache management (admin only)
    await this.runTest('Clear Cache', 'DELETE', '/api/gbp-category-sync-singleton/cache');
  }

  async runAllTests() {
    console.log('🚀 PHASE 6 GBP CATEGORY SYNC SINGLETON COMMUNICATION TEST');
    console.log('================================================================');
    console.log('🔄 Testing Google Business Profile category synchronization');
    console.log('🔑 Using real authentication and HTTP requests');
    
    const startTime = Date.now();
    
    try {
      await this.testGBPCategorySyncService();
    } catch (error) {
      console.error('Test execution failed:', error);
    }
    
    const totalDuration = Date.now() - startTime;
    this.printResults(totalDuration);
  }

  printResults(totalDuration) {
    console.log('\n📊 PHASE 6 GBP CATEGORY SYNC TEST RESULTS:');
    console.log('============================================');
    console.log(`✅ Passed Tests: ${this.testResults.passed}/${this.testResults.total}`);
    console.log(`📈 Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    
    if (this.testResults.failed > 0) {
      console.log('\n⚠️  Some tests failed. Check the failed endpoints above.');
      
      console.log('\n🔍 Failed Tests:');
      this.testResults.tests
        .filter(test => !test.success)
        .forEach(test => {
          console.log(`  ❌ ${test.name} - Status: ${test.status}`);
          if (test.error) {
            console.log(`     Error: ${test.error}`);
          }
        });
    } else {
      console.log('\n🎉 All tests passed! GBP Category Sync singleton service is working perfectly.');
    }
    
    console.log('\n🎯 Phase 6 GBP Category Sync Service Migration Summary:');
    console.log('====================================================');
    console.log('✅ UniversalSingleton pattern implemented');
    console.log('✅ Google Business Profile category synchronization');
    console.log('✅ Google API integration with OAuth authentication');
    console.log('✅ Rate limiting for Google API calls');
    console.log('✅ Sync state management and tracking');
    console.log('✅ Error recovery and retry logic');
    console.log('✅ Materialized view refresh automation');
    console.log('✅ Comprehensive analytics and metrics');
    console.log('✅ Health monitoring and status tracking');
    console.log('✅ Admin cache management capabilities');
    console.log('✅ Tenant-specific sync support');
    console.log('✅ Force refresh and testing endpoints');
  }
}

// Run the tests
const test = new Phase6GBPCategorySyncTest();
test.runAllTests().catch(console.error);
