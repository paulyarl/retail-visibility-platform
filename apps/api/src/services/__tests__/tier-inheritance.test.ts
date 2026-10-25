import { describe, it, expect } from 'vitest';
import { computeClosure, wouldCreateCycle, type InheritanceEdge } from '../TierInheritanceService';

const edge = (child: string, parent: string): InheritanceEdge => ({
  child_tier_key: child,
  parent_tier_key: parent,
});

describe('computeClosure — tier inheritance', () => {
  it('returns every ancestor, transitively', () => {
    const edges = [edge('storefront', 'discovery'), edge('discovery', 'google_only'), edge('google_only', 'directory_presence')];
    expect(computeClosure(edges, ['storefront']).sort()).toEqual(
      ['directory_presence', 'discovery', 'google_only'].sort(),
    );
  });

  it('excludes the seeds themselves', () => {
    const edges = [edge('storefront', 'discovery')];
    expect(computeClosure(edges, ['storefront'])).toEqual(['discovery']);
  });

  it('handles a diamond without duplicating', () => {
    const edges = [
      edge('omnichannel', 'commitment'),
      edge('omnichannel', 'ecommerce'),
      edge('commitment', 'storefront'),
      edge('ecommerce', 'storefront'),
    ];
    expect(computeClosure(edges, ['omnichannel']).sort()).toEqual(['commitment', 'ecommerce', 'storefront']);
  });

  it('is idempotent when the table already stores the closure', () => {
    const edges = [
      edge('storefront', 'discovery'),
      edge('storefront', 'google_only'),
      edge('storefront', 'directory_presence'),
      edge('discovery', 'google_only'),
      edge('discovery', 'directory_presence'),
      edge('google_only', 'directory_presence'),
    ];
    expect(computeClosure(edges, ['storefront']).sort()).toEqual(
      ['directory_presence', 'discovery', 'google_only'].sort(),
    );
  });

  it('survives a cycle without looping forever', () => {
    const edges = [edge('a', 'b'), edge('b', 'a')];
    expect(computeClosure(edges, ['a'])).toEqual(['b']);
  });

  it('returns nothing for a tier with no parents', () => {
    expect(computeClosure([edge('a', 'b')], ['b'])).toEqual([]);
  });

  it('unions the closure of multiple seeds', () => {
    const edges = [edge('a', 'p'), edge('b', 'q')];
    expect(computeClosure(edges, ['a', 'b']).sort()).toEqual(['p', 'q']);
  });
});

describe('wouldCreateCycle — write-time guard', () => {
  it('allows a downward link', () => {
    expect(wouldCreateCycle([], 'storefront', ['discovery'])).toBe(false);
  });

  it('rejects a two-tier loop between equal-price tiers', () => {
    // google_only and discovery are both $29, so price direction permits either way
    const edges = [edge('discovery', 'google_only')];
    expect(wouldCreateCycle(edges, 'google_only', ['discovery'])).toBe(true);
  });

  it('rejects a longer loop', () => {
    const edges = [edge('a', 'b'), edge('b', 'c')];
    expect(wouldCreateCycle(edges, 'c', ['a'])).toBe(true);
  });

  it('ignores edges belonging to the tier being rewritten', () => {
    const edges = [edge('c', 'b')];
    expect(wouldCreateCycle(edges.filter((e) => e.child_tier_key !== 'c'), 'c', ['a'])).toBe(false);
  });
});
