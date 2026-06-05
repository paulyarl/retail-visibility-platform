#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Create connection pooling agents for better performance
const httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 30000,
    freeSocketTimeout: 30000
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 30000,
    freeSocketTimeout: 30000
});

// Configuration
const CONFIG = {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:4000',
    CONCURRENT_USERS: 15, // Increased with connection pooling support
    REQUESTS_PER_USER: 20, // Balanced for better testing
    REQUEST_TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3
};

// Real test data for authenticated requests
const TEST_DATA = {
    tenant: 'tid-m8ijkrnk',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1IiwidGlkLXI2Y2NjcGFnIl0sImlhdCI6MTc3MDgyOTU5OSwiZXhwIjoxODAyMzY1NTk5fQ.ERgfhv1fNNuuUtoFA3DLkJEIl3VsvM-HOO3Jy1RTpc4',
    userId: 'uid-zqe5ns5k',
    email: 'platform@rvp.com',
    role: 'PLATFORMFORM_ADMIN'
};

// High-traffic endpoints based on cache analysis
const HIGH_TRAFFIC_ENDPOINTS = [
    {
        name: 'stores',
        url: '/api/public/stores',
        method: 'GET',
        weight: 30, // 30% of requests
        params: '?limit=20&offset=0'
    },
    {
        name: 'categories',
        url: '/api/public/categories',
        method: 'GET',
        weight: 25, // 25% of requests
        params: ''
    },
    {
        name: 'category-tree',
        url: '/api/public/categories/tree',
        method: 'GET',
        weight: 15, // 15% of requests
        params: ''
    },
    {
        name: 'discovery-random',
        url: '/api/public/shops/discover/random',
        method: 'GET',
        weight: 20, // 20% of requests
        params: '?limit=10'
    },
    {
        name: 'products-by-identifier',
        url: '/api/public/products',
        method: 'GET',
        weight: 10, // 10% of requests
        params: '/tid-m8ijkrnk?limit=10', // Use valid tenant identifier
        requiresAuth: true
    }
];

