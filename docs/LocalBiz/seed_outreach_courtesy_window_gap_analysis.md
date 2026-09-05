# Gap Analysis: Seed Outreach Courtesy Window Sprint Plan

**Reviewed spec:** `docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md`
**Date:** 2026-09-04
**Method:** Four parallel code-verification tracks against the live repository — outreach trigger integration points, schema/migration/tier claims, frontend claims, and cross-cutting concerns/edge cases. Every claim in the spec was checked against actual file paths, line numbers, type definitions, and runtime behavior.

---

## Summary Verdict

The spec is well-structured and the core design (publish → link → trigger → log → state) is sound. However, there are **3 critical blockers** that must be resolved before implementation, **7 high-severity gaps** that will cause runtime failures or silent data corruption, **10 medium gaps** that will cause friction or require unplanned work, and **4 internal contradictions** left over from the product-slot correction that must be cleaned up.

**Recommendation: NO-GO for implementation until the 3 critical blockers are resolved.** The high-severity gaps can be resolved during implementation but must be tracked as explicit tasks.

---

## 1. Critical Blockers (must resolve before sprint)

### C1. Product creation route is public and unauthenticated — Phase E is unsafe

**Severity:** CRITICAL (security)
**Spec claim:** §5.5 — "The existing `max_skus` enforcement works as-is — it just reads 5 instead of 0 from the tier row."
**Reality:** The primary product-creation route `POST /items` does NOT enforce SKU limits at all.

`apps/api/src/routes/inline-items-crud.ts:1194` registers `POST /items` with only `requireWritableSubscription`, which checks subscription *status* but:
- Does **not** authenticate the caller (no `authenticateToken`, no `checkTenantAccess`)
- Does **not** call `validateSKULimits`
- Is registered as `authLevel: 'public'` in `routeRegistry.ts:1591-1598`

`apps/api/src/middleware/subscription.ts:287-302` — `requireWritableSubscription` only checks that a tenant exists and has an active subscription. It does not verify the caller is a member of that tenant.

Additionally, `apps/web/src/app/tenant/[id]/page.tsx:696` has a dead storefront gate:
```ts
if (tenant.access && !tenant.access.storefront) {
```
But `PublicTenantInfo` (`apps/web/src/services/TenantPublicService.ts:39-62`) has no `access` field, so this condition is always falsy and products render regardless.

**Impact:** Changing `max_skus` from 0 to 5 without fixing this means:
- Anyone can create unlimited products against any tenant ID (no auth)
- The 5-slot limit is not enforced on the primary creation path
- Unclaimed seed tenants (which have an active `directory_seed` subscription) could have products created against them by anonymous callers

**Required amendment:** Phase E must add a prerequisite task:
1. Add `authenticateToken` + `checkTenantAccess` (or `requireTenantAdmin`) to `POST /items` in `inline-items-crud.ts`
2. Add `validateSKULimits` to the `inline-items-crud` route
3. Fix the storefront gate in `tenant/[id]/page.tsx` to use `publicUnifiedCapabilityService.getStorefrontState` instead of the non-existent `tenant.access`
4. Only then change `max_skus` to 5

**Spec section to amend:** §5.5 "Current state" table and §10 Phase E task list.

---

### C2. `ContactOutcome` type is missing all three new outcomes the spec requires

**Severity:** CRITICAL (runtime failure)
**Spec claim:** §3.1, §7.1, §7.3 use `seed_outreach_scheduled`, `freshness_verified`, `freshness_failed` as `ContactOutcome` values.
**Reality:** None of these exist in the type or the Zod enum.

`apps/api/src/services/MarketingOutreachService.ts:27`:
```ts
export type ContactOutcome = 'reached' | 'no_answer' | 'left_message' | 'interested' | 'not_interested' | 'callback_scheduled' | 'other' | 'auto_follow_up_scheduled' | 'wrong_number' | 'disconnected_number';
```

`apps/api/src/routes/marketing-ops.ts:323`:
```ts
const contactOutcomeEnum = z.enum(['reached', 'no_answer', 'left_message', 'interested', 'not_interested', 'callback_scheduled', 'other', 'auto_follow_up_scheduled', 'wrong_number', 'disconnected_number']);
```

