/**
 * Security Telemetry Batch Test Script
 * 
 * Tests the complete telemetry system:
 * 1. Frontend batching simulation
 * 2. API endpoint processing
 * 3. Database storage
 * 4. Alert creation
 * 5. Rate analysis
 */

import { prisma } from './prisma';

// Test configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

// Mock security event generator
function generateMockSecurityEvent(type: string, index: number) {
  const baseEvent = {
    timestamp: Date.now() + (index * 100), // 100ms apart
    sessionId: `test_session_${Math.random().toString(36).substr(2, 9)}`,
    userId: null, // Use null to avoid foreign key constraint issues
    priority: index % 4 === 0 ? 'critical' : index % 2 === 0 ? 'high' : 'normal',
    metadata: {
      endpoint: ['/api/tenants', '/api/items', '/api/auth/login', '/api/search'][index % 4],
      method: ['GET', 'POST', 'PUT', 'DELETE'][index % 4],
      ipAddress: `192.168.1.${100 + (index % 50)}`,
      userAgent: `TestBot/${index % 5 + 1}.0`,
      location: {
        city: ['New York', 'London', 'Tokyo', 'Moscow', 'Beijing'][index % 5],
        country: ['US', 'UK', 'JP', 'RU', 'CN'][index % 5],
        timezone: ['America/New_York', 'Europe/London', 'Asia/Tokyo'][index % 3]
      },
      device: {
        browser: ['Chrome', 'Firefox', 'Safari', 'Edge', 'Bot/Crawler'][index % 5],
        os: ['Windows', 'macOS', 'Linux', 'Android', 'iOS'][index % 5],
        isBot: index % 10 === 0, // 10% bots
        isMobile: index % 3 === 0,
        isTablet: index % 5 === 0,
        isDesktop: index % 2 === 0
      },
      network: {
        ip: `192.168.1.${100 + (index % 50)}`,
        isBehindProxy: index % 4 === 0,
        proxyChain: index % 4 === 0 ? [`proxy-${index}.example.com`] : []
      },
      rateAnalysis: {
        currentRate: 10 + (index * 5),
        ratePerMinute: 10 + (index * 5),
        historicalAverage: 2.3,
        rateTrend: ['increasing', 'decreasing', 'stable'][index % 3],
        limitInfo: {
          limit: 100,
          current: 10 + (index * 5),
          remaining: 90 - (index * 5),
          windowMs: 900000,
          resetTime: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        },
        triggerReason: (10 + (index * 5) >= 100) ? 'limit_exceeded' : 'rate_too_high'
      },
      threatLevel: ['low', 'medium', 'high', 'critical'][index % 4],
      riskFactors: [
        'High request frequency',
        'External actor',
        'Bot/Crawler detected',
        'Geographic anomaly'
      ].filter((_, i) => i < (index % 3) + 1),
      isSuspicious: index % 3 === 0
    }
  };

  // Add type-specific metadata
  switch (type) {
    case 'rate_limit_exceeded':
      return {
        ...baseEvent,
        type: 'rate_limit_exceeded',
        severity: baseEvent.metadata.rateAnalysis.triggerReason === 'limit_exceeded' ? 'warning' : 'info'
      };
    
    case 'auth_failure':
      return {
        ...baseEvent,
        type: 'auth_failure',
        severity: 'critical',
        metadata: {
          ...baseEvent.metadata,
          attemptedEmail: `test${index}@example.com`,
          failureReason: 'invalid_credentials'
        }
      };
    
    case 'suspicious_activity':
      return {
        ...baseEvent,
        type: 'suspicious_activity',
        severity: baseEvent.metadata.threatLevel === 'critical' ? 'critical' : 'warning',
        metadata: {
          ...baseEvent.metadata,
          activity: 'Unusual access pattern detected',
          pattern: 'Rapid sequential requests'
        }
      };
    
    case 'security_incident':
      return {
        ...baseEvent,
        type: 'security_incident',
        severity: 'critical',
        metadata: {
          ...baseEvent.metadata,
          incident: 'Potential brute force attack',
          confidence: 0.85
        }
      };
    
    default:
      return baseEvent;
  }
}

