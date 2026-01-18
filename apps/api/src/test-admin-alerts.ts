/**
 * Test Admin Security Alerts Endpoint
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLXI2Y2NjcGFnIiwidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1Il0sImlhdCI6MTc2ODY3NzI5OCwiZXhwIjoxODAwMjEzMjk4fQ.nVK88RcB54OjjjFLIjuBAfZVkW7Fx7cFUoi3cW5FaaE';

async function testAdminAlerts() {
  console.log('🔍 Testing Admin Security Alerts Endpoint');
  console.log('=====================================');

  try {
    console.log('\n📡 Making authenticated request to admin alerts...');
    
    const response = await fetch(`${API_BASE_URL}/api/admin/security/alerts`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'admin-alerts-test'
      }
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    
    console.log('\n✅ Admin alerts endpoint successful!');
    console.log('\n📈 Admin Alerts Data:');
    console.log('====================');
    console.log(`Total Alerts: ${data.total || 0}`);
    console.log(`Returned Alerts: ${data.data?.length || 0}`);
    
    if (data.data && data.data.length > 0) {
      console.log('\n📋 Recent Alerts:');
      data.data.slice(0, 5).forEach((alert: any, index: number) => {
        console.log(`   ${index + 1}. ${alert.title} (${alert.type})`);
        console.log(`      User: ${alert.userEmail} | Severity: ${alert.severity}`);
        console.log(`      Created: ${alert.createdAt}`);
        console.log(`      Message: ${alert.message.substring(0, 100)}${alert.message.length > 100 ? '...' : ''}`);
        console.log('');
      });
    }

    // Test stats endpoint
    console.log('\n📊 Testing alerts stats endpoint...');
    
    const statsResponse = await fetch(`${API_BASE_URL}/api/admin/security/alerts/stats`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'admin-alerts-test'
      }
    });

    if (statsResponse.ok) {
      const statsData = await statsResponse.json();
      console.log('✅ Stats endpoint successful!');
      console.log('\n📈 Alert Statistics:');
      console.log('==================');
      console.log(`Total Alerts: ${statsData.totalAlerts || 0}`);
      console.log(`Unread Alerts: ${statsData.unreadAlerts || 0}`);
      console.log(`Last 24h: ${statsData.alertsLast24h || 0}`);
      console.log(`Critical: ${statsData.criticalAlerts || 0}`);
      console.log(`Warning: ${statsData.warningAlerts || 0}`);
      
      if (statsData.typeBreakdown && statsData.typeBreakdown.length > 0) {
        console.log('\n📊 Alert Types:');
        statsData.typeBreakdown.forEach((type: any) => {
          console.log(`   ${type.type}: ${type.count}`);
        });
      }
    } else {
      console.log(`⚠️  Stats endpoint returned ${statsResponse.status}`);
    }

    console.log('\n🎉 Admin alerts test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testAdminAlerts().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testAdminAlerts };
