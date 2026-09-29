/**
 * ProspectReportService tests — Phase 2: the pure transform core.
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md §2–§4
 * Sprint: WEBSITE_GAP_OWNER_REPORT_SPRINT_PLAN.md Phase 2
 *
 * Fixture is shaped on the real Raja Bazaar website_positioning audit
 * (owned domain, stale ordering widget, £ delivery banner, HMS halal not
 * prominent, the functional_owned_storefront conformance row).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCampaignFindMany, mockAuditFindMany, mockLinkFindFirst, mockLinkFindUnique, mockLinkCreate, mockQueryRaw } =
  vi.hoisted(() => ({
    mockCampaignFindMany: vi.fn(),
    mockAuditFindMany: vi.fn(),
    mockLinkFindFirst: vi.fn(),
    mockLinkFindUnique: vi.fn(),
    mockLinkCreate: vi.fn(),
    mockQueryRaw: vi.fn(),
  }));

vi.mock('../../prisma', () => ({
  prisma: {
    mkt_campaigns_list: { findMany: mockCampaignFindMany },
    mkt_audits_list: { findMany: mockAuditFindMany },
    mkt_prospect_report_links: {
      findFirst: mockLinkFindFirst,
      findUnique: mockLinkFindUnique,
      create: mockLinkCreate,
    },
    $queryRaw: mockQueryRaw,
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../BusinessProspectService', () => ({
  BusinessProspectService: {
    getInstance: () => ({
      initializeProspectFromCampaign: vi.fn().mockResolvedValue('bp_init'),
      listSiblings: vi.fn(),
    }),
  },
}));

import prospectReportService, {
  gapIsMet,
  isInternalLine,
  CHAPTER_BUILDERS,
} from '../ProspectReportService';
import { prospectReportSchema } from '../../validators/prospect-report-dto.schema';

const RAJA_AUDIT = {
  summary:
    'Raja Bazaar runs a working owned site with real product categories and ordering — but a stale ordering schedule, a British-pound delivery banner, and missing trust signals quietly cost walk-in customers.',
  presence_classification: 'present',
  ownership: 'owned_domain',
  issues: [
    {
      issue: 'Ordering widget shows a stale schedule',
      evidence: 'rajabazaar.com ordering widget displays pickup windows from a prior season',
      severity: 'non_negotiable',
      conversion_implication:
        'customers checking whether they can shop today may believe the store is closed',
    },
    {
      issue: 'Delivery banner charges in British pounds',
      evidence: 'banner on rajabazaar.com offers delivery at £30 minimum',
      severity: 'non_negotiable',
      conversion_implication:
        'a Milwaukee customer reading a £ price assumes the site is not for them',
    },
    {
      issue: 'HMS halal certification is not prominent',
      evidence: 'halal claim appears in body copy; no certification badge',
      severity: 'recommended',
      conversion_implication:
        'halal-observant shoppers cannot confirm certification before deciding to visit',
    },
  ],
  positioning_gaps: [
    {
      platform: 'website',
      field: 'functional_owned_storefront',
      expected: true,
      actual: true,
      gap_description: 'A working owned storefront is present — this benchmark requirement is met',
      severity: 'non_negotiable',
    },
    {
      platform: 'website',
      field: 'stock_check_channel',
      expected: ['whatsapp', 'sms'],
      actual: ['sms'],
      gap_description: 'No visible WhatsApp route for checking stock before a visit',
      severity: 'recommended',
    },
    {
      platform: 'website',
      field: 'product_category_count',
      expected: 8,
      actual: 8,
      gap_description: 'Category depth matches the gold-standard shelf count',
      severity: 'recommended',
    },
    {
      platform: 'website',
      field: 'ordering_schedule_currency',
      expected: 'USD',
      actual: 'GBP',
      gap_description: 'Delivery minimum displays in pounds, not dollars',
      severity: 'non_negotiable',
    },
  ],
  build_scope: {
    recommended: 'repair',
    scope_notes:
      'Reachable owned domain with working ordering — preserve what works and rebuild the conversion layer.',
    must_have_pages: ['Home', 'Shop', 'Pickup & Delivery', 'Halal certification', 'Contact'],
  },
  detected_signals: ['WC_STALE_WEBSITE', 'WC_CATEGORY_MISMATCH'],
  competitive_frame: [
    'Leading specialty grocers put same-day pickup windows above the fold.',
    'Category leaders surface halal certification in the header and footer.',
  ],
  outreach_problems: [
    {
      problem: 'The delivery banner prices in pounds, so local shoppers assume it is not for them',
      regular: 'Your delivery banner shows a £30 minimum — Milwaukee customers may read that and leave.',
      hook: 'Your own website is quoting customers in British pounds.',
      solution: 'Rebuild the ordering surface with local currency and a live pickup schedule.',
      evidence: 'rajabazaar.com delivery banner: "£30 minimum"',
      outreach_use: 'cold-call opener',
    },
  ],
  data_quality: {
    verified_fields: [
      'EVIDENCE COVERAGE is FULL — website reached directly',
      'website.url — rajabazaar.com reachable over HTTPS',
      'DISCOVERY — sourced via prior_website_findings from business audit',
      'ordering.schedule — verified on 2026-09-20',
    ],
    unavailable_fields: ['owner confirmation of delivery radius'],
    limitations: ['Single-visit audit — no checkout flow was exercised'],
  },
};

const CTX = {
  businessName: 'Raja Bazaar',
  websiteUrl: 'https://rajabazaar.com',
  category: 'Middle Eastern Grocery Store',
  auditedAt: '2026-09-22T14:00:00.000Z',
};

/**
 * Raja-shaped business_analysis audit (the A5 sibling's chapter source) —
 * internal machinery fields present to prove they never reach the DTO.
 */
