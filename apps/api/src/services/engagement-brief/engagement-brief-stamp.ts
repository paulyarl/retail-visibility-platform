/**
 * Engagement Brief — stamping + render-variable sourcing (Pass 2).
 *
 * Spec: docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md
 * ("The brief must be stored to be a spine", "prompt emits inputs, code
 * stamps", "Pass 1 emits evidence; Pass 2 consumes them and judges fit").
 *
 * Two responsibilities:
 *
 *   1. `buildEngagementBriefVariables` — resolvePrompt sources the Pass-1
 *      audit into the brief template's `{{source_audit}}` /
 *      `{{source_audit_id}}` / `{{footprint_side}}` variables so the model
 *      reads evidence, not its own opinion of the business.
 *
 *   2. `applyEngagementBriefStamp` — the post-validation import hook. The
 *      model cannot know the source audit's row id, and the side is
 *      code-stamped by design (spec: "What code stamps"), so the persisted
 *      brief's `source_audit_id`, `side`, and `brief_version` are
 *      authoritative writes, not model output.
 *
 * Storage (spec OQ3, decided): the brief persists as an mkt_audits_list row
 * with platform='engagement_brief' — audit_data carries the full brief JSON
 * (including source_audit_id), import_metadata carries the model/provider
 * provenance. No dedicated table: audit rows already carry JSONB payloads,
 * the Audits tab renders them, and the source audit id is embedded in the
 * payload itself for the "rank once" spine chain.
 */

import { classifyFootprintSide } from './footprint-side';
import { isStubBusinessAnalysisAudit } from '../../lib/marketing-audits';
import { logger } from '../../logger';

export const ENGAGEMENT_BRIEF_VERSION = 1;

interface SourceAuditRow {
  id: string;
  audit_data: any;
}

/**
 * Latest business_analysis audit for the campaign — the only audit shape a
 * brief may cite (category_identification partial packets lack the channel
 * scan and observed-assets blocks Pass 2 reads).
 */
export async function loadBriefSourceAudit(
  prisma: any,
  campaignId: string,
): Promise<SourceAuditRow | null> {
  return prisma.mkt_audits_list.findFirst({
    where: { campaign_id: campaignId, platform: 'business_analysis' },
    orderBy: { created_at: 'desc' },
    select: { id: true, audit_data: true },
  });
}

/**
 * Auto-source the brief template's evidence variables from the already-
 * resolved source audit (resolvePrompt's business-scope block loads the
 * latest business_analysis row). `audit` may be null — the template body
 * instructs the model to emit the empty-brief shape in that case, and the
 * stamp still resolves the side at import time.
 */
export function buildEngagementBriefVariables(audit: SourceAuditRow | null | undefined): {
  source_audit: string;
  source_audit_id: string;
  footprint_side: string;
} {
  const side = classifyFootprintSide(audit?.audit_data ?? null);
  return {
    source_audit: audit?.audit_data
      ? JSON.stringify(audit.audit_data, null, 2)
      : '(no business_analysis audit found for this campaign — emit the empty-brief shape per the No Source Audit rule)',
    source_audit_id: audit?.id ?? '',
    footprint_side: JSON.stringify(
      {
        value: side.side,
        density_score: side.density_score,
        classifier_version: side.classifier_version,
        // inputs_used / density_breakdown are deliberately omitted — they
        // are the persisted audit record, not prompt material; the model
        // reads the raw evidence itself from {{source_audit}} (review F5).
      },
      null,
      2,
    ),
  };
}

/**
 * Pass-2 execution precondition — a brief without a source audit has no
 * evidence to cite. The audit is render-bound (an external agent must load
 * the surfaces), so the correct fallback is to refuse the internal run and
 * send the operator to the audit prompt, NOT to silently emit an empty
 * spine. Throws a plain Error with the actionable message; the caller
 * (executePrompt) surfaces it before creating an execution row.
 *
 * A campaign whose only business_analysis rows are stubs (queue-promotion /
 * discovery placeholders) still fails — a stub carries signals but no
 * channel-scan evidence for the brief to rank.
 */
export async function assertEngagementBriefSourceAudit(
  campaign: any,
  prisma: any,
): Promise<void> {
  let hasSourceAudit =
    (campaign?.audits ?? campaign?.mkt_audits_list ?? []).some(
      (a: any) => a.platform === 'business_analysis' && !isStubBusinessAnalysisAudit(a),
    );
  if (!hasSourceAudit && campaign?.id) {
    const rows = await prisma.mkt_audits_list.findMany({
      where: { campaign_id: campaign.id, platform: 'business_analysis' },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { id: true, platform: true, audit_data: true },
    });
    hasSourceAudit = (rows ?? []).some((a: any) => !isStubBusinessAnalysisAudit(a));
  }
  if (!hasSourceAudit) {
    throw new Error(
      'Engagement Brief requires a completed Business Audit on this campaign — run the Business Audit prompt first (it renders real channels and is imported via Path 2), then re-run the Engagement Brief.',
    );
  }
}

/**
 * Post-validation stamp for imported briefs (same seam as
 * applyRenderControlCoverageGate — the import persists raw parsed JSON, so
 * stamped fields must be written here, not in the validator).
 *
 * Authoritative overwrites:
 *   - source_audit_id  → the campaign's latest business_analysis audit row
 *   - side             → classifyFootprintSide(source audit) — the model may
 *                        echo the injected value but never sets it
 *   - brief_version    → ENGAGEMENT_BRIEF_VERSION
 *
 * When no source audit exists the stamp still writes side (classifying the
 * empty footprint → 'emerging') and emits null for source_audit_id. A
 * model-emitted or hand-assembled id is never trusted: when the campaign
 * lookup resolves nothing, a claimed id is unverifiable by construction —
 * it can only point at another campaign's audit or a non-business_analysis
 * row — so it is dropped (warned), never preserved.
 */
export async function applyEngagementBriefStamp<T extends Record<string, any>>(
  parsedJson: T,
  opts: { prisma: any; campaignId: string },
): Promise<T> {
  const sourceAudit = opts.campaignId
    ? await loadBriefSourceAudit(opts.prisma, opts.campaignId)
    : null;
  const side = classifyFootprintSide(sourceAudit?.audit_data ?? null);

  const modelSourceAuditId =
    typeof parsedJson.source_audit_id === 'string' && parsedJson.source_audit_id.trim()
      ? parsedJson.source_audit_id
      : null;
  if (!sourceAudit && modelSourceAuditId) {
    logger.warn('Engagement brief stamp dropped unverifiable source_audit_id', undefined, {
      campaignId: opts.campaignId,
      sourceAuditId: modelSourceAuditId,
    });
  }

  return {
    ...parsedJson,
    brief_version: ENGAGEMENT_BRIEF_VERSION,
    source_audit_id: sourceAudit?.id ?? null,
    side: {
      value: side.side,
      density_score: side.density_score,
      inputs_used: side.inputs_used,
      density_breakdown: side.density_breakdown,
      classifier_version: side.classifier_version,
    },
  };
}
