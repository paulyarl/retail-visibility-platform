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
import {
  computeEvidenceFingerprint,
  resolveAuditPath,
} from './brief-assembler';
import { isStubBusinessAnalysisAudit } from '../../lib/marketing-audits';
import { logger } from '../../logger';

export const ENGAGEMENT_BRIEF_VERSION = 2;

interface SourceAuditRow {
  id: string;
  audit_data: any;
}

/**
 * Latest non-stub business_analysis audit across the campaign's sibling set —
 * the only audit shape a brief may cite (category_identification partial
 * packets lack the channel scan and observed-assets blocks Pass 2 reads).
 *
 * Sibling pooling (G11 fix): audit inheritance is a read-time merge
 * (loadPrimarySiblingAudits), not physical rows — a non-primary sibling's
 * campaign_id has no audit row of its own. The spine is computed once per
 * business, so the source lookup pools across business_prospect_id the same
 * way ProspectReportService's chapter assembly does. The requesting
 * campaign's own audit wins ties implicitly (findFirst order: own campaign
 * first, then the pooled sibling latest).
 */
export async function loadBriefSourceAudit(
  prisma: any,
  campaignId: string,
): Promise<SourceAuditRow | null> {
  // The campaign's own latest non-stub audit wins when it exists.
  const own = await prisma.mkt_audits_list.findMany({
    where: { campaign_id: campaignId, platform: 'business_analysis' },
    orderBy: { created_at: 'desc' },
    take: 10,
    select: { id: true, audit_data: true },
  });
  const ownNonStub = (own ?? []).find((a: any) => !isStubBusinessAnalysisAudit(a));
  if (ownNonStub) return ownNonStub;

  // Pooled sibling read — non-primary siblings inherit the primary's audit
  // at render time; the stamp resolves the same row so source_audit_id is
  // real, not null.
  const campaign = await prisma.mkt_campaigns_list?.findUnique?.({
    where: { id: campaignId },
    select: { business_prospect_id: true },
  });
  const prospectId = campaign?.business_prospect_id;
  if (!prospectId) return null;
  const siblings = await prisma.mkt_campaigns_list?.findMany?.({
    where: { business_prospect_id: prospectId, scope: 'business' },
    select: { id: true },
  });
  const siblingIds = (siblings ?? [])
    .map((s: any) => s.id as string)
    .filter((id: string) => id !== campaignId);
  if (siblingIds.length === 0) return null;
  const pooled = await prisma.mkt_audits_list.findMany({
    where: { campaign_id: { in: siblingIds }, platform: 'business_analysis' },
    orderBy: { created_at: 'desc' },
    take: 20,
    select: { id: true, audit_data: true },
  });
  return (pooled ?? []).find((a: any) => !isStubBusinessAnalysisAudit(a)) ?? null;
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
    // loadBriefSourceAudit pools the sibling set — the precondition and the
    // stamp now agree about what "has an audit" means (G11).
    hasSourceAudit = !!(await loadBriefSourceAudit(prisma, campaign.id));
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
 *   - source_audit_id      → the sibling set's latest non-stub
 *                            business_analysis audit row
 *   - side                 → classifyFootprintSide(source audit) — the model
 *                            may echo the injected value but never sets it
 *   - brief_version        → ENGAGEMENT_BRIEF_VERSION
 *   - evidence_fingerprint → hash of the assembler-read fields on the source
 *                            audit (D4 — staleness fingerprint)
 *   - staleness            → 'current' at stamp time; later audit imports
 *                            flip it when the fingerprint drifts
 *   - assembly             → 'model' for imported model briefs;
 *                            'deterministic'/'hybrid' when the assembler
 *                            emitted the payload (never overwritten if set)
 *
 * Ref integrity (D5): every evidence_index path is resolved against the
 * source audit. Unresolvable keys are warned, listed under
 * `ref_integrity.broken`, and any spine item citing a broken key is flagged
 * `provenance_broken: true` — flagged, not silently persisted or dropped.
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

  // Ref integrity — resolve each evidence_index path against the source
  // audit and flag items that cite a path which no longer resolves.
  const broken: string[] = [];
  if (sourceAudit?.audit_data && parsedJson.evidence_index && typeof parsedJson.evidence_index === 'object') {
    for (const [key, path] of Object.entries(parsedJson.evidence_index as Record<string, unknown>)) {
      if (typeof path !== 'string' || resolveAuditPath(sourceAudit.audit_data, path) === undefined) {
        broken.push(key);
      }
    }
  }
  if (broken.length > 0) {
    logger.warn('Engagement brief evidence_index contains unresolvable paths', undefined, {
      campaignId: opts.campaignId,
      sourceAuditId: sourceAudit?.id,
      broken,
    });
  }
  const brokenSet = new Set(broken);
  const flagBrokenItems = (items: any[] | undefined): any[] | undefined =>
    items?.map((item: any) => {
      const refs = [item?.evidence_ref, ...(item?.supporting_refs ?? [])].filter(
        (r): r is string => typeof r === 'string',
      );
      return refs.some((r) => brokenSet.has(r)) ? { ...item, provenance_broken: true } : item;
    });

  const fingerprint = computeEvidenceFingerprint(sourceAudit?.audit_data);

  // OQ7 marker — once a brief stamps against this audit, its judgment
  // fragments (outreach_problems, benefits, primary_outreach_hook) are
  // spine-owned; the marker lets audit viewers badge them as migrated.
  if (sourceAudit?.id) {
    const { markPass1FragmentsConsolidated } = await import('./brief-spine');
    await markPass1FragmentsConsolidated(opts.prisma, sourceAudit.id).catch(() => {});
  }

  return {
    ...parsedJson,
    brief_version: ENGAGEMENT_BRIEF_VERSION,
    source_audit_id: sourceAudit?.id ?? null,
    evidence_fingerprint: fingerprint,
    staleness: 'current',
    assembly: parsedJson.assembly ?? 'model',
    ...(broken.length > 0 ? { ref_integrity: { broken } } : {}),
    pains: flagBrokenItems(parsedJson.pains) ?? parsedJson.pains,
    assets: flagBrokenItems(parsedJson.assets) ?? parsedJson.assets,
    capability_fits: flagBrokenItems(parsedJson.capability_fits) ?? parsedJson.capability_fits,
    side: {
      value: side.side,
      density_score: side.density_score,
      inputs_used: side.inputs_used,
      density_breakdown: side.density_breakdown,
      classifier_version: side.classifier_version,
    },
  };
}
