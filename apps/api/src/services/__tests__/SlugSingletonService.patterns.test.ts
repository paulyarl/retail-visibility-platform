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
    $queryRaw: vi.fn(),
  },
}));

import { prisma, basePrisma } from '../../prisma';
import slugSingletonService from '../SlugSingletonService';

const tenantsMock = prisma.tenants as any;
const settingsReadMock = (prisma as any).directory_settings_list as any;
const ownershipMock = (basePrisma as any).directory_settings_list as any;
// Shared-namespace union read used by the 'place' slug oracle.
const placeRowsMock = (basePrisma as any).$queryRaw as any;

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

  it('emits a word-boundary-shortened candidate when the base name overflows', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns(
      'A Really Quite Extremely Long Business Name',
      {},
      TENANT,
      'subdomain'
    );
    const shortened = patterns.find((p) => p.pattern === 'business_name_shortened');

    // Longest word-prefix under 30 chars — 'business' would take it to 38.
    expect(shortened?.slug).toBe('a-really-quite-extremely-long');
    expect(shortened?.isAvailable).toBe(true);
    expect(shortened?.unavailableReason).toBeUndefined();
  });

  it('emits a shortened state variant that leaves room for the suffix', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns(
      'A Really Quite Extremely Long Business Name',
      { state: 'Pennsylvania' },
      TENANT,
      'subdomain'
    );
    const shortenedState = patterns.find((p) => p.pattern === 'business_name_state_shortened');

    expect(shortenedState?.slug).toBe('a-really-quite-extremely-pa');
    expect(shortenedState?.isAvailable).toBe(true);
  });

  it('always offers a valid shortened autoId fallback', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns(
      'A Really Quite Extremely Long Business Name',
      {},
      TENANT,
      'subdomain'
    );
    const auto = patterns.find((p) => p.pattern === 'business_name_autoid_shortened');

    expect(auto?.slug).toMatch(/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]$/);
    expect(auto?.isAvailable).toBe(true);
  });

  it('emits no shortened candidates when the base name already fits', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, LOCATION, TENANT, 'subdomain');

    expect(patterns.some((p) => p.pattern.endsWith('_shortened'))).toBe(false);
  });
});

describe('SlugSingletonService.getAllSlugPatterns — place namespace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    placeRowsMock.mockResolvedValue([]);
  });

  // The $queryRaw union returns { owner } rows across listings + settings +
  // tenants; the mock filters on the bound slug parameter (first value arg).
  const holdSlug = (slug: string, owner: string) =>
    placeRowsMock.mockImplementation(async (_q: any, value: string) =>
      value === slug ? [{ owner }] : []
    );

  it('checks availability against the shared slug namespace, not settings alone', async () => {
    // Another tenant holds the base slug in one of the three mirrors —
    // unavailable even though directory_settings_list's findUnique oracle
    // (the 'directory' namespace) knows nothing about it.
    holdSlug('ivoire-african-market', 'tid-other');

    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, LOCATION, TENANT, 'place');
    const base = patterns.find((p) => p.pattern === 'business_name');

    expect(base?.isAvailable).toBe(false);
    expect(base?.isOwnSlug).toBe(false);
    expect(base?.unavailableReason).toBe('place_slug_taken');
    expect(ownershipMock.findUnique).not.toHaveBeenCalled();
  });

  it('marks the slug owned by this tenant as available and "Yours"', async () => {
    holdSlug('ivoire-african-market', TENANT);

    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, LOCATION, TENANT, 'place');
    const base = patterns.find((p) => p.pattern === 'business_name');

    expect(base?.isAvailable).toBe(true);
    expect(base?.isOwnSlug).toBe(true);
  });

  it('treats a slug held in tenants.slug without a listing row as taken', async () => {
    // The union read surfaces owners from any mirror — a tenants.slug value
    // orphaned by a deleted listing still blocks the candidate.
    holdSlug('ivoire-african-market', 'tid-orphaned');

    const result = await slugSingletonService.checkPlaceSlugAvailability('ivoire-african-market', TENANT);

    expect(result).toEqual({ available: false, code: 'place_slug_taken' });
  });

  it('flags reserved /place static-route slugs before any DB read', async () => {
    const patterns = await slugSingletonService.getAllSlugPatterns('About Us', {}, TENANT, 'place');
    const base = patterns.find((p) => p.pattern === 'business_name');

    expect(base?.slug).toBe('about-us');
    // 'about-us' is not reserved — only exact static-route names are.
    expect(base?.isAvailable).toBe(true);

    const reserved = await slugSingletonService.getAllSlugPatterns('Search', {}, TENANT, 'place');
    const reservedBase = reserved.find((p) => p.pattern === 'business_name');

    expect(reservedBase?.slug).toBe('search');
    expect(reservedBase?.isAvailable).toBe(false);
    expect(reservedBase?.unavailableReason).toBe('reserved_place_slug');
  });

  it('evaluates the autoId pattern against the shared namespace too', async () => {
    // AutoID pattern slug happens to be held by another tenant — the place
    // namespace must not assume uniqueness the way 'directory' does.
    const patterns = await slugSingletonService.getAllSlugPatterns(BUSINESS, {}, TENANT, 'place');
    const auto = patterns.find((p) => p.pattern === 'business_name_autoid');
    expect(auto).toBeDefined();

    holdSlug(auto!.slug, 'tid-other');
    const again = await slugSingletonService.getAllSlugPatterns(BUSINESS, {}, TENANT, 'place');
    expect(again.find((p) => p.pattern === 'business_name_autoid')?.isAvailable).toBe(false);
  });
});

describe('SlugSingletonService.checkPlaceSlugAvailability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    placeRowsMock.mockResolvedValue([]);
  });

  it('reports a reserved /place slug as unavailable without a DB read', async () => {
    const result = await slugSingletonService.checkPlaceSlugAvailability('claim', TENANT);

    expect(result).toEqual({ available: false, code: 'reserved_place_slug' });
    expect(placeRowsMock).not.toHaveBeenCalled();
  });

  it('excludes the seed tenant\'s own slug', async () => {
    placeRowsMock.mockResolvedValue([{ owner: TENANT }, { owner: TENANT }]);

    const result = await slugSingletonService.checkPlaceSlugAvailability('dreamcast-african-market-2', TENANT);
    expect(result.available).toBe(true);
  });
});
