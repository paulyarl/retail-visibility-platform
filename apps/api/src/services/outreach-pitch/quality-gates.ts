/**
 * Outreach Pitch — Quality Gates
 *
 * Component-specific automated checkers applied to AI-generated and
 * externally-imported variants:
 *   - runHeaderQualityGate — subject-line checks (length, spam triggers,
 *     archetype-aware signal reference, off-topic rejection for A6,
 *     no emoji/exclamation)
 *   - runCloserQualityGate  — closer checks (must contain a number, ≤25 words,
 *     archetype-aware itch keyword reference, no emoji/exclamation)
 *
 * Both gates accept an optional `archetype` param ('A1'–'A6'). When provided,
 * the "must reference the pain" check uses per-archetype itch keywords
 * instead of the legacy hardcoded "responses"/"replies" regex, so a
 * product-visibility (A6) closer that says "visibility plan" passes, while a
 * listing-inconsistency (A3) closer that says "directories" passes. When
 * omitted, the gates fall back to the A1/A2 review-response keyword set
 * (full backward compatibility for legacy callers and stored variants).
 *
 * No gate for Contact (free-text operator footer) and no gate for
 * review/response pairs (the review is real public text, the response is
 * operator-approved).
 *
 * See: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §3, §5.7
 *      docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md §5.6
 */

export interface QualityGateResult {
  passed: boolean;
  issues: string[];
}

// ─── Archetype itch keywords ─────────────────────────────────────────────
//
// Each archetype's "itch" — the pain the pitch surfaces — has a
// characteristic vocabulary. The closer must reference at least one keyword
// from its archetype's set (the "more proof exists" itch). The header should
// reference one too (the "name the pain" specificity check).
//
// A5 (Multi-Signal Footprint) is the union of A1+A3 — its closers talk about
// "pieces", "sections", "gaps", "listings", and "responses" interchangeably.
// A6 (Product Visibility) is off-topic for reviews/booking — its keyword set
// is product-discoverability vocabulary, and the gate also rejects
// review/booking references for A6 headers (mirrors the A6 prompt's explicit
// "Do NOT reference reviews or booking" instruction).

interface ArchetypeKeywords {
  /** Regex patterns that satisfy the "must reference the itch" check. */
  itch: RegExp[];
  /** Human-readable label for the itch (used in gate issue messages). */
  itchLabel: string;
  /** Regex patterns that are off-topic for this archetype (header only). */
  offTopic?: RegExp[];
  /** Human-readable label for the off-topic rejection (used in issues). */
  offTopicLabel?: string;
}

const ARCHETYPE_KEYWORDS: Record<string, ArchetypeKeywords> = {
  A1: {
    itch: [/\bresponses?\b/i, /\breplies?\b/i, /\breviews?\b/i, /\bunanswered\b/i],
    itchLabel: '"responses", "replies", or "reviews"',
  },
  A2: {
    itch: [/\bresponses?\b/i, /\breplies?\b/i, /\breviews?\b/i, /\bnegative\b/i, /\bcomplaints?\b/i, /\btheme\b/i],
    itchLabel: '"responses", "replies", "negative", or "complaints"',
  },
  A3: {
    itch: [/\blistings?\b/i, /\bdirectories?\b/i, /\bprofiles?\b/i, /\baddress\b/i, /\bunclaimed\b/i, /\blocation\b/i, /\bphone\b/i, /\bNAP\b/i],
    itchLabel: '"listings", "directories", "profiles", or "address"',
  },
  A4: {
    itch: [/\bfix\b/i, /\btweaks?\b/i, /\bbutton\b/i, /\bbooking\b/i, /\bconversion\b/i, /\bclick-to-call\b/i, /\bscheduling\b/i, /\bvisitors?\b/i, /\bwebsite\b/i, /\bCTA\b/i],
    itchLabel: '"fix", "tweaks", "button", "booking", or "conversion"',
  },
  A5: {
    itch: [/\bpieces?\b/i, /\bsections?\b/i, /\bgaps?\b/i, /\blistings?\b/i, /\bprofiles?\b/i, /\bresponses?\b/i, /\breplies?\b/i, /\breviews?\b/i, /\bunclaimed\b/i, /\bunanswered\b/i, /\bfootprint\b/i, /\bpresence\b/i],
    itchLabel: '"pieces", "sections", "gaps", "listings", or "responses"',
  },
  A6: {
    itch: [/\bphotos?\b/i, /\bcatalog\b/i, /\bvisibility\b/i, /\bproducts?\b/i, /\bstore\b/i, /\bstorefront\b/i, /\bbrowse\b/i, /\binventory\b/i, /\bdiscoverability\b/i, /\bavailability\b/i, /\bplan\b/i, /\bsections?\b/i, /\bpieces?\b/i],
    itchLabel: '"photos", "catalog", "visibility", "products", or "store"',
    offTopic: [/\breviews?\b/i, /\bbooking\b/i, /\breservations?\b/i],
    offTopicLabel: 'reviews or booking (this is a product-discoverability archetype, not a review or booking problem)',
  },
};

/**
 * Resolve the keyword set for an archetype. Falls back to A1 (review-response)
 * when the archetype is unknown or omitted — matches the opener resolver's
 * fallback behavior and preserves backward compatibility for legacy callers.
 */
