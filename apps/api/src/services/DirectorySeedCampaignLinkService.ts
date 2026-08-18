/**
 * DirectorySeedCampaignLinkService — bridges directory_presence_seeds
 * (unclaimed public listings) with mkt_campaigns_list (operator-validated
 * prospect campaigns) so campaign signals can enrich the seed's SEO surface.
 *
 * Why a join table: a single physical business may have many sibling
 * campaigns (multi-archetype). One seed ↔ many campaigns.
 *
 * Projection direction: campaign → seed, one-way. The campaign is the
 * operator-validated source; the seed is the public surface. Every
 * projection writes a directory_field_provenance row with
 * source_name = 'linked_campaign' so the public disclaimer stays honest
 * and the audit trail survives.
 *
 * Auto-projection policy: linking auto-projects ONLY when NAP matches
 * with high confidence. Otherwise the operator gets a diff and picks
 * per-field via syncFromCampaign with an explicit field list.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import { audit } from '../audit';
import { generateDirectorySeedCampaignLinkId } from '../lib/id-generator';

interface LinkAuditCtx {
  actorType?: 'user' | 'system' | 'integration' | 'customer';
  actorId?: string;
  ip?: string;
  userAgent?: string;
}

export type LinkRole = 'primary' | 'sibling' | 'recovery';
export type NapConfidence = 'high' | 'medium' | 'low' | 'none';

/** Fields the operator can choose to project from campaign → seed. */
export type ProjectionField =
  | 'phone'
  | 'website'
  | 'primaryCategory'
  | 'secondaryCategories'
  | 'description'
  | 'originCountry'
  | 'originRegion'
  | 'neighborhood'
  | 'directoryProfile';

export interface NapMatchResult {
  confidence: NapConfidence;
  businessNameMatch: boolean;
  addressMatch: boolean;
  phoneMatch: boolean;
  cityMatch: boolean;
  notes: string[];
}

export interface LinkRow {
  id: string;
  seedId: string;
  campaignId: string;
  tenantId: string;
  linkRole: LinkRole;
  napMatchConfidence: NapConfidence;
  napMatchSummary: NapMatchResult | null;
  lastSyncedAt: Date | null;
  lastSyncFields: string[];
  createdAt: Date;
  updatedAt: Date;
  campaign?: {
    id: string;
    displayId: string | null;
    businessName: string | null;
    category: string;
    city: string;
    state: string | null;
    stage: string;
    campaignCategory: string;
  };
}

export interface DiffEntry {
  field: ProjectionField;
  campaignValue: any;
  seedValue: any;
  changed: boolean;
}

class DirectorySeedCampaignLinkService {
  // ============================
  // NAP matching
  // ============================

