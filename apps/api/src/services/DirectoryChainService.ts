/**
 * DirectoryChainService — the chain entity behind the dedup prospecting
 * feed (Migration 359, docs/LocalBiz/CHAIN_PROSPECTING_FEED_SPEC.md).
 *
 * The dedup surface resolves duplicate groups to a binary verdict; a
 * third outcome — distinct entities that are one business — was being
 * thrown away. This service owns:
 *
 *   - computeChainSignals(members) — pure chain-candidacy scoring over
 *     an already-loaded phone-match group's member rows. Shared by the
 *     cleanup report (detection chips) and linkFromVerdict (server-side
 *     recompute — confidence is never client-supplied).
 *   - linkFromVerdict({seedIds}) — called after a 'distinct_chain'
 *     verdict lands: computes signals, then creates or extends a
 *     directory_chain_groups row (a third location found next month
 *     joins the existing chain, never a new group).
 *   - dismissForVerdict(seedIds) — a later same_entity/distinct verdict
 *     that covers a group's full membership dismisses it; the verdict
 *     row still protects the funnel gate.
 *   - listFeed() — the prospecting feed: groups + members + copy-ready
 *     pitch hooks generated from the stored signals.
 *
 * Chain tables are accessed via $queryRaw — they're created by Migration
 * 359 and land in the generated client on the next `prisma db pull`.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { generateDirectoryChainGroupId } from '../lib/id-generator';

export type ChainConfidence = 'chain_confirmed' | 'chain_probable';

export interface ChainMemberSignals {
  id: string;
  business_name: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  category: string | null;
  same_as: unknown;
  owner_email: string | null;
  owner_phone: string | null;
}

export interface ChainSignalResult {
  confidence: ChainConfidence;
  signals: string[];
  sharedPhone: string | null;
  nameTokenOverlap: string[];
  cities: string[];
}

/** Generic storefront words + entity suffixes — not brand tokens. */
const CHAIN_NAME_STOPWORDS = new Set([
  'the', 'store', 'market', 'super', 'shop', 'mart', 'llc', 'inc', 'co',
  'grocery', 'foods', 'food', 'of', 'and', 'center', 'centre', 'international',
]);

const digits = (v: string | null | undefined) =>
  v ? String(v).replace(/[^0-9]/g, '') : '';

const domainOf = (url: unknown): string | null => {
  if (typeof url !== 'string' || !url) return null;
  try {
    return new URL(url.includes('://') ? url : `https://${url}`)
      .hostname.replace(/^www\./, '').toLowerCase() || null;
  } catch {
    return null;
  }
};

/**
 * Score a phone-match group's chain candidacy. Pure — callers pass the
 * member rows they already loaded.
 */