const RAJA_BA_AUDIT = {
  audit_metadata: {
    audit_date: '2026-09-21',
    requested_business: {
      business_name: 'Raja Bazaar',
      city: 'Milwaukee',
      state: 'WI',
      category: 'Middle Eastern Grocery Store',
    },
    identity_status: 'confirmed',
    identity_confidence: 'high',
    limitations: ['No login-level checks performed'],
  },
  summary:
    'Raja Bazaar is confirmed across public sources — claimed on Google with strong reviews, but Yelp is unclaimed and two negative reviews sit unanswered.',
  detected_signals: ['WC_STALE_WEBSITE', 'RC_UNANSWERED_NEGATIVE'],
  platforms: {
    google: {
      profile_status: 'claimed',
      rating: 4.6,
      total_reviews: 38,
      reviews_with_observable_response: 5,
      observable_unanswered_reviews: null,
      observable_unanswered_negative_reviews: null,
      observable_unanswered_positive_reviews: null,
      observable_response_rate_percent: null,
      data_status: 'complete',
      profile_url: 'https://maps.google.com/rajabazaar',
    },
    yelp: {
      profile_status: 'unclaimed',
      rating: 4.0,
      total_reviews: 6,
      reviews_with_observable_response: null,
      observable_unanswered_reviews: null,
      observable_unanswered_negative_reviews: null,
      observable_unanswered_positive_reviews: null,
      observable_response_rate_percent: null,
      data_status: 'partial',
    },
    facebook: {
      profile_status: 'unable_to_verify',
      rating: null,
      total_reviews: null,
      reviews_with_observable_response: null,
      observable_unanswered_reviews: null,
      observable_unanswered_negative_reviews: null,
      observable_unanswered_positive_reviews: null,
      observable_response_rate_percent: null,
      data_status: 'unable_to_verify',
    },
  },
  website: {
    url: 'https://rajabazaar.com',
    status: 'working',
    issues: ['No online ordering for prepared foods'],
  },
  nap_consistency: {
    overall_status: 'consistent',
    canonical_name: 'Raja Bazaar',
  },
  combined_review_metrics: {
    observable_total_reviews: 44,
    observable_reviews_with_response: 5,
    observable_unanswered_reviews: 3,
    observable_unanswered_negative_reviews: 2,
    observable_unanswered_positive_reviews: 1,
  },
  gap_analysis: {
    gaps: [
      {
        platform: 'google',
        field: 'photo_count',
        expected: 12,
        actual: 4,
        gap_description: 'Only 4 photos observed vs the 12-photo benchmark',
        severity: 'non_negotiable',
      },
      {
        platform: 'google',
        field: 'special_hours',
        expected: true,
        actual: false,
        gap_description: 'No holiday or special hours posted',
        severity: 'recommended',
      },
    ],
    summary: 'Profile depth is below the category benchmark.',
  },
  competitive_benchmarks: [
    {
      business_name: 'Sharaf Market',
      store_format: 'grocery_plus_prepared_foods',
      google_rating: 4.8,
      google_review_count: 210,
    },
  ],
  alignment_scoring: {
    misalignment_index: 41,
    action_classification: 'ADMIN_NEGLECT',
    lead_disposition: 'HIGH_PRIORITY_OUTREACH',
    primary_outreach_hook: 'Two negative reviews sit unanswered while competitors answer every one.',
  },
  recommended_tier: 'tier_2',
  tier_rationale: 'Claimed Google profile with unanswered negative reviews and a thin Yelp presence — a profile cleanup, not a rebuild.',
  estimated_monthly_service_fee: { minimum: 250, maximum: 450, currency: 'USD' },
  recommended_services: ['Claim the Yelp listing', 'Respond to unanswered reviews', 'Expand Google profile photos'],
  digital_opportunity_score: { score: 62, classification: 'moderate' },
  high_attention: true,
  high_attention_reasons: ['unanswered negative reviews'],
  outreach_problems: [
    {
      problem: 'Unanswered negative reviews suppress walk-in traffic',
      regular: 'Two negative reviews have no reply.',
      hook: 'The last bad review on your Google profile has been sitting unanswered.',
      solution: 'Answer the reviews and claim the Yelp listing.',
      evidence: 'yelp listing unclaimed; 2 unanswered negative Google reviews',
      outreach_use: 'cold-call opener',
    },
  ],
  data_quality: {
    confidence: 'high',
    verified_fields: [
      'google profile reached and rendered',
      'DISCOVERY — sourced via category scan',
      'nap.cross_platform — consistent',
    ],
    unavailable_fields: ['facebook page owner confirmation'],
    conflicts: ['yelp displayed hours conflict with Google hours'],
    limitations: ['No purchase flow exercised'],
  },
};

