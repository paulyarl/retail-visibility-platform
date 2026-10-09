/**
 * ProspectAttributionService — canonical discovery-attribution child rows
 * (migration 317, mkt_discovery_attributions).
 *
 * Discovery attribution (bronze reason attribution, competitive weaknesses,
 * INT_* signals, provenance) is prospect-level provenance. Historically it
 * rode on the promoted campaign's `discovery_context` — a snapshot stamped
 * once at queue promotion / derive time. Two failure modes:
 *   1. Sibling campaigns (createSiblingCampaign) don't copy discovery_context.
 *   2. Attribution that arrives AFTER promotion (a second discovery scan
 *      attributing an already-queued/converted prospect) never propagates —
 *      mergeAttributionOnDedup only fires on an addToQueue dedup hit.
 *
 * This service makes attribution a CHILD RECORD model: one row per
 * (prospect target x source scan), resolvable by business_prospect_id /
 * campaign_id / queue_entry_id — the same grouping model audits inherit
 * through. `discovery_context` stays as the promotion-time snapshot; the
 * child rows are the canonical, updateable attribution store.
 *
 *   recordAttribution      — upsert/merge a row for a target x source scan.
 *   resolveForCampaign     — merge own context + sibling contexts + child
 *                            rows into a DiscoveryContext for rendering.
 *   propagateFromScanAudit — late-propagation hook on intelligence_discovery
 *                            imports: candidates carrying attribution are
 *                            matched to existing queue rows / business
 *                            campaigns by the name+city dedup pair and
 *                            their attribution is appended.
 *
 * Epistemic contract is unchanged: attribution is pipeline provenance, not a
 * verified business finding. Renderers keep their hypothesis framing.
 */

import { Prisma } from '@prisma/client';
import { BaseService } from './BaseService';
import { logger } from '../logger';
import type { RequestCtx } from '../context';
import {
  validateDiscoveryContext,
  type DiscoveryContext,
} from '../validators/intelligence-discovery.schema';
import { generateDiscoveryAttributionId } from '../lib/id-generator';

export interface RecordAttributionInput {
  businessProspectId?: string | null;
  campaignId?: string | null;
  queueEntryId?: string | null;
  sourceCampaignId?: string | null;
  sourceAuditId?: string | null;
  sourceExecutionId?: string | null;
  context: DiscoveryContext | null | undefined;
}

// ─── Union-by-key helpers (pure — unit-tested) ──────────────────────────

export function unionSignals(a: string[] = [], b: string[] = []): string[] {
  const seen = new Set(a);
  const out = [...a];
  for (const s of b) if (!seen.has(s)) { seen.add(s); out.push(s); }
  return out;
}

const provenanceKey = (p: any) =>
  `${String(p?.source ?? '').toLowerCase()}|${String(p?.role ?? '').toLowerCase()}|${String(p?.url ?? '').toLowerCase()}`;

export function unionProvenance(a: any[] = [], b: any[] = []): any[] {
  const seen = new Set(a.map(provenanceKey));
  const out = [...a];
  for (const p of b) {
    const k = provenanceKey(p);
    if (!seen.has(k)) { seen.add(k); out.push(p); }
  }
  return out;
}

export function unionBronze(a: any[] = [], b: any[] = []): any[] {
  const byKey = new Map<string, any>();
  for (const e of a) if (e?.reason_key) byKey.set(e.reason_key, e);
  const out = [...a];
  for (const e of b) {
    if (!e?.reason_key) continue;
    const prev = byKey.get(e.reason_key);
    if (!prev) { byKey.set(e.reason_key, e); out.push(e); continue; }
    // Fill a missing basis on re-attribution — never overwrite.
    if (!prev.basis && e.basis) prev.basis = e.basis;
  }
  return out;
}

export function unionWeaknesses(a: any[] = [], b: any[] = []): any[] {
  const byKey = new Map<string, any>();
  for (const e of a) if (e?.weakness_key) byKey.set(e.weakness_key, e);
  const out = [...a];
  for (const e of b) {
    if (!e?.weakness_key) continue;
    const prev = byKey.get(e.weakness_key);
    if (!prev) { byKey.set(e.weakness_key, e); out.push(e); continue; }
    if (!prev.basis && e.basis) prev.basis = e.basis;
  }
  return out;
}

