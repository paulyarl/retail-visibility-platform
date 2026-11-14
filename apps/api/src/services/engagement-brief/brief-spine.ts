/**
 * Brief spine — the consumer read layer for the engagement brief.
 *
 * Spec: docs/LocalBiz/ENGAGEMENT_BRIEF_SPINE_SPRINT_PLAN.md (D3, D4, OQ7)
 *
 * "Rank once, project many" made real: every pitch-surface consumer resolves
 * the campaign's spine through `loadBriefSpine` instead of re-deriving the
 * top pain from Pass-1 fragments. Read chain:
 *
 *   1. the latest persisted engagement_brief row (model- or assembler-
 *      emitted — carries staleness + gate state)
 *   2. else a deterministic assembly of the pooled business_analysis audit
 *      (always available when an audit exists — the assembler is free)
 *   3. else null — the caller's Pass-1 fallback branch
 *
 * The archetype overlay (D3) reorders a shared business-level spine per
 * sibling: facts never diverge, only emphasis does. capability_fits follow
 * their addressed pain's overlay rank (OQ-B, decided).
 */

import { assembleEngagementBrief, classifyDomain } from './brief-assembler';
import type { AssembledBrief, AssembledPain } from './brief-assembler';
import { loadBriefSourceAudit } from './engagement-brief-stamp';
import { logger } from '../../logger';

// ─── Archetype → domain map (multi-archetype skill + briefing templates) ──
// A1 review-picture · A2 negative-review recovery · A3 identity/NAP drift ·
// A4 next-step/website conversion · A5 shelf visibility (catalog/photos) ·
// A6 presence/directory integrity. The overlay orders by these domains.
export const ARCHETYPE_DOMAINS: Record<string, string[]> = {
  A1: ['review', 'photos'],
  A2: ['review'],
  A3: ['nap', 'directory'],
  A4: ['website'],
  A5: ['catalog', 'photos'],
  A6: ['directory', 'nap'],
};

export type SpineSource = 'persisted' | 'assembled';

export interface BriefSpinePack {
  spine: AssembledBrief & Record<string, any>;
  /** persisted = the stored engagement_brief row; assembled = deterministic
   *  fold of the current business_analysis audit (no stored brief yet). */
  source: SpineSource;
  /** true when the persisted brief's fingerprint no longer matches the
   *  latest source audit — the card/consumer should show 'stale'. */
  stale: boolean;
  audit_id: string | null;
}

/** Latest engagement_brief audit row for the campaign, if any. */
async function loadPersistedBrief(
  prisma: any,
  campaignId: string,
): Promise<{ id: string; audit_data: any } | null> {
  return prisma.mkt_audits_list.findFirst({
    where: { campaign_id: campaignId, platform: 'engagement_brief' },
    orderBy: { created_at: 'desc' },
    select: { id: true, audit_data: true },
  });
}

/**
 * Resolve the campaign's spine. Never throws — consumers get null and fall
 * back to their Pass-1 read (dual-emit migration posture, D6).
 */
export async function loadBriefSpine(
  prisma: any,
  campaignId: string,
): Promise<BriefSpinePack | null> {
  try {
    const persisted = await loadPersistedBrief(prisma, campaignId);
    if (persisted?.audit_data) {
      const spine = persisted.audit_data as AssembledBrief;
      let stale = spine.staleness === 'stale';
      // Cheap live check when the row wasn't marked by the refresh path:
      // fingerprint of the current source audit vs the stored one.
      if (!stale && spine.evidence_fingerprint) {
        const sourceAudit = await loadBriefSourceAudit(prisma, campaignId);
        stale =
          !!sourceAudit?.audit_data &&
          spine.evidence_fingerprint !==
            (await import('./brief-assembler')).computeEvidenceFingerprint(sourceAudit.audit_data);
      }
      return {
        spine,
        source: 'persisted',
        stale,
        audit_id: (spine as any).source_audit_id ?? null,
      };
    }
    const sourceAudit = await loadBriefSourceAudit(prisma, campaignId);
    if (!sourceAudit?.audit_data) return null;
    return {
      spine: assembleEngagementBrief(sourceAudit.audit_data),
      source: 'assembled',
      stale: false,
      audit_id: sourceAudit.id,
    };
  } catch (err) {
    logger.warn('loadBriefSpine failed — consumers fall back to Pass-1 reads', undefined, {
      campaignId,
      error: (err as Error).message,
    });
    return null;
  }
}

// ─── Archetype overlay (D3) ──────────────────────────────────────────────

/**
 * Deterministically reorder the shared business-level spine for a sibling's
 * archetype lane: pains in the archetype's domain set first (stable internal
 * order preserved), capability_fits re-sorted by their addressed pain's new
 * rank, primary_hook_ref re-pointed at the overlaid top pain. Returns a new
 * object — the canonical spine is never mutated.
 */
