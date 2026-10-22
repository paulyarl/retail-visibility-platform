/**
 * Briefing topics — flatten a campaign's audit briefing into the topics a
 * diagnostic screenshot can be tagged to (Migration 355).
 *
 * Every sibling campaign's briefing lives in audit_data: business_analysis
 * audits carry `outreach_problems` (Outreach Ammunition) + `benefits`;
 * website_positioning audits add `issues` (Issues & Conversion Impact) and
 * `positioning_gaps`. `flattenBriefingTopics` turns the campaign's audits
 * (including inherited primary-sibling audits) into dropdown options —
 * each carrying the {auditId, kind, index} REF the upload/retag calls send.
 *
 * The API has a sibling copy of the extractor in
 * apps/api/src/lib/briefing-topics.ts (it resolves refs into persisted
 * snapshots) — keep the kind vocabulary in sync.
 */
import type { Audit, BriefingTopicKind, BriefingTopicRef } from '@/services/MarketingOpsService';
import type { GalleryBriefingTopic } from '@/services/DiagnosticGalleryPublicService';

export interface BriefingTopicOption {
  /** Stable select value — `${auditId}:${kind}:${index}`. */
  key: string;
  ref: BriefingTopicRef;
  kind: BriefingTopicKind;
  kindLabel: string;
  /** Topic headline — issue text / gap field / problem / benefit text. */
  label: string;
}

export const BRIEFING_TOPIC_KIND_LABELS: Record<BriefingTopicKind, string> = {
  issue: 'Issue',
  gap: 'Gap',
  ammunition: 'Ammunition',
  benefit: 'Benefit',
};

// Queue-promotion placeholder audits carry detected_signals only — mirrors
// isStubBusinessAnalysisAudit (CampaignDetailClient / api lib/marketing-audits).
const STUB_AUDIT_SOURCES = new Set([
  'manual_queue',
  'queue_promotion',
  'derived_from_parent',
  'derived_from_city_scan',
  'discovery_scan',
]);

function isStubAudit(audit: Audit): boolean {
  if (audit.platform !== 'business_analysis') return false;
  const source = (audit.audit_data as any)?.audit_metadata?.source;
  return typeof source === 'string' && STUB_AUDIT_SOURCES.has(source);
}

/** Platforms whose audit_data can hold briefing topics. */
const BRIEFING_PLATFORMS = new Set(['business_analysis', 'website_positioning']);

/**
 * Pick the audits that constitute the campaign's briefing — the NEWEST audit
 * of each briefing platform (latest-wins, matching getLatestAuditData's
 * convention), stub business_analysis placeholders excluded.
 */
export function briefingAudits(audits: Audit[]): Audit[] {
  const newestByPlatform = new Map<string, Audit>();
  const sorted = [...audits].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  for (const audit of sorted) {
    if (!BRIEFING_PLATFORMS.has(audit.platform) || isStubAudit(audit) || !audit.audit_data) continue;
    if (!newestByPlatform.has(audit.platform)) newestByPlatform.set(audit.platform, audit);
  }
  return [...newestByPlatform.values()];
}

/**
 * Flatten the briefing audits into taggable topics, in briefing order
 * (issues → gaps → ammunition → benefits per audit).
 */
export function flattenBriefingTopics(audits: Audit[]): BriefingTopicOption[] {
  const options: BriefingTopicOption[] = [];

  const push = (audit: Audit, kind: BriefingTopicKind, index: number, label: string) => {
    if (!label) return;
    const ref: BriefingTopicRef = { auditId: audit.id, kind, index };
    options.push({
      key: `${audit.id}:${kind}:${index}`,
      ref,
      kind,
      kindLabel: BRIEFING_TOPIC_KIND_LABELS[kind],
      label,
    });
  };

  for (const audit of briefingAudits(audits)) {
    const d = audit.audit_data as any;

    if (Array.isArray(d.issues)) {
      d.issues.forEach((iss: any, i: number) => {
        push(audit, 'issue', i, typeof iss?.issue === 'string' ? iss.issue : '');
      });
    }
    if (Array.isArray(d.positioning_gaps)) {
      d.positioning_gaps.forEach((g: any, i: number) => {
        const label =
          typeof g?.field === 'string' && g.field
            ? g.field
            : typeof g?.gap_description === 'string'
              ? g.gap_description
              : '';
        push(audit, 'gap', i, label);
      });
    }
    if (Array.isArray(d.outreach_problems)) {
      d.outreach_problems.forEach((p: any, i: number) => {
        push(audit, 'ammunition', i, typeof p?.problem === 'string' ? p.problem : '');
      });
    }
    if (Array.isArray(d.benefits)) {
      d.benefits.forEach((b: any, i: number) => {
        push(audit, 'benefit', i, typeof b === 'string' ? b : '');
      });
    }
  }

  return options;
}

/** Select value for a stored tag — matches `BriefingTopicOption.key`. */
export function briefingTopicKey(topic: {
  auditId: string;
  kind: string;
  index: number;
}): string {
  return `${topic.auditId}:${topic.kind}:${topic.index}`;
}

/**
 * Prospect-facing one-liner for a tagged screenshot — the topic's own copy:
 * what it costs (issue), the gap, the fix (ammunition), or the benefit.
 */
export function briefingTopicTagline(topic: GalleryBriefingTopic): string | null {
  const d = topic.detail ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
  switch (topic.kind) {
    case 'issue':
      return str(d.conversion_implication);
    case 'gap':
      return str(d.gap_description);
    case 'ammunition':
      return str(d.solution) ?? str(d.hook);
    case 'benefit':
      return str(d.text);
    default:
      return null;
  }
}