/**
 * Merge N discovery contexts into one. Order = precedence for scalar meta
 * (first non-null wins); arrays union in order so earlier lanes render
 * first. Returns null when the merge is empty (same emptiness rule as
 * validateDiscoveryContext).
 */
export function mergeDiscoveryContexts(contexts: Array<DiscoveryContext | null | undefined>): DiscoveryContext | null {
  const merged: DiscoveryContext = {};
  for (const ctx of contexts) {
    if (!ctx) continue;
    merged.focus = merged.focus ?? ctx.focus ?? null;
    merged.discovered_at = merged.discovered_at ?? ctx.discovered_at ?? null;
    merged.business_seek_priority = merged.business_seek_priority ?? ctx.business_seek_priority ?? null;
    merged.category_fit = merged.category_fit ?? ctx.category_fit ?? null;
    merged.identity_confidence = merged.identity_confidence ?? ctx.identity_confidence ?? null;
    merged.location_status = merged.location_status ?? ctx.location_status ?? null;
    merged.seek_batch_id = merged.seek_batch_id ?? ctx.seek_batch_id ?? null;
    merged.source_category = merged.source_category ?? ctx.source_category ?? null;
    merged.ownership_type = merged.ownership_type ?? ctx.ownership_type ?? null;
    merged.verification_outcome = merged.verification_outcome ?? ctx.verification_outcome ?? null;
    merged.discovery_signals = unionSignals(
      merged.discovery_signals ?? [],
      ctx.discovery_signals ?? [],
    );
    merged.discovery_provenance = unionProvenance(
      merged.discovery_provenance ?? [],
      ctx.discovery_provenance ?? [],
    );
    merged.bronze_attribution = unionBronze(
      merged.bronze_attribution ?? [],
      ctx.bronze_attribution ?? [],
    );
    merged.competitive_weaknesses = unionWeaknesses(
      merged.competitive_weaknesses ?? [],
      ctx.competitive_weaknesses ?? [],
    );
  }
  return validateDiscoveryContext(merged);
}

// ─── Service ─────────────────────────────────────────────────────────────

export class ProspectAttributionService extends BaseService {
  private static instance: ProspectAttributionService;
  static getInstance(): ProspectAttributionService {
    if (!ProspectAttributionService.instance) {
      ProspectAttributionService.instance = new ProspectAttributionService();
    }
    return ProspectAttributionService.instance;
  }

