/**
 * ManualOutreachAnchorService.suggestVariantsForSeed tests
 *
 * Sibling-aware variant anchors: for every campaign linked to a seed
 * (primary/sibling/recovery), draft anchors are created from that
 * campaign's repair_triage_briefing variant + per-platform audit
 * outreach_problems. Drafts are dual-scoped (seed_id + campaign_id),
 * idempotent via evidence_refs provenance + observed_issue dedupe.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRaw,
  mockExecuteRaw,
  mockLinksFindMany,
  mockCampaignsFindMany,
  mockAuditsFindMany,
  mockAudit,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockExecuteRaw: vi.fn(),
  mockLinksFindMany: vi.fn(),
  mockCampaignsFindMany: vi.fn(),
  mockAuditsFindMany: vi.fn(),
  mockAudit: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: mockExecuteRaw,
    directory_seed_campaign_links: { findMany: mockLinksFindMany },
    mkt_campaigns_list: { findMany: mockCampaignsFindMany },
    mkt_audits_list: { findMany: mockAuditsFindMany },
  },
}));

vi.mock('../../audit', () => ({ audit: mockAudit }));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../lib/id-generator', () => ({
  generateDirectoryFieldProvenanceId: () => 'dfp-test',
  generateManualOutreachAnchorId: () => 'anchor-test',
  generateOutreachLogId: () => 'mol-test',
}));

import ManualOutreachAnchorService from '../intelligence/ManualOutreachAnchorService';

const CTX = { userId: 'op-1' } as any;

const sqlText = (call: any[]): string =>
  Array.isArray(call[0]) ? call[0].join('?') : String(call[0]);

// INSERT param order (createAnchor VALUES clause):
//   0 id, 1 seed_id, 2 campaign_id, 3 business_prospect_id, 4 anchor_type,
//   5 title, 6 operator_thesis, 7 observed_issue, 8 evidence_summary,
//   9 evidence_refs, 10 verification_question, 11 pain_question,
//   12 recommended_transition, 13 expected_verification, 14 created_by
let inserted: { sql: string; values: any[] }[];
let executed: { sql: string; values: any[] }[];
let existingAnchors: any[];

beforeEach(() => {
  vi.clearAllMocks();
  inserted = [];
  executed = [];
  existingAnchors = [];

  mockQueryRaw.mockImplementation((...args: any[]) => {
    const sql = sqlText(args);
    if (sql.includes('INSERT INTO mkt_outreach_anchors')) {
      inserted.push({ sql, values: args.slice(1) });
      return Promise.resolve([{ id: 'anchor-test' }]);
    }
    if (sql.includes('FROM mkt_outreach_anchors')) return Promise.resolve(existingAnchors);
    return Promise.resolve([]);
  });

  mockExecuteRaw.mockImplementation((...args: any[]) => {
    executed.push({ sql: sqlText(args), values: args.slice(1) });
    return Promise.resolve(1);
  });

  mockLinksFindMany.mockResolvedValue([{ campaign_id: 'camp-a' }]);
  mockCampaignsFindMany.mockResolvedValue([]);
  mockAuditsFindMany.mockResolvedValue([]);
  mockAudit.mockResolvedValue({});
});

describe('ManualOutreachAnchorService.suggestVariantsForSeed', () => {
  it('drafts dual-scoped anchors from each linked campaign briefing variant', async () => {
    mockLinksFindMany.mockResolvedValue([
      { campaign_id: 'camp-a' },
      { campaign_id: 'camp-b' },
    ]);
    mockCampaignsFindMany.mockResolvedValue([
      {
        id: 'camp-a',
        campaign_category: 'profile_repair',
        repair_track: 'standard',
        repair_triage_briefing: {
          outreach_problems: [
            {
              problem: 'Filed as a plain convenience store',
              regular: 'I noticed the listing is filed under Convenience store…',
              hook: 'Try this on your phone…',
              solution: 'Re-file under the right primary category.',
              evidence: 'GBP primary category is Convenience store.',
              outreach_use: 'Cold-call opener',
            },
          ],
        },
      },
      {
        id: 'camp-b',
        campaign_category: 'review_management',
        repair_track: null,
        repair_triage_briefing: {
          outreach_problems: [
            {
              problem: 'A second live listing splits customers',
              regular: 'There is a second listing at a different address…',
              hook: '',
              solution: '',
              evidence: '',
              outreach_use: '',
            },
          ],
        },
      },
    ]);

    const result = await ManualOutreachAnchorService.suggestVariantsForSeed('seed-1', CTX);

    expect(result.created).toHaveLength(2);
    expect(result.skipped).toBe(0);
    expect(inserted).toHaveLength(2);

    // Dual scope: seed + the source sibling campaign
    expect(inserted[0].values[1]).toBe('seed-1');
    expect(inserted[0].values[2]).toBe('camp-a');
    expect(inserted[1].values[2]).toBe('camp-b');

    // Variant label + problem headline in the title
    expect(inserted[0].values[5]).toContain('[profile repair · standard]');
    expect(inserted[0].values[5]).toContain('Filed as a plain convenience store');
    expect(inserted[1].values[5]).toContain('[review management]');

    // Field mapping: problem → observed_issue, regular → verification_question,
    // hook → pain_question, solution → recommended_transition
    expect(inserted[0].values[7]).toBe('Filed as a plain convenience store');
    expect(inserted[0].values[10]).toContain('filed under Convenience store');
    expect(inserted[0].values[11]).toBe('Try this on your phone…');
    expect(inserted[0].values[12]).toBe('Re-file under the right primary category.');

    // Anchor-type heuristic: the duplicate-listing problem → listing_accuracy
    expect(inserted[1].values[4]).toBe('listing_accuracy');
  });

  it('pulls outreach_problems from sibling audits (website_positioning)', async () => {
    mockAuditsFindMany.mockResolvedValue([
      {
        campaign_id: 'camp-a',
        platform: 'website_positioning',
        audit_data: {
          outreach_problems: [
            {
              problem: 'No website of its own — only a Square storefront',
              regular: 'The website on your listing is a Square page…',
              hook: '',
              solution: 'Build a small owned site.',
              evidence: 'Only link is a free Square storefront.',
              outreach_use: 'Email hook or follow-up touch',
            },
          ],
        },
      },
    ]);
    mockCampaignsFindMany.mockResolvedValue([
      {
        id: 'camp-a',
        campaign_category: 'profile_repair',
        repair_track: null,
        repair_triage_briefing: null,
      },
    ]);

    const result = await ManualOutreachAnchorService.suggestVariantsForSeed('seed-1', CTX);

    expect(result.created).toHaveLength(1);
    expect(inserted[0].values[4]).toBe('website_or_profile_claim');
    expect(inserted[0].values[7]).toContain('Square storefront');
  });

  it('falls back to a pitch-derived anchor when a briefing has no outreach_problems', async () => {
    mockCampaignsFindMany.mockResolvedValue([
      {
        id: 'camp-a',
        campaign_category: 'triage_management',
        repair_track: null,
        repair_triage_briefing: {
          pitch: {
            primary_angle: 'Invisible for the items it actually stocks',
            opener_hook: 'Someone types teff flour near me tonight…',
            pain_points: ['Shoppers routed to supermarkets'],
          },
        },
      },
    ]);

    const result = await ManualOutreachAnchorService.suggestVariantsForSeed('seed-1', CTX);

    expect(result.created).toHaveLength(1);
    expect(inserted[0].values[7]).toBe('Invisible for the items it actually stocks');
    expect(inserted[0].values[10]).toBe('Someone types teff flour near me tonight…');
    expect(inserted[0].values[8]).toContain('Shoppers routed to supermarkets');
  });

  it('is idempotent — skips problems already covered by a seed anchor', async () => {
    mockCampaignsFindMany.mockResolvedValue([
      {
        id: 'camp-a',
        campaign_category: 'profile_repair',
        repair_track: null,
        repair_triage_briefing: {
          outreach_problems: [
            {
              problem: 'Duplicate listing splits customers',
              regular: 'dup line',
              hook: '',
              solution: '',
              evidence: '',
              outreach_use: '',
            },
            {
              problem: 'No website of its own',
              regular: 'site line',
              hook: '',
              solution: '',
              evidence: '',
              outreach_use: '',
            },
          ],
        },
      },
    ]);
    existingAnchors = [
      {
        id: 'anchor-old',
        observed_issue: 'Duplicate listing splits customers',
        evidence_refs: [],
      },
      {
        id: 'anchor-old2',
        observed_issue: null,
        evidence_refs: [{ kind: 'sibling_variant', campaign_id: 'camp-a', source: 'triage_briefing', index: 1 }],
      },
    ];

    const result = await ManualOutreachAnchorService.suggestVariantsForSeed('seed-1', CTX);

    expect(result.created).toHaveLength(0);
    expect(result.skipped).toBe(2);
    expect(inserted).toHaveLength(0);
  });

  it('returns empty for an unlinked seed', async () => {
    mockLinksFindMany.mockResolvedValue([]);

    const result = await ManualOutreachAnchorService.suggestVariantsForSeed('seed-orphan', CTX);

    expect(result).toEqual({ created: [], skipped: 0 });
    expect(mockCampaignsFindMany).not.toHaveBeenCalled();
  });
});

describe('ManualOutreachAnchorService — sibling-aware visibility', () => {
  it('listAnchorsForSeed unions anchors scoped to any linked campaign', async () => {
    await ManualOutreachAnchorService.listAnchorsForSeed('seed-1');

    const sql = sqlText(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('directory_seed_campaign_links');
    expect(sql).toContain('campaign_id IN');
  });

  it('seed-side contact on a campaign-scoped anchor writes that campaign log too (§12.5)', async () => {
    existingAnchors = [
      {
        id: 'anchor-sib',
        seed_id: null,
        campaign_id: 'camp-b',
        anchor_type: 'listing_accuracy',
        status: 'active',
        title: 'Dup listing check',
        operator_thesis: 'verify the duplicate',
        verification_question: 'Is there a second listing?',
        pain_question: null,
        recommended_transition: null,
        expected_verification: 'confirm',
        evidence_refs: [],
      },
    ];

    // Seed-side route passes seedId only — no campaignId param.
    await ManualOutreachAnchorService.recordContactWithAnchor(
      {
        anchorId: 'anchor-sib',
        seedId: 'seed-1',
        callResult: 'connected',
        verificationResults: [],
      },
      CTX,
    );

    const logInsert = executed.find((c) => c.sql.includes('INSERT INTO mkt_outreach_log'));
    expect(logInsert).toBeTruthy();
    expect(logInsert!.values[1]).toBe('camp-b');
    // Seed touch still written — both ledgers.
    expect(executed.some((c) => c.sql.includes('INTO directory_seed_outreach_touches'))).toBe(true);
  });

  it('seed-only anchors still skip the campaign log when no campaign scope exists', async () => {
    existingAnchors = [
      {
        id: 'anchor-seed',
        seed_id: 'seed-1',
        campaign_id: null,
        anchor_type: 'seed_claim_invitation',
        status: 'active',
        title: 'Claim invite',
        operator_thesis: 'invite claim',
        verification_question: 'Want the link?',
        pain_question: null,
        recommended_transition: null,
        expected_verification: 'claim',
        evidence_refs: [],
      },
    ];

    await ManualOutreachAnchorService.recordContactWithAnchor(
      {
        anchorId: 'anchor-seed',
        seedId: 'seed-1',
        callResult: 'connected',
        verificationResults: [],
      },
      CTX,
    );

    expect(executed.some((c) => c.sql.includes('INSERT INTO mkt_outreach_log'))).toBe(false);
    expect(executed.some((c) => c.sql.includes('INTO directory_seed_outreach_touches'))).toBe(true);
  });
});