export function applyArchetypeOverlay(
  spine: AssembledBrief & Record<string, any>,
  archetype: string | null | undefined,
): AssembledBrief & Record<string, any> {
  const domains = archetype ? (ARCHETYPE_DOMAINS[archetype] ?? []) : [];
  if (domains.length === 0) return spine;

  const domainSet = new Set(domains);
  const domainOf = (item: any): string =>
    item?.domain ?? classifyDomain(`${item?.business_consequence ?? ''} ${item?.source_fragment ?? ''}`);

  const pains = [...(spine.pains ?? [])].sort(
    (a, b) => Number(domainSet.has(domainOf(b))) - Number(domainSet.has(domainOf(a))),
  );
  const painRank = new Map<string, number>(pains.map((p, i) => [p.ref_id, i]));
  const capabilityFits = [...(spine.capability_fits ?? [])].sort((a, b) => {
    const ra = painRank.get(a.addresses_ref) ?? pains.length;
    const rb = painRank.get(b.addresses_ref) ?? pains.length;
    return ra - rb;
  });

  return {
    ...spine,
    pains,
    capability_fits: capabilityFits,
    archetype_domain: domains[0],
    engagement_shape: {
      ...spine.engagement_shape,
      primary_hook_ref: pains[0]?.ref_id ?? spine.engagement_shape?.primary_hook_ref ?? null,
      lead_with: pains.length > 0 ? 'pain' : 'asset',
    },
  };
}

// ─── Projections ─────────────────────────────────────────────────────────

export interface SpineAmmunitionEntry {
  problem: string;
  regular: string;
  hook: string;
  solution: string;
  evidence: string;
  outreach_use: string;
}

/** pains → the outreach_problems contract shape every existing consumer
 *  renders ({problem, regular, hook, solution, evidence, outreach_use}). */
export function spineToAmmunition(spine: AssembledBrief & Record<string, any>): SpineAmmunitionEntry[] {
  const index = spine.evidence_index ?? {};
  return (spine.pains ?? [])
    .filter((p: any) => typeof p?.business_consequence === 'string' && p.business_consequence.trim())
    .map((p: any) => ({
      problem: p.business_consequence,
      regular: typeof p.regular === 'string' ? p.regular : '',
      hook: typeof p.hook === 'string' ? p.hook : '',
      solution: typeof p.fix === 'string' ? p.fix : '',
      evidence:
        (typeof p.evidence_ref === 'string' && index[p.evidence_ref]) ||
        (typeof p.source_fragment === 'string' ? p.source_fragment : ''),
      outreach_use: typeof p.outreach_use === 'string' ? p.outreach_use : `spine ${p.domain ?? 'pain'}`,
    }));
}

/** do_not_claim — the guardrails every spoken/written projection must carry. */
export function spineGuardrails(spine: AssembledBrief & Record<string, any>): string[] {
  const dnc = spine.engagement_shape?.do_not_claim;
  return Array.isArray(dnc) ? dnc.filter((d): d is string => typeof d === 'string' && !!d.trim()) : [];
}

/** benefits carried through the spine (fragment fold), or [] for v1 briefs. */
export function spineBenefits(spine: AssembledBrief & Record<string, any>): string[] {
  return Array.isArray((spine as any).benefits)
    ? (spine as any).benefits.filter((b: any): b is string => typeof b === 'string' && !!b.trim())
    : [];
}

/** The primary-hook pain row (overlay-aware — the caller applies the
 *  overlay first when a sibling lane is in scope). */
export function spinePrimaryHook(
  spine: AssembledBrief & Record<string, any>,
): AssembledPain | null {
  const ref = spine.engagement_shape?.primary_hook_ref;
  const pains = spine.pains ?? [];
  return pains.find((p) => p.ref_id === ref) ?? pains[0] ?? null;
}

/** A compact prompt block — the ranked play + guardrails appended to
 *  opener/follow-up prompts so generated copy can't contradict the spine. */
export function spinePromptBlock(spine: AssembledBrief & Record<string, any>): string {
  const hook = spinePrimaryHook(spine);
  const lines: string[] = [
    'ENGAGEMENT SPINE — the ranked play for this business (lead with this; do not contradict it):',
  ];
  if (hook?.business_consequence) lines.push(`Primary pain: ${hook.business_consequence}`);
  if (hook?.regular) lines.push(`Plain line: ${hook.regular}`);
  if (hook?.hook) lines.push(`Hook line: ${hook.hook}`);
  const dnc = spineGuardrails(spine);
  if (dnc.length > 0) {
    lines.push('GUARDRAILS — never claim:');
    for (const d of dnc.slice(0, 8)) lines.push(`- ${d}`);
  }
  return lines.join('\n');
}

// ─── Gate resolution (4.4b backend) ─────────────────────────────────────

/**
 * Resolve a verification gate on the campaign's latest persisted brief —
 * writes status + resolution_note into audit_data.verification_gates[i].
 * Returns the updated gate count + the resolved gate, or null when the
 * campaign has no persisted brief (an assembled spine is ephemeral — it has
 * no row to write state to; resolution requires an imported/refresh row).
 */
