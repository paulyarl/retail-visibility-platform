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
