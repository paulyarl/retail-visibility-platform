/**
 * ProspectReportService — the owner-facing Business Visibility Report (L3).
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md
 * Sprint: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPRINT_PLAN.md
 *
 * Deterministic transform layer over diagnostic audits. Each sibling
 * campaign's audit → a *chapter* via the registered builder for its audit
 * source (CHAPTER_BUILDERS — keyed on mkt_audits_list.platform, never a
 * playbook code). Chapters assemble at the business_prospect_id level into
 * the prospect-keyed DTO (prospect-report-dto.schema.ts).
 *
 * Phase 2 surface (this file's current scope): the pure core —
 * verdict glosses, met/unmet split, internal-line stripping, severity
 * retitle, delivery-mode reframe, and buildWebsiteChapter. Assembly over
 * siblings, token mint/verify, and short-link mint/resolve land in Phase 3.
 *
 * Owner-safety contract (§2): detected_signals (internal WC_* taxonomy) are
 * redacted — they never reach the DTO. outreach_problems surface only as the
 * report-level `problems` annex: the owner-addressed framing (hook/regular
 * line + problem/solution/evidence) crosses; outreach_use and the unchosen
 * spoken line stay internal. Annex pairs prefer the owning sibling's
 * briefing executions (analyst-refined, archetype-scoped) over the chapter
 * audit's generic set — fallback keeps un-briefed chapters covered. No new
 * facts are generated; an audit section with no source rows is omitted,
 * never stubbed.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { BaseService } from './BaseService';
import { logger } from '../logger';
import { unifiedConfig } from '../config/unifiedConfig';
import type { RequestCtx } from '../context';
import { BusinessProspectService } from './BusinessProspectService';
import {
  generateProspectReportCode,
  generateProspectReportLinkId,
} from '../lib/id-generator';
import {
  websitePositioningAuditSchema,
  type WebsitePositioningAudit,
} from '../validators/website-positioning.schema';
import { businessAnalysisSchema } from '../validators/business-analysis.schema';
import {
  PROSPECT_REPORT_TIERS,
  PROSPECT_REPORT_CHAPTER_IDS,
  type ProspectReportDto,
  type ProspectReportTier,
  type ProspectReportChapterId,
  type ProspectReportChapterDto,
  type WebsiteChapterDto,
  type RepairChapterDto,
  type ReportProblemDto,
} from '../validators/prospect-report-dto.schema';

// ─── Chapter registry (§0.4 sprint contract) ──────────────────────────────

/** Display/context fields a chapter builder needs beyond the audit JSON. */
export interface ChapterContext {
  businessName: string;
  websiteUrl: string | null;
  category: string | null;
  /** Audit row created_at (ISO) — the report's "prepared" provenance. */
  auditedAt: string;
}

export interface ChapterBuildOpts {
  /** §2 — include the detailed must_have_pages plan (operator-gated). */
  includePagePlan?: boolean;
}

interface ChapterBuilder {
  /** mkt_audits_list.platform value this chapter builds from. */
  source: string;
  /** Owner-facing chapter title ("Your website today"). */
  title: string;
  /** Teaser title for the locked-card surface ("Your website"). */
  teaserTitle: string;
}

/**
 * Chapter id ↔ audit source ↔ display titles. Every chapter except
 * `website` is a filtered owner-safe extract of the same `business_analysis`
 * audit — the archetype extract decides which slice the sibling contributes.
 */
export const CHAPTER_BUILDERS: Record<ProspectReportChapterId, ChapterBuilder> = {
  website: {
    source: 'website_positioning',
    title: 'Your website today',
    teaserTitle: 'Your website',
  },
  // A5 multi-signal / PB-05 — the full-footprint chapter.
  repair: {
    source: 'business_analysis',
    title: 'Your online listings',
    teaserTitle: 'Your public profiles',
  },
  // A3 listing drift (PB-01 profile repair / PB-06 visual refresh) — NAP
  // consistency, displayed-name/address/phone drift, unclaimed profiles.
  drift: {
    source: 'business_analysis',
    title: 'Your business details across listings',
    teaserTitle: 'Listing consistency',
  },
  // A4 CTA gap (PB-03) — the website's next-step options.
  cta: {
    source: 'business_analysis',
    title: 'Your website\u2019s next step',
    teaserTitle: 'Calls to action',
  },
  // A1 review gap (PB-02) — volume, ratings, response cadence.
  reviews: {
    source: 'business_analysis',
    title: 'Your customer reviews',
    teaserTitle: 'Reviews',
  },
  // A2 negative recovery (PB-04) — unanswered negative reviews.
  recovery: {
    source: 'business_analysis',
    title: 'Unanswered negative reviews',
    teaserTitle: 'Review recovery',
  },
  // A6 product visibility (PB-07) — browsable shelves, pickup, photos.
  products: {
    source: 'business_analysis',
    title: 'Your products online',
    teaserTitle: 'Product visibility',
  },
};

/**
 * Declared archetype (from the sibling's operator-accepted triage result) →
 * the chapter that sibling contributes. A sibling with no accepted triage
 * declares nothing; `repair`/`website` then fall back to the campaign that
 * owns the audit row (legacy campaigns report without a declared route).
 */
export const ARCHETYPE_CHAPTERS: Record<string, ProspectReportChapterId> = {
  A1: 'reviews',
  A2: 'recovery',
  A3: 'drift',
  A4: 'cta',
  A5: 'repair',
  A6: 'products',
  A7: 'website',
};

// ─── Archetype briefing plumbing ──────────────────────────────────────────
//
// A routed sibling's briefing is the operator-facing twin of its report
// chapter: a `profile_repair_audit`-shaped seek execution whose prompt is
// fed the SAME deterministic fact slice the chapter renders (plus the
// internal ammunition the owner never sees). The analyst composes the
// narrative; the extract guarantees the briefing can never disagree with
// the owner-facing report. A5/A7 keep their own briefing lanes (triage +
// website positioning audit) — this covers the archetypes that have no
// dedicated diagnostic.

/** Template id → archetype binding for the per-archetype briefing seeks. */
export const ARCHETYPE_BRIEFING_TEMPLATES: Record<
  string,
  { archetype: string; issueType: string; label: string }
> = {
  'mpt-archetype-briefing-a1': {
    archetype: 'A1',
    issueType: 'review_gap',
    label: 'Review Gap & Acceleration',
  },
  'mpt-archetype-briefing-a2': {
    archetype: 'A2',
    issueType: 'negative_recovery',
    label: 'Negative Review Recovery',
  },
  'mpt-archetype-briefing-a3': {
    archetype: 'A3',
    issueType: 'listing_drift',
    label: 'Listing Drift & Visual Refresh',
  },
  'mpt-archetype-briefing-a4': {
    archetype: 'A4',
    issueType: 'cta_gap',
    label: 'CTA & Friction Gap',
  },
  'mpt-archetype-briefing-a6': {
    archetype: 'A6',
    issueType: 'product_visibility',
    label: 'Product Visibility',
  },
};

/**
 * The deterministic fact slice an archetype briefing prompt is grounded in —
 * the same fields its report chapter renders, plus the internal layer the
 * owner-facing DTO redacts (detected_signals, outreach_problems,
 * alignment_scoring). Unparsed on purpose: this is prompt input, not a DTO —
 * schema validation happens in the builders.
 */
