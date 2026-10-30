/**
 * `GET /google/business/locations` under the GBP fixture harness.
 *
 * The live project sits at 0 QPM until Google allowlists it, so this endpoint —
 * and therefore the whole connect → list → link flow — cannot be exercised
 * against Google. These tests drive the **real route** through the **real
 * transport** and assert both halves of the seam:
 *
 *   - the `pending` profile reproduces the live 503 (`api_not_approved`), so the
 *     failure state stays testable rather than only observable in production;
 *   - the `approved` profile returns locations, which is what the live project
 *     cannot do yet.
 *
 * If these pass, the UI flow can be built and reviewed end-to-end without the
 * appeal landing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as path from 'path';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockFindGoogleToken,
  mockResolveGoogleAccessToken,
  mockTenantsFindUnique,
  mockOauthAccountFindFirst,
  mockLocationsDeleteMany,
} = vi.hoisted(() => ({
  mockFindGoogleToken: vi.fn(),
  mockResolveGoogleAccessToken: vi.fn(),
  mockTenantsFindUnique: vi.fn(),
  mockOauthAccountFindFirst: vi.fn(),
  mockLocationsDeleteMany: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../context', () => ({
  requestContextStorage: { getStore: () => undefined },
}));

vi.mock('../prisma', () => ({
  prisma: {
    tenants: { findUnique: mockTenantsFindUnique, update: vi.fn() },
    google_oauth_accounts_list: { findFirst: mockOauthAccountFindFirst, create: vi.fn() },
    gbp_locations_list: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: mockLocationsDeleteMany,
    },
  },
}));

vi.mock('../lib/google/token-store', () => ({
  findGoogleToken: mockFindGoogleToken,
  resolveGoogleAccessToken: mockResolveGoogleAccessToken,
  upsertGoogleToken: vi.fn(),
  deleteGoogleToken: vi.fn(),
}));

vi.mock('../lib/google/capability-gate', () => ({
  isGBPSyncAllowed: vi.fn().mockResolvedValue(true),
  isGbpManagementFeatureAllowed: vi.fn().mockResolvedValue(true),
}));

// The router's /google/business-scoped auth chain (authenticateToken +
// checkTenantAccess) is real code — these tests exercise the routes as an
// authenticated member of TENANT_ID, so the gate passes and the route's own
// guards (missing_tenantId, not_connected, …) are what get asserted.
vi.mock('../middleware/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../middleware/auth')>()),
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'u-fixture',
      userId: 'u-fixture',
      user_id: 'u-fixture',
      email: 'fixture@test.dev',
      role: 'owner',
      tenantIds: ['tid-m8ijkrnk'],
    };
    next();
  },
  checkTenantAccess: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    googleBusinessClientId: 'test-client-id',
    googleBusinessClientSecret: 'test-client-secret',
    googleBusinessRedirectUri: 'https://api.example.test/auth/google/business/callback',
  },
}));

import googleBusinessRouter from '../routes/google-business-oauth';
import { clearGbpFixtureCache } from '../lib/google/gbp-transport';

// ── Test app ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/api', googleBusinessRouter);

const TENANT_ID = 'tid-m8ijkrnk';
const LOCATIONS_URL = `/api/google/business/locations?tenantId=${TENANT_ID}`;
const APPROVED_DIR = path.resolve(__dirname, '../../fixtures/gbp/approved');
const PENDING_DIR = path.resolve(__dirname, '../../fixtures/gbp/pending');

beforeEach(() => {
  // A connected tenant with a usable token — the state in the reported bug.
  mockFindGoogleToken.mockResolvedValue({ id: 'goa_1', tenant_id: TENANT_ID });
  mockResolveGoogleAccessToken.mockResolvedValue('ya29.test-access-token');
  mockTenantsFindUnique.mockResolvedValue(null);
  mockOauthAccountFindFirst.mockResolvedValue({ id: 'goa_1' });
  mockLocationsDeleteMany.mockResolvedValue({ count: 0 });

  process.env.GBP_TRANSPORT = 'fixture';
  clearGbpFixtureCache();
});

afterEach(() => {
  delete process.env.GBP_TRANSPORT;
  delete process.env.GBP_FIXTURE_DIR;
  clearGbpFixtureCache();
});

// ── Tests ───────────────────────────────────────────────────────────────

describe('GET /google/business/locations — pending profile (today\'s live state)', () => {
  beforeEach(() => {
    process.env.GBP_FIXTURE_DIR = PENDING_DIR;
    clearGbpFixtureCache();
  });

  it('returns the 503 api_not_approved the merchant sees', async () => {
    const response = await request(app).get(LOCATIONS_URL);

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('api_not_approved');
    // The copy the UI currently discards — pinned here so a fix can rely on it.
    expect(response.body.userMessage).toMatch(/platform verification with Google/i);
  });
});

describe('GET /google/business/locations — approved profile', () => {
  beforeEach(() => {
    process.env.GBP_FIXTURE_DIR = APPROVED_DIR;
    clearGbpFixtureCache();
  });

  it('lists locations through the real route', async () => {
    const response = await request(app).get(LOCATIONS_URL);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.accountCount).toBe(1);

    const [location] = response.body.data.locations;
    expect(location.locationId).toBe('998877665544332211');
    expect(location.name).toBe('Baraka International Market Inc.');
    expect(location.isVerified).toBe(true);
    expect(location.category).toBe('Grocery store');
    expect(location.phone).toBe('+1 414-555-0100');
    expect(location.address).toBeTruthy();
  });

  it('carries the account name the link step needs', async () => {
    const response = await request(app).get(LOCATIONS_URL);

    expect(response.body.data.locations[0].accountName).toBe('accounts/112233445566778899');
  });
});

describe('GET /google/business/locations — guards', () => {
  it('still 400s without a tenantId', async () => {
    const response = await request(app).get('/api/google/business/locations');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('missing_tenantId');
  });

  it('still 404s when the tenant has no GBP connection', async () => {
    mockFindGoogleToken.mockResolvedValue(null);
    mockTenantsFindUnique.mockResolvedValue(null);

    const response = await request(app).get(LOCATIONS_URL);

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('not_connected');
  });
});

// ── POST /google/business/unlink-location ───────────────────────────────
//
// The inverse of link-location, and the route the settings card's "Unlink
// Location" button calls. It had no server side at all — the card posted to
// /api/tenants/:id/gbp/unlink, which was never registered — so the button
// 404'd silently.

describe('POST /google/business/unlink-location', () => {
  const UNLINK_URL = '/api/google/business/unlink-location';

  it('removes only the linked location when a locationId is given', async () => {
    mockOauthAccountFindFirst.mockResolvedValue({ id: 'goa_1' });
    mockLocationsDeleteMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .post(UNLINK_URL)
      .send({ tenantId: TENANT_ID, locationId: '998877665544332211' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.removed).toBe(1);
    expect(mockLocationsDeleteMany).toHaveBeenCalledWith({
      where: { account_id: 'goa_1', location_id: '998877665544332211' },
    });
  });

  it('removes every location on the account when no locationId is given', async () => {
    mockOauthAccountFindFirst.mockResolvedValue({ id: 'goa_1' });
    mockLocationsDeleteMany.mockResolvedValue({ count: 3 });

    const response = await request(app).post(UNLINK_URL).send({ tenantId: TENANT_ID });

    expect(response.status).toBe(200);
    expect(response.body.data.removed).toBe(3);
    expect(mockLocationsDeleteMany).toHaveBeenCalledWith({ where: { account_id: 'goa_1' } });
  });

  it('is a no-op when the tenant has no GBP account', async () => {
    mockOauthAccountFindFirst.mockResolvedValue(null);

    const response = await request(app).post(UNLINK_URL).send({ tenantId: TENANT_ID });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.removed).toBe(0);
    expect(mockLocationsDeleteMany).not.toHaveBeenCalled();
  });

  it('still 400s without a tenantId', async () => {
    const response = await request(app).post(UNLINK_URL).send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('missing_tenantId');
  });
});
