/**
 * DirectorySeedCleanupService — post-batch-publish verification surface.
 *
 * Publish-first / clean-later: seeds ship publicly the moment they're
 * published (every public field is meant to carry provenance), so the
 * operator reviews the batch afterwards — duplicate groups, thin-seed
 * completeness — and resolves from one panel.
 *
 *   - getCleanupReport(seedBatch?)
 *       Duplicate groups use the SAME normalizers as the funnel's
 *       detection (SeedFunnelAnalyticsService spec §3.1: phone digits /
 *       address+city punctuation-stripped) so verdicts recorded here clear
 *       the funnel's duplicateSeedCount gate. A batch-scoped report still
 *       compares against ALL live seeds — a batch can duplicate an older
 *       seed from a previous batch, not just siblings. Verdicts are
 *       returned with each group rather than filtering them out, so the
 *       panel can show resolved history.
 *       Completeness reports which contract fields each seed is missing:
 *       canonical provenance rows (name/address/phone/website/
 *       primary_category/secondary_categories/hours — the createFromCampaign
 *       birth set), SEO enrichment (description/keywords/same_as +
 *       seo_enrichment json), attributes. Proving-ground ('pg-*') batches
 *       are flagged — their thin profile is structural (the pg path only
 *       writes discovery:* provenance), not a defect.
 *   - resolveDuplicates({keepSeedId, suppressSeedIds, matchKey, rationale})
 *       Dedicated atomic resolve: suppress the losers + revoke their live
 *       claim tokens in one transaction, then record the dedup verdict
 *       (same_entity → merge_into) so the name_variants identity ledger
 *       accumulates and the funnel gate clears. Claimed seeds can be the
 *       KEEPER but never a loser — refusing rather than silently retiring
 *       a real customer.
 *   - backfillEnrichment({seedIds})
 *       Brings thin seeds up to the createFromCampaign birth standard:
 *       canonical provenance INSERT ... ON CONFLICT DO NOTHING (never
 *       overwrites an existing or operator-overridden row), sourced
 *       attributes mined from the linked queue entry's business_snapshot,
 *       then SEO per-seed through getComposedEnrichment — the same
 *       campaign/market compose lanes Reset uses, but fill-missing only
 *       (Reset is the overwrite path).
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { generateDirectoryFieldProvenanceId } from '../lib/id-generator';
import DirectoryPresenceSeedService from './DirectoryPresenceSeedService';
import ProvingGroundDedupService from './ProvingGroundDedupService';
import DirectoryChainService, { computeChainSignals } from './DirectoryChainService';
import { normalizeAttributeEntry } from './directory/listingAttributes';
import { buildSeoEnrichmentJson, type SeedSeoPacket } from './directory/SeedSeoComposer';

type SeedAuditCtx = {
  actorId?: string;
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  ip?: string;
  userAgent?: string;
};

export interface CleanupSeedRef {
  seedId: string;
  businessName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  category: string | null;
  status: string;
  seedBatch: string | null;
  isPgBatch: boolean;
  slug: string | null;
  isPublished: boolean;
  hasActiveClaimToken: boolean;
  primaryCampaignId: string | null;
}

export interface CleanupDuplicateGroup {
  matchKey: 'phone' | 'address_city';
  seedIds: string[];
  seeds: CleanupSeedRef[];
  verdict: {
    verdict: string;
    mergeInto: string | null;
    resolvedBy: string | null;
    resolvedAt: string | null;
    rationale: string | null;
  } | null;
  /** Chain candidacy — phone groups only (Migration 359, spec §4.1). */
  chain: {
    confidence: 'chain_confirmed' | 'chain_probable';
    signals: string[];
    sharedPhone: string | null;
    nameTokenOverlap: string[];
    existingChainGroupId: string | null;
  } | null;
}

export interface CleanupThinSeed {
  seedId: string;
  businessName: string | null;
  seedBatch: string | null;
  isPgBatch: boolean;
  status: string;
  missing: string[];
}

export interface CleanupReport {
  generatedAt: string;
  seedBatch: string | null;
  batches: Array<{ seedBatch: string; seedCount: number; isPgBatch: boolean }>;
  duplicateGroups: CleanupDuplicateGroup[];
  completeness: {
    totalSeeds: number;
    thinSeeds: CleanupThinSeed[];
    summary: Record<string, number>;
  };
}

