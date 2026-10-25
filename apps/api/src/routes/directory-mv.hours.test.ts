/**
 * Open-now derivation for directory listings.
 *
 * `directory_listings_list.business_hours` stores lowercase day keys
 * ("monday"), but computeStoreStatus looks days up capitalized ("Monday").
 * Before normalization the mismatch made every listing read as closed — the
 * /directory "open now" chip counted listings that merely *had* hours, and the
 * ?openNow=true filter returned nothing.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeListingHours, computeIsOpenFromHours } from './directory-mv';

describe('normalizeListingHours', () => {
  it('capitalizes stored lowercase day keys', () => {
    expect(
      normalizeListingHours({
        monday: { open: '08:00', close: '20:00', closed: false },
        timezone: 'America/New_York',
      }),
    ).toEqual({
      Monday: { open: '08:00', close: '20:00' },
      timezone: 'America/New_York',
    });
  });

  it('parses legacy "9:00 AM - 5:00 PM" strings', () => {
    expect(normalizeListingHours({ monday: '9:00 AM - 5:00 PM' })).toEqual({
      Monday: { open: '09:00', close: '17:00' },
    });
  });

  it('passes a periods array through when there is no day-map', () => {
    const periods = [{ day: 'MONDAY', open: '09:00', close: '17:00' }];
    expect(normalizeListingHours({ periods, timezone: 'UTC' })).toEqual({
      timezone: 'UTC',
      periods,
    });
  });

  it('drops closed days', () => {
    expect(
      normalizeListingHours({
        sunday: { open: '09:00', close: '18:00', closed: true },
      }),
    ).toBeNull();
  });
});

describe('computeIsOpenFromHours', () => {
  afterEach(() => vi.useRealTimers());

  it('reports open during business hours on a lowercase day-map', () => {
    vi.useFakeTimers();
    // Monday 2026-10-26 12:00 UTC = 08:00 EDT
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
    expect(
      computeIsOpenFromHours({
        monday: { open: '08:00', close: '20:00', closed: false },
        timezone: 'America/New_York',
      }),
    ).toBe(true);
  });

  it('reports closed outside business hours', () => {
    vi.useFakeTimers();
    // Sunday 2026-10-25 22:00 EDT — only Monday hours are configured
    vi.setSystemTime(new Date('2026-10-26T02:00:00Z'));
    expect(
      computeIsOpenFromHours({
        monday: { open: '08:00', close: '20:00', closed: false },
        timezone: 'America/New_York',
      }),
    ).toBe(false);
  });

  it('returns null when the listing has no usable hours', () => {
    expect(computeIsOpenFromHours(null)).toBeNull();
    expect(computeIsOpenFromHours({})).toBeNull();
  });
});
