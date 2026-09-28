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
 * Owner-safety contract: `detected_signals` (internal WC_* taxonomy) and
 * `outreach_problems` (sales ammunition) never appear anywhere in this DTO.
 * `data_quality` is the honesty footer — what was verified, what couldn't be
 * checked, and the audit's own limitations.
 */

import { z } from 'zod';

// ─── Tiers & chapter ids (§5.1a, §0.4 sprint plan) ────────────────────────

export const PROSPECT_REPORT_TIERS = ['free', 'full'] as const;
export type ProspectReportTier = (typeof PROSPECT_REPORT_TIERS)[number];
export const prospectReportTierSchema = z.enum(PROSPECT_REPORT_TIERS);

/**
 * Chapter ids key on the audit source, never a playbook code. `website` is
 * the only registered builder at v1; `repair` reserves its id so signed
 * tokens minted today stay valid when its builder lands (OQ-5).
 */
export const PROSPECT_REPORT_CHAPTER_IDS = ['website', 'repair'] as const;
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

const websiteChapterSchema = z.object({
  chapter_id: z.literal('website'),
  title: z.string(),
  audited_at: z.string(),
  /** Category label for interpolated section titles ("leading {category}…"). */
  category: z.string().nullable(),
  summary: z.string().nullable(),

  /** presence × ownership gloss (§3.2) — the verdict sentence. */
  verdict: z.string(),

  /** "Already working" — met positioning_gaps (§3.3), credibility first. */
  already_working: z.array(z.string()),

  /** "What's costing you customers" — issues sorted non_negotiable first. */
  costing_customers: z.array(reportIssueSchema),

  /** "What {category} customers expect" — unmet positioning_gaps (§3.3). */
  expectations: z.array(reportExpectationSchema),

  /** "What leading {category} businesses do" — competitive_frame verbatim. */
  competitive_frame: z.array(z.string()),

  /** "The fix" — delivery-mode reframe (§4) + scope notes + gated page plan. */
  fix: z.object({
    headline: z.string(),
    scope_notes: z.string().nullable(),
    /** must_have_pages — null unless the operator's page-plan flag signed in. */
    page_plan: z.array(z.string()).nullable(),
  }),
});

export type WebsiteChapterDto = z.infer<typeof websiteChapterSchema>;

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

  chapters: z.array(z.discriminatedUnion('chapter_id', [websiteChapterSchema])),
  locked_chapters: z.array(lockedChapterSchema),

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
export type ProspectReportChapterDto = ProspectReportDto['chapters'][number];