const CANONICAL_PROVENANCE_KEYS = [
  'name',
  'address',
  'phone',
  'website',
  'primary_category',
  'secondary_categories',
  'hours',
] as const;

class DirectorySeedCleanupService {
  /** seed_batch convention for proving-ground batches: pg-<campaign>-<date>. */
  private isPgBatch(seedBatch: string | null | undefined): boolean {
    return typeof seedBatch === 'string' && seedBatch.startsWith('pg-');
  }

  /**
   * Duplicate groups + completeness for a batch (or every live seed when
   * seedBatch is omitted). Duplicate detection compares against ALL live
   * seeds; a batch filter only narrows which groups are surfaced (any group
   * containing a batch member) and which seeds get completeness rows.
   */
  async getCleanupReport(seedBatch?: string): Promise<CleanupReport> {
    // All live seeds — suppressed is terminal (off every surface, never a
    // dup candidate); claimed stays in: it can be the keeper and operators
    // still need to see a live listing colliding with a real customer.
    const seeds = await prisma.$queryRaw<any[]>`
      SELECT dps.id, dps.tenant_id, dps.listing_id, dps.status, dps.seed_batch,
             dps.category, dps.city AS seed_city, dps.state AS seed_state,
             dps.identity_confidence, dps.seo_enrichment,
             dps.owner_email, dps.owner_phone,
             dl.business_name, dl.address, dl.city, dl.state, dl.phone,
             dl.website, dl.slug, dl.is_published, dl.description,
             dl.keywords, dl.same_as, dl.secondary_categories,
             dl.business_hours, dl.attributes,
             EXISTS(
               SELECT 1 FROM directory_claim_tokens dct
               WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL
             ) AS has_active_claim_token,
             (
               SELECT dscl.campaign_id FROM directory_seed_campaign_links dscl
               WHERE dscl.seed_id = dps.id AND dscl.link_role = 'primary'
               LIMIT 1
             ) AS primary_campaign_id
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.status IS DISTINCT FROM 'suppressed'
    `;

    const toRef = (s: any): CleanupSeedRef => ({
      seedId: s.id,
      businessName: s.business_name,
      address: s.address,
      city: s.city ?? s.seed_city,
      state: s.state ?? s.seed_state,
      phone: s.phone,
      category: s.category,
      status: s.status,
      seedBatch: s.seed_batch,
      isPgBatch: this.isPgBatch(s.seed_batch),
      slug: s.slug,
      isPublished: !!s.is_published,
      hasActiveClaimToken: !!s.has_active_claim_token,
      primaryCampaignId: s.primary_campaign_id,
    });

    // ── Duplicate groups — same normalizers as the funnel detection so
    // verdict keys (sorted seed_ids + match_key) line up and clear the
    // preflight gate. ────────────────────────────────────────────────
    const phoneGroups = new Map<string, any[]>();
    const addressGroups = new Map<string, any[]>();
    for (const s of seeds) {
      const phoneDigits = s.phone ? String(s.phone).replace(/[^0-9]/g, '') : '';
      if (phoneDigits.length >= 7) {
        const list = phoneGroups.get(phoneDigits) ?? [];
        list.push(s);
        phoneGroups.set(phoneDigits, list);
      }
      const city = s.city ?? s.seed_city;
      if (s.address && city) {
        const key = `${s.address} ${city}`
          .toLowerCase()
          .replace(/[^a-z0-9 ]/g, '')
          .trim();
        const list = addressGroups.get(key) ?? [];
        list.push(s);
        addressGroups.set(key, list);
      }
    }

    const inScope = (members: any[]) =>
      !seedBatch || members.some((m) => m.seed_batch === seedBatch);

    const groupCandidates: Array<{ matchKey: 'phone' | 'address_city'; members: any[] }> = [];
    for (const members of phoneGroups.values()) {
      if (members.length > 1 && inScope(members)) {
        groupCandidates.push({ matchKey: 'phone', members });
      }
    }
    for (const members of addressGroups.values()) {
      if (members.length > 1 && inScope(members)) {
        groupCandidates.push({ matchKey: 'address_city', members });
      }
    }

    // Verdict ledger — keyed on (sorted seed_ids, match_key), mirrors the
    // funnel's exclusion join but surfaces the verdict instead of hiding.
    const verdictRows = await prisma.$queryRaw<any[]>`
      SELECT seed_ids, match_key, verdict, merge_into, resolved_by, resolved_at, rationale
      FROM mkt_prospect_dedup_verdicts
    `;
    const verdictByKey = new Map<string, any>(
      verdictRows.map((v) => [`${v.match_key}:${(v.seed_ids as string[]).join(',')}`, v]),
    );

    // Chain candidacy — phone groups only (address_city groups are merge
    // territory: same address = same storefront, not a chain). Memberships
    // are fetched once so the card can show "already linked".
    const phoneGroupSeedIds = [
      ...new Set(
        groupCandidates
          .filter((c) => c.matchKey === 'phone')
          .flatMap((c) => c.members.map((m) => m.id as string)),
      ),
    ];
    const chainMemberships = await DirectoryChainService.membershipsForSeeds(phoneGroupSeedIds);

    const duplicateGroups: CleanupDuplicateGroup[] = groupCandidates
      .map(({ matchKey, members }) => {
        const seedIds = members.map((m) => m.id).sort();
        const verdict = verdictByKey.get(`${matchKey}:${seedIds.join(',')}`);
        const signals = matchKey === 'phone'
          ? computeChainSignals(members.map((m) => ({
              id: m.id,
              business_name: m.business_name,
              city: m.city ?? m.seed_city,
              state: m.state ?? m.seed_state,
              phone: m.phone,
              category: m.category,
              same_as: m.same_as,
              owner_email: m.owner_email,
              owner_phone: m.owner_phone,
            })))
          : null;
        return {
          matchKey,
          seedIds,
          seeds: members
            .slice()
            .sort((a, b) => String(a.id).localeCompare(String(b.id)))
            .map(toRef),
          chain: signals
            ? {
                confidence: signals.confidence,
                signals: signals.signals,
                sharedPhone: signals.sharedPhone,
                nameTokenOverlap: signals.nameTokenOverlap,
                existingChainGroupId:
                  seedIds.map((id) => chainMemberships.get(id)).find(Boolean) ?? null,
              }
            : null,
          verdict: verdict
            ? {
                verdict: verdict.verdict,
                mergeInto: verdict.merge_into,
                resolvedBy: verdict.resolved_by,
                resolvedAt: verdict.resolved_at ? new Date(verdict.resolved_at).toISOString() : null,
                rationale: verdict.rationale,
              }
            : null,
        };
      })
      .sort((a, b) => Number(!!a.verdict) - Number(!!b.verdict));

    // ── Completeness — scoped seeds only (batch filter applies here). ──
    const scopedSeeds = seedBatch ? seeds.filter((s) => s.seed_batch === seedBatch) : seeds;
    const scopedIds = scopedSeeds.map((s) => s.id);

    const provenanceRows = scopedIds.length
      ? await prisma.$queryRaw<any[]>`
          SELECT seed_id, field_key
          FROM directory_field_provenance
          WHERE seed_id = ANY(${scopedIds}::varchar[])
            AND field_key NOT LIKE 'discovery:%'
        `
      : [];
    const provenanceBySeed = new Map<string, Set<string>>();
    for (const p of provenanceRows) {
      const set = provenanceBySeed.get(p.seed_id) ?? new Set<string>();
      set.add(p.field_key);
      provenanceBySeed.set(p.seed_id, set);
    }

    const thinSeeds: CleanupThinSeed[] = [];
    const summary: Record<string, number> = {};
    const bump = (key: string) => {
      summary[key] = (summary[key] ?? 0) + 1;
    };

    for (const s of scopedSeeds) {
      const prov = provenanceBySeed.get(s.id) ?? new Set<string>();
      const missing: string[] = [];

      // Canonical provenance — required when the field carries a value.
      if (!prov.has('name')) { missing.push('provenance:name'); bump('provenance:name'); }
      if (!prov.has('address') && s.address) { missing.push('provenance:address'); bump('provenance:address'); }
      if (!prov.has('phone') && s.phone) { missing.push('provenance:phone'); bump('provenance:phone'); }
      if (!prov.has('primary_category')) { missing.push('provenance:primary_category'); bump('provenance:primary_category'); }
      if (!prov.has('website') && s.website) { missing.push('provenance:website'); bump('provenance:website'); }
      if (!prov.has('secondary_categories') && Array.isArray(s.secondary_categories) && s.secondary_categories.length > 0) {
        missing.push('provenance:secondary_categories'); bump('provenance:secondary_categories');
      }
      if (!prov.has('hours') && s.business_hours) { missing.push('provenance:hours'); bump('provenance:hours'); }

      // SEO enrichment — the createFromCampaign birth packet.
      if (!s.description) { missing.push('description'); bump('description'); }
      if (!Array.isArray(s.keywords) || s.keywords.length === 0) { missing.push('keywords'); bump('keywords'); }
      if (!s.seo_enrichment) { missing.push('seo_enrichment'); bump('seo_enrichment'); }
      if (!Array.isArray(s.same_as) || s.same_as.length === 0) { missing.push('same_as'); bump('same_as'); }
      if (!Array.isArray(s.attributes) || s.attributes.length === 0) { missing.push('attributes'); bump('attributes'); }
      if (!s.business_hours) { missing.push('hours'); bump('hours'); }
      if (!Array.isArray(s.secondary_categories) || s.secondary_categories.length === 0) {
        missing.push('secondary_categories'); bump('secondary_categories');
      }

      if (missing.length > 0) {
        thinSeeds.push({
          seedId: s.id,
          businessName: s.business_name,
          seedBatch: s.seed_batch,
          isPgBatch: this.isPgBatch(s.seed_batch),
          status: s.status,
          missing,
        });
      }
    }

    const batches = await prisma.$queryRaw<any[]>`
      SELECT seed_batch, COUNT(*)::int AS seed_count
      FROM directory_presence_seeds
      WHERE seed_batch IS NOT NULL
      GROUP BY seed_batch
      ORDER BY MAX(created_at) DESC
    `;

    return {
      generatedAt: new Date().toISOString(),
      seedBatch: seedBatch ?? null,
      batches: batches.map((b) => ({
        seedBatch: b.seed_batch,
        seedCount: b.seed_count,
        isPgBatch: this.isPgBatch(b.seed_batch),
      })),
      duplicateGroups,
      completeness: {
        totalSeeds: scopedSeeds.length,
        thinSeeds,
        summary,
      },
    };
  }

