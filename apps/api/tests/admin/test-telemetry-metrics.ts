/**
 * Test Telemetry Metrics Endpoint with Admin Authentication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLXI2Y2NjcGFnIiwidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1Il0sImlhdCI6MTc2ODY3NzI5OCwiZXhwIjoxODAwMjEzMjk4fQ.nVK88RcB54OjjjFLIjuBAfZVkW7Fx7cFUoi3cW5FaaE';

async function testTelemetryMetrics() {
  console.log('🔍 Testing Telemetry Metrics Endpoint');
  console.log('=====================================');

  try {
    console.log('\n📡 Making authenticated request to metrics endpoint...');
    
    const response = await fetch(`${API_BASE_URL}/api/security/telemetry/metrics`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'telemetry-metrics-test'
      }
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as {
      success: boolean;
      metrics: {
        totalTelemetryEvents: number;
        telemetryAlertsCreated: number;
        telemetryByType: Array<{ eventType: string; count: number }>;
        telemetryByHour: Array<{ hour: number; count: number }>;
        timeRange: string;
        generatedAt: string;
      };
    };
    
    console.log('\n✅ Metrics endpoint successful!');
    console.log('\n📈 Telemetry Metrics:');
    console.log('==================');
    console.log(`Total Telemetry Events: ${data.metrics?.totalTelemetryEvents || 0}`);
    console.log(`Telemetry Alerts Created: ${data.metrics?.telemetryAlertsCreated || 0}`);
    console.log(`Time Range: ${data.metrics?.timeRange || 'N/A'}`);
    console.log(`Generated At: ${data.metrics?.generatedAt || 'N/A'}`);
    
    if (data.metrics?.telemetryByType && data.metrics.telemetryByType.length > 0) {
      console.log('\n📊 Events by Type:');
      data.metrics.telemetryByType.forEach((item: any) => {
        console.log(`   ${item.eventType}: ${item.count}`);
      });
    }
    
    if (data.metrics?.telemetryByHour && data.metrics.telemetryByHour.length > 0) {
      console.log('\n📈 Events by Hour:');
      data.metrics.telemetryByHour.forEach((item: any) => {
        console.log(`   Hour ${item.hour}: ${item.count} events`);
      });
    }

    console.log('\n🎉 Telemetry metrics test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Test without authentication (should fail)
async function testWithoutAuth() {
  console.log('\n🔓 Testing without authentication (should fail)...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/security/telemetry/metrics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Script': 'telemetry-metrics-test'
      }
    });

    if (response.status === 401) {
      console.log('✅ Correctly rejected unauthorized request (401)');
    } else {
      console.log(`⚠️  Unexpected response: ${response.status}`);
    }
  } catch (error) {
    console.error('Error testing without auth:', error);
  }
}

// Main test function
async function runTests() {
  console.log('🚀 Starting Telemetry Metrics Tests');
  console.log('=====================================');
  
  await testWithoutAuth();
  await testTelemetryMetrics();
}

// Run if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { testTelemetryMetrics, testWithoutAuth };
