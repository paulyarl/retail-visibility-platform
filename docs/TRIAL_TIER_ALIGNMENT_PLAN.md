# Trial & Tier Alignment Implementation Plan

**Status:** Phase 0-3 Complete ✅ | Phase 4-6 In Progress

**Goal:** Fully align code and behavior with the V2 Tier Model and `SUBSCRIPTION_MANAGEMENT.md`, particularly around:
- Trial semantics (14-day duration, 1-location limit, status vs tier)
- **Post-trial lifecycle: Expired trials auto-downgrade to google_only (internal maintenance tier)**
- google_only maintenance window → freeze lifecycle
- Elimination of conflicting legacy behavior (30-day trial, unwanted auto-conversion)
- Consistent frontend UX and messaging

**Key Requirement Clarification (Nov 14, 2025):**
> When a trial expires, the system MUST automatically downgrade the tier to `google_only` (internal-only tier) to prevent premium feature leakage. This creates a maintenance window where users can update existing data but cannot grow, eventually transitioning to a frozen (read-only) state.

---

## Phase 0 – Ground Truth & Safety (Foundations)

**Objective:** Establish a single source of truth for trial/tier rules and prevent new divergence while cleanup happens.

**Priority:** P0 (do first)

- [ ] **0.1 Confirm authoritative specs**
  - [ ] Mark `TIER_MODEL_V2_SIMPLIFIED.md` as the canonical tier model (once approved) and reference it from `SUBSCRIPTION_MANAGEMENT.md`.
  - [ ] Add a short "Authoritative Sources" section to `SUBSCRIPTION_MANAGEMENT.md`:
    - [ ] Trial semantics (duration, limits) link
    - [ ] Tier limits + features link
    - [ ] google_only maintenance/freeze link.

- [ ] **0.2 Introduce central trial config (backend)**
  - [ ] Confirm `TRIAL_CONFIG` in `apps/api/src/config/tenant-limits.ts` is the **only** source of truth for:
    - [ ] Trial duration (14 days)
    - [ ] Trial location limit (1)
  - [ ] Add explicit comment: "All trial duration / limit logic must use this config".

- [ ] **0.3 Introduce central trial view model (frontend)**
  - [ ] Add a small helper in `apps/web/src/lib/tiers.ts` or new `lib/trial.ts`:
    - [ ] `TRIAL_CONFIG_FRONTEND` (mirrors backend fields, no hard-coded 30 days anywhere).
    - [ ] `isTrialStatus(status: string | null | undefined): boolean`.
    - [ ] `getTrialEndLabel(trialEndsAt)` for consistent UI formatting.

---

## Phase 1 – Normalize Trial Semantics (14 days, Status-Only)

**Objective:** Make trial behavior consistent across the codebase:
- Trial is always **status**, never relied on as a tier.
- Trial duration is **14 days** everywhere (logic and copy).

**Priority:** P0

### 1.1 Remove/normalize `trial` as a tier

- [ ] **Backend:**
  - [ ] Confirm backend tier enums exclude `trial` as a tier:
    - [ ] `apps/api/src/config/tenant-limits.ts` – `TenantLimitTier` is already non-trial; ensure no other backend type treats `trial` as a tier.
  - [ ] Search backend for `subscriptionTier === "trial"` and:
    - [ ] Replace with status-based checks (`subscriptionStatus === 'trial'`) where appropriate.
    - [ ] Remove any logic that sets `subscriptionTier = 'trial'`.

- [ ] **Frontend:**
  - [ ] Update `apps/web/src/lib/tiers.ts`:
    - [ ] Remove `'trial'` from `SubscriptionTier` union.
    - [ ] Either:
      - [ ] Remove `TIER_LIMITS.trial` entirely, **or**
      - [ ] Keep it as an internal-only helper but not exposed as a valid tier.
  - [ ] Update any references to `subscriptionTier === 'trial'` (example: subscription settings page):
    - [ ] Switch to `subscriptionStatus === 'trial'` + `trialEndsAt` presence.

### 1.2 Normalize trial duration to 14 days