export async function resolveBriefGate(
  prisma: any,
  campaignId: string,
  gateIndex: number,
  status: 'answered' | 'skipped' | 'needs_reconfirmation' | 'pending',
  resolutionNote?: string,
): Promise<{ gate: any; briefId: string } | null> {
  const brief = await loadPersistedBrief(prisma, campaignId);
  const gates = brief?.audit_data?.verification_gates;
  if (!brief || !Array.isArray(gates) || gateIndex < 0 || gateIndex >= gates.length) return null;
  const updated = [...gates];
  updated[gateIndex] = {
    ...updated[gateIndex],
    status,
    resolution_note:
      typeof resolutionNote === 'string' && resolutionNote.trim()
        ? resolutionNote.trim()
        : updated[gateIndex].resolution_note,
  };
  await prisma.mkt_audits_list.update({
    where: { id: brief.id },
    data: { audit_data: { ...brief.audit_data, verification_gates: updated } },
  });
  return { gate: updated[gateIndex], briefId: brief.id };
}

// ─── Reassemble on audit import (D4 / 3.4) ──────────────────────────────

/**
 * After a business_analysis import, refresh every sibling campaign's
 * persisted brief against the new evidence:
 *
 *   - fingerprint unchanged → mark 'current' (idempotent no-op when already)
 *   - fingerprint changed   → deterministic reassemble, gate status carried
 *     by identity (blocks + source_fragment, D8): same fragment → status
 *     carries; drifted fragment → carries but flips to needs_reconfirmation;
 *     no matching gate → dropped. Written IN PLACE — the brief recomputes
 *     like narrative resharpening; the source audit holds the history.
 *
 * Campaigns with no persisted brief are skipped — briefs are created by
 * explicit runs/imports, not speculative fan-out (D7).
 */
export async function refreshBriefsAfterAuditImport(
  prisma: any,
  campaignId: string,
  ctx?: { userId?: string },
): Promise<{ refreshed: number; unchanged: number }> {
  const campaign = await prisma.mkt_campaigns_list.findUnique({
    where: { id: campaignId },
    select: { business_prospect_id: true },
  });
  const campaignIds: string[] = [campaignId];
  if (campaign?.business_prospect_id) {
    const siblings = await prisma.mkt_campaigns_list.findMany({
      where: { business_prospect_id: campaign.business_prospect_id, scope: 'business' },
      select: { id: true },
    });
    for (const s of siblings ?? []) if (!campaignIds.includes(s.id)) campaignIds.push(s.id);
  }

  const { computeEvidenceFingerprint, assembleEngagementBrief } = await import('./brief-assembler');
  const { classifyFootprintSide } = await import('./footprint-side');

  let refreshed = 0;
  let unchanged = 0;
  for (const cid of campaignIds) {
    const brief = await loadPersistedBrief(prisma, cid);
    if (!brief) continue;
    const sourceAudit = await loadBriefSourceAudit(prisma, cid);
    if (!sourceAudit?.audit_data) continue;
    const fingerprint = computeEvidenceFingerprint(sourceAudit.audit_data);
    if (fingerprint && fingerprint === brief.audit_data?.evidence_fingerprint) {
      if (brief.audit_data?.staleness !== 'current') {
        await prisma.mkt_audits_list.update({
          where: { id: brief.id },
          data: { audit_data: { ...brief.audit_data, staleness: 'current' } },
        });
      }
      unchanged++;
      continue;
    }

    const next = assembleEngagementBrief(sourceAudit.audit_data);
    // Gate carry-over by identity (D8): blocks + source_fragment.
    const oldGates: any[] = Array.isArray(brief.audit_data?.verification_gates)
      ? brief.audit_data.verification_gates
      : [];
    next.verification_gates = next.verification_gates.map((g) => {
      const prev = oldGates.find((og) => og.blocks === g.blocks && og.gate === g.gate)
        ?? oldGates.find((og) => og.blocks === g.blocks);
      if (!prev) return g;
      const fragmentDrifted = prev.source_fragment !== g.source_fragment;
      return {
        ...g,
        status:
          fragmentDrifted && prev.status === 'answered'
            ? ('needs_reconfirmation' as const)
            : prev.status ?? g.status,
        resolution_note: prev.resolution_note ?? g.resolution_note,
      };
    });

    const side = classifyFootprintSide(sourceAudit.audit_data);
    const merged = {
      ...(brief.audit_data ?? {}),
      ...next,
      brief_version: 2,
      source_audit_id: sourceAudit.id,
      staleness: 'current' as const,
      side: {
        value: side.side,
        density_score: side.density_score,
        inputs_used: side.inputs_used,
        density_breakdown: side.density_breakdown,
        classifier_version: side.classifier_version,
      },
    };
    await prisma.mkt_audits_list.update({
      where: { id: brief.id },
      data: { audit_data: merged },
    });
    refreshed++;
  }
  return { refreshed, unchanged };
}