  /**
   * Resolve a duplicate group: keep one seed, suppress the losers, revoke
   * their live claim tokens, and record the same_entity verdict so the
   * survivor absorbs the losers' name variants (identity ledger) and the
   * funnel gate clears.
   */
  async resolveDuplicates(input: {
    keepSeedId: string;
    suppressSeedIds: string[];
    matchKey: 'phone' | 'address_city';
    rationale?: string;
  }, ctx?: SeedAuditCtx): Promise<{
    suppressed: string[];
    alreadySuppressed: string[];
    tokensRevoked: number;
    verdictRecorded: boolean;
  }> {
    const { keepSeedId, matchKey, rationale } = input;
    const suppressSeedIds = [...new Set(input.suppressSeedIds)].filter((id) => id !== keepSeedId);
    if (suppressSeedIds.length === 0) {
      throw new Error('nothing_to_suppress');
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT dps.id, dps.status, dl.phone, dl.address,
             COALESCE(dl.city, dps.city) AS city
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ANY(${[keepSeedId, ...suppressSeedIds]}::varchar[])
    `;
    const byId = new Map(rows.map((r) => [r.id, r]));

    const keep = byId.get(keepSeedId);
    if (!keep) throw new Error('keep_seed_not_found');
    if (keep.status === 'suppressed') throw new Error('keep_seed_suppressed');

    const claimed = suppressSeedIds.filter((id) => byId.get(id)?.status === 'claimed');
    if (claimed.length > 0) {
      // A claimed seed is a real customer — never retire it from a dedup
      // panel. The operator must keep the claimed row (or handle it
      // through the claim/offboarding flow).
      throw new Error(`claimed_seed_cannot_suppress:${claimed.join(',')}`);
    }
    const missing = suppressSeedIds.filter((id) => !byId.has(id));
    if (missing.length > 0) throw new Error(`seeds_not_found:${missing.join(',')}`);

    const toSuppress = suppressSeedIds.filter((id) => byId.get(id)?.status !== 'suppressed');
    const alreadySuppressed = suppressSeedIds.filter((id) => byId.get(id)?.status === 'suppressed');

    const actorTag = ctx?.actorId ? `dup-resolve:${ctx.actorId}` : 'dup-resolve';
    const tokensRevoked = await prisma.$transaction(async (tx) => {
      let revoked = 0;
      for (const loserId of toSuppress) {
        await tx.$executeRaw`
          UPDATE directory_presence_seeds
          SET status = 'suppressed', updated_at = now()
          WHERE id = ${loserId}
        `;
        revoked += await tx.$executeRaw`
          UPDATE directory_claim_tokens
          SET consumed_at = now(),
              consumed_by = ${`platform:revoked:${actorTag}`}
          WHERE seed_id = ${loserId} AND consumed_at IS NULL
        `;
      }
      return revoked;
    });

    // Verdict AFTER the writes: a verdict that lands while the losers are
    // still live would clear the funnel gate over un-resolved data. A
    // verdict failure after suppression is the safer partial state.
    //
    // Record one verdict per match key the group actually satisfies — the
    // same pair can surface under 'phone' AND 'address_city' (verdicts are
    // keyed per match_key), and resolving one must clear its twin row too.
    const groupMembers = [keepSeedId, ...suppressSeedIds];
    const satisfiedKeys = new Set<'phone' | 'address_city'>([matchKey]);
    {
      const members = groupMembers.map((id) => byId.get(id));
      const phones = new Set(
        members.map((m) => (m?.phone ? String(m.phone).replace(/[^0-9]/g, '') : null)),
      );
      phones.delete(null);
      if (phones.size === 1) satisfiedKeys.add('phone');
      const addrKeys = new Set(
        members.map((m) =>
          m?.address && m?.city
            ? `${m.address} ${m.city}`.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim()
            : null,
        ),
      );
      addrKeys.delete(null);
      if (addrKeys.size === 1) satisfiedKeys.add('address_city');
    }

    let verdictRecorded = false;
    for (const key of satisfiedKeys) {
      try {
        await ProvingGroundDedupService.recordVerdict({
          seedIds: groupMembers,
          matchKey: key,
          verdict: 'same_entity',
          mergeInto: keepSeedId,
          rationale,
        }, { userId: ctx?.actorId, actorType: ctx?.actorType || 'user' } as any);
        verdictRecorded = true;
      } catch (err) {
        logger.error('DirectorySeedCleanupService.resolveDuplicates — verdict write failed', undefined, {
          keepSeedId,
          matchKey: key,
          error: (err as Error).message,
        });
      }
    }

    // A same_entity verdict covering a chain group's full membership means
    // the earlier chain read was wrong — dismiss it (the verdict still
    // protects the funnel gate). Non-fatal.
    try {
      await DirectoryChainService.dismissForVerdict(groupMembers);
    } catch (err) {
      logger.error('DirectorySeedCleanupService.resolveDuplicates — chain dismiss failed', undefined, {
        error: (err as Error).message,
      });
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.resolve_duplicates',
      payload: {
        keepSeedId,
        suppressSeedIds,
        suppressed: toSuppress,
        alreadySuppressed,
        tokensRevoked,
        matchKey,
        verdictRecorded,
      },
    });
    logger.info('DirectorySeedCleanupService.resolveDuplicates', undefined, {
      keepSeedId,
      suppressed: toSuppress.length,
      alreadySuppressed: alreadySuppressed.length,
      tokensRevoked,
      verdictRecorded,
    });

    return { suppressed: toSuppress, alreadySuppressed, tokensRevoked, verdictRecorded };
  }

  /**
   * Backfill a thin seed to the createFromCampaign birth standard:
   * canonical field provenance (insert-only — never clobbers an existing
   * or operator-overridden row), sourced attributes mined from the linked
   * queue entry's business_snapshot, then SEO via the shared resharpen
   * lane per primary-linked campaign.
   */
  async backfillEnrichment(input: { seedIds: string[] }, ctx?: SeedAuditCtx): Promise<{
    results: Array<{
      seedId: string;
      skipped?: string;
      provenanceWritten?: number;
      attributesWritten?: number;
      secondaryCategoriesWritten?: number;
      hoursWritten?: boolean;
      seoSharpened?: boolean;
    }>;
  }> {
    const seedIds = [...new Set(input.seedIds)];
    const seeds = await prisma.$queryRaw<any[]>`
      SELECT dps.id, dps.tenant_id, dps.listing_id, dps.status,
             dps.identity_confidence, dps.seo_enrichment,
             dl.business_name, dl.address, dl.phone, dl.website,
             dl.primary_category, dl.secondary_categories, dl.business_hours,
             dl.attributes, dl.description, dl.keywords, dl.same_as,
             (
               SELECT dscl.campaign_id FROM directory_seed_campaign_links dscl
               WHERE dscl.seed_id = dps.id AND dscl.link_role = 'primary'
               LIMIT 1
             ) AS primary_campaign_id
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ANY(${seedIds}::varchar[])
    `;
    const byId = new Map(seeds.map((s) => [s.id, s]));

    // Queue linkage — pg/queue seeds cite the prospect snapshot as their
    // NAP source; it may also carry observed attributes.
    const queueRows = await prisma.$queryRaw<any[]>`
      SELECT seed_id, business_snapshot
      FROM mkt_prospect_queue
      WHERE seed_id = ANY(${seedIds}::varchar[])
    `;
    const queueBySeed = new Map(queueRows.map((q) => [q.seed_id, q]));

    const existingProv = await prisma.$queryRaw<any[]>`
      SELECT seed_id, field_key FROM directory_field_provenance
      WHERE seed_id = ANY(${seedIds}::varchar[])
    `;
    const provBySeed = new Map<string, Set<string>>();
    for (const p of existingProv) {
      const set = provBySeed.get(p.seed_id) ?? new Set<string>();
      set.add(p.field_key);
      provBySeed.set(p.seed_id, set);
    }

    const results: Array<any> = [];

    for (const seedId of seedIds) {
      const s = byId.get(seedId);
      if (!s) {
        results.push({ seedId, skipped: 'seed_not_found' });
        continue;
      }
      if (s.status === 'claimed' || s.status === 'suppressed') {
        // Mirrors the resharpen/promote guards — owner-managed or retired.
        results.push({ seedId, skipped: `status_${s.status}` });
        continue;
      }

      const queue = queueBySeed.get(seedId);
      const snapshot = queue?.business_snapshot ?? null;
      const sourceName = queue ? 'prospect_queue' : 'cleanup_backfill';
      const confidence = s.identity_confidence === 'high' ? 'high' : 'medium';
      const prov = provBySeed.get(seedId) ?? new Set<string>();

      const secondary = Array.isArray(s.secondary_categories)
        ? s.secondary_categories.filter((c: any) => typeof c === 'string' && c.trim())
        : [];
      const fieldRows: Array<{ fieldKey: string; value: string }> = [
        { fieldKey: 'name', value: s.business_name },
        { fieldKey: 'address', value: s.address },
        { fieldKey: 'phone', value: s.phone },
        { fieldKey: 'website', value: s.website },
        { fieldKey: 'primary_category', value: s.primary_category },
        { fieldKey: 'secondary_categories', value: secondary.join(', ') },
        { fieldKey: 'hours', value: s.business_hours ? JSON.stringify(s.business_hours) : '' },
      ].filter((r) => typeof r.value === 'string' && r.value.trim() !== '');

      // INSERT-only backfill: ON CONFLICT DO NOTHING — a hand edit or an
      // owner-claimed row always outranks a cleanup write.
      let provenanceWritten = 0;
      for (const row of fieldRows) {
        if (prov.has(row.fieldKey)) continue;
        const wrote = await prisma.$executeRaw`
          INSERT INTO directory_field_provenance (
            id, seed_id, tenant_id, field_key, value,
            source_name, accessed_at, confidence, show_on_public,
            created_at, updated_at
          ) VALUES (
            ${generateDirectoryFieldProvenanceId(s.tenant_id)},
            ${seedId},
            ${s.tenant_id},
            ${row.fieldKey},
            ${row.value},
            ${sourceName},
            now(),
            ${confidence},
            true,
            now(), now()
          )
          ON CONFLICT (seed_id, field_key) DO NOTHING
        `;
        provenanceWritten += wrote;
      }

      // Sourced attributes — queue-snapshot carry-over (same normalize
      // pipeline as every attribute surface). Only when the listing has
      // none: never overwrite operator-curated chips.
      let attributesWritten = 0;
      const snapshotAttrs = Array.isArray(snapshot?.attributes) ? snapshot.attributes : [];
      const listingAttrs = Array.isArray(s.attributes) ? s.attributes : [];
      if (listingAttrs.length === 0 && snapshotAttrs.length > 0) {
        const normalized = snapshotAttrs
          .map((a: any) => normalizeAttributeEntry(a, 'prospect_queue'))
          .filter(Boolean);
        if (normalized.length > 0) {
          await prisma.$executeRaw`
            UPDATE directory_listings_list
            SET attributes = ${JSON.stringify(normalized)}::jsonb, updated_at = now()
            WHERE id = ${s.listing_id}
          `;
          await prisma.$executeRaw`
            INSERT INTO directory_field_provenance (
              id, seed_id, tenant_id, field_key, value,
              source_name, accessed_at, confidence, show_on_public,
              created_at, updated_at
            ) VALUES (
              ${generateDirectoryFieldProvenanceId(s.tenant_id)},
              ${seedId},
              ${s.tenant_id},
              'attributes',
              'sourced',
              'prospect_queue',
              now(),
              ${confidence},
              true,
              now(), now()
            )
            ON CONFLICT (seed_id, field_key) DO NOTHING
          `;
          attributesWritten = normalized.length;
        }
      }

      // Sourced secondary shelves — the queue card now writes the scan's
      // suggested_categories into snapshot.secondary_categories, and batch
      // seed birth carries them onto the listing. Fill-missing only (same
      // as attributes): never reorder an operator-curated shelf list.
      let secondaryCategoriesWritten = 0;
      const snapshotSecondaryRaw = Array.isArray(snapshot?.secondary_categories) && snapshot.secondary_categories.length > 0
        ? snapshot.secondary_categories
        : (Array.isArray(snapshot?.suggested_categories) ? snapshot.suggested_categories : []);
      const primaryCatKey = String(s.primary_category ?? '').trim().toLowerCase();
      const seenSecondary = new Set<string>();
      const snapshotSecondary: string[] = [];
      for (const entry of snapshotSecondaryRaw) {
        const label = String(
          typeof entry === 'object' && entry ? (entry as any).category ?? '' : entry ?? '',
        ).trim();
        const key = label.toLowerCase();
        if (!label || key === primaryCatKey || seenSecondary.has(key)) continue;
        seenSecondary.add(key);
        snapshotSecondary.push(label);
      }
      if (secondary.length === 0 && snapshotSecondary.length > 0) {
        await prisma.$executeRaw`
          UPDATE directory_listings_list
          SET secondary_categories = ${snapshotSecondary}::text[], updated_at = now()
          WHERE id = ${s.listing_id}
        `;
        await prisma.$executeRaw`
          INSERT INTO directory_field_provenance (
            id, seed_id, tenant_id, field_key, value,
            source_name, accessed_at, confidence, show_on_public,
            created_at, updated_at
          ) VALUES (
            ${generateDirectoryFieldProvenanceId(s.tenant_id)},
            ${seedId},
            ${s.tenant_id},
            'secondary_categories',
            ${snapshotSecondary.join(', ')},
            'prospect_queue',
            now(),
            ${confidence},
            true,
            now(), now()
          )
          ON CONFLICT (seed_id, field_key) DO NOTHING
        `;
        secondaryCategoriesWritten = snapshotSecondary.length;
      }

      // Sourced opening hours — same fill-missing snapshot carry as the
      // batch seed paths (snapshot.hours, verified_nap.hours fallback).
      let hoursWritten = false;
      const snapshotHours = snapshot?.hours ?? snapshot?.verified_nap?.hours ?? null;
      if (!s.business_hours && snapshotHours && typeof snapshotHours === 'object') {
        const hoursSource = snapshot?.verified_nap?.hours ? 'verification_call' : 'prospect_queue';
        const hoursConfidence = snapshot?.verified_nap?.hours ? 'high' : confidence;
        await prisma.$executeRaw`
          UPDATE directory_listings_list
          SET business_hours = ${JSON.stringify(snapshotHours)}::jsonb, updated_at = now()
          WHERE id = ${s.listing_id}
        `;
        await prisma.$executeRaw`
          INSERT INTO directory_field_provenance (
            id, seed_id, tenant_id, field_key, value,
            source_name, accessed_at, confidence, show_on_public,
            created_at, updated_at
          ) VALUES (
            ${generateDirectoryFieldProvenanceId(s.tenant_id)},
            ${seedId},
            ${s.tenant_id},
            'hours',
            ${JSON.stringify(snapshotHours)},
            ${hoursSource},
            now(),
            ${hoursConfidence},
            true,
            now(), now()
          )
          ON CONFLICT (seed_id, field_key) DO NOTHING
        `;
        hoursWritten = true;
      }

      // SEO — per-seed compose through getComposedEnrichment: linked seeds
      // get the campaign packet (latest audit narrative), unlinked seeds the
      // market profile. Writes are fill-missing only — an existing
      // description/keywords/same_as (however it got there) is never
      // overwritten; the operator's Reset action is the overwrite path.
      let seoWritten = false;
      try {
        const composed = await DirectoryPresenceSeedService.getComposedEnrichment(seedId, {
          region: 'us-east-1',
          userId: ctx?.actorId,
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
        } as any);
        const packet = composed.packet as SeedSeoPacket;
        const seoSource =
          composed.sourceName && composed.sourceName !== 'none'
            ? composed.sourceName
            : 'market_enrichment';
        const seoConfidence = seoSource === 'market_enrichment' ? 'medium' : 'high';

        const hasDesc = typeof s.description === 'string' && s.description.trim() !== '';
        const hasKw = Array.isArray(s.keywords) && s.keywords.length > 0;
        const hasSameAs = Array.isArray(s.same_as) && s.same_as.length > 0;
        const hasSeoJson = s.seo_enrichment != null;

        if (!hasDesc || !hasKw || !hasSameAs) {
          await prisma.$executeRaw`
            UPDATE directory_listings_list
            SET description = CASE WHEN ${hasDesc} THEN description ELSE ${packet.description} END,
                keywords = CASE WHEN ${hasKw} THEN keywords ELSE ${packet.keywords}::text[] END,
                same_as = CASE WHEN ${hasSameAs} THEN same_as ELSE ${packet.sameAs}::text[] END,
                updated_at = now()
            WHERE id = ${s.listing_id}
          `;
        }
        if (!hasSeoJson) {
          await prisma.$executeRaw`
            UPDATE directory_presence_seeds
            SET seo_enrichment = ${buildSeoEnrichmentJson(packet)}::jsonb, updated_at = now()
            WHERE id = ${seedId}
          `;
        }
        // Provenance rows are insert-only — an existing row (any lane or a
        // human edit) outranks a backfill write.
        const seoProvRows: Array<[string, string]> = [];
        if (!hasDesc) seoProvRows.push(['description', packet.description]);
        if (!hasKw) seoProvRows.push(['keywords', packet.keywords.join(', ')]);
        if (!hasSameAs && packet.sameAs.length > 0) seoProvRows.push(['same_as', packet.sameAs.join(', ')]);
        for (const [fieldKey, value] of seoProvRows) {
          await prisma.$executeRaw`
            INSERT INTO directory_field_provenance (
              id, seed_id, tenant_id, field_key, value,
              source_name, accessed_at, confidence, show_on_public,
              created_at, updated_at
            ) VALUES (
              ${generateDirectoryFieldProvenanceId(s.tenant_id)},
              ${seedId},
              ${s.tenant_id},
              ${fieldKey},
              ${value},
              ${seoSource},
              now(),
              ${seoConfidence},
              true,
              now(), now()
            )
            ON CONFLICT (seed_id, field_key) DO NOTHING
          `;
        }
        seoWritten = !hasDesc || !hasKw || !hasSameAs || !hasSeoJson || seoProvRows.length > 0;
      } catch (err) {
        logger.error('DirectorySeedCleanupService.backfillEnrichment — SEO compose failed', undefined, {
          seedId,
          error: (err as Error).message,
        });
      }

      results.push({
        seedId,
        provenanceWritten,
        attributesWritten,
        secondaryCategoriesWritten,
        hoursWritten,
        seoSharpened: seoWritten,
      });
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_presence_seed.backfill_enrichment',
      payload: {
        seedIds,
        provenanceWritten: results.reduce((n, r) => n + (r.provenanceWritten ?? 0), 0),
        attributesWritten: results.reduce((n, r) => n + (r.attributesWritten ?? 0), 0),
        secondaryCategoriesWritten: results.reduce((n, r) => n + (r.secondaryCategoriesWritten ?? 0), 0),
        hoursWritten: results.filter((r) => r.hoursWritten).map((r) => r.seedId),
        seoSharpened: results.filter((r) => r.seoSharpened).map((r) => r.seedId),
      },
    });
    logger.info('DirectorySeedCleanupService.backfillEnrichment', undefined, {
      seedIds: seedIds.length,
      seoSharpened: results.filter((r) => r.seoSharpened).length,
    });

    return { results };
  }
}

export default new DirectorySeedCleanupService();