const BA_AUDIT_ROW = {
  campaign_id: 'cmp-repair',
  platform: 'business_analysis',
  audit_data: RAJA_BA_AUDIT,
  created_at: new Date('2026-09-23T14:00:00.000Z'),
};

describe('buildWebsiteChapter', () => {
  it('produces the owner-facing verdict for present × owned_domain', () => {
    const ch = prospectReportService.buildWebsiteChapter(RAJA_AUDIT, CTX);
    expect(ch.verdict).toBe(
      'You have a working website on your own domain — the foundation is solid.',
    );
  });

  it('splits positioning_gaps into already-working vs expectations', () => {
    const ch = prospectReportService.buildWebsiteChapter(RAJA_AUDIT, CTX);
    // met: functional_owned_storefront (bool true), product_category_count (8===8)
    expect(ch.already_working).toHaveLength(2);
    expect(ch.already_working[0]).toContain('benchmark requirement is met');
    // unmet: stock_check_channel (array subset), ordering_schedule_currency (GBP≠USD)
    expect(ch.expectations).toHaveLength(2);
    expect(ch.expectations[0].field).toBe('Stock check channel');
    expect(ch.expectations[1].expected_text).toBe('USD');
    expect(ch.expectations[1].actual_text).toBe('GBP');
  });

  it('sorts issues non_negotiable first and retitles severity', () => {
    const ch = prospectReportService.buildWebsiteChapter(RAJA_AUDIT, CTX);
    expect(ch.costing_customers[0].tier).toBe('now');
    expect(ch.costing_customers[1].tier).toBe('now');
    expect(ch.costing_customers[2].tier).toBe('worth_fixing');
    expect(ch.costing_customers[0].cost).toContain('customers checking whether');
    expect(ch.costing_customers[0].evidence).toContain('ordering widget');
  });

  it('reframes repair as managed replacement (§4)', () => {
    const ch = prospectReportService.buildWebsiteChapter(RAJA_AUDIT, CTX);
    expect(ch.fix.headline).toContain('keeps everything already working');
    expect(ch.fix.headline).not.toContain('WordPress');
    expect(ch.fix.scope_notes).toContain('Reachable owned domain');
  });

  it('keeps must_have_pages behind the includePagePlan flag', () => {
    const off = prospectReportService.buildWebsiteChapter(RAJA_AUDIT, CTX);
    const on = prospectReportService.buildWebsiteChapter(RAJA_AUDIT, CTX, {
      includePagePlan: true,
    });
    expect(off.fix.page_plan).toBeNull();
    expect(on.fix.page_plan).toEqual([
      'Home',
      'Shop',
      'Pickup & Delivery',
      'Halal certification',
      'Contact',
    ]);
  });

  it('redacts internal-only fields entirely', () => {
    const ch = prospectReportService.buildWebsiteChapter(RAJA_AUDIT, CTX);
    const serialized = JSON.stringify(ch);
    expect(serialized).not.toContain('WC_STALE_WEBSITE');
    expect(serialized).not.toContain('WC_CATEGORY_MISMATCH');
    expect(serialized).not.toContain('cold-call opener');
    expect(serialized).not.toContain('£30 minimum — Milwaukee');
    expect(serialized).not.toContain('hook');
  });

  it('strips internal lane-plumbing lines from verified_fields', () => {
    const dq = prospectReportService.buildChapterDataQuality(RAJA_AUDIT);
    expect(dq.verified).toEqual([
      'website.url — rajabazaar.com reachable over HTTPS',
      'ordering.schedule — verified on 2026-09-20',
    ]);
    expect(dq.couldnt_check).toEqual(['owner confirmation of delivery radius']);
    expect(dq.limitations).toEqual([
      'Single-visit audit — no checkout flow was exercised',
    ]);
  });

  it('passes the DTO schema — safe-by-construction', () => {
    const ch = prospectReportService.buildWebsiteChapter(RAJA_AUDIT, CTX);
    const report = {
      report_kind: 'business_visibility',
      business_prospect_id: 'bp_test',
      business_name: CTX.businessName,
      prepared_at: CTX.auditedAt,
      website_url: CTX.websiteUrl,
      tier: 'free',
      short_version: { lead: null, bullets: [ch.summary!] },
      chapters: [ch],
      locked_chapters: [],
      data_quality: prospectReportService.buildChapterDataQuality(RAJA_AUDIT),
      cta: { kind: 'claim', label: 'Claim your listing', url: '/claim/abc' },
    };
    expect(prospectReportSchema.safeParse(report).success).toBe(true);
  });
});