// Generate test batches
function generateTestBatches() {
  const batches = [];
  
  // Batch 1: Rate limit exceeded (most common)
  batches.push({
    name: 'Rate Limit Exceeded',
    events: Array.from({ length: 25 }, (_, i) => 
      generateMockSecurityEvent('rate_limit_exceeded', i)
    ),
    batchMetadata: {
      batchSize: 25,
      priorityBreakdown: { critical: 2, high: 8, normal: 15 },
      clientTimestamp: Date.now(),
      clientVersion: '1.0.0',
      eventType: 'rate_limit_exceeded'
    }
  });

  // Batch 2: Authentication failures
  batches.push({
    name: 'Authentication Failures',
    events: Array.from({ length: 10 }, (_, i) => 
      generateMockSecurityEvent('auth_failure', i + 25)
    ),
    batchMetadata: {
      batchSize: 10,
      priorityBreakdown: { critical: 10 },
      clientTimestamp: Date.now(),
      clientVersion: '1.0.0',
      eventType: 'auth_failure'
    }
  });

  // Batch 3: Suspicious activity
  batches.push({
    name: 'Suspicious Activity',
    events: Array.from({ length: 15 }, (_, i) => 
      generateMockSecurityEvent('suspicious_activity', i + 35)
    ),
    batchMetadata: {
      batchSize: 15,
      priorityBreakdown: { critical: 3, high: 7, normal: 5 },
      clientTimestamp: Date.now(),
      clientVersion: '1.0.0',
      eventType: 'suspicious_activity'
    }
  });

  // Batch 4: Security incidents
  batches.push({
    name: 'Security Incidents',
    events: Array.from({ length: 5 }, (_, i) => 
      generateMockSecurityEvent('security_incident', i + 50)
    ),
    batchMetadata: {
      batchSize: 5,
      priorityBreakdown: { critical: 5 },
      clientTimestamp: Date.now(),
      clientVersion: '1.0.0',
      eventType: 'security_incident'
    }
  });

  return batches;
}

// Send batch to API
async function sendBatchToAPI(batchName: string, events: any[], batchMetadata: any) {
  try {
    console.log(`\n📤 Sending batch: ${batchName}`);
    console.log(`   Events: ${events.length}`);
    console.log(`   Priority breakdown:`, batchMetadata.priorityBreakdown);
    console.log(`[Mock Telemetry] Sending batch of ${events.length} events:`, {
      types: events.map(event => event.type),
      priorities: batchMetadata.priorityBreakdown,
      sampleEvent: events[0],
      requestSize: JSON.stringify({ events, batchMetadata }).length
    });

    const response = await fetch(`${API_BASE_URL}/api/security/telemetry/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Script': 'telemetry-batch-test'
      },
      body: JSON.stringify({
        events,
        batchMetadata
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ Batch sent successfully:`, {
      totalProcessed: result.totalProcessed,
      totalAlertsCreated: result.totalAlertsCreated,
      results: Object.keys(result.results).map(key => ({
        type: key,
        success: result.results[key].success,
        processed: result.results[key].processed
      }))
    });

    return result;
  } catch (error) {
    console.error(`❌ Failed to send batch ${batchName}:`, error);
    throw error;
  }
}