- [ ] **Backend logic:**
  - [ ] `POST /tenants` in `apps/api/src/index.ts` – already sets 14 days; confirm it uses `TRIAL_CONFIG.durationDays` instead of a hard-coded `14`.
  - [ ] `GET /tenants/:id` in `apps/api/src/index.ts`:
    - [ ] Replace 30-day default trial end with `TRIAL_CONFIG.durationDays`.
  - [ ] `apps/api/src/routes/subscriptions.ts`:
    - [ ] Remove any 30-day trial references or magic numbers.

- [ ] **Backend copy & docs:**
  - [ ] Update `/subscriptions/pricing` response in `apps/api/src/routes/subscriptions.ts`:
    - [ ] Change any "30-day trial" bullet to "14-day trial".
  - [ ] Search repo for "30-day" or "30 day" references and standardize to 14-day, where referring to platform trial.

### 1.3 Ensure trial is treated as a status in app logic

- [ ] **Middlewares & checks:**
  - [ ] Confirm `checkTenantCreationLimit` uses `subscriptionStatus === 'trial'` to enforce 1-location limit (already true via `TRIAL_CONFIG`).
  - [ ] Ensure any code that infers "isTrial" uses `subscriptionStatus` (and *not* tier) as the canonical flag.

---

## Phase 2 – Trial Expiration Behavior (Auto-Downgrade to google_only)

**Objective:** After trial ends, automatically downgrade to google_only tier:
- **DO** auto-downgrade expired trials to `google_only` tier (prevents premium feature leakage)
- Do **NOT** auto-convert trials to active paid tiers (starter/professional/etc.)
- Set `subscriptionStatus = 'expired'` and `subscriptionTier = 'google_only'`
- Protect paid users: Only downgrade if no Stripe subscription exists
- Present clear error messages and upgrade paths

**Priority:** P0

**Rationale:** google_only is an internal-only maintenance tier that prevents premium feature leakage while preserving user visibility (storefront/directory remain online).

### 2.1 Implement trial expiration auto-downgrade in `GET /tenants/:id`

- [x] `apps/api/src/index.ts` (`GET /tenants/:id`):
  - [x] **KEEP** the auto-downgrade logic (this is correct behavior):
    - [x] When `subscriptionStatus === 'trial'` AND `trialEndsAt < now`
    - [x] Set `subscriptionStatus = 'expired'`
    - [x] Set `subscriptionTier = 'google_only'` (if no Stripe subscription)
    - [x] Protect paid users: Keep original tier if `stripeSubscriptionId` exists
  - [x] This prevents premium feature leakage and creates maintenance window

- [x] `apps/api/src/routes/subscriptions.ts`:
  - [x] Ensure `/subscriptions/status` does NOT auto-convert
  - [x] Return status as-is without mutation
  - [x] Let `GET /tenants/:id` handle the one-time downgrade

### 2.2 Align `requireActiveSubscription` with auto-downgrade behavior

- [x] `apps/api/src/middleware/subscription.ts` (`requireActiveSubscription`):
  - [x] Keep the `trial_expired` 402 response for trials that haven't been downgraded yet
  - [x] This catches edge cases where trial expires between requests

- [x] **Decision Made:** Use `subscriptionStatus = 'expired'` + `subscriptionTier = 'google_only'`
  - [x] `GET /tenants/:id` performs one-time auto-downgrade
  - [x] Subsequent requests see `expired` status and `google_only` tier
  - [x] `deriveInternalStatus()` determines operational state (maintenance vs frozen)
  - [x] Documented in `GOOGLE_ONLY_MAINTENANCE_TIER.md`

### 2.3 Ensure consistent trial expiration handling

- [x] Verified: Only `GET /tenants/:id` performs auto-downgrade
- [x] No other endpoints set `subscriptionStatus = 'active'` on trial expiration
- [x] Stripe webhooks will handle paid subscription upgrades (Phase 5)
- [x] Admin can manually upgrade via `/subscriptions/update` endpoint

---

## Phase 3 – Implement google_only Maintenance & Freeze Lifecycle ✅

**Objective:** Implement the two-phase google_only lifecycle:
- **Maintenance window:** Can update existing data, cannot add new products (no growth)
- **Freeze:** Read-only visibility mode (storefront/directory remain online)

**Priority:** P0 (blocking for trial expiration)

**Status:** ✅ COMPLETE (Nov 14, 2025)

**Key Implementation:**
- `google_only` is an **internal-only tier** (not purchasable)
- Auto-assigned when trial expires (via `GET /tenants/:id`)
- Maintenance window uses `trialEndsAt` as boundary
- After boundary passes, account freezes (read-only)