export function archetypeFactSlice(
  archetype: string,
  auditData: unknown,
): Record<string, unknown> {
  const audit = (auditData ?? {}) as any;
  const internal = {
    detected_signals: audit.detected_signals ?? [],
    outreach_problems: audit.outreach_problems ?? [],
    alignment_scoring: audit.alignment_scoring ?? null,
  };
  const gapRows = (pattern: RegExp) => gapsMatching(audit, pattern);

  switch (archetype) {
    case 'A1':
      return {
        combined_review_metrics: audit.combined_review_metrics ?? null,
        platform_reviews: Object.fromEntries(
          platformEntriesOf(audit).map(([k, p]) => [
            k,
            {
              rating: p.rating ?? null,
              total_reviews: p.total_reviews ?? null,
              reviews_with_observable_response:
                p.reviews_with_observable_response ?? null,
              observable_unanswered_reviews:
                p.observable_unanswered_reviews ?? null,
            },
          ]),
        ),
        gap_rows: gapRows(/review|rating|response/i),
        ...internal,
      };
    case 'A2':
      return {
        unanswered_negative_review_examples:
          audit.unanswered_negative_review_examples ?? [],
        negative_review_themes: audit.negative_review_themes ?? [],
        unanswered_negative_reviews:
          audit.combined_review_metrics
            ?.observable_unanswered_negative_reviews ?? null,
        gap_rows: gapRows(/negative|review|rating|response/i),
        ...internal,
      };
    case 'A3':
      return {
        nap_consistency: audit.nap_consistency ?? null,
        platform_statuses: Object.fromEntries(
          platformEntriesOf(audit).map(([k, p]) => [k, p.profile_status]),
        ),
        google_displayed: audit.platforms?.google
          ? {
              displayed_name: audit.platforms.google.displayed_name ?? null,
              displayed_address:
                audit.platforms.google.displayed_address ?? null,
              displayed_phone: audit.platforms.google.displayed_phone ?? null,
              primary_category: audit.platforms.google.primary_category ?? null,
            }
          : null,
        gap_rows: gapRows(/name|address|phone|nap|hours?|photo|image|attribute/i),
        ...internal,
      };
    case 'A4':
      return {
        website_cta: {
          url: audit.website?.url ?? null,
          status: audit.website?.status ?? null,
          call_to_action_present: audit.website?.call_to_action_present ?? null,
          click_to_call_available: audit.website?.click_to_call_available ?? null,
          contact_information_visible:
            audit.website?.contact_information_visible ?? null,
          ordering_or_pickup_info_present:
            audit.website?.ordering_or_pickup_info_present ?? null,
          has_pickup_ordering: audit.website?.has_pickup_ordering ?? null,
          has_delivery_option: audit.website?.has_delivery_option ?? null,
          has_availability_inquiry:
            audit.website?.has_availability_inquiry ?? null,
          conversion_opportunities:
            audit.website?.conversion_opportunities ?? [],
          issues: audit.website?.issues ?? [],
        },
        gap_rows: gapRows(/cta|call|contact|order|pickup|delivery|inquiry|booking|conversion/i),
        ...internal,
      };
    case 'A6':
      return {
        business_type: audit.business_type ?? null,
        product_visibility: {
          has_product_browsing: audit.website?.has_product_browsing ?? null,
          product_categories_visible:
            audit.website?.product_categories_visible ?? [],
          has_pickup_ordering: audit.website?.has_pickup_ordering ?? null,
          has_delivery_option: audit.website?.has_delivery_option ?? null,
          ordering_or_pickup_info_present:
            audit.website?.ordering_or_pickup_info_present ?? null,
        },
        google_photos: audit.platforms?.google
          ? {
              photo_count: audit.platforms.google.photo_count ?? null,
              photo_types: audit.platforms.google.photo_types ?? [],
            }
          : null,
        gap_rows: gapRows(/product|photo|catalog|browse|pickup|delivery|availability|categor/i),
        ...internal,
      };
    default:
      return internal;
  }
}

// ─── §3.2 Verdict glosses (presence × ownership — all 21 cells + fallback) ──

const VERDICT_GLOSSES: Record<string, string> = {
  'present:owned_domain':
    'You have a working website on your own domain — the foundation is solid.',
  'present:platform_hosted':
    'Your website is live, but it sits on a hosted platform rather than a domain you own.',
  'present:none':
    "A website for your business is live, but it isn't on a domain you own.",

  'third_party_only:owned_domain':
    "You own a domain, but customers looking for your website land on a page on someone else's platform.",
  'third_party_only:platform_hosted':
    "Customers looking for your website find a page on someone else's platform.",
  'third_party_only:none':
    "Customers looking for your website find a page on someone else's platform.",

  'builder_subdomain:owned_domain':
    'You own a domain, but your website lives on a free builder subdomain instead of on it.',
  'builder_subdomain:platform_hosted':
    'Your website lives on a free builder subdomain, not a domain you own.',
  'builder_subdomain:none':
    'Your website lives on a free builder subdomain, not a domain you own.',

  'parked:owned_domain':
    'You own a domain, but it shows a parked page — no business content is on it.',
  'parked:platform_hosted':
    'Your website address shows a parked page — no business content is on it.',
  'parked:none':
    'Your website address shows a parked page — no business content is on it.',

  'unfinished:owned_domain':
    'You own a domain, but the website on it was never finished — visitors land on a half-built page.',
  'unfinished:platform_hosted':
    'Your website was started but never finished — visitors land on a half-built page.',
  'unfinished:none':
    'Your website was started but never finished — visitors land on a half-built page.',

  'broken:owned_domain':
    'You own a domain, but the website on it fails to load — visitors hit an error.',
  'broken:platform_hosted':
    'Your website address fails to load — visitors hit an error.',
  'broken:none':
    'Your website address fails to load — visitors hit an error.',

  'no_presence:owned_domain':
    'You own a domain, but we could not find a live website on it.',
  'no_presence:platform_hosted':
    'We could not find a website for your business.',
  'no_presence:none':
    'We could not find a website for your business.',
};

const VERDICT_FALLBACK = 'We reviewed your web presence — details below.';

// ─── §4 Delivery-mode reframe ─────────────────────────────────────────────
//
// build_scope.recommended is diagnostic; the platform only delivers managed
// replacement. The owner-facing noun is always "the new site" — the platform
// never sells WordPress repair.

function fixHeadline(recommended: string, category: string | null): string {
  const how = category
    ? `how ${category.toLowerCase()} customers actually shop`
    : 'how your customers actually shop';
  if (recommended === 'repair' || recommended === 'secure_and_refresh') {
    return 'A fresh site that keeps everything already working — ordering, categories, your domain — and fixes what this report found.';
  }
  return `A new site built for ${how}.`;
}

// ─── §3.3 Met/unmet split ─────────────────────────────────────────────────
//
// A positioning_gaps row is MET when `actual` satisfies `expected`:
//   - actual === true (boolean expectation)
//   - string-equal (trimmed, case-insensitive)
//   - array set-equal (order-insensitive, normalized)
//   - number strictly equal
// Anything else — including a type mismatch — is unmet.

function normalizeScalar(v: unknown): string {
  return String(v).trim().toLowerCase();
}

export function gapIsMet(expected: unknown, actual: unknown): boolean {
  if (actual === true) return true;
  if (expected == null || actual == null) return false;

  if (Array.isArray(expected) || Array.isArray(actual)) {
    if (!Array.isArray(expected) || !Array.isArray(actual)) return false;
    if (expected.length !== actual.length) return false;
    const e = expected.map(normalizeScalar).sort();
    const a = actual.map(normalizeScalar).sort();
    return e.every((v, i) => v === a[i]);
  }

  if (typeof expected === 'number' || typeof actual === 'number') {
    return typeof expected === 'number' && typeof actual === 'number' && expected === actual;
  }

  if (typeof expected === 'string' && typeof actual === 'string') {
    return normalizeScalar(expected) === normalizeScalar(actual);
  }

  return false;
}

// ─── §3.4 Internal-line stripping ─────────────────────────────────────────
//
// verified_fields lines carrying lane plumbing never render: EVIDENCE
// COVERAGE banners, DISCOVERY provenance lines, prior_website_findings
// sourcing mechanics, unable_to_verify mechanics.

const INTERNAL_LINE_PATTERN =
  /^(EVIDENCE COVERAGE|DISCOVERY)\b|prior_website_findings|unable_to_verify/i;

export function isInternalLine(line: string): boolean {
  return INTERNAL_LINE_PATTERN.test(line);
}

// ─── Humanizers ───────────────────────────────────────────────────────────

