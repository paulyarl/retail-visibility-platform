/**
 * Outreach Pitch — Quality Gates
 *
 * Component-specific automated checkers applied to AI-generated and
 * externally-imported variants:
 *   - runHeaderQualityGate — subject-line checks (length, spam triggers,
 *     specificity, no emoji/exclamation)
 *   - runCloserQualityGate  — closer checks (must contain a number, ≤25 words,
 *     references "responses"/"replies", no emoji/exclamation)
 *
 * No gate for Contact (free-text operator footer) and no gate for
 * review/response pairs (the review is real public text, the response is
 * operator-approved).
 *
 * See: docs/LocalBiz/marketing_ops_outreach_pitch_construction_sprint_plan.md §3, §5.7
 */

export interface QualityGateResult {
  passed: boolean;
  issues: string[];
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
 * Pure function, no side effects.
 */
export function runHeaderQualityGate(headerText: string): QualityGateResult {
  const issues: string[] = [];
  const text = headerText.trim();

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
 * Pure function, no side effects.
 */
export function runCloserQualityGate(closerText: string): QualityGateResult {
  const issues: string[] = [];
  const text = closerText.trim();

  // Must contain a number (the remaining count).
  if (!/\d+/.test(text)) {
    issues.push('Closer must contain a number (the remaining count)');
  }

  // ≤ 25 words.
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 25) {
    issues.push(`Closer exceeds 25 words (${words.length})`);
  }

  // Must reference "responses" or "replies" (the itch).
  if (!/responses|replies/i.test(text)) {
    issues.push('Closer must reference "responses" or "replies"');
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
