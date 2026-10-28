/**
 * PATCH /api/tenant/profile — logo + social links must reach the database.
 *
 * Regression: the modal posts the whole business profile, but the route schema
 * had no `social_links` key, so zod stripped it and every social edit was
 * silently dropped. `social_links` is jsonb, so the dynamic UPDATE/INSERT also
 * needs an explicit `::jsonb` cast with a stringified param — passing the object
 * straight through makes Postgres read it as a record, not a jsonb literal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockTenantsFindUnique, mockTenantsUpdate, mockQueryRaw, mockExecuteRawUnsafe } = vi.hoisted(() => ({
  mockTenantsFindUnique: vi.fn(),
  mockTenantsUpdate: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    tenants: {
      findUnique: mockTenantsFindUnique,
      update: mockTenantsUpdate,
    },
  },
  basePrisma: {
    $queryRaw: mockQueryRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
  },
}));

vi.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', userId: 'user-1', email: 'owner@test.local', tenantIds: [] };
    next();
  },
  checkTenantAccess: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../config/unifiedConfig', () => ({
  unifiedConfig: { isDevelopment: false, supabaseUrl: '', supabaseServiceRoleKey: '' },
}));

vi.mock('../logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import tenantUploadRouter from '../routes/inline-tenant-upload';

const app = express();
app.use(express.json());
app.use('/', tenantUploadRouter);

const TENANT_ID = 'tid-sud4ky1c';
const LOGO_URL = 'https://cdn.example.com/tenants/tid-sud4ky1c/logo-1.png';
const SOCIAL_LINKS = {
  facebook: 'https://facebook.com/shelfvisible',
  twitter: 'https://x.com/shelfvisible',
  linkedin: 'https://linkedin.com/company/visibleshelf',
  youtube: 'https://youtube.com/@shelfvisible',
};

const profileRow = {
  tenant_id: TENANT_ID,
  business_name: 'VisibleShelf',
  logo_url: LOGO_URL,
  social_links: SOCIAL_LINKS,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockTenantsFindUnique.mockResolvedValue({ id: TENANT_ID, name: 'VisibleShelf', metadata: {} });
  mockTenantsUpdate.mockResolvedValue({ id: TENANT_ID });
  mockExecuteRawUnsafe.mockResolvedValue(1);
});

/** Routes the tagged-template SELECTs to the right shape. */
function stubQueryRaw({ profileExists }: { profileExists: boolean }) {
  mockQueryRaw.mockImplementation((strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    if (sql.includes('SELECT tenant_id FROM')) {
      return Promise.resolve(profileExists ? [{ tenant_id: TENANT_ID }] : []);
    }
    if (sql.includes('SELECT slug FROM')) return Promise.resolve([{ slug: 'visibleshelf' }]);
    return Promise.resolve([profileRow]);
  });
}

describe('PATCH /api/tenant/profile — social links', () => {
  it('persists social_links as jsonb instead of stripping the field', async () => {
    stubQueryRaw({ profileExists: true });

    const res = await request(app)
      .patch('/api/tenant/profile')
      .send({ tenant_id: TENANT_ID, social_links: SOCIAL_LINKS });

    expect(res.status).toBe(200);

    const [sql, ...values] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('"social_links" = $1::jsonb');
    expect(values[0]).toBe(JSON.stringify(SOCIAL_LINKS));
    expect(res.body.social_links).toEqual(SOCIAL_LINKS);
  });

  it('writes social_links when the profile row does not exist yet', async () => {
    stubQueryRaw({ profileExists: false });

    const res = await request(app)
      .patch('/api/tenant/profile')
      .send({ tenant_id: TENANT_ID, social_links: SOCIAL_LINKS });

    expect(res.status).toBe(200);

    const [sql, ...values] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('INSERT INTO "tenant_business_profiles_list"');
    expect(sql).toContain('"social_links"');
    expect(sql).toMatch(/\$\d+::jsonb/);
    expect(values).toContain(JSON.stringify(SOCIAL_LINKS));
  });
});

describe('PATCH /api/tenant/profile — logo', () => {
  it('carries logo_url through to the update', async () => {
    stubQueryRaw({ profileExists: true });

    const res = await request(app)
      .patch('/api/tenant/profile')
      .send({ tenant_id: TENANT_ID, logo_url: LOGO_URL });

    expect(res.status).toBe(200);

    const [sql, ...values] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('"logo_url" = $1');
    expect(sql).not.toContain('::jsonb');
    expect(values[0]).toBe(LOGO_URL);
    expect(res.body.logo_url).toBe(LOGO_URL);
  });

  it('saves logo and social links in a single request', async () => {
    stubQueryRaw({ profileExists: true });

    const res = await request(app)
      .patch('/api/tenant/profile')
      .send({ tenant_id: TENANT_ID, logo_url: LOGO_URL, social_links: SOCIAL_LINKS });

    expect(res.status).toBe(200);

    const [sql, ...values] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('"logo_url" = $1');
    expect(sql).toContain('"social_links" = $2::jsonb');
    expect(values[0]).toBe(LOGO_URL);
    expect(values[1]).toBe(JSON.stringify(SOCIAL_LINKS));
  });

  it('accepts an empty social_links object without touching other columns', async () => {
    stubQueryRaw({ profileExists: true });

    const res = await request(app)
      .patch('/api/tenant/profile')
      .send({ tenant_id: TENANT_ID, social_links: {} });

    expect(res.status).toBe(200);
    const [sql, ...values] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('"social_links" = $1::jsonb');
    expect(values[0]).toBe('{}');
  });
});
