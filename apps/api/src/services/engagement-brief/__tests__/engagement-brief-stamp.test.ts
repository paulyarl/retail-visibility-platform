/**
 * Engagement brief stamp — the import hook that makes the brief's
 * provenance fields code-authoritative (spec: "prompt emits inputs, code
 * stamps"; "The brief must be stored to be a spine").
 *
 * Pinned behavior:
 *   - source_audit_id cites the campaign's latest business_analysis row
 *   - side is recomputed from the source audit — a model-emitted side is
 *     overwritten, never trusted
 *   - brief_version is stamped
 *   - no source audit → emerging + null source_audit_id; a model- or
 *     operator-emitted id is unverifiable in that case and is dropped,
 *     never preserved (the spine must not cite foreign evidence)
 */

import { describe, it, expect, vi } from 'vitest';
import {
  applyEngagementBriefStamp,
  assertEngagementBriefSourceAudit,
  buildEngagementBriefVariables,
  ENGAGEMENT_BRIEF_VERSION,
} from '../engagement-brief-stamp';
import { FOOTPRINT_SIDE_CLASSIFIER_VERSION } from '../footprint-side';

function prismaWithAudit(audit: { id: string; audit_data: any } | null) {
  return {
    mkt_audits_list: {
      findFirst: vi.fn().mockResolvedValue(audit),
      findMany: vi
        .fn()
        .mockResolvedValue(audit ? [{ platform: 'business_analysis', ...audit }] : []),
    },
  };
}

// yesterday — always inside the 90-day recency window at test runtime.
const RECENT_ACTIVITY = new Date(Date.now() - 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);

const SOURCE_AUDIT = {
  id: 'aud_source_1',
  audit_data: {
    website: { url: 'https://dreamcastmarket.com', status: 'broken' },
    channels_scanned: [
      {
        channel: 'instagram',
        rendered: true,
        last_activity: RECENT_ACTIVITY,
        notable_activity: ['9,320 followers'],
      },
    ],
    combined_review_metrics: { observable_unanswered_reviews: 0 },
  },
};

describe('applyEngagementBriefStamp', () => {
  it('stamps source_audit_id, side, and brief_version over the model payload', async () => {
    const prisma = prismaWithAudit(SOURCE_AUDIT);
    const out = await applyEngagementBriefStamp(
      {
        business: { name: 'Dreamcast' },
        pains: [{ ref_id: 'p1' }],
        // a forged side — must be overwritten
        side: { value: 'competitive', density_score: 99, inputs_used: ['forged'], classifier_version: 0 },
      },
      { prisma, campaignId: 'camp_1' },
    );

    expect(prisma.mkt_audits_list.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaign_id: 'camp_1', platform: 'business_analysis' },
      }),
    );
    expect(out.source_audit_id).toBe('aud_source_1');
    expect(out.brief_version).toBe(ENGAGEMENT_BRIEF_VERSION);
    expect(out.side.classifier_version).toBe(FOOTPRINT_SIDE_CLASSIFIER_VERSION);
    // 1 rendered channel (2) + recent (1) + notable (1) = 4 → emerging
    expect(out.side.value).toBe('emerging');
    expect(out.side.density_score).toBe(4);
    expect(out.side.inputs_used).toContain('channels_scanned[instagram].rendered');
    // density_breakdown rides the persisted stamp (F3) — reproducible score.
    expect(out.side.density_breakdown.rendered_channels).toEqual({ observed: 1, awarded: 2, cap: 6 });
    expect(out.side.density_breakdown.recent_channel_activity.awarded).toBe(1);
    // model payload otherwise untouched
    expect(out.business.name).toBe('Dreamcast');
    expect(out.pains).toEqual([{ ref_id: 'p1' }]);
  });

  it('no source audit → emerging, null source_audit_id', async () => {
    const prisma = prismaWithAudit(null);
    const out = await applyEngagementBriefStamp(
      { business: { name: 'X' } },
      { prisma, campaignId: 'camp_2' },
    );
    expect(out.side.value).toBe('emerging');
    expect(out.side.density_score).toBe(0);
    expect(out.source_audit_id).toBeNull();
  });

  it('drops a hand-assembled source_audit_id when no audit row exists', async () => {
    // Unverifiable by construction: if the id named a business_analysis row
    // on this campaign, the latest-audit lookup would have found it.
    const prisma = prismaWithAudit(null);
    const out = await applyEngagementBriefStamp(
      { source_audit_id: 'aud_manual_9' },
      { prisma, campaignId: 'camp_3' },
    );
    expect(out.source_audit_id).toBeNull();
  });

  it('ignores a model-emitted id naming a foreign audit — the campaign row wins', async () => {
    const prisma = prismaWithAudit(SOURCE_AUDIT);
    const out = await applyEngagementBriefStamp(
      { source_audit_id: 'aud_other_campaign' },
      { prisma, campaignId: 'camp_1' },
    );
    expect(out.source_audit_id).toBe('aud_source_1');
  });
});

describe('assertEngagementBriefSourceAudit', () => {
  it('passes when the campaign already carries a real business_analysis audit', async () => {
    const campaign = {
      id: 'camp_1',
      audits: [{ platform: 'business_analysis', audit_data: { summary: 'x' } }],
    };
    await expect(assertEngagementBriefSourceAudit(campaign, prismaWithAudit(null))).resolves.toBeUndefined();
  });

  it('falls back to the audit table when the campaign object has no audit list', async () => {
    const prisma = prismaWithAudit({ id: 'aud_1', audit_data: { summary: 'x' } });
    await expect(
      assertEngagementBriefSourceAudit({ id: 'camp_2' }, prisma),
    ).resolves.toBeUndefined();
  });

  it('refuses when no business_analysis audit exists — the audit-first fallback', async () => {
    const prisma = prismaWithAudit(null);
    await expect(
      assertEngagementBriefSourceAudit({ id: 'camp_3', audits: [] }, prisma),
    ).rejects.toThrow(/Business Audit/i);
  });

  it('refuses when the only business_analysis rows are stubs', async () => {
    const stub = {
      platform: 'business_analysis',
      audit_data: { audit_metadata: { source: 'queue_promotion' } },
    };
    const prisma = {
      mkt_audits_list: { findMany: vi.fn().mockResolvedValue([stub]) },
    };
    await expect(
      assertEngagementBriefSourceAudit({ id: 'camp_4' }, prisma),
    ).rejects.toThrow(/Business Audit/i);
  });
});

describe('buildEngagementBriefVariables', () => {
  it('injects the audit JSON, id, and computed side for the render', () => {
    const vars = buildEngagementBriefVariables(SOURCE_AUDIT);
    expect(vars.source_audit_id).toBe('aud_source_1');
    expect(JSON.parse(vars.source_audit).channels_scanned).toHaveLength(1);
    const side = JSON.parse(vars.footprint_side);
    expect(side.value).toBe('emerging');
    expect(side.density_score).toBe(4);
    expect(side.classifier_version).toBe(FOOTPRINT_SIDE_CLASSIFIER_VERSION);
  });

  it('emits the empty-evidence shape when no audit exists', () => {
    const vars = buildEngagementBriefVariables(null);
    expect(vars.source_audit).toContain('no business_analysis audit');
    expect(vars.source_audit_id).toBe('');
    expect(JSON.parse(vars.footprint_side).value).toBe('emerging');
  });
});