export function computeChainSignals(members: ChainMemberSignals[]): ChainSignalResult | null {
  if (members.length < 2) return null;

  // same_phone — the group exists because of it, but verify anyway.
  const phones = new Set(members.map((m) => digits(m.phone)).filter((p) => p.length >= 7));
  const samePhone = phones.size === 1;

  // name_token_overlap — brand tokens that survive the stopword strip and
  // the members' own city names ("Plainfield" isn't a brand).
  const cityTokens = new Set(
    members.flatMap((m) => (m.city ? m.city.toLowerCase().split(/[^a-z0-9]+/) : [])),
  );
  const tokenize = (name: string | null) =>
    new Set(
      (name ?? '')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 1 && !CHAIN_NAME_STOPWORDS.has(t) && !cityTokens.has(t)),
    );
  const tokenSets = members.map((m) => tokenize(m.business_name));
  const nameTokenOverlap = [...tokenSets[0]].filter((t) => tokenSets.every((s) => s.has(t)));

  // same_as_overlap — shared profile domains are near-proof.
  const domainSets = members.map(
    (m) => new Set((Array.isArray(m.same_as) ? m.same_as : []).map(domainOf).filter(Boolean) as string[]),
  );
  const sameAsOverlap = domainSets[0].size
    ? [...domainSets[0]].filter((d) => domainSets.every((s) => s.has(d))).length
    : 0;

  // owner_contact_match — seed-captured owner email or phone identical.
  const ownerPhones = new Set(members.map((m) => digits(m.owner_phone)).filter((p) => p.length >= 7));
  const ownerEmails = new Set(
    members.map((m) => m.owner_email?.trim().toLowerCase()).filter(Boolean),
  );
  const ownerContactMatch =
    (ownerPhones.size === 1 && members.every((m) => digits(m.owner_phone).length >= 7)) ||
    (ownerEmails.size === 1 && members.every((m) => !!m.owner_email?.trim()));

  const sameCategory = members.every((m) => m.category && m.category === members[0].category);

  const signals: string[] = [];
  if (samePhone) signals.push('same_phone');
  if (nameTokenOverlap.length > 0) signals.push('name_token_overlap');
  if (sameAsOverlap > 0) signals.push('same_as_overlap');
  if (ownerContactMatch) signals.push('owner_contact_match');
  if (sameCategory) signals.push('same_category');

  let confidence: ChainConfidence | null = null;
  if (samePhone && (nameTokenOverlap.length > 0 || sameAsOverlap > 0 || ownerContactMatch)) {
    confidence = 'chain_confirmed';
  } else if (samePhone || (nameTokenOverlap.length > 0 && sameCategory)) {
    confidence = 'chain_probable';
  }
  if (!confidence) return null;

  const cities = [...new Set(members.map((m) => m.city).filter(Boolean))] as string[];
  return {
    confidence,
    signals,
    sharedPhone: samePhone ? [...phones][0] : null,
    nameTokenOverlap,
    cities,
  };
}

/** Signal set → copy-ready opener fragments (spec §7.1). */
function buildPitchHooks(
  signals: string[],
  sourceSignals: Record<string, unknown>,
  memberNames: string[],
  cities: string[],
): string[] {
  const hooks: string[] = [];
  if (signals.includes('same_phone')) {
    hooks.push('We can tell both stores are yours — same phone on every listing.');
  }
  if (signals.includes('name_token_overlap') && memberNames.length >= 2) {
    hooks.push(
      `${memberNames[0]} vs ${memberNames[1]} — Google can't tell they're one brand.`,
    );
  }
  if (cities.length > 1) {
    hooks.push(
      `${cities.slice(0, 2).join(' and ')} are different shelves — each store should be findable on its own.`,
    );
  }
  if (signals.includes('same_category')) {
    hooks.push('Every location shares the same specialty — one brand story, two shelves.');
  }
  if (signals.includes('same_as_overlap')) {
    hooks.push('Both listings already point at the same profiles — the brand exists, it just isn’t linked.');
  }
  hooks.push('Claim once. Manage both. One brand.');
  return hooks;
}

