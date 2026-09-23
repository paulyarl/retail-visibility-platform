/**
 * stripStaleBusinessCount — normalizes location packet copy written before the
 * count-free composer contract, so a stale baked count is never rendered.
 */
import { describe, it, expect } from 'vitest';
import { stripStaleBusinessCount } from './strip-stale-business-count';

describe('stripStaleBusinessCount', () => {
  it('drops the baked count from the legacy location description', () => {
    expect(
      stripStaleBusinessCount(
        'Discover 0 local businesses in Kansas City, MO, listed on VisibleShelf from public information. Browse top categories: grocery stores.',
      ),
    ).toBe(
      'Discover local businesses in Kansas City, MO, listed on VisibleShelf from public information. Browse top categories: grocery stores.',
    );
  });

  it('drops the baked count from the legacy location meta title', () => {
    expect(stripStaleBusinessCount('0 Businesses in Kansas City, MO — VisibleShelf Directory')).toBe(
      'Local Businesses in Kansas City, MO — VisibleShelf Directory',
    );
  });

  it('handles thousands separators and mid-sentence counts', () => {
    expect(stripStaleBusinessCount('12,480 local businesses across the metro')).toBe(
      'local businesses across the metro',
    );
  });

  it('leaves already-clean composer copy untouched', () => {
    const clean =
      'Discover local businesses in Kansas City, MO, listed on VisibleShelf from public information.';
    expect(stripStaleBusinessCount(clean)).toBe(clean);
    expect(stripStaleBusinessCount('Local Businesses in Kansas City, MO — VisibleShelf Directory')).toBe(
      'Local Businesses in Kansas City, MO — VisibleShelf Directory',
    );
  });

  it('leaves unrelated numbers alone', () => {
    const text = 'The metro spans 2 states and shoppers can browse 6 categories.';
    expect(stripStaleBusinessCount(text)).toBe(text);
  });

  it('returns null for empty input', () => {
    expect(stripStaleBusinessCount(null)).toBeNull();
    expect(stripStaleBusinessCount(undefined)).toBeNull();
    expect(stripStaleBusinessCount('')).toBeNull();
  });
});
