import { describe, it, expect } from 'vitest';
import { describeRateLimit } from './rate-limit-format';

// The admin Rate Limiting panel rendered `Math.floor(windowMs / 60000)` minutes
// with a hardcoded plural unit, so a 60s window read "10 requests per 1 minutes"
// and a 1h window read "3 requests per 1 hours".
describe('describeRateLimit', () => {
  it('reads a one-minute window as "per minute"', () => {
    expect(describeRateLimit({ maxRequests: 10, windowMs: 60 * 1000 })).toBe('10 requests per minute');
    expect(describeRateLimit({ maxRequests: 100, windowMs: 60 * 1000 })).toBe('100 requests per minute');
  });

  it('reads a one-hour window as "per hour"', () => {
    expect(describeRateLimit({ maxRequests: 3, windowMs: 60 * 60 * 1000 })).toBe('3 requests per hour');
  });

  it('pluralizes multi-unit windows', () => {
    expect(describeRateLimit({ maxRequests: 5, windowMs: 5 * 60 * 1000 })).toBe('5 requests per 5 minutes');
    expect(describeRateLimit({ maxRequests: 2, windowMs: 2 * 60 * 60 * 1000 })).toBe('2 requests per 2 hours');
  });

  it('falls back to seconds for sub-minute windows', () => {
    expect(describeRateLimit({ maxRequests: 5, windowMs: 30 * 1000 })).toBe('5 requests per 30 seconds');
  });

  it('renders a placeholder when the limits are unavailable', () => {
    expect(describeRateLimit(null)).toBe('—');
    expect(describeRateLimit(undefined)).toBe('—');
  });
});
