import { describe, it, expect } from 'vitest';
import { isTrialStatus, getTrialEndLabel } from './trial';

describe('isTrialStatus', () => {
  it('returns true only for status "trial"', () => {
    expect(isTrialStatus('trial')).toBe(true);
    expect(isTrialStatus('active')).toBe(false);
    expect(isTrialStatus('past_due')).toBe(false);
    expect(isTrialStatus('canceled')).toBe(false);
    expect(isTrialStatus('expired')).toBe(false);
    expect(isTrialStatus('')).toBe(false);
    expect(isTrialStatus(null)).toBe(false);
    expect(isTrialStatus(undefined)).toBe(false);
  });
});

describe('getTrialEndLabel', () => {
  it('returns null for missing or null input', () => {
    expect(getTrialEndLabel()).toBeNull();
    expect(getTrialEndLabel(null)).toBeNull();
  });

  it('returns null for invalid dates', () => {
    expect(getTrialEndLabel('not-a-date')).toBeNull();
  });

  it('formats a valid ISO date string', () => {
    const label = getTrialEndLabel('2025-01-15T00:00:00.000Z');
    expect(label).not.toBeNull();
    // We only assert that it produces a non-empty string; locale specifics may vary
    expect(label).toMatch(/2025/);
  });

  it('accepts Date instances directly', () => {
    const date = new Date('2025-01-15T00:00:00.000Z');
    const label = getTrialEndLabel(date);
    expect(label).not.toBeNull();
    expect(label).toMatch(/2025/);
  });
});
