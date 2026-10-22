/**
 * hasdata-ground-truth-directive.ts — the `google_maps_ground_truth`
 * run-mode directive (OUTREACH_TOUCH_LADDER_SPEC §14).
 *
 * Sibling of operator-profile-evidence-directive.ts: a caller-supplied
 * variable (`google_maps_ground_truth` — '' | 'latest' | 'deep') opts a
 * render into a live Google Maps packet fetched-or-cached through
 * HasDataGroundTruthService and injected as context blocks ahead of the
 * body. Never a body placeholder — no seed/whitelist changes, blank is a
 * byte-identical run.
 *
 * Unlike the evidence-file directive the gate is NOT text-only: 'latest'/
 * 'deep' spends HasData credits (cache-first, TTL-gated). Failure — no
 * key, fetch error, unresolved place — injects an `unavailable` line and
 * the render proceeds (§14.1a FALLBACK semantics).
 *
 * Bump GOOGLE_MAPS_GROUND_TRUTH_DIRECTIVE_VERSION when the block text
 * changes so execution logs can identify which version produced a run.
 */
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import HasDataGroundTruthService, {
  type GroundTruthLevel,
  type GroundTruthPacket,
} from './HasDataGroundTruthService';
import { unifiedConfig } from '../config/unifiedConfig';

export const GOOGLE_MAPS_GROUND_TRUTH_DIRECTIVE_VERSION = 'gmaps_ground_truth_v1';

/** Caller-supplied variable carrying the opt-in level. */
export const GROUND_TRUTH_VARIABLE = 'google_maps_ground_truth';

const LEVELS: ReadonlySet<string> = new Set(['latest', 'deep']);

/** '' | 'off' | 'false' | 'none' → off; 'latest' | 'deep' → that level. */
export function resolveGroundTruthLevel(variables?: Record<string, any> | null): GroundTruthLevel | null {
  const v = String(variables?.[GROUND_TRUTH_VARIABLE] ?? '').trim().toLowerCase();
  return LEVELS.has(v) ? (v as GroundTruthLevel) : null;
}

/**
 * Fetch-or-cache the packet and build the context blocks for a campaign
 * render. Returns '' for off; an explicit unavailable line for failures
 * (the analyst should know the signal was requested and could not be
 * produced — not fabricated, not silently absent).
 */
export async function buildGroundTruthPreamble(
  campaignId: string,
  variables?: Record<string, any> | null,
  ctx?: RequestCtx,
): Promise<string> {
  const level = resolveGroundTruthLevel(variables);
  if (!level) return '';

  if (!unifiedConfig.hasdataApiKey) {
    return `=== GOOGLE MAPS GROUND TRUTH ===\n\nground_truth: unavailable (HASDATA_API_KEY not configured). Proceed without this signal — corpus fields (unanswered rate, topics) mark not_measured rather than fabricating.\n=== END GOOGLE MAPS GROUND TRUTH ===\n\n`;
  }

  const packet = await HasDataGroundTruthService.getPacket(campaignId, level, ctx);
  if (!packet) {
    return `=== GOOGLE MAPS GROUND TRUTH ===\n\nground_truth: unavailable (fetch failed or place unresolved — level: ${level}). Proceed without this signal — corpus fields mark not_measured rather than fabricating.\n=== END GOOGLE MAPS GROUND TRUTH ===\n\n`;
  }

  logger.info('Google Maps ground truth emitted', ctx, {
    campaignId,
    level,
    directiveVersion: GOOGLE_MAPS_GROUND_TRUTH_DIRECTIVE_VERSION,
    creditsSpent: packet.credits_spent,
    reviewCorpus: packet.review_corpus_size,
  });

  return buildGroundTruthBlock(packet) + '\n\n' + buildReviewCorpusBlock(packet) + '\n\n';
}

// ─── Blocks ─────────────────────────────────────────────────────────────

function buildGroundTruthBlock(p: GroundTruthPacket): string {
  const lines: string[] = [
    `=== GOOGLE MAPS GROUND TRUTH (live listing data — HasData, ${p.level} level) ===`,
    ``,
    `LINEAGE — fetched ${p.fetched_at} from the business's live Google Maps listing (place_id: ${p.place_id ?? 'n/a'}). Treat these as measured facts about the listing surface — the same surface customers see. Fields absent from the packet were not measured; mark them not_measured, never inferred.`,
    ``,
    `Listing: ${p.business_name ?? 'unknown'}`,
    `Type: ${p.primary_type ?? 'unknown'}${p.types.length ? ` (additional: ${p.types.join(', ')})` : ''}`,
    `Rating: ${p.rating ?? 'n/a'} · Reviews: ${p.review_count ?? 'n/a'}`,
    `Phone: ${p.phone ?? 'n/a'} · Website: ${p.website ?? 'n/a'}`,
    `Address: ${p.address ?? 'n/a'}`,
  ];
  if (p.topics.length) {
    lines.push(`Topic clusters (Google's own review themes): ${p.topics.join(', ')}`);
  }
  if (p.posts_count !== null) {
    lines.push(`Google Posts: ${p.posts_count === 0 ? 'none published' : `${p.posts_count} published`}`);
  }
  if (p.photos_count !== null) {
    lines.push(`Photos: ${p.photos_count}`);
  }
  lines.push(
    ``,
    `USE — these fields manufacture attributable pains: findings the prospect can verify on their own surface (verified_on_surface confidence). A label-vs-reality gap (e.g. listed "Grocery store" operating as a wholesaler) is itself a category-identification finding. Corpus-derived rates are over the OBSERVABLE latest reviews, not totals — label them as such.`,
    `=== END GOOGLE MAPS GROUND TRUTH ===`,
  );
  return lines.join('\n');
}

function buildReviewCorpusBlock(p: GroundTruthPacket): string {
  if (p.reviews.length === 0) {
    return `=== REVIEW CORPUS ===\n\nNo review rows returned in this packet (level: ${p.level}). Do not emit review-corpus findings (response rates, negative themes) from an empty corpus.\n=== END REVIEW CORPUS ===`;
  }
  const pct = p.owner_response_rate_observable !== null
    ? `${Math.round(p.owner_response_rate_observable * 100)}%`
    : 'n/a';
  const lines: string[] = [
    `=== REVIEW CORPUS (latest ${p.reviews.length} reviews — observable sample, not the full ${p.review_count ?? '?'} total) ===`,
    ``,
    `Owner response rate (observable corpus): ${pct} (${p.reviews.filter((r) => r.owner_responded).length}/${p.reviews.length})`,
    `Latest review: ${p.latest_review_at ?? 'n/a'}`,
    ``,
  ];
  for (const r of p.reviews) {
    const stars = r.rating !== null ? `${r.rating}★` : '?';
    const resp = r.owner_responded ? ' [owner responded]' : ' [no owner response]';
    const text = (r.text ?? '').replace(/\s+/g, ' ').slice(0, 400);
    lines.push(`- ${stars} · ${r.date ?? 'undated'}${resp}${text ? ` — "${text}"` : ''}`);
  }
  lines.push(
    ``,
    `USE — compute unanswered-review examples and negative/positive themes from THIS corpus only. Do not name reviewers or quote personal details in customer-facing surfaces; findings cite ratings, dates, and themes.`,
    `=== END REVIEW CORPUS ===`,
  );
  return lines.join('\n');
}
