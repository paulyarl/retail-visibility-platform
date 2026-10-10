/**
 * project-phase-resolution — read-time I/O for the project plan.
 *
 * Everything `selectProjectPhases` needs resolved from the database lives
 * here so the evaluator stays pure (spec §12 note). All reads only — this
 * module MUST NOT:
 *   - create/update campaigns, seeds, audits, or plan rows
 *   - mint claim tokens or backfill short codes
 *   - invoke claim-kit resolvers (`getClaimInviteKitMeta`,
 *     `resolveClaimInviteKit`, `ensureClaimShortCode`) — they lazily write
 *   - advance pipeline stages or persist phase status
 *
 * The one permitted write-ish call is `refreshSeedFidelityIfStale`, the
 * spec-D5 lazy fidelity refresh on the wedge seed (a stored verdict whose
 * staleness is resolved on read — not a pipeline mutation).
 *
 * Spec: docs/LocalBiz/marketing_ops_project_phase_spec.md §5/§8/§12
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import type { RequestCtx } from '../../context';
import { isStubBusinessAnalysisAudit } from '../../lib/marketing-audits';
import { extractSignals } from './signal-extractor';
import { isKnownSignalCode, type SignalCode } from './signal-taxonomy';
import type { DetectedSignal } from './types';
import { refreshSeedFidelityIfStale } from '../seed-fidelity';
import {
  PROJECT_PHASE_PREDICATES_VERSION,
  PROJECT_PHASE_PREDICATES_V1,
  type ProjectPhasePredicateSeed,
} from '../../lib/project-phase-predicates';
import { selectProjectPhases } from '../outreach-openers/project-phases';
import { extractPhaseEvidence } from '../outreach-openers/project-phase-evidence';
import { resolvePhaseCopy } from '../outreach-openers/project-phase-prompts';
import type {
  PlanLane,
  SignalLane,
  SeedFidelity,
  SeedStatus,
  ProjectPhaseInput,
  ProjectPhasePlan,
} from '../outreach-openers/project-phases';

// ─── Signal-code guards ──────────────────────────────────────────────────

/** OX_* outreach-state signals never feed phase selection (spec §12). */
function isOutreachSignal(code: string): boolean {
  return code.startsWith('OX_');
}

function toCanonicalSignals(raw: unknown): SignalCode[] {
  if (!Array.isArray(raw)) return [];
  const out: SignalCode[] = [];
  for (const item of raw) {
    const code = typeof item === 'string' ? item : (item as any)?.code;
    if (typeof code !== 'string') continue;
    if (!isKnownSignalCode(code) || isOutreachSignal(code)) continue;
    if (!out.includes(code as SignalCode)) out.push(code as SignalCode);
  }
  return out;
}

/** Operator-entered BBB codes — always full-lane provenance (spec §12). */
const OPERATOR_INPUT_PREFIXES = ['RA_BBB_', 'RA_UNANSWERED_COMPLAINTS'];
function isOperatorInputCode(code: string): boolean {
  return OPERATOR_INPUT_PREFIXES.some((p) => code.startsWith(p));
}

// ─── Sibling resolution ──────────────────────────────────────────────────

export interface ResolvedSibling {
  campaignId: string;
  isPrimary: boolean;
  playbookCode: string | null;
  archetype: string | null;
  stage: string;
  detectedSignals: SignalCode[];
}

export interface ResolvedProspectBundle {
  businessProspectId: string | null;
  primaryCampaignId: string;
  engagementCycle: number;
  estimatedTier: string | null;
  napConsistent: boolean | null;
  gbpClaimed: boolean | null;
  demoTenantId: string | null;
  /** Primary campaign facts — evidence + copy interpolation. */
  businessName: string | null;
  websiteUrl: string | null;
  unaddressedReviews: number | null;
  siblings: ResolvedSibling[];
}

/**
 * Resolve the sibling set for a campaign (self when no prospect id), with
 * each sibling's accepted playbook + archetype + stage + persisted
 * triage-signal snapshot. Read-only.
 */