describe('gapIsMet (§3.3 extended rules)', () => {
  it('boolean actual === true is met', () => {
    expect(gapIsMet(true, true)).toBe(true);
    expect(gapIsMet('present', true)).toBe(true);
    expect(gapIsMet(true, false)).toBe(false);
  });

  it('string-equal is trimmed and case-insensitive', () => {
    expect(gapIsMet('USD', 'usd')).toBe(true);
    expect(gapIsMet('USD', ' GBP ')).toBe(false);
  });

  it('arrays are set-equal, order-insensitive', () => {
    expect(gapIsMet(['sms', 'whatsapp'], ['WhatsApp', 'SMS'])).toBe(true);
    expect(gapIsMet(['whatsapp', 'sms'], ['sms'])).toBe(false);
    expect(gapIsMet(['a'], 'a')).toBe(false); // type mismatch
  });

  it('numbers are strictly equal', () => {
    expect(gapIsMet(8, 8)).toBe(true);
    expect(gapIsMet(8, '8')).toBe(false);
    expect(gapIsMet(8, 9)).toBe(false);
  });

  it('null on either side is unmet', () => {
    expect(gapIsMet('x', null)).toBe(false);
    expect(gapIsMet(null, 'x')).toBe(false);
  });
});

describe('isInternalLine (§3.4)', () => {
  it('strips EVIDENCE COVERAGE and DISCOVERY prefixes', () => {
    expect(isInternalLine('EVIDENCE COVERAGE is FULL')).toBe(true);
    expect(isInternalLine('DISCOVERY — sourced via scan')).toBe(true);
  });
  it('strips prior_website_findings / unable_to_verify mechanics', () => {
    expect(isInternalLine('prior_website_findings coverage: PARTIAL')).toBe(true);
    expect(isInternalLine('phone — unable_to_verify')).toBe(true);
  });
  it('passes genuine verification lines', () => {
    expect(isInternalLine('website.url — verified over HTTPS')).toBe(false);
  });
});

