/**
 * CategoryVocabulary tests — CATEGORY_IDENTIFICATION_VOCAB_INJECTION_SPEC.
 * docs/LocalBiz/CATEGORY_IDENTIFICATION_VOCAB_INJECTION_SPEC.md
 *
 * Covers:
 * - formatKnownCategoryVocabulary: both lists / directory-only / registered-
 *   only / both-empty, case-insensitive dedupe with directory casing winning,
 *   dynamic counts, labels-only output
 * - CategoryVocabularyService: loadVocabulary per-source degradation,
 *   isKnownLabel union membership, findRegisteredValue, 5-minute TTL cache
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany, mockListCategories, mockQueryRaw } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockListCategories: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    platform_categories: { findMany: mockFindMany },
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../MarketingServiceCategoryService', () => ({
  default: { listCategories: mockListCategories },
  MarketingServiceCategoryService: { getInstance: () => ({ listCategories: mockListCategories }) },
}));

import { CategoryVocabularyService } from '../CategoryVocabularyService';
import { formatKnownCategoryVocabulary, formatEnrichmentCategoryVocabulary } from '../intelligence/MarketContextBindingFormatters';

const service = CategoryVocabularyService.getInstance();

beforeEach(() => {
  mockFindMany.mockReset();
  mockListCategories.mockReset();
  mockQueryRaw.mockReset();
  mockQueryRaw.mockResolvedValue([]);
  service.resetCache();
});

// ─── formatKnownCategoryVocabulary ──────────────────────────────────────

describe('formatKnownCategoryVocabulary', () => {
  it('renders all sections with dynamic counts when all lists are present', () => {
    const block = formatKnownCategoryVocabulary(
      ['Grocery Store', 'Auto Repair'],
      ['Somali Grocery Store'],
      ['Middle Eastern Grocery Store'],
    );

    expect(block).toContain('KNOWN CATEGORY VOCABULARY');
    expect(block).toContain('the 2 canonical category labels');
    expect(block).toContain('KNOWN CATEGORIES (2):');
    expect(block).toContain('Auto Repair, Grocery Store');
    expect(block).toContain('ENRICHED CATEGORIES (1)');
    expect(block).toContain('Middle Eastern Grocery Store');
    expect(block).toContain('REGISTERED LABELS (1)');
    expect(block).toContain('Somali Grocery Store');
  });

  it('leads with the platform goal — physical shelves of independent retailers', () => {
    const block = formatKnownCategoryVocabulary(['Grocery Store'], []);

    expect(block).toContain('PLATFORM GOAL');
    expect(block).toContain('PHYSICAL SHELVES');
    expect(block).toContain('independent brick-and-mortar retailers');
  });

  it('frames the candidate list as propagating one prospect across shelves', () => {
    const block = formatKnownCategoryVocabulary(['Grocery Store'], []);

    expect(block).toContain('ONE prospect across shelves');
    expect(block).toContain('Secondary candidates file the same business on additional shelves');
  });

  it('judges is_known_category against all three lists', () => {
    const block = formatKnownCategoryVocabulary(['Grocery Store'], [], ['Ramen Shop']);

    expect(block).toContain('ENRICHED CATEGORIES = categories established by enrichment');
    expect(block).toContain('in ANY list below, set is_known_category =');
  });

  it('renders the directory section alone when the other lists are empty', () => {
    const block = formatKnownCategoryVocabulary(['Grocery Store'], []);

    expect(block).toContain('KNOWN CATEGORIES (1):');
    expect(block).toContain('Grocery Store');
    expect(block).not.toContain('ENRICHED CATEGORIES (');
    expect(block).not.toContain('REGISTERED LABELS (');
  });

  it('renders the registered section alone when the directory list is empty', () => {
    const block = formatKnownCategoryVocabulary([], ['Somali Grocery Store']);

    expect(block).toContain('the 0 canonical category labels');
    expect(block).not.toContain('KNOWN CATEGORIES (');
    expect(block).toContain('REGISTERED LABELS (1)');
    expect(block).toContain('Somali Grocery Store');
  });

  it('renders supplement labels alone when the other lists are empty', () => {
    const block = formatKnownCategoryVocabulary([], [], ['Middle Eastern Grocery Store']);

    expect(block).toContain('ENRICHED CATEGORIES (1)');
    expect(block).toContain('Middle Eastern Grocery Store');
    expect(block).not.toContain('KNOWN CATEGORIES (');
    expect(block).not.toContain('REGISTERED LABELS (');
  });

  it('partitions supplement labels against directory and registered labels (case-insensitive)', () => {
    const block = formatKnownCategoryVocabulary(
      ['Grocery Store'],
      ['Somali Grocery Store'],
      ['grocery store', '  Somali Grocery Store ', 'Middle Eastern Grocery Store'],
    );

    expect(block).toContain('ENRICHED CATEGORIES (1)');
    const supplementSection = block
      .split('ENRICHED CATEGORIES (')[1]
      .split('REGISTERED LABELS')[0];
    expect(supplementSection).toContain('Middle Eastern Grocery Store');
    expect(supplementSection).not.toContain('grocery store,');
    expect(supplementSection).not.toContain('Somali Grocery Store');
  });

  it("returns '' when all lists are empty", () => {
    expect(formatKnownCategoryVocabulary([], [])).toBe('');
    expect(formatKnownCategoryVocabulary(['  ', ''], ['   '])).toBe('');
    expect(formatKnownCategoryVocabulary([], [], [])).toBe('');
    expect(formatKnownCategoryVocabulary([], [], ['  '])).toBe('');
  });

  it('excludes registered labels that already appear in the directory list (case-insensitive, trimmed)', () => {
    const block = formatKnownCategoryVocabulary(
      ['Grocery Store'],
      ['  grocery store ', 'Somali Grocery Store'],
    );

    expect(block).toContain('Grocery Store');
    expect(block).toContain('REGISTERED LABELS (1)');
    expect(block).toContain('Somali Grocery Store');
    // The registered section must not re-list the directory label.
    const registeredSection = block.split('REGISTERED LABELS')[1];
    expect(registeredSection).not.toContain('grocery store ,');
    expect(registeredSection).not.toContain('Grocery Store,');
  });

  it('dedupes within each list case-insensitively and preserves the first casing', () => {
    const block = formatKnownCategoryVocabulary(
      ['Grocery Store', 'grocery store', 'Auto Repair'],
      [],
    );

    expect(block).toContain('KNOWN CATEGORIES (2):');
    expect(block).toContain('Auto Repair, Grocery Store');
  });

  it('does not emit descriptions, slugs, or counts per label', () => {
    const block = formatKnownCategoryVocabulary(['Adult Dvd Store'], []);

    expect(block).toContain('Adult Dvd Store');
    expect(block).not.toContain('adult-dvd-store');
    expect(block).not.toContain('gcid:');
    expect(block).not.toContain('Business category for');
  });

  it('does not assert a MARKET CONTEXT block exists (campaign may have no city)', () => {
    const block = formatKnownCategoryVocabulary(['Grocery Store'], []);

    expect(block).toContain('MARKET CONTEXT block (when that block is present)');
    expect(block).not.toContain('MARKET CONTEXT block above');
  });
});

// ─── formatEnrichmentCategoryVocabulary ─────────────────────────────────
// Same union, different framing: enrichment packets name related categories
// that the public pages resolve to live shelves by exact label, so the block
// steers the analyst to prefer listed labels (sub_categories stay free-form).

describe('formatEnrichmentCategoryVocabulary', () => {
  it('renders both sections with dynamic counts when both lists are present', () => {
    const block = formatEnrichmentCategoryVocabulary(
      ['Grocery Store', 'Auto Repair'],
      ['Somali Grocery Store'],
    );

    expect(block).toContain('PLATFORM CATEGORY VOCABULARY');
    expect(block).toContain('the 2 canonical category labels');
    expect(block).toContain('KNOWN CATEGORIES (2):');
    expect(block).toContain('Auto Repair, Grocery Store');
    expect(block).toContain('REGISTERED LABELS (1)');
    expect(block).toContain('Somali Grocery Store');
  });

  it('steers related-category fields to verbatim listed labels while exempting sub_categories', () => {
    const block = formatEnrichmentCategoryVocabulary(['Grocery Store'], []);

    expect(block).toContain('DIRECTIVE — emit names verbatim from the KNOWN CATEGORIES');
    expect(block).toContain('secondary_categories');
    expect(block).toContain('adjacent_categories');
    expect(block).toContain('super_categories');
    expect(block).toContain('sub_categories are exempt');
    expect(block).toContain('matches a shelf label exactly');
  });

  it('frames super_categories as platform parents, not external taxonomy buckets', () => {
    const block = formatEnrichmentCategoryVocabulary(['Grocery Store'], []);

    expect(block).toContain('super_categories are PLATFORM parents');
    expect(block).toContain('drill up to');
    expect(block).toContain('"Retail"');
  });

  it('leads with the platform goal — physical shelves of independent retailers', () => {
    const block = formatEnrichmentCategoryVocabulary(['Grocery Store'], []);

    expect(block).toContain('PLATFORM GOAL');
    expect(block).toContain('PHYSICAL SHELVES');
    expect(block).toContain('independent brick-and-mortar retailers');
    // Non-shelf businesses are a legitimate unlisted pick, not an error.
    expect(block).toContain('is legitimate when no shelf fits');
  });

  it("returns '' when all lists are empty", () => {
    expect(formatEnrichmentCategoryVocabulary([], [])).toBe('');
    expect(formatEnrichmentCategoryVocabulary(['  ', ''], ['   '])).toBe('');
    expect(formatEnrichmentCategoryVocabulary([], [], [])).toBe('');
    expect(formatEnrichmentCategoryVocabulary([], [], ['  '])).toBe('');
  });

  it('renders the ENRICHED CATEGORIES section for supplement labels', () => {
    const block = formatEnrichmentCategoryVocabulary(
      ['Grocery Store'],
      [],
      ['Middle Eastern Grocery Store', 'Ramen Shop'],
    );

    expect(block).toContain('ENRICHED CATEGORIES (2)');
    expect(block).toContain('Middle Eastern Grocery Store');
    expect(block).toContain('Ramen Shop');
    expect(block).toContain('the KNOWN CATEGORIES and');
    expect(block).toContain('lists below');
  });

  it('renders supplement labels alone when the other lists are empty', () => {
    const block = formatEnrichmentCategoryVocabulary([], [], ['Middle Eastern Grocery Store']);

    expect(block).toContain('ENRICHED CATEGORIES (1)');
    expect(block).not.toContain('KNOWN CATEGORIES (');
    expect(block).not.toContain('REGISTERED LABELS');
  });

  it('partitions supplement labels against directory and registered labels (case-insensitive)', () => {
    const block = formatEnrichmentCategoryVocabulary(
      ['Grocery Store'],
      ['Somali Grocery Store'],
      ['grocery store', '  Somali Grocery Store ', 'Middle Eastern Grocery Store'],
    );

    expect(block).toContain('ENRICHED CATEGORIES (1)');
    const supplementSection = block
      .split('ENRICHED CATEGORIES')[1]
      .split('REGISTERED LABELS')[0];
    expect(supplementSection).toContain('Middle Eastern Grocery Store');
    expect(supplementSection).not.toContain('grocery store,');
    expect(supplementSection).not.toContain('Somali Grocery Store');
  });

  it('excludes registered labels that already appear in the directory list (case-insensitive, trimmed)', () => {
    const block = formatEnrichmentCategoryVocabulary(
      ['Grocery Store'],
      ['  grocery store ', 'Somali Grocery Store'],
    );

    expect(block).toContain('REGISTERED LABELS (1)');
    const registeredSection = block.split('REGISTERED LABELS')[1];
    expect(registeredSection).toContain('Somali Grocery Store');
    expect(registeredSection).not.toContain('Grocery Store,');
  });
});

// ─── CategoryVocabularyService ──────────────────────────────────────────

describe('CategoryVocabularyService.loadVocabulary', () => {
  it('returns all three lists from their sources', async () => {
    mockFindMany.mockResolvedValue([{ name: 'Grocery Store' }, { name: 'Auto Repair' }]);
    mockListCategories.mockResolvedValue([{ value: 'somali_grocery_store', label: 'Somali Grocery Store' }]);
    mockQueryRaw.mockResolvedValue([{ name: 'Middle Eastern Grocery Store' }]);

    const vocab = await service.loadVocabulary();

    expect(vocab.directoryLabels).toEqual(['Grocery Store', 'Auto Repair']);
    expect(vocab.registeredLabels).toEqual(['Somali Grocery Store']);
    expect(vocab.supplementLabels).toEqual(['Middle Eastern Grocery Store']);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { is_active: true },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    expect(mockQueryRaw).toHaveBeenCalled();
  });

  it('degrades the directory list to [] when platform_categories read fails, keeping registered labels', async () => {
    mockFindMany.mockRejectedValue(new Error('connection refused'));
    mockListCategories.mockResolvedValue([{ value: 'x', label: 'Somali Grocery Store' }]);

    const vocab = await service.loadVocabulary();

    expect(vocab.directoryLabels).toEqual([]);
    expect(vocab.registeredLabels).toEqual(['Somali Grocery Store']);
  });

  it('degrades the registered list to [] when listCategories rethrows, keeping directory labels', async () => {
    mockFindMany.mockResolvedValue([{ name: 'Grocery Store' }]);
    mockListCategories.mockRejectedValue(new Error('service exploded'));

    const vocab = await service.loadVocabulary();

    expect(vocab.directoryLabels).toEqual(['Grocery Store']);
    expect(vocab.registeredLabels).toEqual([]);
  });

  it('degrades the supplement list to [] when the module-category query fails', async () => {
    mockFindMany.mockResolvedValue([{ name: 'Grocery Store' }]);
    mockQueryRaw.mockRejectedValue(new Error('table missing'));

    const vocab = await service.loadVocabulary();

    expect(vocab.directoryLabels).toEqual(['Grocery Store']);
    expect(vocab.supplementLabels).toEqual([]);
  });

  it('filters sentinel placeholder categories out of the supplement list', async () => {
    mockFindMany.mockResolvedValue([]);
    mockQueryRaw.mockResolvedValue([
      { name: '  __location__  ' },
      { name: '__all__' },
      { name: '   ' },
      { name: 'Middle Eastern Grocery Store' },
    ]);

    const vocab = await service.loadVocabulary();

    expect(vocab.supplementLabels).toEqual(['Middle Eastern Grocery Store']);
  });

  it('never throws when all sources fail', async () => {
    mockFindMany.mockRejectedValue(new Error('down'));
    mockListCategories.mockRejectedValue(new Error('down'));
    mockQueryRaw.mockRejectedValue(new Error('down'));

    const vocab = await service.loadVocabulary();

    expect(vocab).toEqual({ directoryLabels: [], registeredLabels: [], supplementLabels: [] });
  });

  it('serves repeat loads from cache within the TTL', async () => {
    mockFindMany.mockResolvedValue([{ name: 'Grocery Store' }]);
    mockListCategories.mockResolvedValue([]);

    await service.loadVocabulary();
    await service.loadVocabulary();

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockListCategories).toHaveBeenCalledTimes(1);
  });
});

describe('CategoryVocabularyService.isKnownLabel', () => {
  beforeEach(() => {
    mockFindMany.mockResolvedValue([{ name: 'Grocery Store' }]);
    mockListCategories.mockResolvedValue([{ value: 'somali_grocery_store', label: 'Somali Grocery Store' }]);
  });

  it('matches directory labels case-insensitively with trimming', async () => {
    expect(await service.isKnownLabel('  grocery STORE ')).toBe(true);
  });

  it('matches registered labels', async () => {
    expect(await service.isKnownLabel('Somali Grocery Store')).toBe(true);
  });

  it('matches enrichment-supplement labels', async () => {
    mockQueryRaw.mockResolvedValue([{ name: 'Middle Eastern Grocery Store' }]);

    expect(await service.isKnownLabel('middle eastern grocery store')).toBe(true);
  });

  it('returns false for labels outside the union', async () => {
    expect(await service.isKnownLabel('Underwater Basket Weaving')).toBe(false);
  });

  it('returns false for empty labels and when the vocabulary is empty', async () => {
    expect(await service.isKnownLabel('   ')).toBe(false);

    mockFindMany.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([]);
    service.resetCache();
    expect(await service.isKnownLabel('Grocery Store')).toBe(false);
  });
});

describe('CategoryVocabularyService.findRegisteredValue', () => {
  it('finds a registered row by value', async () => {
    mockFindMany.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([
      { value: 'somali_grocery_store', label: 'Somali Grocery Store' },
    ]);

    const row = await service.findRegisteredValue('somali_grocery_store');

    expect(row).toEqual({ value: 'somali_grocery_store', label: 'Somali Grocery Store' });
  });

  it('returns null for unknown or empty values', async () => {
    mockFindMany.mockResolvedValue([]);
    mockListCategories.mockResolvedValue([{ value: 'a', label: 'A' }]);

    expect(await service.findRegisteredValue('missing')).toBeNull();
    expect(await service.findRegisteredValue('')).toBeNull();
  });
});
