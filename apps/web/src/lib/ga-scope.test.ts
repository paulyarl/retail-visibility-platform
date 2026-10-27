import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { markSurfaceScope } from './ga-scope';

/**
 * Pins the runtime GA scope backstop: tenant/admin/system API traffic on a
 * page must hard-disable GA for the rest of that page load; public and
 * customer-scope traffic must leave tracking alone.
 */
describe('markSurfaceScope', () => {
  const disableKey = `ga-disable-${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || 'G-TEST'}`;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID = 'G-TEST';
    (globalThis as any).window = {};
  });

  afterEach(() => {
    delete (globalThis as any).window;
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  });

  it('disables GA for tenant/admin/authenticated requests', () => {
    for (const type of ['tenant', 'admin', 'authenticated']) {
      markSurfaceScope(type);
      expect((globalThis as any).window['ga-disable-G-TEST'], type).toBe(true);
    }
  });

  it('leaves GA enabled for public/customer/external/system requests', () => {
    for (const type of ['public', 'customer', 'external', 'system']) {
      markSurfaceScope(type);
      expect((globalThis as any).window['ga-disable-G-TEST'], type).toBeUndefined();
    }
  });

  it('is a no-op when the measurement id is unset', () => {
    delete process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    markSurfaceScope('tenant');
    expect((globalThis as any).window['ga-disable-undefined']).toBeUndefined();
    expect(Object.keys((globalThis as any).window)).toHaveLength(0);
  });

  it('is a no-op server-side (no window)', () => {
    delete (globalThis as any).window;
    expect(() => markSurfaceScope('tenant')).not.toThrow();
  });
});