describe('buildRepairChapter (business_analysis → repair chapter)', () => {
  it('produces the identity × coverage verdict', () => {
    const ch = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX);
    expect(ch.chapter_id).toBe('repair');
    expect(ch.title).toBe('Your online listings');
    expect(ch.verdict).toContain('confirmed this business is Raja Bazaar');
    expect(ch.verdict).toContain('2 major listing platforms');
    expect(ch.verdict).toContain('1 more we could not verify');
  });

  it('leads with what already works — claimed profile, NAP, site, replies', () => {
    const ch = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX);
    expect(ch.already_working.some((l) => l.includes('Google Business Profile listing is claimed') && l.includes('4.6★'))).toBe(true);
    expect(ch.already_working.some((l) => l.includes('name, address, and phone are consistent'))).toBe(true);
    expect(ch.already_working.some((l) => l.includes('website loads'))).toBe(true);
    expect(ch.already_working.some((l) => l.includes('replied to some of your reviews'))).toBe(true);
  });

  it('surfaces unclaimed listings and unanswered negative reviews as findings', () => {
    const ch = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX);
    const yelp = ch.costing_customers.find((i) => i.headline.includes('Yelp'));
    expect(yelp?.tier).toBe('worth_fixing');
    const neg = ch.costing_customers.find((i) => i.headline.includes('negative review'));
    expect(neg?.headline).toContain('2 negative reviews');
    expect(neg?.tier).toBe('now');
    // 'now' findings sort first
    expect(ch.costing_customers[0].tier).toBe('now');
  });

  it('maps gap_analysis rows to expected-vs-actual expectations', () => {
    const ch = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX);
    expect(ch.expectations).toHaveLength(2);
    expect(ch.expectations[0].field).toBe('Google Business Profile — Photo count');
    expect(ch.expectations[0].expected_text).toBe('12');
    expect(ch.expectations[0].actual_text).toBe('4');
    // gap_analysis does not double-emit into costing_customers
    expect(ch.costing_customers.every((i) => !i.headline.includes('photo'))).toBe(true);
  });

  it('renders benchmarks as owner-facing exemplar lines', () => {
    const ch = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX);
    expect(ch.competitive_frame[0]).toContain('Sharaf Market');
    expect(ch.competitive_frame[0]).toContain('4.8★');
  });

  it('gates recommended_services behind includePagePlan', () => {
    const off = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX);
    const on = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX, { includePagePlan: true });
    expect(off.fix.page_plan).toBeNull();
    expect(on.fix.page_plan).toContain('Claim the Yelp listing');
  });

  it('redacts internal machinery — signals, outreach, scoring, fees', () => {
    const ch = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX);
    const serialized = JSON.stringify(ch);
    expect(serialized).not.toContain('WC_STALE_WEBSITE');
    expect(serialized).not.toContain('RC_UNANSWERED_NEGATIVE');
    expect(serialized).not.toContain('cold-call opener');
    expect(serialized).not.toContain('HIGH_PRIORITY_OUTREACH');
    expect(serialized).not.toContain('ADMIN_NEGLECT');
    expect(serialized).not.toContain('tier_2');
    expect(serialized).not.toContain('62');
    expect(serialized).not.toContain('450');
    expect(serialized).not.toContain('outreach_hook');
  });

  it('unions BA data_quality + audit_metadata limitations for the honesty footer', () => {
    const dq = prospectReportService.buildChapterDataQuality(RAJA_BA_AUDIT, 'repair');
    expect(dq.verified).toEqual([
      'google profile reached and rendered',
      'nap.cross_platform — consistent',
    ]);
    expect(dq.couldnt_check).toEqual([
      'facebook page owner confirmation',
      'yelp displayed hours conflict with Google hours',
    ]);
    expect(dq.limitations).toEqual([
      'No purchase flow exercised',
      'No login-level checks performed',
    ]);
  });

  it('passes the DTO schema — safe-by-construction', () => {
    const ch = prospectReportService.buildRepairChapter(RAJA_BA_AUDIT, CTX);
    const report = {
      report_kind: 'business_visibility',
      business_prospect_id: 'bp_test',
      business_name: CTX.businessName,
      prepared_at: CTX.auditedAt,
      website_url: CTX.websiteUrl,
      tier: 'full',
      short_version: { lead: null, bullets: [] },
      chapters: [ch],
      locked_chapters: [],
      data_quality: prospectReportService.buildChapterDataQuality(RAJA_BA_AUDIT, 'repair'),
      cta: { kind: 'contact', label: 'Talk to us', url: null },
    };
    expect(prospectReportSchema.safeParse(report).success).toBe(true);
  });
});

