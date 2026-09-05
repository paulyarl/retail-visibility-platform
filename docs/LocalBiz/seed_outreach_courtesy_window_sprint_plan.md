# Sprint Plan: Seed Outreach Courtesy Window

> Campaign-aware outreach trigger that gives the business owner a first crack at claiming their listing before SEO propagation surfaces it to the broader public — using the natural indexing lag as a courtesy window, not a hard gate.

**Status:** Reviewed — gaps closed, ready for implementation
**Date:** 2026-09-04
**Prerequisite:** `docs/LocalBiz/PLACE_SEED_SEO_ENRICHMENT_SPEC.md` (Phase 1 landed — `createFromCampaign` produces SEO-enriched seeds with `public_narrative`, `description`, `keywords`, `sameAs`, `seo_enrichment` JSON)
**Branch context:** `feature/seed-outreach-courtesy-window`
**Gap analysis:** `docs/LocalBiz/seed_outreach_courtesy_window_gap_analysis.md`

**Latest applied migration:** `256_prospect_queue_constraint_sync.sql` (verify on disk before starting — migration `.sql` files are gitignored)
**Next migration numbers:** `257`

---

## 1. Problem

When an operator clicks "Add to Place Listing" from the audit tab, `DirectoryPresenceSeedService.createFromCampaign` creates the seed, publishes it, links it to the campaign, and returns. The listing goes live immediately with the full SEO enrichment packet — but **no outreach to the owner is triggered**. The operator must manually remember to contact the owner, and there is no structured record of whether the owner was notified, whether they responded, or whether the outreach surfaced a freshness problem (closure, relocation, ownership change) before Google indexed the page.

This creates two issues:

1. **Owner surprise.** The owner may discover their listing via a Google search weeks later, having never been told it exists. The platform's relationship with the owner starts with a cold discovery instead of a courtesy heads-up.
2. **Freshness risk.** The audit's `operational_status` is a point-in-time snapshot. If the business closed between audit and seed creation, the published listing is misinformation that could rank for weeks before anyone notices. Only a live contact catches this — and today there is no trigger to make that contact happen.

The SEO enrichment spec (`PLACE_SEED_SEO_ENRICHMENT_SPEC.md` §2.3) documents that the place page ships with the analyst-composed `public_narrative` as the visible "About this listing" lead paragraph, the meta description, and the JSON-LD `description`. This is the primary long-tail SEO surface. The natural indexing lag — days to weeks between `is_published = true` and Google ranking the page — is a **courtesy window that already exists**. This sprint makes it operational by triggering outreach the moment the seed is created, so the owner gets a first crack at claim before the broader public finds the listing via search.

---

## 2. Non-Goals

- **No hard gate on the narrative.** The `public_narrative`, `description`, `keywords`, and `sameAs` fields remain public from the moment of publish. The courtesy window is the natural SEO propagation lag, not a capability gate or embargo status. (See `PLACE_SEED_SEO_ENRICHMENT_SPEC.md` §6 — "What Does NOT Change" — for the gating rationale.)
- **No change to the publish flow.** `createFromCampaign` still auto-publishes (`opts.publish !== false`). The listing is accessible via direct link immediately. We do not invert to invite-then-publish.
- **No automated message delivery.** Phase 1 logs a scheduled outreach contact and surfaces it to the operator. Actual email/SMS sending is Phase 2 (requires durable outbox + delivery provider integration).
- **No change to the claim flow.** Tokens, `org_standing_mode` flip, and the gateway upgrade preview are untouched.
- **No batch-path outreach.** `createSeedsFromBatch` does not trigger outreach — volume makes per-seed outreach impractical, and batch seeds lack the campaign-audit corpus that makes the outreach message credible. This sprint is scoped to the audit-derived `createFromCampaign` path only.
- **No change to the `public_narrative` directive.** The audit template's `public_narrative` directive (`seed-business-audit-v2-templates.ts` lines 152–178) remains as-is — required, public-safe, SEO-targeted.

---

## 3. Product Contract

### 3.1 The Courtesy Window Flow

```
Operator clicks "Add to Place Listing" (audit tab)
  └─ DirectoryPresenceSeedService.createFromCampaign(campaignId, { publish: true })
       ├─ createSeed() → tenant + listing + provenance + SEO enrichment
       ├─ publishSeed() → is_published = true, status = 'published'
       ├─ linkCampaign() → directory_seed_campaign_links (primary)
       └─ ★ SeedOutreachTriggerService.onSeedCreated(campaignId, seedId, ctx)  [NEW]
            ├─ Load campaign + audit + linked seed
            ├─ Resolve best outreach channel (phone → email → other)
            ├─ Resolve claim URL (reuses HookSuggestionService.resolveClaimUrl)
            ├─ Compose outreach message (reuses hook library + call script)
            ├─ MarketingOutreachService.logContact(...)  [outcome: 'seed_outreach_scheduled']
            └─ Update seed outreach_state → 'outreach_scheduled'

         ─── Courtesy window (natural SEO lag: days to weeks) ───

Operator contacts owner (call, email, text, DM)
  └─ Logs contact result via existing POST /:campaignId/outreach
       ├─ outcome: 'reached' / 'no_answer' / 'closed_permanently' / 'wrong_location' / etc.
       └─ Update seed outreach_state → 'owner_contacted' / 'freshness_verified' / 'freshness_failed'

If freshness failed (closed / relocated / wrong location):
  └─ Operator suppresses seed → PATCH /presence-seeds/:id/status { status: 'suppressed' }
       └─ Listing removed before Google indexes it (misinformation prevented)

If owner claims during courtesy window:
  └─ Normal claim flow → org_standing_mode flips, seed status → 'claimed'
       └─ Public arrives at an already-claimed listing

If courtesy window elapses with no owner response:
  └─ outreach_state → 'no_response' (operator can still follow up or let it ride)
       └─ Public discovery begins; claim CTA remains active on the place page
```

### 3.2 Outreach State Machine

| State | Meaning | Entered when |
|---|---|---|
| `not_started` | Default; no outreach triggered | Seed created outside `createFromCampaign` (manual, batch, suggestion, owner submission) |
| `outreach_scheduled` | System has logged a seed-outreach contact; operator has not yet contacted the owner | `SeedOutreachTriggerService.onSeedCreated` completes |
| `owner_contacted` | Operator has logged at least one contact attempt (any outcome except freshness-fail) | First operator `logContact` on the campaign after `outreach_scheduled` |
| `freshness_verified` | Owner confirmed the business is open and at the listed address | Operator logs `outcome: 'reached'` with `call_details.operating_status_confirmed: true` |
| `freshness_failed` | Outreach revealed closure, relocation, or wrong location | Operator logs `outcome` indicating `closed_permanently` / `wrong_location` / `disconnected_number` |
| `no_response` | Courtesy window elapsed with no owner contact | Scheduled job detects `outreach_scheduled` older than `SEED_OUTREACH_NO_RESPONSE_DAYS` (default 14) with no operator contact logged |
| `claimed` | Owner claimed the listing | Claim flow completes (supersedes outreach state) |
| `suppressed` | Operator suppressed the listing | `PATCH /status` sets `suppressed` (supersedes outreach state) |

### 3.3 Channel Resolution

| Priority | Channel | Source | Fallback |
|---|---|---|---|
| 1 | `phone` | `campaign.phone` or `audit.nap_consistency.canonical_phone` | — |
| 2 | `email` | `seed.owner_email` or `campaign.email` | — |
| 3 | `other` | No phone or email available | Creates outreach log with `contactChannel: 'other'`, `outcome: 'seed_outreach_scheduled'`, `notes: 'No phone or email on file — operator must find contact channel manually'` |

When no channel is available, the outreach log still fires (so the operator sees the task in their queue) but the message snapshot notes the missing channel.

---

## 4. Current State / Existing Architecture

### 4.1 What exists

| Component | Status | Location |
|---|---|---|
| `createFromCampaign` — seed + publish + link | Exists | `apps/api/src/services/DirectoryPresenceSeedService.ts:1470-1688` |
| SEO enrichment (description, keywords, sameAs, public_narrative) | Exists | `apps/api/src/services/directory/SeedSeoComposer.ts` |
| `MarketingOutreachService.logContact` | Exists | `apps/api/src/services/MarketingOutreachService.ts:160-289` |
| Hook library + call script + opener generation | Exists | `apps/api/src/services/outreach-openers/hook-library.ts`, `HookSuggestionService.ts`, `CallScriptService.ts` |
| `HookSuggestionService.resolveClaimUrl` — reads seed-campaign link + claim token | Exists | `apps/api/src/services/HookSuggestionService.ts:346-376` |
| `ContactOutcome` type (`reached`, `no_answer`, `left_message`, `interested`, `not_interested`, `callback_scheduled`, `other`, `auto_follow_up_scheduled`, `wrong_number`, `disconnected_number`) | Exists — but **missing** `seed_outreach_scheduled`, `freshness_verified`, `freshness_failed` (see §5.6) | `apps/api/src/services/MarketingOutreachService.ts:27` |
| `CallResult` type (includes `closed_permanently`, `wrong_location`) — mapped to `ContactOutcome` via `CONTACT_RESULT_TO_OUTCOME` | Exists | `apps/api/src/routes/marketing-ops.ts:347-370` |
| Seed status lifecycle (`draft` → `published` → `invited` → `claimed` / `suppressed`) | Exists | `apps/api/src/services/DirectoryPresenceSeedService.ts` |
| `PATCH /presence-seeds/:id/status` — operator suppress | Exists | `apps/api/src/routes/directory-presence-admin.ts` |
| Place page CTA adapts to `hasClaimToken` | Exists | `apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx:221-234` |
| Auto-follow-up scheduler (hot-prospect cadence) | Exists | `apps/api/src/services/MarketingAutoFollowUpScheduler.ts` + `jobs/marketing-ops-auto-followup.ts` |

### 4.2 What does NOT exist

