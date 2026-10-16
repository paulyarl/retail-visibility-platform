/**
 * Effective Capability Merge — the pure half of `fetchRawCapabilities`.
 *
 * Extracted for the Phase 3 contract (sprint plan 3.7 option (a)): the merge
 * is where the key-contract semantics actually run —
 *
 *   - tier features merge most-permissive-wins (OR on is_enabled)
 *   - `_disabled` rows are carried to the resolvers as enabled veto keys
 *     (D7: the veto itself lives resolver-side; the merge must NOT drop it)
 *   - purchases force-enable their feature and expand `*_flexible` to every
 *     linked feature in the capability type
 *   - overrides do the same, but only rows with `granted === true` —
 *     `granted=false` is IGNORED, not a deny (3.5). The filter lives HERE so
 *     the semantics are unit-testable, not inside a prisma where-clause.
 *   - post-332 rule: flexible expansion emits only non-negative keys — it
 *     must never synthesize a `*_disabled`/`_off` key
 *
 * The MV (migration 332) is a second implementation of this same logic in
 * SQL — the migration-lint asserts its shape; behavioral parity between the
 * two is the remaining hazard this extraction doesn't close.
 *
 * See: docs/LocalBiz/TIER_CAPABILITY_CONTRACT_SPRINT_PLAN.md, Phase 3.
 */

export interface CapTypeRef {
  key: string;
  name?: string;
  category?: string;
  [k: string]: unknown;
}

export interface TierFeatureRow {
  feature_key: string;
  is_enabled: boolean;
  is_highlighted?: boolean | null;
  capability_type_list?: CapTypeRef | null;
}

export interface MergedFeature {
  feature_key: string;
  is_enabled: boolean;
  is_highlighted: boolean;
  capability_type_list: CapTypeRef | null;
}

export interface CapabilityMergeInput {
  /** tier_features_list rows joined to capability_type_list (org + tenant tier). */
  tierFeatures: TierFeatureRow[];
  /** Active/past_due/trial purchases — already status- and expiry-filtered. */
  purchases: Array<{ feature_key: string }>;
  /** feature_key → its capability type, for purchased features. */
  purchaseCapTypeByFeature: Map<string, CapTypeRef | null>;
  /** capability key → every ACTIVE linked feature key (for `_flexible` purchases). */
  purchaseFlexibleExpansion: Map<string, string[]>;
  /** ALL non-expired overrides — the merge applies the `granted === true` filter. */
  overrides: Array<{ feature: string; granted: boolean }>;
  /** feature key → its capability type, for override features. */
  overrideCapTypeByFeature: Map<string, CapTypeRef | null>;
  /** capability key → every ACTIVE linked feature key (for `_flexible` overrides). */
  overrideFlexibleExpansion: Map<string, string[]>;
}

export interface MergedCapabilities {
  mergedFeatures: Map<string, MergedFeature>;
  capabilities: Record<
    string,
    { capability_enabled: boolean; is_highlighted: boolean; features: Record<string, boolean> }
  >;
  uncategorizedFeatures: string[];
}

