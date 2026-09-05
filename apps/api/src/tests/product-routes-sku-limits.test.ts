/**
 * Product route security + SKU limit tests
 *
 * Verifies the POST /api/items route:
 * - Auth: no token → 401 (authenticateToken middleware)
 * - Tenant access: cross-tenant → 403 (checkTenantAccess middleware)
 * - SKU limit: at/over tier limit → 403 sku_limit_exceeded
 * - SKU limit: under tier limit → proceeds to creation
 * - SKU limit: null subscription_tier → Infinity (no block)
 * - SKU limit: TierService error → Infinity (no block, logs and continues)
 * - Directory Presence tier: max_skus = 5 enforced
 *
 * See: docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md §11
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mocks (hoisted) ─────────────────────────────────────────────────────

const {
  mockAuthenticateToken,
  mockCheckTenantAccess,
  mockRequireWritable,
  mockGetTierSKULimit,
  mockTenantFindUnique,
  mockItemCreate,
} = vi.hoisted(() => ({
  mockAuthenticateToken: vi.fn(),
  mockCheckTenantAccess: vi.fn(),
  mockRequireWritable: vi.fn(),
  mockGetTierSKULimit: vi.fn(),
  mockTenantFindUnique: vi.fn(),
  mockItemCreate: vi.fn(),
}));

vi.mock('../middleware/auth', () => ({
  authenticateToken: mockAuthenticateToken,
  checkTenantAccess: mockCheckTenantAccess,
}));

vi.mock('../middleware/permissions', () => ({
  requireTenantAdmin: vi.fn(),
}));

vi.mock('../middleware/subscription', () => ({
  requireWritableSubscription: mockRequireWritable,
}));

vi.mock('../services/TierService', () => ({
  default: {
    getTierSKULimit: mockGetTierSKULimit,
  },
}));

vi.mock('../prisma', () => ({
  prisma: {
    tenants: {
      findUnique: mockTenantFindUnique,
    },
    inventory_items: {
      create: mockItemCreate,
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    inventory_variants: {
      create: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    photos: {
      createMany: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    featured_products: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    $executeRaw: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../utils/platform-admin', () => ({
  isPlatformAdmin: vi.fn(() => false),
}));

vi.mock('../utils/db-pool', () => ({
  getDirectPool: vi.fn(() => ({ query: vi.fn() })),
}));

vi.mock('../audit', () => ({
  audit: vi.fn(),
}));

vi.mock('../services/CategoryService', () => ({
  categoryService: { getCategories: vi.fn().mockResolvedValue([]) },
}));

vi.mock('../services/FeaturedProductsService', () => ({
  FeaturedProductsService: {
    getInstance: () => ({
      featureItem: vi.fn(),
      unfeatureItem: vi.fn(),
    }),
  },
}));

vi.mock('../lib/id-generator', () => ({
  generatePhotoId: vi.fn(() => 'photo-id'),
  generateTenantItemId: vi.fn(() => 'item-id'),
  generateTenantVariantId: vi.fn(() => 'variant-id'),
  generateVariantSkuFromParent: vi.fn(() => 'VAR-SKU'),
  generateSKU: vi.fn(() => 'SKU-001'),
  generateTenantKey: vi.fn(() => 'tk-001'),
}));

vi.mock('../photos', () => ({
  migrateTempPhotos: vi.fn().mockResolvedValue([]),
}));

vi.mock('../storage-config', () => ({
  StorageBuckets: { PRODUCTS: 'products' },
}));

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: {
    isDevelopment: false,
    uploadDir: '/tmp/uploads',
  },
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import after mocks
import router from '../routes/inline-items-crud';

// ─── Test app ────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use('/', router);

const TEST_TENANT_ID = 'tnt-001';
const VALID_ITEM_BODY = {
  tenantId: TEST_TENANT_ID,
  name: 'Test Product',
  price_cents: 1000,
  stock: 10,
};

beforeEach(() => {
  vi.clearAllMocks();

  // Default: all middleware passes
  mockAuthenticateToken.mockImplementation((req: any, _res: any, next: any) => {
    req.user = { id: 'user-001', auth0Id: 'auth0-001' };
    next();
  });
  mockCheckTenantAccess.mockImplementation((_req: any, _res: any, next: any) => next());
  mockRequireWritable.mockImplementation((_req: any, _res: any, next: any) => next());

  // Default: no tenant found (no SKU check)
  mockTenantFindUnique.mockResolvedValue(null);
  mockGetTierSKULimit.mockResolvedValue(Infinity);
  mockItemCreate.mockResolvedValue({ id: 'item-001', ...VALID_ITEM_BODY });
});

// ─── Auth tests ──────────────────────────────────────────────────────────

describe('POST /api/items — auth', () => {
  it('returns 401 when authenticateToken rejects', async () => {
    mockAuthenticateToken.mockImplementation((_req: any, res: any) => {
      res.status(401).json({ error: 'authentication_required' });
    });

    const res = await request(app).post('/api/items').send(VALID_ITEM_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('authentication_required');
  });

  it('returns 403 when checkTenantAccess rejects', async () => {
    mockCheckTenantAccess.mockImplementation((_req: any, res: any) => {
      res.status(403).json({ error: 'tenant_access_denied' });
    });

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('tenant_access_denied');
  });

  it('returns 403 when requireWritableSubscription rejects (frozen)', async () => {
    mockRequireWritable.mockImplementation((_req: any, res: any) => {
      res.status(403).json({ error: 'subscription_frozen' });
    });

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('subscription_frozen');
  });
});

// ─── SKU limit tests ─────────────────────────────────────────────────────

describe('POST /api/items — SKU limit enforcement', () => {
  it('returns 403 sku_limit_exceeded when at tier limit', async () => {
    mockTenantFindUnique.mockResolvedValue({
      subscription_tier: 'directory_presence',
      _count: { inventory_items: 5 },
    });
    mockGetTierSKULimit.mockResolvedValue(5);

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('sku_limit_exceeded');
    expect(res.body.max_skus).toBe(5);
    expect(res.body.current_count).toBe(5);
    expect(mockItemCreate).not.toHaveBeenCalled();
  });

  it('proceeds when under tier limit', async () => {
    mockTenantFindUnique.mockResolvedValue({
      subscription_tier: 'directory_presence',
      _count: { inventory_items: 3 },
    });
    mockGetTierSKULimit.mockResolvedValue(5);

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);

    // Should not return sku_limit_exceeded
    expect(res.status).not.toBe(403);
    expect(res.body.error).not.toBe('sku_limit_exceeded');
  });

  it('does not block when subscription_tier is null', async () => {
    mockTenantFindUnique.mockResolvedValue({
      subscription_tier: null,
      _count: { inventory_items: 100 },
    });

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);

    // null tier → Infinity → no SKU block
    expect(res.status).not.toBe(403);
    expect(res.body.error).not.toBe('sku_limit_exceeded');
    expect(mockGetTierSKULimit).not.toHaveBeenCalled();
  });

  it('does not block when TierService.getTierSKULimit throws', async () => {
    mockTenantFindUnique.mockResolvedValue({
      subscription_tier: 'directory_presence',
      _count: { inventory_items: 5 },
    });
    mockGetTierSKULimit.mockRejectedValue(new Error('Tier service down'));

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);

    // Error → .catch(() => Infinity) → no SKU block
    expect(res.status).not.toBe(403);
    expect(res.body.error).not.toBe('sku_limit_exceeded');
  });

  it('does not block when tenant is not found', async () => {
    mockTenantFindUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);

    expect(res.status).not.toBe(403);
    expect(res.body.error).not.toBe('sku_limit_exceeded');
    expect(mockGetTierSKULimit).not.toHaveBeenCalled();
  });

  it('does not block when tenantId is missing from body', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send({ name: 'Test Product', price_cents: 1000, stock: 10 });

    // No tenantId → no SKU check
    expect(mockTenantFindUnique).not.toHaveBeenCalled();
    expect(mockGetTierSKULimit).not.toHaveBeenCalled();
  });
});

// ─── Directory Presence tier (5-product limit) ───────────────────────────

describe('POST /api/items — Directory Presence tier (5 products)', () => {
  it('enforces max_skus=5 for directory_presence tier', async () => {
    mockTenantFindUnique.mockResolvedValue({
      subscription_tier: 'directory_presence',
      _count: { inventory_items: 5 },
    });
    mockGetTierSKULimit.mockResolvedValue(5);

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('sku_limit_exceeded');
    expect(res.body.max_skus).toBe(5);
    expect(res.body.message).toContain('5-product limit');
    expect(res.body.message).toContain('directory_presence');
  });

  it('allows 4th product for directory_presence tier (under 5)', async () => {
    mockTenantFindUnique.mockResolvedValue({
      subscription_tier: 'directory_presence',
      _count: { inventory_items: 4 },
    });
    mockGetTierSKULimit.mockResolvedValue(5);

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);

    expect(res.status).not.toBe(403);
    expect(res.body.error).not.toBe('sku_limit_exceeded');
  });

  it('allows 5th product for directory_presence tier (at 4, limit 5)', async () => {
    mockTenantFindUnique.mockResolvedValue({
      subscription_tier: 'directory_presence',
      _count: { inventory_items: 4 },
    });
    mockGetTierSKULimit.mockResolvedValue(5);

    const res = await request(app)
      .post('/api/items')
      .set('x-auth0-id', 'auth0-001')
      .send(VALID_ITEM_BODY);

    // 4 < 5 → allowed (the check is >=, so 4 is under, 5 is at)
    expect(res.status).not.toBe(403);
    expect(res.body.error).not.toBe('sku_limit_exceeded');
  });
});
