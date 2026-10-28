/**
 * auditPublicNarrative — shared resolver for `audit_data.public_narrative`
 * and the audit rows behind it.
 *
 * Both the business_analysis and category_identification analysts emit a
 * public-safe narrative. Surfaces that emit a narrative treat the two as
 * mutual fallbacks; precedence depends on the surface:
 *
 *   - Cat surfaces (shelf cards via `directory_listings_list.description`)
 *     → category_identification PRIMARY, business_analysis fallback. The
 *     cat-id analyst is what filed the business onto those shelves, so its
 *     narrative is the canonical shelf copy.
 *   - Non-cat surfaces (place-page About, seed report) → business_analysis
 *     primary, category_identification fallback.
 *
 * Reachability: the cat-id audit often lives on a different campaign than
 * the seeded business campaign (the cat-id scan campaign). Both derive
 * lanes stamp `mkt_campaigns_list.parent_campaign_id` — the spawn lane
 * passes the source campaign directly (`deriveBusinessCampaign`), the queue
 * lane stamps it from the queue entry's `source_campaign_id`
 * (`createCampaignFromQueue`) — so a one-hop parent walk resolves it.
 */

export type NarrativeAuditPlatform = 'business_analysis' | 'category_identification';

export interface ResolvedAudit {
  id: string;
  auditData: unknown;
}

function readNarrative(auditData: unknown): string | null {
  const narrative = (auditData as { public_narrative?: unknown } | null)?.public_narrative;
  return typeof narrative === 'string' && narrative.trim().length > 0
    ? narrative.trim()
    : null;
}

/**
 * Latest audit row for a platform across a set of campaign ids
 * (typically [campaign, parentCampaign]). Returns null when absent.
 */
export async function resolveLatestAuditByPlatform(
  prisma: any,
  campaignIds: Array<string | null | undefined>,
  platform: NarrativeAuditPlatform,
): Promise<ResolvedAudit | null> {
  const ids = campaignIds.filter((id): id is string => Boolean(id));
  if (ids.length === 0) return null;
  const audit = await prisma.mkt_audits_list.findFirst({
    where: { campaign_id: { in: ids }, platform },
    orderBy: { created_at: 'desc' },
    select: { id: true, audit_data: true },
  });
  return audit ? { id: audit.id, auditData: audit.audit_data } : null;
}

async function resolveParentCampaignId(
  prisma: any,
  campaignId: string,
  parentCampaignId: string | null | undefined,
): Promise<string | null> {
  if (parentCampaignId !== undefined) return parentCampaignId;
  const campaign = await prisma.mkt_campaigns_list.findUnique({
    where: { id: campaignId },
    select: { parent_campaign_id: true },
  });
  return campaign?.parent_campaign_id ?? null;
}

/**
 * Latest category_identification audit row reachable from a campaign —
 * checks the campaign first, then its parent (cat-id audits stay on the
 * scan campaign that produced them). When `parentCampaignId` is omitted
 * the campaign row is loaded to resolve it.
 */
export async function resolveCatIdAudit(
  prisma: any,
  campaignId: string,
  parentCampaignId?: string | null,
): Promise<ResolvedAudit | null> {
  const parentId = await resolveParentCampaignId(prisma, campaignId, parentCampaignId);
  return resolveLatestAuditByPlatform(
    prisma,
    [campaignId, parentId],
    'category_identification',
  );
}

/**
 * Latest `audit_data.public_narrative` for a platform across a set of
 * campaign ids (typically [campaign, parentCampaign]). Returns null when
 * no audit carries one.
 */
export async function resolveAuditPublicNarrative(
  prisma: any,
  campaignIds: Array<string | null | undefined>,
  platform: NarrativeAuditPlatform,
): Promise<string | null> {
  const audit = await resolveLatestAuditByPlatform(prisma, campaignIds, platform);
  return readNarrative(audit?.auditData);
}

