/**
 * Prospect (Business Visibility) Report — DTO Schema
 *
 * Spec: docs/LocalBiz/WEBSITE_GAP_OWNER_REPORT_SPEC.md §2, §5, §6
 *
 * The owner-facing composite report keyed on `business_prospect_id`. A shell
 * + chapters: the shell is prospect-level; each chapter is the deterministic
 * owner-safe transform of ONE campaign's diagnostic audit (L1 → L3). The DTO
 * is the *public-safe subset by construction* — the transform is a pure
 * function over the audit JSON, so this schema is the lint; there is no
 * separate publish gate (contrast: seed-report-lint).
 *
 * Tier discipline (§5.1a): `tier=free` renders only the first chapter and
 * carries `locked_chapters` teaser records (title + finding count, never
 * content) for withheld chapters. Chapter assembly + tier clamp happen
 * server-side in ProspectReportService before this DTO is produced.
 *
 * Owner-safety contract: `detected_signals` (internal WC_* taxonomy) never
 * appear anywhere in this DTO. `outreach_problems` surfaces only as the
 * `problems` annex — the owner-addressed framing (the `hook`/`regular` spoken
 * line + `problem`/`solution`/`evidence`); `outreach_use` and the unchosen
 * spoken line stay internal (§2 annex exception).
 * `data_quality` is the honesty footer — what was verified, what couldn't be
 * checked, and the audit's own limitations.
 */

import { z } from 'zod';

// ─── Tiers & chapter ids (§5.1a, §0.4 sprint plan) ────────────────────────

export const PROSPECT_REPORT_TIERS = ['free', 'full'] as const;
export type ProspectReportTier = (typeof PROSPECT_REPORT_TIERS)[number];
export const prospectReportTierSchema = z.enum(PROSPECT_REPORT_TIERS);

/**
 * Chapter ids key on the diagnostic the sibling campaign contributed, never
 * a playbook code. `website` builds from `website_positioning` audits; every
 * other chapter is a filtered owner-safe extract of the same
 * `business_analysis` audit — the archetype the sibling's accepted triage
 * declared decides which extract it contributes:
 *
 *   A1 review gap → `reviews`    A2 negative recovery → `recovery`
 *   A3 listing drift → `drift`   A4 CTA gap → `cta`
 *   A5 multi-signal → `repair`   A6 product visibility → `products`
 *   A7 website gap → `website`
 *
 * A sibling with no declared archetype claims nothing; `repair`/`website`
 * additionally fall back to the audit's own campaign so legacy campaigns
 * still report.
 */
export const PROSPECT_REPORT_CHAPTER_IDS = [
  'website',
  'repair',
  'drift',
  'cta',
  'reviews',
  'recovery',
  'products',
] as const;
export type ProspectReportChapterId = (typeof PROSPECT_REPORT_CHAPTER_IDS)[number];

// ─── Website chapter (§2 field map, §6 structure) ─────────────────────────

/** A finding that costs customers — severity retitled out of internal vocab. */
const reportIssueSchema = z.object({
  headline: z.string(),
  /** Owner-facing "what it costs you" line (audit conversion_implication). */
  cost: z.string().nullable(),
  /** "Where we saw it" — provenance is the trust asset. */
  evidence: z.string().nullable(),
  /** 'now' = was non_negotiable; 'worth_fixing' = was recommended (§3.1). */
  tier: z.enum(['now', 'worth_fixing']),
});

/** An unmet category expectation rendered as expected-vs-actual (§3.3). */
const reportExpectationSchema = z.object({
  /** Humanized field name ("Ordering schedule", not "ordering_schedule"). */
  field: z.string(),
  expected_text: z.string(),
  actual_text: z.string(),
  note: z.string().nullable(),
});

/**
 * Shared chapter body — every chapter is the same owner-safe shape
 * (verdict / already working / costing customers / expectations /
 * competitive frame / fix); builders differ only in which audit source
 * feeds it. The discriminated union on chapter_id keeps the schema lint.
 */