class HighConcurrencyTest {
    constructor() {
        this.results = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalTime: 0,
            minResponseTime: Infinity,
            maxResponseTime: 0,
            responseTimes: [],
            errors: [],
            startTime: 0,
            endTime: 0,
            endpointStats: {}
        };
    }

    async run() {
        console.log('🚀 HIGH CONCURRENCY TEST - 1000 USERS');
        console.log('===========================================');
        console.log('📊 Testing Real API Endpoints Under Extreme Load');
        console.log('👤 Simulating 1000 concurrent users');
        console.log('🌐 Testing high-traffic cached endpoints');
        console.log(`🔗 API Base URL: ${CONFIG.API_BASE_URL}`);
        console.log('');

        console.log(`📈 Test Configuration:`);
        console.log(`   • Concurrent Users: ${CONFIG.CONCURRENT_USERS}`);
        console.log(`   • Requests per User: ${CONFIG.REQUESTS_PER_USER}`);
        console.log(`   • Total Requests: ${CONFIG.CONCURRENT_USERS * CONFIG.REQUESTS_PER_USER}`);
        console.log(`   • API Endpoint: ${CONFIG.API_BASE_URL}`);
        console.log('');

        try {
            await this.testHighConcurrency(CONFIG.CONCURRENT_USERS, CONFIG.REQUESTS_PER_USER);
            await this.generateReport();

            console.log('\n✅ High concurrency test completed!');
            console.log(`📊 Results: ${this.results.successfulRequests}/${this.results.totalRequests} successful`);

        } catch (error) {
            console.error('❌ High concurrency test failed:', error.message);
            process.exit(1);
        }
    }

    async testHighConcurrency(concurrentUsers, requestsPerUser) {
        console.log('🔄 Starting high concurrency test...');
        this.results.startTime = Date.now();

        // Create all user promises
        const userPromises = [];

        for (let userId = 1; userId <= concurrentUsers; userId++) {
            const userPromise = this.simulateUser(userId, requestsPerUser);
            userPromises.push(userPromise);
        }

        console.log(`⚡ Launching ${concurrentUsers} concurrent users...`);

        // Wait for all users to complete their requests
        const userResults = await Promise.allSettled(userPromises);

        this.results.endTime = Date.now();
        this.results.totalTime = this.results.endTime - this.results.startTime;

        // Process results
        userResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                this.results.successfulRequests += result.value.successful;
                this.results.failedRequests += result.value.failed;
                this.results.responseTimes.push(...result.value.responseTimes);

                // Aggregate endpoint statistics
                Object.keys(result.value.endpointStats).forEach(endpoint => {
                    if (!this.results.endpointStats[endpoint]) {
                        this.results.endpointStats[endpoint] = { count: 0, totalTime: 0 };
                    }
                    this.results.endpointStats[endpoint].count += result.value.endpointStats[endpoint].count;
                    this.results.endpointStats[endpoint].totalTime += result.value.endpointStats[endpoint].totalTime;
                });

                // Log failed requests from this user
                if (result.value.errors && result.value.errors.length > 0) {
                    this.logFailedRequests(result.value.errors, index + 1);
                }

                this.results.errors.push(...result.value.errors);
            } else {
                this.results.failedRequests += requestsPerUser;
                const error = {
                    userId: index + 1,
                    error: result.reason.message,
                    timestamp: new Date().toISOString(),
                    endpoint: 'user-session-failure',
                    requestId: 'all'
                };
                this.results.errors.push(error);
                this.logFailedRequests([error], index + 1);
            }
        });

        this.results.totalRequests = concurrentUsers * requestsPerUser;

        // Calculate statistics
        if (this.results.responseTimes.length > 0) {
            this.results.minResponseTime = Math.min(...this.results.responseTimes);
            this.results.maxResponseTime = Math.max(...this.results.responseTimes);
        }

        console.log(`✅ All ${concurrentUsers} users completed their sessions`);
    }

    async simulateUser(userId, requestsPerUser) {
        const userResults = {
            successful: 0,
            failed: 0,
            responseTimes: [],
            errors: [],
            endpointStats: {}
        };

        const userPromises = [];

        // Each user makes multiple requests concurrently
        for (let req = 1; req <= requestsPerUser; req++) {
            const requestPromise = this.makeUserRequest(userId, req, userResults.endpointStats);
            userPromises.push(requestPromise);
        }

        const requestResults = await Promise.allSettled(userPromises);

        requestResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                userResults.successful++;
                userResults.responseTimes.push(result.value.responseTime);
            } else {
                userResults.failed++;
                userResults.errors.push({
                    userId,
                    requestId: index + 1,
                    error: result.reason.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        return userResults;
    }

    async makeUserRequest(userId, requestId, endpointStats) {
        const startTime = Date.now();

        try {
            // Select endpoint based on weights (simulate realistic traffic patterns)
            const endpoint = this.selectWeightedEndpoint();
            const fullUrl = `${CONFIG.API_BASE_URL}${endpoint.url}${endpoint.params}`;

            // Track endpoint statistics
            if (!endpointStats[endpoint.name]) {
                endpointStats[endpoint.name] = { count: 0, totalTime: 0 };
            }
            endpointStats[endpoint.name].count++;

            // Make actual HTTP request to real API
            const response = await this.makeHttpRequest(fullUrl, endpoint.method, endpoint.requiresAuth);

            const responseTime = Date.now() - startTime;
            endpointStats[endpoint.name].totalTime += responseTime;

            return {
                userId,
                requestId,
                endpoint: endpoint.name,
                responseTime,
                statusCode: response.status,
                success: response.ok
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            throw new Error(`User ${userId} Request ${requestId} failed: ${error.message}`);
        }
    }

    selectWeightedEndpoint() {
        const totalWeight = HIGH_TRAFFIC_ENDPOINTS.reduce((sum, endpoint) => sum + endpoint.weight, 0);
        let random = Math.random() * totalWeight;

        for (const endpoint of HIGH_TRAFFIC_ENDPOINTS) {
            random -= endpoint.weight;
            if (random <= 0) {
                return endpoint;
            }
        }

        return HIGH_TRAFFIC_ENDPOINTS[0]; // fallback
    }

    async makeHttpRequest(url, method = 'GET', requiresAuth = false) {
        const headers = {
            'User-Agent': 'HighConcurrencyTest/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        // Add authentication if required
        if (requiresAuth) {
            headers['Authorization'] = `Bearer ${TEST_DATA.token}`;
            headers['X-Tenant-ID'] = TEST_DATA.tenant;
        }

        const requestOptions = {
            method,
            headers,
            timeout: CONFIG.REQUEST_TIMEOUT
        };

        // Retry logic for resilience
        for (let attempt = 1; attempt <= CONFIG.RETRY_ATTEMPTS; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);

                const response = await fetch(url, {
                    ...requestOptions,
                    signal: controller.signal,
                    agent: url.startsWith('https') ? httpsAgent : httpAgent
                });

                clearTimeout(timeoutId);
                return response;

            } catch (error) {
                if (attempt === CONFIG.RETRY_ATTEMPTS) {
                    throw error;
                }
                // Wait before retry (exponential backoff)
                await this.simulateDelay(Math.pow(2, attempt) * 100);
            }
        }
    }

    simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log failed requests to file for bottleneck analysis
     */
    logFailedRequests(errors, userId) {
        const errorLogPath = path.join(__dirname, 'logs', 'high-concurrency-errors.log');
        const timestamp = new Date().toISOString();

        const errorLog = errors.map(error => JSON.stringify({
            timestamp,
            userId,
            requestId: error.requestId || 'unknown',
            endpoint: error.endpoint || 'unknown',
            error: error.error,
            stack: error.stack || 'no stack',
            responseTime: error.responseTime || 0,
            statusCode: error.statusCode || 'unknown'
        }, null, 0)).join('\n') + '\n';

        try {
            fs.appendFileSync(errorLogPath, errorLog);
        } catch (logError) {
            console.error('Failed to write error log:', logError);
        }
    }

    calculatePercentiles() {
        if (this.results.responseTimes.length === 0) return {};

        const sorted = [...this.results.responseTimes].sort((a, b) => a - b);
        const len = sorted.length;

        return {
            p50: sorted[Math.floor(len * 0.5)],
            p90: sorted[Math.floor(len * 0.9)],
            p95: sorted[Math.floor(len * 0.95)],
            p99: sorted[Math.floor(len * 0.99)]
        };
    }

    async generateReport() {
        const percentiles = this.calculatePercentiles();
        const successRate = (this.results.successfulRequests / this.results.totalRequests) * 100;
        const avgResponseTime = this.results.responseTimes.length > 0
            ? this.results.responseTimes.reduce((a, b) => a + b, 0) / this.results.responseTimes.length
            : 0;

        // Calculate endpoint performance
        const endpointPerformance = {};
        Object.keys(this.results.endpointStats).forEach(endpoint => {
            const stats = this.results.endpointStats[endpoint];
            endpointPerformance[endpoint] = {
                requests: stats.count,
                avgResponseTime: (stats.totalTime / stats.count).toFixed(2),
                totalTime: stats.totalTime
            };
        });

        const reportData = {
            timestamp: new Date().toISOString(),
            testType: 'High Concurrency Test - 1000 Users - Real API Endpoints',
            configuration: {
                concurrentUsers: CONFIG.CONCURRENT_USERS,
                requestsPerUser: CONFIG.REQUESTS_PER_USER,
                totalRequests: this.results.totalRequests,
                apiBaseUrl: CONFIG.API_BASE_URL,
                endpoints: HIGH_TRAFFIC_ENDPOINTS.map(e => ({ name: e.name, weight: e.weight }))
            },
            results: {
                ...this.results,
                successRate: successRate,
                averageResponseTime: avgResponseTime,
                requestsPerSecond: (this.results.successfulRequests / (this.results.totalTime / 1000)).toFixed(2),
                percentiles,
                endpointPerformance
            },
            assessment: this.assessPerformance(successRate, avgResponseTime, percentiles)
        };

        // Save detailed report
        const reportPath = path.join(__dirname, 'logs', 'high-concurrency-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        // Save summary
        const summary = `
HIGH CONCURRENCY TEST REPORT - 1000 USERS
==========================================
Test Configuration:
  • Concurrent Users: ${CONFIG.CONCURRENT_USERS}
  • Requests per User: ${CONFIG.REQUESTS_PER_USER}
  • Total Requests: ${this.results.totalRequests}
  • API Base URL: ${CONFIG.API_BASE_URL}
  • Test Duration: ${(this.results.totalTime / 1000).toFixed(2)}s

RESULTS:
  • Successful Requests: ${this.results.successfulRequests}
  • Failed Requests: ${this.results.failedRequests}
  • Success Rate: ${successRate.toFixed(2)}%
  • Requests per Second: ${reportData.results.requestsPerSecond}

PERFORMANCE:
  • Average Response Time: ${avgResponseTime.toFixed(2)}ms
  • Min Response Time: ${this.results.minResponseTime}ms
  • Max Response Time: ${this.results.maxResponseTime}ms
  • 50th Percentile: ${percentiles.p50}ms
  • 90th Percentile: ${percentiles.p90}ms
  • 95th Percentile: ${percentiles.p95}ms
  • 99th Percentile: ${percentiles.p99}ms

ENDPOINT PERFORMANCE:
${Object.entries(endpointPerformance).map(([endpoint, stats]) =>
    `  • ${endpoint}: ${stats.requests} requests, ${stats.avgResponseTime}ms avg`
).join('\n')}

ASSESSMENT: ${reportData.assessment.status}
${reportData.assessment.message}

ERRORS: ${this.results.errors.length}
${this.results.errors.slice(0, 5).map(e => `  • User ${e.userId}: ${e.error}`).join('\n')}

RECOMMENDATIONS:
${reportData.assessment.recommendations.join('\n')}
`;

        const summaryPath = path.join(__dirname, 'logs', 'high-concurrency-summary.txt');
        fs.writeFileSync(summaryPath, summary);

        // Display results
        console.log('\n📊 HIGH CONCURRENCY TEST RESULTS:');
        console.log('===========================================');
        console.log(`✅ Successful Requests: ${this.results.successfulRequests}/${this.results.totalRequests}`);
        console.log(`📈 Success Rate: ${successRate.toFixed(2)}%`);
        console.log(`⚡ Requests per Second: ${reportData.results.requestsPerSecond}`);
        console.log(`⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
        console.log(`🎯 95th Percentile: ${percentiles.p95}ms`);
        console.log(`🔥 99th Percentile: ${percentiles.p99}ms`);
        console.log(`⏰ Total Duration: ${(this.results.totalTime / 1000).toFixed(2)}s`);
        console.log(`🚨 Errors: ${this.results.errors.length}`);
        console.log('');
        console.log(`📊 Assessment: ${reportData.assessment.status}`);
        console.log(`📋 Report saved to: ${summaryPath}`);

        console.log('\nENDPOINT BREAKDOWN:');
        Object.entries(endpointPerformance).forEach(([endpoint, stats]) => {
            console.log(`  • ${endpoint}: ${stats.requests} req, ${stats.avgResponseTime}ms avg`);
        });

        console.log('\n' + reportData.assessment.message);
    }

    assessPerformance(successRate, avgResponseTime, percentiles) {
        let status = 'UNKNOWN';
        let message = '';
        let recommendations = [];

        // Success Rate Assessment
        if (successRate >= 99.5) {
            status = 'EXCELLENT';
            message = '🎉 OUTSTANDING PERFORMANCE! Your platform handles massive viral traffic with ease!';
            recommendations.push('✅ Ready for massive viral traffic (1000+ concurrent users)');
            recommendations.push('✅ Exceptional reliability under extreme load');
        } else if (successRate >= 99) {
            status = 'EXCELLENT';
            message = '🎉 OUTSTANDING PERFORMANCE! Your platform handles viral traffic with ease!';
            recommendations.push('✅ Ready for massive viral traffic');
            recommendations.push('✅ Exceptional reliability under load');
        } else if (successRate >= 95) {
            status = 'GOOD';
            message = '👍 SOLID PERFORMANCE! Your platform handles high load well.';
            recommendations.push('✅ Good performance under load');
            recommendations.push('⚠️ Monitor for occasional errors');
        } else if (successRate >= 90) {
            status = 'ACCEPTABLE';
            message = '⚠️ ACCEPTABLE PERFORMANCE! Some optimization needed for viral success.';
            recommendations.push('⚠️ Consider optimization for viral traffic');
            recommendations.push('🔧 Review error handling');
        } else {
            status = 'NEEDS_IMPROVEMENT';
            message = '❌ PERFORMANCE NEEDS IMPROVEMENT! Not ready for viral traffic.';
            recommendations.push('❌ Significant optimization required');
            recommendations.push('🔧 Review architecture and scaling');
        }

        // Response Time Assessment for high-traffic cached endpoints
        if (avgResponseTime <= 20) {
            recommendations.push('✅ Excellent cached response times');
        } else if (avgResponseTime <= 50) {
            recommendations.push('✅ Good cached response times');
        } else if (avgResponseTime <= 100) {
            recommendations.push('⚠️ Response times could be optimized');
        } else {
            recommendations.push('❌ Response times need improvement');
        }

        // Percentile Assessment for viral traffic
        if (percentiles.p95 <= 50) {
            recommendations.push('✅ 95th percentile is excellent for viral traffic');
        } else if (percentiles.p95 <= 100) {
            recommendations.push('✅ 95th percentile is good');
        } else if (percentiles.p95 <= 200) {
            recommendations.push('⚠️ 95th percentile needs attention');
        } else {
            recommendations.push('❌ 95th percentile is too high for viral traffic');
        }

        if (percentiles.p99 <= 100) {
            recommendations.push('✅ 99th percentile is excellent');
        } else if (percentiles.p99 <= 200) {
            recommendations.push('⚠️ 99th percentile needs attention');
        } else {
            recommendations.push('❌ 99th percentile is too high');
        }

        return {
            status,
            message,
            recommendations
        };
    }
}

// Run the high concurrency test
if (require.main === module) {
    const tester = new HighConcurrencyTest();
    tester.run().catch(console.error);
}

module.exports = HighConcurrencyTest;
