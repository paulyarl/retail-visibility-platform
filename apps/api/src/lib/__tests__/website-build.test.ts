import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  DELIVERY_MODE_LOCKED_STAGES,
  deliveryModeLockReasons,
  isBuildDeliveryMode,
  modesForScope,
} from '../website-build';

// PB-08 delivery-mode lock — the analog of the repair package's
// mode_locked rule (RepairFulfillmentService): once execution artifacts
// exist a chosen dfy/diy lane may not flip. deliveryModeLockReasons is the
// shared predicate used by both updateDeliveryMode and
// confirmWebsiteBuildScope.

function stubPrisma({ previewRows = [] as any[], intake = null as any } = {}) {
  return {
    $queryRaw: vi.fn().mockResolvedValue(previewRows),
    mkt_dispute_intake: { findFirst: vi.fn().mockResolvedValue(intake) },
  } as any;
}

describe('deliveryModeLockReasons', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns no reasons for a pre-execution campaign', async () => {
    const reasons = await deliveryModeLockReasons(stubPrisma(), { id: 'mcamp-1', stage: 'seek' });
    expect(reasons).toEqual([]);
  });

  it('locks on post-execution stages', async () => {
    for (const stage of ['preview_built', 'shown', 'paid', 'delivered', 'retainer_pitched', 'retainer_won', 'tenant_onboarded', 'resolved_and_closed']) {
      const reasons = await deliveryModeLockReasons(stubPrisma(), { id: 'mcamp-1', stage });
      expect(reasons).toEqual([`campaign is at '${stage}'`]);
    }
  });

  it('does not lock on pre-execution or terminal stages', async () => {
    for (const stage of ['seek', 'seed', 'lost', 'dead']) {
      const reasons = await deliveryModeLockReasons(stubPrisma(), { id: 'mcamp-1', stage });
      expect(reasons).toEqual([]);
    }
  });

  it('locks when a live seed-preview storefront exists', async () => {
    const prisma = stubPrisma({ previewRows: [{ id: 'tid-1' }] });
    const reasons = await deliveryModeLockReasons(prisma, { id: 'mcamp-1', stage: 'seek' });
    expect(reasons).toEqual(['a live preview storefront exists']);
  });

  it('locks when the owner build intake was submitted', async () => {
    const prisma = stubPrisma({ intake: { id: 'mint-1' } });
    const reasons = await deliveryModeLockReasons(prisma, { id: 'mcamp-1', stage: 'seek' });
    expect(reasons).toEqual(['the owner build intake was submitted']);
    expect(prisma.mkt_dispute_intake.findFirst).toHaveBeenCalledWith({
      where: {
        campaign_id: 'mcamp-1',
        intake_kind: 'website_build',
        submitted_at: { not: null },
      },
      select: { id: true },
    });
  });

  it('accumulates independent reasons', async () => {
    const prisma = stubPrisma({ previewRows: [{ id: 'tid-1' }], intake: { id: 'mint-1' } });
    const reasons = await deliveryModeLockReasons(prisma, { id: 'mcamp-1', stage: 'paid' });
    expect(reasons).toEqual([
      "campaign is at 'paid'",
      'a live preview storefront exists',
      'the owner build intake was submitted',
    ]);
  });
});

describe('DELIVERY_MODE_LOCKED_STAGES', () => {
  it('contains only real campaign stages (routes/marketing-ops.ts enum)', () => {
    const valid = new Set([
      'seek', 'seed', 'preview_built', 'shown', 'paid', 'delivered',
      'retainer_pitched', 'retainer_won', 'lost', 'dead', 'tenant_onboarded',
      'audit_identified', 'framework_preview_generated', 'outreach_dispatched',
      'awaiting_owner_intake', 'intake_submitted', 'final_resolution_drafted',
      'owner_approved', 'resolved_and_closed',
    ]);
    for (const stage of DELIVERY_MODE_LOCKED_STAGES) {
      expect(valid.has(stage)).toBe(true);
    }
  });
});

describe('mode vocabulary (unchanged)', () => {
  it('still narrows dfy/diy and derives scope modes', () => {
    expect(isBuildDeliveryMode('dfy')).toBe(true);
    expect(isBuildDeliveryMode('diy')).toBe(true);
    expect(isBuildDeliveryMode('other')).toBe(false);
    expect(modesForScope('new_build')).toEqual(['dfy', 'diy']);
    expect(modesForScope('bogus')).toEqual([]);
  });
});
