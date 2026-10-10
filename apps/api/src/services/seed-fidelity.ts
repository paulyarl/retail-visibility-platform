/**
 * seed-fidelity — the project-phase spec §4/§6 wedge verdict.
 *
 * The directory seed is the plan's engagement wedge, and the wedge is only
 * honest when the seed mirrors the prospect's real public footprint. One
 * persisted verdict per seed (`directory_presence_seeds.seed_fidelity`) is
 * consulted by every claim surface:
 *
 *   aligned    — every material field on the live listing matches the
 *                canonical footprint (or the owner attested the NAP).
 *   thin       — material fields match but the listing is sparse (missing
 *                products, photos, or hours). Still renderable; internally
 *                flagged as an enrichment gap.
 *   misaligned — a material field differs from canonical. Claim CTAs degrade
 *                to the inquiry path on every surface.
 *   unknown    — no canonical footprint to compare (no linked campaign with a
 *                usable business_analysis audit). Renderable — publish QC
 *                already gates the listing.
 *
 * Material-variance rule is shared with the A3/triage NAP fix
 * (services/outreach-openers/signal-magnitude): legal suffixes, address
 * abbreviations, and phone punctuation are cosmetic — never misalignment.
 *
 * Write sites (spec D5): publish time (authoritative for public surfaces) and
 * lazy refresh when the source audit is newer than the stored verdict.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { resolveCampaignNap, type ResolvedNap } from '../lib/canonical-nap';
import { isStubBusinessAnalysisAudit } from '../lib/marketing-audits';
import {
  normalizeAddress,
  normalizeName,
  normalizePhone,
} from './outreach-openers/signal-magnitude';

export type SeedFidelity = 'aligned' | 'thin' | 'misaligned' | 'unknown';

export const SEED_FIDELITIES: readonly SeedFidelity[] = [
  'aligned',
  'thin',
  'misaligned',
  'unknown',
];

export interface SeedFidelityListingSnapshot {
  business_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  product_count: number | null;
  business_hours: unknown;
}

export interface SeedFidelityInput {
  /** Canonical footprint resolved from the campaign + audit; null → unknown. */
  canonical: Pick<ResolvedNap, 'name' | 'address' | 'city' | 'state' | 'phone'> | null;
  listing: SeedFidelityListingSnapshot;
  photoCount: number;
  /**
   * Owner attested the filed NAP (nap_verified_at set at claim, or
   * nap_owner_corrected on a later edit). The listing NAP is authoritative —
   * the audit canonical is the stale record, not the seed.
   */
  napVerified: boolean;
}

const normCityState = (v: string): string => v.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Pure comparator — no I/O. Exported for tests and for surfaces that already
 * hold both sides of the comparison.
 */
export function evaluateSeedFidelity(input: SeedFidelityInput): SeedFidelity {
  const { canonical, listing } = input;
  if (!canonical || (!canonical.name && !canonical.address && !canonical.phone)) {
    return 'unknown';
  }

  if (!input.napVerified) {
    const nameMismatch =
      !!canonical.name &&
      !!listing.business_name &&
      normalizeName(canonical.name) !== normalizeName(listing.business_name);
    const addressMismatch =
      !!canonical.address &&
      !!listing.address &&
      normalizeAddress(canonical.address) !== normalizeAddress(listing.address);
    const phoneMismatch =
      !!canonical.phone &&
      !!listing.phone &&
      normalizePhone(canonical.phone) !== normalizePhone(listing.phone);
    const cityMismatch =
      !!canonical.city && !!listing.city && normCityState(canonical.city) !== normCityState(listing.city);
    const stateMismatch =
      !!canonical.state &&
      !!listing.state &&
      normCityState(canonical.state) !== normCityState(listing.state);

    if (nameMismatch || addressMismatch || phoneMismatch || cityMismatch || stateMismatch) {
      return 'misaligned';
    }
  }

  const sparse =
    (listing.product_count ?? 0) <= 0 || input.photoCount <= 0 || !listing.business_hours;
  return sparse ? 'thin' : 'aligned';
}

interface FidelityContext {
  listing: SeedFidelityListingSnapshot;
  photoCount: number;
  napVerified: boolean;
  canonical: SeedFidelityInput['canonical'];
  sourceAuditId: string | null;
}

/**
 * Load both sides of the comparison for a seed:
 *   - the live listing fields + photo/hours sparsity inputs
 *   - the canonical footprint: primary-linked campaign → latest non-stub
 *     business_analysis audit → resolveCampaignNap (campaign columns win,
 *     then audit canonical — same contract the seed gate used at creation)
 */