export async function resolvePlanSiblings(
  campaignId: string,
  _ctx?: RequestCtx,
): Promise<ResolvedProspectBundle | null> {
  const campaign = await prisma.mkt_campaigns_list.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      business_prospect_id: true,
      is_primary_sibling: true,
      stage: true,
      engagement_cycle: true,
      estimated_tier: true,
      nap_consistent: true,
      gbp_claimed: true,
      demo_tenant_id: true,
      playbook_code: true,
      unaddressed_reviews: true,
      last_review_date: true,
      has_website: true,
      website_url: true,
      business_name: true,
    },
  });
  if (!campaign) return null;

  const prospectId = campaign.business_prospect_id ?? null;
  const siblingRows = prospectId
    ? await prisma.mkt_campaigns_list.findMany({
        where: { business_prospect_id: prospectId },
        select: {
          id: true,
          is_primary_sibling: true,
          stage: true,
          playbook_code: true,
        },
        orderBy: { created_at: 'asc' },
      })
    : [
        {
          id: campaign.id,
          is_primary_sibling: campaign.is_primary_sibling,
          stage: campaign.stage,
          playbook_code: campaign.playbook_code,
        },
      ];

  const ids = siblingRows.map((s) => s.id);

  // Latest triage verdict per sibling — accepted playbook is the operator-
  // overridden one when present (spec §5 attribution pool).
  const triageRows = await prisma.mkt_campaign_triage_results.findMany({
    where: { campaign_id: { in: ids } },
    select: {
      campaign_id: true,
      recommended_playbook_id: true,
      overridden_playbook_id: true,
      detected_signals: true,
    },
  });
  const triageByCampaign = new Map(triageRows.map((t) => [t.campaign_id, t]));

  const playbookIds = triageRows
    .map((t) => t.overridden_playbook_id ?? t.recommended_playbook_id)
    .filter((id): id is string => !!id);
  const playbookRows = playbookIds.length
    ? await prisma.mkt_playbook_catalog.findMany({
        where: { id: { in: playbookIds } },
        select: { id: true, code: true, archetype: true },
      })
    : [];
  const playbookById = new Map(playbookRows.map((p) => [p.id, p]));

  const primary =
    siblingRows.find((s) => s.is_primary_sibling === true) ?? siblingRows[0];

  const siblings: ResolvedSibling[] = siblingRows.map((s) => {
    const triage = triageByCampaign.get(s.id);
    const acceptedId = triage?.overridden_playbook_id ?? triage?.recommended_playbook_id;
    const playbook = acceptedId ? playbookById.get(acceptedId) : undefined;
    return {
      campaignId: s.id,
      isPrimary: s.id === primary.id,
      playbookCode: playbook?.code ?? s.playbook_code ?? null,
      archetype: playbook?.archetype ?? null,
      stage: s.stage ?? 'seed',
      detectedSignals: toCanonicalSignals(triage?.detected_signals),
    };
  });

  return {
    businessProspectId: prospectId,
    primaryCampaignId: primary.id,
    engagementCycle: campaign.engagement_cycle ?? 1,
    estimatedTier: campaign.estimated_tier,
    napConsistent: campaign.nap_consistent,
    gbpClaimed: campaign.gbp_claimed,
    demoTenantId: campaign.demo_tenant_id,
    businessName: (campaign as any).business_name ?? null,
    websiteUrl: campaign.website_url,
    unaddressedReviews: campaign.unaddressed_reviews,
    siblings,
  };
}

// ─── Signal resolution (spec §12 / sprint 4.2) ───────────────────────────

export interface ResolvedSignals {
  signals: SignalCode[];
  signalLanes: Partial<Record<SignalCode, SignalLane>>;
  lane: PlanLane;
  sourceAuditId: string | null;
  discoverySignals: string[];
  /** The real-audit JSON when lane === 'full' (evaluator exit predicates +
   *  severity need it); stub audit JSON in partial lane; null otherwise. */
  audit: any | null;
}