describe('CHAPTER_BUILDERS registry', () => {
  it('registers website on website_positioning and repair on business_analysis', () => {
    expect(CHAPTER_BUILDERS.website?.source).toBe('website_positioning');
    expect(CHAPTER_BUILDERS.website?.title).toBe('Your website today');
    expect(CHAPTER_BUILDERS.repair?.source).toBe('business_analysis');
    expect(CHAPTER_BUILDERS.repair?.teaserTitle).toBe('Your public profiles');
  });
});

// ─── Phase 3: tokens, assembly, short links ──────────────────────────────

beforeEach(() => {
  mockCampaignFindMany.mockReset();
  mockAuditFindMany.mockReset();
  mockLinkFindFirst.mockReset();
  mockLinkFindUnique.mockReset();
  mockLinkCreate.mockReset();
  mockQueryRaw.mockReset();
});

const SIBLINGS = [
  { id: 'cmp-web', business_name: 'Raja Bazaar', website_url: 'https://rajabazaar.com', category: 'Middle Eastern Grocery Store' },
  { id: 'cmp-repair', business_name: 'Raja Bazaar', website_url: 'https://rajabazaar.com', category: 'Middle Eastern Grocery Store' },
];

const AUDIT_ROW = {
  campaign_id: 'cmp-web',
  platform: 'website_positioning',
  audit_data: RAJA_AUDIT,
  created_at: new Date('2026-09-22T14:00:00.000Z'),
};

describe('token mint/verify (§5.1, §0.4)', () => {
  it('round-trips a 4-segment payload', () => {
    const token = prospectReportService.mintToken({
      prospectId: 'bp_raja',
      tier: 'free',
      chapters: ['website'],
      includePagePlan: false,
    })!;
    expect(token).toBeTruthy();
    const parsed = prospectReportService.verifyToken(token);
    expect(parsed).toEqual({
      prospectId: 'bp_raja',
      tier: 'free',
      chapters: ['website'],
      includePagePlan: false,
    });
  });

  it('encodes the page-plan flag', () => {
    const token = prospectReportService.mintToken({
      prospectId: 'bp_raja',
      tier: 'full',
      chapters: ['website', 'repair'],
      includePagePlan: true,
    })!;
    expect(prospectReportService.verifyToken(token)?.includePagePlan).toBe(true);
  });

  it('rejects a tier flip — the signature breaks', () => {
    const token = prospectReportService.mintToken({
      prospectId: 'bp_raja',
      tier: 'free',
      chapters: ['website'],
      includePagePlan: false,
    })!;
    const payload = token.slice(0, token.indexOf('.'));
    const sig = token.slice(token.indexOf('.') + 1);
    // Re-encode the same payload with tier flipped to 'full'.
    const tampered = Buffer.from('bp_raja.full.website.-', 'utf8').toString('base64url');
    expect(prospectReportService.verifyToken(`${tampered}.${sig}`)).toBeNull();
    expect(payload).not.toBe(tampered);
  });

  it('rejects a flags flip and a chapter-list edit', () => {
    const token = prospectReportService.mintToken({
      prospectId: 'bp_raja',
      tier: 'free',
      chapters: ['website'],
      includePagePlan: false,
    })!;
    const sig = token.slice(token.indexOf('.') + 1);
    const flagFlip = Buffer.from('bp_raja.free.website.p', 'utf8').toString('base64url');
    const chapterAdd = Buffer.from('bp_raja.free.website,repair.-', 'utf8').toString('base64url');
    expect(prospectReportService.verifyToken(`${flagFlip}.${sig}`)).toBeNull();
    expect(prospectReportService.verifyToken(`${chapterAdd}.${sig}`)).toBeNull();
  });

  it('rejects malformed and empty tokens without throwing', () => {
    expect(prospectReportService.verifyToken('')).toBeNull();
    expect(prospectReportService.verifyToken('notatoken')).toBeNull();
    expect(prospectReportService.verifyToken('a.b.c')).toBeNull();
    expect(prospectReportService.verifyToken('.sig')).toBeNull();
  });
});

