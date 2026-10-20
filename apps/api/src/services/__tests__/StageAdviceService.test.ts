/**
 * StageAdviceService tests — the pure stage-readiness derivation.
 *
 * The advice is a view, not a gate (spec §8), but it must agree with the
 * transition route: the same archetype hard gate, the same checklist soft
 * gate, and the same gallery-stage window.
 */

import { describe, it, expect } from 'vitest';
import { deriveStageAdvice, type StageAdviceFacts } from '../StageAdviceService';

const facts = (overrides: Partial<StageAdviceFacts> = {}): StageAdviceFacts => ({
  campaignId: 'camp-1',
  stage: 'seek',
  scope: 'business',
  categoryIdentified: true,
  hasBusinessAnalysisAudit: true,
  hasAcceptedTriage: false,
  archetypeResolved: true,
  hasContact: true,
  operationalVerified: false,
  seedStatus: null,
  announceDelivered: false,
  act1Cleared: false,
  act1Missing: [],
  act2Done: false,
  act3Cleared: false,
  galleryEligible: false,
  galleryReason: null,
  galleryAction: null,
  galleryTokenLive: false,
  checklistIncomplete: [],
  ...overrides,
});

describe('deriveStageAdvice — seek → seed', () => {
  it('is ready once the audit and category exist', () => {
    const advice = deriveStageAdvice(facts());
    expect(advice.nextStage).toBe('seed');
    expect(advice.readiness).toBe('ready');
    expect(advice.blockers).toHaveLength(0);
    expect(advice.tip).toContain('do not park the seed in draft');
  });

  it('blocks on a missing audit or category, without a hard gate', () => {
    const advice = deriveStageAdvice(facts({ categoryIdentified: false, hasBusinessAnalysisAudit: false }));
    expect(advice.readiness).toBe('blocked');
    expect(advice.blockers.map((b) => b.code)).toEqual(['category_identification', 'business_analysis']);
    expect(advice.blockers.every((b) => !b.hard)).toBe(true);
  });

  it('downgrades to ready_with_ack when the checklist soft gate is open', () => {
    const advice = deriveStageAdvice(
      facts({ checklistIncomplete: [{ id: 'step-1', title: 'Run category identification' }] }),
    );
    expect(advice.readiness).toBe('ready_with_ack');
    expect(advice.acknowledgeRequired).toBe(true);
    expect(advice.blockers[0].code).toBe('checklist_incomplete');
  });

  it('treats contact / operational / triage as advisory, never blocking', () => {
    const advice = deriveStageAdvice(
      facts({ hasContact: false, operationalVerified: false, hasAcceptedTriage: false }),
    );
    expect(advice.readiness).toBe('ready');
    expect(advice.checks.filter((c) => !c.met).every((c) => c.advisory)).toBe(true);
  });
});

describe('deriveStageAdvice — seed → preview_built', () => {
  const seeded = facts({
    stage: 'seed',
    seedStatus: 'published',
    act1Cleared: true,
    announceDelivered: true,
  });

  it('is ready when the seed is published, act 1 cleared, and an archetype resolves', () => {
    const advice = deriveStageAdvice(seeded);
    expect(advice.nextStage).toBe('preview_built');
    expect(advice.readiness).toBe('ready');
    expect(advice.tip).toContain('before the postcard ships');
  });

  it('hard-blocks on an unresolvable archetype — the one edge with no back-edge', () => {
    const advice = deriveStageAdvice({ ...seeded, archetypeResolved: false });
    expect(advice.readiness).toBe('blocked');
    const blocker = advice.blockers.find((b) => b.code === 'business_analysis_required');
    expect(blocker?.hard).toBe(true);
  });

  it('blocks on an unpublished seed and an uncleared act 1', () => {
    const advice = deriveStageAdvice({
      ...seeded,
      seedStatus: 'draft',
      act1Cleared: false,
      act1Missing: ['contact channel (C4)'],
    });
    expect(advice.readiness).toBe('blocked');
    expect(advice.blockers.map((b) => b.code)).toEqual(['seed_not_published', 'act1_gate']);
    expect(advice.blockers[1].message).toContain('contact channel (C4)');
  });

  it('does not block on a missing announce — C2 is advisory', () => {
    const advice = deriveStageAdvice({ ...seeded, announceDelivered: false });
    expect(advice.readiness).toBe('ready');
    expect(advice.checks.find((c) => c.key === 'announce')?.advisory).toBe(true);
  });
});

describe('deriveStageAdvice — preview_built → shown', () => {
  const built = facts({
    stage: 'preview_built',
    act1Cleared: true,
    act2Done: true,
    galleryEligible: true,
    galleryTokenLive: true,
  });

  it('blocks when the act-2 artifact has not shipped — the mailer window closes at Shown', () => {
    const advice = deriveStageAdvice({ ...built, act2Done: false });
    expect(advice.readiness).toBe('blocked');
    expect(advice.blockers.map((b) => b.code)).toContain('act2_not_delivered');
    expect(advice.blockers[0].message).toContain('mailer is only available up to Preview Built');
  });

  it('blocks when the gallery is ineligible and surfaces the eligibility action', () => {
    const advice = deriveStageAdvice({
      ...built,
      galleryEligible: false,
      galleryReason: 'no_screenshots',
      galleryAction: 'Upload at least one diagnostic screenshot.',
    });
    expect(advice.readiness).toBe('blocked');
    expect(advice.blockers.find((b) => b.code === 'no_screenshots')?.message).toContain('screenshot');
  });

  it('blocks when no gallery link has been minted', () => {
    const advice = deriveStageAdvice({ ...built, galleryTokenLive: false });
    expect(advice.readiness).toBe('blocked');
    expect(advice.blockers.map((b) => b.code)).toContain('gallery_token_missing');
  });

  it('asks for acknowledgement when the gallery has not been viewed yet', () => {
    const advice = deriveStageAdvice(built);
    expect(advice.readiness).toBe('ready_with_ack');
    expect(advice.acknowledgeRequired).toBe(true);
    expect(advice.tip).toContain('walk-in gate keeps waiting for act 3');
  });

  it('is ready once the act-3 gate clears', () => {
    const advice = deriveStageAdvice({ ...built, act3Cleared: true });
    expect(advice.readiness).toBe('ready');
    expect(advice.tip).toContain('book the walk-in');
  });
});

describe('deriveStageAdvice — terminal states', () => {
  it('stops advising at shown', () => {
    const advice = deriveStageAdvice(facts({ stage: 'shown' }));
    expect(advice.readiness).toBe('terminal');
    expect(advice.nextStage).toBeNull();
    expect(advice.tip).toContain('act-4 visit');
  });

  it('stops advising past shown', () => {
    for (const stage of ['paid', 'delivered', 'lost', 'dead']) {
      expect(deriveStageAdvice(facts({ stage })).readiness).toBe('terminal');
    }
  });

  it('does not advise on aggregate scopes', () => {
    const advice = deriveStageAdvice(facts({ scope: 'category' }));
    expect(advice.readiness).toBe('terminal');
    expect(advice.nextStage).toBeNull();
    expect(advice.tip).toContain('business-scope');
  });
});