  /**
   * Upsert an attribution row for a (prospect target x source scan) pair.
   * Dedupe: an existing row keyed by the same source_campaign_id that shares
   * any target key (queue_entry_id / campaign_id / business_prospect_id) is
   * merged — repeat imports of the same scan update in place rather than
   * duplicating. New non-null meta fills gaps; attribution arrays union.
   * Returns the row id, or null when the context validates to empty.
   */
  async recordAttribution(input: RecordAttributionInput, ctx?: RequestCtx): Promise<string | null> {
    const context = validateDiscoveryContext(input.context);
    if (!context) return null;
    if (!input.businessProspectId && !input.campaignId && !input.queueEntryId) return null;

    const targetOr = [
      input.queueEntryId ? { queue_entry_id: input.queueEntryId } : null,
      input.campaignId ? { campaign_id: input.campaignId } : null,
      input.businessProspectId ? { business_prospect_id: input.businessProspectId } : null,
    ].filter(Boolean) as any[];

    let existing: any = null;
    if (input.sourceCampaignId && targetOr.length > 0) {
      existing = await this.prisma.mkt_discovery_attributions.findFirst({
        where: { source_campaign_id: input.sourceCampaignId, OR: targetOr },
        orderBy: { created_at: 'asc' },
      });
    }

    const rowData = {
      business_prospect_id: input.businessProspectId ?? null,
      campaign_id: input.campaignId ?? null,
      queue_entry_id: input.queueEntryId ?? null,
      source_campaign_id: input.sourceCampaignId ?? null,
      source_audit_id: input.sourceAuditId ?? null,
      source_execution_id: input.sourceExecutionId ?? null,
      focus: context.focus ?? null,
      source_category: context.source_category ?? null,
      business_seek_priority: context.business_seek_priority ?? null,
      category_fit: context.category_fit ?? null,
      identity_confidence: context.identity_confidence ?? null,
      location_status: context.location_status ?? null,
      discovery_signals: (context.discovery_signals ?? []) as any,
      discovery_provenance: (context.discovery_provenance ?? []) as any,
      bronze_attribution: (context.bronze_attribution ?? []) as any,
      competitive_weaknesses: (context.competitive_weaknesses ?? []) as any,
      discovered_at: context.discovered_at ? new Date(context.discovered_at) : null,
    };

    if (!existing) {
      const id = generateDiscoveryAttributionId();
      await this.prisma.mkt_discovery_attributions.create({
        data: { id, ...rowData },
      });
      logger.info('Prospect attribution recorded', ctx, {
        attributionId: id,
        campaignId: input.campaignId,
        queueEntryId: input.queueEntryId,
        businessProspectId: input.businessProspectId,
        sourceCampaignId: input.sourceCampaignId,
      });
      return id;
    }

    // Merge into the existing row: union arrays, fill missing meta + target
    // keys, prefer the new scan's meta values where present (fresher read).
    await this.prisma.mkt_discovery_attributions.update({
      where: { id: existing.id },
      data: {
        business_prospect_id: existing.business_prospect_id ?? rowData.business_prospect_id,
        campaign_id: existing.campaign_id ?? rowData.campaign_id,
        queue_entry_id: existing.queue_entry_id ?? rowData.queue_entry_id,
        source_audit_id: rowData.source_audit_id ?? existing.source_audit_id,
        source_execution_id: rowData.source_execution_id ?? existing.source_execution_id,
        focus: rowData.focus ?? existing.focus,
        source_category: rowData.source_category ?? existing.source_category,
        business_seek_priority: rowData.business_seek_priority ?? existing.business_seek_priority,
        category_fit: rowData.category_fit ?? existing.category_fit,
        identity_confidence: rowData.identity_confidence ?? existing.identity_confidence,
        location_status: rowData.location_status ?? existing.location_status,
        discovery_signals: unionSignals(
          Array.isArray(existing.discovery_signals) ? existing.discovery_signals : [],
          rowData.discovery_signals,
        ),
        discovery_provenance: unionProvenance(
          Array.isArray(existing.discovery_provenance) ? existing.discovery_provenance : [],
          rowData.discovery_provenance,
        ),
        bronze_attribution: unionBronze(
          Array.isArray(existing.bronze_attribution) ? existing.bronze_attribution : [],
          rowData.bronze_attribution,
        ),
        competitive_weaknesses: unionWeaknesses(
          Array.isArray(existing.competitive_weaknesses) ? existing.competitive_weaknesses : [],
          rowData.competitive_weaknesses,
        ),
        discovered_at: rowData.discovered_at ?? existing.discovered_at,
        updated_at: new Date(),
      },
    });
    logger.info('Prospect attribution merged into existing row', ctx, {
      attributionId: existing.id,
      campaignId: input.campaignId,
      queueEntryId: input.queueEntryId,
      businessProspectId: input.businessProspectId,
      sourceCampaignId: input.sourceCampaignId,
    });
    return existing.id;
  }

  /**
   * Re-key queue-level attribution rows onto a promoted campaign — called
   * after promotion so rows that were propagated onto the queue entry
   * before it was promoted resolve against the campaign too.
   */
  async linkAttributionsToCampaign(
    queueEntryId: string,
    campaignId: string,
    businessProspectId: string | null | undefined,
    ctx?: RequestCtx,
  ): Promise<void> {
    try {
      const linked = await this.prisma.mkt_discovery_attributions.updateMany({
        where: { queue_entry_id: queueEntryId, campaign_id: null },
        data: {
          campaign_id: campaignId,
          business_prospect_id: businessProspectId ?? undefined,
          updated_at: new Date(),
        },
      });
      if (linked.count > 0) {
        logger.info('Queue attribution rows linked to promoted campaign', ctx, {
          queueEntryId, campaignId, linked: linked.count,
        });
      }
    } catch (e) {
      logger.warn('linkAttributionsToCampaign failed (non-fatal)', ctx, {
        queueEntryId, campaignId, error: (e as Error).message,
      });
    }
  }

