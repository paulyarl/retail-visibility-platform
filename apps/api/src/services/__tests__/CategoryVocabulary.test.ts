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

const { mockFindMany, mockListCategories } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockListCategories: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { platform_categories: { findMany: mockFindMany } },
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
  service.resetCache();
});

// ─── formatKnownCategoryVocabulary ──────────────────────────────────────

describe('formatKnownCategoryVocabulary', () => {
  it('renders both sections with dynamic counts when both lists are present', () => {
    const block = formatKnownCategoryVocabulary(
      ['Grocery Store', 'Auto Repair'],
      ['Somali Grocery Store'],
    );

    expect(block).toContain('KNOWN CATEGORY VOCABULARY');
    expect(block).toContain('directory vocabulary of 2 category labels');
    expect(block).toContain('KNOWN CATEGORIES (2):');
    expect(block).toContain('Auto Repair, Grocery Store');
    expect(block).toContain('REGISTERED LABELS (1)');
    expect(block).toContain('Somali Grocery Store');
  });

  it('renders the directory section alone when the registered list is empty', () => {
    const block = formatKnownCategoryVocabulary(['Grocery Store'], []);

    expect(block).toContain('KNOWN CATEGORIES (1):');
    expect(block).toContain('Grocery Store');
    expect(block).not.toContain('REGISTERED LABELS');
  });

  it('renders the registered section alone when the directory list is empty', () => {
    const block = formatKnownCategoryVocabulary([], ['Somali Grocery Store']);

    expect(block).toContain('directory vocabulary of 0 category labels');
    expect(block).not.toContain('KNOWN CATEGORIES (');
    expect(block).toContain('REGISTERED LABELS (1)');
    expect(block).toContain('Somali Grocery Store');
  });

  it("returns '' when both lists are empty", () => {
    expect(formatKnownCategoryVocabulary([], [])).toBe('');
    expect(formatKnownCategoryVocabulary(['  ', ''], ['   '])).toBe('');
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

  it("returns '' when both lists are empty", () => {
    expect(formatEnrichmentCategoryVocabulary([], [])).toBe('');
    expect(formatEnrichmentCategoryVocabulary(['  ', ''], ['   '])).toBe('');
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
  it('returns both lists from their sources', async () => {
    mockFindMany.mockResolvedValue([{ name: 'Grocery Store' }, { name: 'Auto Repair' }]);
    mockListCategories.mockResolvedValue([{ value: 'somali_grocery_store', label: 'Somali Grocery Store' }]);

    const vocab = await service.loadVocabulary();

    expect(vocab.directoryLabels).toEqual(['Grocery Store', 'Auto Repair']);
    expect(vocab.registeredLabels).toEqual(['Somali Grocery Store']);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { is_active: true },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
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

  it('never throws when both sources fail', async () => {
    mockFindMany.mockRejectedValue(new Error('down'));
    mockListCategories.mockRejectedValue(new Error('down'));

    const vocab = await service.loadVocabulary();

    expect(vocab).toEqual({ directoryLabels: [], registeredLabels: [] });
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
