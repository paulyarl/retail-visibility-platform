/**
 * GBPVerificationService tests
 *
 * Spec: docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md §10 quality gate #2
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE1.md Task 7
 *
 * Verifies:
 * 1. fetchOptions — returns verification options from Google API
 * 2. start — transitions UNVERIFIED → PENDING on gbp_locations_list.verification_state
 * 3. complete (success) — transitions PENDING → COMPLETED
 * 4. complete (failure) — transitions PENDING → FAILED
 * 5. complete (success) — fires gbp_verification_milestone CRM alert
 * 6. complete (success) — flips directory_seed → independent standing mode
 * 7. complete (no pending verification) — returns error
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockGetValidAccessToken,
  mockGetLinkedLocation,
  mockFetch,
  mockGbpLocationsUpdateMany,
  mockTenantsFindUnique,
  mockTenantsUpdate,
  mockCrmAlertCreate,
} = vi.hoisted(() => ({
  mockGetValidAccessToken: vi.fn(),
  mockGetLinkedLocation: vi.fn(),
  mockFetch: vi.fn(),
  mockGbpLocationsUpdateMany: vi.fn(),
  mockTenantsFindUnique: vi.fn(),
  mockTenantsUpdate: vi.fn(),
  mockCrmAlertCreate: vi.fn(),
}));

vi.mock('../GBPAdvancedSync', () => ({
  getValidAccessToken: mockGetValidAccessToken,
  getLinkedLocation: mockGetLinkedLocation,
}));

vi.mock('../prisma', () => ({
  prisma: {
    gbp_locations_list: {
      updateMany: mockGbpLocationsUpdateMany,
    },
    tenants: {
      findUnique: mockTenantsFindUnique,
      update: mockTenantsUpdate,
    },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../lib/platform-scope', () => ({
  PLATFORM_SCOPE: 'platform',
}));

vi.mock('../lib/id-generator', () => ({
  generateCrmAlertId: vi.fn().mockReturnValue('crm-alert-001'),
}));

vi.mock('./CrmAlertService', () => ({
  CrmAlertService: {
    getInstance: () => ({
      create: mockCrmAlertCreate,
    }),
  },
}));

// Mock global fetch
global.fetch = mockFetch as any;

import { GBPVerificationService } from '../GBPVerificationService';

// ── Test data ────────────────────────────────────────────────────────────

const TENANT_ID = 'tenant_001';
const ACCOUNT_ID = 'google-account-001';
const LOCATION_ID = 'google-location-001';
const ACCESS_TOKEN = 'valid-access-token';
const VERIFICATION_ID = 'verifications/123';

const mockLocation = { locationId: LOCATION_ID, accountId: ACCOUNT_ID };

const mockVerificationOption = { method: 'SMS', label: 'Text message (SMS)' };

function mockFetchResponse(data: any, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetValidAccessToken.mockResolvedValue(ACCESS_TOKEN);
  mockGetLinkedLocation.mockResolvedValue(mockLocation);
  mockGbpLocationsUpdateMany.mockResolvedValue({ count: 1 });
  mockCrmAlertCreate.mockResolvedValue({});
  mockTenantsFindUnique.mockResolvedValue({ org_standing_mode: 'directory_seed' });
  mockTenantsUpdate.mockResolvedValue({});
});

// ── fetchOptions tests ───────────────────────────────────────────────────

describe('GBPVerificationService.fetchOptions', () => {
  it('returns verification options from Google API', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        options: [
          { method: 'SMS', phoneNumber: '+1***-***-1234' },
          { method: 'PHONE_CALL' },
          { method: 'MAIL', address: '123 Main St, Anywhere, USA' },
        ],
      }),
    );

    const svc = GBPVerificationService.getInstance();
    const result = await svc.fetchOptions(TENANT_ID);

    expect(result.success).toBe(true);
    expect(result.options).toHaveLength(3);
    expect(result.options[0].method).toBe('SMS');
    expect(result.options[0].label).toBe('Text message (SMS)');
    expect(result.options[0].data?.phoneNumber).toBe('+1***-***-1234');
  });
});

// ── start tests ──────────────────────────────────────────────────────────

describe('GBPVerificationService.start', () => {
  it('transitions UNVERIFIED → PENDING on gbp_locations_list.verification_state', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({ name: VERIFICATION_ID }),
    );

    const svc = GBPVerificationService.getInstance();
    const result = await svc.start(TENANT_ID, mockVerificationOption);

    expect(result.success).toBe(true);
    expect(result.pending).toBe(true);
    expect(result.verificationId).toBe(VERIFICATION_ID);

    // Verify verification_state was updated to PENDING
    expect(mockGbpLocationsUpdateMany).toHaveBeenCalledWith({
      where: { tenant_id: TENANT_ID },
      data: { verification_state: 'PENDING' },
    });
  });
});

// ── complete tests ───────────────────────────────────────────────────────

describe('GBPVerificationService.complete', () => {
  it('transitions PENDING → COMPLETED on success', async () => {
    // First fetch: list verifications (find pending)
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        verifications: [{ name: 'verifications/123', state: 'PENDING', method: 'SMS' }],
      }),
    );
    // Second fetch: complete verification (success)
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, true, 200));

    const svc = GBPVerificationService.getInstance();
    const result = await svc.complete(TENANT_ID, '123456');

    expect(result.success).toBe(true);
    expect(result.verified).toBe(true);

    // Verify verification_state was updated to COMPLETED
    expect(mockGbpLocationsUpdateMany).toHaveBeenCalledWith({
      where: { tenant_id: TENANT_ID },
      data: { verification_state: 'COMPLETED' },
    });
  });

  it('transitions PENDING → FAILED on PIN submission failure', async () => {
    // First fetch: list verifications (find pending)
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        verifications: [{ name: 'verifications/123', state: 'PENDING', method: 'SMS' }],
      }),
    );
    // Second fetch: complete verification (failure — wrong PIN)
    mockFetch.mockResolvedValueOnce(mockFetchResponse({ error: 'Invalid PIN' }, false, 400));

    const svc = GBPVerificationService.getInstance();
    const result = await svc.complete(TENANT_ID, 'wrong-pin');

    expect(result.success).toBe(true);
    expect(result.verified).toBe(false);

    // Verify verification_state was updated to FAILED
    expect(mockGbpLocationsUpdateMany).toHaveBeenCalledWith({
      where: { tenant_id: TENANT_ID },
      data: { verification_state: 'FAILED' },
    });
  });

  it('fires gbp_verification_milestone CRM alert on success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        verifications: [{ name: 'verifications/123', state: 'PENDING', method: 'SMS' }],
      }),
    );
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, true, 200));

    const svc = GBPVerificationService.getInstance();
    await svc.complete(TENANT_ID, '123456');

    expect(mockCrmAlertCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'platform',
        type: 'gbp_verification_milestone',
        title: 'Google Business Profile verified',
      }),
    );
  });

  it('flips directory_seed → independent standing mode on success', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({
        verifications: [{ name: 'verifications/123', state: 'PENDING', method: 'SMS' }],
      }),
    );
    mockFetch.mockResolvedValueOnce(mockFetchResponse({}, true, 200));
    mockTenantsFindUnique.mockResolvedValue({ org_standing_mode: 'directory_seed' });

    const svc = GBPVerificationService.getInstance();
    await svc.complete(TENANT_ID, '123456');

    expect(mockTenantsUpdate).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { org_standing_mode: 'independent' },
    });
  });

  it('returns error when no pending verification exists', async () => {
    mockFetch.mockResolvedValueOnce(
      mockFetchResponse({ verifications: [] }),
    );

    const svc = GBPVerificationService.getInstance();
    const result = await svc.complete(TENANT_ID, '123456');

    expect(result.success).toBe(false);
    expect(result.verified).toBe(false);
    expect(result.error).toContain('No pending verification');
  });
});