/**
 * resolveProspectSignals — the canonical signal set for the plan.
 *
 * Lane rules (spec §12):
 *   full    — the primary sibling's latest REAL business_analysis audit,
 *             re-extracted through extractSignals (model-emitted
 *             detected_signals are authoritative when present).
 *   partial — no real audit; the latest stub audit's detected_signals,
 *             plus extractSignals tier derivation, all tagged 'partial'.
 *   snapshot — neither lane has audit data; fall back to the persisted
 *             mkt_campaign_triage_results.detected_signals, lane inherited
 *             from the audit that produced them.
 *   none    — nothing to evaluate.
 *
 * RA_BBB_* / operator-entered codes from persisted triage results are
 * unioned in every lane and always carry 'full' provenance.
 */
export async function resolveProspectSignals(
  bundle: ResolvedProspectBundle,
  ctx?: RequestCtx,
): Promise<ResolvedSignals> {
  const siblingIds = bundle.siblings.map((s) => s.campaignId);

  const audits = await prisma.mkt_audits_list.findMany({
    where: { campaign_id: { in: siblingIds }, platform: 'business_analysis' },
    select: { id: true, campaign_id: true, audit_data: true, created_at: true },
    orderBy: { created_at: 'desc' },
    take: 10,
  });
  const realAudit = audits.find((a) => !isStubBusinessAnalysisAudit(a)) ?? null;
  const stubAudit = audits.find((a) => isStubBusinessAnalysisAudit(a)) ?? null;
  const realAuditData = realAudit?.audit_data as any;
  const stubAuditData = stubAudit?.audit_data as any;

  const primaryCampaign = await prisma.mkt_campaigns_list.findUnique({
    where: { id: bundle.primaryCampaignId },
    select: {
      nap_consistent: true,
      gbp_claimed: true,
      unaddressed_reviews: true,
      last_review_date: true,
      has_website: true,
      website_url: true,
    },
  });

  let signals: SignalCode[] = [];
  let signalLanes: Partial<Record<SignalCode, SignalLane>> = {};
  let lane: PlanLane = 'none';
  let sourceAuditId: string | null = null;
  let discoverySignals: string[] = [];
  let audit: any | null = null;

  if (realAudit) {
    lane = 'full';
    sourceAuditId = realAudit.id;
    audit = realAuditData;
    signals = toCanonicalSignals(
      extractSignals({
        campaign: {
          last_review_date: primaryCampaign?.last_review_date,
          unaddressed_reviews: primaryCampaign?.unaddressed_reviews ?? 0,
          nap_consistent: primaryCampaign?.nap_consistent,
          has_website: primaryCampaign?.has_website,
          website_url: primaryCampaign?.website_url,
          gbp_claimed: primaryCampaign?.gbp_claimed,
        },
        auditData: realAuditData,
      }),
    );
    for (const code of signals) signalLanes[code] = 'full';
    discoverySignals = intCodesFromDiscoveryMap(realAuditData?.discovery_signal_map);
  } else if (stubAudit) {
    lane = 'partial';
    sourceAuditId = stubAudit.id;
    audit = stubAuditData;
    const stubSignals = toCanonicalSignals(stubAuditData?.detected_signals);
    // extractSignals derives tier-related codes where the stub carries
    // cat-id digital_footprint data (spec §12) — same partial provenance.
    const derived = toCanonicalSignals(
      extractSignals({
        campaign: {
          last_review_date: primaryCampaign?.last_review_date,
          unaddressed_reviews: primaryCampaign?.unaddressed_reviews ?? 0,
          nap_consistent: primaryCampaign?.nap_consistent,
          has_website: primaryCampaign?.has_website,
          website_url: primaryCampaign?.website_url,
          gbp_claimed: primaryCampaign?.gbp_claimed,
        },
        auditData: stubAuditData,
      }),
    );
    signals = [...new Set([...stubSignals, ...derived])];
    for (const code of signals) signalLanes[code] = 'partial';
    discoverySignals = intCodesFromDiscoveryMap(stubAuditData?.discovery_signal_map);
  } else {
    // Persisted snapshot fallback — lane inherited from the producing audit.
    const triage = await prisma.mkt_campaign_triage_results.findFirst({
      where: { campaign_id: bundle.primaryCampaignId },
      select: { detected_signals: true, source_audit_id: true },
    });
    if (triage) {
      const persisted = toCanonicalSignals(triage.detected_signals);
      if (persisted.length > 0) {
        signals = persisted;
        sourceAuditId = triage.source_audit_id;
        const producingAudit = triage.source_audit_id
          ? await prisma.mkt_audits_list.findUnique({
              where: { id: triage.source_audit_id },
              select: { platform: true, audit_data: true },
            })
          : null;
        lane = producingAudit && isStubBusinessAnalysisAudit(producingAudit) ? 'partial' : 'full';
        for (const code of signals) signalLanes[code] = lane === 'partial' ? 'partial' : 'full';
      }
    }
  }

  // Operator-input union — BBB codes from every sibling's persisted triage
  // snapshot; always 'full' provenance (spec §12).
  const triageRows = await prisma.mkt_campaign_triage_results.findMany({
    where: { campaign_id: { in: siblingIds } },
    select: { detected_signals: true },
  });
  for (const row of triageRows) {
    for (const sig of (row.detected_signals as unknown as DetectedSignal[]) ?? []) {
      const code = sig?.code;
      if (typeof code !== 'string' || !isOperatorInputCode(code)) continue;
      if (!isKnownSignalCode(code) || isOutreachSignal(code)) continue;
      if (!signals.includes(code as SignalCode)) signals.push(code as SignalCode);
      signalLanes[code as SignalCode] = 'full';
    }
  }

  if (signals.length === 0 && lane !== 'none' && !realAudit && !stubAudit) {
    lane = 'none';
  }

  void ctx;
  return { signals, signalLanes, lane, sourceAuditId, discoverySignals, audit };
}

