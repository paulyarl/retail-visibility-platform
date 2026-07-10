# Feature Store User Guide

## Overview

The Feature Store (`/settings/feature-store`) allows tenants to purchase à la carte features (BSaaS) that are not included in their subscription tier. Purchases are billed through the existing Stripe infrastructure and merged into the tenant's effective capabilities via the `EffectiveCapabilityResolver`.

## Architecture

### Key Components

| Component | File | Role |
|-----------|------|------|
| Feature Store UI | `apps/web/src/app/(platform)/settings/feature-store/page.tsx` | Tenant-facing catalog + purchase flow |
| Frontend Service | `apps/web/src/services/BsaasPurchaseService.ts` | API client singleton |
| Purchase Routes | `apps/api/src/routes/bsaas-purchases.ts` | Tenant-facing API: catalog, purchase, cancel |
| Renewal Job | `apps/api/src/jobs/bsaas-renewal.ts` | Daily job: re-charge, grace period, suspend, expire |
| Capability Resolver | `apps/api/src/services/EffectiveCapabilityResolver.ts` | Merges tier + purchased features into effective capabilities |
| Catalog Table | `bsaas_catalog` (DB) | Stores purchasable features with pricing |
| Purchases Table | `tenant_feature_purchases` (DB) | Records actual purchases per tenant |

### Data Flow

```
Tenant views Feature Store
  → GET /api/subscription/feature-catalog (filters: is_active=true, is_private=false)
    → Returns bsaas_catalog entries + tenant's tier status + existing purchases
    → Each item includes trialEligible and demoEligible flags
  → GET /api/subscription/bundle-catalog (filters: is_active=true, is_private=false)
    → Returns active bundles with component features and trial info
  → Frontend fetches tenant isDemo status via tenantPublicService.getPublicTenantInfo()
  → Tenant clicks "Purchase" or "Start Trial" (trial button only if trialEligible && trialDays > 0)
  → POST /api/subscription/feature-purchase { featureKey, paymentMethodId }
    → Validates feature is in catalog
    → Checks not already in tier (in_tier_already / in_tier_gate_off)
    → Checks demo_eligible — blocks demo tenants with 403 demo_tenant_blocked
    → Checks trial_eligible — only enters trial branch if true AND trial_days > 0
    → Charges via Stripe (or creates trial if eligible)
    → Creates tenant_feature_purchases record
    → Ensures companion purchase for parent-gate feature (see below)
    → invalidateEffectiveCapabilities(tenantId)
  → Next capability resolution cycle merges purchased features
```

## The Parent-Gate Problem & Companion Purchases

### The Problem

Every capability resolver has a **parent gate** — a master `enabled` flag that gates all sub-features. For example:

```typescript
// ChatbotOptionsResolver.ts
const tierEnabled = !!feat.chatbot_enabled;  // parent gate
const enabled = tierEnabled && (merchantPrefs?.chatbot_enabled !== false);
// All sub-features are ANDed with `enabled`
```

If a tenant's tier does NOT include `chatbot_enabled`, purchasing `chatbot_skill_crm_assistant` alone would set that feature flag to `true` in the merged capabilities, but `enabled` remains `false` — **the purchase is silently ineffective**. The tenant pays but gets nothing.

This affects ALL capability types with parent gates, not just chatbot.

### The Solution: Companion Purchases

When a tenant purchases a sub-feature whose capability type has a parent gate, the system auto-creates a **zero-cost companion purchase** for the parent-gate feature key.

```
Tenant purchases: chatbot_skill_crm_assistant ($19/mo)
  → System auto-creates: chatbot_enabled ($0, source='companion')
  → Both merge into mergedFeatures as is_enabled=true
  → Resolver sees chatbot_enabled=true → enabled=true → skill works
```

Companion purchase properties:
- `source: 'companion'` — distinguishes from real purchases
- `status: 'active'` — active immediately
- `expires_at: null` — never expires on its own
- `metadata.price_cents: 0` — no charge
- `metadata.companion_for: <purchased_feature_key>` — traceability

### Cascade Cancel

When a real (non-companion) purchase is cancelled, the system checks if any other active real purchases remain for the same capability type. If none remain, the companion purchase is also cancelled, closing the parent gate.

### Renewal Job

