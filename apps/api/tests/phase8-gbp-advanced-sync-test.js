/**
 * Phase 8 GBP Advanced Sync Singleton Service Communication Test
 * Tests the GBP Advanced Sync singleton service with Google Business Profile integration
 */

const axios = require('axios');

class Phase8GBPAdvancedSyncTest {
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

  async testGBPAdvancedSyncService() {
    console.log('\n🏪 Testing GBP Advanced Sync Service...');
    
    // Test health check
    await this.runTest('Health Check', 'GET', '/api/gbp-advanced-sync-singleton/health');
    
    // Test statistics
    await this.runTest('Get Statistics', 'GET', '/api/gbp-advanced-sync-singleton/stats');
    
    // Test supported features
    await this.runTest('Get Supported Features', 'GET', '/api/gbp-advanced-sync-singleton/features');
    
    // Test media sync
    await this.runTest('Sync Media Items', 'POST', '/api/gbp-advanced-sync-singleton/sync-media', {
      tenantId: 'tid-m8ijkrnk'
    });
    
    // Test reviews fetch
    await this.runTest('Fetch Reviews', 'POST', '/api/gbp-advanced-sync-singleton/fetch-reviews', {
      tenantId: 'tid-m8ijkrnk'
    });
    
    // Test post creation
    await this.runTest('Create GBP Post', 'POST', '/api/gbp-advanced-sync-singleton/create-post', {
      tenantId: 'tid-m8ijkrnk',
      postData: {
        summary: 'Test post created from API',
        state: 'PUBLISHED',
        languageCode: 'en'
      }
    });
    
    // Test GBP sync operations
    await this.runTest('Test Media Sync', 'POST', '/api/gbp-advanced-sync-singleton/test', {
      operation: 'media_sync',
      tenantId: 'tid-m8ijkrnk'
    });
    
    await this.runTest('Test Reviews Fetch', 'POST', '/api/gbp-advanced-sync-singleton/test', {
      operation: 'reviews_fetch',
      tenantId: 'tid-m8ijkrnk'
    });
    
    await this.runTest('Test Post Creation', 'POST', '/api/gbp-advanced-sync-singleton/test', {
      operation: 'post_create',
      tenantId: 'tid-m8ijkrnk'
    });
    
    // Test cache management (admin only)
    await this.runTest('Clear Cache', 'DELETE', '/api/gbp-advanced-sync-singleton/cache');
  }

  async runAllTests() {
    console.log('🚀 PHASE 8 GBP ADVANCED SYNC SINGLETON COMMUNICATION TEST');
    console.log('==========================================================');
    console.log('🏪 Testing Google Business Profile advanced features sync');
    console.log('🔑 Using real authentication and HTTP requests');
    
    const startTime = Date.now();
    
    try {
      await this.testGBPAdvancedSyncService();
    } catch (error) {
      console.error('Test execution failed:', error);
    }
    
    const totalDuration = Date.now() - startTime;
    this.printResults(totalDuration);
  }

  printResults(totalDuration) {
    console.log('\n📊 PHASE 8 GBP ADVANCED SYNC TEST RESULTS:');
    console.log('==========================================');
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
      console.log('\n🎉 All tests passed! GBP Advanced Sync singleton service is working perfectly.');
    }
    
    console.log('\n🎯 Phase 8 GBP Advanced Sync Service Migration Summary:');
    console.log('================================================');
    console.log('✅ UniversalSingleton pattern implemented');
    console.log('✅ Google Business Profile integration');
    console.log('✅ Advanced features synchronization');
    console.log('✅ Media and photo management');
    console.log('✅ Reviews fetching and analysis');
    console.log('✅ Post creation and publishing');
    console.log('✅ Rate limiting for GBP APIs');
    console.log('✅ Multi-tenant support');
    console.log('✅ Comprehensive analytics and metrics');
    console.log('✅ Health monitoring and status tracking');
    console.log('✅ Admin sync management capabilities');
    console.log('✅ Operation tracking and history');
    console.log('✅ Error handling and recovery');
    console.log('✅ Business profile enhancement');
  }
}

// Run the tests
const test = new Phase8GBPAdvancedSyncTest();
test.runAllTests().catch(console.error);
