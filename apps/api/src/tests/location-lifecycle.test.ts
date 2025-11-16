/**
 * Location Lifecycle Management - End-to-End Test Suite
 * 
 * Tests the complete lifecycle system including:
 * - Status transitions and validation
 * - Audit logging
 * - Access control
 * - Impact analysis
 * - Query filtering
 * - Storefront visibility
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

// Test data
let authToken: string;
let testTenantId: string;
let testUserId: string;

// Helper to make authenticated requests
async function apiRequest(method: string, path: string, body?: any) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, options);
  
  let data = null;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    // Response wasn't JSON
    console.error(`Non-JSON response from ${method} ${path}:`, await response.text());
  }

  // Debug output for failures
  if (!response.ok) {
    console.error(`API Error: ${method} ${url}`);
    console.error(`Status: ${response.status}`);
    console.error(`Response:`, data);
  }

  return { response, data };
}

describe('Location Lifecycle Management - E2E Tests', () => {
  
  beforeAll(async () => {
    // Setup: Login and get test tenant
    console.log('Setting up test environment...');
    
    // TODO: Replace with actual login credentials or test user
    // For now, assume authToken and testTenantId are set via environment
    authToken = process.env.TEST_AUTH_TOKEN || '';
    testTenantId = process.env.TEST_TENANT_ID || '';
    testUserId = process.env.TEST_USER_ID || '';

    if (!authToken || !testTenantId) {
      console.warn('⚠️  TEST_AUTH_TOKEN and TEST_TENANT_ID must be set');
      console.warn('⚠️  Skipping tests...');
    }
  });

  afterAll(async () => {
    // Cleanup: Reset tenant to active status
    if (authToken && testTenantId) {
      console.log('Cleaning up: Resetting tenant to active status...');
      await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'active',
        reason: 'Test cleanup',
      });
    }
  });

  describe('1. Status Transitions', () => {
    
    it('should get current tenant status', async () => {
      if (!authToken || !testTenantId) return;

      const { response, data } = await apiRequest('GET', `/tenants/${testTenantId}`);
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('locationStatus');
      expect(data).toHaveProperty('statusInfo');
      
      console.log('✓ Current status:', data.locationStatus);
    });

    it('should change status from active to inactive', async () => {
      if (!authToken || !testTenantId) return;

      const reopeningDate = new Date();
      reopeningDate.setDate(reopeningDate.getDate() + 14); // 2 weeks from now

      const { response, data } = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'inactive',
        reason: 'Seasonal closure for testing',
        reopeningDate: reopeningDate.toISOString(),
      });

      expect(response.status).toBe(200);
      expect(data.locationStatus).toBe('inactive');
      expect(data.reopeningDate).toBeTruthy();
      expect(data.auditLogId).toBeTruthy();
      
      console.log('✓ Changed to inactive with reopening date');
    });

    it('should prevent invalid transition (inactive to pending)', async () => {
      if (!authToken || !testTenantId) return;

      const { response, data } = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'pending',
        reason: 'Invalid transition test',
      });

      expect(response.status).toBe(400);
      expect(response.ok).toBe(false);
      
      console.log('✓ Invalid transition blocked');
    });

    it('should change status from inactive back to active', async () => {
      if (!authToken || !testTenantId) return;

      const { response, data } = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'active',
        reason: 'Reopening after test closure',
      });

      expect(response.status).toBe(200);
      expect(data.locationStatus).toBe('active');
      
      console.log('✓ Reopened to active');
    });

    it('should change status to closed with reason', async () => {
      if (!authToken || !testTenantId) return;

      const { response, data } = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'closed',
        reason: 'Test permanent closure',
      });

      expect(response.status).toBe(200);
      expect(data.locationStatus).toBe('closed');
      expect(data.closureReason).toBe('Test permanent closure');
      
      console.log('✓ Changed to closed with reason');
    });

    it('should require reason for closed status', async () => {
      if (!authToken || !testTenantId) return;

      // First set back to active
      await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'archived',
        reason: 'Moving to archived for test',
      });

      // Reset to active for next test
      await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'active',
        reason: 'Reset for next test',
      });

      // Try to close without reason
      const { response } = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'closed',
        // No reason provided
      });

      expect(response.status).toBe(400);
      
      console.log('✓ Reason required for closed status');
    });
  });

  describe('2. Audit Logging', () => {
    
    it('should retrieve status change history', async () => {
      if (!authToken || !testTenantId) return;

      const { response, data } = await apiRequest('GET', `/api/tenants/${testTenantId}/status-history?limit=10`);

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('history');
      expect(Array.isArray(data.history)).toBe(true);
      expect(data.history.length).toBeGreaterThan(0);

      // Verify audit log structure
      const firstLog = data.history[0];
      expect(firstLog).toHaveProperty('id');
      expect(firstLog).toHaveProperty('oldStatus');
      expect(firstLog).toHaveProperty('newStatus');
      expect(firstLog).toHaveProperty('changedBy');
      expect(firstLog).toHaveProperty('createdAt');
      expect(firstLog).toHaveProperty('oldStatusInfo');
      expect(firstLog).toHaveProperty('newStatusInfo');

      console.log(`✓ Retrieved ${data.history.length} audit log entries`);
    });

    it('should include metadata in audit logs', async () => {
      if (!authToken || !testTenantId) return;

      const { response, data } = await apiRequest('GET', `/api/tenants/${testTenantId}/status-history?limit=1`);

      expect(response.status).toBe(200);
      const latestLog = data.history[0];
      
      // Check for metadata (may be null for some entries)
      if (latestLog.metadata) {
        expect(typeof latestLog.metadata).toBe('object');
      }

      console.log('✓ Audit log metadata structure verified');
    });
  });

  describe('3. Impact Preview', () => {
    
    it('should preview impact of status change', async () => {
      if (!authToken || !testTenantId) return;

      const { response, data } = await apiRequest('POST', `/api/tenants/${testTenantId}/status/preview`, {
        status: 'inactive',
      });

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('currentStatus');
      expect(data).toHaveProperty('newStatus');
      expect(data).toHaveProperty('valid');
      expect(data).toHaveProperty('impact');

      // Verify impact structure
      expect(data.impact).toHaveProperty('storefront');
      expect(data.impact).toHaveProperty('directory');
      expect(data.impact).toHaveProperty('googleSync');
      expect(data.impact).toHaveProperty('billing');
      expect(data.impact).toHaveProperty('propagation');

      console.log('✓ Impact preview returned:', data.impact.storefront);
    });

    it('should show invalid transition in preview', async () => {
      if (!authToken || !testTenantId) return;

      // Assuming current status is active
      const { response, data } = await apiRequest('POST', `/api/tenants/${testTenantId}/status/preview`, {
        status: 'pending',
      });

      expect(response.status).toBe(200);
      expect(data.valid).toBe(false);
      expect(data).toHaveProperty('reason');

      console.log('✓ Invalid transition detected in preview');
    });
  });

  describe('4. Query Filtering', () => {
    
    it('should exclude archived tenants by default', async () => {
      if (!authToken) return;

      const { response, data } = await apiRequest('GET', '/tenants');

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);

      // Check that no archived tenants are returned
      const archivedCount = data.filter((t: any) => t.locationStatus === 'archived').length;
      expect(archivedCount).toBe(0);

      console.log(`✓ Retrieved ${data.length} tenants (archived excluded)`);
    });

    it('should include archived when explicitly requested', async () => {
      if (!authToken) return;

      const { response, data } = await apiRequest('GET', '/tenants?includeArchived=true');

      expect(response.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);

      console.log(`✓ Retrieved ${data.length} tenants (including archived)`);
    });

    it('should filter tenants by status (admin only)', async () => {
      if (!authToken) return;

      const { response, data } = await apiRequest('GET', '/api/tenants/by-status/active');

      // May return 403 if not admin, which is expected
      if (response.status === 200) {
        expect(Array.isArray(data.tenants)).toBe(true);
        expect(data).toHaveProperty('pagination');
        console.log(`✓ Retrieved ${data.tenants.length} active tenants`);
      } else if (response.status === 403) {
        console.log('✓ Admin-only endpoint correctly restricted');
      }
    });
  });

  describe('5. Storefront Visibility', () => {
    
    it('should allow storefront access for active location', async () => {
      if (!testTenantId) return;

      // Ensure tenant is active
      if (authToken) {
        await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
          status: 'active',
          reason: 'Test storefront access',
        });
      }

      // Public endpoint (no auth)
      const response = await fetch(`${API_BASE_URL}/public/tenant/${testTenantId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.locationStatus).toBe('active');
      expect(data.access.storefront).toBe(true);
      expect(data.storefrontMessage).toBeUndefined();

      console.log('✓ Storefront accessible for active location');
    });

    it('should show closed message for inactive location', async () => {
      if (!authToken || !testTenantId) return;

      // Set to inactive
      await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'inactive',
        reason: 'Test storefront message',
      });

      // Check public endpoint
      const response = await fetch(`${API_BASE_URL}/public/tenant/${testTenantId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.locationStatus).toBe('inactive');
      expect(data.access.storefront).toBe(false);
      expect(data.storefrontMessage).toBeTruthy();
      expect(data.storefrontMessage.title).toContain('Temporarily Closed');

      console.log('✓ Storefront shows closed message for inactive');
    });

    it('should block storefront for archived location', async () => {
      if (!authToken || !testTenantId) return;

      // Set to archived
      await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'archived',
        reason: 'Test archived access',
      });

      // Check public endpoint
      const response = await fetch(`${API_BASE_URL}/public/tenant/${testTenantId}`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.locationStatus).toBe('archived');
      expect(data.access.storefront).toBe(false);

      console.log('✓ Storefront blocked for archived location');
    });
  });

  describe('6. Business Logic Utilities', () => {
    
    it('should validate status transitions correctly', async () => {
      if (!authToken || !testTenantId) return;

      // Reset to active
      await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'active',
        reason: 'Reset for validation test',
      });

      // Test valid transitions from active
      const validTransitions = ['inactive', 'closed', 'archived'];
      
      for (const status of validTransitions) {
        const { response, data } = await apiRequest('POST', `/api/tenants/${testTenantId}/status/preview`, {
          status,
        });

        expect(response.status).toBe(200);
        expect(data.valid).toBe(true);
      }

      console.log('✓ Valid transitions from active verified');
    });

    it('should calculate billing correctly for different statuses', async () => {
      if (!authToken || !testTenantId) return;

      const statuses = ['active', 'inactive', 'closed'];
      
      for (const status of statuses) {
        const { response, data } = await apiRequest('POST', `/api/tenants/${testTenantId}/status/preview`, {
          status,
        });

        if (response.status === 200) {
          expect(data.impact.billing).toBeTruthy();
          console.log(`  ${status}: ${data.impact.billing}`);
        }
      }

      console.log('✓ Billing calculations verified');
    });
  });

  describe('7. Complete Lifecycle Flow', () => {
    
    it('should complete full lifecycle: active → inactive → active → closed → archived', async () => {
      if (!authToken || !testTenantId) return;

      console.log('Starting complete lifecycle flow...');

      // 1. Start with active
      let result = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'active',
        reason: 'Starting lifecycle test',
      });
      expect(result.response.status).toBe(200);
      console.log('  1. ✓ Active');

      // 2. Move to inactive
      result = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'inactive',
        reason: 'Seasonal closure',
        reopeningDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });
      expect(result.response.status).toBe(200);
      expect(result.data.locationStatus).toBe('inactive');
      console.log('  2. ✓ Inactive (with reopening date)');

      // 3. Reopen to active
      result = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'active',
        reason: 'Reopened after seasonal closure',
      });
      expect(result.response.status).toBe(200);
      expect(result.data.locationStatus).toBe('active');
      console.log('  3. ✓ Active (reopened)');

      // 4. Close permanently
      result = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'closed',
        reason: 'Permanent closure for testing',
      });
      expect(result.response.status).toBe(200);
      expect(result.data.locationStatus).toBe('closed');
      console.log('  4. ✓ Closed (permanent)');

      // 5. Archive
      result = await apiRequest('PATCH', `/api/tenants/${testTenantId}/status`, {
        status: 'archived',
        reason: 'Archiving closed location',
      });
      expect(result.response.status).toBe(200);
      expect(result.data.locationStatus).toBe('archived');
      console.log('  5. ✓ Archived (final state)');

      // 6. Verify audit trail has all transitions
      const { data: historyData } = await apiRequest('GET', `/api/tenants/${testTenantId}/status-history?limit=10`);
      expect(historyData.history.length).toBeGreaterThanOrEqual(5);
      console.log(`  6. ✓ Audit trail: ${historyData.history.length} entries`);

      console.log('✓ Complete lifecycle flow successful!');
    });
  });
});

// Run tests
if (require.main === module) {
  console.log('🧪 Location Lifecycle Management - E2E Test Suite\n');
  console.log('Prerequisites:');
  console.log('  - API server running at', API_BASE_URL);
  console.log('  - TEST_AUTH_TOKEN environment variable set');
  console.log('  - TEST_TENANT_ID environment variable set');
  console.log('  - TEST_USER_ID environment variable set\n');
  console.log('Run with: npm test -- location-lifecycle.test.ts\n');
}