class DirectoryChainService {
  /**
   * Attach a verdict-approved group to the chain entity: compute signals
   * server-side, then extend the group any member already belongs to or
   * create a new one. Idempotent — member inserts are ON CONFLICT.
   */
  async linkFromVerdict(input: { seedIds: string[]; resolvedBy?: string | null }): Promise<{
    chainGroupId: string;
    confidence: ChainConfidence;
    memberCount: number;
    created: boolean;
  }> {
    const seedIds = [...new Set(input.seedIds)];
    const members = await prisma.$queryRaw<ChainMemberSignals[]>`
      SELECT dps.id, dl.business_name, COALESCE(dl.city, dps.city) AS city,
             COALESCE(dl.state, dps.state) AS state, dl.phone,
             dps.category, dl.same_as, dps.owner_email, dps.owner_phone
      FROM directory_presence_seeds dps
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      WHERE dps.id = ANY(${seedIds}::varchar[])
    `;
    const signals = computeChainSignals(members);
    if (!signals) {
      throw new Error('chain_signals_absent');
    }

    // Group continuity — any member already in a group means this verdict
    // extends that chain (third location joins, never a new group).
    const existing = await prisma.$queryRaw<{ chain_group_id: string }[]>`
      SELECT DISTINCT chain_group_id
      FROM directory_chain_group_members
      WHERE seed_id = ANY(${seedIds}::varchar[])
    `;
    const created = existing.length === 0;
    const chainGroupId = created ? generateDirectoryChainGroupId() : existing[0].chain_group_id;
    if (existing.length > 1) {
      logger.warn('DirectoryChainService.linkFromVerdict — members span multiple groups', undefined, {
        seedIds, groups: existing.map((e) => e.chain_group_id),
      });
    }

    const nameTokens = signals.nameTokenOverlap;
    const displayName = created && nameTokens.length > 0
      ? nameTokens.map((t) => t[0].toUpperCase() + t.slice(1)).join(' ')
      : null;

    await prisma.$transaction(async (tx) => {
      if (created) {
        await tx.$executeRaw`
          INSERT INTO directory_chain_groups
            (id, display_name, status, confidence, source_signals)
          VALUES (
            ${chainGroupId}, ${displayName}, 'candidate', ${signals.confidence},
            ${JSON.stringify({
              match_keys: ['phone'],
              signals: signals.signals,
              name_tokens: nameTokens,
              shared_phone: signals.sharedPhone,
              cities: signals.cities,
            })}::jsonb
          )
        `;
      }
      for (const m of members) {
        await tx.$executeRaw`
          INSERT INTO directory_chain_group_members
            (chain_group_id, seed_id, tenant_id, added_by)
          SELECT ${chainGroupId}, dps.id, dps.tenant_id, ${input.resolvedBy ?? null}
          FROM directory_presence_seeds dps
          WHERE dps.id = ${m.id}
          ON CONFLICT (chain_group_id, seed_id) DO NOTHING
        `;
      }
    });

    const memberCountRows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM directory_chain_group_members WHERE chain_group_id = ${chainGroupId}
    `;
    logger.info('DirectoryChainService.linkFromVerdict', undefined, {
      chainGroupId, seedIds, created, confidence: signals.confidence,
    });
    return {
      chainGroupId,
      confidence: signals.confidence,
      memberCount: memberCountRows[0]?.n ?? members.length,
      created,
    };
  }

  /**
   * A later non-chain verdict covering a group's full membership dismisses
   * the group (spec §4.3) — the chain read was wrong. Returns group ids.
   */
  async dismissForVerdict(seedIds: string[]): Promise<string[]> {
    const covered = await prisma.$queryRaw<{ chain_group_id: string }[]>`
      SELECT dcgm.chain_group_id
      FROM directory_chain_group_members dcgm
      GROUP BY dcgm.chain_group_id
      HAVING COUNT(*) FILTER (WHERE dcgm.seed_id = ANY(${seedIds}::varchar[])) = COUNT(*)
    `;
    if (covered.length === 0) return [];
    const ids = covered.map((c) => c.chain_group_id);
    await prisma.$executeRaw`
      UPDATE directory_chain_groups
      SET status = 'dismissed', updated_at = now()
      WHERE id = ANY(${ids}::varchar[]) AND status <> 'dismissed'
    `;
    return ids;
  }

  /**
   * Chain-group memberships for a set of seeds — the cleanup report calls
   * this once per run so group chips can show "already linked".
   */
  async membershipsForSeeds(seedIds: string[]): Promise<Map<string, string>> {
    if (seedIds.length === 0) return new Map();
    const rows = await prisma.$queryRaw<{ seed_id: string; chain_group_id: string }[]>`
      SELECT seed_id, chain_group_id
      FROM directory_chain_group_members
      WHERE seed_id = ANY(${seedIds}::varchar[])
    `;
    return new Map(rows.map((r) => [r.seed_id, r.chain_group_id]));
  }

  /** The prospecting feed — groups + members + pitch hooks (spec §5.2). */
  async listFeed(): Promise<any[]> {
    const groups = await prisma.$queryRaw<any[]>`
      SELECT id, display_name, status, confidence, source_signals, created_at, updated_at
      FROM directory_chain_groups
      ORDER BY
        CASE status WHEN 'candidate' THEN 0 WHEN 'confirmed' THEN 1
                    WHEN 'claimed' THEN 2 WHEN 'org_linked' THEN 3 ELSE 4 END,
        created_at DESC
    `;
    if (groups.length === 0) return [];

    const members = await prisma.$queryRaw<any[]>`
      SELECT dcgm.chain_group_id, dps.id AS seed_id, dps.status AS seed_status,
             dps.owner_email, dps.owner_phone,
             dl.business_name, dl.slug, dl.city, dl.state, dl.phone, dl.is_published,
             dl.listing_origin,
             EXISTS(
               SELECT 1 FROM directory_claim_tokens dct
               WHERE dct.seed_id = dps.id AND dct.consumed_at IS NULL AND dct.expires_at > now()
             ) AS has_active_claim_token
      FROM directory_chain_group_members dcgm
      JOIN directory_presence_seeds dps ON dps.id = dcgm.seed_id
      JOIN directory_listings_list dl ON dl.id = dps.listing_id
      ORDER BY dl.business_name
    `;

    const byGroup = new Map<string, any[]>();
    for (const m of members) {
      const list = byGroup.get(m.chain_group_id) ?? [];
      list.push(m);
      byGroup.set(m.chain_group_id, list);
    }

    const statusOrder: Record<string, number> = {
      draft: 0, published: 1, invited: 2, claimed: 3, suppressed: 4,
    };

    return groups.map((g) => {
      const ms = byGroup.get(g.id) ?? [];
      const live = ms.filter((m) => m.seed_status !== 'suppressed');
      const sourceSignals = (g.source_signals ?? {}) as Record<string, unknown>;
      const uniqueSignals = [...new Set((sourceSignals.signals as string[] | undefined) ?? [])];
      const cities = [...new Set(live.map((m) => m.city).filter(Boolean))] as string[];
      const names = live.map((m) => m.business_name).filter(Boolean) as string[];
      const contact = live.find((m) => m.owner_email || m.owner_phone) ?? null;

      return {
        chainGroupId: g.id,
        displayName: g.display_name ?? names[0] ?? g.id,
        status: g.status,
        confidence: g.confidence,
        sourceSignals,
        cities,
        contact: {
          phone: live.find((m) => m.phone)?.phone ?? null,
          ownerEmail: contact?.owner_email ?? null,
          ownerPhone: contact?.owner_phone ?? null,
        },
        members: live.map((m) => ({
          seedId: m.seed_id,
          businessName: m.business_name,
          slug: m.slug,
          city: m.city,
          state: m.state,
          status: m.seed_status,
          isPublished: !!m.is_published,
          listingOrigin: m.listing_origin,
          hasActiveClaimToken: !!m.has_active_claim_token,
        })),
        claimProgress: {
          total: ms.length,
          live: live.length,
          claimed: ms.filter((m) => m.seed_status === 'claimed').length,
          invited: ms.filter((m) => m.seed_status === 'invited' || m.has_active_claim_token).length,
        },
        pitchHooks: buildPitchHooks(uniqueSignals, sourceSignals, names, cities),
        createdAt: g.created_at ? new Date(g.created_at).toISOString() : null,
        // Feed sort hint for clients — most-workable lead state.
        memberStatusRank: Math.min(...ms.map((m) => statusOrder[m.seed_status] ?? 9)),
      };
    });
  }
}

export default new DirectoryChainService();
export { DirectoryChainService };
