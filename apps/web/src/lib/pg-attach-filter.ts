/**
 * Proving-ground attach picker — market matching.
 *
 * A proving ground is one market: (category ∪ secondary_categories) ×
 * (anchor city ∪ member_geos). The attach picker used to list every
 * unparented discovery campaign, so a Milwaukee scan was offered to the
 * Indianapolis PG (2026-10-28 batch-born discovery gap). Matching is done on
 * the PG's declared domain, not on the campaign list's own filters.
 *
 * Rules:
 *  - Category: must be in the domain when the domain declares categories and
 *    the campaign declares one. (A campaign with no category is legacy data and
 *    is not filtered out on that axis alone.)
 *  - Geo: a domain with no city is unconstrained (mixed PG) and accepts any
 *    city. Otherwise the campaign city must match a domain geo, and when both
 *    sides carry a state the states must agree. A campaign with no city is
 *    nationwide and does not belong to a city-scoped PG.
 */

export interface PgDomainLike {
  categories: string[];
  geos: Array<{ city: string | null; state: string | null }>;
}

export interface AttachableCampaignLike {
  title?: string | null;
  business_name?: string | null;
  category?: string | null;
  city?: string | null;
  state?: string | null;
  intelligence_focus?: string | null;
  created_at?: string | null;
}

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export function campaignMatchesPgDomain(
  campaign: AttachableCampaignLike | null | undefined,
  domain: PgDomainLike | null | undefined,
): boolean {
  const categories = (domain?.categories ?? []).map(norm).filter(Boolean);
  if (categories.length) {
    const category = norm(campaign?.category);
    if (category && !categories.includes(category)) return false;
  }

  const geos = (domain?.geos ?? []).filter((g) => norm(g?.city));
  if (geos.length === 0) return true; // unconstrained (mixed) PG

  const city = norm(campaign?.city);
  if (!city) return false; // nationwide run under a city-scoped PG
  const state = norm(campaign?.state);
  return geos.some(
    (g) => norm(g.city) === city && (!norm(g.state) || !state || norm(g.state) === state),
  );
}

/** Option label for the attach picker — distinguishes twin runs of one market. */
export function attachOptionLabel(campaign: AttachableCampaignLike): string {
  const base =
    campaign.title ||
    campaign.business_name ||
    `${campaign.category ?? 'Campaign'} · ${campaign.city ?? ''}`.trim();
  const suffix: string[] = [];
  if (campaign.city && !base.includes(campaign.city)) {
    suffix.push(`${campaign.city}${campaign.state ? `, ${campaign.state}` : ''}`);
  }
  if (campaign.intelligence_focus) suffix.push(campaign.intelligence_focus);
  const created = campaign.created_at ? new Date(campaign.created_at) : null;
  if (created && !Number.isNaN(created.getTime())) {
    suffix.push(
      `${String(created.getMonth() + 1).padStart(2, '0')}/${String(created.getDate()).padStart(2, '0')}`,
    );
  }
  return suffix.length > 0 ? `${base} · ${suffix.join(' · ')}` : base;
}
