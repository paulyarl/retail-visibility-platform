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
