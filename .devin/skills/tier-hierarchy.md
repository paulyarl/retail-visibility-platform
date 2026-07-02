# Platform Tier Hierarchy

> **Source of truth:** `docs/PLATFORM_STRATEGY_V2.md`
> **When to use:** Any work involving tier levels, tier ordering, upgrade paths, growth tips, capability gating, pricing, or tier-aware UI behavior.

## Tier Order (low → high)

| # | Key | Display Name | Price/mo | Business Model | Purchase Capability |
|---|---|---|---|---|---|
| 1 | `discovery` | Discovery | $29 | Visibility only | None |
| 2 | `storefront` | Storefront | $59 | Platform presence | None |
| 3 | `commitment` | Commitment | $79 | Physical retail | Deposit only |
| 4 | `ecommerce` | E-commerce | $99 | Online-only | Full payment only |
| 5 | `omnichannel` | Omnichannel | $149 | Physical + online | Both (deposit + full) |
| 6 | `enterprise` | Enterprise | $499 | Multi-location | All options |

**Legacy/alias tiers** (map to the above):
- `google_only` → maps to `discovery` level
- `starter` → maps to `storefront` level (legacy)
- `professional` → sits between `omnichannel` and `enterprise` in code (legacy)
- `organization` → maps to `enterprise` level
- `custom` → highest level (escape hatch)

**Chain tiers** (multi-location variants):
- `chain_starter` → `storefront` level
- `chain_professional` → `professional` level
- `chain_enterprise` → `enterprise` level

## Canonical TIER_ORDER array

Use this exact ordering in any code that compares tier levels:

```
['google_only', 'starter', 'discovery', 'storefront', 'commitment',
 'ecommerce', 'omnichannel', 'professional', 'enterprise',
 'chain_starter', 'chain_professional', 'chain_enterprise', 'custom']
```

## Upgrade Path

```
discovery → storefront → commitment → ecommerce → omnichannel → enterprise
```

- **discovery → storefront:** "Now I want them to find my whole store"
- **storefront → commitment:** "I want shoppers to commit to buying" (deposit)
- **storefront → ecommerce:** "I want shoppers to buy fully online" (full payment)
- **commitment → ecommerce:** "I want to close the full sale online" (same price, different model)
- **commitment → omnichannel:** "I want both deposit AND full payment"
- **ecommerce → omnichannel:** "I want to add physical pickup options"
- **omnichannel → enterprise:** "I want multi-location and advanced features"

**Key V2 insight:** Commitment (Tier 3) and E-commerce (Tier 4) are the same price ($79 vs $99) but serve different business models. Commitment = deposit-only for physical retailers. E-commerce = full-payment-only for online merchants. Omnichannel (Tier 5) combines both.

## Capability Matrix (simplified)

| Capability | discovery | storefront | commitment | ecommerce | omnichannel | enterprise |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Google visibility | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Directory listing | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Branded storefront | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Platform product visibility | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shopper inquiry | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add to cart / checkout | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Deposit / holding fee | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Full online payment | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| BOPIS / click & collect | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Delivery / fulfillment | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Shopper payment path choice | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Conversion analytics | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Advanced analytics | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Multi-location | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

## Files that MUST stay in sync

### Frontend (`apps/web/src/lib/`)
- `tiers/tier-resolver.ts` — `TierInfo.level` type, `mapTierLevel()`, `getHigherTierLevel()`, `getUpgradeOptions()`
- `tiers/tier-features.ts` — `TIER_HIERARCHY`, `TIER_DISPLAY_NAMES`, `TIER_PRICING`, `TIER_FEATURES`, `FEATURE_TIER_MAP`
- `tiers/content-consistency.ts` — `TIER_PROGRESSIONS`, `CONTENT_MAPPINGS` (tier arrays per capability)
- `tiers/chain-pricing.ts` — `CHAIN_TIERS`, `getIndividualPriceForTier()`
- `growth-tips/tipEngine.ts` — `TIER_ORDER`, tier helper functions (`isDiscoveryOrBelow`, `isStorefront`, `isCommitment`, `isEcommerce`, `isEcommerceOrAbove`, `isEnterprise`), `nextTierName()`, tip definitions

### Backend (`apps/api/src/`)
- `services/GrowthTipService.ts` — mirrors frontend tipEngine: `TIER_ORDER`, tier helpers, `nextTierName()`, tip definitions
- `utils/tier-limits.ts` — `SubscriptionTier` type, `TIER_LIMITS` with `ecommerce` entry
- `utils/trial-tier-transparency.ts` — trial-to-base tier mapping (includes `trial_ecommerce`)
- `services/TierService.ts` — trial tier mapping
- `routes/admin/tier-management.ts` — tier ordering, pricing, SKU limits
- `utils/featured-product-scoring.ts` — tier-based scoring weights
- `services/IntegrationOptionsService.ts` — `minTier` per integration type

### Critical pattern
Any array or switch that enumerates tier levels MUST include `'ecommerce'` between `'commitment'` and `'omnichannel'`. Missing it causes `tierIndex('ecommerce')` to return `0` (fallback), treating E-commerce tenants as Discovery-level — showing wrong upgrade tips, wrong capability gates, and wrong tier comparisons.

## Common bugs from missing `ecommerce` in tier arrays

1. **Wrong growth tips:** E-commerce users see "Upgrade to Storefront" (discovery tip) instead of "Add physical pickup with Omnichannel"
2. **Wrong capability gating:** E-commerce users treated as discovery-level, denied commerce features they're paying for
3. **Wrong tier comparisons:** `getHigherTierLevel()` can't compare ecommerce vs other tiers correctly
4. **Wrong upgrade options:** `getUpgradeOptions()` skips valid upgrade paths
