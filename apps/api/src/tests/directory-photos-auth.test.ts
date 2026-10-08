/**
 * directory-photos write authorization
 *
 * Regression: POST/PUT/DELETE on /:listingId/photos were reachable without
 * authentication (the router carried no auth and `/api/directory` is mounted
 * `authLevel: 'public'`). Reads are public by design and must stay that way —
 * the seed page and the directory listings fetch photos anonymously.
 *
 * Coverage:
 * 1. POST   without a session → 401
 * 2. PUT    /:photoId without a session → 401
 * 3. PUT    /reorder without a session → 401
 * 4. DELETE /:photoId without a session → 401
 * 5. GET    without a session → 200 (public read preserved)
 * 6. POST   as PLATFORM_VIEWER → 403 (read-only role cannot write)
 * 7. POST   as PLATFORM_ADMIN → passes the guard, reaches the handler
 * 8. POST   as a plain tenant MEMBER → 403
 * 9. POST   as OWNER of the listing's tenant → passes the guard
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ── Mocks ────────────────────────────────────────────────────────────────

const {
  mockTenantsFindUnique,
  mockTenantsFindFirst,
  mockDirListingsFindFirst,
  mockUserTenantsFindUnique,
  mockPhotosCount,
  mockPhotosFindMany,
  mockPhotosFindFirst,
  mockPhotosCreate,
  mockBasePrismaTransaction,
} = vi.hoisted(() => ({
  mockTenantsFindUnique: vi.fn(),
  mockTenantsFindFirst: vi.fn(),
  mockDirListingsFindFirst: vi.fn(),
  mockUserTenantsFindUnique: vi.fn(),
  mockPhotosCount: vi.fn(),
  mockPhotosFindMany: vi.fn(),
  mockPhotosFindFirst: vi.fn(),
  mockPhotosCreate: vi.fn(),
  mockBasePrismaTransaction: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    tenants: {
      findUnique: mockTenantsFindUnique,
      findFirst: mockTenantsFindFirst,
    },
    directory_listings_list: {
      findFirst: mockDirListingsFindFirst,
    },
    user_tenants: {
      findUnique: mockUserTenantsFindUnique,
    },
    directory_photos: {
      count: mockPhotosCount,
      findMany: mockPhotosFindMany,
      findFirst: mockPhotosFindFirst,
      create: mockPhotosCreate,
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
  },
  basePrisma: {
    $transaction: mockBasePrismaTransaction,
    directory_photos: { update: vi.fn() },
  },
}));

// Header-driven stand-in for the real middleware, which resolves an Auth0
// session against the users table. Absent header reproduces the real
// no-session response so the guard's behaviour is observable end to end.
vi.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    const role = req.headers['x-test-role'] as string | undefined;
    if (!role) {
      return res
        .status(401)
        .json({ error: 'authentication_required', message: 'No Auth0 session provided' });
    }
    const id = `user-${role}`;
    req.user = { id, userId: id, user_id: id, email: `${role}@test.local`, role, tenantIds: [] };
    next();
  },
}));

vi.mock('../config/unifiedConfig', () => ({ unifiedConfig: {} }));

vi.mock('../storage-config', () => ({
  StorageBuckets: { TENANTS: { name: 'tenants', isPublic: true } },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'p' }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.example.com/p.jpg' } }),
        listBuckets: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    },
  }),
}));

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));

import directoryPhotosRouter from '../routes/directory-photos';

const app = express();
app.use(express.json());
app.use('/api/directory', directoryPhotosRouter);

const TENANT_ID = 'tid-test-123';
const LISTING_ID = 'dll-test-456';
const PHOTO_ID = 'photo-test-789';

beforeEach(() => {
  vi.clearAllMocks();
  mockTenantsFindUnique.mockResolvedValue({ id: TENANT_ID });
  mockTenantsFindFirst.mockResolvedValue(null);
  mockDirListingsFindFirst.mockResolvedValue({ id: LISTING_ID });
  mockUserTenantsFindUnique.mockResolvedValue(null);
  mockPhotosCount.mockResolvedValue(0);
  mockPhotosFindMany.mockResolvedValue([]);
  mockPhotosFindFirst.mockResolvedValue(null);
  mockPhotosCreate.mockResolvedValue({ id: PHOTO_ID });
});

describe('directory photos — writes require a session', () => {
  it('rejects an anonymous upload', async () => {
    const res = await request(app).post(`/api/directory/${TENANT_ID}/photos`).send({});
    expect(res.status).toBe(401);
  });

  it('rejects an anonymous photo update', async () => {
    const res = await request(app)
      .put(`/api/directory/${TENANT_ID}/photos/${PHOTO_ID}`)
      .send({ caption: 'x' });
    expect(res.status).toBe(401);
  });

  it('rejects an anonymous reorder', async () => {
    const res = await request(app)
      .put(`/api/directory/${TENANT_ID}/photos/reorder`)
      .send([{ id: PHOTO_ID, position: 0 }]);
    expect(res.status).toBe(401);
  });

  it('rejects an anonymous delete', async () => {
    const res = await request(app).delete(
      `/api/directory/${TENANT_ID}/photos/${PHOTO_ID}`
    );
    expect(res.status).toBe(401);
  });
});

describe('directory photos — reads stay public', () => {
  it('serves the photo list to an anonymous caller', async () => {
    const res = await request(app).get(`/api/directory/${TENANT_ID}/photos`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('directory photos — operator path', () => {
  it('refuses a read-only platform viewer', async () => {
    const res = await request(app)
      .post(`/api/directory/${TENANT_ID}/photos`)
      .set('x-test-role', 'PLATFORM_VIEWER')
      .send({});
    expect(res.status).toBe(403);
  });

  it('lets a platform admin past the guard to the handler', async () => {
    const res = await request(app)
      .post(`/api/directory/${TENANT_ID}/photos`)
      .set('x-test-role', 'PLATFORM_ADMIN')
      .send({});
    // 400 "missing image" is the handler's own response — proof the request
    // cleared authorization rather than being blocked.
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing image/);
  });
});

describe('directory photos — merchant path', () => {
  it('refuses a plain tenant member', async () => {
    mockUserTenantsFindUnique.mockResolvedValue({ role: 'MEMBER' });
    const res = await request(app)
      .post(`/api/directory/${TENANT_ID}/photos`)
      .set('x-test-role', 'MEMBER')
      .send({});
    expect(res.status).toBe(403);
  });

  it('refuses a member of a different tenant', async () => {
    mockUserTenantsFindUnique.mockResolvedValue(null);
    const res = await request(app)
      .post(`/api/directory/${TENANT_ID}/photos`)
      .set('x-test-role', 'OWNER')
      .send({});
    expect(res.status).toBe(403);
  });

  it('lets the listing tenant owner past the guard', async () => {
    mockUserTenantsFindUnique.mockResolvedValue({ role: 'OWNER' });
    const res = await request(app)
      .post(`/api/directory/${TENANT_ID}/photos`)
      .set('x-test-role', 'OWNER')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing image/);
  });
});

describe('directory photos — route ordering', () => {
  it('routes PUT /photos/reorder to the reorder handler, not /:photoId', async () => {
    mockPhotosFindMany.mockResolvedValue([
      { id: 'photo-a', listing_id: LISTING_ID, position: 0 },
      { id: 'photo-b', listing_id: LISTING_ID, position: 1 },
    ]);

    const res = await request(app)
      .put(`/api/directory/${TENANT_ID}/photos/reorder`)
      .set('x-test-role', 'PLATFORM_ADMIN')
      .send([
        { id: 'photo-a', position: 1 },
        { id: 'photo-b', position: 0 },
      ]);

    // The reorder handler answers 204 and writes through $transaction. Had the
    // dynamic /:photoId route matched first, it would have looked up a photo
    // whose id is the literal string "reorder" and answered 400 "photo not
    // found" — never touching $transaction.
    expect(res.status).toBe(204);
    expect(mockBasePrismaTransaction).toHaveBeenCalledTimes(1);
  });
});
