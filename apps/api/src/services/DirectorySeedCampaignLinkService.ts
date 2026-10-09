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
import { isStubBusinessAnalysisAudit } from '../lib/marketing-audits';
import {
  resolveCampaignNap,
  formatNapAddress,
  type ResolvedNap,
} from '../lib/canonical-nap';
import {
  buildSeedSeoPacket,
  buildSeoEnrichmentJson,
} from './directory/SeedSeoComposer';
import IntelligenceProfileService from './intelligence/IntelligenceProfileService';

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
  | 'name'
  | 'address'
  | 'hours'
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
    playbookCode: string | null;
    playbookName: string | null;
    playbookArchetype: string | null;
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
    const businessNameMatch = !!r.seed_name && !!r.camp_name && this.norm(r.seed_name) === this.norm(r.camp_name);
    const addressMatch = !!r.seed_address && !!r.camp_address && this.normAddr(r.seed_address) === this.normAddr(r.camp_address);
    const cityMatch = !!r.seed_city && !!r.camp_city && this.norm(r.seed_city) === this.norm(r.camp_city);

    // Phone match: direct or any of campaign.phones[]
    const seedPhone = this.norm((r.seed_phone ?? '').replace(/[^0-9]/g, '')).slice(-10);
    const campPhone = this.norm((r.camp_phone ?? '').replace(/[^0-9]/g, '')).slice(-10);
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
   * W1d — seed-link suggestions for a campaign (Profile Repair Fulfillment
   * Sprint). Finds candidate seeds for the campaign's business and scores
   * each with computeNapMatch, returning the top five.
   *
   * Candidate pool: seeds in the campaign's city+state, plus any seed whose
   * listing phone matches the campaign phone. Scored, sorted by confidence
   * (high > medium > low > none) then by number of matched fields.
   */
  async suggestSeedLinks(
    campaignId: string,
  ): Promise<Array<{
    seedId: string;
    businessName: string;
    confidence: NapConfidence;
    napMatchSummary: NapMatchResult;
    alreadyLinked: boolean;
  }>> {
    const campRows = await prisma.$queryRaw<any[]>`
      SELECT business_name, address_line1, address_city, address_state, phone, phones
      FROM mkt_campaigns_list WHERE id = ${campaignId} LIMIT 1
    `;
    const camp = campRows[0];
    if (!camp) throw new Error('campaign_not_found');

    const city = (camp.address_city ?? '').trim();
    const state = (camp.address_state ?? '').trim();
    const phoneDigits = (camp.phone ?? '').replace(/[^0-9]/g, '').slice(-10);
    const extraPhones: string[] = Array.isArray(camp.phones)
      ? camp.phones
          .map((p: any) => String(p?.phone ?? p ?? '').replace(/[^0-9]/g, '').slice(-10))
          .filter((d: string) => d.length >= 10)
      : [];
    const allPhones = Array.from(new Set([phoneDigits, ...extraPhones].filter(Boolean)));

    // Candidate pool: same city+state OR phone match on the listing.
    const candidates = await prisma.$queryRaw<any[]>`
      SELECT dps.id AS seed_id, dl.business_name, dl.city, dl.state, dl.phone
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE (
        (lower(dl.city) = lower(${city}) AND lower(dl.state) = lower(${state}) AND ${city} <> '' AND ${state} <> '')
        OR (
          ${allPhones.length} > 0
          AND right(regexp_replace(coalesce(dl.phone, ''), '[^0-9]', '', 'g'), 10) = ANY(${allPhones}::text[])
        )
      )
      LIMIT 50
    `;

    if (candidates.length === 0) return [];

    const linked = await prisma.directory_seed_campaign_links.findMany({
      where: { campaign_id: campaignId },
      select: { seed_id: true },
    });
    const linkedSet = new Set(linked.map((l) => l.seed_id));

    const confidenceRank: Record<NapConfidence, number> = { high: 3, medium: 2, low: 1, none: 0 };

    const scored = await Promise.all(
      candidates.map(async (c) => {
        const napMatch = await this.computeNapMatch(c.seed_id, campaignId);
        const matchCount =
          Number(napMatch.businessNameMatch) +
          Number(napMatch.addressMatch) +
          Number(napMatch.phoneMatch) +
          Number(napMatch.cityMatch);
        return {
          seedId: c.seed_id as string,
          businessName: (c.business_name as string) ?? '',
          confidence: napMatch.confidence,
          napMatchSummary: napMatch,
          alreadyLinked: linkedSet.has(c.seed_id),
          _rank: confidenceRank[napMatch.confidence] * 10 + matchCount,
        };
      }),
    );

    return scored
      .sort((a, b) => b._rank - a._rank)
      .slice(0, 5)
      .map(({ _rank, ...rest }) => rest);
  }



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
      SELECT id, business_prospect_id, is_primary_sibling FROM mkt_campaigns_list
      WHERE id = ${campaignId} LIMIT 1
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

      // One seed per prospect: a non-primary sibling campaign never owns a
      // seed's primary link — the prospect's seed belongs to the primary
      // sibling, and this campaign attaches to it with 'sibling' instead.
      if (campRow[0].business_prospect_id && campRow[0].is_primary_sibling === false) {
        throw new Error('non_primary_sibling');
      }
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
        mc.stage, mc.campaign_category, mc.playbook_code,
        pc.name AS playbook_name, pc.archetype AS playbook_archetype
      FROM directory_seed_campaign_links dscl
      JOIN mkt_campaigns_list mc ON mc.id = dscl.campaign_id
      LEFT JOIN mkt_playbook_catalog pc ON pc.code = mc.playbook_code
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
        playbookCode: r.playbook_code ?? null,
        playbookName: r.playbook_name ?? null,
        playbookArchetype: r.playbook_archetype ?? null,
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
        dl.business_name AS seed_business_name,
        dl.address AS seed_address, dl.city AS seed_city,
        dl.state AS seed_state, dl.zip_code AS seed_zip,
        dl.business_hours AS seed_hours,
        mc.phone AS camp_phone, mc.website_url AS camp_website,
        mc.business_name AS camp_business_name,
        mc.address_line1 AS camp_address_line1,
        mc.address_line2 AS camp_address_line2,
        mc.address_city AS camp_city, mc.address_state AS camp_state,
        mc.address_zip AS camp_address_zip,
        mc.business_hours AS camp_hours,
        mc.category AS camp_category,
        mc.secondary_categories AS camp_secondary_categories,
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

    // Canonical campaign NAP — same resolution createFromCampaign uses, so
    // the diff shows exactly what "Add to place listing" would write.
    const audit = await this.getLatestBusinessAnalysisAudit(campaignId);
    const nap = this.resolveNap(r, audit?.audit_data ?? null);
    const street = [nap.address, nap.address2].filter(Boolean).join(', ') || null;
    const seedAddressDisplay =
      [r.seed_address, r.seed_city, [r.seed_state, r.seed_zip].filter(Boolean).join(' ')]
        .filter(Boolean)
        .join(', ') || null;
    const addressChanged =
      (!!street && this.normAddr(street) !== this.normAddr(r.seed_address)) ||
      (!!nap.city && this.norm(nap.city) !== this.norm(r.seed_city)) ||
      (!!nap.state && this.norm(nap.state) !== this.norm(r.seed_state)) ||
      (!!nap.zip && this.norm(nap.zip) !== this.norm(r.seed_zip));

    const campHoursCanon = this.canonicalHoursJson(r.camp_hours);
    const seedHoursCanon = this.canonicalHoursJson(r.seed_hours);

    const normalizeCatArray = (v: any): string[] =>
      Array.isArray(v) ? v.map((s: any) => String(s).trim()).filter(Boolean) : [];

    const campSecondary = normalizeCatArray(r.camp_secondary_categories);
    const seedSecondary = normalizeCatArray(r.secondary_categories);
    const secondaryChanged =
      campSecondary.length > 0 &&
      campSecondary.some((c: string) => !seedSecondary.some((s: string) => s.toLowerCase() === c.toLowerCase()));

    const entries: DiffEntry[] = [
      {
        field: 'name',
        campaignValue: nap.name ?? null,
        seedValue: r.seed_business_name ?? null,
        changed: !!nap.name && this.norm(nap.name) !== this.norm(r.seed_business_name),
      },
      {
        field: 'address',
        campaignValue: formatNapAddress(nap, { includeZip: true }),
        seedValue: seedAddressDisplay,
        changed: addressChanged,
      },
      {
        field: 'hours',
        campaignValue: this.summarizeHours(r.camp_hours),
        seedValue: this.summarizeHours(r.seed_hours),
        changed: !!campHoursCanon && campHoursCanon !== seedHoursCanon,
      },
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
        field: 'secondaryCategories',
        campaignValue: campSecondary.length > 0 ? campSecondary : null,
        seedValue: seedSecondary.length > 0 ? seedSecondary : null,
        changed: secondaryChanged,
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
        dl.keywords, dl.business_name,
        mc.phone AS camp_phone, mc.website_url AS camp_website,
        mc.business_name AS camp_business_name,
        mc.address_line1 AS camp_address_line1,
        mc.address_line2 AS camp_address_line2,
        mc.address_zip AS camp_address_zip,
        mc.business_hours AS camp_hours,
        mc.category AS camp_category,
        mc.secondary_categories AS camp_secondary_categories,
        mc.neighborhood AS camp_neighborhood,
        mc.address_city AS camp_city, mc.address_state AS camp_state,
        mc.intelligence_focus,
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
    const campaignAdminUrl = `/settings/admin/marketing-ops/campaigns/${campaignId}`;

    // Pre-load current provenance for operator-override guard (§5.7.1).
    // Only description/keywords/same_as are relevant for the projection fields
    // that mutate SEO-facing columns.
    const currentProvenance = await prisma.directory_field_provenance.findMany({
      where: {
        seed_id: seedId,
        field_key: { in: ['description', 'keywords', 'same_as'] },
      },
    });
    const provenanceByField = new Map(currentProvenance.map((p) => [p.field_key, p]));
    const isOverridden = (fieldKey: string) =>
      provenanceByField.get(fieldKey)?.source_name === 'operator_override';

    const setClauses: string[] = ['updated_at = now()'];
    const params: any[] = [];
    const provenanceRows: Array<{ fieldKey: string; value: string | null }> = [];
    const projected: ProjectionField[] = [];
    const skipped: ProjectionField[] = [];

    const addSet = (col: string, value: any, cast?: string) => {
      setClauses.push(`${col} = $${params.length + 1}${cast ? `::${cast}` : ''}`);
      params.push(value);
    };

    // Lazily resolved once — the canonical campaign NAP (same contract as
    // createFromCampaign) backs the name/address projections, and the
    // description projection needs the same audit row.
    let auditCache: any = undefined;
    const loadAudit = async (): Promise<any | null> => {
      if (auditCache === undefined) {
        auditCache = await this.getLatestBusinessAnalysisAudit(campaignId);
      }
      return auditCache;
    };
    let napCache: ResolvedNap | null = null;
    const loadNap = async (): Promise<ResolvedNap> => {
      if (!napCache) {
        napCache = this.resolveNap(r, (await loadAudit())?.audit_data ?? null);
      }
      return napCache;
    };

    // Post-update mirrors — the listing isn't the only surface carrying NAP;
    // these ride along after the UPDATE below (same writes createSeed and
    // the seed edit form make).
    let nameToSync: string | null = null;
    let addressToSync: {
      line1: string | null;
      line2: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    } | null = null;
    let hoursToSync: Record<string, any> | null = null;

    for (const field of fields) {
      switch (field) {
        case 'name': {
          const nap = await loadNap();
          if (nap.name) {
            addSet('business_name', nap.name);
            provenanceRows.push({ fieldKey: 'name', value: nap.name });
            nameToSync = nap.name;
            projected.push(field);
          } else skipped.push(field);
          break;
        }
        case 'address': {
          const nap = await loadNap();
          const street = [nap.address, nap.address2].filter(Boolean).join(', ') || null;
          if (!street && !nap.city && !nap.state && !nap.zip) {
            skipped.push(field);
            break;
          }
          // Only the parts the resolution produced are written — a missing
          // component (e.g. unverified zip) never nulls out seed data.
          if (street) addSet('address', street);
          if (nap.city) addSet('city', nap.city);
          if (nap.state) addSet('state', nap.state);
          if (nap.zip) addSet('zip_code', nap.zip);
          addressToSync = {
            line1: nap.address,
            line2: nap.address2,
            city: nap.city,
            state: nap.state,
            zip: nap.zip,
          };
          provenanceRows.push({
            fieldKey: 'address',
            value: formatNapAddress(nap, { includeZip: true }),
          });
          projected.push(field);
          break;
        }
        case 'hours': {
          const hours = r.camp_hours;
          if (hours && typeof hours === 'object' && !Array.isArray(hours)) {
            addSet('business_hours', JSON.stringify(hours), 'jsonb');
            hoursToSync = hours;
            provenanceRows.push({
              fieldKey: 'hours',
              value: this.summarizeHours(hours) || JSON.stringify(hours).substring(0, 400),
            });
            projected.push(field);
          } else skipped.push(field);
          break;
        }
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
        case 'secondaryCategories': {
          // Project campaign.secondary_categories onto the seed listing.
          // Union with existing seed secondaries (case-insensitive dedup),
          // exclude the primary category, cap at 9. This lets a category
          // identification scan run after seed creation and flow its found
          // categories onto the seed via the Sync modal.
          const campSec = Array.isArray(r.camp_secondary_categories)
            ? r.camp_secondary_categories.map((c: any) => String(c).trim()).filter(Boolean)
            : [];
          if (campSec.length === 0) {
            skipped.push(field);
            break;
          }
          const primaryCat = (r.camp_category ?? '').toLowerCase();
          // Read current seed secondary_categories from the listing row we
          // already loaded (dl.secondary_categories is NOT in the sync query;
          // we union against the listing's current value via a sub-fetch).
          const currentSeedSecRows = await prisma.$queryRaw<any[]>`
            SELECT dl.secondary_categories
            FROM directory_presence_seeds dps
            JOIN directory_listings_list dl ON dl.id = dps.listing_id
            WHERE dps.id = ${seedId}
            LIMIT 1
          `;
          const currentSeedSec: string[] = Array.isArray(currentSeedSecRows[0]?.secondary_categories)
            ? currentSeedSecRows[0].secondary_categories.map((s: any) => String(s).trim()).filter(Boolean)
            : [];
          const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
          const merged: string[] = [...currentSeedSec];
          for (const cat of campSec) {
            if (primaryCat && eq(primaryCat, cat)) continue;
            if (merged.some((m) => eq(m, cat))) continue;
            merged.push(cat);
          }
          const capped = merged.slice(0, 9);
          if (capped.length === currentSeedSec.length) {
            // Nothing new to add
            skipped.push(field);
            break;
          }
          addSet('secondary_categories', capped);
          provenanceRows.push({ fieldKey: 'secondary_categories', value: campSec.join(', ') });
          projected.push(field);
          break;
        }
        case 'description': {
          // Spec §5.4: replace raw notes projection with composer output.
          // When the composer degrades (no audit, no profile), write nothing
          // rather than falling back to notes — the notes-leak path is
          // closed unconditionally, not conditionally.
          const descriptionOverridden = isOverridden('description');
          const keywordsOverridden = isOverridden('keywords');
          const sameAsOverridden = isOverridden('same_as');

          const auditRow = await loadAudit();

          if (auditRow) {
            const ad = (auditRow.audit_data ?? {}) as any;
            const ameta = ad.audit_metadata ?? {};
            const agoogle = ad.platforms?.google ?? {};
            const platformsObj = ad.platforms ?? {};
            const platformProfileUrls: Array<{ platform: string; url: string }> = [];
            for (const pkey of ['google', 'yelp', 'facebook', 'bbb']) {
              const pdata = (platformsObj as any)[pkey];
              if (pdata?.profile_url && typeof pdata.profile_url === 'string') {
                platformProfileUrls.push({ platform: pkey, url: pdata.profile_url });
              }
            }

            const seoFocus = (r.intelligence_focus === 'gold_standards'
              ? 'competitive'
              : r.intelligence_focus || 'competitive') as 'emerging' | 'competitive';
            const ipProfile = await IntelligenceProfileService.resolve(
              r.camp_category || '',
              seoFocus,
              r.camp_city ?? null,
              null,
            ).catch(() => null);

            const packet = buildSeedSeoPacket({
              campaign: {
                businessName: r.camp_business_name || r.business_name,
                category: r.camp_category || '',
                addressCity: r.camp_city ?? null,
                addressState: r.camp_state ?? null,
                neighborhood: r.camp_neighborhood ?? null,
                businessOriginCountry: r.business_origin_country ?? null,
                businessOriginRegion: r.business_origin_region ?? null,
                directoryProfiles: Array.isArray(r.directory_profiles) ? r.directory_profiles : null,
                socialProfiles: null,
              },
              audit: {
                auditId: auditRow.id,
                storeFormat: ameta.matched_business?.store_format ?? null,
                googleAdditionalCategories: agoogle.additional_categories ?? null,
                platformProfileUrls: platformProfileUrls.length > 0 ? platformProfileUrls : null,
              },
              intelligenceProfile: ipProfile
                ? {
                    profileId: ipProfile.id,
                    synonyms: ipProfile.configuration_json?.synonyms ?? undefined,
                    subcategories: ipProfile.configuration_json?.subcategories ?? undefined,
                    prohibitedKeywords: ipProfile.configuration_json?.prohibited_keywords ?? undefined,
                    schemaOrgType: ipProfile.configuration_json?.schema_org_type ?? null,
                  }
                : null,
              goldStandard: null,
            });

            if (packet.description) {
              let wroteAny = false;
              if (!descriptionOverridden) {
                addSet('description', packet.description);
                provenanceRows.push({ fieldKey: 'description', value: packet.description });
                wroteAny = true;
              }
              if (!keywordsOverridden) {
                addSet('keywords', packet.keywords);
                provenanceRows.push({ fieldKey: 'keywords', value: packet.keywords.join(', ') });
                wroteAny = true;
              }
              if (!sameAsOverridden) {
                addSet('same_as', packet.sameAs);
                if (packet.sameAs.length > 0) {
                  provenanceRows.push({ fieldKey: 'same_as', value: packet.sameAs.join(', ') });
                }
                wroteAny = true;
              }

              // Update seo_enrichment on the seed row only when at least one
              // non-overridden field was projected. If all three are overridden,
              // the entire description projection is skipped.
              if (wroteAny) {
                await prisma.$executeRaw`
                  UPDATE directory_presence_seeds
                  SET seo_enrichment = ${JSON.stringify(buildSeoEnrichmentJson(packet))}::jsonb, updated_at = now()
                  WHERE id = ${seedId}
                `;
                projected.push(field);
              } else {
                skipped.push(field);
              }
            } else {
              skipped.push(field);
            }
          } else {
            // No audit → composer degrades → write nothing (NOT notes)
            skipped.push(field);
          }
          break;
        }
        case 'originCountry':
          if (isOverridden('keywords')) {
            skipped.push(field);
            break;
          }
          if (r.business_origin_country) {
            const kw = this.mergeKeyword(r.keywords, `origin_country:${r.business_origin_country}`);
            addSet('keywords', kw);
            provenanceRows.push({ fieldKey: 'origin_country', value: r.business_origin_country });
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'originRegion':
          if (isOverridden('keywords')) {
            skipped.push(field);
            break;
          }
          if (r.business_origin_region) {
            const kw = this.mergeKeyword(r.keywords, `origin_region:${r.business_origin_region}`);
            addSet('keywords', kw);
            provenanceRows.push({ fieldKey: 'origin_region', value: r.business_origin_region });
            projected.push(field);
          } else skipped.push(field);
          break;
        case 'neighborhood':
          if (isOverridden('keywords')) {
            skipped.push(field);
            break;
          }
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

    // Name mirror — the tenant record + business profile carry the same
    // display name, and the seed's name_variants ledger gets the new
    // canonical name prepended (the superseded name stays as a variant for
    // dedup/report identity matching).
    if (nameToSync) {
      await prisma.$executeRaw`
        UPDATE tenants SET name = ${nameToSync}, updated_at = now() WHERE id = ${tenantId}
      `;
      await prisma.$executeRaw`
        UPDATE tenant_business_profiles_list
        SET business_name = ${nameToSync}, updated_at = now()
        WHERE tenant_id = ${tenantId}
      `;
      await prisma.$executeRaw`
        UPDATE directory_presence_seeds
        SET name_variants = array_prepend(
              ${nameToSync},
              array_remove(COALESCE(name_variants, '{}'::text[]), ${nameToSync})
            ),
            updated_at = now()
        WHERE id = ${seedId}
      `;
    }

    // Address mirror — seed city/state (drives /place browse + seed list
    // filters) and the business profile's structured address columns. Only
    // resolved components are written.
    if (addressToSync) {
      const { line1, line2, city, state, zip } = addressToSync;
      if (city || state) {
        await prisma.$executeRaw`
          UPDATE directory_presence_seeds
          SET city = COALESCE(${city}, city),
              state = COALESCE(${state}, state),
              updated_at = now()
          WHERE id = ${seedId}
        `;
      }
      const profSets: string[] = ['updated_at = now()'];
      const profParams: any[] = [];
      const profSet = (col: string, v: string) => {
        profSets.push(`${col} = $${profParams.length + 1}`);
        profParams.push(v);
      };
      if (line1) profSet('address_line1', line1);
      if (line2) profSet('address_line2', line2);
      if (city) profSet('city', city);
      if (state) profSet('state', state);
      if (zip) profSet('postal_code', zip);
      if (profSets.length > 1) {
        profParams.push(tenantId);
        await prisma.$executeRawUnsafe(
          `UPDATE tenant_business_profiles_list SET ${profSets.join(', ')} WHERE tenant_id = $${profParams.length}`,
          ...profParams,
        );
      }
    }

    // Hours mirror — same fan-out the seed edit form performs: the canonical
    // business_hours_list (public hours/status endpoints read it) plus the
    // legacy business profile hours blob.
    if (hoursToSync) {
      const tz = hoursToSync.timezone || 'America/New_York';
      const periods: any[] = [];
      const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const day of dayOrder) {
        const h = hoursToSync[day];
        if (h && typeof h === 'object' && !h.closed && h.open && h.close) {
          periods.push({ day: day.toUpperCase(), open: h.open, close: h.close });
        }
      }
      await prisma.business_hours_list.upsert({
        where: { tenant_id: tenantId },
        update: { timezone: tz, periods: periods as any, updated_at: new Date() },
        create: {
          id: `${tenantId}_hours`,
          tenant_id: tenantId,
          timezone: tz,
          periods: periods as any,
          updated_at: new Date(),
        },
      });
      const { updateBusinessProfileHours } = await import('../utils/business-hours-utils');
      await updateBusinessProfileHours(tenantId);
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

    // §5.1 report trigger — a projection that moves the seed's identity must
    // re-version the minted intelligence report (the Report QR Kit otherwise
    // keeps serving the pre-sync snapshot). Idempotent via the evidence
    // snapshot hash; best-effort so a lint/build failure never fails the sync.
    if (projected.length > 0) {
      try {
        const { SeedIntelligenceReportService } = await import('./intelligence/SeedIntelligenceReportService.js');
        await SeedIntelligenceReportService.getInstance().refreshReport(
          seedId,
          ctx ? { region: 'us-east-1', userId: ctx.actorId, ip: ctx.ip, userAgent: ctx.userAgent } : undefined,
        );
      } catch (err: any) {
        logger.warn('DirectorySeedCampaignLinkService: post-sync report refresh failed', undefined, {
          seedId,
          error: err?.message,
        });
      }
    }

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
   * Reverse lookup: list all seeds linked to a campaign, with the listing
   * slug (for the public /place/<slug> URL), seed status, claim state, and
   * link metadata. Powers the campaign overview "Spawned Place Listings"
   * section so an operator can re-open a seed created via the audit tab's
   * "Add to place listing" action on a later visit.
   */
  async listSeedsForCampaign(campaignId: string): Promise<Array<{
    seedId: string;
    listingId: string;
    tenantId: string;
    slug: string | null;
    businessName: string | null;
    status: string;
    linkRole: LinkRole;
    napMatchConfidence: NapConfidence;
    publicUrl: string | null;
    /** Whether the listing's public /place page resolves (dl.is_published). */
    isPublished: boolean;
    claimedAt: Date | null;
    publishedAt: Date | null;
    createdAt: Date;
  }>> {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        dps.id           AS seed_id,
        dps.listing_id,
        dps.tenant_id,
        dps.status,
        dps.published_at,
        dps.claimed_at,
        dps.created_at,
        dl.slug,
        dl.business_name,
        dl.is_published,
        dscl.link_role,
        dscl.nap_match_confidence
      FROM directory_seed_campaign_links dscl
      JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dscl.campaign_id = ${campaignId}
      ORDER BY
        CASE dscl.link_role WHEN 'primary' THEN 0 ELSE 1 END,
        dps.created_at
    `;
    return rows.map((r) => ({
      seedId: r.seed_id,
      listingId: r.listing_id,
      tenantId: r.tenant_id,
      slug: r.slug ?? null,
      businessName: r.business_name ?? null,
      status: r.status ?? 'pending',
      linkRole: r.link_role as LinkRole,
      napMatchConfidence: (r.nap_match_confidence ?? 'none') as NapConfidence,
      publicUrl: r.slug ? `/place/${r.slug}` : null,
      isPublished: !!r.is_published,
      claimedAt: r.claimed_at ? new Date(r.claimed_at) : null,
      publishedAt: r.published_at ? new Date(r.published_at) : null,
      createdAt: new Date(r.created_at),
    }));
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
    playbookCode: string | null;
    playbookName: string | null;
    playbookArchetype: string | null;
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
        mc.state, mc.stage, mc.campaign_category, mc.playbook_code,
        pc.name AS playbook_name, pc.archetype AS playbook_archetype,
        EXISTS (
          SELECT 1 FROM directory_seed_campaign_links dscl
          WHERE dscl.campaign_id = mc.id AND dscl.seed_id = ${seedId}
        ) AS already_linked
      FROM mkt_campaigns_list mc
      LEFT JOIN mkt_playbook_catalog pc ON pc.code = mc.playbook_code
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
      playbookCode: r.playbook_code ?? null,
      playbookName: r.playbook_name ?? null,
      playbookArchetype: r.playbook_archetype ?? null,
      alreadyLinked: !!r.already_linked,
    }));
  }

  // ============================
  // Helpers
  // ============================

  /** Default fields to auto-project when NAP confidence is high. */
  defaultProjectionFields(): ProjectionField[] {
    return [
      'name',
      'address',
      'hours',
      'phone',
      'website',
      'primaryCategory',
      'secondaryCategories',
      'originCountry',
      'originRegion',
      'neighborhood',
    ];
  }

  private norm(s: string | null | undefined): string {
    return (s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  }

  private normAddr(s: string | null | undefined): string {
    return (s ?? '')
      .toLowerCase()
      .replace(/\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|ct|court|pl|place)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  /** Latest non-stub business_analysis audit for a campaign (null when none). */
  private async getLatestBusinessAnalysisAudit(campaignId: string): Promise<any | null> {
    const auditRows = await (prisma as any).mkt_audits_list.findMany({
      where: { campaign_id: campaignId, platform: 'business_analysis' },
      orderBy: { created_at: 'desc' },
      take: 10,
    }).catch(() => null);
    return (Array.isArray(auditRows) ? auditRows : []).find(
      (a: any) => !isStubBusinessAnalysisAudit(a),
    ) ?? null;
  }

  /**
   * Canonical campaign NAP from a sync/diff query row — the same resolution
   * contract createFromCampaign uses (lib/canonical-nap). No market-scope
   * fallback: a guessed city must never land on the public listing.
   */
  private resolveNap(r: any, auditData: any): ResolvedNap {
    return resolveCampaignNap(
      {
        business_name: r.camp_business_name,
        phone: r.camp_phone,
        website_url: r.camp_website,
        address_line1: r.camp_address_line1,
        address_line2: r.camp_address_line2,
        address_city: r.camp_city,
        address_state: r.camp_state,
        address_zip: r.camp_address_zip,
      },
      auditData,
    );
  }

  /** Canonical JSON for change detection — key order + missing days ignored. */
  private canonicalHoursJson(hours: any): string | null {
    if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return null;
    const canon: Record<string, any> = {};
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
      const h = hours[day];
      if (!h || typeof h !== 'object') continue;
      canon[day] = { open: h.open ?? null, close: h.close ?? null, closed: !!h.closed };
    }
    if (hours.timezone) canon.timezone = String(hours.timezone);
    return Object.keys(canon).length > 0 ? JSON.stringify(canon) : null;
  }

  /** Compact operator-facing summary — "Mon 09:00–17:00 · Sun closed". */
  private summarizeHours(hours: any): string | null {
    if (!hours || typeof hours !== 'object' || Array.isArray(hours)) return null;
    const parts: string[] = [];
    for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']) {
      const h = hours[day];
      if (!h || typeof h !== 'object') continue;
      const label = day[0].toUpperCase() + day.slice(1, 3);
      if (h.closed) parts.push(`${label} closed`);
      else if (h.open && h.close) parts.push(`${label} ${h.open}–${h.close}`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
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