// Verify database storage
async function verifyDatabaseStorage() {
  try {
    console.log('\n🔍 Verifying database storage...');

    // Check recent security alerts
    const recentAlerts = await prisma.security_alerts.findMany({
      where: {
        created_at: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        },
        metadata: {
          path: ['$', 'telemetrySource'],
          equals: 'frontend_batch'
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    console.log(`📊 Found ${recentAlerts.length} recent telemetry alerts:`);
    recentAlerts.forEach((alert, index) => {
      console.log(`   ${index + 1}. ${alert.type} - ${alert.severity} - ${alert.title}`);
      console.log(`      User: ${alert.user_id} | Created: ${alert.created_at.toISOString()}`);
      console.log(`      Telemetry: ${alert.metadata?.telemetrySource} | Batch: ${alert.metadata?.batchId}`);
    });

    // Check rate limit warnings
    const recentWarnings = await prisma.rate_limit_warnings.findMany({
      where: {
        occurred_at: {
          gte: new Date(Date.now() - 5 * 60 * 1000)
        }
      },
      orderBy: { occurred_at: 'desc' },
      take: 5
    });

    console.log(`\n⚠️  Found ${recentWarnings.length} recent rate limit warnings:`);
    recentWarnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. IP: ${warning.ip_address} | Path: ${warning.pathname}`);
      console.log(`      Blocked: ${warning.blocked} | Requests: ${warning.request_count}/${warning.max_requests}`);
    });

    return { alerts: recentAlerts.length, warnings: recentWarnings.length };
  } catch (error) {
    console.error('❌ Failed to verify database storage:', error);
    throw error;
  }
}

// Test telemetry metrics endpoint
async function testTelemetryMetrics() {
  try {
    console.log('\n📈 Testing telemetry metrics endpoint...');

    const response = await fetch(`${API_BASE_URL}/api/security/telemetry/metrics`, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer test-token', // This will fail but we can see the endpoint
        'X-Test-Script': 'telemetry-batch-test'
      }
    });

    if (response.ok) {
      const metrics = await response.json();
      console.log('✅ Telemetry metrics:', {
        totalTelemetryEvents: metrics.metrics.totalTelemetryEvents,
        telemetryAlertsCreated: metrics.metrics.telemetryAlertsCreated,
        eventTypes: metrics.metrics.telemetryByType.length,
        timeRange: metrics.metrics.timeRange
      });
    } else {
      console.log(`ℹ️  Metrics endpoint returned ${response.status} (expected without auth)`);
    }
  } catch (error) {
    console.error('❌ Failed to test metrics endpoint:', error);
  }
}

// Main test function
async function runTelemetryBatchTest() {
  console.log('🚀 Starting Security Telemetry Batch Test');
  console.log('=====================================');

  try {
    // Step 1: Generate test batches
    console.log('\n📦 Generating test batches...');
    const batches = generateTestBatches();
    console.log(`Generated ${batches.length} test batches:`);
    batches.forEach(batch => {
      console.log(`   - ${batch.name}: ${batch.events.length} events`);
    });

    // Step 2: Send batches to API
    console.log('\n📡 Sending batches to API...');
    const results = [];
    for (const batch of batches) {
      const result = await sendBatchToAPI(batch.name, batch.events, batch.batchMetadata);
      results.push(result);
      
      // Small delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Step 3: Verify database storage
    const storageResult = await verifyDatabaseStorage();

    // Step 4: Test metrics endpoint
    await testTelemetryMetrics();

    // Step 5: Summary
    console.log('\n🎉 Test Summary');
    console.log('=============');
    console.log(`✅ Batches sent: ${batches.length}`);
    console.log(`✅ Total events: ${batches.reduce((sum, batch) => sum + batch.events.length, 0)}`);
    console.log(`✅ Alerts created: ${results.reduce((sum, result) => sum + result.totalAlertsCreated, 0)}`);
    console.log(`✅ Database alerts: ${storageResult.alerts}`);
    console.log(`✅ Database warnings: ${storageResult.warnings}`);
    console.log('\n🏆 Telemetry batch test completed successfully!');

  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }
}

// Cleanup function
async function cleanupTestData() {
  try {
    console.log('\n🧹 Cleaning up test data...');
    
    // Delete test alerts (created in last 10 minutes)
    const deletedAlerts = await prisma.security_alerts.deleteMany({
      where: {
        created_at: {
          gte: new Date(Date.now() - 10 * 60 * 1000)
        },
        metadata: {
          path: ['$', 'telemetrySource'],
          equals: 'frontend_batch'
        }
      }
    });

    // Delete test warnings
    const deletedWarnings = await prisma.rate_limit_warnings.deleteMany({
      where: {
        occurred_at: {
          gte: new Date(Date.now() - 10 * 60 * 1000)
        },
        ip_address: {
          startsWith: '192.168.1.1' // Test IP range
        }
      }
    });

    console.log(`✅ Cleaned up ${deletedAlerts.count} alerts and ${deletedWarnings.count} warnings`);
  } catch (error) {
    console.error('❌ Failed to cleanup:', error);
  }
}

// Run test if called directly
if (require.main === module) {
  const command = process.argv[2];
  
  async function main() {
    if (command === 'cleanup') {
      await cleanupTestData();
    } else {
      await runTelemetryBatchTest();
    }
    
    await prisma.$disconnect();
  }
  
  main().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { runTelemetryBatchTest, cleanupTestData, generateTestBatches };
