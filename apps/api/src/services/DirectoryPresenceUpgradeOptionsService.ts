/**
 * DirectoryPresenceUpgradeOptionsService — shared builder for tenant
 * upgrade-option payloads (V3.1 Entry Presence).
 *
 * Used by:
 *   - GET /api/tenant/:tenantId/upgrade/options  (directory-presence-upgrade.ts)
 *   - POST /api/public/directory/claim/:token/accept (DirectoryClaimService.acceptClaim)
 *
 * Extracted from the upgrade-options route so the claim accept response can
 * embed the gateway upgrade preview: the claimant authenticates with a
 * customer JWT and has no platform (Auth0) session, so the claim success
 * screen cannot call the authenticated upgrade-options endpoint itself
 * (docs/LocalBiz/directory_presence_claim_handoff_spec.md — Data source).
 */
import { prisma } from '../prisma';

/**
 * V3.1 Entry Presence mode metadata.
 * When a gateway tenant asks for upgrade options, these three peer modes
 * are returned with surface labels so the frontend can render a mode picker
 * instead of a linear tier ladder.
 */
const ENTRY_PRESENCE_MODES: Record<string, { mode: string; surface: string; tagline: string; primary: boolean }> = {
  presence:   { mode: 'directory', surface: 'Platform in-house directory',   tagline: 'Own your directory listing', primary: true  },
  discovery:  { mode: 'google',    surface: 'Third-party (Google)',          tagline: 'Get found on Google',       primary: false },
  storefront: { mode: 'platform',  surface: 'Platform in-house marketplace', tagline: 'Open your platform store',  primary: false },
};

export interface UpgradeTierOptionDto {
  tierKey: string;
  name: string;
  displayName: string;
  description: string | null;
  priceMonthly: number;
  priceAnnual: number;
  sortOrder: number;
  billingType: string;
  // V3.1 mode metadata (present for gateway upgrades only)
  mode?: string;
  surface?: string;
  tagline?: string;
  isPrimary: boolean;
  newFeatures: { featureKey: string; featureName: string }[];
}

export interface UpgradeOptionsPayload {
  currentTier: {
    tierKey: string;
    name: string;
    displayName: string;
    description: string | null;
    priceMonthly: number;
  } | null;
  // V3.1: when true, frontend renders a mode picker instead of a ladder
  isGatewayUpgrade: boolean;
  upgradeOptions: UpgradeTierOptionDto[];
}

/**
 * Build the upgrade-options payload for a tenant.
 *
 * Gateway tenants (directory_presence) get the Entry Presence triad
 * (presence / discovery / storefront) with mode metadata; everyone else
 * gets the flat sort_order ladder. Never throws — returns an empty
 * payload when the tenant or its tier row is missing.
 */
export async function buildTenantUpgradeOptions(tenantId: string): Promise<UpgradeOptionsPayload> {
  const empty: UpgradeOptionsPayload = { currentTier: null, isGatewayUpgrade: false, upgradeOptions: [] };

  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { subscription_tier: true },
  });
  const currentTierKey = tenant?.subscription_tier;
  if (!currentTierKey) return empty;

  const currentTier = await prisma.subscription_tiers_list.findUnique({
    where: { tier_key: currentTierKey },
    select: {
      id: true,
      tier_key: true,
      name: true,
      display_name: true,
      description: true,
      price_monthly: true,
      sort_order: true,
    },
  });
  if (!currentTier) return empty;

  const currentFeatures = await prisma.tier_features_list.findMany({
    where: { tier_id: currentTier.id, is_enabled: true },
    select: { feature_key: true },
  });
  const currentFeatureKeys = new Set(currentFeatures.map((f) => f.feature_key));

  // V3.1: Gateway special-case — when the current tier is directory_presence,
  // return the Entry Presence triad as peer visibility modes with mode
  // labels, not a flat sort_order ladder.
  const isGateway = currentTierKey === 'directory_presence';

  let upgradeTiers;
  if (isGateway) {
    // Gateway: return exactly the three Entry Presence modes
    upgradeTiers = await prisma.subscription_tiers_list.findMany({
      where: {
        is_active: true,
        tier_key: { in: ['presence', 'discovery', 'storefront'] },
      },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        tier_key: true,
        name: true,
        display_name: true,
        description: true,
        price_monthly: true,
        sort_order: true,
        billing_type: true,
      },
    });
  } else {
    // Non-gateway: return tiers with sort_order > current (flat ladder)
    upgradeTiers = await prisma.subscription_tiers_list.findMany({
      where: {
        is_active: true,
        sort_order: { gt: currentTier.sort_order },
        price_monthly: { gt: 0 },
      },
      orderBy: { sort_order: 'asc' },
      select: {
        id: true,
        tier_key: true,
        name: true,
        display_name: true,
        description: true,
        price_monthly: true,
        sort_order: true,
        billing_type: true,
      },
    });
  }

  // Load features for each upgrade tier and compute deltas
  const upgradeOptions = await Promise.all(
    upgradeTiers.map(async (t) => {
      const tierFeatures = await prisma.tier_features_list.findMany({
        where: { tier_id: t.id, is_enabled: true },
        select: { feature_key: true, feature_name: true },
      });
      const newFeatures = tierFeatures
        .filter((f) => !currentFeatureKeys.has(f.feature_key))
        .map((f) => ({ featureKey: f.feature_key, featureName: f.feature_name }));

      const modeMeta = isGateway ? ENTRY_PRESENCE_MODES[t.tier_key] : undefined;

      return {
        tierKey: t.tier_key,
        name: t.name,
        displayName: t.display_name,
        description: t.description,
        priceMonthly: Number(t.price_monthly),
        priceAnnual: Number(t.price_monthly) * 12,
        sortOrder: t.sort_order,
        billingType: t.billing_type,
        // V3.1 mode metadata (only present for gateway upgrades)
        mode: modeMeta?.mode,
        surface: modeMeta?.surface,
        tagline: modeMeta?.tagline,
        isPrimary: modeMeta?.primary ?? false,
        newFeatures,
      };
    }),
  );

  return {
    currentTier: {
      tierKey: currentTier.tier_key,
      name: currentTier.name,
      displayName: currentTier.display_name,
      description: currentTier.description,
      priceMonthly: Number(currentTier.price_monthly),
    },
    isGatewayUpgrade: isGateway,
    upgradeOptions,
  };
}
