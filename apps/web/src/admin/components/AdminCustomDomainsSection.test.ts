import { describe, it, expect } from 'vitest';
import { statusChipCount } from './AdminCustomDomainsSection';

// The Custom Domains filter chips carried no counts, so support couldn't see how
// much was pending or errored without clicking each filter. Counts come from the
// list endpoint's unfiltered-by-status groupBy.
describe('statusChipCount', () => {
  const counts = { active: 1, pending_verification: 3, error: 2, disabled: 0 };

  it('sums every status for the All chip', () => {
    expect(statusChipCount('', counts)).toBe(6);
  });

  it('reads the count for a specific status', () => {
    expect(statusChipCount('pending_verification', counts)).toBe(3);
    expect(statusChipCount('error', counts)).toBe(2);
  });

  it('reports a real zero rather than hiding it', () => {
    // "0 disabled" is good news and worth showing.
    expect(statusChipCount('disabled', counts)).toBe(0);
  });

  it('returns undefined for a status the server did not report', () => {
    expect(statusChipCount('verified', counts)).toBeUndefined();
  });

  it('shows nothing until the first response lands', () => {
    expect(statusChipCount('', null)).toBeUndefined();
    expect(statusChipCount('active', null)).toBeUndefined();
    expect(statusChipCount('active', undefined)).toBeUndefined();
  });
});