| Component | Gap |
|---|---|
| Post-seed outreach trigger | `createFromCampaign` returns without calling any outreach service. No event, no hook, no side-effect. |
| Outreach state on the seed | `directory_presence_seeds` has no `outreach_state` column. The seed's `status` field tracks publish/claim lifecycle, not outreach progress. |
| Seed-outreach deduplication | No marker distinguishes "this outreach log was auto-created from a seed trigger" from operator-logged contacts. |
| No-response detection | No job checks whether `outreach_scheduled` seeds have been contacted within a window. |
| Freshness-fail → suppress wiring | When an operator logs `closed_permanently` on a seed-created outreach, there is no prompt or auto-action to suppress the seed. |
| Operator "awaiting outreach" queue | The seed admin list page has no filter for `outreach_state = 'outreach_scheduled'`. |
| `ContactOutcome` values for seed outreach | `seed_outreach_scheduled`, `freshness_verified`, `freshness_failed` are not in the `ContactOutcome` union or the `contactOutcomeEnum` Zod schema. |
| `CallDetails` seed-outreach fields | The `CallDetails` interface and `callDetailsSchema` are closed objects — `seed_outreach`, `seed_id`, `claim_url`, `place_url`, `profile_quality_findings` fields do not exist and will be stripped by Zod. |
| Public `resolveClaimUrl` accessor | `HookSuggestionService.resolveClaimUrl` is `private` — no public method exposes the claim URL for a campaign. |
| Product creation route security | `POST /items` (`inline-items-crud.ts`) is `authLevel: 'public'` with only `requireWritableSubscription` — no caller authentication, no tenant access check, no SKU limit enforcement. |

### 4.3 The hook point

The natural insertion point is **immediately after** `DirectorySeedCampaignLinkService.linkCampaign(...)` in the newly-created branch of `createFromCampaign` (line 1672). At this point:

- The seed exists and is published (slug is available).
- The `directory_seed_campaign_links` row exists, so `resolveClaimUrl` can resolve the claim token.
- The `created: true` flag is known, so the trigger only fires on new seeds (not idempotent re-runs).
- The `RequestCtx` is available for audit trail.

```ts
// DirectoryPresenceSeedService.createFromCampaign, after line 1672
await DirectorySeedCampaignLinkService.linkCampaign(seed.id, campaignId, 'primary', ctx);

// ★ NEW: trigger campaign-aware outreach
if (true /* created === true — we're in the new-seed branch */) {
  await SeedOutreachTriggerService.getInstance().onSeedCreated({
    campaignId,
    seedId: seed.id,
    ctx,
  }).catch((err) => {
    // Fire-and-forget: outreach trigger failure must not roll back seed creation
    logger.warn('SeedOutreachTriggerService.onSeedCreated failed', { campaignId, seedId: seed.id, error: err.message });
  });
}
```

The trigger is **fire-and-forget with error swallowing**: if outreach scheduling fails, the seed is still created and published. The operator can manually trigger outreach from the seed detail page.

#### Transaction boundary

`createFromCampaign` runs `createSeed` → `publishSeed` → `linkCampaign` as three independent steps today. If `linkCampaign` throws (`seed_not_found`, `campaign_not_found`, `primary_link_already_exists`), the seed and published listing already exist but have no campaign link. A retry returns `created: false` (existing-link check) and skips the trigger.

To prevent orphaned seeds and partial-failure states:

1. **`SeedOutreachTriggerService.onSeedCreated` must be atomic**: insert the outreach log AND update `outreach_state` in a single `prisma.$transaction`. If either fails, both roll back. This prevents the "log exists but state is `not_started`" state.
2. **Idempotency is per-seed, not per-campaign** (see §6.2): the trigger checks for an existing log with `call_details->>'seed_id' = $1` before creating a new one. Sibling seeds each get their own outreach log.
3. **Reconciliation**: if a seed has a `seed_outreach: true` log but `outreach_state = 'not_started'` (partial failure before the atomic trigger was added, or a future migration gap), `SeedOutreachStateSync.reconcileSeed(seedId)` can sync the state from the latest outreach log. This is a manual admin action, not automatic.

---

## 5. Scope / Implementation Plan

### 5.1 Phase A — Post-Seed Outreach Trigger (backend)

- New service: `SeedOutreachTriggerService` — singleton, extends `BaseService`.
- New method on `DirectoryPresenceSeedService`: `setOutreachState(seedId, state, ctx)`.
- Hook into `createFromCampaign` after `linkCampaign`.
- Log a `seed_outreach_scheduled` contact via `MarketingOutreachService.logContact`.
- Compose the outreach message from the hook library (reuse `HookSuggestionService.suggestForCampaign` top hook) + claim URL + place page URL.
- Set seed `outreach_state = 'outreach_scheduled'`.

### 5.2 Phase B — Outreach Outcome Capture + Freshness Wiring (backend)

- Extend `DirectoryPresenceSeedService.setOutreachState` to be called from the existing outreach log route when the campaign has a linked seed.
- When operator logs `closed_permanently` / `wrong_location` / `disconnected_number` on a seed-linked campaign, auto-set `outreach_state = 'freshness_failed'` and surface a suppress suggestion in the response.
- When operator logs `reached` with `operating_status_confirmed: true`, auto-set `outreach_state = 'freshness_verified'`.
- New job: `seed-outreach-no-response.ts` — daily, marks `outreach_scheduled` seeds older than `SEED_OUTREACH_NO_RESPONSE_DAYS` (default 14) as `no_response`.

### 5.3 Phase C — Operator Dashboard Surface (frontend)

