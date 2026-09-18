/**
 * Deliverable quality gates — lightweight checks applied to fulfill output
 * before render.
 *
 * Two gates (spec §7.4, §5.5):
 *   - runDeliverableQualityGate — content sanity for the 7 non-review types
 *     (non-empty, length, no exclamation, no hype superlatives, no unsourced
 *     pricing). The review-response type has its own gate (review pipeline).
 *   - runRepetitionGate — flags deliverable copy that repeats the campaign's
 *     already-sent outreach phrasing (near-verbatim opener/pitch hook reuse).
 *
 * Both are pure functions. Results surface as warnings, not hard blocks —
 * matching the openers workspace behavior.
 *
 * Spec: docs/LocalBiz/marketing_ops_deliverable_source_material_spec.md §5.5, §7.4
 */

export interface DeliverableGateResult {
  passed: boolean;
  issues: string[];
}

const EXCLAMATION_RE = /!/;
const SUPERLATIVE_RE = /\b(best|#1|number one|world[- ]class|unbeatable|guaranteed|amazing|incredible)\b/i;
const PRICING_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

const MIN_CONTENT_CHARS = 80;

/**
 * Content sanity gate for a fulfill deliverable.
 *
 * @param type        the deliverable type (informational)
 * @param content     the fulfill output text
 * @param sourceText  the source material the content was built from — pricing
 *                    present here is allowed; pricing absent here is flagged
 */
export function runDeliverableQualityGate(
  type: string,
  content: string,
  sourceText?: string,
): DeliverableGateResult {
  const issues: string[] = [];
  const text = (content ?? '').trim();

  if (text.length === 0) {
    return { passed: false, issues: ['content is empty'] };
  }
  if (text.length < MIN_CONTENT_CHARS) {
    issues.push(`content is very short (${text.length} chars) — may be a failed generation`);
  }
  if (EXCLAMATION_RE.test(text)) {
    issues.push('contains an exclamation mark (owner-facing tone forbids it)');
  }
  const superlative = text.match(SUPERLATIVE_RE);
  if (superlative) {
    issues.push(`contains hype/superlative language ("${superlative[0]}")`);
  }
  const prices = text.match(PRICING_RE) ?? [];
  if (prices.length > 0) {
    const source = sourceText ?? '';
    const unsourced = prices.filter((p) => !source.includes(p));
    if (unsourced.length > 0) {
      issues.push(`contains pricing not present in the source material (${unsourced.join(', ')})`);
    }
  }

  return { passed: issues.length === 0, issues };
}

// ─── Repetition gate (§5.5) ──────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'is', 'are',
  'you', 'your', 'we', 'our', 'it', 'this', 'that', 'with', 'as', 'at', 'be', 'by',
  'from', 'have', 'has', 'not', 'no', 'if', 'so', 'they', 'their', 'them', 'i',
]);

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP_WORDS.has(w));
}

function splitSentences(s: string): string[] {
  return s.split(/[.!?\n]+/).map((x) => x.trim()).filter((x) => x.length > 0);
}

function overlapRatio(a: string[], b: Set<string>): number {
  if (a.length === 0) return 0;
  const hits = a.filter((w) => b.has(w)).length;
  return hits / a.length;
}

/**
 * Flag deliverable copy that repeats the campaign's already-sent outreach.
 * Compares each deliverable sentence against each prior-outreach line; a
 * normalized token overlap above `threshold` is a near-verbatim repeat.
 */
export function runRepetitionGate(
  content: string,
  priorOutreach: string,
  threshold = 0.7,
): DeliverableGateResult {
  const issues: string[] = [];
  if (!priorOutreach?.trim() || !content?.trim()) {
    return { passed: true, issues };
  }

  const priorLines = priorOutreach
    .split('\n')
    .map((l) => l.replace(/^[^:]+:\s*/, '').trim()) // strip "Opener:" / "Pitch hook:" labels
    .filter((l) => l.length > 0);

  const priorTokenSets = priorLines
    .map((l) => tokens(l))
    .filter((t) => t.length >= 4)
    .map((t) => new Set(t));

  const sentences = splitSentences(content);
  for (const sentence of sentences) {
    const st = tokens(sentence);
    if (st.length < 4) continue;
    for (const priorSet of priorTokenSets) {
      if (overlapRatio(st, priorSet) >= threshold) {
        issues.push(`repeats prior outreach phrasing: "${sentence.slice(0, 80)}"`);
        break;
      }
    }
  }

  return { passed: issues.length === 0, issues };
}
