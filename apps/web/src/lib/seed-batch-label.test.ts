import { describe, it, expect } from 'vitest';
import { seedBatchDisplayLabel } from './seed-batch-label';

describe('seedBatchDisplayLabel', () => {
  it('leads with date, shelf, place and size', () => {
    expect(
      seedBatchDisplayLabel({
        seedBatch: 'pg-mcamp-fv4svcsx-20261028',
        createdAt: '2026-10-28T11:20:08.783Z',
        seedCount: 10,
        category: 'African Grocery Store',
        categoryCount: 1,
        place: 'Milwaukee, WI',
        placeCount: 1,
      }),
    ).toBe('Oct 28 · African Grocery Store · Milwaukee, WI · 10 seeds');
  });

  it('appends the PG tag only when asked (tables carry a badge)', () => {
    const input = {
      seedBatch: 'pg-mcamp-fv4svcsx-20261028',
      createdAt: '2026-10-28T11:20:08.783Z',
      seedCount: 10,
      category: 'African Grocery Store',
      place: 'Milwaukee, WI',
    };
    expect(seedBatchDisplayLabel(input, { includePgTag: true })).toMatch(/ · PG$/);
    expect(seedBatchDisplayLabel(input)).not.toContain('PG');
  });

  it('never tags a non-PG batch', () => {
    expect(
      seedBatchDisplayLabel(
        { seedBatch: 'from-campaign-mcamp-7esxljzt', seedCount: 1, category: 'Halal Restaurant' },
        { includePgTag: true },
      ),
    ).toBe('Halal Restaurant · 1 seed');
  });

  it('falls back to the date embedded in the pg- label', () => {
    expect(
      seedBatchDisplayLabel({ seedBatch: 'pg-mcamp-qemsvv6t-20261024', seedCount: 19 }),
    ).toBe('Oct 24 · 19 seeds');
  });

  it('ignores an unparseable createdAt and still dates the cohort', () => {
    expect(
      seedBatchDisplayLabel({
        seedBatch: 'pg-mcamp-qemsvv6t-20261024',
        createdAt: 'not-a-date',
        seedCount: 19,
      }),
    ).toBe('Oct 24 · 19 seeds');
  });

  it('collapses multi-category / multi-city cohorts to +N', () => {
    expect(
      seedBatchDisplayLabel({
        seedBatch: 'pg-mcamp-mdjvk2bu-20261023',
        createdAt: '2026-10-23T19:28:21.952Z',
        seedCount: 53,
        category: 'African Grocery Store',
        categoryCount: 4,
        place: 'Indianapolis, IN',
        placeCount: 8,
      }),
    ).toBe('Oct 23 · African Grocery Store +3 · Indianapolis, IN +7 · 53 seeds');
  });

  it('does not add "+0" when the count is missing or singular', () => {
    expect(
      seedBatchDisplayLabel({
        seedBatch: 'from-campaign-mcamp-c5bno3o0',
        seedCount: 1,
        category: 'African Grocery Store',
        categoryCount: 1,
        place: 'Indianapolis, IN',
        placeCount: 0,
      }),
    ).toBe('African Grocery Store · Indianapolis, IN · 1 seed');
  });

  it('skips blank values instead of rendering empty segments', () => {
    expect(
      seedBatchDisplayLabel({
        seedBatch: 'from-campaign-mcamp-7esxljzt',
        seedCount: 1,
        category: '   ',
        place: '',
      }),
    ).toBe('1 seed');
  });

  it('falls back to the raw slug when nothing is known about the cohort', () => {
    expect(seedBatchDisplayLabel({ seedBatch: 'hand-stamped-batch' })).toBe('hand-stamped-batch');
  });
});