  /**
   * Resolve the merged attribution context for a business-scope campaign:
   * its own discovery_context (promotion snapshot — wins scalar meta) +
   * sibling campaigns' contexts + canonical mkt_discovery_attributions rows
   * (matched on business_prospect_id, campaign_id, or the queue entry that
   * promoted into this campaign). Deterministic; returns null when empty.
   */
  async resolveForCampaign(campaign: any, ctx?: RequestCtx): Promise<DiscoveryContext | null> {
    try {
      const contexts: Array<DiscoveryContext | null> = [
        validateDiscoveryContext(campaign?.discovery_context),
      ];

      const prospectId = campaign?.business_prospect_id as string | null | undefined;

      // Sibling snapshots — same prospect, earlier/parallel promotions.
      if (prospectId) {
        const siblings = await this.prisma.mkt_campaigns_list.findMany({
          where: {
            business_prospect_id: prospectId,
            id: { not: campaign.id },
            discovery_context: { not: Prisma.DbNull },
          },
          select: { discovery_context: true },
          orderBy: { created_at: 'asc' },
        });
        for (const s of siblings) contexts.push(validateDiscoveryContext(s.discovery_context));
      }

      // Canonical child rows — the prospect target keys (prospect id, this
      // campaign, or the queue entry that promoted into it).
      const queueRows = await this.prisma.mkt_prospect_queue.findMany({
        where: { processed_campaign_id: campaign.id },
        select: { id: true },
      });
      const queueIds = queueRows.map((q) => q.id);
      const or: any[] = [{ campaign_id: campaign.id }];
      if (prospectId) or.push({ business_prospect_id: prospectId });
      if (queueIds.length > 0) or.push({ queue_entry_id: { in: queueIds } });
      const rows = await this.prisma.mkt_discovery_attributions.findMany({
        where: { OR: or },
        orderBy: { created_at: 'asc' },
      });
      for (const row of rows) {
        contexts.push(validateDiscoveryContext({
          focus: row.focus,
          discovered_at: row.discovered_at ? row.discovered_at.toISOString() : null,
          business_seek_priority: row.business_seek_priority,
          category_fit: row.category_fit,
          identity_confidence: row.identity_confidence,
          location_status: row.location_status,
          source_category: row.source_category,
          discovery_signals: Array.isArray(row.discovery_signals) ? row.discovery_signals : [],
          discovery_provenance: Array.isArray(row.discovery_provenance) ? row.discovery_provenance : [],
          bronze_attribution: Array.isArray(row.bronze_attribution) ? row.bronze_attribution : [],
          competitive_weaknesses: Array.isArray(row.competitive_weaknesses) ? row.competitive_weaknesses : [],
        }));
      }

      return mergeDiscoveryContexts(contexts);
    } catch (e) {
      logger.warn('resolveForCampaign failed (non-fatal — falling back to snapshot)', ctx, {
        campaignId: campaign?.id,
        error: (e as Error).message,
      });
      return validateDiscoveryContext(campaign?.discovery_context);
    }
  }

