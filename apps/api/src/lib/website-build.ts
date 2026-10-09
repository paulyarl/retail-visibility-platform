/**
 * Website-build scope + delivery-mode vocabulary (PB-08 / A7).
 *
 * The playbook_decision JSONB (migration 309) carries kind='website_build_scope'
 * with confirmed_scope. delivery_mode is the PB-08 analog of the repair
 * package's diy/dfy mode: DFY = the operator executes the build, DIY = the
 * approved mockup + scope + acceptance criteria are handed to the owner /
 * their developer (pbcs-pb08-005 already names both lanes).
 *
 * BUILD_SCOPE_MODES is the scope-aware gate — each scope lists the delivery
 * modes it may offer. All four currently support both lanes (every scope can
 * be operator-executed or handed off with acceptance criteria); the map is
 * authoritative so a scope can be restricted to a single lane in one line.
 */

export type BuildScope = 'new_build' | 'rebuild' | 'repair' | 'secure_and_refresh';
export type BuildDeliveryMode = 'dfy' | 'diy';

export const BUILD_SCOPES: BuildScope[] = ['new_build', 'rebuild', 'repair', 'secure_and_refresh'];

export const BUILD_SCOPE_MODES: Record<BuildScope, BuildDeliveryMode[]> = {
  new_build: ['dfy', 'diy'],
  rebuild: ['dfy', 'diy'],
  repair: ['dfy', 'diy'],
  secure_and_refresh: ['dfy', 'diy'],
};

export const BUILD_SCOPE_LABELS: Record<BuildScope, string> = {
  new_build: 'New build',
  rebuild: 'Rebuild',
  repair: 'Repair',
  secure_and_refresh: 'Secure & refresh',
};

export function isBuildScope(v: unknown): v is BuildScope {
  return typeof v === 'string' && (BUILD_SCOPES as string[]).includes(v);
}

export function isBuildDeliveryMode(v: unknown): v is BuildDeliveryMode {
  return v === 'dfy' || v === 'diy';
}

/** Modes a scope may offer — [] when the scope is unknown. */
export function modesForScope(scope: unknown): BuildDeliveryMode[] {
  return isBuildScope(scope) ? BUILD_SCOPE_MODES[scope] : [];
}

/**
 * Stages at/past execution — a preview has been built or a delivery lane
 * sold/handed off, so flipping dfy↔diy would silently rewrite who executes
 * the build. Mirrors the campaign stage enum in routes/marketing-ops.ts;
 * 'lost'/'dead' stay unlocked (terminal, no artifacts to protect).
 */
export const DELIVERY_MODE_LOCKED_STAGES = new Set([
  'preview_built',
  'shown',
  'paid',
  'delivered',
  'retainer_pitched',
  'retainer_won',
  'tenant_onboarded',
  'resolved_and_closed',
]);

/**
 * Execution markers that lock a CHOSEN delivery mode — the PB-08 analog of
 * the repair package's mode_locked rule (mode is immutable once
 * access_collected_at is set; RepairFulfillmentService). A set mode may not
 * flip once execution artifacts exist; setting the first mode is always
 * allowed. Returns human-readable reasons; empty = still mutable.
 */
export async function deliveryModeLockReasons(
  prismaClient: any,
  campaign: { id: string; stage?: string | null },
): Promise<string[]> {
  const reasons: string[] = [];

  if (campaign.stage && DELIVERY_MODE_LOCKED_STAGES.has(campaign.stage)) {
    reasons.push(`campaign is at '${campaign.stage}'`);
  }

  // Live seed-preview storefront on any linked seed — the generated demo
  // storefront is the proof-of-work artifact of the website-gap motion.
  const previewRows = await prismaClient.$queryRaw<any[]>`
    SELECT t.id
    FROM directory_seed_campaign_links l
    JOIN directory_presence_seeds s ON s.id = l.seed_id
    JOIN tenants t ON t.demo_source_tenant_id = s.tenant_id
    WHERE l.campaign_id = ${campaign.id}
      AND t.is_demo = true
      AND t.demo_template = 'seed_preview'
      AND t.location_status = 'active'
    LIMIT 1
  `;
  if (previewRows.length > 0) {
    reasons.push('a live preview storefront exists');
  }

  // Owner-submitted website_build intake — the PB-08 analog of the repair
  // package's access_collected_at.
  const intake = await prismaClient.mkt_dispute_intake.findFirst({
    where: {
      campaign_id: campaign.id,
      intake_kind: 'website_build',
      submitted_at: { not: null },
    },
    select: { id: true },
  });
  if (intake) {
    reasons.push('the owner build intake was submitted');
  }

  return reasons;
}