export function mergeCapabilitySources(input: CapabilityMergeInput): MergedCapabilities {
  const mergedFeatures = new Map<string, MergedFeature>();

  // Post-332 rule: flexible expansion emits only non-negative keys. The MV
  // enforces this in SQL (`NOT LIKE '%_disabled' AND NOT LIKE '%_off'`); the
  // resolver's expansion lists are built from raw capability_features_list
  // rows, so the exclusion must live here to keep parity — a `*_flexible`
  // grant must never synthesize its own veto (the 332 BUG-2 phantom veto).
  const isNegativeGate = (key: string) => key.endsWith('_disabled') || key.endsWith('_off');

  const forceEnable = (key: string, capType: CapTypeRef | null | undefined) => {
    const existing = mergedFeatures.get(key);
    if (existing) {
      existing.is_enabled = true;
    } else {
      mergedFeatures.set(key, {
        feature_key: key,
        is_enabled: true,
        is_highlighted: false,
        capability_type_list: capType ?? null,
      });
    }
  };

  // 1. Tier features — most-permissive-wins across org + tenant tier.
  //    `_disabled`/`_off` rows arrive as ordinary enabled keys here: their
  //    veto meaning is resolver-side (D7), so they must NOT be filtered out.
  for (const tf of input.tierFeatures) {
    const existing = mergedFeatures.get(tf.feature_key);
    if (existing) {
      existing.is_enabled = existing.is_enabled || tf.is_enabled;
      existing.is_highlighted = existing.is_highlighted || (tf.is_highlighted ?? false);
    } else {
      mergedFeatures.set(tf.feature_key, {
        feature_key: tf.feature_key,
        is_enabled: tf.is_enabled,
        is_highlighted: tf.is_highlighted ?? false,
        capability_type_list: tf.capability_type_list ?? null,
      });
    }
  }

  // 2. Purchases (BSaaS) — purchased = enabled; a `*_flexible` purchase
  //    expands to every linked feature in its capability type.
  for (const purchase of input.purchases) {
    forceEnable(purchase.feature_key, input.purchaseCapTypeByFeature.get(purchase.feature_key));
  }
  for (const purchase of input.purchases) {
    if (!purchase.feature_key.endsWith('_flexible')) continue;
    const capType = input.purchaseCapTypeByFeature.get(purchase.feature_key);
    if (!capType) continue;
    for (const expandedKey of input.purchaseFlexibleExpansion.get(capType.key) ?? []) {
      if (isNegativeGate(expandedKey)) continue;
      forceEnable(expandedKey, capType);
    }
  }

  // 3. Overrides — granted === true ONLY (3.5: granted=false is ignored).
  for (const override of input.overrides) {
    if (override.granted !== true) continue;
    forceEnable(override.feature, input.overrideCapTypeByFeature.get(override.feature));
  }
  for (const override of input.overrides) {
    if (override.granted !== true || !override.feature.endsWith('_flexible')) continue;
    const capType = input.overrideCapTypeByFeature.get(override.feature);
    if (!capType) continue;
    for (const expandedKey of input.overrideFlexibleExpansion.get(capType.key) ?? []) {
      if (isNegativeGate(expandedKey)) continue;
      forceEnable(expandedKey, capType);
    }
  }

  // 4. Group by capability type.
  const capabilities: MergedCapabilities['capabilities'] = {};
  const uncategorizedFeatures: string[] = [];

  for (const tf of mergedFeatures.values()) {
    const capKey = tf.capability_type_list?.key;
    if (capKey) {
      if (!capabilities[capKey]) {
        capabilities[capKey] = { capability_enabled: true, is_highlighted: false, features: {} };
      }
      capabilities[capKey].features[tf.feature_key] = tf.is_enabled;
      if (tf.is_highlighted) capabilities[capKey].is_highlighted = true;
    } else {
      uncategorizedFeatures.push(tf.feature_key);
    }
  }

  return { mergedFeatures, capabilities, uncategorizedFeatures };
}

/**
 * D7 store-side mirror (sprint plan Phase 3.1 consequence): may the store
 * sell a feature in `capabilityKey` to a tier granting these enabled keys?
 *
 *   - `{capabilityKey}_disabled` enabled → ABSOLUTE veto. It beats purchases
 *     at resolve time, so selling into a vetoed module is dead money.
 *   - Every enabled key being `*_disabled`-suffixed → no positive engagement
 *     → also unsellable (same outcome, weaker signal).
 *
 * Used by `checkCapabilityEngagement` in bsaas-purchases.
 */
export function capabilitySaleAllowed(
  capabilityKey: string,
  enabledTierFeatureKeys: readonly string[],
): boolean {
  if (enabledTierFeatureKeys.includes(`${capabilityKey}_disabled`)) return false;
  return enabledTierFeatureKeys.some((k) => !k.endsWith('_disabled'));
}