  /**
   * Late-propagation hook for intelligence_discovery imports. Candidates
   * carrying attribution (bronze_attribution / competitive_weaknesses /
   * signals / provenance) are matched to already-known prospects — queue
   * entries and business-scope campaigns — by the name+city dedup pair, and
   * the attribution is appended as child rows. Covers the failure mode where
   * a prospect was queued/promoted before a second scan attributed it.
   *
   * Best-effort by contract of the caller — errors are logged, not thrown.
   */
  async propagateFromScanAudit(
    input: {
      scanCampaignId: string;
      auditId?: string | null;
      executionId?: string | null;
      parsedJson: any;
    },
    ctx?: RequestCtx,
  ): Promise<{ campaigns: number; queueEntries: number }> {
    const out = { campaigns: 0, queueEntries: 0 };
    const parsed = input.parsedJson;
    if (!parsed || typeof parsed !== 'object') return out;

    const scan = await this.prisma.mkt_campaigns_list.findUnique({
      where: { id: input.scanCampaignId },
      select: { id: true, category: true, city: true, state: true, intelligence_focus: true },
    });
    if (!scan) return out;
    const focus = (scan.intelligence_focus as string | null) === 'competitive' ? 'competitive' : 'emerging';

    const candidates: any[] = [
      ...(Array.isArray(parsed.qualifying_businesses) ? parsed.qualifying_businesses : []),
      ...(Array.isArray(parsed.discovered_businesses) ? parsed.discovered_businesses : []),
    ];
    const seen = new Set<string>();
    const audit = input.auditId
      ? await this.prisma.mkt_audits_list.findUnique({ where: { id: input.auditId }, select: { created_at: true } })
      : null;

    for (const cand of candidates) {
      const name = typeof cand?.business_name === 'string' ? cand.business_name.trim() : '';
      if (!name) continue;
      const city = (typeof cand?.city === 'string' && cand.city.trim()) ? cand.city.trim()
        : (typeof scan.city === 'string' ? scan.city.trim() : '');
      const dedupeKey = `${name.toLowerCase()}|${city.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const context = validateDiscoveryContext({
        focus,
        discovered_at: (audit?.created_at ?? new Date()).toISOString(),
        business_seek_priority: cand.business_seek_priority ?? null,
        category_fit: cand.category_fit ?? null,
        identity_confidence: cand.identity_confidence ?? null,
        location_status: cand.location_status ?? null,
        source_category: cand.category ?? scan.category ?? null,
        ownership_type: cand.ownership_type ?? null,
        discovery_signals: Array.isArray(cand.discovery_signals) ? cand.discovery_signals : [],
        discovery_provenance: Array.isArray(cand.discovery_provenance) ? cand.discovery_provenance : [],
        bronze_attribution: Array.isArray(cand.bronze_attribution) ? cand.bronze_attribution : [],
        competitive_weaknesses: Array.isArray(cand.competitive_weaknesses) ? cand.competitive_weaknesses : [],
      });
      if (!context) continue;

      const nameMatch = { equals: name, mode: 'insensitive' as const };
      const cityMatch = city ? { city: { equals: city, mode: 'insensitive' as const } } : {};

      // Business campaigns already derived for this prospect (any lane).
      const campaigns = await this.prisma.mkt_campaigns_list.findMany({
        where: {
          scope: 'business',
          business_name: nameMatch,
          ...cityMatch,
        },
        select: { id: true, business_prospect_id: true },
      });
      for (const c of campaigns) {
        await this.recordAttribution({
          campaignId: c.id,
          businessProspectId: c.business_prospect_id,
          sourceCampaignId: scan.id,
          sourceAuditId: input.auditId ?? null,
          sourceExecutionId: input.executionId ?? null,
          context,
        }, ctx);
        out.campaigns += 1;
      }

      // Queue entries carrying this prospect (promotion links them forward).
      const queueEntries = await this.prisma.mkt_prospect_queue.findMany({
        where: {
          status: { not: 'dismissed' },
          OR: [
            { business_name: nameMatch },
            { title: nameMatch },
          ],
          ...cityMatch,
        },
        select: { id: true, processed_campaign_id: true },
      });
      for (const q of queueEntries) {
        let prospectId: string | null = null;
        if (q.processed_campaign_id) {
          const processed = await this.prisma.mkt_campaigns_list.findUnique({
            where: { id: q.processed_campaign_id },
            select: { business_prospect_id: true },
          });
          prospectId = processed?.business_prospect_id ?? null;
        }
        await this.recordAttribution({
          queueEntryId: q.id,
          campaignId: q.processed_campaign_id ?? null,
          businessProspectId: prospectId,
          sourceCampaignId: scan.id,
          sourceAuditId: input.auditId ?? null,
          sourceExecutionId: input.executionId ?? null,
          context,
        }, ctx);
        out.queueEntries += 1;
      }
    }

    if (out.campaigns > 0 || out.queueEntries > 0) {
      logger.info('Discovery attribution propagated from scan audit', ctx, {
        scanCampaignId: input.scanCampaignId,
        auditId: input.auditId,
        ...out,
      });
    }
    return out;
  }
}
