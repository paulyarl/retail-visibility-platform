import { describe, it, expect } from 'vitest';
import { attachOptionLabel, campaignMatchesPgDomain, type PgDomainLike } from './pg-attach-filter';

const indyPg: PgDomainLike = {
  categories: ['African Grocery Store'],
  geos: [{ city: 'Indianapolis', state: 'IN' }],
};

describe('campaignMatchesPgDomain', () => {
  it('accepts an Indianapolis run for the Indianapolis PG', () => {
    expect(
      campaignMatchesPgDomain(
        { category: 'African Grocery Store', city: 'Indianapolis', state: 'IN' },
        indyPg,
      ),
    ).toBe(true);
  });

  it('rejects a Milwaukee run for the Indianapolis PG', () => {
    expect(
      campaignMatchesPgDomain(
        { category: 'African Grocery Store', city: 'Milwaukee', state: 'WI' },
        indyPg,
      ),
    ).toBe(false);
  });

  it('rejects a different category in the same city', () => {
    expect(
      campaignMatchesPgDomain(
        { category: 'Middle Eastern Grocery Store', city: 'Indianapolis', state: 'IN' },
        indyPg,
      ),
    ).toBe(false);
  });

  it('tolerates a run with no state (legacy batch-born rows)', () => {
    expect(
      campaignMatchesPgDomain({ category: 'African Grocery Store', city: 'Indianapolis', state: null }, indyPg),
    ).toBe(true);
  });

  it('rejects a conflicting state when both sides carry one', () => {
    expect(
      campaignMatchesPgDomain(
        { category: 'African Grocery Store', city: 'Indianapolis', state: 'OH' },
        indyPg,
      ),
    ).toBe(false);
  });

  it('matches a secondary category declared on the PG', () => {
    expect(
      campaignMatchesPgDomain(
        { category: 'Middle Eastern Grocery Store', city: 'Indianapolis', state: 'IN' },
        { categories: ['African Grocery Store', 'Middle Eastern Grocery Store'], geos: indyPg.geos },
      ),
    ).toBe(true);
  });

  it('matches a member geo beyond the anchor city', () => {
    const domain: PgDomainLike = {
      categories: ['African Grocery Store'],
      geos: [
        { city: 'Indianapolis', state: 'IN' },
        { city: 'Avon', state: 'IN' },
      ],
    };
    expect(campaignMatchesPgDomain({ category: 'African Grocery Store', city: 'Avon', state: 'IN' }, domain)).toBe(true);
    expect(campaignMatchesPgDomain({ category: 'African Grocery Store', city: 'Carmel', state: 'IN' }, domain)).toBe(false);
  });

  it('accepts any city for a geography-free (mixed) PG', () => {
    expect(
      campaignMatchesPgDomain(
        { category: 'African Grocery Store', city: 'Milwaukee', state: 'WI' },
        { categories: ['African Grocery Store'], geos: [{ city: null, state: null }] },
      ),
    ).toBe(true);
  });

  it('rejects a nationwide run under a city-scoped PG', () => {
    expect(campaignMatchesPgDomain({ category: 'African Grocery Store', city: null }, indyPg)).toBe(false);
  });
});

describe('attachOptionLabel', () => {
  const twins = [
    { category: 'African Grocery Store', city: 'Indianapolis', state: 'IN', intelligence_focus: 'emerging', created_at: '2026-10-23T11:05:56Z' },
    { category: 'African Grocery Store', city: 'Indianapolis', state: 'IN', intelligence_focus: 'competitive', created_at: '2026-10-23T11:05:57Z' },
  ];

  it('distinguishes two runs of the same market by focus and date', () => {
    const labels = twins.map(attachOptionLabel);
    expect(labels[0]).toContain('emerging');
    expect(labels[1]).toContain('competitive');
    expect(labels[0]).not.toBe(labels[1]);
    expect(labels[0]).toContain('10/23');
  });

  it('prefers the title when one exists', () => {
    expect(
      attachOptionLabel({ title: 'African Grocery Store - Discovery - Emerging - Indianapolis, IN', city: 'Indianapolis', intelligence_focus: 'emerging' }),
    ).toContain('Discovery - Emerging');
  });
});
