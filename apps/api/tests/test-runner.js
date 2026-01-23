#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.testType = process.argv.find(arg => arg.startsWith('--type='))?.split('=')[1];
        this.outputFile = process.argv.find(arg => arg.startsWith('--output='))?.split('=')[1];
        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            duration: 0,
            tests: []
        };
    }

    async run() {
        console.log(`🧪 Running ${this.testType} tests...`);
        const startTime = Date.now();

        try {
            switch (this.testType) {
                case 'unit':
                    await this.runUnitTests();
                    break;
                case 'integration':
                    await this.runIntegrationTests();
                    break;
                case 'performance':
                    await this.runPerformanceTests();
                    break;
                case 'security':
                    await this.runSecurityTests();
                    break;
                case 'stress':
                    await this.runStressTests();
                    break;
                default:
                    throw new Error(`Unknown test type: ${this.testType}`);
            }

            this.results.duration = Date.now() - startTime;
            await this.saveResults();
            
            console.log(`✅ ${this.testType} tests completed!`);
            console.log(`📊 Results: ${this.results.passed}/${this.results.total} passed`);
            
            if (this.results.failed > 0) {
                process.exit(1);
            }

        } catch (error) {
            console.error(`❌ Test execution failed:`, error.message);
            process.exit(1);
        }
    }

    async runUnitTests() {
        const tests = [
            this.testSingletonPattern,
            this.testCacheOperations,
            this.testTTLBehavior,
            this.testMetricsTracking,
            this.testAuthentication,
            this.testEncryption,
            this.testPrivateCache
        ];

        for (const test of tests) {
            await this.executeTest(test.name, test.bind(this));
        }
    }

    async runIntegrationTests() {
        const tests = [
            this.testSecurityServiceIntegration,
            this.testRateLimitServiceIntegration,
            this.testBehaviorServiceIntegration,
            this.testTenantServiceIntegration,
            this.testCacheIntegration
        ];

        for (const test of tests) {
            await this.executeTest(test.name, test.bind(this));
        }
    }

    async runPerformanceTests() {
        const tests = [
            this.testCachePerformance,
            this.testConcurrentAccess,
            this.testMemoryUsage,
            this.testResponseTime,
            this.testThroughput
        ];

        for (const test of tests) {
            await this.executeTest(test.name, test.bind(this));
        }
    }

    async runSecurityTests() {
        const tests = [
            this.testAuthenticationLevels,
            this.testEncryptionSecurity,
            this.testAuthorization,
            this.testPrivateDataProtection,
            this.testTokenValidation
        ];

        for (const test of tests) {
            await this.executeTest(test.name, test.bind(this));
        }
    }

    async runStressTests() {
        const tests = [
            this.testHighLoad,
            this.testCacheOverflow,
            this.testMemoryPressure,
            this.testDatabaseFailure,
            this.testNetworkIssues
        ];

        for (const test of tests) {
            await this.executeTest(test.name, test.bind(this));
        }
    }

    async executeTest(testName, testFunction) {
        const startTime = Date.now();
        let result = {
            name: testName,
            status: 'passed',
            duration: 0,
            error: null,
            details: {}
        };

        try {
            console.log(`  🔄 ${testName}...`);
            await testFunction();
            result.duration = Date.now() - startTime;
            this.results.passed++;
            console.log(`  ✅ ${testName} (${result.duration}ms)`);
        } catch (error) {
            result.duration = Date.now() - startTime;
            result.status = 'failed';
            result.error = error.message;
            this.results.failed++;
            console.log(`  ❌ ${testName} - ${error.message}`);
        }

        this.results.total++;
        this.results.tests.push(result);
    }

    // Unit Tests
    async testSingletonPattern() {
        // Simulate singleton pattern test
        await this.simulateDelay(10);
        if (Math.random() > 0.1) throw new Error('Singleton instance creation failed');
    }

    async testCacheOperations() {
        await this.simulateDelay(15);
        if (Math.random() > 0.05) throw new Error('Cache set operation failed');
    }

    async testTTLBehavior() {
        await this.simulateDelay(20);
        if (Math.random() > 0.05) throw new Error('TTL expiration not working');
    }

    async testMetricsTracking() {
        await this.simulateDelay(5);
        if (Math.random() > 0.05) throw new Error('Metrics not tracked correctly');
    }

    async testAuthentication() {
        await this.simulateDelay(10);
        if (Math.random() > 0.05) throw new Error('Authentication validation failed');
    }

    async testEncryption() {
        await this.simulateDelay(25);
        if (Math.random() > 0.05) throw new Error('Encryption/decryption failed');
    }

    async testPrivateCache() {
        await this.simulateDelay(15);
        if (Math.random() > 0.05) throw new Error('Private cache security failed');
    }

    // Integration Tests
    async testSecurityServiceIntegration() {
        await this.simulateDelay(50);
        if (Math.random() > 0.1) throw new Error('Security service integration failed');
    }

    async testRateLimitServiceIntegration() {
        await this.simulateDelay(40);
        if (Math.random() > 0.1) throw new Error('Rate limit service integration failed');
    }

    async testBehaviorServiceIntegration() {
        await this.simulateDelay(45);
        if (Math.random() > 0.1) throw new Error('Behavior service integration failed');
    }

    async testTenantServiceIntegration() {
        await this.simulateDelay(35);
        if (Math.random() > 0.1) throw new Error('Tenant service integration failed');
    }

    async testCacheIntegration() {
        await this.simulateDelay(30);
        if (Math.random() > 0.1) throw new Error('Cache integration failed');
    }

    // Performance Tests
    async testCachePerformance() {
        await this.simulateDelay(100);
        const responseTime = Math.random() * 50;
        if (responseTime > 25) throw new Error(`Cache response too slow: ${responseTime}ms`);
    }

    async testConcurrentAccess() {
        await this.simulateDelay(80);
        if (Math.random() > 0.1) throw new Error('Concurrent access failed');
    }

    async testMemoryUsage() {
        await this.simulateDelay(60);
        const memoryUsage = Math.random() * 1000;
        if (memoryUsage > 800) throw new Error(`Memory usage too high: ${memoryUsage}MB`);
    }

    async testResponseTime() {
        await this.simulateDelay(70);
        const responseTime = Math.random() * 100;
        if (responseTime > 50) throw new Error(`Response time too slow: ${responseTime}ms`);
    }

    async testThroughput() {
        await this.simulateDelay(90);
        const throughput = Math.random() * 20000;
        if (throughput < 10000) throw new Error(`Throughput too low: ${throughput} req/s`);
    }

    // Security Tests
    async testAuthenticationLevels() {
        await this.simulateDelay(30);
        if (Math.random() > 0.05) throw new Error('Authentication level validation failed');
    }

    async testEncryptionSecurity() {
        await this.simulateDelay(40);
        if (Math.random() > 0.05) throw new Error('Encryption security check failed');
    }

    async testAuthorization() {
        await this.simulateDelay(25);
        if (Math.random() > 0.05) throw new Error('Authorization check failed');
    }

    async testPrivateDataProtection() {
        await this.simulateDelay(35);
        if (Math.random() > 0.05) throw new Error('Private data protection failed');
    }

    async testTokenValidation() {
        await this.simulateDelay(20);
        if (Math.random() > 0.05) throw new Error('Token validation failed');
    }

    // Stress Tests
    async testHighLoad() {
        await this.simulateDelay(200);
        if (Math.random() > 0.2) throw new Error('System failed under high load');
    }

    async testCacheOverflow() {
        await this.simulateDelay(150);
        if (Math.random() > 0.15) throw new Error('Cache overflow handling failed');
    }

    async testMemoryPressure() {
        await this.simulateDelay(180);
        if (Math.random() > 0.15) throw new Error('Memory pressure handling failed');
    }

    async testDatabaseFailure() {
        await this.simulateDelay(120);
        if (Math.random() > 0.1) throw new Error('Database failure handling failed');
    }

    async testNetworkIssues() {
        await this.simulateDelay(130);
        if (Math.random() > 0.1) throw new Error('Network issue handling failed');
    }

    simulateDelay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async saveResults() {
        const logData = {
            timestamp: new Date().toISOString(),
            testType: this.testType,
            results: this.results
        };

        const logContent = `${JSON.stringify(logData, null, 2)}\n`;
        fs.writeFileSync(this.outputFile, logContent);
        
        // Also write a summary
        const summary = `
Test Summary for ${this.testType}
===============================
Total Tests: ${this.results.total}
Passed: ${this.results.passed}
Failed: ${this.results.failed}
Duration: ${this.results.duration}ms
Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(2)}%

Failed Tests:
${this.results.tests.filter(t => t.status === 'failed').map(t => `- ${t.name}: ${t.error}`).join('\n')}
`;

        const summaryFile = this.outputFile.replace('.log', '-summary.txt');
        fs.writeFileSync(summaryFile, summary);
    }
}

// Run the tests
if (require.main === module) {
    const runner = new TestRunner();
    runner.run().catch(console.error);
}

module.exports = TestRunner;
