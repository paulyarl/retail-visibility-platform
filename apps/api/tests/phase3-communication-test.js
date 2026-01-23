#!/usr/bin/env node

/**
 * Phase 3 UniversalSingleton Communication Test
 * Tests Users and Tiers services integration
 */

const https = require('https');
const http = require('http');

class Phase3CommunicationTest {
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
      const url = `${this.baseURL}${endpoint}`;
      const isHttps = url.startsWith('https://');
      const client = isHttps ? https : http;
      
      const postData = data ? JSON.stringify(data) : null;
      
      const options = {
        hostname: isHttps ? 'localhost' : 'localhost',
        port: 4000,
        path: endpoint,
        method: method,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      };

      if (postData) {
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = client.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const parsedData = responseData ? JSON.parse(responseData) : {};
            resolve({
              status: res.statusCode,
              data: parsedData,
              success: res.statusCode >= 200 && res.statusCode < 300
            });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (postData) {
        req.write(postData);
      }
      
      req.end();
    });
  }

  async runTest(name, method, endpoint, data = null) {
    const startTime = Date.now();
    this.results.totalTests++;

    try {
      const response = await this.makeRequest(method, endpoint, data);
      const endTime = Date.now();
      const duration = endTime - startTime;

      const testResult = {
        name,
        method,
        endpoint,
        status: response.success ? 'passed' : 'failed',
        duration,
        response,
        error: null
      };

      this.results.testResults.push(testResult);

      if (response.success) {
        this.results.passedTests++;
        console.log(`  ✅ ${name} (${duration}ms) - ${method} ${endpoint}`);
      } else {
        this.results.failedTests++;
        console.log(`  ❌ ${name} (${duration}ms) - ${method} ${endpoint} - Status: ${response.status}`);
      }

      return testResult;
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      const testResult = {
        name,
        method,
        endpoint,
        status: 'failed',
        duration,
        response: null,
        error: error.message
      };

      this.results.testResults.push(testResult);
      this.results.failedTests++;
      
      console.log(`  ❌ ${name} (${duration}ms) - ${method} ${endpoint} - Error: ${error.message}`);
      
      return testResult;
    }
  }

  async testUsersService() {
    console.log('👥 Testing UsersService...');
    
    // Test user retrieval
    await this.runTest('Get User by ID', 'GET', '/api/users-singleton/uid-zqe5ns5k');
    
    // Test user listing
    await this.runTest('List Users', 'GET', '/api/users-singleton');
    
    // Test user activity
    await this.runTest('Get User Activity', 'GET', '/api/users-singleton/uid-zqe5ns5k/activity');
    
    // Test user statistics
    await this.runTest('Get User Statistics', 'GET', '/api/users-singleton/stats');
    
    // Test user creation
    await this.runTest('Create User', 'POST', '/api/users-singleton', {
      email: 'test-user@rvp.com',
      name: 'Test User',
      role: 'user',
      tenantIds: ['tid-m8ijkrnk'],
      metadata: {
        department: 'Test',
        timezone: 'America/New_York'
      }
    });
    
    // Test user update
    await this.runTest('Update User', 'PUT', '/api/users-singleton/uid-zqe5ns5k', {
      name: 'Updated Admin User',
      metadata: {
        department: 'Platform Administration'
      }
    });
  }

  async testTiersService() {
    console.log('🏆 Testing TiersService...');
    
    // Test tier retrieval
    await this.runTest('Get Tier by ID', 'GET', '/api/tiers-singleton/tier-professional-001');
    
    // Test tier by slug
    await this.runTest('Get Tier by Slug', 'GET', '/api/tiers-singleton/slug/professional');
    
    // Test tier listing
    await this.runTest('List Tiers', 'GET', '/api/tiers-singleton');
    
    // Test tier statistics
    await this.runTest('Get Tier Statistics', 'GET', '/api/tiers-singleton/stats');
    
    // Test tier limits
    await this.runTest('Get Tier Limits', 'GET', '/api/tiers-singleton/tier-professional-001/limits');
    
    // Test tier feature check
    await this.runTest('Check Tier Feature', 'GET', '/api/tiers-singleton/tier-professional-001/has-feature/apiAccess');
    
    // Test upgrade eligibility
    await this.runTest('Check Upgrade Eligibility', 'GET', '/api/tiers-singleton/tier-enterprise-001/can-upgrade/tid-m8ijkrnk');
    
    // Test tier creation
    await this.runTest('Create Tier', 'POST', '/api/tiers-singleton', {
      name: 'Test Tier',
      slug: 'test-tier',
      description: 'A test tier for Phase 3',
      level: 1,
      price: {
        monthly: 49,
        yearly: 490,
        currency: 'USD'
      },
      limits: {
        products: 500,
        locations: 2,
        users: 5,
        storage: 2000,
        apiCalls: 25000,
        features: ['basic-listing', 'basic-analytics']
      },
      features: {
        basicAnalytics: true,
        advancedAnalytics: false,
        customBranding: false,
        prioritySupport: false,
        apiAccess: true,
        bulkOperations: false,
        customIntegrations: false,
        whiteLabel: false
      },
      metadata: {
        displayOrder: 4,
        badgeColor: 'orange'
      }
    });
    
    // Test tier update
    await this.runTest('Update Tier', 'PUT', '/api/tiers-singleton/tier-professional-001', {
      description: 'Updated description for professional tier',
      price: {
        monthly: 109
      }
    });
  }

  async runAllTests() {
    console.log('🚀 PHASE 3 UNIVERSAL SINGLETON COMMUNICATION TEST');
    console.log('==============================================');
    console.log('📊 Testing Users and Tiers services integration');
    console.log('🔑 Using real authentication and HTTP requests');
    console.log('');
    
    const startTime = Date.now();
    
    await this.testUsersService();
    console.log('');
    
    await this.testTiersService();
    console.log('');
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const successRate = (this.results.passedTests / this.results.totalTests * 100).toFixed(1);
    
    console.log('📊 PHASE 3 COMMUNICATION TEST RESULTS:');
    console.log('=====================================');
    console.log(`✅ Passed Tests: ${this.results.passedTests}/${this.results.totalTests}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    
    if (this.results.passedTests === this.results.totalTests) {
      console.log('🎉 ALL TESTS PASSED! Phase 3 client-server communication is working perfectly!');
    } else if (this.results.passedTests > this.results.totalTests * 0.8) {
      console.log('👍 GOOD! Most Phase 3 communication tests passed.');
    } else {
      console.log('⚠️  Some tests failed. Check the failed endpoints above.');
    }
    
    console.log('');
    console.log('🔍 Failed Tests:');
    this.results.testResults
      .filter(test => test.status === 'failed')
      .forEach(test => {
        console.log(`  ❌ ${test.name} - ${test.error || `Status: ${test.response?.status}`}`);
      });
    
    return {
      totalTests: this.results.totalTests,
      passedTests: this.results.passedTests,
      failedTests: this.results.failedTests,
      successRate: parseFloat(successRate),
      duration: totalDuration
    };
  }
}

// Run the test
const test = new Phase3CommunicationTest();
test.runAllTests().catch(error => {
  console.error('❌ Phase 3 test failed:', error.message);
  process.exit(1);
});