function humanizeField(field: string): string {
  const spaced = field.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ─── business_analysis shared extracts ───────────────────────────────────
//
// The BA audit is one document read five ways — the archetype extractors
// below all pull from these shared helpers so the owner-facing vocabulary
// stays consistent across chapters.

const PRESENT_STATUSES = new Set([
  'claimed',
  'likely_claimed',
  'unclaimed',
  'likely_unclaimed',
]);

function platformLabel(key: string): string {
  return key === 'google'
    ? 'Google Business Profile'
    : key === 'yelp'
      ? 'Yelp'
      : key === 'facebook'
        ? 'Facebook'
        : humanizeField(key);
}

function platformEntriesOf(audit: {
  platforms?: Record<string, unknown> | null;
}): [string, any][] {
  return Object.entries(audit.platforms ?? {}).filter(
    ([, p]: [string, any]) => p && typeof p === 'object' && p.profile_status,
  ) as [string, any][];
}

function isPresentPlatform(p: any): boolean {
  return PRESENT_STATUSES.has(p.profile_status);
}

function isClaimedPlatform(p: any): boolean {
  return (
    p.profile_status === 'claimed' || p.profile_status === 'likely_claimed'
  );
}

function isUnclaimedPlatform(p: any): boolean {
  return (
    p.profile_status === 'unclaimed' ||
    p.profile_status === 'likely_unclaimed'
  );
}

/** Competitive benchmarks rendered as exemplar lines (shared by BA chapters). */
function competitiveFrameLines(audit: {
  competitive_benchmarks?: any[] | null;
}): string[] {
  return (audit.competitive_benchmarks ?? []).map((b) => {
    const rating =
      b.google_rating != null && b.google_review_count != null
        ? ` — ${b.google_rating}★ across ${b.google_review_count} Google reviews`
        : '';
    const format = b.store_format ? `, ${humanizeField(b.store_format)}` : '';
    return `${b.business_name}${format}${rating}`;
  });
}

/**
 * gap_analysis rows filtered to the field names an archetype owns. The gap
 * rows are already expected-vs-actual by definition; the filter scopes the
 * chapter to its slice of the diagnostic.
 */
function gapsMatching(
  audit: { gap_analysis?: { gaps?: any[] | null } | null },
  pattern: RegExp,
): any[] {
  return (audit.gap_analysis?.gaps ?? []).filter((g) =>
    pattern.test(`${g.platform ?? ''} ${g.field ?? ''}`),
  );
}

function gapToExpectation(gap: any): {
  field: string;
  expected_text: string;
  actual_text: string;
  note: string | null;
} {
  return {
    field: gap.platform
      ? `${platformLabel(gap.platform)} — ${humanizeField(gap.field)}`
      : humanizeField(gap.field),
    expected_text: formatValue(gap.expected),
    actual_text: formatValue(gap.actual),
    note: gap.gap_description ?? null,
  };
}

function formatValue(v: unknown): string {
  if (v === true) return 'present';
  if (v === false) return 'missing';
  if (v == null) return 'not found';
  if (Array.isArray(v)) return v.map(String).join(', ');
  return String(v);
}

// ─── §2 annex — outreach problems in owner-facing framing ────────────────
//
// The audit's outreach_problems each carry two spoken lines (regular/hook —
// the same problem framed differently), so exactly one crosses the report
// boundary: `line` prefers the hook (the attention framing), falling back to
// regular. `outreach_use` (deployment tactics) and the unchosen line never
// emit. The input audit was already schema-validated by the chapter builder
// — this is a field pick, not a re-parse.

function ownerFacingProblems(auditData: unknown): ReportProblemDto[] {
  return mapOutreachProblems((auditData as any)?.outreach_problems);
}

function mapOutreachProblems(raw: unknown): ReportProblemDto[] {
  if (!Array.isArray(raw)) return [];
  const out: ReportProblemDto[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const problem = typeof entry.problem === 'string' ? entry.problem : '';
    const line =
      (typeof entry.hook === 'string' && entry.hook) ||
      (typeof entry.regular === 'string' && entry.regular) ||
      null;
    if (!problem && !line) continue;
    out.push({
      problem: problem || (line as string),
      line,
      solution: typeof entry.solution === 'string' ? entry.solution : null,
      evidence: typeof entry.evidence === 'string' ? entry.evidence : null,
    });
  }
  return out;
}

// Briefing executions (archetype briefings, per-issue repair seeks, triage)
// store their output in raw_output as a JSON document — usually wrapped in
// a profile_repair_audit / profile_repair_triage envelope and possibly
// markdown fences (same parse RepairBriefingCard does client-side).
// A bare-object fallback keeps the parse tolerant; malformed/unfinished
// outputs simply yield no pairs and the audit fallback applies.
function briefingProblemsFromRaw(rawOutput: unknown): ReportProblemDto[] {
  if (typeof rawOutput !== 'string' || !rawOutput.trim()) return [];
  try {
    const cleaned = rawOutput
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    return mapOutreachProblems(
      parsed?.profile_repair_audit?.outreach_problems ??
        parsed?.profile_repair_triage?.outreach_problems ??
        parsed?.outreach_problems,
    );
  } catch {
    return [];
  }
}

// ─── Service ──────────────────────────────────────────────────────────────

class ProspectReportService extends BaseService {
  private static instance: ProspectReportService;

  private constructor() {
    super();
  }

  public static getInstance(): ProspectReportService {
    if (!ProspectReportService.instance) {
      ProspectReportService.instance = new ProspectReportService();
    }
    return ProspectReportService.instance;
  }

  /**
   * L1 → L3 pure transform: a `website_positioning` audit becomes the owner
   * report's website chapter. Every emitted sentence traces to a schema
   * field — nothing is generated (§3.5 zero-fact guarantee).
   */
  buildWebsiteChapter(
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts = {},
  ): WebsiteChapterDto {
    const audit: WebsitePositioningAudit =
      websitePositioningAuditSchema.parse(auditData);

    const verdict =
      VERDICT_GLOSSES[`${audit.presence_classification}:${audit.ownership}`] ??
      VERDICT_FALLBACK;

    // §3.3 — met rows lead ("already working"); unmet rows become
    // expected-vs-actual expectation cards.
    const alreadyWorking: string[] = [];
    const expectations: WebsiteChapterDto['expectations'] = [];
    for (const gap of audit.positioning_gaps ?? []) {
      if (gapIsMet(gap.expected, gap.actual)) {
        alreadyWorking.push(
          gap.gap_description ?? `${humanizeField(gap.field)} is in place.`,
        );
      } else {
        expectations.push({
          field: humanizeField(gap.field),
          expected_text: formatValue(gap.expected),
          actual_text: formatValue(gap.actual),
          note: gap.gap_description ?? null,
        });
      }
    }

    // §3.1 — non_negotiable first, vocabulary retitled out of internal terms.
    const costingCustomers = (audit.issues ?? [])
      .map((i) => ({
        headline: i.issue,
        cost: i.conversion_implication ?? null,
        evidence: i.evidence ?? null,
        tier: (i.severity === 'non_negotiable' ? 'now' : 'worth_fixing') as
          | 'now'
          | 'worth_fixing',
      }))
      .sort((a, b) =>
        a.tier === b.tier ? 0 : a.tier === 'now' ? -1 : 1,
      );

    const chapter: WebsiteChapterDto = {
      chapter_id: 'website',
      title: CHAPTER_BUILDERS.website!.title,
      audited_at: ctx.auditedAt,
      category: ctx.category,
      summary: audit.summary ?? null,
      verdict,
      already_working: alreadyWorking,
      costing_customers: costingCustomers,
      expectations,
      competitive_frame: audit.competitive_frame ?? [],
      fix: {
        headline: fixHeadline(audit.build_scope?.recommended ?? 'rebuild', ctx.category),
        scope_notes: audit.build_scope?.scope_notes ?? null,
        page_plan: opts.includePagePlan
          ? audit.build_scope?.must_have_pages ?? []
          : null,
      },
    };

    logger.info('ProspectReportService.buildWebsiteChapter', undefined, {
      businessName: ctx.businessName,
      issues: costingCustomers.length,
      expectations: expectations.length,
      alreadyWorking: alreadyWorking.length,
      includePagePlan: !!opts.includePagePlan,
    });

    return chapter;
  }

  /**
   * Dispatch — route an audit row to the builder for its chapter. Every
   * BA-sourced chapter parses the same audit; the extractor scopes it.
   */
  private buildChapter(
    chapterId: ProspectReportChapterId,
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts,
  ): ProspectReportChapterDto {
    switch (chapterId) {
      case 'website':
        return this.buildWebsiteChapter(auditData, ctx, opts);
      case 'repair':
        return this.buildRepairChapter(auditData, ctx, opts);
      case 'drift':
        return this.buildDriftChapter(auditData, ctx, opts);
      case 'cta':
        return this.buildCtaChapter(auditData, ctx, opts);
      case 'reviews':
        return this.buildReviewsChapter(auditData, ctx, opts);
      case 'recovery':
        return this.buildRecoveryChapter(auditData, ctx, opts);
      case 'products':
        return this.buildProductsChapter(auditData, ctx, opts);
    }
  }

  /**
   * L1 → L3 transform for the `business_analysis` audit (the A5 / PB-05
   * repair track) — the "Your online listings" chapter.
   *
   * Owner-safety: detected_signals, alignment_scoring, recommended_tier
   * label, estimated_monthly_service_fee, digital_opportunity_score,
   * high_attention, render_controls, and sources never reach the DTO — the
   * platform's internal sales/scoring machinery stays internal.
   * outreach_problems surface only as the report-level `problems` annex
   * (sourced per visible chapter from the owning sibling's briefing
   * executions, audit pairs as fallback — never emitted per chapter).
   */
  buildRepairChapter(
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts = {},
  ): RepairChapterDto {
    const audit = businessAnalysisSchema.parse(auditData);

    // Verdict — identity confirmation × listing coverage.
    const platformEntries = platformEntriesOf(audit);
    const found = platformEntries.filter(([, p]) => isPresentPlatform(p));
    const unverifiedCount = platformEntries.length - found.length;

    const identityLine =
      audit.audit_metadata?.identity_status === 'confirmed'
        ? `We confirmed this business is ${ctx.businessName} across public sources.`
        : audit.audit_metadata?.identity_status === 'ambiguous'
          ? 'We found this business, though some public sources disagree on the details.'
          : audit.audit_metadata?.identity_status === 'mismatched'
            ? "We found listings that appear to be this business, but the details don't all match."
            : 'We reviewed the public listings for this business.';
    const coverageLine =
      found.length > 0
        ? `We found your business on ${found.length} major listing platform${found.length === 1 ? '' : 's'}${unverifiedCount > 0 ? ` (${unverifiedCount} more we could not verify)` : ''}.`
        : 'We could not confirm your business on the major listing platforms.';
    const verdict = `${identityLine} ${coverageLine}`;

    // Already working — claimed profiles, consistent NAP, reachable site,
    // answered reviews.
    const alreadyWorking: string[] = [];
    for (const [key, p] of platformEntries) {
      if (isClaimedPlatform(p)) {
        const metric =
          p.rating != null && p.total_reviews != null
            ? ` — ${p.rating}★ across ${p.total_reviews} reviews`
            : p.total_reviews != null
              ? ` — ${p.total_reviews} reviews`
              : '';
        alreadyWorking.push(
          `Your ${platformLabel(key)} listing is claimed${metric}.`,
        );
      }
    }
    if (audit.nap_consistency?.overall_status === 'consistent') {
      alreadyWorking.push(
        'Your name, address, and phone are consistent across the listings we checked.',
      );
    }
    if (audit.website?.status === 'working') {
      alreadyWorking.push('Your website loads and is reachable.');
    }
    const metrics = audit.combined_review_metrics;
    if ((metrics?.observable_reviews_with_response ?? 0) > 0) {
      alreadyWorking.push(
        "You've replied to some of your reviews — customers can see you answer.",
      );
    }

    // What's costing you customers — 'now' for high-severity gaps,
    // 'worth_fixing' for the rest. Headlines are owner-facing; internal
    // vocab (tier, score, signals) stays out.
    const costing: RepairChapterDto['costing_customers'] = [];
    for (const [key, p] of platformEntries) {
      const label = platformLabel(key);
      if (isUnclaimedPlatform(p)) {
        costing.push({
          headline: `Your ${label} listing is unclaimed`,
          cost:
            key === 'google'
              ? 'Anyone can suggest edits to your hours, phone, or address — and customers see a business nobody is managing.'
              : 'Customers see a profile nobody is managing — and anyone can suggest edits.',
          evidence: p.profile_url ?? null,
          tier: key === 'google' ? 'now' : 'worth_fixing',
        });
      }
    }
    if (audit.website?.status === 'broken') {
      costing.push({
        headline: 'Your website fails to load',
        cost: 'Customers who click through hit an error and go elsewhere.',
        evidence: audit.website.url ?? null,
        tier: 'now',
      });
    } else if (audit.website?.status === 'none_found') {
      costing.push({
        headline: 'We could not find a website for your business',
        cost: 'Customers who want to check your products or hours before visiting have nowhere to look.',
        evidence: null,
        tier: 'now',
      });
    } else if (audit.website?.status === 'social_media_only') {
      costing.push({
        headline: 'Your only web presence is a social-media page',
        cost: 'Customers looking for hours, products, or ordering hit a page that was never built for that.',
        evidence: audit.website.url ?? null,
        tier: 'worth_fixing',
      });
    }
    if ((metrics?.observable_unanswered_negative_reviews ?? 0) > 0) {
      costing.push({
        headline: `${metrics!.observable_unanswered_negative_reviews} negative review${metrics!.observable_unanswered_negative_reviews === 1 ? '' : 's'} with no public reply`,
        cost: 'A shopper reading those reviews sees silence — one answered complaint is worth more than five stars.',
        evidence: null,
        tier: 'now',
      });
    }
    if (audit.nap_consistency?.overall_status === 'major_inconsistencies') {
      costing.push({
        headline: 'Your name, address, or phone differ across listings',
        cost: 'Customers (and Google) see conflicting facts — calls and visits can go to the wrong place.',
        evidence: (audit.nap_consistency.material_issues ?? []).join('; ') || null,
        tier: 'now',
      });
    } else if (audit.nap_consistency?.overall_status === 'minor_variations') {
      costing.push({
        headline: 'Small differences in your name, address, or phone across listings',
        cost: 'Minor drift still confuses search — and some customers.',
        evidence: (audit.nap_consistency.material_issues ?? []).join('; ') || null,
        tier: 'worth_fixing',
      });
    }
    if (
      (metrics?.observable_unanswered_reviews ?? 0) > 0 &&
      !(metrics?.observable_unanswered_negative_reviews ?? 0)
    ) {
      costing.push({
        headline: `${metrics!.observable_unanswered_reviews} review${metrics!.observable_unanswered_reviews === 1 ? '' : 's'} with no public reply`,
        cost: 'Unanswered reviews — even positive ones — read as a business that isn\u2019t paying attention.',
        evidence: null,
        tier: 'worth_fixing',
      });
    }
    for (const issue of audit.website?.issues ?? []) {
      costing.push({ headline: issue, cost: null, evidence: null, tier: 'worth_fixing' });
    }
    costing.sort((a, b) =>
      a.tier === b.tier ? 0 : a.tier === 'now' ? -1 : 1,
    );

    // Expectations — every gap_analysis row is an expected-vs-actual miss by
    // definition (the gold-standard comparison is the audit's job).
    const expectations: RepairChapterDto['expectations'] = (
      audit.gap_analysis?.gaps ?? []
    ).map(gapToExpectation);

    // Competitive frame — benchmark businesses as exemplar lines.
    const competitiveFrame = competitiveFrameLines(audit);

    const chapter: RepairChapterDto = {
      chapter_id: 'repair',
      title: CHAPTER_BUILDERS.repair!.title,
      audited_at: ctx.auditedAt,
      category: ctx.category,
      summary: audit.summary ?? null,
      verdict,
      already_working: alreadyWorking,
      costing_customers: costing,
      expectations,
      competitive_frame: competitiveFrame,
      fix: {
        headline:
          'A cleanup of your public listings — claimed, consistent, and every review answered.',
        scope_notes: audit.tier_rationale ?? null,
        page_plan: opts.includePagePlan
          ? (audit.recommended_services ?? [])
          : null,
      },
    };

    logger.info('ProspectReportService.buildRepairChapter', undefined, {
      businessName: ctx.businessName,
      issues: costing.length,
      expectations: expectations.length,
      alreadyWorking: alreadyWorking.length,
      includePagePlan: !!opts.includePagePlan,
    });

    return chapter;
  }

  /**
   * Shared envelope for the BA-sourced archetype chapters — the extractor
   * supplies verdict/working/costing/expectations; this fills the common
   * owner-safe fields. Summary stays null: the verdict IS the lead, and a
   * chapter shouldn't repeat the audit's one top-level summary five times.
   */
  private baChapter(
    chapterId: ProspectReportChapterId,
    ctx: ChapterContext,
    opts: ChapterBuildOpts,
    audit: { summary?: string | null; tier_rationale?: string | null; recommended_services?: string[] },
    parts: {
      verdict: string;
      alreadyWorking: string[];
      costing: RepairChapterDto['costing_customers'];
      expectations: RepairChapterDto['expectations'];
      competitiveFrame: string[];
      fixHeadline: string;
    },
  ): RepairChapterDto {
    parts.costing.sort((a, b) =>
      a.tier === b.tier ? 0 : a.tier === 'now' ? -1 : 1,
    );
    return {
      chapter_id: chapterId,
      title: CHAPTER_BUILDERS[chapterId].title,
      audited_at: ctx.auditedAt,
      category: ctx.category,
      summary: null,
      verdict: parts.verdict,
      already_working: parts.alreadyWorking,
      costing_customers: parts.costing,
      expectations: parts.expectations,
      competitive_frame: parts.competitiveFrame,
      fix: {
        headline: parts.fixHeadline,
        scope_notes: audit.tier_rationale ?? null,
        page_plan: opts.includePagePlan
          ? (audit.recommended_services ?? [])
          : null,
      },
    };
  }

  /**
   * A3 listing drift (PB-01 / PB-06) — "Your business details across
   * listings": NAP consistency, displayed-name/address/phone drift, and the
   * unclaimed profiles where anyone can edit the details.
   */
  buildDriftChapter(
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts = {},
  ): RepairChapterDto {
    const audit = businessAnalysisSchema.parse(auditData);
    const nap = audit.nap_consistency;
    const platformEntries = platformEntriesOf(audit);

    const verdict =
      nap?.overall_status === 'consistent'
        ? 'Your business name, address, and phone agree everywhere we could check.'
        : nap?.overall_status === 'minor_variations'
          ? 'Your name, address, and phone mostly agree across listings — with small differences that add up.'
          : nap?.overall_status === 'major_inconsistencies'
            ? 'Your name, address, or phone disagree across listings — customers can end up at the wrong place.'
            : 'We could not fully verify how consistently your business details appear across listings.';

    const alreadyWorking: string[] = [];
    if (nap?.overall_status === 'consistent') {
      alreadyWorking.push(
        'Your name, address, and phone are consistent across the listings we checked.',
      );
    }
    const canonical = [
      nap?.canonical_name,
      nap?.canonical_address,
      [nap?.canonical_city, nap?.canonical_state, nap?.canonical_zip]
        .filter(Boolean)
        .join(' '),
      nap?.canonical_phone,
    ].filter(Boolean);
    if (canonical.length > 0) {
      alreadyWorking.push(
        `The details your listings should all carry: ${canonical.join(' — ')}.`,
      );
    }
    for (const [key, p] of platformEntries) {
      if (isClaimedPlatform(p)) {
        alreadyWorking.push(
          `Your ${platformLabel(key)} listing is claimed — nobody can edit its details but you.`,
        );
      }
    }

    const costing: RepairChapterDto['costing_customers'] = [];
    const variationCost = (
      label: string,
      values: string[] | undefined,
      tier: 'now' | 'worth_fixing',
      cost: string,
    ) => {
      if (!values?.length) return;
      costing.push({
        headline: `Your ${label} appears as ${values.length} different version${values.length === 1 ? '' : 's'}`,
        cost,
        evidence: values.join(' vs '),
        tier,
      });
    };
    variationCost(
      'business name',
      nap?.name_variations,
      nap?.overall_status === 'major_inconsistencies' ? 'now' : 'worth_fixing',
      'Search engines treat variants as different businesses — reviews and rankings get split.',
    );
    variationCost(
      'address',
      nap?.address_variations,
      nap?.overall_status === 'major_inconsistencies' ? 'now' : 'worth_fixing',
      'Customers following the wrong address never make it to your door.',
    );
    variationCost(
      'phone number',
      nap?.phone_variations,
      nap?.overall_status === 'major_inconsistencies' ? 'now' : 'worth_fixing',
      'Calls to the wrong number are customers you never hear about.',
    );
    for (const issue of nap?.material_issues ?? []) {
      costing.push({ headline: issue, cost: null, evidence: null, tier: 'now' });
    }
    for (const [key, p] of platformEntries) {
      if (isUnclaimedPlatform(p)) {
        costing.push({
          headline: `Your ${platformLabel(key)} listing is unclaimed`,
          cost: 'Unclaimed profiles accept edits from anyone — drift starts here.',
          evidence: p.profile_url ?? null,
          tier: 'worth_fixing',
        });
      }
    }

    const expectations = gapsMatching(
      audit,
      /name|address|phone|nap|hours?|photo|image|attribute/i,
    ).map(gapToExpectation);

    return this.baChapter('drift', ctx, opts, audit, {
      verdict,
      alreadyWorking,
      costing,
      expectations,
      competitiveFrame: competitiveFrameLines(audit),
      fixHeadline:
        'One consistent identity everywhere — the same name, address, phone, and hours on every listing.',
    });
  }

  /**
   * A4 CTA gap (PB-03) — "Your website's next step": whether a visitor can
   * do something — call, order, get directions — or just bounce.
   */
  buildCtaChapter(
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts = {},
  ): RepairChapterDto {
    const audit = businessAnalysisSchema.parse(auditData);
    const site = audit.website ?? {};

    const flags: { key: keyof typeof site; label: string; missing: string }[] = [
      {
        key: 'call_to_action_present',
        label: 'a clear call to action',
        missing: 'Your site has no clear call to action',
      },
      {
        key: 'click_to_call_available',
        label: 'click-to-call',
        missing: 'Your phone number isn\u2019t tap-to-call on the site',
      },
      {
        key: 'contact_information_visible',
        label: 'visible contact information',
        missing: 'Your contact information isn\u2019t visible on the site',
      },
      {
        key: 'ordering_or_pickup_info_present',
        label: 'ordering or pickup information',
        missing: 'Customers can\u2019t tell how to order or pick up',
      },
      {
        key: 'has_pickup_ordering',
        label: 'pickup ordering',
        missing: 'No way to order for pickup online',
      },
      {
        key: 'has_delivery_option',
        label: 'a delivery option',
        missing: 'No delivery option on the site',
      },
      {
        key: 'has_availability_inquiry',
        label: 'an availability inquiry',
        missing: 'Customers can\u2019t ask whether something is in stock',
      },
    ];
    const present = flags.filter((f) => site[f.key] === true);
    const missing = flags.filter((f) => site[f.key] === false);

    const verdict =
      site.status === 'none_found' || site.status === 'broken'
        ? 'Without a working site, every visit ends before it starts — there is no next step.'
        : missing.length === 0 && present.length > 0
          ? 'Your site gives visitors a clear next step — call, order, or visit.'
          : `Your site ${present.length > 0 ? `has ${present[0].label} but` : 'gives visitors'} ${missing.length > 0 ? 'missing ways to take the next step.' : 'no obvious next step.'}`;

    const alreadyWorking = present.map(
      (f) => `Your site offers ${f.label}.`,
    );

    const costing: RepairChapterDto['costing_customers'] = missing.map((f) => ({
      headline: f.missing,
      cost: 'A visitor who can\u2019t act leaves — the next search result is one tap away.',
      evidence: site.url ?? null,
      tier:
        f.key === 'call_to_action_present' ||
        f.key === 'click_to_call_available' ||
        f.key === 'contact_information_visible'
          ? 'now'
          : 'worth_fixing',
    }));
    for (const opportunity of site.conversion_opportunities ?? []) {
      costing.push({
        headline: opportunity,
        cost: null,
        evidence: null,
        tier: 'worth_fixing',
      });
    }

    const expectations = gapsMatching(
      audit,
      /cta|call|contact|order|pickup|delivery|inquiry|booking|conversion/i,
    ).map(gapToExpectation);

    return this.baChapter('cta', ctx, opts, audit, {
      verdict,
      alreadyWorking,
      costing,
      expectations,
      competitiveFrame: [],
      fixHeadline:
        'Every page gets one obvious next step — call, order, or get directions.',
    });
  }

  /**
   * A1 review gap (PB-02) — "Your customer reviews": volume, ratings, and
   * whether reviews get a public reply.
   */
  buildReviewsChapter(
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts = {},
  ): RepairChapterDto {
    const audit = businessAnalysisSchema.parse(auditData);
    const metrics = audit.combined_review_metrics;
    const platformEntries = platformEntriesOf(audit);

    const rated = platformEntries.filter(
      ([, p]) => p.rating != null && p.total_reviews != null,
    );
    const totalReviews = metrics?.observable_total_reviews ??
      rated.reduce((sum, [, p]) => sum + (p.total_reviews ?? 0), 0);
    const weighted = rated.reduce((sum, [, p]) => sum + p.rating * p.total_reviews, 0);
    const ratedCount = rated.reduce((sum, [, p]) => sum + p.total_reviews, 0);
    const avg = ratedCount > 0 ? Math.round((weighted / ratedCount) * 10) / 10 : null;

    const verdict =
      totalReviews > 0
        ? `We found ${totalReviews} review${totalReviews === 1 ? '' : 's'} across your listings${avg != null ? ` averaging ${avg}★` : ''}.`
        : 'We could not find customer reviews on your listings.';

    const alreadyWorking: string[] = [];
    for (const [key, p] of platformEntries) {
      if (p.rating != null && p.total_reviews != null && p.rating >= 4) {
        alreadyWorking.push(
          `Your ${platformLabel(key)} rating is ${p.rating}★ across ${p.total_reviews} reviews.`,
        );
      }
    }
    if ((metrics?.observable_reviews_with_response ?? 0) > 0) {
      alreadyWorking.push(
        'You\u2019ve replied to some of your reviews — customers can see you answer.',
      );
    }

    const costing: RepairChapterDto['costing_customers'] = [];
    if ((metrics?.observable_unanswered_negative_reviews ?? 0) > 0) {
      costing.push({
        headline: `${metrics!.observable_unanswered_negative_reviews} negative review${metrics!.observable_unanswered_negative_reviews === 1 ? '' : 's'} with no public reply`,
        cost: 'A shopper reading those reviews sees silence — one answered complaint is worth more than five stars.',
        evidence: null,
        tier: 'now',
      });
    }
    if (
      (metrics?.observable_unanswered_reviews ?? 0) > 0 &&
      !(metrics?.observable_unanswered_negative_reviews ?? 0)
    ) {
      costing.push({
        headline: `${metrics!.observable_unanswered_reviews} review${metrics!.observable_unanswered_reviews === 1 ? '' : 's'} with no public reply`,
        cost: 'Unanswered reviews — even positive ones — read as a business that isn\u2019t paying attention.',
        evidence: null,
        tier: 'worth_fixing',
      });
    }
    for (const theme of audit.negative_review_themes ?? []) {
      costing.push({
        headline: `Customers mention: ${theme.theme}`,
        cost: theme.summary ?? null,
        evidence:
          theme.supporting_review_count != null
            ? `${theme.supporting_review_count} reviews`
            : null,
        tier: 'worth_fixing',
      });
    }

    const expectations = gapsMatching(
      audit,
      /review|rating|response/i,
    ).map(gapToExpectation);

    return this.baChapter('reviews', ctx, opts, audit, {
      verdict,
      alreadyWorking,
      costing,
      expectations,
      competitiveFrame: competitiveFrameLines(audit),
      fixHeadline:
        'A steady stream of fresh reviews — and a public reply on every one.',
    });
  }

  /**
   * A2 negative recovery (PB-04) — "Unanswered negative reviews": the
   * complaints sitting public with no reply, and the themes behind them.
   */
  buildRecoveryChapter(
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts = {},
  ): RepairChapterDto {
    const audit = businessAnalysisSchema.parse(auditData);
    const metrics = audit.combined_review_metrics;
    const unansweredNeg = metrics?.observable_unanswered_negative_reviews ?? 0;

    const verdict =
      unansweredNeg > 0
        ? `${unansweredNeg} negative review${unansweredNeg === 1 ? ' sits' : 's sit'} publicly unanswered.`
        : 'We found no negative reviews sitting publicly unanswered.';

    const alreadyWorking: string[] = [];
    if ((metrics?.observable_reviews_with_response ?? 0) > 0) {
      alreadyWorking.push(
        'You\u2019ve replied to reviews in the past — the habit exists, it just needs to reach the complaints.',
      );
    }

    const costing: RepairChapterDto['costing_customers'] = [];
    for (const example of audit.unanswered_negative_review_examples ?? []) {
      costing.push({
        headline: `${platformLabel(example.platform)} review${example.rating != null ? ` (${example.rating}★)` : ''}: ${example.complaint_summary}`,
        cost: 'The next hundred readers see the complaint and the silence — not the resolution.',
        evidence: example.date ?? null,
        tier: 'now',
      });
    }
    for (const theme of audit.negative_review_themes ?? []) {
      costing.push({
        headline: `A pattern in negative reviews: ${theme.theme}`,
        cost: theme.summary ?? null,
        evidence:
          theme.supporting_review_count != null
            ? `${theme.supporting_review_count} reviews`
            : null,
        tier: 'worth_fixing',
      });
    }

    const expectations = gapsMatching(
      audit,
      /negative|review|rating|response/i,
    ).map(gapToExpectation);

    return this.baChapter('recovery', ctx, opts, audit, {
      verdict,
      alreadyWorking,
      costing,
      expectations,
      competitiveFrame: [],
      fixHeadline:
        'Every negative review answered publicly and professionally — the reply is for the next hundred readers.',
    });
  }

  /**
   * A6 product visibility (PB-07) — "Your products online": can customers
   * browse the shelves before they walk in — the platform's core question.
   */
  buildProductsChapter(
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts = {},
  ): RepairChapterDto {
    const audit = businessAnalysisSchema.parse(auditData);
    const site = audit.website ?? {};
    const google = (audit.platforms as any)?.google;
    const isProductBusiness =
      audit.business_type === 'product' || audit.business_type === 'hybrid';

    const verdict = site.has_product_browsing
      ? 'Customers can browse what you sell before they walk in.'
      : isProductBusiness
        ? 'Your shelves are invisible online — customers can\u2019t see what you sell until they walk in.'
        : 'What you offer isn\u2019t listed online — customers can\u2019t see it until they ask.';

    const alreadyWorking: string[] = [];
    if (site.has_product_browsing) {
      alreadyWorking.push('Your products are browsable online.');
    }
    if ((site.product_categories_visible ?? []).length > 0) {
      alreadyWorking.push(
        `Your site shows ${site.product_categories_visible!.length} product categor${site.product_categories_visible!.length === 1 ? 'y' : 'ies'}: ${site.product_categories_visible!.slice(0, 5).join(', ')}${site.product_categories_visible!.length > 5 ? '…' : ''}.`,
      );
    }
    if (google?.photo_count != null && google.photo_count > 0) {
      alreadyWorking.push(
        `Your Google listing shows ${google.photo_count} photo${google.photo_count === 1 ? '' : 's'}.`,
      );
    }
    if (site.has_pickup_ordering === true) {
      alreadyWorking.push('Customers can order for pickup online.');
    }
    if (site.has_delivery_option === true) {
      alreadyWorking.push('Your site offers a delivery option.');
    }

    const costing: RepairChapterDto['costing_customers'] = [];
    if (site.has_product_browsing === false) {
      costing.push({
        headline: isProductBusiness
          ? 'Your products aren\u2019t browsable online'
          : 'What you offer isn\u2019t listed online',
        cost: 'A customer who can\u2019t check first picks the store they can check.',
        evidence: site.url ?? null,
        tier: 'now',
      });
    }
    if (
      site.ordering_or_pickup_info_present === false &&
      site.has_pickup_ordering !== true
    ) {
      costing.push({
        headline: 'No pickup or ordering information online',
        cost: 'Customers who shop on their phone first go where ordering is clear.',
        evidence: null,
        tier: 'worth_fixing',
      });
    }
    if (google?.photo_count === 0) {
      costing.push({
        headline: 'No photos on your Google listing',
        cost: 'Shelves people can\u2019t see are shelves people don\u2019t walk in for.',
        evidence: null,
        tier: 'worth_fixing',
      });
    }

    const expectations = gapsMatching(
      audit,
      /product|photo|catalog|browse|pickup|delivery|availability|categor/i,
    ).map(gapToExpectation);

    return this.baChapter('products', ctx, opts, audit, {
      verdict,
      alreadyWorking,
      costing,
      expectations,
      competitiveFrame: competitiveFrameLines(audit),
      fixHeadline:
        'Your real shelves, online — browsable products, clear pickup, photos that show what\u2019s in stock.',
    });
  }

  /**
   * §3.4 — the audit's data_quality is the honesty footer, minus internal
   * lane-plumbing lines. Unioned across chapters by the assembler (Phase 3).
   * Dispatches on the chapter's audit source — BA audits carry the same
   * verified/unavailable/limitations keys plus audit_metadata.limitations.
   */
  buildChapterDataQuality(
    auditData: unknown,
    chapterId: ProspectReportChapterId = 'website',
  ): {
    verified: string[];
    couldnt_check: string[];
    limitations: string[];
  } {
    if (CHAPTER_BUILDERS[chapterId]?.source === 'business_analysis') {
      const audit = businessAnalysisSchema.parse(auditData);
      const dq = audit.data_quality ?? {};
      return {
        verified: (dq.verified_fields ?? []).filter((l) => !isInternalLine(l)),
        couldnt_check: [
          ...(dq.unavailable_fields ?? []),
          // NAP/fact conflicts are honest "couldn't settle this" items.
          ...(dq.conflicts ?? []),
        ],
        limitations: [
          ...(dq.limitations ?? []),
          ...(audit.audit_metadata?.limitations ?? []),
        ].filter((l) => !isInternalLine(l)),
      };
    }
    const audit = websitePositioningAuditSchema.parse(auditData);
    const dq = audit.data_quality ?? {};
    return {
      verified: (dq.verified_fields ?? []).filter((l) => !isInternalLine(l)),
      couldnt_check: dq.unavailable_fields ?? [],
      limitations: dq.limitations ?? [],
    };
  }

  /** Teaser finding count for a withheld chapter (G-4): issues + unmet gaps. */
  chapterFindingCount(chapter: ProspectReportChapterDto): number {
    return chapter.costing_customers.length + chapter.expectations.length;
  }

  // ─── Signed tokens (§5.1, sprint §0.4) ─────────────────────────────────
  //
  // token = base64url(prospectId.tier.chapterList.flags) + "." + HMAC-SHA256
  // The signed chapter list is a permission scope, not a snapshot: a
  // website,repair token renders the repair chapter the moment its audit
  // lands (G-3). No exp at v1 — links are cheap to re-mint; rotating
  // PROSPECT_REPORT_TOKEN_SECRET invalidates all issued links.

  private get signingSecret(): string {
    const secret = unifiedConfig.prospectReportTokenSecret;
    if (!secret) {
      // unifiedConfig returns '' only when unset in production.
      logger.error(
        'PROSPECT_REPORT_TOKEN_SECRET is not set — prospect report tokens cannot be signed or verified',
        undefined,
        {},
      );
    }
    return secret;
  }

  mintToken(input: {
    prospectId: string;
    tier: ProspectReportTier;
    chapters: ProspectReportChapterId[];
    includePagePlan: boolean;
  }): string | null {
    const secret = this.signingSecret;
    if (!secret) return null;
    const flags = input.includePagePlan ? 'p' : '-';
    const inner = `${input.prospectId}.${input.tier}.${input.chapters.join(',')}.${flags}`;
    const payload = Buffer.from(inner, 'utf8').toString('base64url');
    const sig = createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }

  verifyToken(token: string): {
    prospectId: string;
    tier: ProspectReportTier;
    chapters: ProspectReportChapterId[];
    includePagePlan: boolean;
  } | null {
    const secret = this.signingSecret;
    if (!secret || !token) return null;
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1 || token.indexOf('.', dot + 1) !== -1) {
      return null;
    }
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = createHmac('sha256', secret).update(payload).digest('base64url');
    // Length check first — timingSafeEqual throws on unequal buffers.
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return null;
    }
    const inner = Buffer.from(payload, 'base64url').toString('utf8');
    const seg = inner.split('.');
    if (seg.length !== 4) return null;
    const [prospectId, tier, chapterList, flags] = seg;
    if (!prospectId || !(PROSPECT_REPORT_TIERS as readonly string[]).includes(tier)) {
      return null;
    }
    const chapters = chapterList
      .split(',')
      .filter((c): c is ProspectReportChapterId =>
        (PROSPECT_REPORT_CHAPTER_IDS as readonly string[]).includes(c),
      );
    if (chapters.length === 0) return null;
    return {
      prospectId,
      tier: tier as ProspectReportTier,
      chapters,
      includePagePlan: flags === 'p',
    };
  }

  // ─── Short links (§5.2a — mkt_prospect_report_links) ────────────────────

  /**
   * Mint one links row per share action: the channel lives on the row, so
   * /r/pr/{code} resolves without a channel param and the scan attributes to
   * prospect_report_{channel} directly. 6-char code, collision-retry — same
   * mechanics as claim short codes, separate namespace (G-2).
   */
  async mintLinkCode(input: {
    prospectId: string;
    campaignId: string;
    token: string;
    tier: ProspectReportTier;
    chapters: ProspectReportChapterId[];
    channel: string;
    createdBy?: string | null;
  }, ctx?: RequestCtx): Promise<string | null> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = generateProspectReportCode();
      const clash = await this.prisma.mkt_prospect_report_links.findFirst({
        where: { code: candidate },
        select: { id: true },
      });
      if (clash) {
        logger.warn('Prospect report link code collision, retrying', ctx, {
          candidate,
          attempt,
        });
        continue;
      }
      await this.prisma.mkt_prospect_report_links.create({
        data: {
          id: generateProspectReportLinkId(),
          code: candidate,
          business_prospect_id: input.prospectId,
          campaign_id: input.campaignId,
          token: input.token,
          tier: input.tier,
          chapters: input.chapters as any,
          channel: input.channel,
          created_by: input.createdBy ?? null,
        },
      });
      logger.info('ProspectReportService.mintLinkCode', ctx, {
        prospectId: input.prospectId,
        campaignId: input.campaignId,
        channel: input.channel,
        code: candidate,
      });
      return candidate;
    }
    logger.error('Prospect report link code generation exhausted retries', ctx, {
      prospectId: input.prospectId,
    });
    return null;
  }

  /** Resolve a /r/pr/{code} row — uppercase-normalized like claim codes. */
  async resolveLinkCode(
    code: string,
    ctx?: RequestCtx,
  ): Promise<{
    token: string;
    prospectId: string;
    campaignId: string;
    tier: string;
    chapters: string[];
    channel: string;
  } | null> {
    const normalized = code.toUpperCase();
    const row = await this.prisma.mkt_prospect_report_links.findUnique({
      where: { code: normalized },
    });
    if (!row) return null;
    return {
      token: row.token,
      prospectId: row.business_prospect_id,
      campaignId: row.campaign_id,
      tier: row.tier,
      chapters: Array.isArray(row.chapters) ? (row.chapters as string[]) : [],
      channel: row.channel,
    };
  }

  // ─── Assembly (§5.0, §5.1a) ─────────────────────────────────────────────

  /**
   * Declared archetype per campaign — the effective playbook (override ??
   * recommendation) of its operator-accepted triage result. Mirrors
   * MarketingCampaignService.resolveDeclaredArchetypes: campaigns with no
   * accepted triage are simply absent, and failure degrades to empty rather
   * than failing the report.
   */
  private async resolveSiblingArchetypes(
    campaignIds: string[],
    ctx?: RequestCtx,
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (campaignIds.length === 0) return result;
    try {
      const rows = await this.prisma.mkt_campaign_triage_results.findMany({
        where: { campaign_id: { in: campaignIds } },
        include: {
          playbook: { select: { archetype: true } },
          overridden_playbook: { select: { archetype: true } },
        },
      });
      for (const row of rows as any[]) {
        if (row.is_operator_accepted !== true) continue;
        const archetype =
          row.overridden_playbook?.archetype ?? row.playbook?.archetype;
        if (archetype) result.set(row.campaign_id, archetype);
      }
    } catch (error) {
      logger.warn('Prospect report archetype resolution failed', ctx, {
        error: (error as Error).message,
        campaignCount: campaignIds.length,
      });
    }
    return result;
  }

  /**
   * Chapter → owning campaign. Each sibling contributes the chapter its
   * declared archetype maps to — provided that chapter's audit source exists
   * in the sibling set (first sibling wins when two share an archetype, e.g.
   * PB-01 and PB-06 both A3). Unclaimed `repair`/`website` chapters fall
   * back to the campaign that owns the audit row so legacy campaigns with no
   * accepted triage still report.
   */
  private resolveChapterOwners(
    campaigns: { id: string }[],
    audits: { campaign_id: string; platform: string }[],
    archetypes: Map<string, string>,
  ): Map<ProspectReportChapterId, string> {
    const owners = new Map<ProspectReportChapterId, string>();
    const sourcePresent = (source: string) =>
      audits.some((a) => a.platform === source);

    for (const campaign of campaigns) {
      const archetype = archetypes.get(campaign.id);
      const chapterId = archetype ? ARCHETYPE_CHAPTERS[archetype] : undefined;
      if (
        chapterId &&
        !owners.has(chapterId) &&
        sourcePresent(CHAPTER_BUILDERS[chapterId].source)
      ) {
        owners.set(chapterId, campaign.id);
      }
    }
    // Legacy fallback — audits on campaigns with no declared archetype.
    for (const id of ['repair', 'website'] as const) {
      if (owners.has(id)) continue;
      const audit = audits.find(
        (a) => a.platform === CHAPTER_BUILDERS[id].source,
      );
      if (audit) owners.set(id, audit.campaign_id);
    }
    return owners;
  }

  /**
   * Assemble the prospect-level report DTO over the sibling set.
   *
   * - allowedChapters is the signed permission scope (ordered — index 0 is
   *   the free-visible chapter). Chapters build only for scopes the token
   *   permits; a permitted chapter with no audit on file is simply absent.
   * - tier=free clamps to the first assembled chapter and converts the rest
   *   to locked teasers (title + finding count — never content, G-4).
   * - Returns null when no permitted chapter can be built (route → 404).
   */
  async assembleReport(
    businessProspectId: string,
    allowedChapters: ProspectReportChapterId[],
    tier: ProspectReportTier,
    opts: ChapterBuildOpts = {},
    ctx?: RequestCtx,
  ): Promise<ProspectReportDto | null> {
    // Sibling set — display fields the chapters + shell need.
    const campaigns = (await this.prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: businessProspectId, scope: 'business' } as any,
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        business_name: true,
        website_url: true,
        category: true,
      },
    })) as any[];
    if (campaigns.length === 0) return null;
    const campaignIds = campaigns.map((c) => c.id as string);
    const campaignById = new Map(campaigns.map((c) => [c.id as string, c]));

    // Latest audit per registered chapter source across the sibling set —
    // same-column accumulation means reruns append rows (§9.1: latest wins).
    const sources = [
      ...new Set(
        allowedChapters
          .map((c) => CHAPTER_BUILDERS[c]?.source)
          .filter((s): s is string => !!s),
      ),
    ];
    if (sources.length === 0) return null;

    const audits = (await this.prisma.mkt_audits_list.findMany({
      where: { campaign_id: { in: campaignIds }, platform: { in: sources } },
      orderBy: { created_at: 'desc' },
      select: { campaign_id: true, platform: true, audit_data: true, created_at: true },
    })) as any[];

    // Chapter ownership — each sibling contributes the chapter its declared
    // archetype maps to; the chapter renders under that sibling's name.
    const archetypes = await this.resolveSiblingArchetypes(campaignIds, ctx);
    const owners = this.resolveChapterOwners(campaigns, audits, archetypes);

    // Build permitted chapters in signed order; skip chapters no sibling
    // claimed (archetype chapters need their sibling; repair/website fall
    // back to the audit's own campaign).
    const built: {
      id: ProspectReportChapterId;
      chapter: ProspectReportChapterDto;
      dataQuality: { verified: string[]; couldnt_check: string[]; limitations: string[] };
      auditedAt: Date;
      auditData: unknown;
      ownerCampaignId: string;
    }[] = [];
    for (const chapterId of allowedChapters) {
      const builder = CHAPTER_BUILDERS[chapterId];
      if (!builder) continue;
      const ownerId = owners.get(chapterId);
      if (!ownerId) continue;
      const campaign = campaignById.get(ownerId);
      if (!campaign) continue;
      const audit = audits.find((a) => a.platform === builder.source);
      if (!audit) continue;
      const chapter = this.buildChapter(
        chapterId,
        audit.audit_data,
        {
          businessName: campaign.business_name ?? 'Your business',
          websiteUrl: campaign.website_url ?? null,
          category: campaign.category ?? null,
          auditedAt: (audit.created_at as Date).toISOString(),
        },
        opts,
      );
      built.push({
        id: chapterId,
        chapter,
        dataQuality: this.buildChapterDataQuality(audit.audit_data, chapterId),
        auditedAt: audit.created_at as Date,
        auditData: audit.audit_data,
        ownerCampaignId: ownerId,
      });
    }
    if (built.length === 0) return null;

    // §5.1a — tier=free: first assembled chapter visible, rest are teasers.
    const visible = tier === 'free' ? built.slice(0, 1) : built;
    const withheld = tier === 'free' ? built.slice(1) : [];
    const lockedChapters = withheld.map((b) => ({
      chapter_id: b.id,
      title: CHAPTER_BUILDERS[b.id]?.teaserTitle ?? b.id,
      finding_count: this.chapterFindingCount(b.chapter),
      teaser: `${CHAPTER_BUILDERS[b.id]?.teaserTitle ?? 'This chapter'} — ${this.chapterFindingCount(b.chapter)} finding${this.chapterFindingCount(b.chapter) === 1 ? '' : 's'} inside`,
    }));

    // §6.2 — single chapter: summary verbatim; multi: composite + bullets.
    const teaserTitles = built.map(
      (b) => CHAPTER_BUILDERS[b.id]?.teaserTitle ?? 'this area',
    );
    const shortVersion =
      visible.length === 1
        ? {
            lead: visible[0].chapter.summary ?? visible[0].chapter.verdict,
            bullets: [] as string[],
          }
        : {
            lead: `We reviewed ${teaserTitles
              .map((t) => t.toLowerCase())
              .join(' and ')} — here's what we found.`,
            bullets: built
              .map((b) => b.chapter.summary)
              .filter((s): s is string => !!s),
          };

    // §6.5 — unioned data_quality across *visible* chapters (deduped);
    // withheld chapters' internals never enter the DTO.
    const union = <T>(lists: T[][]): T[] => [...new Set(lists.flat())];
    const dataQuality = {
      verified: union(visible.map((b) => b.dataQuality.verified)),
      couldnt_check: union(visible.map((b) => b.dataQuality.couldnt_check)),
      limitations: union(visible.map((b) => b.dataQuality.limitations)),
    };

    // §2 annex — outreach problem→solution pairs of the *visible* chapters,
    // unioned, deduped on the problem text, and capped at the 1–3 bound the
    // audits/briefings author to. Source precedence per chapter: the owning
    // sibling's briefing executions win (analyst-refined, archetype-scoped
    // copy that can differ from the audit's generic set); the chapter
    // audit's own outreach_problems are the fallback for un-briefed
    // chapters. Briefing pairs rank ahead of audit-fallback pairs so the
    // sharpest framing leads regardless of chapter order. Deduping still
    // matters — every BA-sourced chapter shares the one business_analysis
    // audit — and withheld chapters contribute nothing (tier clamp first).
    const briefingProblems = await this.loadBriefingProblems(
      [...new Set(visible.map((b) => b.ownerCampaignId))],
      ctx,
    );
    const seenProblems = new Set<string>();
    const problems: ReportProblemDto[] = [];
    const pushProblems = (pairs: ReportProblemDto[]) => {
      for (const p of pairs) {
        if (problems.length >= 3) return;
        const key = p.problem.trim().toLowerCase();
        if (seenProblems.has(key)) continue;
        seenProblems.add(key);
        problems.push(p);
      }
    };
    for (const b of visible) {
      pushProblems(briefingProblems.get(b.ownerCampaignId) ?? []);
    }
    for (const b of visible) {
      if (!briefingProblems.has(b.ownerCampaignId)) {
        pushProblems(ownerFacingProblems(b.auditData));
      }
    }

    // §6.6 — footer CTA: claim URL when any sibling is seeded, else contact.
    const cta = await this.resolveClaimCta(campaignIds, ctx);

    const newestAudit = built.reduce((a, b) =>
      b.auditedAt > a.auditedAt ? b : a,
    );

    const report: ProspectReportDto = {
      report_kind: 'business_visibility',
      business_prospect_id: businessProspectId,
      business_name: campaigns[0].business_name ?? 'Your business',
      prepared_at: newestAudit.auditedAt.toISOString(),
      website_url: campaigns[0].website_url ?? null,
      tier,
      short_version: shortVersion,
      chapters: visible.map((b) => b.chapter),
      locked_chapters: lockedChapters,
      problems,
      data_quality: dataQuality,
      cta,
    };

    logger.info('ProspectReportService.assembleReport', ctx, {
      businessProspectId,
      tier,
      requested: allowedChapters,
      built: built.map((b) => b.id),
      locked: withheld.map((b) => b.id),
    });

    return report;
  }

  /**
   * Latest briefing-sourced outreach problems per chapter-owner campaign.
   *
   * Archetype briefings, per-issue repair seeks, and triage briefings are
   * identified by their template's output_schema.name
   * (profile_repair_audit / profile_repair_triage) — the same key the
   * operator panels use (CampaignDetailClient / ArchetypeBriefingPanel), so
   * present and future briefing templates are covered without hardcoding
   * ids. Follows the panels' list→detail pattern: a lightweight projection
   * filters to briefing executions, then raw_output is fetched only for
   * the winners.
   *
   * Latest run per (campaign, template) wins (§9.1), so a repair sibling
   * can contribute pairs from each of its issue briefings + triage.
   * Failures degrade to an empty map — the audit fallback still applies.
   */
  private async loadBriefingProblems(
    campaignIds: string[],
    ctx?: RequestCtx,
  ): Promise<Map<string, ReportProblemDto[]>> {
    const byCampaign = new Map<string, ReportProblemDto[]>();
    if (campaignIds.length === 0) return byCampaign;
    try {
      const execs = (await this.prisma.mkt_prompt_executions_list.findMany({
        where: { campaign_id: { in: campaignIds } },
        orderBy: { executed_at: 'desc' },
        take: 200,
        select: {
          id: true,
          campaign_id: true,
          template_id: true,
          mkt_prompt_templates_list: { select: { output_schema: true } },
        },
      })) as any[];

      const latestPerTemplate = new Map<string, any>();
      for (const exec of execs) {
        const schemaName = exec.mkt_prompt_templates_list?.output_schema?.name;
        if (schemaName !== 'profile_repair_audit' && schemaName !== 'profile_repair_triage') {
          continue;
        }
        const key = `${exec.campaign_id}:${exec.template_id ?? ''}`;
        if (!latestPerTemplate.has(key)) latestPerTemplate.set(key, exec);
      }
      if (latestPerTemplate.size === 0) return byCampaign;

      const rows = (await this.prisma.mkt_prompt_executions_list.findMany({
        where: { id: { in: [...latestPerTemplate.values()].map((e) => e.id) } },
        orderBy: { executed_at: 'desc' },
        select: { campaign_id: true, raw_output: true },
      })) as any[];

      for (const row of rows) {
        const pairs = briefingProblemsFromRaw(row.raw_output);
        if (pairs.length === 0) continue;
        const list = byCampaign.get(row.campaign_id) ?? [];
        byCampaign.set(row.campaign_id, list.concat(pairs));
      }
    } catch (error) {
      logger.warn('Prospect report briefing problems resolution failed', ctx, {
        error: (error as Error).message,
      });
    }
    return byCampaign;
  }

  /**
   * Footer CTA resolution (§6.6): the claim URL of any sibling's live seed
   * (primary link role first), else the ops-contact fallback.
   */
  private async resolveClaimCta(
    campaignIds: string[],
    ctx?: RequestCtx,
  ): Promise<ProspectReportDto['cta']> {
    try {
      const rows = await this.prisma.$queryRaw<any[]>`
        SELECT dct.short_code, dct.token
        FROM directory_seed_campaign_links dscl
        JOIN directory_claim_tokens dct ON dct.seed_id = dscl.seed_id
        WHERE dscl.campaign_id IN (${Prisma.join(campaignIds)})
          AND dct.consumed_at IS NULL
          AND dct.expires_at > now()
        ORDER BY (dscl.link_role = 'primary') DESC, dct.created_at DESC
        LIMIT 1
      `;
      const frontendUrl = unifiedConfig.frontendUrl;
      if (rows[0]) {
        const url = rows[0].short_code
          ? `${frontendUrl}/q/${rows[0].short_code}`
          : `${frontendUrl}/place/claim/${rows[0].token}`;
        return {
          kind: 'claim',
          label: 'Claim your free listing',
          url,
        };
      }
    } catch (error) {
      logger.warn('Prospect report claim CTA resolution failed', ctx, {
        error: (error as Error).message,
      });
    }
    return { kind: 'contact', label: 'Talk to us about the fix', url: null };
  }

  /**
   * Chapter ids that can actually be built for this prospect — one per
   * sibling whose declared archetype maps to a chapter whose audit source is
   * on file, plus the legacy repair/website fallback. Drives the panel's
   * chapter checkboxes — a chapter no sibling can own is never offered.
   */
  async listAvailableChapters(
    businessProspectId: string,
    ctx?: RequestCtx,
  ): Promise<ProspectReportChapterId[]> {
    const owners = await this.resolveProspectChapterOwners(businessProspectId, ctx);
    return PROSPECT_REPORT_CHAPTER_IDS.filter((id) => owners.has(id));
  }

  /**
   * Chapter → owning campaign attribution (§5.5a): which sibling contributes
   * each chapter. The panel uses it to default each sibling's selection to
   * ITS OWN chapter — a PB-01 sibling defaults to `drift`, a PB-08 to
   * `website`, an A5 to `repair`; inherited audits never count as "its own".
   */
  async listChapterSources(
    businessProspectId: string,
    ctx?: RequestCtx,
  ): Promise<Record<string, string>> {
    const owners = await this.resolveProspectChapterOwners(businessProspectId, ctx);
    return Object.fromEntries(owners);
  }

  /** Shared context loader for the two listing methods above. */
  private async resolveProspectChapterOwners(
    businessProspectId: string,
    ctx?: RequestCtx,
  ): Promise<Map<ProspectReportChapterId, string>> {
    const campaigns = (await this.prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: businessProspectId, scope: 'business' } as any,
      orderBy: { created_at: 'asc' },
      select: { id: true },
    })) as any[];
    const ids = campaigns.map((c) => c.id as string);
    if (ids.length === 0) return new Map();
    const sources = [...new Set(
      Object.values(CHAPTER_BUILDERS).map((b) => b.source),
    )];
    const audits = (await this.prisma.mkt_audits_list.findMany({
      where: { campaign_id: { in: ids }, platform: { in: sources } },
      orderBy: { created_at: 'desc' },
      select: { campaign_id: true, platform: true },
    })) as any[];
    const archetypes = await this.resolveSiblingArchetypes(ids, ctx);
    return this.resolveChapterOwners(campaigns, audits, archetypes);
  }

  /**
   * Ensure a campaign is prospect-addressable (G-6): returns the campaign's
   * business_prospect_id, minting one via initializeProspectFromCampaign on
   * first share when absent.
   */
  async resolveProspectIdForCampaign(
    campaignId: string,
    ctx?: RequestCtx,
  ): Promise<string> {
    return BusinessProspectService.getInstance().initializeProspectFromCampaign(
      campaignId,
      ctx,
    );
  }
}

export const prospectReportService = ProspectReportService.getInstance();
export default prospectReportService;