/** INT_* codes recorded on a stub audit's discovery_signal_map (via='int_signal'). */
function intCodesFromDiscoveryMap(map: unknown): string[] {
  if (!Array.isArray(map)) return [];
  const out = new Set<string>();
  for (const entry of map) {
    if (entry?.via === 'int_signal' && typeof entry?.ref === 'string') out.add(entry.ref);
  }
  return [...out];
}

// ─── Predicate + playbook-pool loaders ───────────────────────────────────

/**
 * Predicate rows at a version. Falls back to the compiled v1 constant when
 * the requested version is the seed version and no rows exist yet (the
 * constant IS the seed data — byte-identical trigger sets).
 */
export async function loadPredicates(
  predicateSeedVersion: number,
): Promise<readonly ProjectPhasePredicateSeed[]> {
  const rows = await prisma.$queryRaw<
    {
      phase_key: string;
      signals: unknown;
      min_severity: unknown;
      int_rank_modifiers: unknown;
      copy_keys: unknown;
    }[]
  >`
    SELECT phase_key, signals, min_severity, int_rank_modifiers, copy_keys
    FROM mkt_project_phase_predicates
    WHERE predicate_version = ${predicateSeedVersion}
  `;
  if (rows.length === 0) {
    return predicateSeedVersion === PROJECT_PHASE_PREDICATES_VERSION
      ? PROJECT_PHASE_PREDICATES_V1
      : [];
  }
  return rows.map((r) => ({
    phaseKey: r.phase_key as ProjectPhasePredicateSeed['phaseKey'],
    signals: (r.signals as string[]) ?? [],
    minSeverity: (r.min_severity as Record<string, string> | null) ?? null,
    intRankModifiers: (r.int_rank_modifiers as string[]) ?? [],
    copyKeys: (r.copy_keys as ProjectPhasePredicateSeed['copyKeys']) ?? {},
  }));
}

/**
 * Playbook signal pools for sibling attribution (spec §5):
 * playbookCode → union of matching_rules any/all/dual codes (`none` is a
 * veto clause — never evidence for a phase).
 */
