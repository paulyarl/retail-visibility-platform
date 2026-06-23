# OrgPlanSummaryPanel Expired Subscription Gate — Implementation Plan

## Goal

When an organization's subscription is frozen/canceled/expired, the `OrgPlanSummaryPanel` should show a locked state (red header, lock icon, "Read-only" badge, upgrade link) instead of the normal blue plan summary with feature grids — mirroring what was done for the tenant-level `PlanSummaryPanel`.

## Current State

- **Backend** (`organization-capabilities.ts:57-188`): The `GET /api/organizations/:orgId/effective-capabilities` endpoint fetches `org.subscription_status` (line 74) but does **not** derive `internalStatus` or return a `subscription_context` object.
- **Frontend** (`OrgCapabilityService.ts:27-40`): `OrgCapabilitiesState` has no `subscriptionContext` field.
- **Frontend** (`OrgPlanSummaryPanel.tsx:65-188`): Renders the normal blue plan summary. Has a basic `!enabled` footer (line 169) but no subscription-status-aware locked state.

## Implementation Steps

### Step 1: Backend — Add `subscription_context` to org capabilities response

**File:** `apps/api/src/routes/organization-capabilities.ts`

1. Import `deriveInternalStatus` and `getMaintenanceState` from `../utils/subscription-status` (already imported in `EffectiveCapabilityResolver.ts`, same module).
2. After fetching the org (line 76), derive the org's internal status:
   ```typescript
   const orgInternalStatus = deriveInternalStatus({
     subscription_status: org.subscription_status,
     subscription_tier: org.subscription_tier,
     trialEndsAt: null,       // orgs don't have trials
     subscription_ends_at: null,
   });
   const orgMaintenanceState = getMaintenanceState({
     tier: org.subscription_tier,
     status: org.subscription_status,
     trialEndsAt: null,
   });
   const orgIsReadOnly = orgInternalStatus === 'frozen' || orgInternalStatus === 'canceled' || orgInternalStatus === 'expired';
   const orgIsLimited = orgInternalStatus === 'maintenance' || orgInternalStatus === 'past_due';
   ```
3. Include `subscription_context` in the response object (around line 170):
   ```typescript
   data: {
     ...result,
     tier: { ... },
     purchased_feature_keys: purchasedFeatureKeys,
     subscription_context: {
       internal_status: orgInternalStatus,
       maintenance_state: orgMaintenanceState,
       is_read_only: orgIsReadOnly,
       is_limited: orgIsLimited,
       writable: !orgIsReadOnly,
     },
   }
   ```
4. When `orgIsReadOnly` is true, set `result.enabled = false` to disable all org capabilities (the resolver already supports this via the second arg, but we should override after resolution).

### Step 2: Frontend — Add `subscriptionContext` to `OrgCapabilitiesState`

**File:** `apps/web/src/services/OrgCapabilityService.ts`

1. Add a new interface (mirror the tenant-level `SubscriptionContextState`):
   ```typescript
   export interface OrgSubscriptionContext {
     internalStatus: string;
     maintenanceState: string | null;
     isReadOnly: boolean;
     isLimited: boolean;
     writable: boolean;
   }
   ```
2. Add field to `OrgCapabilitiesState`:
   ```typescript
   export interface OrgCapabilitiesState {
     // ... existing fields ...
     subscriptionContext?: OrgSubscriptionContext;
   }
   ```
3. Add to `BackendOrgCapabilities`:
   ```typescript
   interface BackendOrgCapabilities {
     // ... existing fields ...
     subscription_context?: {
       internal_status: string;
       maintenance_state: string | null;
       is_read_only: boolean;
       is_limited: boolean;
       writable: boolean;
     };
   }
   ```
4. Map it in `mapOrgCapabilities`:
   ```typescript
   function mapOrgCapabilities(b: BackendOrgCapabilities): OrgCapabilitiesState {
     return {
       // ... existing mappings ...
       subscriptionContext: b.subscription_context ? {
         internalStatus: b.subscription_context.internal_status,
         maintenanceState: b.subscription_context.maintenance_state,
         isReadOnly: b.subscription_context.is_read_only,
         isLimited: b.subscription_context.is_limited,
         writable: b.subscription_context.writable,
       } : undefined,
     };
   }
   ```

### Step 3: Frontend — Add locked state to `OrgPlanSummaryPanel`

**File:** `apps/web/src/components/organization/OrgPlanSummaryPanel.tsx`

1. Destructure `subscriptionContext` from `orgCaps` (line 74):
   ```typescript
   const { tier, enabled, isFlexible, allowedTabs, allowedPanels, allowedPropagationTypes, purchasedFeatureKeys, subscriptionContext } = orgCaps;
   const isLocked = subscriptionContext && !subscriptionContext.writable;
   ```
2. When `isLocked` is true, render a locked variant:
   - **Header**: Red gradient (`from-red-50 to-red-100`) instead of blue, lock icon instead of crown, "Read-only" badge next to tier name.
   - **Body**: Replace the feature grid sections with a compact message:
     ```
     <Lock icon>
     Your organization subscription is {subscriptionContext.internalStatus}.
     Organization features are in read-only mode.
     ```
   - **Upgrade link**: Button linking to `/settings/subscription` (same as the existing `!enabled` footer link).
   - **Hide** the `Section` components (tabs, panels, propagation) since all features are disabled.
3. Keep the existing `!enabled` footer as a fallback for when `subscriptionContext` is undefined but `enabled` is false (tier-gated, not subscription-gated).

### Step 4: Verify

1. Run `pnpm checkweb` to confirm no TypeScript errors.
2. Test with an org that has `subscription_status = 'canceled'` or `subscription_tier = 'google_only'` with expired trial — should show locked panel.
3. Test with an active org — should show normal blue panel with feature grid.

## Files to Modify

| File | Change |
|------|--------|
| `apps/api/src/routes/organization-capabilities.ts` | Derive `internalStatus`, return `subscription_context` in response |
| `apps/web/src/services/OrgCapabilityService.ts` | Add `OrgSubscriptionContext` type, map backend field |
| `apps/web/src/components/organization/OrgPlanSummaryPanel.tsx` | Add locked state UI when `subscriptionContext.writable === false` |

## Key Patterns to Follow

- Mirror the tenant-level `PlanSummaryPanel` locked state pattern (red gradient, lock icon, "Read-only" badge, upgrade link).
- Use `deriveInternalStatus` from `apps/api/src/utils/subscription-status.ts` — same utility used by `EffectiveCapabilityResolver`.
- Orgs don't have `trial_ends_at` or `subscription_ends_at` — pass `null` for both.
- The `subscription_context` field should be optional on the frontend (`?`) so existing responses without it don't break.
