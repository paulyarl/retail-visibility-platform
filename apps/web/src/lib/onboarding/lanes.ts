/**
 * Onboarding lanes — the platform's entrance→tier→exit pattern.
 *
 * A lane is an entry channel that carries a user through signup/onboarding to
 * a specific destination, preselecting the tier that makes the channel's core
 * feature work out of the box:
 *
 *   entrance  — where the user arrives from (Clover App Market launch, a
 *               directory claim link, a QR invite, ...). The entrance sets
 *               `lane=<id>` + lane-specific params on the signup URL.
 *   tier      — the tier preselected in the wizard so the lane's feature is
 *               granted immediately (trials proxy to base tiers at check
 *               time, so a trial of the tier carries the feature).
 *   exit      — where the user lands once their tenant exists. May embed the
 *               lane's entrance params (e.g. Clover's `?clover=installed`
 *               auto-continue marker).
 *
 * Lane state persists in onboardingStateService phase 1, which survives the
 * Auth0 redirect round-trip.
 */

export interface OnboardingLaneDef {
  /** Tier preselected in the signup wizard for this lane. */
  tier?: string;
  /** Post-tenant-creation destination. `params` are the entrance's own query params. */
  exit: (tenantId: string, params: Record<string, string>) => string;
}

export interface LaneState {
  id: string;
  params: Record<string, string>;
}

export const ONBOARDING_LANES: Record<string, OnboardingLaneDef> = {
  /**
   * Clover App Market: install → signup → trial_discovery (carries
   * integration_clover) → integrations page auto-continues into OAuth.
   */
  clover_market: {
    tier: 'discovery',
    exit: (tenantId) => `/t/${tenantId}/settings/integrations?clover=installed`,
  },

  /**
   * Directory claim: owner clicks a claim link → verifies → tenant lands on
   * presence and goes to the dashboard. Wired when the claim flow opts into
   * the wizard path (today it authenticates inline via returnTo).
   */
  directory_claim: {
    tier: 'presence',
    exit: (tenantId) => `/t/${tenantId}/dashboard`,
  },
};

/** Params the wizard consumes itself — never passed through as lane params. */
const RESERVED_PARAMS = new Set([
  'lane', 'tier', 'ref',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
]);

/**
 * Parse a lane out of a signup URL's query params. Returns null when no lane
 * is present or the id isn't registered.
 *
 * Backward compat: `clover=installed` (the pre-lane marker emitted by earlier
 * launch-route versions) resolves to the clover_market lane.
 */
export function parseLaneFromSearch(search: string): LaneState | null {
  const params = new URLSearchParams(search);

  let id = params.get('lane');
  if (!id && params.get('clover') === 'installed') id = 'clover_market';
  if (!id || !ONBOARDING_LANES[id]) return null;

  const laneParams: Record<string, string> = {};
  params.forEach((value, key) => {
    if (!RESERVED_PARAMS.has(key)) laneParams[key] = value;
  });

  return { id, params: laneParams };
}

/**
 * Resolve a stored phase-1 record back to a lane. Accepts either the generic
 * `lane` object or the legacy `cloverInstalled`/`cloverMerchantId` fields so
 * in-flight onboarding state keeps working.
 */
export function laneFromPhase1(phase1: {
  lane?: LaneState | null;
  cloverInstalled?: boolean;
  cloverMerchantId?: string;
} | null | undefined): LaneState | null {
  if (!phase1) return null;
  if (phase1.lane && ONBOARDING_LANES[phase1.lane.id]) return phase1.lane;
  if (phase1.cloverInstalled) {
    return {
      id: 'clover_market',
      params: phase1.cloverMerchantId ? { merchant_id: phase1.cloverMerchantId } : {},
    };
  }
  return null;
}

/**
 * The lane's post-tenant destination, or null to use the default path.
 */
export function laneExit(lane: LaneState | null, tenantId: string): string | null {
  if (!lane) return null;
  return ONBOARDING_LANES[lane.id]?.exit(tenantId, lane.params) ?? null;
}