export async function loadPlaybookSignalPools(
  playbookCodes: string[],
): Promise<Record<string, SignalCode[]>> {
  if (playbookCodes.length === 0) return {};
  const rows = await prisma.mkt_playbook_catalog.findMany({
    where: { code: { in: playbookCodes } },
    select: { code: true, matching_rules: true },
  });
  const pools: Record<string, SignalCode[]> = {};
  for (const row of rows) {
    const mr = (row.matching_rules ?? {}) as any;
    const codes = new Set<SignalCode>();
    for (const list of [mr.any, mr.all]) {
      if (Array.isArray(list)) {
        for (const c of list) if (isKnownSignalCode(c)) codes.add(c);
      }
    }
    for (const group of [mr.dual?.groupA, mr.dual?.groupB]) {
      if (Array.isArray(group)) {
        for (const c of group) if (isKnownSignalCode(c)) codes.add(c);
      }
    }
    pools[row.code] = [...codes];
  }
  return pools;
}

// ─── Seed-claim resolution (spec §4.4 — READ-ONLY) ───────────────────────

export interface ResolvedSeedClaim {
  seedId: string;
  status: SeedStatus;
  placeUrl: string | null;
  claimUrl: string | null;
  fidelity: SeedFidelity;
  tenantId: string;
}

/**
 * The primary sibling's live seed — via campaign↔seed links, suppressed
 * seeds ignored. Claim URL resolves in the READ-ONLY order (spec 4.4):
 * existing /c/{short_code} → active claim token → placeUrl. Never mints
 * tokens, never backfills short codes, never invokes kit resolvers.
 *
 * A misaligned seed never exposes a claim URL (Phase 2 CTA predicate).
 */