function resolveKeywords(archetype?: string): ArchetypeKeywords {
  return ARCHETYPE_KEYWORDS[archetype ?? 'A1'] ?? ARCHETYPE_KEYWORDS.A1;
}

// ─── Shared ──────────────────────────────────────────────────────────────

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\$[\d,]+/i, label: 'pricing ($ amount)' },
  { pattern: /\btier\s*\d/i, label: 'tier label' },
  { pattern: /digital opportunity score/i, label: 'digital opportunity score' },
  { pattern: /\bHTTPS\b/i, label: 'HTTPS mention' },
  { pattern: /mobile-friendly/i, label: 'mobile-friendly mention' },
  { pattern: /\bSSL\b/i, label: 'SSL mention' },
  { pattern: /recommended (for )?tier/i, label: 'tier recommendation' },
  { pattern: /estimated.*fee/i, label: 'fee estimate' },
  { pattern: /monthly service/i, label: 'monthly service mention' },
];

// ─── Header (Subject Line) ───────────────────────────────────────────────

const HEADER_SPAM_TRIGGERS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bfree\b/i, label: 'spam trigger: "free"' },
  { pattern: /\bguarantee\b/i, label: 'spam trigger: "guarantee"' },
  { pattern: /\bact now\b/i, label: 'spam trigger: "act now"' },
  { pattern: /\burgent\b/i, label: 'spam trigger: "urgent"' },
  { pattern: /\b[A-Z]{4,}\b/, label: 'all-caps word (spam trigger)' },
];

/**
 * Run the header quality gate against a subject-line text.
 *
 * When `archetype` is provided, two archetype-aware checks are added:
 *   1. Must reference at least one keyword from the archetype's itch set
 *      (the "name the pain" specificity check).
 *   2. For A6: must NOT reference off-topic terms (reviews, booking) —
 *      mirrors the A6 prompt's explicit "Do NOT reference reviews or booking"
 *      instruction.
 *
 * Pure function, no side effects.
 */
export function runHeaderQualityGate(headerText: string, archetype?: string): QualityGateResult {
  const issues: string[] = [];
  const text = headerText.trim();
  const keywords = resolveKeywords(archetype);

  // Length: 4–60 characters.
  if (text.length < 4) {
    issues.push(`Subject line too short (${text.length} chars, min 4)`);
  }
  if (text.length > 60) {
    issues.push(`Subject line too long (${text.length} chars, max 60)`);
  }

  // Spam triggers.
  for (const { pattern, label } of HEADER_SPAM_TRIGGERS) {
    if (pattern.test(text)) {
      issues.push(label);
    }
  }

  // Shared forbidden terms.
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(`Forbidden term: ${label}`);
    }
  }

  // Archetype-aware: must reference the archetype's signal (the itch).
  if (archetype) {
    const hasItch = keywords.itch.some((re) => re.test(text));
    if (!hasItch) {
      issues.push(`Header must reference the campaign's signal (${keywords.itchLabel})`);
    }

    // Archetype-aware: reject off-topic terms (A6 must not mention reviews/booking).
    if (keywords.offTopic) {
      for (const re of keywords.offTopic) {
        if (re.test(text)) {
          issues.push(`Header references ${keywords.offTopicLabel}`);
          break;
        }
      }
    }
  }

  // No exclamation points.
  if (/!/.test(text)) {
    issues.push('Exclamation point present');
  }

  // No emojis.
  if (EMOJI_RE.test(text)) {
    issues.push('Emoji present');
  }

  return { passed: issues.length === 0, issues };
}

// ─── Closer ──────────────────────────────────────────────────────────────

/**
 * Run the closer quality gate against a closer-line text.
 *
 * When `archetype` is provided, the "must reference the itch" check uses the
 * archetype's keyword set instead of the legacy hardcoded "responses"/"replies"
 * regex. A product-visibility (A6) closer that says "visibility plan" passes;
 * a listing-inconsistency (A3) closer that says "directories" passes. When
 * omitted, falls back to A1 (review-response) keywords for backward compat.
 *
 * Pure function, no side effects.
 */
export function runCloserQualityGate(closerText: string, archetype?: string): QualityGateResult {
  const issues: string[] = [];
  const text = closerText.trim();
  const keywords = resolveKeywords(archetype);

  // Must contain a number (the remaining count).
  if (!/\d+/.test(text)) {
    issues.push('Closer must contain a number (the remaining count)');
  }

  // ≤ 25 words.
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 25) {
    issues.push(`Closer exceeds 25 words (${words.length})`);
  }

  // Must reference the archetype's itch keyword (the "more proof exists" hook).
  const hasItch = keywords.itch.some((re) => re.test(text));
  if (!hasItch) {
    issues.push(`Closer must reference the campaign's signal (${keywords.itchLabel})`);
  }

  // Shared forbidden terms.
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(`Forbidden term: ${label}`);
    }
  }

  // No exclamation points.
  if (/!/.test(text)) {
    issues.push('Exclamation point present');
  }

  // No emojis.
  if (EMOJI_RE.test(text)) {
    issues.push('Emoji present');
  }

  return { passed: issues.length === 0, issues };
}
