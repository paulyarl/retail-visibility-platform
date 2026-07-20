---
description: How to add a new funnel step type that bridges another capability, using the coupon_offer step as the reference pattern
---

# Funnel Step Type Bridging Another Capability

Use this when you need to add a new `FunnelStepType` that is not a product offer but references an entity from another capability (e.g., a `coupon_offer` step that links to `tenant_coupons`).

## 1. Backend type and resolver

- Add the step to `FunnelStepType` in `apps/api/src/services/resolvers/types.ts`.
- Add `can_use_<step>` to `EffectiveFunnel` in the same file.
- Add the feature key to `STEP_KEY_MAP` in `apps/api/src/services/resolvers/FunnelResolver.ts`.
- Return `can_use_<step>` from `resolveFunnelOptions`.

## 2. Funnel service validation

- In `apps/api/src/services/FunnelService.ts` `validateSteps`, branch on `step.step_type === '<new_step>'`.
- Validate `offer_item_id` points to an existing, active record from the other capability (query `prisma` or the target service).
- Auto-fill `display_title` / `display_description` from the referenced record when the merchant did not provide them.

## 3. Frontend state mapping

- Add the step to the `FunnelStepType` union in `apps/web/src/services/CapabilityResolutionService.ts` and `apps/web/src/services/FunnelService.ts`.
- Add `canUse<Step>` to `FunnelState` in `CapabilityResolutionService.ts`.
- Map the backend field in `apps/web/src/services/UnifiedCapabilityService.ts` (`BackendEffectiveFunnel` and `mapFunnel`).

## 4. Funnel builder UI

- In `apps/web/src/app/t/[tenantId]/settings/funnels/[funnelId]/FunnelBuilderClient.tsx`:
  - Import the target capability hook and service (e.g., `useCouponOptionsCapability`, `CouponService`).
  - Add the step to `STEP_TYPES` with an icon and description.
  - Update `isStepTypeAllowed` to gate the new step (include cross-capability checks, not just `FunnelState`).
  - Change the step type `Select` and the `offer_item_id` picker to support the new entity (coupon selector instead of product picker).

## 5. Capability gating and constraints

- Add the new `can_use_<step>` field to `CONSTRAINT_METADATA` in `apps/api/src/routes/admin/capability-constraints.ts`.
- Add any cross-capability CCL constraints in `apps/api/src/services/resolvers/CapabilityConstraintRegistry.ts` (e.g., `funnel.can_use_coupon_offer` requires `coupon_options.enabled`).
- Add the new field/empty default to `buildExpiredCapabilitiesResponse` in `apps/api/src/routes/public-tenant-capabilities.ts`.
- Surface the new feature in `PlanSummaryWidget.tsx` (dashboard + options pages), `PlanSummaryPanel.tsx` (plan-summary page only), and `CapabilityShowcase.tsx` if it should appear in plan summaries.

## 6. Feature seeding

- Create a SQL migration in `database/migrations/` that inserts the feature key into:
  - `features_list`
  - `capability_features_list` (linked to `capability_type_list` where `key = 'funnel_options'`)
  - `tier_features_list` for any tiers that should have the feature enabled

## 7. Verification

- Run `pnpm checkapi` and `pnpm checkweb` after all changes.
- Ensure the new step is hidden when the cross-capability requirement is not met.
- Ensure a funnel can be saved with the new step and that `offer_item_id` is validated against real records.
