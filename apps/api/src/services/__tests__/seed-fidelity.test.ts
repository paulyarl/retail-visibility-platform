/**
 * seed-fidelity — project-phase spec §4/§6 wedge verdict.
 *
 * The comparator is pure: canonical footprint (campaign+audit resolved NAP)
 * vs the live listing snapshot, owner-verified NAP authoritative, shared
 * material-variance normalization. Persisted verdict feeds every claim
 * surface's misaligned → inquiry-path degradation.
 */
import { describe, expect, it } from 'vitest';
import {
  evaluateSeedFidelity,
  type SeedFidelityInput,
} from '../seed-fidelity';

const RICH_LISTING: SeedFidelityInput['listing'] = {
  business_name: 'Harbor Deli & Market',
  address: '412 Meridian St',
  city: 'Indianapolis',
  state: 'IN',
  phone: '3175550100',
  product_count: 14,
  business_hours: { monday: { open: '08:00', close: '20:00' } },
};

const CANONICAL: SeedFidelityInput['canonical'] = {
  name: 'Harbor Deli & Market',
  address: '412 Meridian Street',
  city: 'Indianapolis',
  state: 'IN',
  phone: '(317) 555-0100',
};

const base = (over: Partial<SeedFidelityInput> = {}): SeedFidelityInput => ({
  canonical: CANONICAL,
  listing: RICH_LISTING,
  photoCount: 6,
  napVerified: false,
  ...over,
});

describe('evaluateSeedFidelity', () => {
  it('returns unknown when no canonical footprint exists', () => {
    expect(evaluateSeedFidelity(base({ canonical: null }))).toBe('unknown');
    expect(
      evaluateSeedFidelity(base({ canonical: { name: null, address: null, city: null, state: null, phone: null } })),
    ).toBe('unknown');
  });

  it('aligned when material fields match and the listing is rich', () => {
    expect(evaluateSeedFidelity(base())).toBe('aligned');
  });

  it('formatting-only NAP differences are cosmetic, not misaligned', () => {
    // Legal suffix, address abbreviation, phone punctuation — the shared
    // material-variance rule must treat these as the same identity.
    expect(
      evaluateSeedFidelity(
        base({
          canonical: {
            name: 'Harbor Deli & Market LLC',
            address: '412 Meridian St.',
            city: 'Indianapolis',
            state: 'IN',
            phone: '+1 (317) 555-0100',
          },
        }),
      ),
    ).toBe('aligned');
  });

  it('misaligned on material name / address / phone differences', () => {
    expect(
      evaluateSeedFidelity(base({ listing: { ...RICH_LISTING, business_name: 'Harbor Grocery' } })),
    ).toBe('misaligned');
    expect(
      evaluateSeedFidelity(base({ listing: { ...RICH_LISTING, address: '900 Fall Creek Pkwy' } })),
    ).toBe('misaligned');
    expect(
      evaluateSeedFidelity(base({ listing: { ...RICH_LISTING, phone: '3175559999' } })),
    ).toBe('misaligned');
  });

  it('misaligned on material city/state differences', () => {
    expect(
      evaluateSeedFidelity(base({ listing: { ...RICH_LISTING, city: 'Carmel' } })),
    ).toBe('misaligned');
    expect(
      evaluateSeedFidelity(base({ listing: { ...RICH_LISTING, state: 'OH' } })),
    ).toBe('misaligned');
  });

  it('city/state formatting-only differences stay cosmetic', () => {
    expect(
      evaluateSeedFidelity(
        base({ canonical: { ...CANONICAL, city: '  indianapolis ', state: 'in' } }),
      ),
    ).toBe('aligned');
  });

  it('owner-verified NAP is authoritative — audit canonical cannot misalign', () => {
    // Owner corrected the listing after claim; the audit's canonical record is
    // the stale one. Even a materially different listing NAP stays aligned
    // when the owner attested it.
    expect(
      evaluateSeedFidelity(
        base({
          napVerified: true,
          listing: { ...RICH_LISTING, business_name: 'Harbor Grocery', phone: '3175559999' },
        }),
      ),
    ).toBe('aligned');
  });

  it('thin when material fields match but the listing is sparse', () => {
    expect(
      evaluateSeedFidelity(base({ listing: { ...RICH_LISTING, product_count: 0 } })),
    ).toBe('thin');
    expect(evaluateSeedFidelity(base({ photoCount: 0 }))).toBe('thin');
    expect(
      evaluateSeedFidelity(base({ listing: { ...RICH_LISTING, business_hours: null } })),
    ).toBe('thin');
  });

  it('misaligned outranks thin — bad data suppresses before sparsity is judged', () => {
    expect(
      evaluateSeedFidelity(
        base({
          photoCount: 0,
          listing: { ...RICH_LISTING, business_name: 'Harbor Grocery', product_count: 0 },
        }),
      ),
    ).toBe('misaligned');
  });

  it('a canonical field cannot misalign against a missing listing field', () => {
    // Missing phone on the listing is sparsity, not a wrong value.
    expect(
      evaluateSeedFidelity(base({ listing: { ...RICH_LISTING, phone: null } })),
    ).toBe('aligned');
  });
});
