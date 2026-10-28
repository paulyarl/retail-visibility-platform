/**
 * The seed fallback has to reach the callers, not just the service.
 *
 * `GET /api/tenant/profile` feeds the settings card / edit modal / profile
 * completeness page, and `GET /api/shop-management/:tenantId/seo` feeds the SEO
 * settings page. Both used to read `seo_tags` straight off the profile row, so a
 * seeded tenant saw an empty tag list despite the platform having composed one.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const {
  mockProfileFindUnique,
  mockSeedFindUnique,
  mockListingFindUnique,
  mockListingFindFirst,
  mockDirSettingsFindUnique,
  mockFeaturedFindFirst,
  mockTenantsFindUnique,
  mockItemsCount,
} = vi.hoisted(() => ({
  mockProfileFindUnique: vi.fn(),
  mockSeedFindUnique: vi.fn(),
  mockListingFindUnique: vi.fn(),
  mockListingFindFirst: vi.fn(),
  mockDirSettingsFindUnique: vi.fn(),
  mockFeaturedFindFirst: vi.fn(),
  mockTenantsFindUnique: vi.fn(),
  mockItemsCount: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    tenant_business_profiles_list: { findUnique: mockProfileFindUnique },
    directory_presence_seeds: { findUnique: mockSeedFindUnique },
    directory_listings_list: { findUnique: mockListingFindUnique, findFirst: mockListingFindFirst },
    directory_settings_list: { findUnique: mockDirSettingsFindUnique },
    directory_featured_listings_list: { findFirst: mockFeaturedFindFirst },
    tenants: { findUnique: mockTenantsFindUnique },
    inventory_items: { count: mockItemsCount },
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', userId: 'user-1', email: 'owner@test.local', tenantIds: [] };
    next();
  },
  checkTenantAccess: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import tenantProfileRouter from '../routes/inline-tenant-profile';
import shopManagementRouter from '../routes/shop-management';
import directoryTenantRouter from '../routes/directory-tenant';

const TENANT_ID = 'tid-mvmxmdv6';
const SEED_KEYWORDS = ['african grocery store', 'african market', 'international grocery'];
const SEED_DESCRIPTION =
  'African International Market is an African grocery store in Kansas City, MO. Listed on VisibleShelf from public information (address, phone). Claim this listing to verify and update details.';

const profileRouter = express();
profileRouter.use(express.json());
profileRouter.use('/', tenantProfileRouter);

const shopRouter = express();
shopRouter.use(express.json());
shopRouter.use('/api/shop-management', shopManagementRouter);

const directoryRouter = express();
directoryRouter.use(express.json());
directoryRouter.use('/api/tenants', directoryTenantRouter);

beforeEach(() => {
  vi.clearAllMocks();
  mockProfileFindUnique.mockResolvedValue({
    tenant_id: TENANT_ID,
    business_name: 'African International Market',
    seo_tags: null,
  });
  mockSeedFindUnique.mockResolvedValue({ listing_id: 'dll-seed-1' });
  mockListingFindUnique.mockResolvedValue({ keywords: SEED_KEYWORDS, description: SEED_DESCRIPTION });
  mockListingFindFirst.mockResolvedValue(null);
  mockDirSettingsFindUnique.mockResolvedValue({ seo_description: 'A market', seo_keywords: ['grocery'] });
  mockFeaturedFindFirst.mockResolvedValue(null);
  mockTenantsFindUnique.mockResolvedValue({ subscription_tier: 'starter' });
  mockItemsCount.mockResolvedValue(12);
});

describe('GET /api/tenant/profile — seo_tags fallback', () => {
  it('returns the seed vocabulary when the profile has no tags', async () => {
    const res = await request(profileRouter).get(`/api/tenant/profile?tenant_id=${TENANT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.seo_tags).toEqual(SEED_KEYWORDS);
    expect(res.body.seo_tags_source).toBe('directory_seed');
  });

  it("returns the profile's own tags when it has them", async () => {
    mockProfileFindUnique.mockResolvedValue({
      tenant_id: TENANT_ID,
      seo_tags: ['fresh produce'],
    });

    const res = await request(profileRouter).get(`/api/tenant/profile?tenant_id=${TENANT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.seo_tags).toEqual(['fresh produce']);
    expect(res.body.seo_tags_source).toBe('profile');
    expect(mockSeedFindUnique).not.toHaveBeenCalled();
  });
});

describe('GET /api/shop-management/:tenantId/seo — seo_tags fallback', () => {
  it('hands the settings page the seed tags and says where they came from', async () => {
    const res = await request(shopRouter).get(`/api/shop-management/${TENANT_ID}/seo`);

    expect(res.status).toBe(200);
    expect(res.body.data.seo_tags).toEqual(SEED_KEYWORDS);
    expect(res.body.data.seo_tags_source).toBe('directory_seed');
    expect(res.body.data.seo_description).toBe('A market');
    expect(res.body.data.seo_keywords).toEqual(['grocery']);
  });

  it('marks owner-authored tags as the profile source', async () => {
    mockProfileFindUnique.mockResolvedValue({ seo_tags: ['halal market'] });

    const res = await request(shopRouter).get(`/api/shop-management/${TENANT_ID}/seo`);

    expect(res.status).toBe(200);
    expect(res.body.data.seo_tags).toEqual(['halal market']);
    expect(res.body.data.seo_tags_source).toBe('profile');
  });

  it('still returns an empty list for a tenant with no seed and no tags', async () => {
    mockProfileFindUnique.mockResolvedValue({ seo_tags: [] });
    mockSeedFindUnique.mockResolvedValue(null);

    const res = await request(shopRouter).get(`/api/shop-management/${TENANT_ID}/seo`);

    expect(res.status).toBe(200);
    expect(res.body.data.seo_tags).toEqual([]);
    expect(res.body.data.seo_tags_source).toBe('profile');
  });
});

describe('GET /api/tenants/:id/directory/listing — description/keywords fallback', () => {
  it('prefills the seed narrative and vocabulary when the owner has none', async () => {
    mockDirSettingsFindUnique.mockResolvedValue({
      id: TENANT_ID,
      tenant_id: TENANT_ID,
      is_published: false,
      seo_description: null,
      seo_keywords: [],
      primary_category: 'African Grocery Store',
      secondary_categories: [],
      slug: 'african-international-market',
      created_at: new Date('2026-10-01'),
      updated_at: new Date('2026-10-01'),
    });

    const res = await request(directoryRouter).get(`/api/tenants/${TENANT_ID}/directory/listing`);

    expect(res.status).toBe(200);
    expect(res.body.seoDescription).toBe(SEED_DESCRIPTION);
    expect(res.body.seoKeywords).toEqual(SEED_KEYWORDS);
    expect(res.body.seoDescriptionSource).toBe('directory_seed');
    expect(res.body.seoKeywordsSource).toBe('directory_seed');
  });

  it("keeps the owner's own description and keywords", async () => {
    const res = await request(directoryRouter).get(`/api/tenants/${TENANT_ID}/directory/listing`);

    expect(res.status).toBe(200);
    expect(res.body.seoDescription).toBe('A market');
    expect(res.body.seoKeywords).toEqual(['grocery']);
    expect(res.body.seoDescriptionSource).toBe('settings');
    expect(res.body.seoKeywordsSource).toBe('settings');
    expect(mockSeedFindUnique).not.toHaveBeenCalled();
  });
});

describe('GET /api/tenants/:id/directory/quality-check — description fallback', () => {
  it('credits the seeded description instead of nagging for one', async () => {
    mockDirSettingsFindUnique.mockResolvedValue({
      seo_description: null,
      seo_keywords: [],
      primary_category: 'African Grocery Store',
    });

    const res = await request(directoryRouter).get(`/api/tenants/${TENANT_ID}/directory/quality-check`);

    expect(res.status).toBe(200);
    expect(res.body.checks.description).toBe(true);
    expect(res.body.descriptionSource).toBe('directory_seed');
    expect(res.body.recommendations).not.toContain('Add detailed description (150+ words)');
  });

  it('still flags a tenant with neither an owner nor a seeded description', async () => {
    mockDirSettingsFindUnique.mockResolvedValue({ seo_description: null, seo_keywords: [] });
    mockSeedFindUnique.mockResolvedValue(null);
    mockListingFindFirst.mockResolvedValue(null);

    const res = await request(directoryRouter).get(`/api/tenants/${TENANT_ID}/directory/quality-check`);

    expect(res.status).toBe(200);
    expect(res.body.checks.description).toBe(false);
    expect(res.body.descriptionSource).toBe('settings');
    expect(res.body.recommendations).toContain('Add detailed description (150+ words)');
  });
});
