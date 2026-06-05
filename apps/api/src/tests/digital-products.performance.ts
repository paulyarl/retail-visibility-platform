/**
 * Digital Products Performance Tests
 * Load testing and performance benchmarks for digital product operations
 */

import { performance } from 'perf_hooks';
import { prisma } from '../prisma';
import { digitalAccessService } from '../services/digital-assets/DigitalAccessService';
import { digitalFulfillmentService } from '../services/digital-assets/DigitalFulfillmentService';

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
  accessGrantCreation: 100,
  accessValidation: 50,
  downloadRecording: 75,
  batchValidation: 500,
  bulkGrantCreation: 1000,
};

interface PerformanceResult {
  operation: string;
  duration: number;
  threshold: number;
  passed: boolean;
  iterations: number;
  avgPerIteration: number;
}

const results: PerformanceResult[] = [];

/**
 * Measure execution time of an async operation
 */
async function measureTime<T>(
  operation: string,
  fn: () => Promise<T>,
  iterations: number = 1
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, duration: end - start };
}

/**
 * Run a performance test and record results
 */
async function runPerformanceTest(
  operation: string,
  fn: () => Promise<void>,
  threshold: number,
  iterations: number = 1
): Promise<PerformanceResult> {
  const start = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  
  const end = performance.now();
  const duration = end - start;
  const avgPerIteration = duration / iterations;
  
  const result: PerformanceResult = {
    operation,
    duration,
    threshold,
    passed: duration <= threshold * iterations,
    iterations,
    avgPerIteration,
  };
  
  results.push(result);
  return result;
}

/**
 * Performance Test Suite
 */
export async function runPerformanceTests(): Promise<PerformanceResult[]> {
  console.log('🚀 Starting Digital Products Performance Tests\n');
  console.log('='.repeat(60));

  // Test 1: Access Grant Creation Performance
  await runPerformanceTest(
    'Access Grant Creation',
    async () => {
      await digitalAccessService.createAccessGrant({
        orderId: `perf_test_order_${Date.now()}`,
        orderItemId: `perf_test_item_${Date.now()}`,
        inventoryItemId: 'perf_test_inventory',
        customerEmail: 'perf-test@example.com',
        downloadLimit: 5,
        accessDurationDays: 30,
      });
    },
    THRESHOLDS.accessGrantCreation,
    10
  );

  // Test 2: Access Validation Performance
  const grant = await digitalAccessService.createAccessGrant({
    orderId: 'perf_validation_order',
    orderItemId: 'perf_validation_item',
    inventoryItemId: 'perf_validation_inventory',
    customerEmail: 'perf-validation@example.com',
    downloadLimit: 10,
    accessDurationDays: 30,
  });

  await runPerformanceTest(
    'Access Token Validation',
    async () => {
      await digitalAccessService.validateAccess(grant.accessToken);
    },
    THRESHOLDS.accessValidation,
    100
  );

  // Test 3: Download Recording Performance
  const downloadGrant = await digitalAccessService.createAccessGrant({
    orderId: 'perf_download_order',
    orderItemId: 'perf_download_item',
    inventoryItemId: 'perf_download_inventory',
    customerEmail: 'perf-download@example.com',
    downloadLimit: 100,
    accessDurationDays: 30,
  });

  await runPerformanceTest(
    'Download Recording',
    async () => {
      await digitalAccessService.recordDownload(downloadGrant.accessToken);
    },
    THRESHOLDS.downloadRecording,
    50
  );

  // Test 4: Batch Access Validation
  const batchTokens: string[] = [];
  for (let i = 0; i < 20; i++) {
    const g = await digitalAccessService.createAccessGrant({
      orderId: `perf_batch_order_${i}`,
      orderItemId: `perf_batch_item_${i}`,
      inventoryItemId: 'perf_batch_inventory',
      customerEmail: `perf-batch-${i}@example.com`,
      downloadLimit: 5,
      accessDurationDays: 30,
    });
    batchTokens.push(g.accessToken);
  }

  await runPerformanceTest(
    'Batch Access Validation (20 tokens)',
    async () => {
      await Promise.all(
        batchTokens.map(token => digitalAccessService.validateAccess(token))
      );
    },
    THRESHOLDS.batchValidation,
    1
  );

  // Test 5: Bulk Grant Creation
  await runPerformanceTest(
    'Bulk Grant Creation (50 grants)',
    async () => {
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          digitalAccessService.createAccessGrant({
            orderId: `perf_bulk_order_${Date.now()}_${i}`,
            orderItemId: `perf_bulk_item_${i}`,
            inventoryItemId: 'perf_bulk_inventory',
            customerEmail: `perf-bulk-${i}@example.com`,
            downloadLimit: 5,
            accessDurationDays: 30,
          })
        );
      }
      await Promise.all(promises);
    },
    THRESHOLDS.bulkGrantCreation,
    1
  );

  // Test 6: Access Stats Query Performance
  await runPerformanceTest(
    'Access Statistics Query',
    async () => {
      await digitalAccessService.getAccessStats('perf_test_inventory');
    },
    100,
    20
  );

  // Test 7: Get Grants by Email Performance
  await runPerformanceTest(
    'Get Grants by Email',
    async () => {
      await digitalAccessService.getAccessGrantsByEmail('perf-test@example.com');
    },
    100,
    20
  );

  // Print Results
  console.log('\n📊 Performance Test Results');
  console.log('='.repeat(60));
  console.log(
    'Operation'.padEnd(35) +
    'Duration'.padEnd(15) +
    'Threshold'.padEnd(12) +
    'Status'
  );
  console.log('-'.repeat(60));

  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const durationStr = result.iterations > 1
      ? `${result.duration.toFixed(2)}ms (${result.iterations} iters, avg ${result.avgPerIteration.toFixed(2)}ms)`
      : `${result.duration.toFixed(2)}ms`;
    
    console.log(
      result.operation.padEnd(35) +
      durationStr.padEnd(15) +
      `${result.threshold}ms`.padEnd(12) +
      status
    );
  }

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some performance tests failed. Consider optimizing:');
    for (const result of results.filter(r => !r.passed)) {
      console.log(`  - ${result.operation}: ${result.duration.toFixed(2)}ms (threshold: ${result.threshold}ms)`);
    }
  } else {
    console.log('\n✅ All performance tests passed!');
  }

  return results;
}

