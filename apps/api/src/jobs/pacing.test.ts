import { describe, it, expect } from 'vitest';
import { dripPaceMs } from './pacing';

const SIX_HOURS = 6 * 60 * 60 * 1000;

describe('dripPaceMs', () => {
  it('spreads a production-scale sweep across ~70% of the interval', () => {
    // 206 tenants over 6h → ~73s between tenants
    const pace = dripPaceMs(206, SIX_HOURS);
    expect(pace).toBeGreaterThan(60_000);
    expect(pace).toBeLessThan(120_000);
  });

  it('caps the delay for small item counts instead of stretching absurdly', () => {
    expect(dripPaceMs(5, SIX_HOURS)).toBe(120_000);
  });

  it('floors at minMs for enormous counts', () => {
    expect(dripPaceMs(1_000_000, SIX_HOURS)).toBe(1_000);
  });

  it('returns minMs for empty counts', () => {
    expect(dripPaceMs(0, SIX_HOURS)).toBe(1_000);
  });

  it('honors custom fill/min/max', () => {
    const pace = dripPaceMs(100, 60_000, { fill: 0.5, minMs: 100, maxMs: 500 });
    expect(pace).toBe(300); // 60000 * 0.5 / 100
  });
});