async function loadFidelityContext(seedId: string): Promise<FidelityContext | null> {
  const seedRows = await prisma.$queryRaw<any[]>`
    SELECT
      dps.id,
      dps.nap_verified_at,
      dps.nap_owner_corrected,
      dl.business_name,
      dl.address,
      dl.city,
      dl.state,
      dl.phone,
      dl.product_count,
      dl.business_hours
    FROM directory_presence_seeds dps
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE dps.id = ${seedId}
    LIMIT 1
  `;
  const seed = seedRows[0];
  if (!seed) return null;

  const photoRows = await prisma.$queryRaw<Array<{ n: bigint | number }>>`
    SELECT COUNT(*)::int AS n
    FROM directory_photos
    WHERE listing_id = (SELECT listing_id FROM directory_presence_seeds WHERE id = ${seedId})
  `;
  const photoCount = Number(photoRows[0]?.n ?? 0);

  const linkRows = await prisma.$queryRaw<any[]>`
    SELECT campaign_id
    FROM directory_seed_campaign_links
    WHERE seed_id = ${seedId} AND link_role = 'primary'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const campaignId = linkRows[0]?.campaign_id ?? null;

  let canonical: FidelityContext['canonical'] = null;
  let sourceAuditId: string | null = null;

  if (campaignId) {
    const campaign = await (prisma as any).mkt_campaigns_list.findUnique({
      where: { id: campaignId },
    });
    if (campaign) {
      const auditCandidates = await (prisma as any).mkt_audits_list.findMany({
        where: { campaign_id: campaignId, platform: 'business_analysis' },
        orderBy: { created_at: 'desc' },
        take: 10,
      });
      const audit = (Array.isArray(auditCandidates) ? auditCandidates : []).find(
        (a: any) => !isStubBusinessAnalysisAudit(a),
      );
      if (audit) {
        sourceAuditId = audit.id;
        const resolved = resolveCampaignNap(campaign, audit.audit_data as any);
        canonical = {
          name: resolved.name,
          address: resolved.address,
          city: resolved.city,
          state: resolved.state,
          phone: resolved.phone,
        };
      }
    }
  }

  return {
    listing: {
      business_name: seed.business_name,
      address: seed.address,
      city: seed.city,
      state: seed.state,
      phone: seed.phone,
      product_count: seed.product_count,
      business_hours: seed.business_hours,
    },
    photoCount,
    napVerified: Boolean(seed.nap_owner_corrected) || !!seed.nap_verified_at,
    canonical,
    sourceAuditId,
  };
}

/**
 * Compute the verdict for a seed and persist it. Returns the verdict;
 * returns null when the seed does not exist.
 */
export async function computeAndStoreSeedFidelity(seedId: string): Promise<SeedFidelity | null> {
  const ctx = await loadFidelityContext(seedId);
  if (!ctx) return null;

  const fidelity = evaluateSeedFidelity({
    canonical: ctx.canonical,
    listing: ctx.listing,
    photoCount: ctx.photoCount,
    napVerified: ctx.napVerified,
  });

  await prisma.$executeRaw`
    UPDATE directory_presence_seeds
    SET seed_fidelity = ${fidelity},
        seed_fidelity_audit_id = ${ctx.sourceAuditId},
        seed_fidelity_checked_at = now(),
        updated_at = now()
    WHERE id = ${seedId}
  `;
  return fidelity;
}

/**
 * Lazy refresh (spec D5): recompute only when the campaign's latest
 * business_analysis audit is newer than the one the stored verdict was
 * computed against. Public surfaces keep consulting the stored verdict.
 */
export async function refreshSeedFidelityIfStale(seedId: string): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<any[]>`
      SELECT seed_fidelity_audit_id FROM directory_presence_seeds WHERE id = ${seedId} LIMIT 1
    `;
    if (!rows[0]) return;
    const storedAuditId: string | null = rows[0].seed_fidelity_audit_id;

    const linkRows = await prisma.$queryRaw<any[]>`
      SELECT campaign_id FROM directory_seed_campaign_links
      WHERE seed_id = ${seedId} AND link_role = 'primary'
      ORDER BY created_at DESC LIMIT 1
    `;
    const campaignId = linkRows[0]?.campaign_id ?? null;
    if (!campaignId) {
      if (storedAuditId !== null) await computeAndStoreSeedFidelity(seedId);
      return;
    }
    const audits = await (prisma as any).mkt_audits_list.findMany({
      where: { campaign_id: campaignId, platform: 'business_analysis' },
      orderBy: { created_at: 'desc' },
      take: 10,
    });
    const latest = (Array.isArray(audits) ? audits : []).find(
      (a: any) => !isStubBusinessAnalysisAudit(a),
    );
    const latestAuditId: string | null = latest?.id ?? null;
    if (latestAuditId !== storedAuditId) {
      await computeAndStoreSeedFidelity(seedId);
    }
  } catch (err: any) {
    // Fidelity refresh is advisory — a read path must never fail because the
    // verdict could not be recomputed.
    logger.warn('seed-fidelity: lazy refresh failed', undefined, {
      seedId,
      error: err?.message,
    });
  }
}
