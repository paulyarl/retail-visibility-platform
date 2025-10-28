/**
 * Test script for authentication endpoints
 * Run with: npx tsx scripts/test-auth.ts
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testAuth() {
  console.log('🧪 Testing Authentication System\n');
  console.log(`API Base URL: ${API_BASE_URL}\n`);

  // Test data
  const testUser = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'Test',
    lastName: 'User',
  };

  try {
    // 1. Test Registration
    console.log('1️⃣  Testing Registration...');
    const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser),
    });

    if (registerResponse.ok) {
      const registerData = await registerResponse.json();
      console.log('✅ Registration successful!');
      console.log('   User ID:', registerData.user.id);
      console.log('   Email:', registerData.user.email);
      console.log('   Role:', registerData.user.role);
    } else {
      const error = await registerResponse.json();
      console.log('❌ Registration failed:', error.message);
      if (error.message.includes('already exists')) {
        console.log('   (User already exists, continuing with login test...)\n');
      } else {
        throw new Error(error.message);
      }
    }

    // 2. Test Login
    console.log('\n2️⃣  Testing Login...');
    const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testUser.email,
        password: testUser.password,
      }),
    });

    if (!loginResponse.ok) {
      const error = await loginResponse.json();
      throw new Error(`Login failed: ${error.message}`);
    }

    const loginData = await loginResponse.json();
    console.log('✅ Login successful!');
    console.log('   Access Token:', loginData.accessToken.substring(0, 20) + '...');
    console.log('   Refresh Token:', loginData.refreshToken.substring(0, 20) + '...');
    console.log('   User:', loginData.user.email);
    console.log('   Tenants:', loginData.user.tenants.length);

    const accessToken = loginData.accessToken;
    const refreshToken = loginData.refreshToken;

    // 3. Test /auth/me
    console.log('\n3️⃣  Testing /auth/me...');
    const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!meResponse.ok) {
      const error = await meResponse.json();
      throw new Error(`/auth/me failed: ${error.message}`);
    }

    const meData = await meResponse.json();
    console.log('✅ /auth/me successful!');
    console.log('   User ID:', meData.user.id);
    console.log('   Email:', meData.user.email);
    console.log('   Name:', `${meData.user.firstName} ${meData.user.lastName}`);

    // 4. Test Token Refresh
    console.log('\n4️⃣  Testing Token Refresh...');
    const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!refreshResponse.ok) {
      const error = await refreshResponse.json();
      throw new Error(`Token refresh failed: ${error.message}`);
    }

    const refreshData = await refreshResponse.json();
    console.log('✅ Token refresh successful!');
    console.log('   New Access Token:', refreshData.accessToken.substring(0, 20) + '...');

    // 5. Test Logout
    console.log('\n5️⃣  Testing Logout...');
    const logoutResponse = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!logoutResponse.ok) {
      const error = await logoutResponse.json();
      throw new Error(`Logout failed: ${error.message}`);
    }

    const logoutData = await logoutResponse.json();
    console.log('✅ Logout successful!');
    console.log('   Message:', logoutData.message);

    console.log('\n🎉 All authentication tests passed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run tests
testAuth();
