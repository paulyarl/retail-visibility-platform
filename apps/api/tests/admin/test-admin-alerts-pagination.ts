/**
 * Test Admin Alerts Pagination
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLXI2Y2NjcGFnIiwidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1Il0sImlhdCI6MTc2ODY3NzI5OCwiZXhwIjoxODAwMjEzMjk4fQ.nVK88RcB54OjjjFLIjuBAfZVkW7Fx7cFUoi3cW5FaaE';

async function testAdminAlertsPagination() {
  console.log('🔍 Testing Admin Alerts Pagination');
  console.log('=====================================');

  try {
    // Test page 1 with limit 10
    console.log('\n📄 Testing page 1 with limit 10...');
    const response1 = await fetch(`${API_BASE_URL}/api/admin/security/alerts?page=1&limit=10`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'admin-alerts-pagination-test'
      }
    });

    if (!response1.ok) {
      throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
    }

    const data1 = await response1.json();
    console.log('✅ Page 1 Response:');
    console.log(`   Alerts: ${data1.data?.length || 0}`);
    console.log(`   Pagination:`, data1.pagination);

    // Test page 2
    if (data1.pagination?.hasNext) {
      console.log('\n📄 Testing page 2...');
      const response2 = await fetch(`${API_BASE_URL}/api/admin/security/alerts?page=2&limit=10`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Test-Script': 'admin-alerts-pagination-test'
        }
      });

      if (!response2.ok) {
        throw new Error(`HTTP ${response2.status}: ${response2.statusText}`);
      }

      const data2 = await response2.json();
      console.log('✅ Page 2 Response:');
      console.log(`   Alerts: ${data2.data?.length || 0}`);
      console.log(`   Pagination:`, data2.pagination);
    }

    // Test different page size
    console.log('\n📄 Testing page size 25...');
    const response3 = await fetch(`${API_BASE_URL}/api/admin/security/alerts?page=1&limit=25`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'admin-alerts-pagination-test'
      }
    });

    if (!response3.ok) {
      throw new Error(`HTTP ${response3.status}: ${response3.statusText}`);
    }

    const data3 = await response3.json();
    console.log('✅ Page Size 25 Response:');
    console.log(`   Alerts: ${data3.data?.length || 0}`);
    console.log(`   Pagination:`, data3.pagination);

  } catch (error) {
    console.error('❌ Admin alerts pagination test failed:', error);
  }
}

// Run if called directly
if (require.main === module) {
  testAdminAlertsPagination().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { testAdminAlertsPagination };