- Seed admin detail page: outreach state badge + outreach history (linked campaign's outreach log).
- Seed admin list page: filter by `outreach_state`, "Awaiting Outreach" queue view.
- When `freshness_failed`, show a "Suppress this listing" action button (calls existing `PATCH /status`).
- Campaign detail / audit card: after "Add to Place Listing" success, show "Outreach scheduled — contact the owner" banner with the resolved claim URL and suggested hook.

### 5.4 Phase D — Owner-Facing Light Features Teaser (frontend)

A curious owner who finds their unclaimed listing on `/place/{slug}` during the courtesy window has no path to learn what the platform offers before deciding whether to claim. The place page's `PoweredByFooter` (`apps/web/src/components/PoweredByFooter.tsx`) links only to Terms, Privacy, and Legal — no capabilities teaser. The existing `/features` page is a full platform showcase (Clover, inventory, commerce, etc.) that is too heavy for this context and not targeted to the directory-presence → claim → upgrade journey.

This phase adds a **light features teaser** — a focused, owner-facing page that surfaces only the immediate upgrade paths from `directory_presence`, with a link to the full `/features` page for owners who want more.

- New page: `/place/about` (or `/owners`) — a lightweight, mobile-friendly teaser page.
- Content: the Entry Presence upgrade triad (directory / google / storefront modes) that `DirectoryPresenceUpgradeOptionsService` already builds for the claim success screen, rendered as 3-4 capability cards with taglines. No Clover, no inventory, no commerce — just "what claiming unlocks" and "what upgrading next unlocks."
- Link from `PoweredByFooter`: add a "For Business Owners" or "Platform Capabilities" link alongside Terms / Privacy / Legal. This link appears on every place page, directory page, and shop page that uses `PoweredByFooter` (26 surfaces per the grep).
- Link from the claim CTA area: when `hasClaimToken` is false (no token, "Are you the owner?" path), add a secondary "Learn what VisibleShelf offers" link below the CTA button so the curious owner has a path before the claim decision.
- The teaser page links to the full `/features` page as "See all platform capabilities" at the bottom — owners who want the deep dive can get there, but the default surface is light and focused.

### 5.5 Phase E — Directory Presence Product Slot Allocation (tier-level)

Today the `directory_presence` tier has `max_skus = 0` — no product listing capability. Once an owner claims, the tier stays `directory_presence` until they upgrade, and `max_skus = 0` means the claimed owner has **no product listing teaser** to motivate the upgrade to a catalog-bearing tier (discovery, storefront, etc.).

This phase allocates **5 product slots** to the `directory_presence` tier as a teaser to drive product listing adoption. 5 is chosen to preserve resources for the free tier — enough to list signature products and see the storefront surface, not enough to run a full catalog.

#### No claim-gate needed — authentication is the natural gate

Product slots are coupled to the tier via `max_skus` on `subscription_tiers_list`. There is no capability feature key gating slots, and no claim-gate override in `getSKULimit`. The tier simply gets `max_skus = 5`.

An unclaimed seed (`org_standing_mode = 'directory_seed'`) has the 5 slots on the tier row, but they are **practically inaccessible** — an unclaimed seed has no owner account, no one can log in to the merchant dashboard, and no one can list products. The gate is authentication, not a SKU-limit override. When the owner claims, `org_standing_mode` flips to `'independent'`, the owner gets an account, and the 5 slots become usable. No application-level claim-gate code is needed.

This is simpler and more correct than a `getSKULimit` override:
- No `orgStandingMode` parameter threading through `getSKULimit` → `organization-validation.ts` → every caller.
- No divergence between the DB tier row (5) and the effective limit (0 or 5 depending on claim state).
- The tier row is the single source of truth: `directory_presence` has 5 slots, period. Who can use them is determined by who has an account.

#### Current state

| Location | Current value | Role |
|---|---|---|
| `subscription_tiers_list.max_skus` (DB) | `0` | Source of truth at runtime — `TierService.getTierSKULimit` reads this directly (`TierService.ts:202-212`); falls back to `500` if row is missing or null |
| `apps/api/src/utils/tier-limits.ts:43` | `maxSkus: 0` | Backend fallback constant — only used if `TierService.getTierSKULimit` rejects (`sku-limits.ts:83`) |
| `apps/web/src/lib/tiers.ts:42` | `maxSkus: 0` | Frontend display constant — active gating uses `useTierSystem` hook, not this static value |
| `apps/api/src/middleware/sku-limits.ts:82-88` | — | Per-tenant SKU creation enforcement: `currentCount + productCount > skuLimit` — reads `TierService.getTierSKULimit` first, falls back to `TIER_LIMITS` constant on error |
| `apps/api/src/middleware/organization-validation.ts:103, 194` | — | Org-level aggregate SKU check: `totalSKUs > maxTotalSKUs` — reads from DB tier row |
| `apps/api/src/routes/inline-items-crud.ts:1194` | `authLevel: 'public'` | **Primary product creation route — currently unauthenticated, no SKU limit check** (see prerequisite below) |

#### Implementation

| Component | Change | Location |
|---|---|---|
| DB tier row | `UPDATE subscription_tiers_list SET max_skus = 5 WHERE tier_key = 'directory_presence'` | Migration 257 (same migration as outreach_state — additive) |
| Backend `tier-limits.ts` | Update `TIER_LIMITS.directory_presence.maxSkus` from 0 to 5 | `apps/api/src/utils/tier-limits.ts:43` |
| Frontend `tiers.ts` | Update `directory_presence.maxSkus` from 0 to 5 | `apps/web/src/lib/tiers.ts:42` |
| Frontend tier display | Show "5 products" in the directory_presence tier card on the light features teaser and claim success screen | `apps/web/src/app/place/about/page.tsx` (§8.5) + claim success screen |
| Claim success screen | Add "You can now list up to 5 products" to the post-claim upgrade preview | `apps/web/src/app/directory/claim/[token]/` |

No changes to `getSKULimit` signature or `organization-validation.ts`. The existing `max_skus` enforcement in `sku-limits.ts` works as-is — it reads 5 instead of 0 from the tier row (via `TierService.getTierSKULimit`).

#### Prerequisite: product creation route security (must land before `max_skus` changes)

The primary product creation route `POST /items` (`apps/api/src/routes/inline-items-crud.ts:1194`) is currently registered as `authLevel: 'public'` with only `requireWritableSubscription` — which checks subscription status but does **not** authenticate the caller, verify tenant membership, or enforce SKU limits. Changing `max_skus` to 5 without fixing this would allow anyone to create unlimited products against any tenant ID.

**Required fixes (Phase E0, before E1):**

| Fix | Location | Change |
|---|---|---|
| Add caller authentication | `inline-items-crud.ts` `POST /items` route | Add `authenticateToken` middleware before `requireWritableSubscription` |
| Add tenant access check | `inline-items-crud.ts` `POST /items` route | Add `checkTenantAccess` (or `requireTenantAdmin`) to verify the caller belongs to the tenant |
| Add SKU limit enforcement | `inline-items-crud.ts` `POST /items` route | Add `validateSKULimits` middleware (from `sku-limits.ts`) |
| Fix dead storefront gate | `apps/web/src/app/tenant/[id]/page.tsx:696` | Replace `tenant.access.storefront` (non-existent field) with `publicUnifiedCapabilityService.getStorefrontState` |
| Clear tier cache after migration | `TierService.ts:285-289` | Call `TierService.clearTierCache('directory_presence')` after migration 257 applies, or restart the API process |

#### Scope: admin-dashboard product management only

The `directory_presence` tier has `storefront_enabled` and `storefront_retail` capability keys (`tier-features.ts:11-21`) but does **not** have `product_options_*` or `storefront_opt_*` keys. This means:
- Product creation in the **admin/merchant dashboard** works (the SKU limit gate is the only barrier).
- The **public storefront** product browsing surface will not render product options or a full catalog experience.

This is intentional for Phase E. The 5-slot teaser is about the **limit** and the **upgrade prompt**, not about a full public storefront. The owner can manage products in their dashboard and hit the 5-product limit, which surfaces the upgrade path. A full public storefront experience for `directory_presence` is a future sprint that would add `product_options_enabled` to the tier feature set.

#### Light features teaser integration

The teaser page (§8.5) gains a 4th capability card:

| Card | Content | Source |
|---|---|---|
| "List your first products" | "Add up to 5 signature products to your storefront — free with your claimed listing." | Static copy; the 5-slot limit matches the tier row |

This card links to the product management page (post-claim) or to the claim CTA (pre-claim) depending on the owner's auth state.

#### Upgrade motivation framing

The 5-slot limit is intentionally tight. When the owner hits the limit (tries to add a 6th product), the UI surfaces the upgrade path: "You've reached the 5-product limit of your free Directory Presence listing. Upgrade to Discovery for 75 products or Storefront for 200." This converts the free tier from a dead end into a **product-led upgrade funnel** — the owner experiences the value of product listing before paying for more capacity.

### 5.6 Phase A0 — Type & Schema Extensions (prerequisite for Phase A)

Before `SeedOutreachTriggerService` can log a `seed_outreach_scheduled` contact, the outreach type system must be extended. These are pure type/schema additions with no behavior change.

#### ContactOutcome extension

| Change | Location |
|---|---|
| Add `'seed_outreach_scheduled'`, `'freshness_verified'`, `'freshness_failed'` to `ContactOutcome` union | `apps/api/src/services/MarketingOutreachService.ts:27` |
| Add the same values to `contactOutcomeEnum` Zod schema | `apps/api/src/routes/marketing-ops.ts:323` |
| Update `CONTACT_RESULT_TO_OUTCOME` to route `closed_permanently → 'freshness_failed'` and `wrong_location → 'freshness_failed'` (intercepting before the existing `disconnected_number`/`wrong_number` mapping) | `apps/api/src/routes/marketing-ops.ts:347-370` |
| Add `'seed_outreach_scheduled'` to `NO_RESPONSE_OUTCOMES` set so the auto-follow-up scheduler treats it as a no-response baseline | `apps/api/src/services/MarketingAutoFollowUpScheduler.ts:24` |
| Mirror the new outcomes in the frontend `ContactOutcome` type | `apps/web/src/services/MarketingOpsService.ts` |

#### CallDetails extension

| Change | Location |
|---|---|
| Add `seed_outreach?: boolean`, `seed_id?: string`, `claim_url?: string`, `place_url?: string`, `hook_angle?: string`, `trigger_source?: string`, `profile_quality_findings?: Array<{ signal: string; severity: string; label: string }>` to the `CallDetails` interface | `apps/api/src/services/MarketingOutreachService.ts:66-85` |
| Add the same fields to `callDetailsSchema` Zod schema | `apps/api/src/routes/marketing-ops.ts:381-396` |
| Mirror in the frontend `CallDetails` interface | `apps/web/src/services/MarketingOpsService.ts:513-528` |

#### HookSuggestionService.resolveClaimUrl — make public

| Change | Location |
|---|---|
| Change `private async resolveClaimUrl` to `async resolveClaimUrl` (or add a public wrapper `getClaimUrlForCampaign(campaignId, ctx)` that delegates to it) | `apps/api/src/services/HookSuggestionService.ts:346` |

The `suggestForCampaign` response does not include a top-level `claimUrl` field — the URL only appears inside `suggestions[].resolved.body` after merge-field substitution. `SeedOutreachTriggerService` needs the raw URL, so the method must be accessible.

---

## 6. Schema Sketch

### 6.1 `directory_presence_seeds` additions (Migration 257)

| Column | Type | Default | Notes |
|---|---|---|---|
| `outreach_state` | TEXT | `'not_started'` | Enum-like: `not_started`, `outreach_scheduled`, `owner_contacted`, `freshness_verified`, `freshness_failed`, `no_response`, `claimed`, `suppressed` |
| `outreach_state_entered_at` | TIMESTAMPTZ | NULL | When the seed entered the current `outreach_state` |
| `outreach_scheduled_at` | TIMESTAMPTZ | NULL | When the trigger fired (denormalized from the outreach log for fast filtering) |

```sql
-- 257_seed_outreach_state.sql
ALTER TABLE directory_presence_seeds
  ADD COLUMN outreach_state TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN outreach_state_entered_at TIMESTAMPTZ NULL,
  ADD COLUMN outreach_scheduled_at TIMESTAMPTZ NULL;

-- Index for the "awaiting outreach" operator queue
CREATE INDEX idx_dps_outreach_state
  ON directory_presence_seeds (outreach_state)
  WHERE outreach_state IN ('outreach_scheduled', 'owner_contacted', 'no_response');

-- Backfill: existing published/invited seeds that were created via
-- createFromCampaign (have a primary campaign link) get 'not_started'.
-- No backfill to 'outreach_scheduled' — those seeds already shipped without
-- outreach and are presumed past the courtesy window.
UPDATE directory_presence_seeds
  SET outreach_state = 'not_started'
  WHERE outreach_state IS NULL OR outreach_state = '';

-- Phase E: allocate 5 product slots to the directory_presence tier.
-- The tier row changes from max_skus = 0 to max_skus = 5. No claim-gate
-- override is needed — unclaimed seeds have no owner account to list
-- products, so authentication is the natural gate. See §5.5.
UPDATE subscription_tiers_list
  SET max_skus = 5
  WHERE tier_key = 'directory_presence';
```

### 6.2 Outreach log deduplication marker

No schema change. The `mkt_outreach_log.call_details` JSON gains a convention:

```json
{
  "seed_outreach": true,
  "seed_id": "dps-...",
  "claim_url": "/directory/claim/dct-...",
  "place_url": "/place/{slug}",
  "hook_angle": "gbp_verification",
  "trigger_source": "createFromCampaign"
}
```

The `seed_id` field in `call_details` is the **per-seed idempotency key**. Before creating a new `seed_outreach_scheduled` log, `SeedOutreachTriggerService` checks for an existing log with `call_details->>'seed_id' = $1` and `call_details->>'seed_outreach' = 'true'`. If found, it skips.

**Per-seed, not per-campaign:** Each `createFromCampaign` call creates its own outreach log entry with the seed's ID. Sibling seeds (multi-archetype campaigns sharing one campaign ID) each get their own outreach log and their own `outreach_state = 'outreach_scheduled'`. This ensures every seed enters the courtesy window, not just the first sibling. The campaign's outreach history shows all sibling seed outreach logs; the per-seed `outreach_state` tracks each seed independently.

**Relationship to existing `outreach_status` column:** `directory_presence_seeds` already has an `outreach_status` column (default `'unverified'`, 7-value whitelist: `unverified`, `outreach_attempted`, `verified_by_call`, `verified_by_email`, `enrichment_sent`, `enrichment_pending_review`, `enriched`). The new `outreach_state` column tracks the **courtesy-window-specific** state machine. The two columns coexist:
- `outreach_status` — broader verification/enrichment lifecycle (existing, unchanged).
- `outreach_state` — courtesy window outreach progress (new, this sprint).
- `updateOutreachStatus` (line 1386) continues to manage `outreach_status`; `setOutreachState` manages `outreach_state`. They do not interact.

### 6.3 Config additions

| Env var | Default | Location | Notes |
|---|---|---|---|
| `SEED_OUTREACH_NO_RESPONSE_DAYS` | `14` | `unifiedConfig.ts` (marketing ops section) | Days before `outreach_scheduled` → `no_response` |
| `DISABLE_SEED_OUTREACH_TRIGGER` | `false` | `unifiedConfig.ts` | Kill switch for the post-seed trigger |
| `DISABLE_SEED_OUTREACH_NO_RESPONSE_JOB` | `false` | `unifiedConfig.ts` | Kill switch for the no-response job |

---

## 7. API / Service Changes

### 7.1 New service: `SeedOutreachTriggerService`

`apps/api/src/services/SeedOutreachTriggerService.ts` — singleton, extends `BaseService`.

```ts
class SeedOutreachTriggerService extends BaseService {
  /**
   * Called after createFromCampaign completes (seed + publish + link).
   * Fire-and-forget from the caller's perspective — errors are caught and logged.
   *
   * Steps:
   * 1. Load campaign + linked seed + audit
   * 2. Check idempotency: skip if a seed_outreach log already exists for this seed
   *    (query: call_details->>'seed_id' = $1 AND call_details->>'seed_outreach' = 'true')
   * 3. Resolve best contact channel (phone → email → other)
   * 4. Resolve claim URL via HookSuggestionService.resolveClaimUrl (now public — see §5.6)
   * 5. Resolve top hook via HookSuggestionService.suggestForCampaign — top hook is suggestions[0]
   *    (method returns HookSuggestionResult with suggestions: RankedHook[]; use suggestions[0].resolved.body)
   * 6. Compose outreach message (hook body + claim URL + place page URL)
   * 7. ATOMIC: prisma.$transaction([
   *      MarketingOutreachService.logContact({
   *        campaignId, contactChannel, outcome: 'seed_outreach_scheduled',
   *        contactedBy: 'system', messageSnapshot: composedMessage,
   *        callDetails: { seed_outreach: true, seed_id, claim_url, place_url, hook_angle, trigger_source: 'createFromCampaign' },
   *        followUpDate: today + SEED_OUTREACH_NO_RESPONSE_DAYS,
   *      }),
   *      DirectoryPresenceSeedService.setOutreachState(seedId, 'outreach_scheduled', ctx),
   *    ])
   *    — Both succeed or both roll back. No partial state.
   */
  async onSeedCreated(input: {
    campaignId: string;
    seedId: string;
    ctx?: RequestCtx;
  }): Promise<void>;
}
```

### 7.2 New method: `DirectoryPresenceSeedService.setOutreachState`

```ts
async setOutreachState(
  seedId: string,
  state: OutreachState,
  ctx?: SeedAuditCtx,
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE directory_presence_seeds
    SET outreach_state = ${state},
        outreach_state_entered_at = now(),
        outreach_scheduled_at = CASE WHEN ${state} = 'outreach_scheduled' THEN now() ELSE outreach_scheduled_at END
    WHERE id = ${seedId}
  `;
  audit({
    actor: ctx?.actorId,
    actorType: ctx?.actorType,
    action: 'directory_presence_seed.outreach_state_change',
    payload: { seedId, state },
  });
}
```

**Audit trail note:** The `audit()` helper (`apps/api/src/audit.ts:22-34`) collapses action strings to a 7-value enum (`create`, `update`, `delete`, `sync`, `policyApply`, `oauthConnect`, `oauthRefresh`). `outreach_state_change` falls through to the default `update`. The `entity_type` `directory_presence_seed` is not in the allow-list (`audit.ts:38-42`) and will be stored as `'other'`. The original action string and entity type are preserved in the audit `metadata` JSON column, so the full action is recoverable via metadata queries. This is a known limitation — extending the audit entity type allow-list is a separate concern outside this sprint's scope.

### 7.3 Extended route: outreach log → seed state sync

In `apps/api/src/routes/marketing-ops.ts`, the existing `POST /:id/outreach` handler (`MarketingOutreachService.logContact`) gains a post-log side-effect: if the campaign has a primary-linked seed, update the seed's `outreach_state` based on the logged outcome.

**Wiring:** The route handler (`marketing-ops.ts:1281-1305`) currently calls `logContact` and immediately returns `201`. The sync is added as a **separate try/catch after `logContact` succeeds** — its errors are logged but do not affect the 201 response:

```ts
router.post('/:id/outreach', async (req, res) => {
  try {
    const parsed = outreachLogSchema.parse(req.body);
    const log = await outreachService.logContact({ ... }, getCtx(req));
    // ★ NEW: sync seed outreach state (fire-and-forget, errors swallowed)
    try {
      await SeedOutreachStateSync.syncFromLog({
        campaignId: req.params.id,
        outcome: parsed.outcome,
        callDetails: parsed.call_details,
        ctx: getCtx(req),
      });
    } catch (syncErr) {
      logger.warn('SeedOutreachStateSync.syncFromLog failed', { campaignId: req.params.id, error: syncErr.message });
    }
    res.status(201).json({ success: true, data: log });
  } catch (error) { ... }
});
```

**Outcome → seed state mapping:**

The mapping operates at the `ContactOutcome` level (the resolved outcome after `CONTACT_RESULT_TO_OUTCOME` mapping). With the Phase A0 extension (§5.6), `CONTACT_RESULT_TO_OUTCOME` now routes `closed_permanently → 'freshness_failed'` and `wrong_location → 'freshness_failed'` directly, so the sync only needs to handle `ContactOutcome` values:

| Logged `ContactOutcome` | Seed `outreach_state` |
|---|---|
| `reached` + `call_details.operating_status_confirmed: true` | `freshness_verified` |
| `reached` (without confirmation) | `owner_contacted` |
| `no_answer` / `left_message` / `callback_scheduled` / `interested` / `not_interested` | `owner_contacted` |
| `wrong_number` / `disconnected_number` | `freshness_failed` |
| `freshness_verified` | `freshness_verified` |
| `freshness_failed` | `freshness_failed` |
| `seed_outreach_scheduled` / `auto_follow_up_scheduled` | (no change — system-generated) |

This is a thin post-log hook, not a reimplementation of the outreach log route. The existing `logContact` call completes first; then `SeedOutreachStateSync.syncFromLog` fires.

### 7.4 New route: seed outreach state (read)

| Method | Route | Handler |
|---|---|---|
| `GET` | `/api/admin/directory-presence/presence-seeds/:id/outreach` | Returns the seed's `outreach_state`, `outreach_state_entered_at`, and the linked campaign's outreach log entries |

### 7.5 New job: `seed-outreach-no-response.ts`

`apps/api/src/jobs/seed-outreach-no-response.ts` — daily, started in `index.ts` alongside the existing marketing ops jobs.

```ts
// Pseudocode
const stale = await prisma.$queryRaw`
  SELECT id FROM directory_presence_seeds
  WHERE outreach_state = 'outreach_scheduled'
    AND outreach_scheduled_at < now() - interval '${noResponseDays} days'
`;
for (const seed of stale) {
  await DirectoryPresenceSeedService.getInstance().setOutreachState(seed.id, 'no_response');
}
```

Wired in `index.ts` with a 5-minute startup delay, 24-hour interval, `DISABLE_SEED_OUTREACH_NO_RESPONSE_JOB` kill switch.

---

## 8. Frontend Changes

### 8.1 Seed admin detail page

`apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/[id]/`

- **Outreach state badge** — colored pill showing the current `outreach_state` (gray: `not_started`, blue: `outreach_scheduled`, amber: `owner_contacted` / `no_response`, green: `freshness_verified` / `claimed`, red: `freshness_failed` / `suppressed`).
- **Outreach history section** — renders the linked campaign's outreach log entries (reuses the existing outreach log component from marketing-ops).
- **"Log Outreach" action** — when `outreach_state` is `outreach_scheduled` or `owner_contacted`, shows a button that opens the existing outreach log modal (pre-filled with the campaign ID).
- **"Suppress this listing" action** — when `outreach_state` is `freshness_failed`, shows a red action button that calls `PATCH /presence-seeds/:id/status { status: 'suppressed' }`. Confirmation modal: "This will remove the listing from the public directory. Confirm?"

### 8.2 Seed admin list page

`apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/`

- **Outreach state filter** — dropdown: All / Awaiting Outreach / Contacted / Verified / Failed / No Response.
- **"Awaiting Outreach" queue view** — default filter when outreach state filter is active; shows seeds with `outreach_state = 'outreach_scheduled'` sorted by `outreach_scheduled_at` ascending (oldest first).
- **Outreach state column** — compact badge in the table.

### 8.3 Audit card post-click banner

`apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx`

After "Add to Place Listing" succeeds (`handleAddToPlace`), show a success banner:

> **Listing published. Outreach scheduled.**
> The owner has been queued for a first contact. [View listing] · [Claim link] · [Log outreach]
>
> The listing is live at `/place/{slug}` but will take days to weeks to appear in Google search. Use this window to contact the owner before the public finds it.

### 8.4 Frontend service additions

`apps/web/src/services/DirectoryPresenceAdminService.ts`:

| Method | Endpoint |
|---|---|
| `getSeedOutreach(seedId)` | `GET /api/admin/directory-presence/presence-seeds/:id/outreach` |
| `setSeedOutreachState(seedId, state)` | (internal — derived from outreach log + suppress actions) |

### 8.5 Light Features Teaser page

`apps/web/src/app/place/about/page.tsx` (or `/owners` — route TBD per open question §15.7)

A lightweight, mobile-first page that surfaces only the immediate upgrade paths from `directory_presence`. Content is derived from the same Entry Presence triad that `DirectoryPresenceUpgradeOptionsService` builds for the claim success screen. The `ENTRY_PRESENCE_MODES` constant (`apps/api/src/services/DirectoryPresenceUpgradeOptionsService.ts:23-27`) is currently module-private (not exported). The teaser page will **duplicate the 3 mode entries as a static frontend constant** (`ENTRY_PRESENCE_MODES_STATIC` in the teaser page file) with a sync comment pointing to the backend source. This avoids coupling the public teaser page to a backend service import.

| Section | Content | Source |
|---|---|---|
| Header | "What VisibleShelf offers your business" + one-line platform description | `PlatformSettingsContext` |
| "Claim your listing" card | Free — verify details, update hours, add a photo, connect with customers | Matches the existing claim pitch on the place page (`PlaceEntryEditorialLayout.tsx:215-218`) |
| Entry Presence mode cards (3) | Directory mode: "Own your directory listing" · Google mode: "Get found on Google" · Storefront mode: "Open your platform store" | `ENTRY_PRESENCE_MODES` in `DirectoryPresenceUpgradeOptionsService.ts:23-27` |
| "See all platform capabilities" link | Links to `/features` for owners who want the full showcase | Existing page |
| "Claim this listing" CTA | Repeats the claim CTA from the place page (owner arrived here curious; give them the action) | Contextual — if arrived via `?from={slug}`, link back to that place page's claim href |

**Design constraints:**
- No Clover, no inventory, no commerce, no POS integration content — those are higher-tier capabilities that overwhelm a directory-presence prospect. The teaser is scoped to the claim → upgrade journey only.
- Mobile-first: most owners will find their listing via Google search on their phone. The teaser must render cleanly on a 375px viewport.
- No auth required: the page is public, like the place page itself. The owner is pre-claim.
- No backend dependency: the Entry Presence mode metadata is static (hardcoded in `DirectoryPresenceUpgradeOptionsService`). The teaser page can render from a static copy of the same metadata — no API call needed. Pricing is omitted (tier prices vary and the claim success screen already shows them post-claim).
- **Slug reservation:** Next.js App Router static segments take precedence over dynamic `[slug]` segments. A listing whose slug is `about` would be shadowed by `/place/about`. Add `about` (and other reserved static segments: `claim`, `search`, `category`, `city`) to the directory slug validation blacklist in `apps/web/src/utils/slug.ts` so no listing can claim those slugs. This is a Phase D1 prerequisite task.

### 8.6 PoweredByFooter — "For Business Owners" link

`apps/web/src/components/PoweredByFooter.tsx`

Add a "For Business Owners" link to the footer link row (alongside Terms / Privacy / Legal):

```tsx
<div className="flex items-center justify-center gap-4 mt-3">
  <Link href="/place/about" className="text-xs text-neutral-500 ...">
    For Business Owners
  </Link>
  <Link href="/terms" className="text-xs text-neutral-500 ...">
    Terms
  </Link>
  <Link href="/privacy" className="text-xs text-neutral-500 ...">
    Privacy
  </Link>
  <Link href="/legal" className="text-xs text-neutral-500 ...">
    Legal
  </Link>
