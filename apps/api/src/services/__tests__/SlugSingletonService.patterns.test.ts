import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/db-pool', () => ({
  getDirectPool: () => ({ query: vi.fn() }),
}));

// getSlugOwnership reads basePrisma.directory_settings_list.findUnique;
// checkSubdomainAvailability reads prisma.tenants.findFirst +
// prisma.directory_settings_list.findFirst. Same module, two exports.
vi.mock('../../prisma', () => ({
  prisma: {
    tenants: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    directory_settings_list: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
  basePrisma: {
    tenants: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    directory_settings_list: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
}));

import { prisma, basePrisma } from '../../prisma';
import slugSingletonService from '../SlugSingletonService';

const tenantsMock = prisma.tenants as any;
const settingsReadMock = (prisma as any).directory_settings_list as any;
const ownershipMock = (basePrisma as any).directory_settings_list as any;

const BUSINESS = 'Ivoire African Market';
const LOCATION = { city: 'East Pittsburgh', state: 'Pennsylvania', country: 'United States' };
const TENANT = 'tid-8622qs2t';

// A 37-char candidate — valid directory slug, invalid platform subdomain.
const LONG_PATTERN = 'business_name_city';
const LONG_SLUG = 'ivoire-african-market-east-pittsburgh';

describe('SlugSingletonService.getAllSlugPatterns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Nothing taken by default.
    tenantsMock.findFirst.mockResolvedValue(null);
    settingsReadMock.findFirst.mockResolvedValue(null);
    ownershipMock.findUnique.mockResolvedValue(null);
  });

  it('directory namespace keeps the historical directory-only availability check', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, LOCATION, TENANT);
    const long = patterns.find((p) => p.pattern === LONG_PATTERN);

    // Directory mode still offers the 37-char slug — it is a legal directory slug.
    expect(long?.slug).toBe(LONG_SLUG);
    expect(long?.isAvailable).toBe(true);
  });

  it('subdomain namespace marks over-limit candidates invalid before any DB read', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, LOCATION, TENANT, 'subdomain');
    const long = patterns.find((p) => p.pattern === LONG_PATTERN);

    expect(long?.slug).toBe(LONG_SLUG);
    expect(long?.isAvailable).toBe(false);
    expect(long?.unavailableReason).toBe('invalid_subdomain');
  });

  it('subdomain namespace offers a valid available candidate', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, LOCATION, TENANT, 'subdomain');
    const base = patterns.find((p) => p.pattern === 'business_name');

    expect(base?.slug).toBe('ivoire-african-market');
    expect(base?.isAvailable).toBe(true);
    expect(base?.unavailableReason).toBeUndefined();
  });

  it('subdomain namespace still reports the tenant\'s own slug as theirs', async () => {
    // directory_settings_list holds the slug for THIS tenant — the exclusion
    // in checkSubdomainAvailability must make it read available + own.
    ownershipMock.findUnique.mockImplementation(async ({ where }: any) =>
      where.slug === 'ivoire-african-market' ? { tenant_id: TENANT } : null
    );
    settingsReadMock.findFirst.mockImplementation(async ({ where }: any) =>
      where.slug === 'ivoire-african-market' && where.tenant_id?.not !== TENANT
        ? { tenant_id: TENANT }
        : null
    );

    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, LOCATION, TENANT, 'subdomain');
    const base = patterns.find((p) => p.pattern === 'business_name');

    expect(base?.isAvailable).toBe(true);
    expect(base?.isOwnSlug).toBe(true);
  });

  it('subdomain namespace flags reserved names', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns('Admin', {}, 'tid-x', 'subdomain');
    const base = patterns.find((p) => p.pattern === 'business_name');

    expect(base?.slug).toBe('admin');
    expect(base?.isAvailable).toBe(false);
    expect(base?.unavailableReason).toBe('reserved_subdomain');
    // The reserved candidate itself short-circuits before any DB read (other
    // patterns like the autoId fallback legitimately query).
    expect(tenantsMock.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ subdomain: 'admin' }, { slug: 'admin' }],
        }),
      })
    );
  });

  it('subdomain namespace flags values taken in the tenants namespace', async () => {
    tenantsMock.findFirst.mockResolvedValue({ id: 'tid-other', name: 'Other' });

    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, {}, TENANT, 'subdomain');
    const base = patterns.find((p) => p.pattern === 'business_name');

    expect(base?.isAvailable).toBe(false);
    expect(base?.unavailableReason).toBe('subdomain_taken');
  });

  it('subdomain namespace evaluates the autoId fallback instead of assuming availability', async () => {
    // A base slug long enough that even baseSlug-autoId exceeds 30 chars.
    const patterns = await slugSingletonService.getAllSlugPatterns(
      'A Really Quite Extremely Long Business Name',
      {},
      TENANT,
      'subdomain'
    );
    const autoId = patterns.find((p) => p.pattern === 'business_name_autoid');

    expect(autoId?.isAvailable).toBe(false);
    expect(autoId?.unavailableReason).toBe('invalid_subdomain');
  });
});
