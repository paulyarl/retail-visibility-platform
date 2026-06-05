/**
 * Frontend Telemetry Client Test Script
 * 
 * Simulates the client-side batching behavior to test:
 * 1. Event caching
 * 2. Priority-based batching
 * 3. Local storage persistence
 * 4. API batch sending
 */

// Mock security event types
interface SecurityAlertEvent {
  type: 'rate_limit_exceeded' | 'auth_failure' | 'suspicious_activity' | 'security_incident';
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  sessionId?: string;
  userId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  metadata: any;
}

// Mock telemetry cache (simplified version of the real one)
class MockTelemetryCache {
  private events: SecurityAlertEvent[] = [];
  private readonly MAX_CACHE_SIZE = 50;
  private readonly STORAGE_KEY = 'test_telemetry_cache';
  private readonly BATCH_INTERVAL = 5000; // 5 seconds for testing (instead of 15)
  private batchTimer: NodeJS.Timeout | null = null;
  private isSending = false;

  constructor() {
    this.loadFromStorage();
    this.startBatchTimer();
  }

  addEvent(event: Omit<SecurityAlertEvent, 'timestamp' | 'priority'>): void {
    const priority = this.determineEventPriority(event);
    const cachedEvent: SecurityAlertEvent = {
      ...event,
      timestamp: Date.now(),
      priority
    };

    this.events.push(cachedEvent);
    
    // Prevent excessive memory usage
    if (this.events.length > this.MAX_CACHE_SIZE) {
      this.events.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
      this.events = this.events.slice(-this.MAX_CACHE_SIZE);
    }
    
    this.saveToStorage();

    // Send critical events immediately
    if (priority === 'critical' && !this.isSending) {
      console.log('[Mock Telemetry] Critical event detected, sending immediately');
      setTimeout(() => this.sendBatch(), 100);
    }
  }

  private determineEventPriority(event: Omit<SecurityAlertEvent, 'timestamp' | 'priority'>): SecurityAlertEvent['priority'] {
    if (event.type === 'security_incident') return 'critical';
    if (event.type === 'auth_failure') return 'critical';
    if (event.type === 'suspicious_activity') return 'critical';
    if (event.type === 'rate_limit_exceeded') return 'high';
    if (event.severity === 'critical') return 'critical';
    if (event.severity === 'warning') return 'high';
    return 'normal';
  }