export async function resolvePlanSeedClaim(
  primaryCampaignId: string,
  ctx?: RequestCtx,
): Promise<ResolvedSeedClaim | null> {
  const rows = await prisma.$queryRaw<
    {
      seed_id: string;
      status: string;
      tenant_id: string;
      slug: string | null;
      short_code: string | null;
      seed_fidelity: string;
      seed_fidelity_audit_id: string | null;
      claim_token: string | null;
    }[]
  >`
    SELECT
      dps.id            AS seed_id,
      dps.status,
      dps.tenant_id,
      dl.slug,
      dps.short_code,
      dps.seed_fidelity,
      dps.seed_fidelity_audit_id,
      (
        SELECT dct.token
        FROM directory_claim_tokens dct
        WHERE dct.seed_id = dps.id
          AND dct.used_at IS NULL
          AND (dct.expires_at IS NULL OR dct.expires_at > now())
        ORDER BY dct.created_at DESC
        LIMIT 1
      ) AS claim_token
    FROM directory_seed_campaign_links dscl
    JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE dscl.campaign_id = ${primaryCampaignId}
      AND dps.status IS DISTINCT FROM 'suppressed'
    ORDER BY
      CASE dps.status
        WHEN 'claimed'   THEN 0
        WHEN 'invited'   THEN 1
        WHEN 'published' THEN 2
        ELSE 3
      END,
      dps.created_at DESC
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;

  // D5 lazy refresh — the stored verdict refreshes when the source audit
  // is newer. Bounded read + conditional write of the verdict row only.
  try {
    await refreshSeedFidelityIfStale(row.seed_id);
  } catch (error) {
    logger.warn('Seed fidelity lazy refresh failed (plan read continues)', ctx, {
      error: (error as Error).message,
      seedId: row.seed_id,
    });
  }
  const fidelityRow = await prisma.directory_presence_seeds.findUnique({
    where: { id: row.seed_id },
    select: { seed_fidelity: true },
  });
  const fidelity = (fidelityRow?.seed_fidelity ?? row.seed_fidelity ?? 'unknown') as SeedFidelity;

  const placeUrl = row.slug ? `/place/${row.slug}` : null;
  let claimUrl: string | null = null;
  if (fidelity !== 'misaligned') {
    if (row.short_code) {
      claimUrl = `/c/${row.short_code}`;
    } else if (row.claim_token) {
      claimUrl = `/claim/${row.claim_token}`;
    }
  }

  return {
    seedId: row.seed_id,
    status: row.status as SeedStatus,
    placeUrl,
    claimUrl,
    fidelity,
    tenantId: row.tenant_id,
  };
}

// ─── Capability resolution (spec §7) ─────────────────────────────────────

export interface PlanCapabilities {
  storefrontEnabled: boolean;
  subdomainEnabled: boolean;
  qrPrintEnabled: boolean;
  domainEnabled: boolean;
}

/**
 * Anchor-tenant order (spec 4.6): wedge seed's tenant → primary campaign's
 * demo tenant → platform defaults. Storefront/subdomain/QR are
 * platform-provided at the platform level; domainEnabled is hardcoded
 * false in v1 (custom domains are the unbuilt Vercel-Domains-API surface).
 */
export async function resolvePlanCapabilities(args: {
  wedgeTenantId?: string | null;
  demoTenantId?: string | null;
}): Promise<PlanCapabilities> {
  const anchorTenantId = args.wedgeTenantId ?? args.demoTenantId ?? null;
  if (!anchorTenantId) {
    return {
      storefrontEnabled: true,
      subdomainEnabled: true,
      qrPrintEnabled: true,
      domainEnabled: false,
    };
  }

  const tenant = await prisma.tenants.findUnique({
    where: { id: anchorTenantId },
    select: { subdomain: true },
  });
  // A healthy assigned platform subdomain — `subdomain` mirrors `slug` and
  // is opt-in (AGENTS.md 2026-10-10). NULL → capability off.
  const subdomainEnabled = tenant?.subdomain != null && tenant.subdomain.length > 0;

  const capRows = await prisma.$queryRaw<{ feature_key: string }[]>`
    SELECT feature_key
    FROM mv_tenant_effective_capabilities
    WHERE tenant_id = ${anchorTenantId}
      AND (feature_key LIKE 'storefront%' OR feature_key LIKE 'product_opt_qr%')
  `;
  const keys = new Set(capRows.map((r) => r.feature_key));
  const storefrontEnabled = [...keys].some((k) => k.startsWith('storefront_'));
  const qrPrintEnabled =
    keys.has('storefront_opt_qr_enabled') ||
    keys.has('storefront_qr_enabled') ||
    keys.has('product_opt_qr_codes') ||
    [...keys].some((k) => k.startsWith('storefront_opt_qr'));

  return {
    storefrontEnabled,
    subdomainEnabled,
    qrPrintEnabled,
    domainEnabled: false,
  };
}

// ─── Public surfaces (plan contract, internal view) ──────────────────────

/**
 * Public-surface strip — every linked seed per sibling plus demo
 * storefronts. Internal cockpit links; the owner projection keeps only
 * the verified ones.
 */
export async function resolvePlanPublicSurfaces(
  bundle: ResolvedProspectBundle,
): Promise<ProjectPhasePlan['publicSurfaces']> {
  const campaignIds = bundle.siblings.map((s) => s.campaignId);
  // All linked seeds — live AND suppressed. Suppressed rows surface in the
  // cockpit as retired history (the audit trail); only non-suppressed seeds
  // count as live public surfaces.
  const seeds = await prisma.$queryRaw<
    {
      campaign_id: string;
      seed_id: string;
      status: string;
      slug: string | null;
      seed_fidelity: string;
    }[]
  >`
    SELECT
      dscl.campaign_id,
      dps.id            AS seed_id,
      dps.status,
      dl.slug,
      dps.seed_fidelity
    FROM directory_seed_campaign_links dscl
    JOIN directory_presence_seeds dps ON dps.id = dscl.seed_id
    JOIN directory_listings_list dl ON dl.id = dps.listing_id
    WHERE dscl.campaign_id = ANY(${campaignIds})
  `;
  const liveSeedByCampaign = new Map<string, (typeof seeds)[number]>();
  const retiredByCampaign = new Map<string, (typeof seeds)[number][]>();
  for (const r of seeds) {
    if (r.status === 'suppressed') {
      retiredByCampaign.set(r.campaign_id, [...(retiredByCampaign.get(r.campaign_id) ?? []), r]);
    } else if (!liveSeedByCampaign.has(r.campaign_id)) {
      liveSeedByCampaign.set(r.campaign_id, r);
    }
  }
  const demoRows = await prisma.mkt_campaigns_list.findMany({
    where: { id: { in: campaignIds } },
    select: { id: true, demo_tenant_id: true },
  });
  const demoTenantIds = demoRows.map((r) => r.demo_tenant_id).filter((x): x is string => !!x);
  // Demo storefront URL — the wildcard subdomain form `{slug}.visibleshelf.com`
  // (subdomain mirrors slug); /tenant/{id} fallback when no slug yet.
  const demoSlugs = new Map<string, string | null>();
  if (demoTenantIds.length > 0) {
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: demoTenantIds } },
      select: { id: true, slug: true },
    });
    for (const t of tenants) demoSlugs.set(t.id, t.slug);
  }
  const demoTenantIdByCampaign = new Map(demoRows.map((r) => [r.id, r.demo_tenant_id]));

  return bundle.siblings.map((s) => {
    const seed = liveSeedByCampaign.get(s.campaignId);
    const demoTenantId = demoTenantIdByCampaign.get(s.campaignId) ?? null;
    const demoSlug = demoTenantId ? demoSlugs.get(demoTenantId) : null;
    return {
      campaignId: s.campaignId,
      seed: seed
        ? {
            seedId: seed.seed_id,
            status: seed.status as SeedStatus,
            placeUrl: seed.slug ? `/place/${seed.slug}` : '',
            fidelity: (seed.seed_fidelity ?? 'unknown') as SeedFidelity,
          }
        : null,
      retiredSeeds: (retiredByCampaign.get(s.campaignId) ?? []).map((r) => ({
        seedId: r.seed_id,
        status: r.status as SeedStatus,
        placeUrl: r.slug ? `/place/${r.slug}` : '',
      })),
      demoStorefrontUrl: demoTenantId
        ? demoSlug
          ? `https://${demoSlug}.visibleshelf.com`
          : `/tenant/${demoTenantId}`
        : null,
    };
  });
}