**Impact:** `SeedOutreachTriggerService.onSeedCreated` will throw when calling `logContact` with `outcome: 'seed_outreach_scheduled'` because the Zod schema in the route rejects it (though `logContact` itself doesn't validate — the route does). More critically, `SeedOutreachStateSync` cannot map to `freshness_verified` or `freshness_failed` because there's no way to log these outcomes.

**Required amendment:** Add a Phase A task:
- Extend `ContactOutcome` union with `'seed_outreach_scheduled'`, `'freshness_verified'`, `'freshness_failed'`
- Extend `contactOutcomeEnum` Zod schema in `marketing-ops.ts:323` with the same values
- Update `CONTACT_RESULT_TO_OUTCOME` (`marketing-ops.ts:347-370`) to route `closed_permanently → 'freshness_failed'` and `wrong_location → 'freshness_failed'` (currently routes to `disconnected_number` and `wrong_number` respectively)
- Update `MarketingAutoFollowUpScheduler.NO_RESPONSE_OUTCOMES` (`MarketingAutoFollowUpScheduler.ts:24`) to include `'seed_outreach_scheduled'` if follow-up cadence should apply

**Spec section to amend:** §4.1 "What exists" table (the claim that `ContactOutcome` includes `closed_permanently`/`wrong_location` is FALSE — those are `CallResult` values, not `ContactOutcome` values), §7.1, §7.3, §10 Phase A task list.

---

### C3. `CallDetails` is a closed typed interface — the idempotency marker will be silently stripped

**Severity:** CRITICAL (silent data loss / idempotency failure)
**Spec claim:** §6.2 — "The `mkt_outreach_log.call_details` JSON gains a convention: `{ seed_outreach: true, seed_id, claim_url, ... }`"
**Reality:** The `CallDetails` TypeScript interface and the `callDetailsSchema` Zod schema are both closed objects. Unknown keys are stripped by Zod at the route layer.

`apps/api/src/services/MarketingOutreachService.ts:66-85` — `CallDetails` interface has 15 typed fields, no index signature.
`apps/api/src/routes/marketing-ops.ts:381-396` — `callDetailsSchema` is `z.object({...})` without `.passthrough()`.
`apps/web/src/services/MarketingOpsService.ts:513-528` — frontend `CallDetails` is also closed.

**Impact:**
- The `seed_outreach: true` idempotency marker will be stripped by Zod validation when the operator logs a contact via `POST /:id/outreach`
- The trigger's `logContact` call bypasses the route Zod (calls the service directly), so the marker *will* be persisted on the trigger path — but if the operator ever edits the log via the route, the marker is lost
- `profile_quality_findings` (§16.5) will be stripped on any route-validated write
- TypeScript will error on `callDetails: { seed_outreach: true }` because the field doesn't exist on the interface

**Required amendment:** Add a Phase A task:
- Add `seed_outreach?: boolean`, `seed_id?: string`, `claim_url?: string`, `place_url?: string`, `hook_angle?: string`, `trigger_source?: string`, `profile_quality_findings?: Array<{ signal: string; severity: string; label: string }>` to the `CallDetails` interface
- Add the same fields to `callDetailsSchema` in `marketing-ops.ts` (or add `.passthrough()` if arbitrary keys are desired)
- Update the frontend `CallDetails` interface in `MarketingOpsService.ts`

**Spec section to amend:** §6.2, §10 Phase A task list, §14 "Modified" file list (add `MarketingOutreachService.ts` and `MarketingOpsService.ts`).

---

## 2. High-Severity Gaps (will cause runtime failures or data corruption)

### H1. `resolveClaimUrl` is private — `SeedOutreachTriggerService` cannot call it

**Spec claim:** §7.1 step 4 — "Resolve claim URL via `HookSuggestionService.resolveClaimUrl`"
**Reality:** `apps/api/src/services/HookSuggestionService.ts:346` — method is `private`. No public wrapper exists. The `suggestForCampaign` response does not include a top-level `claimUrl` field.

**Required amendment:** Either make `resolveClaimUrl` public, or add a public wrapper method `getClaimUrlForCampaign(campaignId, ctx)`. Add this as a Phase A task. The spec should specify which approach.

---

### H2. No transaction boundary on `createFromCampaign` — partial failure leaves orphaned seeds

**Spec claim:** §4.3 — the trigger fires after `linkCampaign` returns, fire-and-forget.
**Reality:** `createFromCampaign` (`DirectoryPresenceSeedService.ts:1666-1672`) runs `createSeed` → `publishSeed` → `linkCampaign` as three independent operations with no transaction. `linkCampaign` can throw (`seed_not_found`, `campaign_not_found`, `primary_link_already_exists`).

If `linkCampaign` throws:
- The seed and published listing already exist
- No campaign link exists
- The trigger (which fires after `linkCampaign`) never runs
- A retry returns `created: false` (existing link check at line 1523) and skips everything

If the trigger partially succeeds (`logContact` succeeds, `setOutreachState` fails):
- The outreach log exists with `seed_outreach: true`
- The seed's `outreach_state` is still `not_started`
- A retry of `createFromCampaign` returns `created: false` and skips the trigger
- The seed is permanently stuck in `not_started` despite having an outreach log

**Required amendment:**
- Wrap `createSeed` + `publishSeed` + `linkCampaign` in `prisma.$transaction` (or make `createFromCampaign` idempotent so a retry can attach the link without creating a second seed)
- Make `SeedOutreachTriggerService.onSeedCreated` atomic: insert the outreach log AND update `outreach_state` in a single transaction
- Add a reconciliation path: if a seed has a `seed_outreach: true` log but `outreach_state = 'not_started'`, a startup sweep or manual admin action can sync the state

**Spec section to amend:** §4.3, §7.1, §10 Phase A.

---

### H3. Campaign stage filtering — seeds from `seek`/`audit_identified` campaigns are invisible to the scheduler

**Spec claim:** §5.2 — the no-response job checks `outreach_scheduled` seeds. The auto-follow-up scheduler is listed as existing infrastructure.
**Reality:** `MarketingAutoFollowUpScheduler.run` (`MarketingAutoFollowUpScheduler.ts:56-71`) only selects campaigns with `stage: { in: ['preview_built', 'shown'] }`. `getFollowUpsDue` (`MarketingOutreachService.ts:437-439`) applies the same filter. `createFromCampaign` (`DirectoryPresenceSeedService.ts:1475-1479`) does **not** check `campaign.stage`.

If a seed is created from a campaign in `seek` or `audit_identified` stage:
- The trigger fires and logs outreach
- The auto-follow-up scheduler never visits this campaign
- The no-response job (which queries `directory_presence_seeds` directly, not campaigns) would still work
- But any follow-up cadence configured on the campaign is dead

**Required amendment:** Either:
- (a) Restrict `createFromCampaign` to `preview_built`/`shown` stages (add a stage check), OR
- (b) Extend the scheduler/dashboard queries to include `seek`/`audit_identified` for seed-linked campaigns, OR
- (c) Document that seeds from early-stage campaigns have outreach logged but no auto-follow-up cadence (acceptable if the operator manually drives the outreach)

**Spec section to amend:** §4.1, §5.2, §15 (new open question).

---

### H4. `POST /:id/outreach` has no post-log hook point — `SeedOutreachStateSync` wiring is ambiguous

**Spec claim:** §7.3 — "the existing `POST /:id/outreach` handler gains a post-log side-effect"
**Reality:** `apps/api/src/routes/marketing-ops.ts:1281-1305` calls `logContact` and immediately returns `201`. There is no hook point.

If `SeedOutreachStateSync.syncFromLog` is added **inside the try block before `res.status(201)`**:
- Its errors become route errors (the operator gets 500 instead of 201)
- This violates the "thin post-log hook" design

If added **after `res.status(201)`** (fire-and-forget):
- It cannot affect the response
- But Express may close the connection and kill the async work before it completes

**Required amendment:** Specify the exact wiring:
- Option A: `logContact` itself calls `SeedOutreachStateSync` internally (service-layer hook, route unchanged) — but this couples `MarketingOutreachService` to seed state
- Option B: The route awaits `syncFromLog` but catches its errors separately (try/catch around sync, log warning, still return 201)
- Option C: Fire-and-forget with `setImmediate` or `process.nextTick` to ensure the response completes first

Recommend Option B: the route awaits `syncFromLog` in a separate try/catch after `logContact` succeeds, logs failures, and always returns 201.

**Spec section to amend:** §7.3.

---

### H5. Sibling campaign idempotency — per-seed state vs. per-campaign log creates orphaned seeds

**Spec claim:** §15 open question #5 — "outreach_state is per-seed; the outreach log is per-campaign. Subsequent sibling seeds find the existing log and skip (idempotency by campaign ID)."
**Reality:** This means sibling seeds (multi-archetype campaigns) never get `outreach_state = 'outreach_scheduled'`. They stay `not_started` forever. The operator dashboard's "Awaiting Outreach" queue will only show the first seed of a sibling group.

This is a design inconsistency, not just an open question. If the outreach log is per-campaign and idempotency is by campaign ID, then only one seed per campaign gets `outreach_scheduled`. The other siblings have no outreach state and no courtesy window tracking.

**Required amendment:** Resolve the open question with one of:
- (a) Per-seed outreach logs (each `createFromCampaign` call logs a separate outreach contact with `seed_id` in `call_details`) — idempotency by `(campaign_id, seed_id)` pair
- (b) Per-campaign log with all sibling seeds updated to `outreach_scheduled` when the first seed triggers
- (c) Document that sibling seeds share the campaign's outreach state and the per-seed `outreach_state` is only set for the primary seed

Recommend (a): per-seed logs with `seed_id` in `call_details`. The `seed_outreach: true` idempotency check should be `call_details->>'seed_id' = $1` not just `call_details->>'seed_outreach' = 'true'`.

**Spec section to amend:** §6.2, §7.1, §15 #5.

---

### H6. `directory_presence` tier lacks `product_options_*` capability keys — 5 SKUs may be creatable but not visible

**Spec claim:** §5.5 — "5 product slots... enough to list signature products and see the storefront surface"
**Reality:** `apps/web/src/lib/tiers/tier-features.ts:11-21` — `directory_presence` has `storefront_enabled` and `storefront_retail` but does **not** have:
- `storefront_opt_*` keys (needed for storefront options per `StorefrontOptionsResolver.ts:27-28`)
- `product_options_*` keys (needed for product catalog surfaces per `CapabilityResolutionService.ts:1610-1645`)

Changing `max_skus` to 5 allows SKU *creation* (if the route is secured — see C1), but the storefront product browsing surface won't render product options or a full catalog experience. The owner may be able to create products in the admin dashboard but customers won't see them in a browsable storefront.

**Required amendment:** Phase E must either:
- (a) Add `product_options_enabled` (or a `*_flexible` key) to the `directory_presence` tier feature set so the product surface renders, OR
- (b) Document that the 5 slots are admin-dashboard-only (owner can manage products but the public storefront doesn't show them until upgrade), OR
- (c) Scope Phase E to only the upgrade *motivation* (the limit itself) and defer the storefront surface to a follow-on sprint

Recommend (b) or (c): the 5-slot teaser is about the *limit* and the upgrade prompt, not about a full storefront experience. The claim success screen can say "You can now list up to 5 products" without requiring the storefront to render them publicly.

**Spec section to amend:** §5.5, §10 Phase E.

---

### H7. Audit trail is lossy — `directory_presence_seed` entity type is not recognized

**Spec claim:** §7.2 — `setOutreachState` calls `audit()` with `action: 'directory_presence_seed.outreach_state_change'`
**Reality:** `apps/api/src/audit.ts:22-34` collapses any action string to one of 7 enum values (`create`, `update`, `delete`, `sync`, `policyApply`, `oauthConnect`, `oauthRefresh`). `outreach_state_change` contains `change` but not `create`/`update`/`delete`/`sync`, so it falls through to the default `update`.

`apps/api/src/audit.ts:38-42` — `entity_type` is overwritten to `'other'` if not in the allow-list. `directory_presence_seed` is not in the allow-list.

`apps/api/src/routes/audit.ts:12` — the audit query route only lets operators filter by `inventory_item`, `tenant`, `policy`, `oauth`, `other`.

**Impact:** Outreach state changes will be logged as `action: 'update'`, `entity_type: 'other'`. The original action string and entity type are lost. Operators cannot filter the audit log for seed outreach state changes.

**Required amendment:** Either:
- (a) Add `directory_presence_seed` to the `validEntityTypes` allow-list in `audit.ts` and to the `entityType` Zod enum in `routes/audit.ts`, OR
- (b) Store the original action string in `metadata.action` (which is preserved) and document that operators query `metadata` for specific action types, OR
- (c) Accept the lossy mapping and document it as a known limitation

Recommend (b): the metadata is already preserved, so the original action is recoverable. Adding entity types to the allow-list is a separate concern.

**Spec section to amend:** §7.2, §9 (audit dependency).

---

## 3. Medium-Severity Gaps

### M1. `ENTRY_PRESENCE_MODES` is module-private, not exported

**Spec claim:** §8.5 — "the teaser page can render from a static copy of the same metadata"
**Reality:** `apps/api/src/services/DirectoryPresenceUpgradeOptionsService.ts:23` — `const ENTRY_PRESENCE_MODES` (no `export`). The spec's plan to "copy this metadata" requires either adding `export` or duplicating the values in the frontend.

**Required amendment:** Either export the constant or duplicate the 3 mode entries as a static frontend constant. The spec should specify which. If duplicating, add a comment in both files noting the sync requirement.

---

### M2. `PoweredByFooter` has no link prop — and is used on inappropriate surfaces

**Spec claim:** §8.6 — "Add a 'For Business Owners' link to the footer link row"
**Reality:** `apps/web/src/components/PoweredByFooter.tsx:6` — accepts only `{ note?: string }`. Links are hardcoded. Used on 25 surfaces including:
- `app/carts/page.tsx` (checkout flow — inappropriate for a business-owner CTA)
- `app/my-orders/BuyerOrderHistory.tsx` (post-purchase — inappropriate)
- `app/shops/[slug]/ShopProfileClient.tsx` (tenant storefront — may be off-brand)

**Required amendment:**
- Add a `showBusinessOwnersLink?: boolean` prop (default `true`) so cart/checkout/order surfaces can opt out
- Or create a separate `DirectoryPoweredByFooter` variant for public directory surfaces only
- Update the spec's §8.6 to specify the prop-based approach and list the surfaces that should set `showBusinessOwnersLink={false}`

---

### M3. `/place/about` slug reservation — listings with slug "about" become unreachable

**Spec claim:** §8.5 — "New page: `/place/about`"
**Reality:** Next.js App Router static segments take precedence over dynamic `[slug]` segments. A listing whose slug is `about` would be shadowed by the static `/place/about` page and become unreachable.

**Required amendment:** Add `about` (and any other reserved static segments like `claim`, `search`, `category`, `city`) to the directory slug validation/blacklist so no listing can claim those slugs. Check `apps/web/src/utils/slug.ts` for existing slug validation and extend it.

**Spec section to amend:** §8.5, §10 Phase D1.

---

### M4. Claim success screen path is wrong in the spec

**Spec claim:** §5.5, §10 E5, §14 — references `apps/web/src/app/directory/claim/[token]/`
**Reality:** `apps/web/src/app/directory/claim/[token]/page.tsx` is a redirect to `/place/claim/[token]`. The actual claim UI is in `DirectoryClaimClient.tsx` (shared by both paths). The real page is `apps/web/src/app/place/claim/[token]/page.tsx`.

The claim success screen renders `ClaimUpgradeTeaser` at `DirectoryClaimClient.tsx:642`. The `MODE_UNLOCK_COPY` map (`DirectoryClaimClient.tsx:902-909`) has no "5 products" message. The backend `DirectoryPresenceUpgradeOptionsService` does not expose `max_skus` in the upgrade payload.

**Required amendment:**
- Update the spec's file references from `/directory/claim/[token]/` to `/place/claim/[token]/` (or note both paths share `DirectoryClaimClient.tsx`)
- Add a task to either expose `max_skus` in `UpgradeOptionsPayload` or hardcode the "5 products" copy in `MODE_UNLOCK_COPY`
- Note that `FALLBACK_PRESENCE_MODES` (`DirectoryClaimClient.tsx:854-897`) is the frontend fallback, not `ENTRY_PRESENCE_MODES`

---

### M5. `canAddSKUs` from `lib/tiers.ts` is unused — the spec's test references the wrong function

**Spec claim:** §11.3b — tests `getSKULimit('directory_presence')` and `canAddSKUs('directory_presence', ...)`
**Reality:** `apps/web/src/lib/tiers.ts:463-467` — `canAddSKUs` is defined but not imported anywhere. Active frontend SKU gating uses `useTierSystem` (`hooks/useTierSystem.ts:201`) and `useSubscriptionUsage` (`hooks/useSubscriptionUsage.ts:107-127`), which read from the dynamic tier system.

On the backend, `TierService.getTierSKULimit` (`TierService.ts:202-212`) reads `max_skus` from the DB tier row and falls back to `500` (not 0) if the row is missing or null. The `TIER_LIMITS.directory_presence.maxSkus = 0` constant is only used as a fallback in `sku-limits.ts:83` if `TierService.getTierSKULimit` *rejects*.

**Required amendment:**
- Update §11.3b tests to target `TierService.getTierSKULimit('directory_presence')` (the actual runtime path), not `getSKULimit` from `tier-limits.ts`
- Note that `TierService.clearTierCache` (`TierService.ts:285-289`) must be called after the migration to ensure the cache doesn't serve the old value
- Update §5.5 "Current state" table to reference `sku-limits.ts:82-88` (the actual `currentCount + toAdd` check), not `organization-validation.ts` lines 87/106/178

---

### M6. `organization-validation.ts` line references are wrong

**Spec claim:** §5.5 — "Enforced by `organization-validation.ts` middleware (lines 87, 106, 178) — blocks product creation when `currentCount + toAdd > max_skus`"
**Reality:** `organization-validation.ts` does org-level `maxTotalSKUs > limits.maxTotalSKUs` checks (lines 103, 194). The `currentCount + toAdd` check is in `apps/api/src/middleware/sku-limits.ts:82-88`.

**Required amendment:** Update §5.5 "Current state" table to reference `sku-limits.ts:82-88` for the per-tenant SKU creation check and `organization-validation.ts:103, 194` for the org-level aggregate check.

---

### M7. `unifiedConfig` has no seed-outreach getters

**Spec claim:** §6.3 — three new env vars in `unifiedConfig.ts`
**Reality:** `apps/api/src/config/unifiedConfig.ts:134-205` has marketing-ops getters but no `SEED_OUTREACH*` keys. No matches found anywhere in `apps/api` except the spec itself.

**Required amendment:** This is already in the spec's task list (Phase A5) but the spec should note the pattern to follow: `marketingOpsAutoFollowUpCadenceDays` getter at `unifiedConfig.ts:134-205`. Add the three getters following the same ad-hoc parsing pattern.

---

### M8. `BusinessAnalysisAuditCard.handleAddToPlace` shows inline success only

**Spec claim:** §8.3 — "show a success banner"
**Reality:** `apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx:235-246` renders a small green `<p>` with a link. No banner, no toast, no `GlobalAlertProvider`.

**Required amendment:** The spec's Phase C3 should specify whether the existing inline message is sufficient or a true banner/toast is needed. If a banner is needed, add a task to implement it (the current inline message may be adequate).

---

### M9. `directory_presence_seeds` column list in spec is incomplete

**Spec claim:** §6.1 implies the seed table has a limited set of columns.
**Reality:** The full model (`schema.prisma:1828-1867`) has 20+ columns including `category`, `city`, `state`, `seed_batch`, `identity_confidence`, `category_fit`, `notes`, `created_at`, `updated_at`, `claimed_at`, `outreach_status`, `outreach_notes`, `seek_batch_id`, `seo_enrichment`.

Not blocking, but the spec should acknowledge the full model. The existing `outreach_status` column (default `'unverified'`) is particularly relevant — the spec introduces a new `outreach_state` column alongside it. The relationship between `outreach_status` (existing) and `outreach_state` (new) should be documented: are they redundant? Does `outreach_state` supersede `outreach_status`? Should `updateOutreachStatus` (line 1386) be deprecated?

**Required amendment:** Add a note in §6.1 clarifying the relationship between `outreach_status` (existing, 7-value whitelist) and `outreach_state` (new, 8-value state machine). Recommend either deprecating `outreach_status` or documenting that `outreach_state` is the courtesy-window-specific state while `outreach_status` tracks the broader verification/enrichment lifecycle.

---

### M10. Migration files are gitignored — cannot verify migration 256 is latest

**Spec claim:** §metadata — "Latest applied migration: `256_prospect_queue_constraint_sync.sql`"
**Reality:** `database/migrations/*.sql` files are gitignored. The repository only contains `README.md` and `041_extract_metadata_to_columns_instructions.md`. Cannot verify migration 256 from the checkout.

**Required amendment:** Before starting the sprint, verify the actual latest migration number by checking the local `database/migrations/` directory on disk or querying the applied migrations in the target DB. Update the spec's metadata block if the number is different.

---

## 4. Internal Contradictions (leftover from product-slot correction)

### X1. Migration 257 SQL comment contradicts §5.5

**Location:** §6.1, lines 280-284 of the spec:
```sql
-- Phase E: allocate 5 product slots to claimed directory_presence tenants.
-- The tier row changes from max_skus = 0 to max_skus = 5. The claim-gate
-- (org_standing_mode = 'directory_seed' → 0, 'independent' → 5) is enforced
-- in application code (tier-limits.ts getSKULimit), not at the DB level —
-- the DB row is the claimed value (5), the common case.
```

**Contradicts:** §5.5 (lines 203-212) which says "No claim-gate needed — authentication is the natural gate" and "No `orgStandingMode` parameter threading through `getSKULimit`".

**Required amendment:** Remove the stale comment. Replace with:
```sql
-- Phase E: allocate 5 product slots to the directory_presence tier.
-- The tier row changes from max_skus = 0 to max_skus = 5. No claim-gate
-- override is needed — unclaimed seeds have no owner account to list
-- products, so authentication is the natural gate. See §5.5.
```

---

### X2. §4.1 claims `ContactOutcome` includes `closed_permanently` and `wrong_location`

**Location:** §4.1, line 113:
> `ContactOutcome` / `CallResult` types (include `closed_permanently`, `wrong_location`, `disconnected_number`) — Exists

**Reality:** `ContactOutcome` does NOT include `closed_permanently` or `wrong_location`. Those are `CallResult` values. `CONTACT_RESULT_TO_OUTCOME` (`marketing-ops.ts:347-370`) maps:
- `closed_permanently → 'disconnected_number'`
- `wrong_location → 'wrong_number'`

So the spec's §7.3 mapping table entry "Any `ContactResult` of `closed_permanently` / `wrong_location` → `freshness_failed`" is impossible as written — these `CallResult` values get mapped to `disconnected_number`/`wrong_number` *before* the outcome reaches the seed state sync.

**Required amendment:**
- Fix §4.1 to distinguish `ContactOutcome` (does not include these) from `CallResult` (does)
- Fix §7.3 to either:
  - (a) Update `CONTACT_RESULT_TO_OUTCOME` to map `closed_permanently → 'freshness_failed'` and `wrong_location → 'freshness_failed'` (intercepting before the existing mapping), OR
  - (b) Map `disconnected_number → freshness_failed` and `wrong_number → freshness_failed` in the seed state sync (since those are the outcomes that result from the call results)

Recommend (b): the seed state sync intercepts at the outcome level, not the call-result level. `disconnected_number` and `wrong_number` outcomes on a seed-linked campaign → `freshness_failed`.

---

### X3. Open question #5 contradicts the per-seed state machine

**Location:** §15 #5:
> "outreach_state is per-seed; the outreach log is per-campaign. Subsequent sibling seeds find the existing log and skip (idempotency by campaign ID)."

**Contradicts:** §3.2 state machine which implies every seed from `createFromCampaign` enters `outreach_scheduled`. If sibling seeds skip the trigger, they stay `not_started` — they never enter the courtesy window.

**Required amendment:** See H5 above. Resolve the open question and update §3.2, §6.2, §7.1 consistently.

---

### X4. §5.5 says "No changes to... any SKU enforcement middleware" but Phase E requires route security changes

**Location:** §5.5, line 232:
> "No changes to `getSKULimit` signature, `organization-validation.ts`, or any SKU enforcement middleware."

**Reality:** See C1 — `POST /items` needs `authenticateToken`, `checkTenantAccess`, and `validateSKULimits` added. This is a change to SKU enforcement middleware (`inline-items-crud.ts` route + `sku-limits.ts` middleware mounting).

**Required amendment:** Update §5.5 to acknowledge the prerequisite security fixes. The "no changes" claim is only true for the *tier constant* and *tier row* — the route security fixes are a separate prerequisite.

---

## 5. Low-Severity Gaps / Optional Enhancements

### L1. `/directory/about` already exists — positioning overlap with `/place/about`

`apps/web/src/app/directory/about/page.tsx` is a public "How It Works | Store Directory" page. The spec's `/place/about` teaser creates a second public "about" page. They serve different audiences (directory-about is customer-facing, place-about is owner-facing) but the naming overlap may confuse users.

**Recommendation:** Consider `/place/owners` or `/owners` instead of `/place/about` to avoid the overlap. The spec already lists this as open question #7.

---

### L2. No-response job only checks `outreach_scheduled` — stale `owner_contacted` seeds are never marked

The spec's job pseudocode (§7.5) only queries `outreach_state = 'outreach_scheduled'`. A seed where the operator logged one contact (`owner_contacted`) but then went silent is never marked `no_response`.

**Recommendation:** Either extend the job to also check `owner_contacted` seeds whose last outreach log is older than the threshold, or document that `no_response` only applies to seeds where the operator never made contact.

---

### L3. `logContact` is not stage-gated — outreach can be logged on campaigns in any stage

`MarketingOutreachService.logContact` (`MarketingOutreachService.ts:160-190`) accepts campaigns in any stage. It records `stage_at_time` but does not reject early-stage campaigns.

**Recommendation:** If the courtesy window should only apply to `preview_built`/`shown` campaigns, add a stage check in `SeedOutreachTriggerService.onSeedCreated` (not in `logContact` itself, since operators may legitimately log contacts on early-stage campaigns).

---

### L4. `suggestForCampaign` returns an array, not a single top hook

The spec's §7.1 step 5 says "Resolve top hook via `HookSuggestionService.suggestForCampaign`". The method returns `HookSuggestionResult` with a `suggestions: RankedHook[]` array. The top hook is `suggestions[0]`. The spec should note this explicitly to avoid implementation confusion.

---

## 6. Recommended Go/No-Go Checklist

Before starting implementation, the following must be resolved:

### Must resolve (blockers)
- [ ] **C1:** Add authentication + tenant access + SKU limit enforcement to `POST /items` route
- [ ] **C2:** Add `seed_outreach_scheduled`, `freshness_verified`, `freshness_failed` to `ContactOutcome` and `contactOutcomeEnum`
- [ ] **C3:** Extend `CallDetails` interface and `callDetailsSchema` with seed-outreach fields
- [ ] **H1:** Make `resolveClaimUrl` public or add a public wrapper
- [ ] **H5:** Resolve sibling campaign idempotency (per-seed vs per-campaign log)

### Must document (design decisions)
- [ ] **H2:** Specify transaction boundary for `createFromCampaign` + trigger
- [ ] **H3:** Decide whether `createFromCampaign` should restrict campaign stage
- [ ] **H4:** Specify exact wiring for `SeedOutreachStateSync` in the outreach route
- [ ] **H6:** Decide whether Phase E needs `product_options_*` capability keys or is admin-only
- [ ] **X1:** Remove stale claim-gate comment from Migration 257 SQL
- [ ] **X2:** Fix `ContactOutcome` vs `CallResult` conflation in §4.1 and §7.3
- [ ] **X4:** Acknowledge route security prerequisite in §5.5

### Must verify (environment)
- [ ] **M10:** Verify actual latest migration number on disk
- [ ] **M5:** Verify `directory_presence` row in `subscription_tiers_list` has `max_skus = 0` in the target DB
- [ ] Confirm `TierService.clearTierCache` is called after migration 257 applies

### Should update (spec hygiene)
- [ ] **M1:** Specify whether to export `ENTRY_PRESENCE_MODES` or duplicate it
- [ ] **M2:** Specify `PoweredByFooter` prop approach and opt-out surfaces
- [ ] **M3:** Add `about` to slug blacklist
- [ ] **M4:** Fix claim success screen path references
- [ ] **M6:** Fix `organization-validation.ts` line references
- [ ] **M9:** Document `outreach_status` vs `outreach_state` relationship
- [ ] **L1:** Resolve `/place/about` vs `/owners` route decision

---

## 7. Verification Commands (post-implementation)

Per `AGENTS.md` conventions:

```powershell
# After schema changes
pnpm prisma:generate
doppler run --config local -- pnpm prisma db pull

# Typecheck
pnpm checkapi
pnpm checkweb

# After migration applies
doppler run --config local -- pnpm prisma db pull
doppler run --config local -- pnpm prisma generate

# Tests
pnpm --filter api test -- --testPathPattern="SeedOutreach"
pnpm --filter api test -- --testPathPattern="directory-presence-admin"
pnpm --filter api test -- --testPathPattern="marketing-ops-outreach"
pnpm --filter api test -- --testPathPattern="seed-outreach-no-response"
pnpm --filter api test -- --testPathPattern="tier-limits"
```

Manual frontend verification per §11.4 of the spec, with additional checks:
- Verify `POST /items` rejects unauthenticated requests after the security fix
- Verify a claimed `directory_presence` tenant can create exactly 5 products (not 6)
- Verify an unclaimed seed tenant cannot create products (no account to authenticate with)
- Verify the storefront gate in `tenant/[id]/page.tsx` respects capability state after the fix
