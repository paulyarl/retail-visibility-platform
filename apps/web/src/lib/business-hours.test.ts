import { describe, it, expect } from 'vitest';
import { inferTimezoneFromState, parseGoogleHoursPaste, parseHoursLine, parseTimeTo24h } from './business-hours';

describe('parseTimeTo24h', () => {
  it('converts 12-hour times', () => {
    expect(parseTimeTo24h('9 AM')).toBe('09:00');
    expect(parseTimeTo24h('9:30 PM')).toBe('21:30');
    expect(parseTimeTo24h('12 AM')).toBe('00:00');
    expect(parseTimeTo24h('12 PM')).toBe('12:00');
  });
});

describe('parseHoursLine', () => {
  it('parses ranges with en-dash, em-dash, and hyphen', () => {
    expect(parseHoursLine('9 AM–10 PM')).toEqual({ open: '09:00', close: '22:00', closed: false });
    expect(parseHoursLine('9 AM—10 PM')).toEqual({ open: '09:00', close: '22:00', closed: false });
    expect(parseHoursLine('- 9 AM-10 PM')).toEqual({ open: '09:00', close: '22:00', closed: false });
  });

  it('handles Closed and Open 24 hours', () => {
    expect(parseHoursLine('Closed')).toEqual({ open: '09:00', close: '18:00', closed: true });
    expect(parseHoursLine('Open 24 hours')).toEqual({ open: '00:00', close: '23:59', closed: false });
  });
});

describe('parseGoogleHoursPaste', () => {
  it('parses the stacked GBP format regardless of starting day', () => {
    const parsed = parseGoogleHoursPaste(
      'Saturday\n- 9 AM–10 PM\n\nSunday\n- 9 AM–10 PM\n\nMonday\n- 9 AM–10 PM',
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.saturday).toEqual({ open: '09:00', close: '22:00', closed: false });
    expect(parsed!.sunday).toEqual({ open: '09:00', close: '22:00', closed: false });
    expect(parsed!.monday).toEqual({ open: '09:00', close: '22:00', closed: false });
  });

  it('parses tab-separated day + hours on the same line', () => {
    const parsed = parseGoogleHoursPaste(
      'Saturday\t9 AM–10 PM\nSunday\t9 AM–10 PM\nMonday\t9 AM–10 PM\nTuesday\t9 AM–10 PM\nWednesday\t9 AM–10 PM\nThursday\t9 AM–10 PM\nFriday\t9 AM–10 PM',
    );
    expect(parsed).not.toBeNull();
    for (const day of ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
      expect(parsed![day]).toEqual({ open: '09:00', close: '22:00', closed: false });
    }
  });

  it('parses colon- and space-separated same-line formats', () => {
    const parsed = parseGoogleHoursPaste('Monday: 8 AM–6 PM\nTuesday 8 AM–6 PM\nWednesday Closed');
    expect(parsed).not.toBeNull();
    expect(parsed!.monday).toEqual({ open: '08:00', close: '18:00', closed: false });
    expect(parsed!.tuesday).toEqual({ open: '08:00', close: '18:00', closed: false });
    expect(parsed!.wednesday!.closed).toBe(true);
  });

  it('expands day ranges like "Mon–Fri 9 AM–5 PM"', () => {
    const parsed = parseGoogleHoursPaste('Mon–Fri 9 AM–5 PM\nSat 10 AM–2 PM\nSun Closed');
    expect(parsed).not.toBeNull();
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
      expect(parsed![day]).toEqual({ open: '09:00', close: '17:00', closed: false });
    }
    expect(parsed!.saturday).toEqual({ open: '10:00', close: '14:00', closed: false });
    expect(parsed!.sunday!.closed).toBe(true);
  });

  it('does not leak a following same-line day into the previous day', () => {
    const parsed = parseGoogleHoursPaste('Saturday\nSunday\t9 AM–10 PM');
    expect(parsed).not.toBeNull();
    expect(parsed!.saturday!.closed).toBe(true);
    expect(parsed!.sunday).toEqual({ open: '09:00', close: '22:00', closed: false });
  });

  it('returns null when no day can be parsed', () => {
    expect(parseGoogleHoursPaste('')).toBeNull();
    expect(parseGoogleHoursPaste('Call for hours')).toBeNull();
  });
});

describe('inferTimezoneFromState', () => {
  it('maps abbreviations and full names, any case', () => {
    expect(inferTimezoneFromState('CA')).toBe('America/Los_Angeles');
    expect(inferTimezoneFromState('texas')).toBe('America/Chicago');
    expect(inferTimezoneFromState('New York')).toBe('America/New_York');
    expect(inferTimezoneFromState('AZ')).toBe('America/Phoenix');
    expect(inferTimezoneFromState('HI')).toBe('Pacific/Honolulu');
  });

  it('returns null for blank or non-US values', () => {
    expect(inferTimezoneFromState('')).toBeNull();
    expect(inferTimezoneFromState(null)).toBeNull();
    expect(inferTimezoneFromState(undefined)).toBeNull();
    expect(inferTimezoneFromState('ON')).toBeNull();
  });
});
