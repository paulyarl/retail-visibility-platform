/**
 * GBP tenant-route auth regression tests (Sprint D0)
 *
 * Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §2/§9 gate #1
 * Plan: docs/LocalBiz/GBP_DFY_SPRINT_PLAN.md Sprint D0
 *
 * The GBP integration router was mounted authLevel:'public' with no
 * middleware — any caller-supplied tenantId was trusted. These tests pin the
 * new chain: authenticateToken + checkTenantAccess on everything except the
 * OAuth callback (which is bound by the HMAC-signed `state` instead).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ────────────────────────────────────────────────────────────────

const mockAccountsFindFirst = vi.fn();
const mockTenantsFindUnique = vi.fn();
const mockUserTenantsFindUnique = vi.fn();

vi.mock('../prisma', () => ({
  prisma: {
    google_oauth_accounts_list: { findFirst: (...a: any[]) => mockAccountsFindFirst(...a) },
    google_oauth_tokens_list: { findFirst: vi.fn() },
    tenants: { findUnique: (...a: any[]) => mockTenantsFindUnique(...a), update: vi.fn() },
    user_tenants: { findUnique: (...a: any[]) => mockUserTenantsFindUnique(...a) },
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    googleBusinessClientId: 'cid',
    googleBusinessClientSecret: 'gbp-test-secret',
    googleBusinessRedirectUri: 'http://localhost/auth/google/business/callback',
    webUrl: 'http://localhost:3000',
  },
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: class {
        generateAuthUrl() {
          return 'https://accounts.google.com/o/oauth2/auth?state=x';
        }
      },
    },
  },
}));

vi.mock('../lib/google/token-store', () => ({
  findGoogleToken: vi.fn().mockResolvedValue(null),
  resolveGoogleAccessToken: vi.fn(),
  upsertGoogleToken: vi.fn(),
  deleteGoogleToken: vi.fn(),
}));

vi.mock('../lib/google/capability-gate', () => ({
  isGBPSyncAllowed: vi.fn().mockResolvedValue(true),
  isGbpManagementFeatureAllowed: vi.fn().mockResolvedValue(true),
}));

vi.mock('../lib/google/gbp-transport', () => ({
  gbpFetch: vi.fn(),
  GBP_ACCOUNT_MANAGEMENT_BASE: 'https://mybusinessaccountmanagement.googleapis.com/v1',
  GBP_BUSINESS_INFORMATION_BASE: 'https://mybusinessbusinessinformation.googleapis.com/v1',
  GBP_V4_BASE: 'https://mybusiness.googleapis.com/v4',
}));

vi.mock('../context', () => ({ requestContextStorage: { getStore: () => undefined } }));

// Keep the real checkTenantAccess / getTenantId / requireTenantId — only
// replace authenticateToken with a test-double that injects req.user from a
// JSON header, so these tests exercise the real membership/role logic.
vi.mock('../middleware/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../middleware/auth')>();
  return {
    ...actual,
    authenticateToken: (req: any, res: any, next: any) => {
      const raw = req.headers['x-test-user'] as string | undefined;
      if (!raw) {
        return res.status(401).json({ error: 'authentication_required' });
      }
      req.user = JSON.parse(raw);
      next();
    },
  };
});

const { default: gbpRouter, signGbpOAuthState, verifyGbpOAuthState } =
  await import('../routes/google-business-oauth');

const app = express();
app.use(express.json());
app.use('/api', gbpRouter);

const member = { userId: 'u1', user_id: 'u1', role: 'TENANT_USER', tenantIds: ['t1'] };
const nonMember = { userId: 'u2', user_id: 'u2', role: 'TENANT_USER', tenantIds: ['t2'] };
const admin = { userId: 'a1', user_id: 'a1', role: 'PLATFORM_ADMIN', tenantIds: [] };

const STATUS = '/api/google/business/status?tenantId=t1';

describe('gbp route auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAccountsFindFirst.mockResolvedValue({
      id: 'a1',
      google_oauth_tokens_list: [{ id: 'tok1', expires_at: new Date(Date.now() + 3600e3) }],
    });
    mockTenantsFindUnique.mockResolvedValue(null);
    mockUserTenantsFindUnique.mockResolvedValue(null);
  });

  it('rejects unauthenticated calls with caller-supplied tenantId', async () => {
    const res = await request(app).get(STATUS);
    expect(res.status).toBe(401);
  });

  it('rejects an authenticated non-member acting on another tenant', async () => {
    const res = await request(app)
      .get(STATUS)
      .set('x-test-user', JSON.stringify(nonMember));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('tenant_access_denied');
  });

  it('allows a tenant member', async () => {
    const res = await request(app)
      .get(STATUS)
      .set('x-test-user', JSON.stringify(member));
    expect(res.status).toBe(200);
    expect(res.body.data.isConnected).toBe(true);
  });

  it('allows a platform admin acting on behalf of any tenant', async () => {
    const res = await request(app)
      .get(STATUS)
      .set('x-test-user', JSON.stringify(admin));
    expect(res.status).toBe(200);
  });

  it('leaves the OAuth callback unauthenticated (signed state is its gate)', async () => {
    const res = await request(app).get('/api/google/business/callback');
    // No code → the handler's own 400, not the middleware's 401.
    expect(res.status).toBe(400);
    expect(res.body.error).not.toBe('authentication_required');
  });
});

describe('signed OAuth state', () => {
  it('roundtrips tenantId', () => {
    const state = signGbpOAuthState('t1');
    expect(verifyGbpOAuthState(state)).toBe('t1');
  });

  it('rejects forged state', () => {
    expect(verifyGbpOAuthState(JSON.stringify({ tenantId: 'victim' }))).toBeNull();
    const forged = { tenantId: 'victim', nonce: 'x', sig: 'deadbeef' };
    expect(verifyGbpOAuthState(JSON.stringify(forged))).toBeNull();
  });

  it('rejects tampered tenantId', () => {
    const { nonce, sig } = JSON.parse(signGbpOAuthState('t1'));
    expect(verifyGbpOAuthState(JSON.stringify({ tenantId: 't2', nonce, sig }))).toBeNull();
  });
});
