/**
 * Delivery-mode recommendation — team signal → DIY/DFY lane.
 *
 * The fork is a capacity question: does the prospect have anyone to execute
 * with? `team_signal` is the worksheet field the walk-in/call settles, so it
 * is the input. Advisory only — the operator still sets the mode.
 */
import { describe, it, expect } from 'vitest';
import { recommendDeliveryMode, reviewDeliveryBrief } from '../delivery-mode';

describe('recommendDeliveryMode', () => {
  it('recommends DFY strongly for a sole owner — nobody to execute with', () => {
    const rec = recommendDeliveryMode('sole_owner');

    expect(rec).toMatchObject({ mode: 'dfy', strength: 'strong' });
    expect(rec?.reason).toMatch(/no one to execute/i);
  });

  it('leans DIY when the prospect has a team', () => {
    expect(recommendDeliveryMode('family_team')).toMatchObject({ mode: 'diy', strength: 'lean' });
    expect(recommendDeliveryMode('small_staff')).toMatchObject({ mode: 'diy', strength: 'lean' });
  });

  it('keeps DFY available in the lean cases', () => {
    // 'lean' means both lanes are viable and the team is only the lean — the
    // reason must say so, or the operator reads it as a verdict.
    expect(recommendDeliveryMode('family_team')?.reason).toMatch(/DFY stays available/i);
    expect(recommendDeliveryMode('small_staff')?.reason).toMatch(/DFY stays available/i);
  });

  it('suggests nothing when the team signal is unknown or absent', () => {
    expect(recommendDeliveryMode('unknown')).toBeNull();
    expect(recommendDeliveryMode(null)).toBeNull();
    expect(recommendDeliveryMode(undefined)).toBeNull();
    expect(recommendDeliveryMode('')).toBeNull();
  });

  it('never invents a lane for an unrecognised signal', () => {
    expect(recommendDeliveryMode('large_department')).toBeNull();
  });
});

describe('reviewDeliveryBrief', () => {
  it('names who posts the response on each lane', () => {
    // The review lane's division of labour: DIY = the platform drafts, the
    // OWNER posts. DFY = the platform posts on delegated access.
    expect(reviewDeliveryBrief('diy')).toMatch(/OWNER posts them/i);
    expect(reviewDeliveryBrief('dfy')).toMatch(/posts the responses on the OWNER'S behalf/i);
  });

  it('says nothing when the lane is unsettled', () => {
    expect(reviewDeliveryBrief(null)).toBe('');
    expect(reviewDeliveryBrief(undefined)).toBe('');
    expect(reviewDeliveryBrief('')).toBe('');
    expect(reviewDeliveryBrief('unknown')).toBe('');
  });
});
