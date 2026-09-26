/**
 * auditPublicNarrative resolver tests — self+parent cat-id audit lineage.
 *
 * The cat-id audit lives on the *scan* campaign; seeded business campaigns
 * reach it through parent_campaign_id (stamped by both derive lanes). The
 * resolver's prisma is injected, so a plain stub exercises the lineage logic
 * without module mocks.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  resolveCatIdAudit,
  resolveCatIdPublicNarrative,
  resolveAuditPublicNarrative,
} from '../auditPublicNarrative';

function stubPrisma(opts: {
  audits?: any[];
  campaigns?: Record<string, any>;
}) {
  const audits = opts.audits ?? [];
  const campaigns = opts.campaigns ?? {};
  return {
    mkt_audits_list: {
      findFirst: vi.fn(async (args: any) => {
        const ids: string[] = args?.where?.campaign_id?.in ?? [];
        const platform = args?.where?.platform;
        const matches = audits
          .filter((a) => ids.includes(a.campaign_id) && a.platform === platform)
          .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        return matches[0] ?? null;
      }),
    },
    mkt_campaigns_list: {
      findUnique: vi.fn(async (args: any) => campaigns[args?.where?.id] ?? null),
    },
  };
}

describe('resolveCatIdAudit', () => {
  it('resolves the cat-id audit on the campaign itself', async () => {
    const prisma = stubPrisma({
      audits: [
        {
          id: 'maud-cat-1',
          campaign_id: 'camp-1',
          platform: 'category_identification',
          created_at: '2026-09-01',
          audit_data: { public_narrative: 'Shelf copy.' },
        },
      ],
    });

    const audit = await resolveCatIdAudit(prisma, 'camp-1', null);

    expect(audit?.id).toBe('maud-cat-1');
    expect((audit?.auditData as any).public_narrative).toBe('Shelf copy.');
    expect(prisma.mkt_audits_list.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          campaign_id: { in: ['camp-1'] },
          platform: 'category_identification',
        }),
      }),
    );
  });

  it('reaches the cat-id audit on the parent campaign (queue/spawn lanes)', async () => {
    const prisma = stubPrisma({
      audits: [
        {
          id: 'maud-cat-parent',
          campaign_id: 'camp-parent',
          platform: 'category_identification',
          created_at: '2026-09-01',
          audit_data: { public_narrative: 'Parent shelf copy.' },
        },
      ],
    });

    const audit = await resolveCatIdAudit(prisma, 'camp-child', 'camp-parent');

    expect(audit?.id).toBe('maud-cat-parent');
    // Both ids are queried — the latest across the pair wins.
    const call = prisma.mkt_audits_list.findFirst.mock.calls[0][0];
    expect(call.where.campaign_id.in).toEqual(['camp-child', 'camp-parent']);
  });

  it('loads parent_campaign_id from the campaign row when not provided', async () => {
    const prisma = stubPrisma({
      campaigns: { 'camp-child': { parent_campaign_id: 'camp-parent' } },
      audits: [
        {
          id: 'maud-cat-parent',
          campaign_id: 'camp-parent',
          platform: 'category_identification',
          created_at: '2026-09-01',
          audit_data: {},
        },
      ],
    });

    const audit = await resolveCatIdAudit(prisma, 'camp-child');

    expect(prisma.mkt_campaigns_list.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'camp-child' } }),
    );
    expect(audit?.id).toBe('maud-cat-parent');
  });

  it('does not match business_analysis audits', async () => {
    const prisma = stubPrisma({
      audits: [
        {
          id: 'maud-ba-1',
          campaign_id: 'camp-1',
          platform: 'business_analysis',
          created_at: '2026-09-01',
          audit_data: { public_narrative: 'BA narrative.' },
        },
      ],
    });

    expect(await resolveCatIdAudit(prisma, 'camp-1', null)).toBeNull();
  });

  it('returns null when no cat-id audit exists anywhere in the lineage', async () => {
    const prisma = stubPrisma({ audits: [] });
    expect(await resolveCatIdAudit(prisma, 'camp-1', 'camp-parent')).toBeNull();
  });
});

describe('resolveCatIdPublicNarrative', () => {
  it('returns the trimmed narrative', async () => {
    const prisma = stubPrisma({
      audits: [
        {
          id: 'a1',
          campaign_id: 'camp-1',
          platform: 'category_identification',
          created_at: '2026-09-01',
          audit_data: { public_narrative: '  Shelf copy.  ' },
        },
      ],
    });

    expect(await resolveCatIdPublicNarrative(prisma, 'camp-1', null)).toBe('Shelf copy.');
  });

  it('returns null when the audit lacks a narrative', async () => {
    const prisma = stubPrisma({
      audits: [
        {
          id: 'a1',
          campaign_id: 'camp-1',
          platform: 'category_identification',
          created_at: '2026-09-01',
          audit_data: { public_narrative: '' },
        },
      ],
    });

    expect(await resolveCatIdPublicNarrative(prisma, 'camp-1', null)).toBeNull();
  });
});

describe('resolveAuditPublicNarrative', () => {
  it('resolves business_analysis narrative across an id set', async () => {
    const prisma = stubPrisma({
      audits: [
        {
          id: 'ba-older',
          campaign_id: 'camp-1',
          platform: 'business_analysis',
          created_at: '2026-08-01',
          audit_data: { public_narrative: 'Older.' },
        },
        {
          id: 'ba-newer',
          campaign_id: 'camp-2',
          platform: 'business_analysis',
          created_at: '2026-09-01',
          audit_data: { public_narrative: 'Newer.' },
        },
      ],
    });

    expect(
      await resolveAuditPublicNarrative(prisma, ['camp-1', 'camp-2'], 'business_analysis'),
    ).toBe('Newer.');
  });
});
