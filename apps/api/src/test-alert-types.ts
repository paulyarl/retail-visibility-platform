/**
 * Test Admin Alert Types Endpoint
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLXI2Y2NjcGFnIiwidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1Il0sImlhdCI6MTc2ODY3NzI5OCwiZXhwIjoxODAwMjEzMjk4fQ.nVK88RcB54OjjjFLIjuBAfZVkW7Fx7cFUoi3cW5FaaE';

async function testAlertTypes() {
  console.log('🔍 Testing Admin Alert Types Endpoint');
  console.log('=====================================');

  try {
    console.log('\n📡 Making authenticated request to alert types...');
    
    const response = await fetch(`${API_BASE_URL}/api/admin/security/alerts/by-type?limit=5&hours=168`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'alert-types-test'
      }
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as {
      data: Array<{
        type: string;
        count: number;
        unreadCount: number;
        latestAlert: string;
        recentAlerts: Array<{
          title: string;
          userEmail: string;
        }>;
      }>;
      totalTypes: number;
      timeRange: string;
      generatedAt: string;
    };
    
    console.log('\n✅ Alert types endpoint successful!');
    console.log('\n📈 Alert Types Data:');
    console.log('==================');
    console.log(`Total Types: ${data.totalTypes || 0}`);
    console.log(`Time Range: ${data.timeRange || 'N/A'}`);
    console.log(`Generated At: ${data.generatedAt || 'N/A'}`);
    
    if (data.data && data.data.length > 0) {
      console.log('\n📊 Alert Types Breakdown:');
      data.data.forEach((type: any, index: number) => {
        console.log(`   ${index + 1}. ${type.type}`);
        console.log(`      Count: ${type.count}`);
        console.log(`      Unread: ${type.unreadCount}`);
        console.log(`      Latest: ${type.latestAlert}`);
        if (type.recentAlerts && type.recentAlerts.length > 0) {
          console.log(`      Recent: ${type.recentAlerts[0].title} (${type.recentAlerts[0].userEmail})`);
        }
        console.log('');
      });
    } else {
      console.log('\n⚠️  No alert types found');
    }

    console.log('\n🎉 Alert types test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testAlertTypes().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testAlertTypes };
