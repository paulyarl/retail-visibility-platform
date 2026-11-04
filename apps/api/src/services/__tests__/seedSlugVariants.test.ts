/**
 * Seed slug-variant matcher — the /place 404 recovery path.
 *
 * Scenario this pins: a seed was published, Google indexed its slug, the seed
 * was removed and republished under a new slug. The dead URL must 308 to the
 * live one when — and only when — a single live seed can explain it.
 */
import { describe, it, expect } from 'vitest';
import { matchSeedSlugVariant, type SeedSlugCandidate } from '../directory/seedSlugVariants';

const jokky: SeedSlugCandidate = {
  slug: 'jokkymore-african-market-indianapolis-in',
  businessName: 'JokkyMore African Market',
  nameVariants: ['JokkyMore D Chef Food Services', 'JokkyMore African Market LLC'],
  city: 'Indianapolis',
  state: 'IN',
};

describe('matchSeedSlugVariant', () => {
  it('resolves the bare-name slug of the republished seed', () => {
    expect(matchSeedSlugVariant('jokkymore-african-market', [jokky]))
      .toBe('jokkymore-african-market-indianapolis-in');
  });

  it('resolves a legal-suffix + name-variant stitched slug', () => {
    expect(
      matchSeedSlugVariant('jokkymore-african-market-llc-jokkymore-d-chef-food-services', [jokky]),
    ).toBe('jokkymore-african-market-indianapolis-in');
  });

  it('resolves a different geo suffix when the stored state is a code', () => {
    const seed = { ...jokky, slug: 'jokkymore-african-market' };
    expect(matchSeedSlugVariant('jokkymore-african-market-indianapolis-indiana', [seed]))
      .toBe('jokkymore-african-market');
  });

  it('resolves a geo suffix when the stored state is the full name', () => {
    const seed = { ...jokky, slug: 'jokkymore-african-market', state: 'Indiana' as const };
    expect(matchSeedSlugVariant('jokkymore-african-market-indianapolis-in', [seed]))
      .toBe('jokkymore-african-market');
  });

  it('resolves a truncated old slug that is a token subset of the name', () => {
    expect(matchSeedSlugVariant('jokkymore-market', [jokky]))
      .toBe('jokkymore-african-market-indianapolis-in');
  });

  it('resolves a bare name-variant slug', () => {
    expect(matchSeedSlugVariant('jokkymore-d-chef-food-services', [jokky]))
      .toBe('jokkymore-african-market-indianapolis-in');
  });

  it('returns null when two live seeds can explain the slug', () => {
    const twin: SeedSlugCandidate = {
      slug: 'jokkymore-african-market-fort-wayne-in',
      businessName: 'JokkyMore African Market',
      nameVariants: [],
      city: 'Fort Wayne',
      state: 'IN',
    };
    expect(matchSeedSlugVariant('jokkymore-african-market', [jokky, twin])).toBeNull();
  });

  it('returns null for an unrelated slug', () => {
    expect(matchSeedSlugVariant('marias-taqueria-chicago-il', [jokky])).toBeNull();
  });

  it('returns null when the only candidate IS the requested slug', () => {
    expect(matchSeedSlugVariant('jokkymore-african-market-indianapolis-in', [jokky])).toBeNull();
  });

  it('returns null for unexplained residual tokens', () => {
    expect(matchSeedSlugVariant('jokkymore-african-market-outlet-mall', [jokky])).toBeNull();
  });

  it('returns null for non-slug input', () => {
    expect(matchSeedSlugVariant('JokkyMore Market!', [jokky])).toBeNull();
    expect(matchSeedSlugVariant('', [jokky])).toBeNull();
  });

  it('returns null when no live seeds exist', () => {
    expect(matchSeedSlugVariant('jokkymore-african-market', [])).toBeNull();
  });

  it('ignores candidates without a slug', () => {
    const slugless: SeedSlugCandidate = { ...jokky, slug: null };
    expect(matchSeedSlugVariant('jokkymore-african-market', [slugless])).toBeNull();
  });
});