// ─── Composer ────────────────────────────────────────────────────────────

/**
 * buildProjectPhasePlan — the full read-time projection (spec §12).
 * One call for the Phase 6 endpoint: resolves siblings, signals, predicates,
 * playbook pools, the wedge seed + capabilities, evaluates, and attaches
 * seedClaim + publicSurfaces. Entirely read-only — no plan row is persisted,
 * no pipeline advances, nothing is created.
 */
export async function buildProjectPhasePlan(
  campaignId: string,
  ctx?: RequestCtx,
): Promise<ProjectPhasePlan | null> {
  const bundle = await resolvePlanSiblings(campaignId, ctx);
  if (!bundle) return null;

  const resolved = await resolveProspectSignals(bundle, ctx);
  const playbookCodes = [
    ...new Set(bundle.siblings.map((s) => s.playbookCode).filter((c): c is string => !!c)),
  ];
  const [predicates, pools, seedClaim] = await Promise.all([
    loadPredicates(PROJECT_PHASE_PREDICATES_VERSION),
    loadPlaybookSignalPools(playbookCodes),
    resolvePlanSeedClaim(bundle.primaryCampaignId, ctx),
  ]);
  const capabilities = await resolvePlanCapabilities({
    wedgeTenantId: seedClaim?.tenantId,
    demoTenantId: bundle.demoTenantId,
  });

  const plan = selectProjectPhases(
    {
      predicateSeedVersion: PROJECT_PHASE_PREDICATES_VERSION,
      lane: resolved.lane,
      signals: resolved.signals,
      signalLanes: resolved.signalLanes,
      discoverySignals: resolved.discoverySignals,
      sourceAuditId: resolved.sourceAuditId,
      audit: resolved.audit,
      siblings: bundle.siblings,
      capabilities,
      estimatedTier: bundle.estimatedTier as ProjectPhaseInput['estimatedTier'],
    },
    {
      predicates,
      playbookSignalPools: pools,
      facts: {
        napConsistent: bundle.napConsistent ?? undefined,
        gbpClaimed: bundle.gbpClaimed ?? undefined,
        wedgeSeedStatus: seedClaim?.status ?? null,
        demoStorefrontLive: bundle.demoTenantId != null,
      },
      businessProspectId: bundle.businessProspectId,
      engagementCycle: bundle.engagementCycle,
    },
  );

  // Phase 5 — evidence rows + owner-safe copy per phase. Attribution rides
  // the phase's first contributing sibling (the campaign that owns the
  // work); the primary campaign is the fallback.
  for (const p of plan.phases) {
    const evidenceCampaignId = p.contributingCampaignIds[0] ?? bundle.primaryCampaignId;
    const evidence = extractPhaseEvidence({
      phaseKey: p.key,
      triggerSignals: p.triggerSignals,
      audit: resolved.audit,
      campaignId: evidenceCampaignId,
      campaignFacts: {
        website_url: bundle.websiteUrl,
        unaddressed_reviews: bundle.unaddressedReviews,
      },
    });
    p.evidence = evidence;
    const copy = resolvePhaseCopy(p.key, { evidence, businessName: bundle.businessName });
    p.name = copy.name;
    p.goal = copy.goal;
    p.actions = copy.actions;
    p.exitCriterion.copy = copy.exitCopy;
  }

  plan.seedClaim = seedClaim
    ? {
        seedId: seedClaim.seedId,
        status: seedClaim.status,
        placeUrl: seedClaim.placeUrl,
        claimUrl: seedClaim.claimUrl,
        fidelity: seedClaim.fidelity,
      }
    : null;
  plan.publicSurfaces = await resolvePlanPublicSurfaces(bundle);
  return plan;
}