</div>
```

This link appears on every surface that uses `PoweredByFooter` — all place pages, directory pages, shop pages, category pages (25 surfaces per grep, excluding the component file itself). The link is subtle (same `text-xs text-neutral-500` styling as the legal links) so it doesn't compete with the place page's primary claim CTA, but it's discoverable for a curious owner who scrolls to the footer.

**Prop-based opt-out:** `PoweredByFooter` currently accepts only `{ note?: string }`. Add a `showBusinessOwnersLink?: boolean` prop (default `true`). The following surfaces should set `showBusinessOwnersLink={false}` — a business-owner CTA is inappropriate in buyer/checkout contexts:

| Surface | Why opt out |
|---|---|
| `app/carts/page.tsx` | Checkout flow — buyer context |
| `app/my-orders/BuyerOrderHistory.tsx` | Post-purchase — buyer context |
| `app/shops/[slug]/ShopProfileClient.tsx` | Tenant storefront — may be off-brand for the store owner |
| `app/shops/featured/page.tsx` | Featured shops — buyer context |

### 8.7 Place page — secondary "Learn more" link

`apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx`

Below the claim CTA button (both the `hasClaimToken` and `!hasClaimToken` variants, lines 221-234), add a secondary link:

```tsx
{hasClaimToken ? (
  <Link href={claimHref} className="...primary CTA...">
    <ShieldCheck className="w-5 h-5" /> Claim this listing
  </Link>
) : (
  <a href={claimHref} className="...primary CTA...">
    <Info className="w-5 h-5" /> Are you the owner?
  </a>
)}
{/* NEW: secondary link for curious owners */}
<Link
  href="/place/about"
  className="text-sm text-neutral-500 hover:text-blue-600 transition-colors mt-2 text-center"
