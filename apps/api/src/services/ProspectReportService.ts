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
 * Owner-safety contract (§2): detected_signals (internal WC_* taxonomy) and
 * outreach_problems (sales ammunition) are redacted — they never reach the
 * DTO. No new facts are generated; an audit section with no source rows is
 * omitted, never stubbed.
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
 * Chapter id ↔ audit source ↔ builder. Playbook-agnostic: a new chapter is
 * registered by adding a builder for a new audit source, not by naming a
 * playbook (OQ-5 — `repair` registers when its transform lands).
 */
export const CHAPTER_BUILDERS: Partial<
  Record<ProspectReportChapterId, ChapterBuilder>
> = {
  website: {
    source: 'website_positioning',
    title: 'Your website today',
    teaserTitle: 'Your website',
  },
  // business_analysis — the triage/BA audit behind the A5 multi-signal /
  // PB-05 repair track. Its sibling campaign defaults to this chapter.
  repair: {
    source: 'business_analysis',
    title: 'Your online listings',
    teaserTitle: 'Your public profiles',
  },
};

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

function formatValue(v: unknown): string {
  if (v === true) return 'present';
  if (v === false) return 'missing';
  if (v == null) return 'not found';
  if (Array.isArray(v)) return v.map(String).join(', ');
  return String(v);
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
   * Dispatch — route an audit row to the registered builder for its chapter.
   */
  private buildChapter(
    chapterId: ProspectReportChapterId,
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts,
  ): ProspectReportChapterDto {
    if (chapterId === 'repair') {
      return this.buildRepairChapter(auditData, ctx, opts);
    }
    return this.buildWebsiteChapter(auditData, ctx, opts);
  }

  /**
   * L1 → L3 transform for the `business_analysis` audit (the A5 / PB-05
   * repair track) — the "Your online listings" chapter.
   *
   * Owner-safety: detected_signals, outreach_problems, alignment_scoring,
   * recommended_tier label, estimated_monthly_service_fee,
   * digital_opportunity_score, high_attention, render_controls, and sources
   * never reach the DTO — the platform's internal sales/scoring machinery
   * stays internal.
   */
  buildRepairChapter(
    auditData: unknown,
    ctx: ChapterContext,
    opts: ChapterBuildOpts = {},
  ): RepairChapterDto {
    const audit = businessAnalysisSchema.parse(auditData);

    // Verdict — identity confirmation × listing coverage.
    const platforms = audit.platforms ?? {};
    const platformEntries = Object.entries(platforms).filter(
      ([, p]: [string, any]) => p && typeof p === 'object' && p.profile_status,
    );
    const PRESENT_STATUSES = new Set([
      'claimed',
      'likely_claimed',
      'unclaimed',
      'likely_unclaimed',
    ]);
    const found = platformEntries.filter(([, p]: [string, any]) =>
      PRESENT_STATUSES.has(p.profile_status),
    );
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
    const platformLabel = (key: string) =>
      key === 'google'
        ? 'Google Business Profile'
        : key === 'yelp'
          ? 'Yelp'
          : key === 'facebook'
            ? 'Facebook'
            : humanizeField(key);

    const alreadyWorking: string[] = [];
    for (const [key, p] of platformEntries as [string, any][]) {
      if (p.profile_status === 'claimed' || p.profile_status === 'likely_claimed') {
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
    for (const [key, p] of platformEntries as [string, any][]) {
      const label = platformLabel(key);
      const unclaimed =
        p.profile_status === 'unclaimed' ||
        p.profile_status === 'likely_unclaimed';
      if (unclaimed) {
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
    ).map((gap) => ({
      field: gap.platform
        ? `${platformLabel(gap.platform)} — ${humanizeField(gap.field)}`
        : humanizeField(gap.field),
      expected_text: formatValue(gap.expected),
      actual_text: formatValue(gap.actual),
      note: gap.gap_description ?? null,
    }));

    // Competitive frame — benchmark businesses as exemplar lines.
    const competitiveFrame = (audit.competitive_benchmarks ?? []).map((b) => {
      const rating =
        b.google_rating != null && b.google_review_count != null
          ? ` — ${b.google_rating}★ across ${b.google_review_count} Google reviews`
          : '';
      const format = b.store_format ? `, ${humanizeField(b.store_format)}` : '';
      return `${b.business_name}${format}${rating}`;
    });

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
    if (chapterId === 'repair') {
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
    const sources = allowedChapters
      .map((c) => CHAPTER_BUILDERS[c]?.source)
      .filter((s): s is string => !!s);
    if (sources.length === 0) return null;

    const audits = (await this.prisma.mkt_audits_list.findMany({
      where: { campaign_id: { in: campaignIds }, platform: { in: sources } },
      orderBy: { created_at: 'desc' },
      select: { campaign_id: true, platform: true, audit_data: true, created_at: true },
    })) as any[];

    // Build permitted chapters in signed order; skip chapters with no audit.
    const built: {
      id: ProspectReportChapterId;
      chapter: ProspectReportChapterDto;
      dataQuality: { verified: string[]; couldnt_check: string[]; limitations: string[] };
      auditedAt: Date;
    }[] = [];
    for (const chapterId of allowedChapters) {
      const builder = CHAPTER_BUILDERS[chapterId];
      if (!builder) continue;
      const audit = audits.find((a) => a.platform === builder.source);
      if (!audit) continue;
      const campaign = campaignById.get(audit.campaign_id);
      if (!campaign) continue;
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
        ? { lead: visible[0].chapter.summary, bullets: [] as string[] }
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
   * Chapter ids that can actually be built for this prospect (audit on file
   * for the chapter's registered source). Drives the panel's chapter
   * checkboxes — a chapter that can't be built is never offered.
   */
  async listAvailableChapters(
    businessProspectId: string,
    ctx?: RequestCtx,
  ): Promise<ProspectReportChapterId[]> {
    const campaigns = await this.prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: businessProspectId, scope: 'business' } as any,
      select: { id: true },
    });
    const ids = campaigns.map((c) => c.id as string);
    if (ids.length === 0) return [];
    const sources = Object.values(CHAPTER_BUILDERS)
      .filter((b): b is ChapterBuilder => !!b)
      .map((b) => b.source);
    const audits = await this.prisma.mkt_audits_list.findMany({
      where: { campaign_id: { in: ids }, platform: { in: sources } },
      select: { platform: true },
      distinct: ['platform'],
    });
    const present = new Set(audits.map((a) => a.platform as string));
    return PROSPECT_REPORT_CHAPTER_IDS.filter((id) => {
      const builder = CHAPTER_BUILDERS[id];
      return !!builder && present.has(builder.source);
    });
  }

  /**
   * Chapter → owning campaign attribution (§5.5a): which sibling's audit
   * would build each available chapter (latest audit per source wins — same
   * rule as assembleReport). The panel uses it to default each sibling's
   * selection to ITS OWN chapter — an inherited audit on a sibling does not
   * make that chapter "its own".
   */
  async listChapterSources(
    businessProspectId: string,
    ctx?: RequestCtx,
  ): Promise<Record<string, string>> {
    const campaigns = await this.prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: businessProspectId, scope: 'business' } as any,
      select: { id: true },
    });
    const ids = campaigns.map((c) => c.id as string);
    if (ids.length === 0) return {};
    const sources = Object.values(CHAPTER_BUILDERS)
      .filter((b): b is ChapterBuilder => !!b)
      .map((b) => b.source);
    const audits = await this.prisma.mkt_audits_list.findMany({
      where: { campaign_id: { in: ids }, platform: { in: sources } },
      orderBy: { created_at: 'desc' },
      select: { campaign_id: true, platform: true },
    });
    const attribution: Record<string, string> = {};
    for (const [id, builder] of Object.entries(CHAPTER_BUILDERS)) {
      const audit = audits.find((a) => a.platform === builder!.source);
      if (audit) attribution[id] = audit.campaign_id as string;
    }
    return attribution;
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
