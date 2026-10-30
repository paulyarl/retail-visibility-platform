/**
 * Autopilot due-stamp scheduling tests (Sprint D3, spec §4.3).
 *
 * computeAutopilotDue = detected + jitter(2–72h), clamped forward into the
 * tenant's business_hours_list window. Pure — no mocks.
 */
import { describe, it, expect } from 'vitest';
import { clampToBusinessHours, computeAutopilotDue } from '../lib/google/gbp-autopilot-schedule';

const WEEKDAY_9_5 = [
  { day: 'MONDAY', open: '09:00', close: '17:00' },
  { day: 'TUESDAY', open: '09:00', close: '17:00' },
  { day: 'WEDNESDAY', open: '09:00', close: '17:00' },
  { day: 'THURSDAY', open: '09:00', close: '17:00' },
  { day: 'FRIDAY', open: '09:00', close: '17:00' },
];

describe('computeAutopilotDue', () => {
  it('lands 2–72h after detection with no business-hours data', () => {
    const detected = new Date('2026-10-30T12:00:00Z');
    const due = computeAutopilotDue(detected, null);
    const delta = due.getTime() - detected.getTime();
    expect(delta).toBeGreaterThanOrEqual(2 * 3600e3);
    expect(delta).toBeLessThanOrEqual(72 * 3600e3);
  });
});

describe('clampToBusinessHours', () => {
  it('keeps a time already inside an open window', () => {
    const due = new Date(2026, 9, 30, 13, 0); // Friday 13:00 — inside
    const clamped = clampToBusinessHours(due, WEEKDAY_9_5);
    expect(clamped.getTime()).toBe(due.getTime());
  });

  it('pushes pre-open times to that day\'s open', () => {
    const due = new Date(2026, 9, 30, 6, 30); // Friday 06:30 — before open
    const clamped = clampToBusinessHours(due, WEEKDAY_9_5);
    expect(clamped.getDay()).toBe(5); // still Friday
    expect(clamped.getHours()).toBe(9);
    expect(clamped.getMinutes()).toBe(0);
  });

  it('rolls past-close times to the next open day', () => {
    const due = new Date(2026, 9, 30, 20, 0); // Friday 20:00 — closed, weekend ahead
    const clamped = clampToBusinessHours(due, WEEKDAY_9_5);
    expect(clamped.getDay()).toBe(1); // Monday
    expect(clamped.getHours()).toBe(9);
  });

  it('returns the input unchanged when no window exists within 8 days', () => {
    const due = new Date(2026, 9, 30, 12, 0);
    const clamped = clampToBusinessHours(due, []);
    expect(clamped.getTime()).toBe(due.getTime());
  });
});