/**
 * An all-`not_triggered` plan for an unknown/empty prospect — the endpoint
 * returns 200 with this shape, never 404 (spec §13 plan lifecycle: the plan
 * owns nothing; an empty prospect is a legal state, not an error).
 */
export function emptyProjectPhasePlan(businessProspectId: string | null): ProjectPhasePlan {
  return selectProjectPhases(
    {
      predicateSeedVersion: PROJECT_PHASE_PREDICATES_VERSION,
      lane: 'none',
      signals: [],
      signalLanes: {},
      discoverySignals: [],
      sourceAuditId: null,
      audit: null,
      siblings: [],
      capabilities: {
        storefrontEnabled: true,
        subdomainEnabled: true,
        qrPrintEnabled: true,
        domainEnabled: false,
      },
      estimatedTier: null,
    },
    { businessProspectId },
  );
}

/**
 * Prospect-keyed entry for the plan endpoint. `:prospectId` may itself be a
 * campaign id (a null-prospect campaign is a singleton group — the campaign
 * is primary), and `?campaignId=` supplies that fallback explicitly.
 */
export async function buildProjectPhasePlanForKey(args: {
  prospectId?: string;
  campaignId?: string;
}, ctx?: RequestCtx): Promise<ProjectPhasePlan> {
  let campaignId = args.campaignId ?? null;
  let prospectId = args.prospectId ?? null;

  if (!campaignId && prospectId) {
    const primary = await prisma.mkt_campaigns_list.findFirst({
      where: { business_prospect_id: prospectId },
      orderBy: [{ is_primary_sibling: 'desc' }, { created_at: 'asc' }],
      select: { id: true },
    });
    if (primary) {
      campaignId = primary.id;
    } else {
      // Maybe the "prospect id" is a campaign with no prospect — singleton.
      const exists = await prisma.mkt_campaigns_list.findUnique({
        where: { id: prospectId },
        select: { id: true },
      });
      if (exists) campaignId = prospectId;
    }
  }

  if (!campaignId) return emptyProjectPhasePlan(prospectId);
  const plan = await buildProjectPhasePlan(campaignId, ctx);
  return plan ?? emptyProjectPhasePlan(prospectId);
}
