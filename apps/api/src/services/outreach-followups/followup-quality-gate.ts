/**
 * Outreach Follow-Up — Quality Gate
 *
 * Automated checker applied to every generated follow-up. Different
 * rules from the opener gate because the follow-up has different
 * structural requirements:
 *
 *   - Must reference prior contact ("since the snapshot" / "following
 *     up on") — the follow-up anchors to the opener, not to a new
 *     first touch.
 *   - Must NOT repeat the opener's handshake ("Pulled together a quick
 *     visibility snapshot") — that line establishes first contact and
 *     has no place in a follow-up.
 *   - Must NOT use lazy follow-up phrases ("just following up",
 *     "checking in", "circling back") — these signal low effort and
 *     trigger the prospect's ignore reflex.
 *   - Doing branch must reference something new (new reviews, new
 *     themes) — if the branch is 'doing' but the text has no new
 *     information, the gate fails.
 *   - Telling branch must reference existing previews — the reminder
 *     needs to point at the work, not just say "following up."
 *
 * Shared rules with the opener gate:
 *   - No pricing, tier labels, opportunity-score jargon
 *   - No exclamation points, no emojis
 *   - Must have salutation + signoff + close line
 */

import type { FollowUpType } from './followup-prompts';

export interface FollowUpQualityGateResult {
  passed: boolean;
  issues: string[];
}

// ─── Forbidden term patterns (shared with opener gate) ──────────────────

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
  { pattern: /high.attention/i, label: 'high-attention jargon' },
];

// ─── Follow-up-specific forbidden phrases ───────────────────────────────

const LAZY_FOLLOWUP_PHRASES: { pattern: RegExp; label: string }[] = [
  { pattern: /just following up/i, label: 'lazy phrase "just following up"' },
  { pattern: /just checking in/i, label: 'lazy phrase "just checking in"' },
  { pattern: /circling back/i, label: 'lazy phrase "circling back"' },
  { pattern: /touching base/i, label: 'lazy phrase "touching base"' },
  { pattern: /wanted to see if/i, label: 'lazy phrase "wanted to see if"' },
];

// ─── Required element patterns ──────────────────────────────────────────

const SALUTATION_RE = /^Hi .+/m;
const SIGNOFF_PLACEHOLDER_RE = /—\s*\[your name\]/;
const SIGNOFF_REAL_RE = /—\s*(?!\[your name\])[^\s][^\n]{0,59}$/m;

// Context anchor — must reference the prior touch (opener).
// Accepts "since the snapshot" or "following up on the ... snapshot"
const CONTEXT_ANCHOR_RE = /since the snapshot|following up on the .*snapshot/i;

// Close line — same as opener gate
const CLOSE_RE = /full deliverable.*within a day/i;

// Opener handshake — must NOT appear in a follow-up
const OPENER_HANDSHAKE_RE = /pulled together a quick visibility snapshot/i;

// Preview reference — must reference existing or updated previews
const PREVIEW_REF_RE = /preview/i;

// Doing branch — must reference something new
const DOING_NEW_RE = /new |more |updated |since/i;

// Telling branch — must reference existing previews
const TELLING_EXISTING_RE = /still there|still available|attached/i;

// ─── Emoji detection ────────────────────────────────────────────────────

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

// ─── Gate ───────────────────────────────────────────────────────────────

/**
 * Run the quality gate against a follow-up text.
 * Pure function, no side effects.
 *
 * @param followUpText  The generated/pasted follow-up text.
 * @param followUpType  The branch ('doing' | 'telling') — used for
 *                       branch-specific rules.
 */
export function runFollowUpQualityGate(
  followUpText: string,
  followUpType: FollowUpType,
): FollowUpQualityGateResult {
  const issues: string[] = [];

  // Strip salutation and signoff to isolate the body for word counting.
  const body = followUpText
    .replace(/^Hi .+[—,-]\s*/m, '')
    .replace(/—\s*(?:\[your name\]|[^\s].*)\s*$/m, '')
    .trim();

  const words = body.split(/\s+/).filter(Boolean);

  // Word count — follow-ups are shorter than openers.
  // Doing: ~70 words max. Telling: ~60 words max. Hard cap at 75.
  if (words.length > 75) {
    issues.push(`Body exceeds 75 words (${words.length})`);
  }

  // Forbidden terms (shared with opener gate).
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(followUpText)) {
      issues.push(`Forbidden term: ${label}`);
    }
  }

  // Lazy follow-up phrases.
  for (const { pattern, label } of LAZY_FOLLOWUP_PHRASES) {
    if (pattern.test(followUpText)) {
      issues.push(`Lazy phrase: ${label}`);
    }
  }

  // Required elements.
  if (!SALUTATION_RE.test(followUpText)) {
    issues.push('Missing salutation');
  }
  if (!CONTEXT_ANCHOR_RE.test(followUpText)) {
    issues.push('Missing context anchor ("since the snapshot" or "following up on the ... snapshot")');
  }
  if (!PREVIEW_REF_RE.test(followUpText)) {
    issues.push('Missing preview reference');
  }
  if (!CLOSE_RE.test(followUpText)) {
    issues.push('Missing close ("full deliverable within a day")');
  }
  if (!SIGNOFF_PLACEHOLDER_RE.test(followUpText) && !SIGNOFF_REAL_RE.test(followUpText)) {
    issues.push('Missing signoff ("— [your name]" or "— <your name>")');
  }

  // Must NOT repeat the opener's handshake.
  if (OPENER_HANDSHAKE_RE.test(followUpText)) {
    issues.push('Repeats opener handshake ("Pulled together a quick visibility snapshot")');
  }

  // Branch-specific rules.
  if (followUpType === 'doing') {
    if (!DOING_NEW_RE.test(followUpText)) {
      issues.push('Doing branch must reference something new (new reviews, more reviews, updated)');
    }
  } else if (followUpType === 'telling') {
    if (!TELLING_EXISTING_RE.test(followUpText)) {
      issues.push('Telling branch must reference existing previews ("still there" / "attached")');
    }
  }

  // No exclamation points.
  if (/!/.test(followUpText)) {
    issues.push('Exclamation point present');
  }

  // No emojis.
  if (EMOJI_RE.test(followUpText)) {
    issues.push('Emoji present');
  }

  return { passed: issues.length === 0, issues };
}