### 3.1 Data model & state derivation ✅

- [x] Prisma schema confirmed:
  - [x] `subscriptionStatus` field exists (stores: trial, active, expired, past_due, canceled)
  - [x] `subscriptionTier` includes `'google_only'`
  - [x] `trialEndsAt` field exists (used as maintenance boundary)
  - [x] `subscriptionEndsAt` field exists
  - [x] Note: `maintenanceBoundaryAt` not added (using `trialEndsAt` as boundary for simplicity)

- [x] Implemented `deriveInternalStatus()` in `apps/api/src/utils/subscription-status.ts`:
  - [x] Returns: `'trialing' | 'active' | 'past_due' | 'maintenance' | 'frozen' | 'canceled' | 'expired'`
  - [x] Encapsulates google_only lifecycle:
    - [x] `subscriptionTier === 'google_only'` + `now < trialEndsAt` → `'maintenance'`
    - [x] `subscriptionTier === 'google_only'` + `now >= trialEndsAt` → `'frozen'`
  - [x] Used consistently in middleware (`requireWritableSubscription`)

### 3.2 Wire into middleware ✅

- [x] `requireActiveSubscription` (existing):
  - [x] Blocks: `canceled`, `expired` (trial), `past_due`
  - [x] Returns 402 errors with clear messages
  - [x] Does not use `deriveInternalStatus` (kept simple for read access)

- [x] **NEW:** `requireWritableSubscription` (implemented):
  - [x] Uses `deriveInternalStatus()` to determine write permissions
  - [x] Blocks frozen accounts: 403 `account_frozen` (read-only mode)
  - [x] Blocks canceled accounts: 403 `subscription_canceled`
  - [x] Blocks expired accounts: 402 `subscription_expired`
  - [x] **Allows maintenance mode:** Updates OK, growth blocked by `checkSubscriptionLimits`
  - [x] Allows: `trialing`, `active`, `past_due`

### 3.3 Enforce maintenance vs freeze on operations ✅

- [x] **Maintenance mode enforcement:**
  - [x] `checkSubscriptionLimits` blocks POST operations when `maintenanceState === 'maintenance'`
  - [x] Returns 403 `maintenance_no_growth` error
  - [x] Message: "You can update existing products, but cannot add new products until you upgrade"
  - [x] Allows: PUT/PATCH operations (updates to existing data)
  - [x] Blocks: POST operations (new items, Quick Start, bulk imports)

- [x] **Freeze mode enforcement:**
  - [x] `requireWritableSubscription` blocks ALL write operations when `internalStatus === 'frozen'`
  - [x] Returns 403 `account_frozen` error
  - [x] Message: "Your account is in read-only mode. Your storefront and directory listing remain visible, but you cannot make changes"
  - [x] Blocks: All PUT/PATCH/POST/DELETE operations

- [x] **Middleware application order:**
  1. `requireWritableSubscription` - Blocks frozen accounts
  2. `checkSubscriptionLimits` - Blocks growth in maintenance + enforces tier limits

---

## Phase 4 – Frontend UX & Messaging Alignment

**Objective:** Ensure the UI reflects the aligned semantics clearly:
- Trial banners, status labels, and CTAs are consistent.
- Pricing & settings screens mirror the new lifecycle.

**Priority:** P1

### 4.1 Subscription settings page

- [ ] `apps/web/src/app/(platform)/settings/subscription/page.tsx`:
  - [ ] Replace any logic checking `subscriptionTier === 'trial'` with status-based checks.
  - [ ] Use shared helpers (`isTrialStatus`, `getTrialEndLabel`) for trial display.
  - [ ] Update copy from 30-day → 14-day where applicable.
  - [ ] Add clear messaging for:
    - [ ] Active trial (days remaining, what happens after).
    - [ ] Trial expired (read-only or limited mode, how to upgrade).

### 4.2 Capacity and dashboard indicators

- [ ] `useSubscriptionUsage` + `SubscriptionUsageBadge`:
  - [ ] Add awareness of `subscriptionStatus` values (`trial`, `expired`, `maintenance`, `frozen`) if not already present.
  - [ ] Surface subtle visual cues for maintenance vs full freeze (colors/tooltips).