describe('assembleReport (§5.0, §5.1a)', () => {
  it('assembles the website chapter from the latest sibling audit', async () => {
    mockCampaignFindMany.mockResolvedValue(SIBLINGS);
    mockAuditFindMany.mockResolvedValue([AUDIT_ROW]);
    mockQueryRaw.mockResolvedValue([{ short_code: 'ABC123', token: 'tok' }]);

    const report = await prospectReportService.assembleReport('bp_raja', ['website'], 'free');
    expect(report).not.toBeNull();
    expect(report!.chapters).toHaveLength(1);
    expect(report!.chapters[0].chapter_id).toBe('website');
    expect(report!.locked_chapters).toHaveLength(0);
    expect(report!.business_name).toBe('Raja Bazaar');
    expect(report!.cta.kind).toBe('claim');
    expect(report!.cta.url).toContain('/q/ABC123');
    expect(report!.tier).toBe('free');
    expect(report!.short_version.lead).toContain('Raja Bazaar runs a working');
    expect(prospectReportSchema.safeParse(report).success).toBe(true);
  });

  it('tier=free clamps to chapter 1 and emits locked teasers for withheld chapters', async () => {
    // The real 'repair' builder over a real business_analysis row — the
    // A5 sibling's audit — exercises the clamp/teaser path end-to-end.
    mockCampaignFindMany.mockResolvedValue(SIBLINGS);
    mockAuditFindMany.mockResolvedValue([AUDIT_ROW, BA_AUDIT_ROW]);
    mockQueryRaw.mockResolvedValue([]);

    const report = await prospectReportService.assembleReport('bp_raja', ['website', 'repair'], 'free');
    expect(report!.tier).toBe('free');
    expect(report!.chapters).toHaveLength(1);
    expect(report!.chapters[0].chapter_id).toBe('website');
    expect(report!.locked_chapters).toHaveLength(1);
    expect(report!.locked_chapters[0].chapter_id).toBe('repair');
    expect(report!.locked_chapters[0].finding_count).toBeGreaterThan(0);
    // The teaser carries title + count — never content.
    expect(report!.locked_chapters[0].teaser).toContain('Your public profiles');
    // And the withheld chapter's internals never enter the DTO.
    expect(JSON.stringify(report!.locked_chapters)).not.toContain('£30');
    expect(JSON.stringify(report!.locked_chapters)).not.toContain('unclaimed');
  });

  it('tier=full renders every assembled chapter with no teasers', async () => {
    mockCampaignFindMany.mockResolvedValue(SIBLINGS);
    mockAuditFindMany.mockResolvedValue([AUDIT_ROW, BA_AUDIT_ROW]);
    mockQueryRaw.mockResolvedValue([]);

    const report = await prospectReportService.assembleReport('bp_raja', ['website', 'repair'], 'full');
    expect(report!.chapters).toHaveLength(2);
    expect(report!.chapters.map((c) => c.chapter_id)).toEqual(['website', 'repair']);
    expect(report!.locked_chapters).toHaveLength(0);
    // Multi-chapter short version is the composite lead + per-chapter bullets.
    expect(report!.short_version.lead).toContain('We reviewed');
    expect(report!.short_version.bullets.length).toBe(2);
    expect(prospectReportSchema.safeParse(report).success).toBe(true);
  });

  it('the A5 sibling alone assembles a single-chapter repair report', async () => {
    mockCampaignFindMany.mockResolvedValue(SIBLINGS);
    mockAuditFindMany.mockResolvedValue([BA_AUDIT_ROW]);
    mockQueryRaw.mockResolvedValue([]);

    const report = await prospectReportService.assembleReport('bp_raja', ['repair'], 'free');
    expect(report!.chapters).toHaveLength(1);
    expect(report!.chapters[0].chapter_id).toBe('repair');
    expect(report!.locked_chapters).toHaveLength(0);
    expect(report!.short_version.lead).toContain('Raja Bazaar is confirmed');
  });

  it('a repair-first selection leads with the repair chapter on free tier', async () => {
    mockCampaignFindMany.mockResolvedValue(SIBLINGS);
    mockAuditFindMany.mockResolvedValue([AUDIT_ROW, BA_AUDIT_ROW]);
    mockQueryRaw.mockResolvedValue([]);

    const report = await prospectReportService.assembleReport('bp_raja', ['repair', 'website'], 'free');
    expect(report!.chapters[0].chapter_id).toBe('repair');
    expect(report!.locked_chapters[0].chapter_id).toBe('website');
  });

  it('a permitted chapter with no audit is simply absent (G-3 accumulation)', async () => {
    mockCampaignFindMany.mockResolvedValue(SIBLINGS);
    mockAuditFindMany.mockResolvedValue([AUDIT_ROW]);
    mockQueryRaw.mockResolvedValue([]);

    const report = await prospectReportService.assembleReport('bp_raja', ['website', 'repair'], 'free');
    expect(report!.chapters).toHaveLength(1);
    expect(report!.locked_chapters).toHaveLength(0);
  });

  it('returns null when no permitted chapter has an audit (route → 404)', async () => {
    mockCampaignFindMany.mockResolvedValue(SIBLINGS);
    mockAuditFindMany.mockResolvedValue([]);
    const report = await prospectReportService.assembleReport('bp_raja', ['website'], 'free');
    expect(report).toBeNull();
  });

  it('returns null for an unknown prospect (no campaigns)', async () => {
    mockCampaignFindMany.mockResolvedValue([]);
    const report = await prospectReportService.assembleReport('bp_nope', ['website'], 'free');
    expect(report).toBeNull();
  });

  it('falls back to contact CTA when no live claim token exists', async () => {
    mockCampaignFindMany.mockResolvedValue(SIBLINGS);
    mockAuditFindMany.mockResolvedValue([AUDIT_ROW]);
    mockQueryRaw.mockResolvedValue([]);
    const report = await prospectReportService.assembleReport('bp_raja', ['website'], 'free');
    expect(report!.cta.kind).toBe('contact');
    expect(report!.cta.url).toBeNull();
  });
});