>
  Learn what VisibleShelf offers →
</Link>
```

This gives the owner a path to the teaser *before* the claim decision, directly from the listing page — not just from the footer.

---

## 9. Dependencies & Reused Patterns

| Dependency | Where it lives | How it's reused |
|---|---|---|
| `MarketingOutreachService.logContact` | `apps/api/src/services/MarketingOutreachService.ts:160` | The trigger calls it with `outcome: 'seed_outreach_scheduled'`, `contactedBy: 'system'`, and the composed message as `messageSnapshot`. |
| `HookSuggestionService.suggestForCampaign` | `apps/api/src/services/HookSuggestionService.ts:69` | Resolves the top hook angle for the campaign's archetype + signals. The trigger uses the top hook's body as the outreach message template. |
| `HookSuggestionService.resolveClaimUrl` | `apps/api/src/services/HookSuggestionService.ts:346` | Reads `directory_seed_campaign_links` + active `directory_claim_tokens` to build `/directory/claim/{token}`. Already proven to work post-link. **Made public in Phase A0** (§5.6) — currently `private`. |
| `CallScriptService.assembleForCampaign` | `apps/api/src/services/CallScriptService.ts:147` | Optional: if the operator prefers a call script over an email/message body, the trigger can reference the call script for the campaign. |
| `OutreachChecklistBridgeService.onOutreachArtifactCreated` | `apps/api/src/services/OutreachChecklistBridgeService.ts:34` | Fire-and-forget side-effect after the outreach log is created (same pattern as `logContact` line 289). |
| `DirectoryPresenceSeedService.publishSeed` / `linkCampaign` | `apps/api/src/services/DirectoryPresenceSeedService.ts:501, 1672` | The trigger fires after both complete. No change to these methods. |
| `PATCH /presence-seeds/:id/status` | `apps/api/src/routes/directory-presence-admin.ts` | Existing suppress action; the frontend "Suppress this listing" button calls it. |
| `unifiedConfig` | `apps/api/src/config/unifiedConfig.ts:134-169` | New env vars added to the marketing ops section. |
| `BaseService` singleton pattern | `apps/api/src/services/BaseService.ts` | `SeedOutreachTriggerService` extends it (mirrors `MarketingOutreachService`). |
| `audit()` helper | `apps/api/src/audit.ts` | `setOutreachState` logs `directory_presence_seed.outreach_state_change`. |
| Recovery enqueue/poll pattern | `apps/api/src/services/RecoveryResolutionService.ts:75` + `jobs/recovery-resolution.ts` | Reference for Phase 2 durable outbox if async delivery is needed. Not used in Phase 1. |
| `DirectoryPresenceUpgradeOptionsService` Entry Presence modes | `apps/api/src/services/DirectoryPresenceUpgradeOptionsService.ts:23-27` | The light features teaser page (§8.5) renders the same three mode cards (directory / google / storefront). `ENTRY_PRESENCE_MODES` is module-private (not exported) — the teaser page duplicates the 3 mode entries as a static frontend constant with a sync comment. No API call needed. |
| `PoweredByFooter` | `apps/web/src/components/PoweredByFooter.tsx` | Gains a "For Business Owners" link (§8.6). Used on 26 surfaces (all place, directory, shop, category pages). |
| `PlatformSettingsContext` | `apps/web/src/contexts/PlatformSettingsContext.tsx` | Provides `platformName` and `platformDescription` for the teaser page header. Already used by `PoweredByFooter` and `PublicFooter`. |

---

## 10. Sprint Phases

| Phase | Task | Output | Dependency |
|---|---|---|---|
| A0a | Extend `ContactOutcome` union + `contactOutcomeEnum` Zod + `CONTACT_RESULT_TO_OUTCOME` + `NO_RESPONSE_OUTCOMES` | Modified `MarketingOutreachService.ts`, `marketing-ops.ts`, `MarketingAutoFollowUpScheduler.ts` | None |
| A0b | Extend `CallDetails` interface + `callDetailsSchema` Zod + frontend `CallDetails` | Modified `MarketingOutreachService.ts`, `marketing-ops.ts`, `MarketingOpsService.ts` | None |
| A0c | Make `HookSuggestionService.resolveClaimUrl` public | Modified `HookSuggestionService.ts` | None |
| A1 | Migration 257 — `outreach_state` columns + index + `max_skus = 5` | DB schema change | None |
| A2 | `SeedOutreachTriggerService` — `onSeedCreated` method (atomic transaction) | New service file | A0a, A0b, A0c, A1 |
| A3 | `DirectoryPresenceSeedService.setOutreachState` | New method on existing service | A1 |
| A4 | Hook into `createFromCampaign` after `linkCampaign` | Modified `DirectoryPresenceSeedService.ts` | A2, A3 |
| A5 | Config additions (`SEED_OUTREACH_NO_RESPONSE_DAYS`, kill switches) | Modified `unifiedConfig.ts` | None |
| B1 | `SeedOutreachStateSync.syncFromLog` — post-log side-effect | New service or method | A1, A3 |
| B2 | Wire `syncFromLog` into `POST /:id/outreach` handler (separate try/catch) | Modified `marketing-ops.ts` | B1 |
| B3 | `seed-outreach-no-response.ts` job | New job file | A3 |
| B4 | Wire job into `index.ts` scheduler | Modified `index.ts` | B3 |
| C1 | Seed detail page — outreach state badge + history + actions | Modified frontend page | A1, B2 |
| C2 | Seed list page — outreach filter + queue view | Modified frontend page | A1 |
| C3 | Audit card post-click banner (inline success message — existing pattern sufficient) | Modified `BusinessAnalysisAuditCard.tsx` | A4 |
| C4 | Frontend service additions | Modified `DirectoryPresenceAdminService.ts` | A1 |
| D1 | Light features teaser page (`/place/about`) + slug blacklist update | New frontend page + modified `slug.ts` | None (static content) |
| D2 | `PoweredByFooter` — "For Business Owners" link + `showBusinessOwnersLink` prop | Modified `PoweredByFooter.tsx` | D1 |
| D3 | Place page — secondary "Learn more" link below claim CTA | Modified `PlaceEntryEditorialLayout.tsx` | D1 |
| E0 | Product route security: add `authenticateToken` + `checkTenantAccess` + `validateSKULimits` to `POST /items`; fix dead storefront gate | Modified `inline-items-crud.ts`, `tenant/[id]/page.tsx` | None (prerequisite for E1) |
| E1 | Migration 257 — `max_skus = 5` on `directory_presence` tier row (same migration as A1) | DB tier row update | E0 |
| E2 | Backend `tier-limits.ts` — `directory_presence.maxSkus` from 0 to 5 | Modified `tier-limits.ts` | E1 |
| E3 | Frontend `tiers.ts` — `directory_presence.maxSkus` from 0 to 5 | Modified `tiers.ts` | E1 |
| E4 | Light features teaser — "List your first products" card | Modified teaser page | D1, E3 |
| E5 | Claim success screen — "You can now list up to 5 products" (in `DirectoryClaimClient.tsx` `MODE_UNLOCK_COPY`) | Modified `DirectoryClaimClient.tsx` | E3 |

---

## 11. Testing

### 11.1 Unit tests

| Test file | Status | New test cases |
|---|---|---|
| `apps/api/src/services/__tests__/SeedOutreachTriggerService.test.ts` | New | (1) `onSeedCreated` logs a `seed_outreach_scheduled` contact with `call_details.seed_outreach = true` and `call_details.seed_id` set; (2) idempotency: second call on same **seed** skips (existing log found by `seed_id`); (3) channel resolution: phone present → `contactChannel: 'phone'`; (4) channel resolution: no phone, email present → `contactChannel: 'email'`; (5) channel resolution: no phone or email → `contactChannel: 'other'` with missing-channel notes; (6) claim URL resolved from seed-campaign link + active token; (7) hook angle resolved from `HookSuggestionService.suggestForCampaign` top suggestion (`suggestions[0]`); (8) `setOutreachState` called with `'outreach_scheduled'`; (9) trigger failure does not throw (fire-and-forget); (10) `DISABLE_SEED_OUTREACH_TRIGGER` config skips the trigger; (11) atomic: if `setOutreachState` fails, the outreach log is also rolled back |
| `apps/api/src/services/__tests__/DirectoryPresenceSeedService.outreachState.test.ts` | New | (1) `setOutreachState` updates `outreach_state` + `outreach_state_entered_at`; (2) `setOutreachState('outreach_scheduled')` also sets `outreach_scheduled_at`; (3) audit event emitted; (4) invalid state string still writes (no enum constraint at DB level) |
| `apps/api/src/services/__tests__/SeedOutreachStateSync.test.ts` | New | (1) `reached` + `operating_status_confirmed: true` → `freshness_verified`; (2) `reached` without confirmation → `owner_contacted`; (3) `no_answer` → `owner_contacted`; (4) `freshness_failed` outcome → `freshness_failed`; (5) `wrong_number` → `freshness_failed`; (6) `disconnected_number` → `freshness_failed`; (7) `auto_follow_up_scheduled` → no state change; (8) `seed_outreach_scheduled` → no state change (system-generated); (9) campaign with no linked seed → no-op (no error) |

### 11.2 Integration / route tests

| Test file | Status | New test cases |
|---|---|---|
| `apps/api/src/tests/directory-presence-admin.test.ts` (extend) | Modified | (1) `POST /presence-seeds/from-campaign/:campaignId` triggers outreach (outreach log exists after call); (2) idempotent re-call does not create a second outreach log; (3) `GET /presence-seeds/:id/outreach` returns outreach state + log entries; (4) outreach trigger failure does not fail the seed creation route |
| `apps/api/src/tests/marketing-ops-outreach.test.ts` (extend or new) | Modified | (1) `POST /:id/outreach` with `closed_permanently` on a seed-linked campaign sets `outreach_state = 'freshness_failed'`; (2) `POST /:id/outreach` with `reached` + `operating_status_confirmed` sets `freshness_verified`; (3) non-seed-linked campaign → no seed state change |

### 11.3 Job tests

| Test file | Status | New test cases |
|---|---|---|
| `apps/api/src/jobs/__tests__/seed-outreach-no-response.test.ts` | New | (1) `outreach_scheduled` seed older than `SEED_OUTREACH_NO_RESPONSE_DAYS` → `no_response`; (2) `outreach_scheduled` seed younger than threshold → unchanged; (3) `owner_contacted` seed → unchanged; (4) `DISABLE_SEED_OUTREACH_NO_RESPONSE_JOB` → job skips |

### 11.3b SKU limit tests

| Test file | Status | New test cases |
|---|---|---|
| `apps/api/src/utils/__tests__/tier-limits.test.ts` (extend) | Modified | (1) `TIER_LIMITS.directory_presence.maxSkus` → 5 (constant update); (2) `TierService.getTierSKULimit('directory_presence')` → 5 (reads from DB tier row after migration + cache clear); (3) `TierService.getTierSKULimit('directory_presence')` returns 5 after `TierService.clearTierCache('directory_presence')` (confirms cache invalidation); (4) `validateSKULimits` allows 5 products, blocks 6th (integration test with `sku-limits.ts` middleware) |

### 11.4 Manual frontend verification

1. Create a seed via "Add to Place Listing" from a campaign with a `business_analysis` audit → confirm outreach state badge shows "Outreach Scheduled" on the seed detail page.
2. Visit `/place/{slug}` → confirm the listing is live (direct link works).
3. Check the seed detail page → confirm the outreach history shows the auto-created `seed_outreach_scheduled` log entry with the composed message + claim URL.
4. Log a contact with `closed_permanently` → confirm seed outreach state flips to "Freshness Failed" and the "Suppress this listing" button appears.
5. Click "Suppress" → confirm seed status flips to `suppressed` and the listing is no longer accessible at `/place/{slug}`.
6. Filter the seed list by "Awaiting Outreach" → confirm only `outreach_scheduled` seeds appear, sorted oldest-first.
7. Visit `/place/about` → confirm the light features teaser renders with the three Entry Presence mode cards + claim CTA + "See all platform capabilities" link.
8. Visit `/place/{slug}` on a mobile viewport (375px) → confirm the "Learn what VisibleShelf offers →" link appears below the claim CTA and the footer "For Business Owners" link is visible.
9. Click "For Business Owners" in the footer → confirm it navigates to `/place/about`.
10. Click "See all platform capabilities" on the teaser → confirm it navigates to `/features`.

---

## 12. Verification Gates

| Gate | Verification method | Owner |
|---|---|---|
| Migration 257 applies cleanly | `doppler run --config local -- pnpm prisma db pull && pnpm prisma generate` | Backend |
| TypeScript compiles | `pnpm checkapi && pnpm checkweb` | Backend + Frontend |
| Trigger fires on new seed | Route test: outreach log exists after `POST /from-campaign/:campaignId` | Backend |
| Trigger does not fire on idempotent re-run | Route test: second call does not create a second log | Backend |
| Trigger failure does not break seed creation | Route test: mock service throws, seed still returns 200 | Backend |
| Freshness-fail → suppress wiring | Manual: log `closed_permanently`, confirm suppress button appears, click it, confirm listing gone | Frontend |
| No-response job runs | Manual: set `outreach_scheduled_at` to 15 days ago, run job, confirm state flips | Backend |
| Place page still renders during courtesy window | Manual: visit `/place/{slug}` after seed creation, confirm full narrative + claim CTA | Frontend |
| Light features teaser renders | Manual: visit `/place/about`, confirm 3 mode cards + claim CTA + link to `/features` | Frontend |
| "For Business Owners" footer link appears on place page | Manual: visit `/place/{slug}`, scroll to footer, confirm link present and navigates to `/place/about` | Frontend |
| "Learn what VisibleShelf offers" link appears below claim CTA | Manual: visit `/place/{slug}` on 375px viewport, confirm secondary link present | Frontend |
| Claimed directory_presence gets 5 SKUs | Unit test: `getSKULimit('directory_presence')` returns 5; manual: claim a seed, log in as owner, add 5 products succeeds, 6th blocked with upgrade prompt | Backend + Frontend |
| Teaser shows "List your first products" card | Manual: visit `/place/about`, confirm 4th card present with "5 products" copy | Frontend |
| Claim success screen shows "5 products" message | Manual: complete a claim flow, confirm post-claim screen mentions 5 product slots | Frontend |

---

## 13. Suggested Implementation Order

1. **Phase A0a** — Extend `ContactOutcome` + Zod enum + `CONTACT_RESULT_TO_OUTCOME` + `NO_RESPONSE_OUTCOMES` (no dependency)
2. **Phase A0b** — Extend `CallDetails` interface + Zod schema + frontend mirror (no dependency)
3. **Phase A0c** — Make `resolveClaimUrl` public (no dependency)
4. **Phase A1** — Migration 257 (schema: `outreach_state` columns + `max_skus = 5`)
5. **Phase A5** — Config additions (no dependency on schema)
6. **Phase A3** — `setOutreachState` method (depends on A1)
7. **Phase A2** — `SeedOutreachTriggerService` (depends on A0a, A0b, A0c, A1, A3)
8. **Phase A4** — Hook into `createFromCampaign` (depends on A2, A3)
9. **Phase B1** — `SeedOutreachStateSync.syncFromLog` (depends on A3)
10. **Phase B2** — Wire into outreach log route (depends on B1)
11. **Phase B3-B4** — No-response job + scheduler wiring (depends on A3)
12. **Phase C4** — Frontend service additions (depends on A1)
13. **Phase C1** — Seed detail page (depends on C4, B2)
14. **Phase C2** — Seed list page (depends on C4)
15. **Phase C3** — Audit card inline success message (depends on A4)
16. **Phase D1** — Light features teaser page + slug blacklist (no dependency — static content)
17. **Phase D2** — `PoweredByFooter` "For Business Owners" link + prop (depends on D1)
18. **Phase D3** — Place page secondary "Learn more" link (depends on D1)
19. **Phase E0** — Product route security prerequisite (no dependency — must land before E1)
20. **Phase E1** — Migration 257 tier row update (same migration as A1, gated by E0)
21. **Phase E2** — Backend `tier-limits.ts` update (depends on E1)
22. **Phase E3** — Frontend `tiers.ts` update (depends on E1)
23. **Phase E4** — Teaser "List your first products" card (depends on D1, E3)
24. **Phase E5** — Claim success screen "5 products" message (depends on E3)
25. **Verification** — Run all tests, `pnpm checkapi`, `pnpm checkweb`, manual frontend pass

---

## 14. Files Created / Modified

### Created

```
apps/api/src/services/SeedOutreachTriggerService.ts
apps/api/src/services/SeedOutreachStateSync.ts
apps/api/src/jobs/seed-outreach-no-response.ts
apps/api/src/services/__tests__/SeedOutreachTriggerService.test.ts
apps/api/src/services/__tests__/DirectoryPresenceSeedService.outreachState.test.ts
apps/api/src/services/__tests__/SeedOutreachStateSync.test.ts
apps/api/src/jobs/__tests__/seed-outreach-no-response.test.ts
database/migrations/257_seed_outreach_state.sql
apps/web/src/app/place/about/page.tsx                            (light features teaser page)
```

### Modified

```
apps/api/src/services/MarketingOutreachService.ts               (ContactOutcome + CallDetails extensions)
apps/api/src/services/HookSuggestionService.ts                  (resolveClaimUrl made public)
apps/api/src/services/MarketingAutoFollowUpScheduler.ts         (NO_RESPONSE_OUTCOMES extension)
apps/api/src/services/DirectoryPresenceSeedService.ts           (createFromCampaign hook + setOutreachState method)
apps/api/src/routes/directory-presence-admin.ts                 (GET /:id/outreach route)
apps/api/src/routes/marketing-ops.ts                            (ContactOutcome enum + CallDetails schema + syncFromLog side-effect)
apps/api/src/routes/inline-items-crud.ts                        (E0: add authenticateToken + checkTenantAccess + validateSKULimits)
apps/api/src/config/unifiedConfig.ts                            (new env vars)
apps/api/src/index.ts                                           (job wiring)
apps/api/src/utils/tier-limits.ts                               (directory_presence maxSkus 0 → 5)
apps/web/src/services/MarketingOpsService.ts                    (frontend ContactOutcome + CallDetails mirror)
apps/web/src/services/DirectoryPresenceAdminService.ts          (getSeedOutreach method)
apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/[id]/page.tsx   (outreach badge + history + actions)
apps/web/src/app/(platform)/settings/admin/directory/presence-seeds/page.tsx         (outreach filter + queue view)
apps/web/src/components/marketing-ops/BusinessAnalysisAuditCard.tsx                  (post-click inline success message)
apps/web/src/components/PoweredByFooter.tsx                                          ("For Business Owners" link + showBusinessOwnersLink prop)
apps/web/src/app/place/[slug]/layouts/PlaceEntryEditorialLayout.tsx                  (secondary "Learn more" link below claim CTA)
apps/web/src/app/tenant/[id]/page.tsx                                                (E0: fix dead storefront gate)
apps/web/src/utils/slug.ts                                                           (D1: add 'about' to slug blacklist)
apps/web/src/lib/tiers.ts                                                            (directory_presence maxSkus 0 → 5)
apps/web/src/app/directory/claim/[token]/DirectoryClaimClient.tsx                    (claim success screen "5 products" message in MODE_UNLOCK_COPY)
```

---

## 15. Open Questions

1. **Should the trigger also fire when a seed is created via `approveAndInvite` (public suggestion / owner submission path)?** Those paths already have an operator-initiated invite; an auto-trigger may be redundant. Draft: no — scope to `createFromCampaign` only.

2. **Should the no-response job auto-suppress stale seeds, or just mark them `no_response`?** Auto-suppress is safer for freshness (a 14-day-uncontacted listing may be stale) but aggressive (the listing may be fine, just uncontacted). Draft: mark `no_response` only; suppression remains a manual operator action.

3. **Should the outreach message be pre-generated (AI opener via `OutreachOpenerService.executeOpener`) or just reference the hook template?** Pre-generating makes the operator's job easier (copy-paste a ready message) but adds an LLM call to the seed creation path, which could slow the route. Draft: Phase 1 uses the hook template body (no LLM); Phase 2 can pre-generate via the opener service behind a config flag.

4. **Should `outreach_state` be an enum at the DB level or a TEXT column with app-level validation?** Draft uses TEXT (consistent with `directory_presence_seeds.status` which is also TEXT). Enum requires a migration for every new state. App-level validation in `setOutreachState` is sufficient.

5. **~~Should the courtesy window be per-seed or per-campaign?~~** **RESOLVED:** Per-seed. Each `createFromCampaign` call creates its own outreach log entry with the seed's ID in `call_details.seed_id`. Idempotency is by `seed_id` (not campaign ID). Sibling seeds each get their own outreach log and their own `outreach_state = 'outreach_scheduled'`. The campaign's outreach history shows all sibling seed outreach logs. See §6.2 for the idempotency query.

6. **Should the `freshness_failed` state auto-suppress, or require operator action?** Draft: operator action. The operator may want to update the address (relocation) or phone (disconnected) and re-verify before deciding to suppress. Auto-suppress removes operator judgment from the loop.

7. **Teaser page route: `/place/about` vs `/owners` vs `/about`?** `/place/about` keeps it nested under the place namespace (where the owner arrived). `/owners` is more memorable and brandable for outreach copy. `/about` conflicts with the existing `/directory/about` page. Draft: `/place/about` for now (closest to the discovery context); revisit if outreach copy needs a shorter URL.

8. **What happens to existing products if a claimed directory_presence tenant downgrades from a higher tier back to directory_presence?** If they had 75 products (discovery tier) and downgrade to directory_presence (5 slots), they're over-limit. Draft: allow existing products to remain (grandfathered) but block new product creation until count drops below 5. This matches the standard over-limit behavior for tier downgrades.

9. **Should `createFromCampaign` restrict campaign stage?** `createFromCampaign` does not check `campaign.stage` today. The auto-follow-up scheduler (`MarketingAutoFollowUpScheduler`) only visits campaigns in `preview_built` or `shown` stages. Seeds created from `seek` or `audit_identified` campaigns will have outreach logged but no auto-follow-up cadence. Draft: no stage restriction in `createFromCampaign` — the no-response job (which queries seeds directly, not campaigns) still works, and the operator can manually drive outreach for early-stage campaigns. Document this as a known limitation.

10. **Should the no-response job also check stale `owner_contacted` seeds?** The current job pseudocode only checks `outreach_state = 'outreach_scheduled'`. A seed where the operator logged one contact (`owner_contacted`) but then went silent is never marked `no_response`. Draft: Phase 1 only marks `outreach_scheduled` → `no_response`. Extending to stale `owner_contacted` is a future enhancement (requires defining "stale" for a contact that already happened — the last outreach log timestamp would be the reference point).

---

## 16. Future Expansion Paths

These are not in scope for this sprint but are captured here so the design awareness is not lost between sprints. Each path builds on the `outreach_state` column and the outreach log infrastructure introduced by this spec.

### 16.1 Outreach Outcome → Listing Enrichment Feedback Loop

Today the freshness-fail path ends at `freshness_failed` → operator suppresses. But the outreach outcome often carries **corrective data** that could refresh the seed rather than abandon it:

| Outreach outcome | Current terminal state | Feedback loop potential |
|---|---|---|
| `wrong_location` | `freshness_failed` → suppress | Trigger an address re-audit: re-run the business analysis audit with the new address the operator captured in `call_details.hook_response_notes` or a new structured field. If the re-audit confirms the business at the new address, update the seed's `address` + provenance and flip `outreach_state` back to `outreach_scheduled` (re-contact at new address). |
| `disconnected_number` | `freshness_failed` → suppress | Trigger a phone re-lookup: query the campaign's `directory_profiles` and audit `platforms.*.profile_url` for an alternate phone. If found, update the seed's `phone` + provenance and re-enter the outreach cycle. |
| `closed_permanently` | `freshness_failed` → suppress | Suppress is correct — no feedback loop. |
| `owner_name_confirmed` (in `call_details`) | `owner_contacted` | Write the confirmed owner name to the seed's `owner_name` field + provenance. Today this field exists but is only populated from public suggestion / owner submission paths. |

This turns outreach from a **gate** (pass/fail → publish/suppress) into a **data refresh signal** that feeds back into the seed. The seed becomes a living record that improves with each contact attempt rather than a static snapshot that either survives or gets suppressed.

**Dependency:** structured field capture in `call_details` for the corrective data (new address, alternate phone, confirmed owner name). The `CallDetails` type (`MarketingOutreachService.ts:66-85`) already has `hook_response_notes` and `owner_name_confirmed`. The `profile_quality_findings` field is added in Phase A0 (§5.6) as part of the `CallDetails` extension. The address/phone correction fields would be additional new optional keys in a future sprint.

### 16.2 Courtesy Window Analytics — Channel Attribution

Once this sprint is running at scale, the `outreach_state` column becomes the **attribution key** for comparing the two claim acquisition channels:

| Channel | `outreach_state` at time of claim | Meaning |
|---|---|---|
| **A — Invite (operator-driven)** | `freshness_verified` or `owner_contacted` | Owner was contacted by operator and claimed — the outreach caused the claim |
| **B — Search discovery (owner self-finds)** | `no_response` | Owner was never contacted (or contact failed) and claimed via search discovery — the SEO surface caused the claim |
| **Ambiguous** | `outreach_scheduled` (claimed before operator contacted) | Owner found the listing via direct link or search before outreach happened — likely Channel B but not conclusive |

This data answers the empirical question that shaped this sprint's design: **does Channel B (search-discovered claims) actually produce claims, or just traffic?** If Channel B produces traffic but near-zero claims, the courtesy window could eventually tighten (longer embargo, stronger invite-only posture). If Channel B produces a meaningful claim rate, the current design is validated and the window should stay as-is.

**Implementation:** a read-only analytics query (or `DirectoryPresenceAnalyticsService` method) that joins `directory_presence_seeds` (for `outreach_state` at claim time) with `directory_claim_tokens.consumed_at` (for claim timing). No new schema — the data is already captured by this sprint's `outreach_state` column and the existing claim token lifecycle.

**Sprint dependency:** this sprint must land and accumulate data for at least 30–60 days before the analytics are meaningful. The query itself is trivial; the value is in the data accumulation period.

### 16.3 Batch-Path Outreach (High-Volume Prospect Queue)

This sprint is scoped to `createFromCampaign` (audit-derived seeds) only. The batch path (`createSeedsFromBatch`) does not trigger outreach — volume makes per-seed outreach impractical, and batch seeds lack the campaign-audit corpus that makes the outreach message credible.

However, once the `outreach_state` column exists (Migration 257), batch seeds enter the world with `outreach_state = 'not_started'`. A future sprint could introduce a **batch outreach queue** that:

1. Filters batch seeds by `outreach_state = 'not_started'` + `is_published = true` + has a phone or email.
2. Groups them by `seed_batch` (e.g. all seeds from `indianapolis-african-grocery-2026`).
3. Generates a templated outreach message per seed (no hook library — batch seeds have no campaign archetype or audit signals).
4. Logs a `seed_outreach_scheduled` contact per seed and sets `outreach_state`.

The message quality would be lower (no audit-derived hook, no `public_narrative` to reference) but the courtesy-window principle still applies: the owner gets a heads-up before Google surfaces the listing.

**Dependency:** the `PLACE_SEED_SEO_ENRICHMENT_SPEC.md` §6.1 Phase 2 batch-create composer reuse must land first — batch seeds need at least the deterministic template description before outreach can reference "your listing on VisibleShelf" credibly. A bare listing (no description, no keywords) is a weak outreach anchor.

### 16.4 Post-Claim Outreach State Transition

When a seed is claimed, `outreach_state` should flip to `claimed` (per the state machine in §3.2). This sprint's `setOutreachState` method supports this, but the **claim flow itself** (`DirectoryClaimService.acceptClaim`) does not currently call `setOutreachState`. The claim flow flips `org_standing_mode` and `seed.status = 'claimed'` but is unaware of `outreach_state`.

A future change (small) should add a `setOutreachState(seedId, 'claimed', ctx)` call at the end of `acceptClaim`, so the outreach state machine stays consistent with the claim lifecycle. This is not in Phase 1 because the claim flow is a separate service (`DirectoryClaimService`) and the cross-service call needs its own error handling (claim success must not fail if outreach state update fails).

**Alternative:** a database trigger on `directory_presence_seeds.status = 'claimed'` that sets `outreach_state = 'claimed'`. Simpler, but bypasses the audit trail. Draft preference: application-level call with fire-and-forget error swallowing, matching the pattern in §4.3.

### 16.5 Profile-Quality Issues as Claim Invitation Justification

The business-scope audit discovers a rich set of profile-quality signals that are currently used to select the outreach hook angle (via `HookSuggestionService` + the hook library) but are **not surfaced as supporting justification** in the claim outreach message itself. During the courtesy-window call, the operator has the owner's attention — this is the moment to not only invite the claim but also frame *why* claiming matters: the audit found specific, verifiable issues with the business's public profile that claiming and repair would address.

#### Available signal corpus (already computed by the audit)

The audit's `detected_signals` array and the `signal-magnitude.ts` severity engine produce a ranked set of profile-quality findings:

| Signal prefix | Domain | Example signals | What it tells the owner |
|---|---|---|---|
| `DS_` | Directory/Profile surface | `DS_CLAIMED_STATUS`, `DS_MISSING_SERVICE_MENU`, `DS_OUTDATED_HOURS`, `DS_PHOTO_DEFICIT`, `DS_MISSING_PROFILE` | Google Business Profile is unclaimed, missing a menu, has wrong hours, or lacks photos |
| `WC_` | Website condition | `WC_MISSING_WEBSITE`, `WC_BROKEN_WEBSITE`, `WC_MISSING_SERVICE_PAGES`, `WC_MOBILE_FRICTION`, `WC_MISSING_CTA` | No website, broken website, or missing key pages |
| `RA_` | Review acquisition | `RA_LOW_REVIEW_VOLUME`, `RA_REVIEW_DROUGHT`, `RA_UNADDRESSED_POSITIVE_BACKLOG`, `RA_UNANSWERED_COMPLAINTS` | Few reviews, unanswered positive or negative reviews |
| `CP_` | Contact/NAP consistency | `CP_NAP_NAME_DRIFT`, `CP_NAP_ADDRESS_DRIFT`, `CP_NAP_PHONE_DRIFT`, `CP_MISSING_CONTACT_INFO` | Business name/address/phone inconsistent across platforms |
| `VP_` | Visual/photo presence | `VP_MISSING_PROJECT_PHOTOS`, `VP_STALE_SOCIAL_ACTIVITY` | No storefront/project photos, stale social media |
| `EF_` | Existence/footprint | `EF_ZERO_INDEXED_PRESENCE`, `DS_ZERO_INDEXED_PRESENCE` | No discoverable online presence at all |

Each signal carries a **severity tier** (`crisis > material > cosmetic > borderline` via `signal-magnitude.ts`) — so the justification can be calibrated to the actual severity, not a generic "we found issues."

#### How this strengthens the claim invitation

Today the outreach message leads with a hook angle (e.g. "I noticed your Google Business Profile hours may be outdated"). Adding the **full profile-quality finding set** as supporting context transforms the call from a single-issue pitch into a **claim + repair invitation**:

> "I noticed your Google Business Profile hours may be outdated. While reviewing your business's public presence, we also found [N] other items that claiming your listing would let you address:
> - Your Google Business Profile is not verified/claimed
> - No service menu or product photos are listed
> - Your business address is inconsistent across 3 platforms
> - You have [N] unanswered positive reviews from the last 6 months
>
> Claiming your VisibleShelf listing is free and lets you start addressing these. I can walk you through it."

This frames the claim not as "claim a directory listing" (low perceived value) but as "take control of your public profile and fix the issues we found" (high perceived value). The audit already did the diagnostic work; the outreach call is the moment to deliver the findings.

#### Implementation path

| Component | Change | Dependency |
|---|---|---|
| `SeedOutreachTriggerService.onSeedCreated` | After resolving the top hook, also load the audit's `detected_signals` + compute severity via `signal-magnitude.ts`. Include a `profile_quality_findings` summary in the `messageSnapshot` and `call_details`. | This sprint (Phase A) |
| `CallScriptService.assembleForCampaign` | Add a "Profile Findings" section to the call script (after the hook, before the ask) that lists the top 3-5 signals by severity with plain-language descriptions. | Future sprint (extends the call script anatomy) |
| `HookSuggestionService.suggestForCampaign` | Expose the ranked signal list (already computed internally) in the suggestion response so the frontend can render a "findings preview" on the outreach panel. | Future sprint |
| Operator outreach panel (frontend) | Show a "Profile Quality Findings" card alongside the outreach message: severity-ranked list of signals with plain-language labels, each linked to the repair action it implies (claim → fix hours, claim → add photos, claim → verify GBP). | Future sprint |
| Post-claim repair routing | When the owner claims, the `profile_quality_findings` from the outreach log carry forward into the claim success screen as a "recommended next steps" checklist — turning the findings from a sales pitch into an onboarding task list. | Future sprint (depends on `DirectoryClaimService.acceptClaim` + the claim success screen) |

#### Phase 1 scope vs. future

**In this sprint (Phase 1):** `SeedOutreachTriggerService` includes the `detected_signals` + severity summary in the `messageSnapshot` and `call_details.profile_quality_findings` JSON. The operator can read the findings in the outreach log detail. No frontend rendering of the findings card yet.

**Future sprint:** the call script anatomy gains a "Profile Findings" section; the operator outreach panel renders a severity-ranked findings card; the claim success screen carries the findings forward as a repair checklist. This is a natural follow-on sprint that builds on the `outreach_state` + outreach log infrastructure introduced here.

#### Guardrail

The profile-quality findings are **Tier C internal assessment content** per the SEO enrichment spec (`PLACE_SEED_SEO_ENRICHMENT_SPEC.md` §3). They must never appear on the **public** place page or in the listing's `description` / `keywords` / JSON-LD. They are operator-facing outreach collateral only — used in the call/email/message the operator delivers to the owner, and in the operator's outreach log. The `call_details.profile_quality_findings` JSON is stored in `mkt_outreach_log` (operator-internal), not in `directory_listings_list` (public). This boundary is the same one the hook library already respects: signals drive hook selection (operator-facing) but never reach the public seed surface.
