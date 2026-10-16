/**
 * Sibling-lane availability — the playbook pool a triage recommendation may
 * draw from.
 *
 * The regression this pins: a sibling campaign's triage recommended the
 * prospect's RANK-WINNER playbook (PB-05), which the primary already held. The
 * sibling-uniqueness guard refuses a second campaign on the same playbook, so
 * "Accept Recommendation" was a guaranteed 409, the Override dropdown offered
 * taken playbooks, and the alternatives panel offered "Create Sibling" for a
 * playbook that already had one. All three affordances consulted the signal
 * ranking and none consulted the invariant.
 */
import { describe, it, expect } from 'vitest';
import { filterAvailablePlaybooks } from '../../CampaignTriageService';

const P = (code: string) => ({ code });

describe('filterAvailablePlaybooks', () => {
  it('drops playbooks another campaign in the prospect holds', () => {
    const pool = [P('PB-04'), P('PB-05'), P('PB-09'), P('PB-01'), P('PB-08')];
    const used = new Set(['PB-05', 'PB-09', 'PB-01']);

    expect(filterAvailablePlaybooks(pool, used).map((p) => p.code)).toEqual([
      'PB-04',
      'PB-08',
    ]);
  });

  it('leaves the pool untouched when nothing is taken elsewhere', () => {
    // The primary's case: it is the only campaign, or its own playbook is the
    // only one in play — so its ranking is unchanged.
    const pool = [P('PB-05'), P('PB-09')];
    expect(filterAvailablePlaybooks(pool, new Set()).map((p) => p.code)).toEqual([
      'PB-05',
      'PB-09',
    ]);
  });

  it('keeps the unfiltered pool when every match is taken', () => {
    // Degenerate case — render a verdict and let the operator see the
    // conflict, rather than an empty card.
    const pool = [P('PB-05'), P('PB-09')];
    const used = new Set(['PB-05', 'PB-09']);
    expect(filterAvailablePlaybooks(pool, used).map((p) => p.code)).toEqual([
      'PB-05',
      'PB-09',
    ]);
  });

  it('preserves ranking order among the survivors', () => {
    // The filter must not re-rank: the winner is still the best AVAILABLE
    // match, not an arbitrary survivor.
    const pool = [P('PB-04'), P('PB-05'), P('PB-09'), P('PB-01')];
    const used = new Set(['PB-05', 'PB-04']);
    expect(filterAvailablePlaybooks(pool, used).map((p) => p.code)).toEqual([
      'PB-09',
      'PB-01',
    ]);
  });

  it('is not confused by a playbook code it does not hold', () => {
    const pool = [P('PB-05'), P('PB-08')];
    const used = new Set(['PG-01']);
    expect(filterAvailablePlaybooks(pool, used).map((p) => p.code)).toEqual([
      'PB-05',
      'PB-08',
    ]);
  });
});