Companion purchases are naturally excluded from the renewal job because all queries filter `source: 'bsaas'`. Companion purchases have `source: 'companion'` and `expires_at: null`, so they are never re-charged, never expire, and never enter grace periods.

## Complete Parent-Gate Map

This map must be maintained when adding new capability types. If a new resolver has a parent `enabled` flag, add it here:

| Capability Type Key | Parent Gate Feature Key | Resolver File |
|---------------------|------------------------|---------------|
| `chatbot_options` | `chatbot_enabled` | `ChatbotOptionsResolver.ts` |
| `crm_options` | `crm_enabled` | `CrmOptionsResolver.ts` |
| `social_commerce_options` | `social_commerce_enabled` | `SocialCommerceOptionsResolver.ts` |
| `storefront_options` | `storefront_opt_enabled` | `StorefrontOptionsResolver.ts` |
| `quickstart_options` | `quickstart_enabled` | `QuickstartOptionsResolver.ts` |
| `fulfillment_options` | `fulfillment_enabled` | `FulfillmentResolver.ts` |
| `payment_gateway_options` | `payment_gateway_enabled` | `PaymentGatewayResolver.ts` |
| `featured_options` | `featured_enabled` | `FeaturedOptionsResolver.ts` |
| `faq_options` | `faq_enabled` | `FaqOptionsResolver.ts` |
| `barcode_scan_options` | `barcode_enabled` | `BarcodeScanResolver.ts` |
| `directory_entry` | `directory_entry_enabled` | `DirectoryEntryOptionsResolver.ts` |
| `directory_promotion` | `directory_promotion_enabled` | `DirectoryPromotionResolver.ts` |
| `organization_options` | `org_enabled` | `OrgOptionsResolver.ts` |
| `integration_options` | `integration_enabled` | `IntegrationOptionsResolver.ts` |

Defined in `PARENT_GATE_FEATURES` constant in `apps/api/src/routes/bsaas-purchases.ts`.

## Merchant Gate Map

The `MERCHANT_GATE_MAP` in `bsaas-purchases.ts` checks if a tenant has explicitly disabled a capability domain via merchant settings. This prevents the Feature Store from showing "Purchase" when the feature is already in the tier but turned off in settings.

| Capability Type Key | Settings Table | Toggle Column |
|---------------------|---------------|---------------|
| `chatbot_options` | `tenant_chatbot_options_settings` | `chatbot_enabled` |
| `crm_options` | `tenant_crm_options_settings` | `crm_enabled` |
| `social_commerce_options` | `tenant_social_commerce_options_settings` | `social_commerce_enabled` |

When adding a new purchasable feature, ensure its capability type is in `MERCHANT_GATE_MAP` if the resolver checks a merchant preferences toggle.

## Adding a New Feature to the Store

### Post-Flight Checklist

1. **Verify the feature exists in `features_list`**
   - The feature key must be in the `features_list` table with `is_active = true`
   - It must be linked to a `capability_type` via `capability_features_list`

2. **Verify the capability type has a parent gate in `PARENT_GATE_FEATURES`**
   - If the resolver for this capability type has a master `enabled` flag, ensure it's mapped
   - If not mapped, purchased sub-features will be silently ineffective (tenant pays, nothing works)

3. **Verify the capability type is in `MERCHANT_GATE_MAP`** (if applicable)
   - If the resolver checks a merchant preferences toggle (e.g., `merchantPrefs?.xxx_enabled`), add it
   - Without this, the store can't detect "in tier but disabled in settings" and will show "Purchase" incorrectly

4. **Add the feature to `bsaas_catalog`**
   - Via admin UI or SQL INSERT
   - Set: `feature_key`, `marketing_name`, `description`, `price_cents`, `billing_cycle`, `trial_days`, `icon_name`, `sort_order`, `is_active`

5. **Verify the resolver handles the purchased feature correctly**
   - Trace the resolver logic: purchased feature → `mergedFeatures` → `feat.xxx` → effective flag
   - Ensure the parent gate will be opened by the companion purchase
   - Check that merchant preferences don't block it unexpectedly

6. **Test the purchase flow end-to-end**
   - Purchase on a tier that does NOT include the feature → should work
   - Purchase on a tier that DOES include the feature → should show "In Your Plan"
   - Purchase on a tier with feature disabled in settings → should show "Enable in Settings"
   - Cancel the purchase → companion should be cancelled if no other real purchases remain
   - Verify `invalidateEffectiveCapabilities` is called and the feature activates immediately

