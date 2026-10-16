/**
 * Archetype facts — the shared audit core every archetype-scoped consumer reads.
 *
 * Phase 2 of the shared-delegate work. Phase 1 (`lib/platform-presence`) made
 * platform presence single-sourced. This module adds the other half of the
 * shared core — normalized review counts — and exposes both under one
 * archetype-scoped call, so the two parallel extractions can no longer drift:
 *
 *   - `ProspectReportService.archetypeFactSlice` — the archetype briefing's
 *     `{{archetype_extract}}` and the owner-report chapters
 *   - `outreach-openers/field-extractors` — the A1/A2/A5/A8 opener inputs
 *
 * They are two genuinely different *audiences* (owner-safe report facts vs
 * pitch inputs) and legitimately carry different keys. What they must never
 * disagree about is the shared core: which platforms the business is on, and
 * how many reviews are unanswered. That core lives here.
 *
 * LEAF module — imports only from `lib/`, so the report service and the
 * outreach layer can both depend on it without a cycle.
 */
import { platformPresence, type PlatformPresence } from './platform-presence';

/**
 * Review counts, normalized from `combined_review_metrics` in ONE place.
 *
 * Every consumer used to read the raw field ad hoc (`m.observable_unanswered_
 * reviews`, `m.observable_unanswered_positive_reviews`, …), which is how a
 * magnitude rule can end up reading a key the audit never writes — the audit
 * schema declares `observable_*` names, so a read of `total_reviews` silently
 * resolves to null and the rule degrades to its fallback.
 */
export interface ReviewCounts {
  total: number | null;
  withResponse: number | null;
  unanswered: number | null;
  unansweredNegative: number | null;
  unansweredPositive: number | null;
  responseRate: number | null;
  unansweredRate: number | null;
  oldestUnanswered: string | null;
  newestUnanswered: string | null;
  /** The audit's own honesty flag — false when some platform counts were unavailable. */
  countsComplete: boolean;
}

export interface ArchetypeFacts {
  archetype: string;
  /** Single-sourced platform presence. */
  presence: PlatformPresence;
  /** Single-sourced review counts. */
  counts: ReviewCounts;
  /**
   * Per-platform `profile_status`, for consumers that render a status table
   * (the A3 briefing's `platform_statuses`, the drift clause's inputs).
   */
  platformStatuses: Record<string, string | null>;
}

interface AuditLike {
  platforms?: Record<string, unknown> | null;
  render_controls?: Array<{ platform?: string | null; determination?: string | null }> | null;
  combined_review_metrics?: Record<string, unknown> | null;
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

export function reviewCounts(auditData: unknown): ReviewCounts {
  const audit = (auditData ?? {}) as AuditLike;
  const m = (audit.combined_review_metrics ?? {}) as Record<string, unknown>;
  return {
    total: num(m.observable_total_reviews),
    withResponse: num(m.observable_reviews_with_response),
    unanswered: num(m.observable_unanswered_reviews),
    unansweredNegative: num(m.observable_unanswered_negative_reviews),
    unansweredPositive: num(m.observable_unanswered_positive_reviews),
    responseRate: num(m.observable_response_rate_percent),
    unansweredRate: num(m.observable_unanswered_rate_percent),
    oldestUnanswered: (m.oldest_unanswered_review as string | null) ?? null,
    newestUnanswered: (m.newest_unanswered_review as string | null) ?? null,
    countsComplete: m.counts_complete === true,
  };
}

/**
 * The shared audit core for an archetype. `archetype` is accepted for symmetry
 * with the consumers' signatures (and so a future archetype-specific core can
 * branch here) — the core itself is archetype-independent today.
 */
export function archetypeFacts(
  archetype: string,
  auditData: unknown,
): ArchetypeFacts {
  const audit = (auditData ?? {}) as AuditLike;
  const platforms = (audit.platforms ?? {}) as Record<string, any>;
  return {
    archetype,
    presence: platformPresence(auditData),
    counts: reviewCounts(auditData),
    platformStatuses: Object.fromEntries(
      Object.entries(platforms)
        .filter(([, p]) => p && typeof p === 'object' && (p as any).profile_status)
        .map(([k, p]) => [k, (p as any).profile_status ?? null]),
    ),
  };
}

/**
 * The core as prompt-injectable keys.
 *
 * Spread into an archetype's fact slice so the briefing sees the same presence
 * and counts the opener does — the REPORT CONSISTENCY directive then makes a
 * briefing-vs-report disagreement a prompt violation rather than a risk.
 */
export function sharedCoreKeys(facts: ArchetypeFacts): Record<string, unknown> {
  const p = facts.presence;
  return {
    platform_presence: {
      present: p.presentKeys,
      claimed: p.claimedKeys,
      unclaimed: p.unclaimedKeys,
      missing: p.missingKeys,
      restricted: p.restrictedKeys,
      evidenced: p.evidencedKeys,
    },
    platform_statuses: facts.platformStatuses,
    review_counts: facts.counts,
  };
}
