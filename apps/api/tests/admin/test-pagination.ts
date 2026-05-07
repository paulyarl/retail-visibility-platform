/**
 * Test Pagination Implementation
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ1aWQtenFlNW5zNWsiLCJlbWFpbCI6InBsYXRmb3JtQHJ2cC5jb20iLCJyb2xlIjoiUExBVEZPUk1fQURNSU4iLCJ0ZW5hbnRJZHMiOlsidGlkLXI2Y2NjcGFnIiwidGlkLW04aWprcm5rIiwidGlkLTA0MmhpN2p1IiwidGlkLWx0MnQxd3p1Il0sImlhdCI6MTc2ODY3NzI5OCwiZXhwIjoxODAwMjEzMjk4fQ.nVK88RcB54OjjjFLIjuBAfZVkW7Fx7cFUoi3cW5FaaE';

async function testThreatsPagination() {
  console.log('🔍 Testing Threats Pagination');
  console.log('============================');

  try {
    // Test page 1
    console.log('\n📄 Testing page 1...');
    const response1 = await fetch(`${API_BASE_URL}/api/security/threats?page=1&limit=5&hours=168`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'pagination-test'
      }
    });

    if (!response1.ok) {
      throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
    }

    const data1 = await response1.json();
    console.log('✅ Page 1 Response:');
    console.log(`   Threats: ${data1.data?.threats?.length || 0}`);
    console.log(`   Pagination:`, data1.data?.pagination);

    // Test page 2
    if (data1.data?.pagination?.hasNext) {
      console.log('\n📄 Testing page 2...');
      const response2 = await fetch(`${API_BASE_URL}/api/security/threats?page=2&limit=5&hours=168`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ADMIN_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Test-Script': 'pagination-test'
        }
      });

      if (!response2.ok) {
        throw new Error(`HTTP ${response2.status}: ${response2.statusText}`);
      }

      const data2 = await response2.json();
      console.log('✅ Page 2 Response:');
      console.log(`   Threats: ${data2.data?.threats?.length || 0}`);
      console.log(`   Pagination:`, data2.data?.pagination);
    }

  } catch (error) {
    console.error('❌ Threats pagination test failed:', error);
  }
}

async function testBlockedIPsPagination() {
  console.log('\n🔍 Testing Blocked IPs Pagination');
  console.log('================================');

  try {
    // Test page 1
    console.log('\n📄 Testing page 1...');
    const response1 = await fetch(`${API_BASE_URL}/api/security/blocked-ips?page=1&limit=10&hours=168`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'pagination-test'
      }
    });

    if (!response1.ok) {
      throw new Error(`HTTP ${response1.status}: ${response1.statusText}`);
    }

    const data1 = await response1.json();
    console.log('✅ Page 1 Response:');
    console.log(`   Blocked IPs: ${data1.data?.blockedIPs?.length || 0}`);
    console.log(`   Pagination:`, data1.data?.pagination);

    // Test different page size
    console.log('\n📄 Testing page size 20...');
    const response2 = await fetch(`${API_BASE_URL}/api/security/blocked-ips?page=1&limit=20&hours=168`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Test-Script': 'pagination-test'
      }
    });

    if (!response2.ok) {
      throw new Error(`HTTP ${response2.status}: ${response2.statusText}`);
    }

    const data2 = await response2.json();
    console.log('✅ Page Size 20 Response:');
    console.log(`   Blocked IPs: ${data2.data?.blockedIPs?.length || 0}`);
    console.log(`   Pagination:`, data2.data?.pagination);

  } catch (error) {
    console.error('❌ Blocked IPs pagination test failed:', error);
  }
}

async function runTests() {
  console.log('🚀 Starting Pagination Tests');
  console.log('==========================');

  await testThreatsPagination();
  await testBlockedIPsPagination();

  console.log('\n🎉 Pagination tests completed!');
}

// Run if called directly
if (require.main === module) {
  runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
  });
}

export { testThreatsPagination, testBlockedIPsPagination };