  private getPriorityWeight(priority?: SecurityAlertEvent['priority']): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'normal': return 2;
      case 'low': return 1;
      default: return 2;
    }
  }

  private async sendBatch(): Promise<void> {
    if (this.events.length === 0 || this.isSending) return;

    this.isSending = true;
    const eventsToSend = [...this.events];
    
    // Sort events by priority (critical first)
    eventsToSend.sort((a, b) => this.getPriorityWeight(b.priority) - this.getPriorityWeight(a.priority));
    
    this.events = []; // Clear cache immediately
    this.saveToStorage();

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      const batchData = {
        events: eventsToSend,
        batchMetadata: {
          batchSize: eventsToSend.length,
          priorityBreakdown: this.getPriorityBreakdown(eventsToSend),
          clientTimestamp: Date.now(),
          clientVersion: '1.0.0-test',
          testMode: true
        }
      };

      console.log(`[Mock Telemetry] Sending batch of ${eventsToSend.length} events:`, {
        types: this.getEventTypeBreakdown(eventsToSend),
        priorities: batchData.batchMetadata.priorityBreakdown
      });

      const response = await fetch(`${apiUrl}/api/security/telemetry/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Test-Client': 'frontend-telemetry-test'
        },
        body: JSON.stringify(batchData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`[Mock Telemetry] Batch sent successfully:`, {
        totalProcessed: result.totalProcessed,
        alertsCreated: result.totalAlertsCreated
      });

    } catch (error) {
      console.error('[Mock Telemetry] Batch failed, re-queuing events:', error);
      // Re-queue failed events
      this.events.unshift(...eventsToSend);
      this.saveToStorage();
    } finally {
      this.isSending = false;
    }
  }

  private getPriorityBreakdown(events: SecurityAlertEvent[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    events.forEach(event => {
      const priority = event.priority || 'normal';
      breakdown[priority] = (breakdown[priority] || 0) + 1;
    });
    return breakdown;
  }

  private getEventTypeBreakdown(events: SecurityAlertEvent[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    events.forEach(event => {
      breakdown[event.type] = (breakdown[event.type] || 0) + 1;
    });
    return breakdown;
  }

  private startBatchTimer(): void {
    if (typeof window === 'undefined') return;
    
    this.batchTimer = setInterval(() => {
      this.sendBatch();
    }, this.BATCH_INTERVAL);
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.events = Array.isArray(parsed) ? parsed : [];
        console.log(`[Mock Telemetry] Loaded ${this.events.length} events from storage`);
      }
    } catch (error) {
      console.warn('[Mock Telemetry] Failed to load from storage:', error);
      this.events = [];
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.warn('[Mock Telemetry] Failed to save to storage:', error);
    }
  }

  getMetrics() {
    return {
      totalEvents: this.events.length,
      priorityBreakdown: this.getPriorityBreakdown(this.events),
      typeBreakdown: this.getEventTypeBreakdown(this.events),
      oldestEvent: this.events.length > 0 ? this.events[0].timestamp : null,
      newestEvent: this.events.length > 0 ? this.events[this.events.length - 1].timestamp : null
    };
  }

  destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }
}

// Mock event generator
function generateMockEvent(index: number): Omit<SecurityAlertEvent, 'timestamp' | 'priority'> {
  const types: SecurityAlertEvent['type'][] = ['rate_limit_exceeded', 'auth_failure', 'suspicious_activity', 'security_incident'];
  const severities: SecurityAlertEvent['severity'][] = ['info', 'warning', 'critical'];
  
  const type = types[index % types.length];
  const severity = severities[index % severities.length];
  
  return {
    type,
    severity,
    sessionId: `test_session_${Math.random().toString(36).substr(2, 9)}`,
    userId: index % 3 === 0 ? 'test_user_123' : 'system',
    metadata: {
      endpoint: `/api/test/${index}`,
      method: 'GET',
      ipAddress: `192.168.1.${100 + (index % 50)}`,
      userAgent: `TestClient/${index}`,
      location: {
        city: 'Test City',
        country: 'TC'
      },
      device: {
        browser: 'TestBrowser',
        os: 'TestOS'
      },
      rateAnalysis: {
        currentRate: 10 + index,
        limit: 100,
        triggerReason: index > 50 ? 'limit_exceeded' : 'rate_too_high'
      }
    }
  };
}

// Test functions
async function runClientTest() {
  console.log('🚀 Starting Frontend Telemetry Client Test');
  console.log('==========================================');

  // Initialize cache
  const cache = new MockTelemetryCache();
  console.log('✅ Telemetry cache initialized');

  // Test 1: Add events rapidly
  console.log('\n📦 Adding events rapidly...');
  const eventCount = 25;
  const startTime = Date.now();
  
  for (let i = 0; i < eventCount; i++) {
    const event = generateMockEvent(i);
    cache.addEvent(event);
    
    // Small delay to simulate real usage
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  const addTime = Date.now() - startTime;
  console.log(`✅ Added ${eventCount} events in ${addTime}ms`);

  // Test 2: Check cache metrics
  console.log('\n📊 Cache metrics:');
  const metrics = cache.getMetrics();
  console.log(`   Total events: ${metrics.totalEvents}`);
  console.log(`   Priority breakdown:`, metrics.priorityBreakdown);
  console.log(`   Type breakdown:`, metrics.typeBreakdown);

  // Test 3: Wait for batch to send
  console.log('\n⏳ Waiting for batch to send (5 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 6000)); // Wait a bit longer than batch interval

  // Test 4: Check cache after batch
  console.log('\n📊 Cache metrics after batch:');
  const afterMetrics = cache.getMetrics();
  console.log(`   Total events: ${afterMetrics.totalEvents}`);
  console.log(`   Events sent: ${metrics.totalEvents - afterMetrics.totalEvents}`);

  // Test 5: Add critical events (should send immediately)
  console.log('\n🚨 Adding critical events (should send immediately)...');
  for (let i = 0; i < 3; i++) {
    const criticalEvent = generateMockEvent(eventCount + i);
    criticalEvent.type = 'security_incident';
    criticalEvent.severity = 'critical';
    cache.addEvent(criticalEvent);
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Wait for immediate send
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Test 6: Test storage persistence
  console.log('\n💾 Testing storage persistence...');
  const finalMetrics = cache.getMetrics();
  console.log(`   Final cache size: ${finalMetrics.totalEvents}`);
  
  // Destroy cache
  cache.destroy();
  console.log('✅ Cache destroyed');

  // Test 7: Reinitialize and check persistence
  console.log('\n🔄 Reinitializing cache to test persistence...');
  const newCache = new MockTelemetryCache();
  const persistedMetrics = newCache.getMetrics();
  console.log(`   Persisted events: ${persistedMetrics.totalEvents}`);
  
  newCache.destroy();

  console.log('\n🎉 Frontend telemetry test completed successfully!');
}

// Cleanup function
function cleanupTestData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('test_telemetry_cache');
    console.log('✅ Test data cleaned up from localStorage');
  }
}

// Export for use in other scripts
export { MockTelemetryCache, runClientTest, cleanupTestData, generateMockEvent };

// Auto-run if in browser environment
if (typeof window !== 'undefined') {
  // Add to global scope for manual testing
  (window as any).testTelemetry = {
    runTest: runClientTest,
    cleanup: cleanupTestData,
    cache: new MockTelemetryCache()
  };
  
  console.log('🔧 Telemetry test functions available at window.testTelemetry');
  console.log('   - Run: window.testTelemetry.runTest()');
  console.log('   - Cleanup: window.testTelemetry.cleanup()');
  console.log('   - Cache: window.testTelemetry.cache (add events manually)');
}
