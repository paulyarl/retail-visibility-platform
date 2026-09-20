import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../prisma', () => ({ prisma: {} }));
vi.mock('../../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { evaluateTriggerGuard } from '../IntakeDefinitionService';

// Profile Repair Fulfillment Sprint (W3) — declarative trigger_guard AND
// semantics. The profile_repair_access definition carries a guard like
//   [{ path: 'repair_fulfillment.mode', op: 'equals', value: 'dfy' },
//    { path: 'campaign_category', op: 'equals', value: 'profile_repair' }]
// so the intake only auto-mints on DFY Track A campaigns.

describe('evaluateTriggerGuard', () => {
  const dfyCampaign = {
    campaign_category: 'profile_repair',
    repair_fulfillment: { mode: 'dfy', tier: 'standard' },
  };

  it('passes when guard is absent or empty', () => {
    expect(evaluateTriggerGuard(null, dfyCampaign)).toBe(true);
    expect(evaluateTriggerGuard(undefined, dfyCampaign)).toBe(true);
    expect(evaluateTriggerGuard([], dfyCampaign)).toBe(true);
  });

  it('fails when guard exists but campaign is null', () => {
    expect(
      evaluateTriggerGuard([{ path: 'campaign_category', op: 'equals', value: 'profile_repair' }], null),
    ).toBe(false);
  });

  it('equals: matches nested JSONB paths', () => {
    const guard = [{ path: 'repair_fulfillment.mode', op: 'equals' as const, value: 'dfy' }];
    expect(evaluateTriggerGuard(guard, dfyCampaign)).toBe(true);
    expect(evaluateTriggerGuard(guard, { repair_fulfillment: { mode: 'diy' } })).toBe(false);
  });

  it('equals: missing path fails (closed)', () => {
    const guard = [{ path: 'repair_fulfillment.mode', op: 'equals' as const, value: 'dfy' }];
    expect(evaluateTriggerGuard(guard, {})).toBe(false);
    expect(evaluateTriggerGuard(guard, { repair_fulfillment: null })).toBe(false);
  });

  it('not_equals: missing path passes', () => {
    const guard = [{ path: 'repair_fulfillment.mode', op: 'not_equals' as const, value: 'dfy' }];
    expect(evaluateTriggerGuard(guard, {})).toBe(true);
    expect(evaluateTriggerGuard(guard, dfyCampaign)).toBe(false);
    expect(evaluateTriggerGuard(guard, { repair_fulfillment: { mode: 'diy' } })).toBe(true);
  });

  it('in: requires the path value to be a member', () => {
    const guard = [{ path: 'stage', op: 'in' as const, value: ['paid', 'delivered'] }];
    expect(evaluateTriggerGuard(guard, { stage: 'paid' })).toBe(true);
    expect(evaluateTriggerGuard(guard, { stage: 'delivered' })).toBe(true);
    expect(evaluateTriggerGuard(guard, { stage: 'seed' })).toBe(false);
    expect(evaluateTriggerGuard(guard, {})).toBe(false);
  });

  it('exists: passes only when the path resolves to a non-null value', () => {
    const guard = [{ path: 'repair_fulfillment', op: 'exists' as const }];
    expect(evaluateTriggerGuard(guard, dfyCampaign)).toBe(true);
    expect(evaluateTriggerGuard(guard, { repair_fulfillment: null })).toBe(false);
    expect(evaluateTriggerGuard(guard, {})).toBe(false);
  });

  it('ANDs multiple conditions — all must pass', () => {
    const guard = [
      { path: 'campaign_category', op: 'equals' as const, value: 'profile_repair' },
      { path: 'repair_fulfillment.mode', op: 'equals' as const, value: 'dfy' },
    ];
    expect(evaluateTriggerGuard(guard, dfyCampaign)).toBe(true);
    // right category, wrong mode
    expect(evaluateTriggerGuard(guard, { campaign_category: 'profile_repair', repair_fulfillment: { mode: 'diy' } })).toBe(false);
    // right mode, wrong category
    expect(evaluateTriggerGuard(guard, { campaign_category: 'review_management', repair_fulfillment: { mode: 'dfy' } })).toBe(false);
  });

  it('fails closed on an unknown op (typo must not auto-mint intakes)', () => {
    const guard = [{ path: 'stage', op: 'eq' as any, value: 'paid' }];
    expect(evaluateTriggerGuard(guard, { stage: 'paid' })).toBe(false);
  });

  it('ignores malformed conditions (missing path passes that condition)', () => {
    const guard = [
      { path: '', op: 'equals' as const, value: 'x' },
      { path: 'stage', op: 'equals' as const, value: 'paid' },
    ];
    expect(evaluateTriggerGuard(guard, { stage: 'paid' })).toBe(true);
  });
});