describe('short links (§5.2a)', () => {
  const MINT_INPUT = {
    prospectId: 'bp_raja',
    campaignId: 'cmp-web',
    token: 'payload.sig',
    tier: 'free' as const,
    chapters: ['website' as const],
    channel: 'email',
  };

  it('mints a 6-char code from the curated alphabet and writes the row', async () => {
    mockLinkFindFirst.mockResolvedValue(null);
    mockLinkCreate.mockResolvedValue({});
    const code = await prospectReportService.mintLinkCode(MINT_INPUT);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(mockLinkCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code,
          business_prospect_id: 'bp_raja',
          campaign_id: 'cmp-web',
          tier: 'free',
          channel: 'email',
        }),
      }),
    );
  });

  it('retries on a code collision', async () => {
    mockLinkFindFirst
      .mockResolvedValueOnce({ id: 'taken' })
      .mockResolvedValueOnce(null);
    mockLinkCreate.mockResolvedValue({});
    const code = await prospectReportService.mintLinkCode(MINT_INPUT);
    expect(code).toBeTruthy();
    expect(mockLinkFindFirst).toHaveBeenCalledTimes(2);
  });

  it('resolves a code to its token + channel, uppercase-normalized', async () => {
    mockLinkFindUnique.mockResolvedValue({
      token: 'payload.sig',
      business_prospect_id: 'bp_raja',
      campaign_id: 'cmp-web',
      tier: 'free',
      chapters: ['website'],
      channel: 'email',
    });
    const resolved = await prospectReportService.resolveLinkCode('abc123');
    expect(mockLinkFindUnique).toHaveBeenCalledWith({ where: { code: 'ABC123' } });
    expect(resolved!.token).toBe('payload.sig');
    expect(resolved!.channel).toBe('email');
  });

  it('returns null for an unknown code (revoked link)', async () => {
    mockLinkFindUnique.mockResolvedValue(null);
    expect(await prospectReportService.resolveLinkCode('ZZZZZZ')).toBeNull();
  });
});