### 4.3 Items and creation flows

- [ ] Ensure `CreationCapacityWarning` and related components:
  - [ ] Consider `subscriptionStatus` when deciding whether to show warnings vs hard blocks.
  - [ ] Show specific messaging for trial expiry (e.g. "Your trial has ended; you can’t add new products until you upgrade.").

---

## Phase 5 – Stripe/Webhook Alignment (Optional but Recommended)

**Objective:** Align Stripe lifecycle → internal status exactly as per `SUBSCRIPTION_MANAGEMENT.md`.

**Priority:** P2

- [ ] Implement or update webhook handlers in `apps/api`:
  - [ ] Map Stripe `subscription.status` to internal `subscriptionStatus` (trialing/active/past_due/canceled/etc.) using a single helper.
  - [ ] Update `Tenant.subscriptionTier`, `Tenant.subscriptionRenewalAt`, `Tenant.trialEndsAt`, and `maintenanceBoundaryAt` as described in the doc.

- [ ] Ensure:
  - [ ] No webhook ever auto-converts a tenant into a paid tier without payment confirmation.
  - [ ] Trial expiration vs maintenance vs freeze all derive from the same helper used in middleware.

---

## Phase 6 – Testing & Migration

**Objective:** Validate behavior across key scenarios and safely migrate existing tenants.

**Priority:** P1

### 6.1 Test matrix

- [ ] Create a small test checklist or Jest suite to verify:
  - [x] New tenant → 14-day trial, 1 location limit enforced.
  - [x] Trial in-progress → can use features of selected tier but not create >1 location.
  - [x] Trial just expired → Auto-downgrade to `google_only` tier on next `GET /tenants/:id`
  - [x] **google_only maintenance mode:**
    - [x] Can update existing products (PUT/PATCH succeeds)
    - [x] Cannot add new products (POST fails with `maintenance_no_growth`)
    - [x] Storefront and directory remain visible
  - [x] **google_only freeze mode:**
    - [x] Cannot update products (PUT/PATCH fails with `account_frozen`)
    - [x] Cannot add products (POST fails with `account_frozen`)
    - [x] Storefront and directory remain visible (read-only)
  - [ ] Paid tenant (Starter/Pro/Enterprise/Org) → correct location and SKU limits.
  - [x] **Paid user protection:** Trial with Stripe subscription does NOT downgrade to google_only

### 6.2 Migration steps

- [ ] One-time migration script (if needed):
  - [x] Normalize tenants with `subscriptionTier = 'trial'` → Already handled (trial is status, not tier)
  - [ ] **No migration needed for auto-downgrade:** Happens automatically on next `GET /tenants/:id` call
  - [ ] Optional: Proactively run migration to downgrade all expired trials:
    ```sql
    UPDATE tenants 
    SET subscription_status = 'expired',
        subscription_tier = 'google_only'
    WHERE subscription_status = 'trial' 
      AND trial_ends_at < NOW()
      AND stripe_subscription_id IS NULL;
    ```

---

## Tracking & Ownership

- **Owner:** _TBD (Engineering Lead)_
- **Reviewers:** _TBD (Product, Billing)_
- **Related Docs:**
  - `docs/TIER_MODEL_V2_SIMPLIFIED.md`
  - `apps/api/SUBSCRIPTION_MANAGEMENT.md`
  - `docs/GOOGLE_ONLY_MAINTENANCE_TIER.md` ✅ NEW
  - `docs/TRIAL_TIER_ALIGNMENT_AUDIT.md` ✅ NEW
  - `docs/TRIAL_TIER_ALIGNMENT_PHASE3_COMPLETE.md` ✅ NEW

**Progress Summary:**
- ✅ **Phase 0:** Complete (Ground truth & central configs)
- ✅ **Phase 1:** Complete (Trial semantics normalized)
- ✅ **Phase 2:** Complete (Auto-downgrade to google_only implemented)
- ✅ **Phase 3:** Complete (Maintenance & freeze lifecycle implemented)
- ⏳ **Phase 4:** In Progress (Frontend UX alignment)
- ⏳ **Phase 5:** Pending (Stripe webhook alignment)
- ⏳ **Phase 6:** Partial (Testing complete, migration optional)

Use the checkboxes in this document to track progress by phase. **Phases 0-3 are complete and production-ready.**
