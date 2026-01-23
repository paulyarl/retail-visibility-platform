#!/usr/bin/env node

/**
 * REAL Client-Server Singleton Communication Test
 * Makes actual HTTP requests to test real API endpoints
 */

const https = require('https');
const http = require('http');

class RealClientServerCommunicationTest {
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

    async testSecurityMonitoring() {
        console.log('🔒 Testing SecurityMonitoringService...');
        
        await this.runTest('Security Event Recording', 'POST', '/api/security/events', {
            type: 'login_attempt',
            severity: 'medium',
            source: { ip: '192.168.1.1', userAgent: 'Test Agent' },
            details: { success: true }
        });
        
        await this.runTest('Security Metrics Retrieval', 'GET', '/api/security/metrics?hours=24');
        
        await this.runTest('Blocked IPs Management', 'GET', '/api/security/blocked-ips');
    }

    async testRateLimiting() {
        console.log('⚡ Testing RateLimitingService...');
        
        await this.runTest('Rate Limit Rules List', 'GET', '/api/rate-limit/rules');
        
        await this.runTest('Rate Limit Rule Creation', 'POST', '/api/rate-limit/rules', {
            routeType: 'test',
            maxRequests: 50,
            windowMinutes: 1,
            enabled: true,
            priority: 1,
            exemptPaths: [],
            strictPaths: []
        });
        
        await this.runTest('Rate Limit Check', 'POST', '/api/rate-limit/check', {
            ip: '192.168.1.1',
            routeType: 'default',
            path: '/api/test'
        });
    }

    async testBehaviorTracking() {
        console.log('📊 Testing BehaviorTrackingService...');
        
        await this.runTest('Behavior Event Tracking', 'POST', '/api/behavior/events', {
            eventType: 'page_view',
            userId: 'uid-zqe5ns5k',
            sessionId: 'session-test',
            tenantId: 'tid-m8ijkrnk',
            url: '/test-page',
            metadata: { test: true }
        });
        
        await this.runTest('Behavior Analytics Retrieval', 'GET', '/api/behavior/analytics?hours=24');
        
        await this.runTest('Behavior Configuration', 'GET', '/api/behavior/config');
    }

    async testTenantProfile() {
        console.log('🏢 Testing TenantProfileService...');
        
        // Test the existing tenant profile endpoint
        await this.runTest('Tenant Profile Retrieval', 'GET', '/api/tenant/profile?tenant_id=tid-m8ijkrnk');
        
        // Test our UniversalSingleton tenant profile endpoint
        await this.runTest('Tenant Profile (UniversalSingleton)', 'GET', '/api/tenant/tid-m8ijkrnk/profile');
        
        await this.runTest('Tenant Analytics', 'GET', '/api/tenant/tid-m8ijkrnk/analytics');
        
        await this.runTest('Tenant Activity Recording', 'POST', '/api/tenant/tid-m8ijkrnk/activity', {
            type: 'profile_update',
            description: 'Test activity',
            metadata: { test: true }
        });
        
        // Test the missing endpoints that client expects
        await this.runTest('Tenant Profile Stats', 'GET', '/api/tenant/tid-m8ijkrnk/stats');
    }

    async runAllTests() {
        console.log('🔗 REAL CLIENT-SERVER SINGLETON COMMUNICATION TEST');
        console.log('===============================================');
        console.log('📊 Testing real API endpoints with UniversalSingleton services');
        console.log('🔑 Using real authentication and HTTP requests');
        console.log('');
        
        const startTime = Date.now();
        
        await this.testSecurityMonitoring();
        console.log('');
        
        await this.testRateLimiting();
        console.log('');
        
        await this.testBehaviorTracking();
        console.log('');
        
        await this.testTenantProfile();
        console.log('');
        
        const endTime = Date.now();
        const totalDuration = endTime - startTime;
        const successRate = (this.results.passedTests / this.results.totalTests * 100).toFixed(1);
        
        console.log('📊 REAL COMMUNICATION TEST RESULTS:');
        console.log('=====================================');
        console.log(`✅ Passed Tests: ${this.results.passedTests}/${this.results.totalTests}`);
        console.log(`📈 Success Rate: ${successRate}%`);
        console.log(`⏱️  Total Duration: ${totalDuration}ms`);
        
        if (this.results.passedTests === this.results.totalTests) {
            console.log('🎉 ALL TESTS PASSED! Real client-server communication is working perfectly!');
        } else if (this.results.passedTests > this.results.totalTests * 0.8) {
            console.log('👍 GOOD! Most real communication tests passed.');
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
const test = new RealClientServerCommunicationTest();
test.runAllTests().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});