const reportChapterFields = {
  title: z.string(),
  audited_at: z.string(),
  /** Category label for interpolated section titles ("leading {category}…"). */
  category: z.string().nullable(),
  summary: z.string().nullable(),

  /** The verdict sentence — presence × ownership gloss (website, §3.2) or
      identity × coverage line (repair). */
  verdict: z.string(),

  /** "Already working" — met expectations, credibility first (§3.3). */
  already_working: z.array(z.string()),

  /** "What's costing you customers" — issues sorted non_negotiable first. */
  costing_customers: z.array(reportIssueSchema),

  /** "What {category} customers expect" — unmet expected-vs-actual rows. */
  expectations: z.array(reportExpectationSchema),

  /** "What leading {category} businesses do" — exemplar lines verbatim. */
  competitive_frame: z.array(z.string()),

  /** "The fix" — delivery-mode reframe (§4) + scope notes + gated plan. */
  fix: z.object({
    headline: z.string(),
    scope_notes: z.string().nullable(),
    /** must_have_pages / recommended_services — null unless the operator's
        detail flag signed into the token. */
    page_plan: z.array(z.string()).nullable(),
  }),
};

/**
 * Every chapter — website, repair, and the archetype-scoped extracts — is
 * the same owner-safe shape; chapter_id records which diagnostic produced
 * it. BA-sourced builders redact detected_signals, outreach_problems,
 * alignment_scoring, tier/fee recommendations, and the opportunity score.
 */
const reportChapterSchema = z.object({
  chapter_id: z.enum(PROSPECT_REPORT_CHAPTER_IDS),
  ...reportChapterFields,
});

export type ProspectReportChapterDto = z.infer<typeof reportChapterSchema>;
export type WebsiteChapterDto = ProspectReportChapterDto;
export type RepairChapterDto = ProspectReportChapterDto;

// ─── Locked teaser (§5.1a, G-4) ────────────────────────────────────────────

/**
 * A withheld chapter rendered as a locked teaser on tier=free — title and
 * finding count only. The content is never assembled into the DTO; this is
 * the upsell surface, not a redacted body.
 */
const lockedChapterSchema = z.object({
  chapter_id: z.string(),
  title: z.string(),
  finding_count: z.number(),
  teaser: z.string(),
});

export type LockedChapterDto = z.infer<typeof lockedChapterSchema>;

// ─── Problems annex (§2 exception — "how we'd fix it") ────────────────────

/**
 * One outreach problem→solution pair, owner-facing. The audit's
 * outreach_problems carry two spoken lines (`regular`, `hook`) — the same
 * problem framed differently — so exactly one crosses into the report:
 * `line` is the `hook` (the attention framing) with `regular` as fallback.
 * `outreach_use` (deployment tactics) and the unchosen line never emit.
 *
 * Report-level, not per-chapter: every BA-sourced chapter shares the one
 * business_analysis audit, so the assembler unions the pairs across *visible*
 * chapters and dedupes on the problem text — a free-tier report never leaks
 * a withheld chapter's problems.
 */
const reportProblemSchema = z.object({
  /** The consequence-first statement, as the owner experiences it. */
  problem: z.string(),
  /** The spoken framing — audit `hook` preferred, `regular` fallback. */
  line: z.string().nullable(),
  /** High-level fix summary — what gets done, never a named package. */
  solution: z.string().nullable(),
  /** The observed fact grounding the pair (platform + fact). */
  evidence: z.string().nullable(),
});

export type ReportProblemDto = z.infer<typeof reportProblemSchema>;

// ─── Shell DTO (§6) ───────────────────────────────────────────────────────

export const prospectReportSchema = z.object({
  report_kind: z.literal('business_visibility'),
  business_prospect_id: z.string(),
  business_name: z.string(),
  /** "prepared {date}" — the newest included audit's created_at (OQ-3). */
  prepared_at: z.string(),
  website_url: z.string().nullable(),
  tier: prospectReportTierSchema,

  /** §6.2 — single chapter: its summary verbatim; multi: composite lead + bullets. */
  short_version: z.object({
    lead: z.string().nullable(),
    bullets: z.array(z.string()),
  }),

  chapters: z.array(reportChapterSchema),
  locked_chapters: z.array(lockedChapterSchema),

  /** §2 annex — the audit's outreach problems in owner-facing framing,
      unioned across visible chapters, deduped by problem text. */
  problems: z.array(reportProblemSchema),

  /** §6.5 "How this report was made" — unioned across included chapters. */
  data_quality: z.object({
    verified: z.array(z.string()),
    couldnt_check: z.array(z.string()),
    limitations: z.array(z.string()),
  }),

  /** §6.6 — claim URL when any sibling is seeded, else ops contact. */
  cta: z.object({
    kind: z.enum(['claim', 'contact']),
    label: z.string(),
    url: z.string().nullable(),
  }),
});

export type ProspectReportDto = z.infer<typeof prospectReportSchema>;
