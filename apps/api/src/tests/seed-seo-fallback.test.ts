/**
 * Profile SEO tags — the directory seed is the fallback.
 *
 * A seeded tenant already has analyst-composed SEO vocabulary on its listing
 * (`directory_listings_list.keywords`), but the business profile's own
 * `seo_tags` starts empty. Without a fallback the settings card scored those
 * tenants as incomplete for tags the platform had already derived, and schema
 * markup shipped without keywords.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSeedFindUnique, mockListingFindUnique, mockListingFindFirst, mockWarn } = vi.hoisted(() => ({
  mockSeedFindUnique: vi.fn(),
  mockListingFindUnique: vi.fn(),
  mockListingFindFirst: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('../prisma', () => ({
  prisma: {
    directory_presence_seeds: { findUnique: mockSeedFindUnique },
    directory_listings_list: { findUnique: mockListingFindUnique, findFirst: mockListingFindFirst },
  },
}));

vi.mock('../logger', () => ({
  logger: { warn: mockWarn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  DIRECTORY_SEO_KEYWORDS_LIMIT,
  PROFILE_SEO_TAGS_LIMIT,
  normalizeSeedSeoTags,
  resolveDirectorySeo,
  resolveProfileSeoTags,
  resolveSeedListingSeo,
  resolveSeedSeoTags,
} from '../services/SeedSeoFallbackService';

const TENANT_ID = 'tid-mvmxmdv6';
const SEED_LISTING_ID = 'dll-seed-1';
const SEED_KEYWORDS = [
  'african grocery store',
  'african grocery',
  'african market',
  'international grocery',
];
const SEED_DESCRIPTION =
  'African International Market is an African grocery store in Kansas City, MO. Listed on VisibleShelf from public information (address, phone).';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizeSeedSeoTags', () => {
  it('keeps plain terms, lowercased and deduped', () => {
    expect(normalizeSeedSeoTags(['African Grocery Store', 'african grocery store', 'African Market'])).toEqual([
      'african grocery store',
      'african market',
    ]);
  });

  it('drops the internal key:value prefix', () => {
    expect(normalizeSeedSeoTags(['neighborhood:Shaw', 'origin_country:Ethiopia'])).toEqual([
      'shaw',
      'ethiopia',
    ]);
  });

  it('ignores blanks and non-strings', () => {
    expect(normalizeSeedSeoTags(['  ', '', null as any, 42 as any, 'halal market'])).toEqual([
      'halal market',
    ]);
  });

  it('caps the tag list', () => {
    const many = Array.from({ length: PROFILE_SEO_TAGS_LIMIT + 10 }, (_, i) => `tag ${i}`);
    expect(normalizeSeedSeoTags(many)).toHaveLength(PROFILE_SEO_TAGS_LIMIT);
  });

  it('handles a missing keyword array', () => {
    expect(normalizeSeedSeoTags(null)).toEqual([]);
    expect(normalizeSeedSeoTags(undefined)).toEqual([]);
  });
});

describe('resolveSeedSeoTags', () => {
  it('reads the seed listing keywords', async () => {
    mockSeedFindUnique.mockResolvedValue({ listing_id: SEED_LISTING_ID });
    mockListingFindUnique.mockResolvedValue({ keywords: SEED_KEYWORDS });

    await expect(resolveSeedSeoTags(TENANT_ID)).resolves.toEqual(SEED_KEYWORDS);
    expect(mockSeedFindUnique).toHaveBeenCalledWith({
      where: { tenant_id: TENANT_ID },
      select: { listing_id: true },
    });
  });

  it('falls back to the tenant listing when the seed has no listing', async () => {
    mockSeedFindUnique.mockResolvedValue(null);
    mockListingFindFirst.mockResolvedValue({ keywords: ['halal market'] });

    await expect(resolveSeedSeoTags(TENANT_ID)).resolves.toEqual(['halal market']);
  });

  it('returns nothing for a tenant with neither seed nor listing', async () => {
    mockSeedFindUnique.mockResolvedValue(null);
    mockListingFindFirst.mockResolvedValue(null);

    await expect(resolveSeedSeoTags(TENANT_ID)).resolves.toEqual([]);
  });
});

describe('resolveProfileSeoTags', () => {
  it("prefers the profile's own tags and skips the seed lookup", async () => {
    const result = await resolveProfileSeoTags(TENANT_ID, ['fresh produce']);

    expect(result).toEqual({ tags: ['fresh produce'], source: 'profile' });
    expect(mockSeedFindUnique).not.toHaveBeenCalled();
  });

  it('falls back to the seed when the profile has none', async () => {
    mockSeedFindUnique.mockResolvedValue({ listing_id: SEED_LISTING_ID });
    mockListingFindUnique.mockResolvedValue({ keywords: SEED_KEYWORDS });

    await expect(resolveProfileSeoTags(TENANT_ID, null)).resolves.toEqual({
      tags: SEED_KEYWORDS,
      source: 'directory_seed',
    });
  });

  it('treats an empty array as "no tags of my own"', async () => {
    mockSeedFindUnique.mockResolvedValue({ listing_id: SEED_LISTING_ID });
    mockListingFindUnique.mockResolvedValue({ keywords: SEED_KEYWORDS });

    const result = await resolveProfileSeoTags(TENANT_ID, []);
    expect(result.source).toBe('directory_seed');
  });

  it('reports source "profile" when neither side has tags', async () => {
    mockSeedFindUnique.mockResolvedValue(null);
    mockListingFindFirst.mockResolvedValue({ keywords: [] });

    await expect(resolveProfileSeoTags(TENANT_ID, null)).resolves.toEqual({ tags: [], source: 'profile' });
  });

  it('does not throw when the seed lookup fails', async () => {
    mockSeedFindUnique.mockRejectedValue(new Error('db down'));

    await expect(resolveProfileSeoTags(TENANT_ID, null)).resolves.toEqual({ tags: [], source: 'profile' });
    expect(mockWarn).toHaveBeenCalled();
  });
});

describe('resolveSeedListingSeo', () => {
  it('returns the composed keywords and narrative from the seed listing', async () => {
    mockSeedFindUnique.mockResolvedValue({ listing_id: SEED_LISTING_ID });
    mockListingFindUnique.mockResolvedValue({ keywords: SEED_KEYWORDS, description: SEED_DESCRIPTION });

    await expect(resolveSeedListingSeo(TENANT_ID)).resolves.toEqual({
      keywords: SEED_KEYWORDS,
      description: SEED_DESCRIPTION,
    });
  });

  it('returns an empty shape when nothing is seeded', async () => {
    mockSeedFindUnique.mockResolvedValue(null);
    mockListingFindFirst.mockResolvedValue(null);

    await expect(resolveSeedListingSeo(TENANT_ID)).resolves.toEqual({ keywords: [], description: null });
  });
});

describe('resolveDirectorySeo', () => {
  beforeEach(() => {
    mockSeedFindUnique.mockResolvedValue({ listing_id: SEED_LISTING_ID });
    mockListingFindUnique.mockResolvedValue({ keywords: SEED_KEYWORDS, description: SEED_DESCRIPTION });
  });

  it('falls back to the seed for both fields when the owner has neither', async () => {
    await expect(
      resolveDirectorySeo(TENANT_ID, { description: null, keywords: [] }),
    ).resolves.toEqual({
      description: { value: SEED_DESCRIPTION, source: 'directory_seed' },
      keywords: { value: SEED_KEYWORDS, source: 'directory_seed' },
    });
  });

  it('resolves each field independently', async () => {
    await expect(
      resolveDirectorySeo(TENANT_ID, { description: 'Our own copy.', keywords: [] }),
    ).resolves.toEqual({
      description: { value: 'Our own copy.', source: 'settings' },
      keywords: { value: SEED_KEYWORDS, source: 'directory_seed' },
    });
  });

  it("keeps the owner's values and skips the seed lookup when both are set", async () => {
    const result = await resolveDirectorySeo(TENANT_ID, {
      description: 'Our own copy.',
      keywords: ['halal market'],
    });

    expect(result).toEqual({
      description: { value: 'Our own copy.', source: 'settings' },
      keywords: { value: ['halal market'], source: 'settings' },
    });
    expect(mockSeedFindUnique).not.toHaveBeenCalled();
  });

  it('caps the fallback keywords at the directory panel limit', async () => {
    const many = Array.from({ length: 15 }, (_, i) => `keyword ${i}`);
    mockListingFindUnique.mockResolvedValue({ keywords: many, description: SEED_DESCRIPTION });

    const result = await resolveDirectorySeo(TENANT_ID, { description: '', keywords: [] });

    expect(result.keywords.value).toHaveLength(DIRECTORY_SEO_KEYWORDS_LIMIT);
    expect(result.keywords.source).toBe('directory_seed');
  });

  it('does not throw when the seed lookup fails', async () => {
    mockSeedFindUnique.mockRejectedValue(new Error('db down'));

    await expect(
      resolveDirectorySeo(TENANT_ID, { description: '', keywords: [] }),
    ).resolves.toEqual({
      description: { value: '', source: 'settings' },
      keywords: { value: [], source: 'settings' },
    });
  });
});