  /**
   * Compare seed listing NAP against campaign NAP.
   * High confidence = business name match AND (address match OR phone match)
   * AND city match. This is the gate for auto-projection on link.
   */
  async computeNapMatch(seedId: string, campaignId: string): Promise<NapMatchResult> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dl.business_name    AS seed_name,
        dl.address          AS seed_address,
        dl.city             AS seed_city,
        dl.state            AS seed_state,
        dl.phone            AS seed_phone,
        mc.business_name    AS camp_name,
        mc.address_line1    AS camp_address,
        mc.address_city     AS camp_city,
        mc.address_state    AS camp_state,
        mc.phone            AS camp_phone,
        mc.phones           AS camp_phones
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      CROSS JOIN mkt_campaigns_list mc
      WHERE dps.id = ${seedId}
        AND mc.id = ${campaignId}
      LIMIT 1
    `;
    if (!rows[0]) {
      return {
        confidence: 'none',
        businessNameMatch: false,
        addressMatch: false,
        phoneMatch: false,
        cityMatch: false,
        notes: ['seed_or_campaign_not_found'],
      };
    }
    const r = rows[0];
    const norm = (s: string | null | undefined): string =>
      (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    const normAddr = (s: string | null | undefined): string =>
      (s ?? '').toLowerCase().replace(/\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|pl|place)\b/g, '').replace(/[^a-z0-9]/g, '').trim();

    const businessNameMatch = !!r.seed_name && !!r.camp_name && norm(r.seed_name) === norm(r.camp_name);
    const addressMatch = !!r.seed_address && !!r.camp_address && normAddr(r.seed_address) === normAddr(r.camp_address);
    const cityMatch = !!r.seed_city && !!r.camp_city && norm(r.seed_city) === norm(r.camp_city);

    // Phone match: direct or any of campaign.phones[]
    const seedPhone = norm((r.seed_phone ?? '').replace(/[^0-9]/g, '')).slice(-10);
    const campPhone = norm((r.camp_phone ?? '').replace(/[^0-9]/g, '')).slice(-10);
    let phoneMatch = false;
    if (seedPhone && seedPhone.length >= 10) {
      if (campPhone && campPhone === seedPhone) phoneMatch = true;
      if (!phoneMatch && Array.isArray(r.camp_phones)) {
        phoneMatch = r.camp_phones.some((p: any) => {
          const digits = String(p?.phone ?? p ?? '').replace(/[^0-9]/g, '').slice(-10);
          return digits === seedPhone;
        });
      }
    }

    const notes: string[] = [];
    if (!businessNameMatch) notes.push('business_name_mismatch');
    if (!addressMatch) notes.push('address_mismatch');
    if (!phoneMatch) notes.push('phone_mismatch_or_missing');
    if (!cityMatch) notes.push('city_mismatch');

    let confidence: NapConfidence = 'none';
    if (businessNameMatch && cityMatch && (addressMatch || phoneMatch)) {
      confidence = 'high';
    } else if (businessNameMatch && (cityMatch || addressMatch || phoneMatch)) {
      confidence = 'medium';
    } else if (businessNameMatch || addressMatch || phoneMatch) {
      confidence = 'low';
    }

    return {
      confidence,
      businessNameMatch,
      addressMatch,
      phoneMatch,
      cityMatch,
      notes,
    };
  }

  // ============================
  // Link CRUD
  // ============================

  /**
   * Link a seed to a campaign. If NAP matches with high confidence,
   * auto-project campaign signals onto the seed listing. Otherwise
   * just record the link with the NAP summary for the operator to review.
   */
  async linkCampaign(
    seedId: string,
    campaignId: string,
    role: LinkRole,
    ctx?: LinkAuditCtx,
  ): Promise<{ link: LinkRow; autoProjected: boolean; napMatch: NapMatchResult }> {
    // Validate seed + campaign exist and load tenant
    const seedRow = await prisma.$queryRaw<any[]>`
      SELECT tenant_id, listing_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!seedRow[0]) throw new Error('seed_not_found');
    const tenantId = seedRow[0].tenant_id;

    const campRow = await prisma.$queryRaw<any[]>`
      SELECT id FROM mkt_campaigns_list WHERE id = ${campaignId} LIMIT 1
    `;
    if (!campRow[0]) throw new Error('campaign_not_found');

    // Enforce single primary link per seed
    if (role === 'primary') {
      const existingPrimary = await prisma.$queryRaw<any[]>`
        SELECT id FROM directory_seed_campaign_links
        WHERE seed_id = ${seedId} AND link_role = 'primary'
        LIMIT 1
      `;
      if (existingPrimary[0]) throw new Error('primary_link_already_exists');
    }

    const napMatch = await this.computeNapMatch(seedId, campaignId);
    const linkId = generateDirectorySeedCampaignLinkId(tenantId);

    await prisma.$executeRaw`
      INSERT INTO directory_seed_campaign_links (
        id, seed_id, campaign_id, tenant_id, link_role,
        nap_match_confidence, nap_match_summary, created_by,
        created_at, updated_at
      ) VALUES (
        ${linkId}, ${seedId}, ${campaignId}, ${tenantId}, ${role},
        ${napMatch.confidence}, ${JSON.stringify(napMatch)}::jsonb, ${ctx?.actorId || null},
        now(), now()
      )
      ON CONFLICT (seed_id, campaign_id) DO UPDATE SET
        link_role = EXCLUDED.link_role,
        nap_match_confidence = EXCLUDED.nap_match_confidence,
        nap_match_summary = EXCLUDED.nap_match_summary,
        updated_at = now()
    `;

    let autoProjected = false;
    if (napMatch.confidence === 'high') {
      try {
        await this.syncFromCampaign(seedId, campaignId, this.defaultProjectionFields(), ctx);
        autoProjected = true;
      } catch (err) {
        logger.error('DirectorySeedCampaignLinkService.linkCampaign — auto-project failed', undefined, {
          seedId, campaignId, error: (err as Error).message,
        });
      }
    }

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_seed_campaign_link.create',
      payload: { seedId, campaignId, role, napConfidence: napMatch.confidence, autoProjected },
    });

    const links = await this.listLinks(seedId);
    const link = links.find((l) => l.campaignId === campaignId)!;
    return { link, autoProjected, napMatch };
  }

  /**
   * Remove a link. Does NOT roll back projected fields — the operator can
   * re-edit the seed manually if needed. Provenance rows remain as the
   * audit trail of what was sourced from the campaign.
   */
  async unlinkCampaign(seedId: string, campaignId: string, ctx?: LinkAuditCtx): Promise<void> {
    const result = await prisma.$executeRaw`
      DELETE FROM directory_seed_campaign_links
      WHERE seed_id = ${seedId} AND campaign_id = ${campaignId}
    `;
    if (result === 0) throw new Error('link_not_found');

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_seed_campaign_link.delete',
      payload: { seedId, campaignId },
    });
  }

  /**
   * List all campaigns linked to a seed, with campaign summary.
   */
  async listLinks(seedId: string): Promise<LinkRow[]> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dscl.id, dscl.seed_id, dscl.campaign_id, dscl.tenant_id,
        dscl.link_role, dscl.nap_match_confidence, dscl.nap_match_summary,
        dscl.last_synced_at, dscl.last_sync_fields,
        dscl.created_at, dscl.updated_at,
        mc.display_id, mc.business_name, mc.category, mc.city, mc.state,
        mc.stage, mc.campaign_category
      FROM directory_seed_campaign_links dscl
      JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
      WHERE dscl.seed_id = ${seedId}
      ORDER BY
        CASE dscl.link_role WHEN 'primary' THEN 0 ELSE 1 END,
        dscl.created_at
    `;
    return rows.map((r) => ({
      id: r.id,
      seedId: r.seed_id,
      campaignId: r.campaign_id,
      tenantId: r.tenant_id,
      linkRole: r.link_role as LinkRole,
      napMatchConfidence: r.nap_match_confidence as NapConfidence,
      napMatchSummary: r.nap_match_summary as NapMatchResult | null,
      lastSyncedAt: r.last_synced_at ? new Date(r.last_synced_at) : null,
      lastSyncFields: Array.isArray(r.last_sync_fields) ? r.last_sync_fields : [],
      createdAt: new Date(r.created_at),
      updatedAt: new Date(r.updated_at),
      campaign: {
        id: r.campaign_id,
        displayId: r.display_id ?? null,
        businessName: r.business_name ?? null,
        category: r.category,
        city: r.city,
        state: r.state ?? null,
        stage: r.stage,
        campaignCategory: r.campaign_category,
      },
    }));
  }

  // ============================
  // Diff + projection
  // ============================

  /**
   * Compute a per-field diff between campaign signals and the current
   * seed listing. Used by the operator UI to pick which fields to project.
   */
  async buildDiff(seedId: string, campaignId: string): Promise<DiffEntry[]> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dl.phone, dl.website, dl.primary_category, dl.secondary_categories,
        dl.description, dl.keywords,
        mc.phone AS camp_phone, mc.website_url AS camp_website,
        mc.category AS camp_category,
        mc.neighborhood AS camp_neighborhood,
        mc.business_origin_country, mc.business_origin_region,
        mc.directory_profiles, mc.notes AS camp_notes
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      CROSS JOIN mkt_campaigns_list mc
      WHERE dps.id = ${seedId} AND mc.id = ${campaignId}
      LIMIT 1
    `;
    if (!rows[0]) return [];
    const r = rows[0];

    const entries: DiffEntry[] = [
      {
        field: 'phone',
        campaignValue: r.camp_phone ?? null,
        seedValue: r.phone ?? null,
        changed: (r.camp_phone ?? '') !== (r.phone ?? ''),
      },
      {
        field: 'website',
        campaignValue: r.camp_website ?? null,
        seedValue: r.website ?? null,
        changed: (r.camp_website ?? '') !== (r.website ?? ''),
      },
      {
        field: 'primaryCategory',
        campaignValue: r.camp_category ?? null,
        seedValue: r.primary_category ?? null,
        changed: (r.camp_category ?? '') !== (r.primary_category ?? ''),
      },
      {
        field: 'description',
        campaignValue: r.camp_notes ?? null,
        seedValue: r.description ?? null,
        changed: (r.camp_notes ?? '') !== (r.description ?? ''),
      },
      {
        field: 'originCountry',
        campaignValue: r.business_origin_country ?? null,
        seedValue: this.keywordContains(r.keywords, 'origin_country'),
        changed: !!r.business_origin_country,
      },
      {
        field: 'originRegion',
        campaignValue: r.business_origin_region ?? null,
        seedValue: this.keywordContains(r.keywords, 'origin_region'),
        changed: !!r.business_origin_region,
      },
      {
        field: 'neighborhood',
        campaignValue: r.camp_neighborhood ?? null,
        seedValue: this.keywordContains(r.keywords, 'neighborhood'),
        changed: !!r.camp_neighborhood,
      },
      {
        field: 'directoryProfile',
        campaignValue: r.directory_profiles ?? null,
        seedValue: null,
        changed: !!r.directory_profiles,
      },
    ];
    return entries;
  }

  /**
   * Project selected campaign fields onto the seed listing + write
   * provenance rows with source_name = 'linked_campaign'.
   *
   * Does NOT overwrite operator-entered seed data silently — the operator
   * explicitly passes the field list. The auto-projection path on link
   * only fires when NAP confidence is high.
   */
  async syncFromCampaign(
    seedId: string,
    campaignId: string,
    fields: ProjectionField[],
    ctx?: LinkAuditCtx,
  ): Promise<{ projected: ProjectionField[]; skipped: ProjectionField[] }> {
    if (fields.length === 0) {
      return { projected: [], skipped: [] };
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dps.tenant_id, dps.listing_id,
        dl.keywords,
        mc.phone AS camp_phone, mc.website_url AS camp_website,
        mc.category AS camp_category, mc.neighborhood AS camp_neighborhood,
        mc.business_origin_country, mc.business_origin_region,
        mc.directory_profiles, mc.notes AS camp_notes
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      CROSS JOIN mkt_campaigns_list mc
      WHERE dps.id = ${seedId} AND mc.id = ${campaignId}
      LIMIT 1
    `;
    if (!rows[0]) throw new Error('seed_or_campaign_not_found');
    const r = rows[0];
    const tenantId = r.tenant_id;
    const listingId = r.listing_id;
    const campaignAdminUrl = `/settings/admin/marketing-ops/recovery/${campaignId}`;

    const setClauses: string[] = ['updated_at = now()'];
    const params: any[] = [];
    const provenanceRows: Array<{ fieldKey: string; value: string | null }> = [];
    const projected: ProjectionField[] = [];
    const skipped: ProjectionField[] = [];

    const addSet = (col: string, value: any) => {
      setClauses.push(`${col} = $${params.length + 1}`);
      params.push(value);
    };

    for (const field of fields) {
      switch (field) {
        case 'phone':
          if (r.camp_phone) {
            addSet('phone', r.camp_phone);
            provenanceRows.push({ fieldKey: 'phone', value: r.camp_phone });
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'website':
          if (r.camp_website) {
            addSet('website', r.camp_website);
            provenanceRows.push({ fieldKey: 'website', value: r.camp_website });
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'primaryCategory':
          if (r.camp_category) {
            addSet('primary_category', r.camp_category);
            provenanceRows.push({ fieldKey: 'primary_category', value: r.camp_category });
            // Also update seed.category so /place browse stays consistent
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'secondaryCategories':
          // Campaign doesn't carry secondary categories directly; skip
          skipped.push(field);
          break;
        case 'description':
          if (r.camp_notes) {
            addSet('description', r.camp_notes);
            provenanceRows.push({ fieldKey: 'description', value: r.camp_notes });
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'originCountry':
          if (r.business_origin_country) {
            const kw = this.mergeKeyword(r.keywords, `origin_country:${r.business_origin_country}`);
            addSet('keywords', kw);
            provenanceRows.push({ fieldKey: 'origin_country', value: r.business_origin_country });
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'originRegion':
          if (r.business_origin_region) {
            const kw = this.mergeKeyword(r.keywords, `origin_region:${r.business_origin_region}`);
            addSet('keywords', kw);
            provenanceRows.push({ fieldKey: 'origin_region', value: r.business_origin_region });
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'neighborhood':
          if (r.camp_neighborhood) {
            const kw = this.mergeKeyword(r.keywords, `neighborhood:${r.camp_neighborhood}`);
            addSet('keywords', kw);
            provenanceRows.push({ fieldKey: 'neighborhood', value: r.camp_neighborhood });
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'directoryProfile':
          // Stored as provenance only — directory_profiles JSON is structured
          // data we don't flatten onto the listing. Provenance row preserves
          // the link for downstream consumers.
          if (r.directory_profiles) {
            provenanceRows.push({
              fieldKey: 'directory_profile',
              value: JSON.stringify(r.directory_profiles),
            });
            projected.push(field);
          } else skipped.push(field);
          break;
      }
    }

    // Update listing columns (if any non-keyword sets)
    const listingCols = setClauses.filter((c) => !c.startsWith('keywords') && c !== 'updated_at = now()');
    if (listingCols.length > 0 || setClauses.length > 1) {
      params.push(listingId);
      await prisma.$executeRawUnsafe(
        `UPDATE directory_listings_list SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
        ...params,
      );
    }

    // If primary category changed, mirror to seed row
    if (fields.includes('primaryCategory') && r.camp_category) {
      await prisma.$executeRaw`
        UPDATE directory_presence_seeds SET category = ${r.camp_category}, updated_at = now()
        WHERE id = ${seedId}
      `;
    }

    // Write provenance rows (upsert by seed_id + field_key)
    for (const p of provenanceRows) {
      const provenanceId = `${p.fieldKey}-${seedId}-${campaignId}`.substring(0, 60);
      await prisma.$executeRaw`
        INSERT INTO directory_field_provenance (
          id, seed_id, tenant_id, field_key, value,
          source_name, source_url, accessed_at, confidence, show_on_public,
          created_at, updated_at
        ) VALUES (
          ${provenanceId}, ${seedId}, ${tenantId}, ${p.fieldKey}, ${p.value || null},
          'linked_campaign', ${campaignAdminUrl}, now(), 'high', true,
          now(), now()
        )
        ON CONFLICT (seed_id, field_key) DO UPDATE SET
          value = EXCLUDED.value,
          source_name = EXCLUDED.source_name,
          source_url = EXCLUDED.source_url,
          accessed_at = EXCLUDED.accessed_at,
          confidence = EXCLUDED.confidence,
          show_on_public = EXCLUDED.show_on_public,
          updated_at = now()
      `;
    }

    // Update link sync metadata
    await prisma.$executeRaw`
      UPDATE directory_seed_campaign_links
      SET last_synced_at = now(), last_sync_fields = ${projected}::text[], updated_at = now()
      WHERE seed_id = ${seedId} AND campaign_id = ${campaignId}
    `;

    audit({
      actor: ctx?.actorId,
      actorType: ctx?.actorType,
      action: 'directory_seed_campaign_link.sync',
      payload: { seedId, campaignId, projected, skipped },
    });

    logger.info('DirectorySeedCampaignLinkService.syncFromCampaign', undefined, {
      seedId, campaignId, projected, skipped,
    });

    return { projected, skipped };
  }

  /**
   * Search for campaigns that match a seed by business name or phone,
   * for the operator "Link a campaign" picker. Excludes already-linked.
   */
  async findCandidateCampaigns(seedId: string, query?: string, limit = 20): Promise<Array<{
    id: string;
    displayId: string | null;
    businessName: string | null;
    category: string;
    city: string;
    state: string | null;
    stage: string;
    campaignCategory: string;
    alreadyLinked: boolean;
  }>> {
    const seedRow = await prisma.$queryRaw<any[]>`
      SELECT dl.business_name, dl.phone, dl.city
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ${seedId} LIMIT 1
    `;
    if (!seedRow[0]) return [];
    const s = seedRow[0];

    // Base match: business name similarity OR city+category match.
    // Optional text query further filters by name/category/city.
    const q = (query ?? '').trim();
    const namePattern = `%${s.business_name ?? ''}%`;
    const cityPattern = `%${q}%`;
    const qNamePattern = `%${q}%`;

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        mc.id, mc.display_id, mc.business_name, mc.category, mc.city,
        mc.state, mc.stage, mc.campaign_category,
        EXISTS (
          SELECT 1 FROM directory_seed_campaign_links dscl
          WHERE dscl.campaign_id = mc.id AND dscl.seed_id = ${seedId}
        ) AS already_linked
      FROM mkt_campaigns_list mc
      WHERE
        (
          mc.business_name ILIKE ${namePattern}
          OR (mc.city = ${s.city} AND mc.category ILIKE ${namePattern})
        )
        AND (
          ${q} = '' OR
          mc.business_name ILIKE ${qNamePattern} OR
          mc.category ILIKE ${qNamePattern} OR
          mc.city ILIKE ${cityPattern}
        )
      ORDER BY
        CASE WHEN mc.business_name ILIKE ${namePattern} THEN 0 ELSE 1 END,
        mc.created_at DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      id: r.id,
      displayId: r.display_id ?? null,
      businessName: r.business_name ?? null,
      category: r.category,
      city: r.city,
      state: r.state ?? null,
      stage: r.stage,
      campaignCategory: r.campaign_category,
      alreadyLinked: !!r.already_linked,
    }));
  }

  // ============================
  // Helpers
  // ============================

  /** Default fields to auto-project when NAP confidence is high. */
  defaultProjectionFields(): ProjectionField[] {
    return [
      'phone',
      'website',
      'primaryCategory',
      'originCountry',
      'originRegion',
      'neighborhood',
    ];
  }

  private mergeKeyword(existing: string[] | null, newKw: string): string[] {
    const base = Array.isArray(existing) ? existing.filter((k) => !k.startsWith(newKw.split(':')[0] + ':')) : [];
    return [...base, newKw];
  }

  private keywordContains(keywords: string[] | null, prefix: string): string | null {
    if (!Array.isArray(keywords)) return null;
    const found = keywords.find((k) => k.startsWith(prefix + ':'));
    return found ? found.split(':').slice(1).join(':') : null;
  }
}

export default new DirectorySeedCampaignLinkService();
