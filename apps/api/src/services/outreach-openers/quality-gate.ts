/**
 * Outreach Opener — Quality Gate
 *
 * Automated checker applied to every generated opener (both paths).
 * Validates: word count, one-stat rule, forbidden terms, required
 * elements, no emojis, no exclamation points.
 *
 * See: docs/LocalBiz/marketing_ops_outreach_opener_sprint_plan.md §6
 */

export interface QualityGateResult {
  passed: boolean;
  issues: string[];
}

// ─── Forbidden term patterns ────────────────────────────────────────────

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

// ─── Required element patterns ──────────────────────────────────────────

const SALUTATION_RE = /^Hi .+/m;
const PREVIEW_REF_RE = /three previews attached/i;
const CLOSE_RE = /full deliverable.*within a day/i;

// Signoff — accepts either the literal placeholder ("— [your name]") OR a
// real substituted name ("— Alex"). The placeholder is what the prompt
// templates emit and what Path 1 (AI execute) produces; Path 2 (external
// import) is the operator pasting a finished opener, where they are
// expected to have replaced [your name] with their actual name. Penalizing
// a real name turned the import path into a guaranteed gate failure.
//
// Matches a line ending in "—" followed by 1–60 non-empty chars that are
// NOT the literal "[your name]" placeholder. The placeholder branch is
// checked separately so both forms pass.
const SIGNOFF_PLACEHOLDER_RE = /—\s*\[your name\]/;
const SIGNOFF_REAL_RE = /—\s*(?!\[your name\])[^\s][^\n]{0,59}$/m;

// ─── Emoji detection ────────────────────────────────────────────────────

const EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

// ─── Gate ───────────────────────────────────────────────────────────────

/**
 * Run the quality gate against an opener text.
 * Pure function, no side effects.
 */
export function runQualityGate(openerText: string): QualityGateResult {
  const issues: string[] = [];

  // Strip salutation and signoff to isolate the body for word/stat counting.
  // Strip either the placeholder signoff or a real substituted name.
  const body = openerText
    .replace(/^Hi .+[—,-]\s*/m, '')
    .replace(/—\s*(?:\[your name\]|[^\s].*)\s*$/m, '')
    .trim();

  const words = body.split(/\s+/).filter(Boolean);

  // Word count — body should be ~80 words, hard cap at 85.
  if (words.length > 85) {
    issues.push(`Body exceeds 85 words (${words.length})`);
  }

  // One-stat rule — count standalone numbers, excluding years.
  const allNumbers = body.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
  const stats = allNumbers.filter((n) => !n.match(/^(20\d{2}|19\d{2})$/));
  if (stats.length > 1) {
    issues.push(`More than one stat in hook: ${stats.join(', ')}`);
  }

  // Forbidden terms.
  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    if (pattern.test(openerText)) {
      issues.push(`Forbidden term: ${label}`);
    }
  }

  // Required elements.
  if (!SALUTATION_RE.test(openerText)) {
    issues.push('Missing salutation');
  }
  if (!PREVIEW_REF_RE.test(openerText)) {
    issues.push('Missing preview reference ("three previews attached")');
  }
  if (!CLOSE_RE.test(openerText)) {
    issues.push('Missing close ("full deliverable within a day")');
  }
  if (!SIGNOFF_PLACEHOLDER_RE.test(openerText) && !SIGNOFF_REAL_RE.test(openerText)) {
    issues.push('Missing signoff ("— [your name]" or "— <your name>")');
  }

  // No exclamation points.
  if (/!/.test(openerText)) {
    issues.push('Exclamation point present');
  }

  // No emojis.
  if (EMOJI_RE.test(openerText)) {
    issues.push('Emoji present');
  }

  return { passed: issues.length === 0, issues };
}