/**
 * Latest category_identification public narrative reachable from a
 * campaign — checks the campaign first, then its parent.
 */
export async function resolveCatIdPublicNarrative(
  prisma: any,
  campaignId: string,
  parentCampaignId?: string | null,
): Promise<string | null> {
  const audit = await resolveCatIdAudit(prisma, campaignId, parentCampaignId);
  return readNarrative(audit?.auditData);
}

// ─── Seed listing narrative (precedence for the public listing copy) ──────
//
// `directory_listings_list.description` is a CAT surface, so the order follows
// the cat-surface doctrine: category_identification first, then the business
// analysis, then the discovery scan (on the campaign, then its parent). The
// composer's NAP-derived boilerplate is the caller's fallback when this
// returns null — never a lane here.

export type SeedListingNarrativeSource =
  | 'category_identification'
  | 'business_analysis'
  | 'discovery_scan';

export interface SeedListingNarrative {
  narrative: string;
  source: SeedListingNarrativeSource;
}

/** public_narrative first (both analysts emit it), then the older narrative
 *  field names some audits still carry. */
function readAnyNarrative(auditData: unknown): string | null {
  const direct = readNarrative(auditData);
  if (direct) return direct;
  const d = (auditData ?? {}) as any;
  for (const key of ['summary', 'business_summary', 'description', 'narrative']) {
    const value = d?.[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

/**
 * Resolve the narrative a seed's public listing should carry, in precedence
 * order. Stub business analyses need no special case: they carry no narrative,
 * so the loop simply falls through to the next lane.
 */
export async function resolveSeedListingNarrative(
  prisma: any,
  opts: {
    campaignId: string | null;
    businessName: string;
    parentCampaignId?: string | null;
  },
): Promise<SeedListingNarrative | null> {
  const { campaignId, businessName } = opts;
  if (!campaignId) return null;

  let parentCampaignId = opts.parentCampaignId;
  if (parentCampaignId === undefined) {
    const campaign = await prisma.mkt_campaigns_list.findUnique({
      where: { id: campaignId },
      select: { parent_campaign_id: true },
    });
    parentCampaignId = campaign?.parent_campaign_id ?? null;
  }
  const campaignIds = [campaignId, parentCampaignId].filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );

  // 1. category_identification — top dog on a cat surface.
  const catId = await resolveLatestAuditByPlatform(
    prisma,
    campaignIds,
    'category_identification',
  );
  const catNarrative = readAnyNarrative(catId?.auditData);
  if (catNarrative) return { narrative: catNarrative, source: 'category_identification' };

  // 2. business_analysis on the linked campaign itself.
  const businessAudits = await prisma.mkt_audits_list.findMany({
    where: { campaign_id: campaignId, platform: 'business_analysis' },
    orderBy: { created_at: 'desc' },
    take: 10,
  });
  for (const audit of Array.isArray(businessAudits) ? businessAudits : []) {
    const narrative = readAnyNarrative((audit as any)?.audit_data);
    if (narrative) return { narrative, source: 'business_analysis' };
  }

  // 3 + 4. discovery scan on the campaign, then on its parent.
  const scans = await prisma.mkt_audits_list.findMany({
    where: { campaign_id: { in: campaignIds }, platform: 'intelligence_discovery' },
    orderBy: { created_at: 'desc' },
    take: 5,
  });
  const wanted = businessName.trim().toLowerCase();
  for (const scan of Array.isArray(scans) ? scans : []) {
    const list = (scan as any)?.audit_data?.discovered_businesses;
    if (!Array.isArray(list)) continue;
    const hit = list.find(
      (b: any) =>
        typeof b?.business_name === 'string' &&
        b.business_name.trim().toLowerCase() === wanted,
    );
    if (hit && typeof hit.description === 'string' && hit.description.trim()) {
      return { narrative: hit.description.trim(), source: 'discovery_scan' };
    }
  }

  return null;
}