7. **Verify the renewal job handles it**
   - Monthly/annual purchases should renew automatically
   - One-time purchases should not renew
   - Companion purchases should never be charged

## Purchase Lifecycle

```
trial (if trial_eligible === true AND trial_days > 0)
  → expires_at = now + trial_days
  → renewal job converts to active (charges) or enters grace period

active
  → expires_at = now + 30d (monthly) or 365d (annual) or null (one_time)
  → renewal job re-charges before expiry
  → if charge fails → past_due (grace period, 7 days)
    → if retry succeeds → active
    → if grace expires → suspended
  → if tenant cancels → cancelled (access until expiry)
    → when expiry passes → expired

companion (source='companion')
  → no expiry, no charge
  → cancelled automatically when last real purchase in same capability type is cancelled
```

### Eligibility Flags

Both `bsaas_catalog` and `bsaas_bundles` have three eligibility flags (migration `094_trial_eligible_flag.sql`):

| Flag | Default | Type | Effect |
|------|---------|------|--------|
| `trial_eligible` | `false` | Opt-in | Must be `true` for trials to be allowed (also requires `trial_days > 0`) |
| `demo_eligible` | `true` | Opt-out | When `false`, demo tenants (`tenants.is_demo = true`) are blocked with `403 demo_tenant_blocked` |
| `is_private` | `false` | Opt-in | When `true`, item is hidden from Feature Store catalog endpoints (admin grant only) |

The Feature Store page fetches the tenant's `isDemo` status via `tenantPublicService.getPublicTenantInfo()` to enforce `demo_eligible` restrictions client-side. The backend also enforces this check server-side before processing purchases.

## Feature Store UI States

| State | Badge | Button | Condition |
|-------|-------|--------|-----------|
| Purchasable | (none) | "Purchase" (blue) | Not in tier, no active purchase, `demo_eligible` not blocking |
| Active | "Active" (green) | "Cancel" (red light) | `purchase.status === 'active'` |
| Suspended | "Suspended" (orange) | (none) | `purchase.status === 'suspended'` |
| In Tier | "In Your Plan" (blue) | "Included in Plan" (disabled) | Tier includes feature, merchant gate on |
| Gate Off | "Disabled in Settings" (yellow) | "Enable in Settings" (disabled) | Tier includes feature, merchant gate off |
| Demo Restricted | "Demo Restricted" (red) | "Not Available for Demo" (disabled) | `isDemoTenant && !demoEligible` |

### Bundle-Specific UI States

| State | Badge | Button | Condition |
|-------|-------|--------|-----------|
| Bundle Eligible | (none) | "Purchase Bundle" / "Start Trial" (violet gradient) | `tierEligible === true`, not all active, not all in tier, `trialEligible && trialDays > 0` for trial label |
| Bundle Ineligible | "Upgrade Required" (gray) | "Upgrade Plan" (gray) | `tierEligible === false` — shows blocked domain badges |
| Bundle Demo Restricted | "Demo Restricted" (red) | "Not Available for Demo" (disabled) | `isDemoTenant && !bundle.demoEligible` |
| Bundle All Active | (filtered out) | (filtered out) | All components already active — bundle card hidden |
| Bundle All In Tier | "Included in Plan" (blue) | "Included in Plan" (disabled) | All components in tier |

**Ineligible bundle cards** display red badges listing each blocked capability domain (from `ineligibleDomains` array) so merchants can see exactly which domains their tier doesn't engage. For example, a Professional tier seeing the "Everything Pack + Org" would see a red "organization" badge indicating that domain is the blocker.

## File Reference

| Purpose | Path |
|---------|------|
| Purchase API routes | `apps/api/src/routes/bsaas-purchases.ts` |
| Renewal job | `apps/api/src/jobs/bsaas-renewal.ts` |
| Capability resolver | `apps/api/src/services/EffectiveCapabilityResolver.ts` |
| Frontend page | `apps/web/src/app/(platform)/settings/feature-store/page.tsx` |
| Frontend service | `apps/web/src/services/BsaasPurchaseService.ts` |
| Catalog migration | `database/migrations/047_bsaas_catalog.sql` |
| BSaaS flow doc | `.devin/skills/bsaas-purchase-flow.md` |