/**
 * Stress Test: Concurrent Downloads
 */
export async function runStressTest_ConcurrentDownloads(
  concurrency: number = 50
): Promise<void> {
  console.log(`\n🔥 Stress Test: ${concurrency} Concurrent Downloads`);
  console.log('='.repeat(60));

  const grant = await digitalAccessService.createAccessGrant({
    orderId: 'stress_test_order',
    orderItemId: 'stress_test_item',
    inventoryItemId: 'stress_test_inventory',
    customerEmail: 'stress-test@example.com',
    downloadLimit: concurrency + 10,
    accessDurationDays: 30,
  });

  const start = performance.now();
  
  const promises = Array.from({ length: concurrency }, async (_, i) => {
    try {
      await digitalAccessService.recordDownload(grant.accessToken);
      return { success: true, index: i };
    } catch (error) {
      return { success: false, index: i, error };
    }
  });

  const outcomes = await Promise.all(promises);
  const end = performance.now();
  
  const successful = outcomes.filter(o => o.success).length;
  const failed = outcomes.filter(o => !o.success).length;
  
  console.log(`Duration: ${(end - start).toFixed(2)}ms`);
  console.log(`Successful: ${successful}/${concurrency}`);
  console.log(`Failed: ${failed}/${concurrency}`);
  console.log(`Throughput: ${(concurrency / ((end - start) / 1000)).toFixed(2)} ops/sec`);
}

/**
 * Memory Usage Test
 */
export async function runMemoryTest(): Promise<void> {
  console.log('\n💾 Memory Usage Test');
  console.log('='.repeat(60));

  const initialMemory = process.memoryUsage();
  
  // Create 100 grants
  const grants = [];
  for (let i = 0; i < 100; i++) {
    const grant = await digitalAccessService.createAccessGrant({
      orderId: `memory_test_order_${i}`,
      orderItemId: `memory_test_item_${i}`,
      inventoryItemId: 'memory_test_inventory',
      customerEmail: `memory-test-${i}@example.com`,
      downloadLimit: 5,
      accessDurationDays: 30,
    });
    grants.push(grant);
  }

  const finalMemory = process.memoryUsage();
  
  console.log('Initial Memory:');
  console.log(`  Heap Used: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total: ${(initialMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  
  console.log('Final Memory (after 100 grants):');
  console.log(`  Heap Used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Heap Total: ${(finalMemory.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  
  const heapIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
  console.log(`  Heap Increase: ${heapIncrease.toFixed(2)} MB`);
  console.log(`  Avg per grant: ${(heapIncrease * 1024 / 100).toFixed(2)} KB`);
}

/**
 * Run all performance tests
 */
export async function runAllPerformanceTests(): Promise<void> {
  try {
    await runPerformanceTests();
    await runStressTest_ConcurrentDownloads(50);
    await runMemoryTest();
    
    console.log('\n🎉 All performance tests completed!');
  } catch (error) {
    console.error('\n❌ Performance test suite failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Export for running as standalone script
if (require.main === module) {
  runAllPerformanceTests();
}
