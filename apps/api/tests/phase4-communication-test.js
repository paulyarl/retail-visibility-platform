#!/usr/bin/env node

/**
 * Phase 4 UniversalSingleton Communication Test
 * Tests Inventory and Categories services integration
 */

const https = require('https');
const http = require('http');

class Phase4CommunicationTest {
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

  async testInventoryService() {
    console.log('📦 Testing InventoryService...');
    
    // Test inventory item retrieval
    await this.runTest('Get Inventory Item by ID', 'GET', '/api/inventory-singleton/inv-001');
    
    // Test inventory item by SKU
    await this.runTest('Get Inventory Item by SKU', 'GET', '/api/inventory-singleton/sku/tid-m8ijkrnk/ELEC-001');
    
    // Test inventory listing
    await this.runTest('List Inventory Items', 'GET', '/api/inventory-singleton');
    
    // Test inventory statistics
    await this.runTest('Get Inventory Statistics', 'GET', '/api/inventory-singleton/stats');
    
    // Test low stock alerts
    await this.runTest('Get Low Stock Alerts', 'GET', '/api/inventory-singleton/alerts/low-stock');
    
    // Test inventory item creation
    await this.runTest('Create Inventory Item', 'POST', '/api/inventory-singleton', {
      tenantId: 'tid-m8ijkrnk',
      sku: 'TEST-001',
      name: 'Test Product',
      description: 'Test inventory item',
      category: 'Test Category',
      price: {
        regular: 999990,
        currency: 'USD'
      },
      stock: {
        quantity: 10,
        reorderLevel: 5,
        reorderPoint: 3
      },
      location: {
        aisle: 'A1',
        shelf: 'S1'
      }
    });
    
    // Test inventory update
    await this.runTest('Update Inventory Item', 'PUT', '/api/inventory-singleton/inv-001', {
      name: 'Updated Test Product',
      price: {
        regular: 119990,
        sale: 99990
      },
      stock: {
        quantity: 15
      }
    });
    
    // Test stock update
    await this.runTest('Update Stock Levels', 'POST', '/api/inventory-singleton/inv-001/stock', {
      quantity: 5,
      operation: 'add'
    });
    
    // Test inventory deletion
    await this.runTest('Delete Inventory Item', 'DELETE', '/api/inventory-singleton/inv-002');
  }

  async testCategoriesService() {
    console.log('📂 Testing CategoriesService...');
    
    // Test category retrieval
    await this.runTest('Get Category by ID', 'GET', '/api/categories-singleton/cat-001');
    
    // Test category by slug
    await this.runTest('Get Category by Slug', 'GET', '/api/categories-singleton/slug/electronics');
    
    // Test category listing
    await this.runTest('List Categories', 'GET', '/api/categories-singleton');
    
    // Test category tree
    await this.runTest('Get Category Tree', 'GET', '/api/categories-singleton/tree');
    
    // Test category statistics
    await this.runTest('Get Category Statistics', 'GET', '/api/categories-singleton/stats');
    
    // Test category creation
    await this.runTest('Create Category', 'POST', '/api/categories-singleton', {
      name: 'Test Category',
      slug: 'test-category',
      description: 'Test category for Phase 4',
      parentId: 'cat-001',
      sortOrder: 999,
      metadata: {
        attributes: {
          test: true
        }
      }
    });
    
    // Test category update
    await this.runTest('Update Category', 'PUT', '/api/categories-singleton/cat-001', {
      description: 'Updated category description',
      color: '#FF5722'
    });
    
    // Test subcategory creation
    await this.runTest('Create Subcategory', 'POST', '/api/categories-singleton', {
      name: 'Test Subcategory',
      slug: 'test-subcategory',
      description: 'Test subcategory',
      parentId: 'cat-001',
      sortOrder: 1000
    });
    
    // Test category deletion (should fail - has children)
    await this.runTest('Delete Category with Children', 'DELETE', '/api/categories-singleton/cat-001');
  }

  async runAllTests() {
    console.log('🚀 PHASE 4 UNIVERSAL SINGLETON COMMUNICATION TEST');
    console.log('==============================================');
    console.log('📊 Testing Inventory and Categories services integration');
    console.log('🔑 Using real authentication and HTTP requests');
    console.log('');
    
    const startTime = Date.now();
    
    await this.testInventoryService();
    console.log('');
    
    await this.testCategoriesService();
    console.log('');
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    const successRate = (this.results.passedTests / this.results.totalTests * 100).toFixed(1);
    
    console.log('📊 PHASE 4 COMMUNICATION TEST RESULTS:');
    console.log('=====================================');
    console.log(`✅ Passed Tests: ${this.results.passedTests}/${this.results.totalTests}`);
    console.log(`📈 Success Rate: ${successRate}%`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    
    if (this.results.passedTests === this.results.totalTests) {
      console.log('🎉 ALL TESTS PASSED! Phase 4 client-server communication is working perfectly!');
    } else if (this.results.passedTests > this.results.totalTests * 0.8) {
      console.log('👍 GOOD! Most Phase 4 communication tests passed.');
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
const test = new Phase4CommunicationTest();
test.runAllTests().catch(error => {
  console.error('❌ Phase 4 test failed:', error.message);
  process.exit(1);
});
