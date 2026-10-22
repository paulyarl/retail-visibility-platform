/**
 * Briefing topics — the linkable findings inside a campaign's audit briefing.
 *
 * A sibling campaign's briefing lives in audit_data: business_analysis audits
 * carry `outreach_problems` (Outreach Ammunition) + `benefits`; website_
 * positioning audits add `issues` (Issues & Conversion Impact) and
 * `positioning_gaps`. A diagnostic screenshot may be anchored to exactly one
 * of those topics — "the screen is about a specific briefing topic that
 * already has the ammunition, hook, fix, benefits".
 *
 * The wire contract between operator UI and API is a REF —
 * `{ auditId, kind, index }` — never the payload. The API resolves the ref
 * against the audit row and persists a SNAPSHOT onto mkt_files_list
 * .briefing_topic, so an audit re-run can't silently re-mean a stored tag.
 *
 * The web app has a sibling copy of the extractor in
 * apps/web/src/lib/briefing-topics.ts (it flattens audits into the dropdown
 * options the refs point at) — keep the kind vocabulary in sync.
 */

export type BriefingTopicKind = 'issue' | 'gap' | 'ammunition' | 'benefit';

export const BRIEFING_TOPIC_KINDS: readonly BriefingTopicKind[] = [
  'issue',
  'gap',
  'ammunition',
  'benefit',
];

export interface BriefingTopicRef {
  auditId: string;
  kind: BriefingTopicKind;
  index: number;
}

/** Persisted snapshot — stored on mkt_files_list.briefing_topic. */
export interface BriefingTopicSnapshot {
  auditId: string;
  auditPlatform: string;
  kind: BriefingTopicKind;
  index: number;
  label: string;
  detail: Record<string, unknown>;
}

/** Prospect-facing projection — kind + label + primitive detail fields only. */
export interface PublicBriefingTopic {
  kind: BriefingTopicKind;
  label: string;
  detail: Record<string, string | number | boolean>;
}

function pickStrings(src: any, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = src?.[k];
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Flatten an audit's briefing into its topics, in briefing order
 * (issues → gaps → ammunition → benefits). Returns the snapshot candidates —
 * `label` is the topic headline used for dropdowns and gallery captions.
 */
export function extractAuditBriefingTopics(
  audit: { platform?: string | null; audit_data?: any } | null | undefined,
): Omit<BriefingTopicSnapshot, 'auditId' | 'auditPlatform'>[] {
  const d = audit?.audit_data;
  if (!d || typeof d !== 'object') return [];
  const topics: Omit<BriefingTopicSnapshot, 'auditId' | 'auditPlatform'>[] = [];

  if (Array.isArray(d.issues)) {
    d.issues.forEach((iss: any, index: number) => {
      const label = typeof iss?.issue === 'string' ? iss.issue : '';
      if (!label) return;
      topics.push({
        kind: 'issue',
        index,
        label,
        detail: pickStrings(iss, ['issue', 'conversion_implication', 'severity', 'evidence']),
      });
    });
  }

  if (Array.isArray(d.positioning_gaps)) {
    d.positioning_gaps.forEach((g: any, index: number) => {
      const label =
        typeof g?.field === 'string' && g.field
          ? g.field
          : typeof g?.gap_description === 'string'
            ? g.gap_description
            : '';
      if (!label) return;
      topics.push({
        kind: 'gap',
        index,
        label,
        detail: pickStrings(g, ['field', 'expected', 'actual', 'gap_description', 'severity']),
      });
    });
  }

  if (Array.isArray(d.outreach_problems)) {
    d.outreach_problems.forEach((p: any, index: number) => {
      const label = typeof p?.problem === 'string' ? p.problem : '';
      if (!label) return;
      topics.push({
        kind: 'ammunition',
        index,
        label,
        detail: pickStrings(p, ['problem', 'regular', 'hook', 'solution', 'evidence', 'outreach_use']),
      });
    });
  }

  if (Array.isArray(d.benefits)) {
    d.benefits.forEach((b: any, index: number) => {
      if (typeof b !== 'string' || !b) return;
      topics.push({ kind: 'benefit', index, label: b, detail: { text: b } });
    });
  }

  return topics;
}

/**
 * Resolve a client-supplied ref into the persisted snapshot. Returns null when
 * the ref is malformed or doesn't resolve inside this audit's briefing.
 */
export function resolveBriefingTopicSnapshot(
  audit: { id: string; platform?: string | null; audit_data?: any },
  ref: { kind?: unknown; index?: unknown },
): BriefingTopicSnapshot | null {
  const kind = ref?.kind;
  const index = ref?.index;
  if (
    typeof kind !== 'string' ||
    !BRIEFING_TOPIC_KINDS.includes(kind as BriefingTopicKind) ||
    typeof index !== 'number' ||
    !Number.isInteger(index) ||
    index < 0
  ) {
    return null;
  }
  const topic = extractAuditBriefingTopics(audit).find(
    (t) => t.kind === kind && t.index === index,
  );
  if (!topic) return null;
  return {
    auditId: audit.id,
    auditPlatform: audit.platform ?? '',
    kind: topic.kind,
    index: topic.index,
    label: topic.label,
    detail: topic.detail,
  };
}

/**
 * Prospect-facing projection of a stored snapshot. The stored detail is
 * already whitelisted at write time; this re-filters defensively (a row
 * written by a future caller may carry non-primitive values) and drops the
 * provenance fields — auditId/auditPlatform/index are operator metadata.
 */
export function publicBriefingTopic(stored: any): PublicBriefingTopic | null {
  if (!stored || typeof stored !== 'object') return null;
  const kind = stored.kind;
  const label = stored.label;
  if (
    typeof kind !== 'string' ||
    !BRIEFING_TOPIC_KINDS.includes(kind as BriefingTopicKind) ||
    typeof label !== 'string' ||
    !label
  ) {
    return null;
  }
  const detail: Record<string, string | number | boolean> = {};
  if (stored.detail && typeof stored.detail === 'object') {
    for (const [k, v] of Object.entries(stored.detail)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        detail[k] = v;
      }
    }
  }
  return { kind: kind as BriefingTopicKind, label, detail };
}
