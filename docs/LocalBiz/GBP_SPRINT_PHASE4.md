# GBP Authorized Management Suite — Sprint Plan: Phase 4

**Spec:** `docs/LocalBiz/GBP_AUTHORIZED_MANAGEMENT_SUITE_SPEC.md`
**Scope:** Phase 4 — Prospect-to-Tenant Conversion Engine (Capability Registration + BSaaS + Public Surface Surfacing)
**Prerequisite:** Phase 2 + Phase 3 complete (review ingestion, reply engine, post scheduler, media upload all functional)
**Status:** Planning

---

## Sprint Goal

Deliver the **monetization + public surfacing layer** that turns the GBP Management Suite from a free portal feature into a monetized capability module with BSaaS app-store purchases, and surfaces GBP content (reviews, posts, photos) on public directory/place surfaces.

Phase 4 produces:
1. `gbp_management` capability module registered with 4 feature keys
2. 5 BSaaS catalog entries (individual features + flexible bundle)
3. Merchant gate toggles (`gbp_reviews_display`, `gbp_content_display`)
4. In-portal upgrade funnels (review velocity, post expiration, POS upsell)
5. 3 public surface endpoints (reviews, posts, photos)
6. 3 surface-agnostic GBP components (`GbpReviewsSection`, `GbpPostsSection`, `GbpPhotoGallerySection`)
7. Directory + place page integration (initial consumers)
8. POS connection CTA + GMC sync CTA (wire existing tenant-side functionality)

---

## Pre-Flight Checklist

### Skills to read (CRITICAL — Phase 4 is capability-heavy)
| Skill | Why |
|---|---|
| `capability-deployment-flow.md` | 8-phase capability deployment pipeline — this is the core skill for Phase 4 |
| `capability-data-flow-rules.md` | R33 (tier vs merchant gate boundary), R23 (flexible prefix), canonical resolver pattern |
| `three-tier-feature-gating.md` | Three-tier economy (flexible/explicit/BSaaS) + Shared Control Model |
| `add-capability-feature.md` | Step-by-step feature key registration + merchant gate storage |
| `add-bsaas-feature.md` | BSaaS catalog entry creation |
| `bsaas-purchase-flow.md` | Purchase flow + entitlement activation |
| `verify-capability-deployment.md` | Post-deployment verification |
| `link-features-to-capability-type.md` | Linking features to capability type |
| `directory-presence-seed-claim.md` | Public surface resolution (slug → tenant) |

### Phase 2+3 handoff verification
- [ ] `gbpReviewIngestion.ts` running hourly, `gbp_reviews` populated
- [ ] `gbp_posts` has `status`, `scheduled_for`, `published_at` columns populated
- [ ] `gbp_media` has `location_id` populated
- [ ] `cached_average_rating` + `cached_review_count` on `gbp_locations_list` refreshed by ingestion
- [ ] `GBPReviewReplyService.generateDrafts` works (Tier A)
- [ ] `gbpPostScheduler.ts` running, posts publish
- [ ] `uploadPhotoBinary` works (binary media upload)

---

## Task Breakdown

### Task 1: Register `gbp_management` Capability Module + Feature Keys
**Spec ref:** §6.1–6.5 + `capability-deployment-flow.md` 8-phase pipeline

**Capability type:**
```sql
-- Insert capability type
INSERT INTO capability_type_list (key, display_name, is_active)
VALUES ('gbp_management', 'GBP Management', true)
ON CONFLICT (key) DO NOTHING;
```

**Feature keys (4):**
| Feature Key | Description |
|---|---|
| `gbp_ai_response` | AI review response (Tier A drafts + Tier B autopilot) |
| `gbp_posts_scheduler` | Scheduled post queue + lifecycle |
| `gbp_directory_reviews` | Surface GBP reviews on public surfaces (Subsystem 6) |
| `gbp_directory_content` | Surface GBP posts + photos on public surfaces (Subsystem 7) |

**SQL (per `add-capability-feature.md` steps 1–2):**
```sql
-- Step 1: Insert feature keys
INSERT INTO features_list (feature_key, description, is_active) VALUES
  ('gbp_ai_response', 'AI review response (Tier A + Tier B)', true),
  ('gbp_posts_scheduler', 'Scheduled post queue + lifecycle', true),
  ('gbp_directory_reviews', 'Surface GBP reviews on public surfaces', true),
  ('gbp_directory_content', 'Surface GBP posts + photos on public surfaces', true)
ON CONFLICT (feature_key) DO NOTHING;

-- Step 2: Link features to capability type
INSERT INTO capability_features_list (capability_type_id, feature_id, is_active)
SELECT ct.id, f.id, true
FROM capability_type_list ct, features_list f
WHERE ct.key = 'gbp_management'
  AND f.feature_key IN ('gbp_ai_response', 'gbp_posts_scheduler', 'gbp_directory_reviews', 'gbp_directory_content')
ON CONFLICT DO NOTHING;
```

**Migration file:** `database/migrations/NNN_gbp_management_capability.sql`

---

### Task 2: Tier Assignments + BSaaS Catalog Entries
**Spec ref:** §6.3 + `three-tier-feature-gating.md` + `add-bsaas-feature.md`

**Tier assignment (flexible key for Full Retail Visibility Tenant):**
```sql
-- Assign gbp_management_flexible to the full retail visibility tier
-- (flexible key auto-unlocks all features in the module via resolver)
INSERT INTO tier_features_list (tier_id, feature_key, is_enabled)
SELECT id, 'gbp_management_flexible', true
FROM subscription_tiers_list
WHERE tier_key = '<full_retail_visibility_tier_key>'
ON CONFLICT DO NOTHING;
```

**BSaaS catalog entries (5 SKUs):**
| Feature Key | Marketing Name | Billing | Trial |
|---|---|---|---|
| `gbp_ai_response` | GBP AI Review Response | monthly | 14 days |
| `gbp_posts_scheduler` | GBP Post Scheduler | monthly | 14 days |
| `gbp_directory_reviews` | GBP Reviews on Directory | monthly | 14 days |
| `gbp_directory_content` | GBP Posts + Photos on Directory | monthly | 14 days |
| `gbp_management_flexible` | GBP Pro (Complete) | monthly | 14 days |

**Created via:** `/settings/admin/bsaas-catalog` "Add Catalog Entry" modal (existing admin UI — no new infrastructure)

**Per `three-tier-feature-gating.md`:** the resolver is source-agnostic. It merges tier features + BSaaS purchases into one `mergedFeatures` map. No route changes needed — the existing `EffectiveCapabilityResolver` handles it.

---

### Task 3: Merchant Gate Toggles
**Spec ref:** §6.8 + `add-capability-feature.md` §3 + `capability-data-flow-rules.md` R33

**Per the canonical two-gate model:**
- **Hard gate:** `features.gbp_directory_reviews` / `features.gbp_directory_content` (tier/purchase/grant)
- **Soft gate (merchant gate):** `merchantPreferences.gbp_reviews_display` / `merchantPreferences.gbp_content_display`

**Storage:** merchant gate columns go in the appropriate `tenant_*_options_settings` table. Per `add-capability-feature.md` §3, each capability domain has a dedicated settings table. For GBP Management, this is likely a new `tenant_gbp_options_settings` table (or columns added to an existing directory/settings table — verify at implementation time).

**Migration:**
```sql
CREATE TABLE IF NOT EXISTS tenant_gbp_options_settings (
  tenant_id VARCHAR PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  gbp_reviews_display BOOLEAN DEFAULT true,
  gbp_content_display BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Backfill: existing tenants get default true
INSERT INTO tenant_gbp_options_settings (tenant_id)
SELECT id FROM tenants
WHERE id NOT IN (SELECT tenant_id FROM tenant_gbp_options_settings)
ON CONFLICT DO NOTHING;
```

**Resolver (per `capability-data-flow-rules.md` canonical pattern):**
```ts
// apps/api/src/services/resolvers/GbpManagementResolver.ts
export function resolveGbpManagementState(
  features: Record<string, boolean>,
  merchantPrefs?: { gbp_reviews_display?: boolean; gbp_content_display?: boolean } | null
): GbpManagementState {
  const flexible = !!features.gbp_management_flexible;

  // Hard gate (R33: tier-level fields, never gated by merchant prefs)
  const canShowReviews = flexible || !!features.gbp_directory_reviews;
  const canShowContent = flexible || !!features.gbp_directory_content;

  // Soft gate (merchant-gated fields: tier AND merchant)
  const reviewsDisplayEnabled = merchantPrefs?.gbp_reviews_display !== false;
  const contentDisplayEnabled = merchantPrefs?.gbp_content_display !== false;

  // Effective state
  const reviewsEnabled = canShowReviews && reviewsDisplayEnabled;
  const contentEnabled = canShowContent && contentDisplayEnabled;

  return {
    enabled: canShowReviews || canShowContent,
    isFlexible: flexible,
    canShowReviews,
    canShowContent,
    reviewsEnabled,
    contentEnabled,
    merchantPreferences: merchantPrefs ?? null,
    features: {},
  };
}
```

**Wire into orchestrator:** `EffectiveCapabilityResolver.ts` — pass `merchantBundle.gbpManagement` to the resolver.

**Settings route:** `apps/api/src/routes/gbp-options-settings.ts` — GET (returns tierState + settings) + PUT (updates merchant prefs, calls `invalidateEffectiveCapabilities(tenantId)`).

**Frontend mapping:** `UnifiedCapabilityService.ts` — `mapGbpManagement()` maps snake_case → camelCase.

**Dashboard widget:** `PlanSummaryWidget.tsx` — add `gbp_management` to `CAPABILITY_META` array.

---

### Task 4: In-Portal Upgrade Funnels
**Spec ref:** §5.1 + `bsaas-purchase-flow.md`

**Trigger points (existing surfaces, add upgrade CTAs):**
1. **Review velocity alert** — when `gbp_new_review` alert fires and merchant doesn't have `gbp_ai_response`: "Upgrade to GBP Pro for AI-powered review responses"
2. **Post expiration** — when a published post is older than 7 days and merchant doesn't have `gbp_posts_scheduler`: "Upgrade to schedule posts in advance"
3. **POS upsell** — on the GBP dashboard, if tenant doesn't have POS integration: "Connect Square/Clover for inventory sync"

**Pattern:** each CTA links to the BSaaS checkout flow (`/checkout` or the feature store) with the specific `feature_key` pre-selected.

---

### Task 5: Public Surface Endpoints
**File:** `apps/api/src/routes/directory-gbp-public.ts` (new)
**Spec ref:** §8.2

**Registration in `routeRegistry.ts`:**
```ts
import directoryGbpPublicRoutes from '../routes/directory-gbp-public';
// ...
{
  path: '/api/public/directory',
  router: directoryGbpPublicRoutes,
  domain: 'public',
  authLevel: 'public',
  comment: 'Public GBP content surfacing — reviews, posts, photos (Subsystems 6+7)',
},
```

**3 endpoints (all surface-agnostic, all two-gate checked):**

| Method | Route | Data source | Gate |
|---|---|---|---|
| `GET` | `/:slug/gbp-reviews` | `gbp_reviews` + `cached_average_rating` | `gbp_directory_reviews` hard + `gbp_reviews_display` soft |
| `GET` | `/:slug/gbp-posts` | `gbp_posts` (`status = 'PUBLISHED'`) | `gbp_directory_content` hard + `gbp_content_display` soft |
| `GET` | `/:slug/gbp-photos` | `gbp_media` (`is_active = true`) | `gbp_directory_content` hard + `gbp_content_display` soft |

**Resolution flow (all endpoints):**
1. Resolve slug → tenant (via existing directory slug resolution)
2. Check hard gate: `features.gbp_directory_reviews` (or `gbp_directory_content`) on the resolved tenant
3. Check soft gate: `merchantPreferences.gbp_reviews_display !== false` (or `gbp_content_display`)
4. If either gate fails: return `{ success: true, data: { enabled: false } }`
5. If both pass: return the data (reviews/posts/photos)

**Public fields only (no internal management fields):**
- Reviews: `reviewer_name`, `star_rating`, `comment`, `review_reply`, `google_create_time` (NO `sentiment`, `reply_status`, `ai_drafts`)
- Posts: `topic_type`, `summary`, `media_url`, `call_to_action_type`, `call_to_action_url`, `event_*`, `offer_*`, `google_create_time` (NO `status`, `scheduled_for`, `post_name`)
- Photos: `category`, `source_url`/`google_url`, `description` (NO `view_count`)

---

### Task 6: Surface-Agnostic GBP Components
**Files (all under `apps/web/src/components/gbp/` — surface-agnostic):**
- `GbpReviewsSection.tsx` — aggregate rating badge + review list with replies + "Reviewed on Google" badges
- `GbpPostsSection.tsx` — post cards by type (offer → coupon card, event → event card, standard → text+image) + "Posted on Google" badges
- `GbpPhotoGallerySection.tsx` — category-grouped gallery + "Photos from Google" badge

**Component contract:**
```tsx
interface GbpSectionProps {
  slug: string;  // tenant slug — component fetches from public endpoint
}
```

**Each component:**
1. Fetches from the public endpoint (`/api/public/directory/:slug/gbp-*`)
2. If response is `{ enabled: false }` → renders nothing (silent no-op)
3. If response has data → renders with Google attribution badges

---

### Task 7: Directory + Place Page Integration
**Files (modify existing pages):**
- `apps/web/src/app/directory/[slug]/page.tsx` — mount all 3 GBP components
- `apps/web/src/app/place/[slug]/page.tsx` — mount all 3 GBP components

**Integration pattern:**
```tsx
// In the directory/place page layout, after existing sections:
<GbpReviewsSection slug={slug} />
<GbpPostsSection slug={slug} />
<GbpPhotoGallerySection slug={slug} />
```

**Each component self-gates** — if the tenant doesn't have the capability or the merchant toggle is off, the component renders nothing. No page-level conditional needed.

**Future consumers (post-Phase 4, no component changes):**
- `/shops/[slug]`, `/shops/directory`, `/shops/trending`, `/shops/featured`
- `/category-discovery`
- Just mount + pass slug

---

### Task 8: POS + GMC CTAs (Wire Existing)
**Spec ref:** §9 Phase 4

**POS connection (Square/Clover):**
- EXISTS tenant-side — `integration_options` capability already handles POS
- Phase 4: add a CTA card on the GBP dashboard that links to the existing POS connection flow
- No new backend work — just frontend CTA wiring

**GMC sync:**
- EXISTS — `GMCProductSync.ts` handles product/inventory/price sync
- Phase 4: add a CTA card on the GBP dashboard that links to GMC settings
- No new backend work — just frontend CTA wiring

---

### Task 9: Verification
**Per `verify-capability-deployment.md`:**

```bash
# Verify capability type registered
curl -s "http://localhost:3001/api/public/tenants/<tenantId>/effective-capabilities" \
  | jq '.data.gbpManagement'

# Verify BSaaS catalog entries
curl -s "http://localhost:3001/api/public/bsaas-catalog" \
  | jq '.data[] | select(.feature_key | startswith("gbp_"))'

# Verify public endpoint
curl -s "http://localhost:3001/api/public/directory/<slug>/gbp-reviews" \
  | jq '.data'

# Verify merchant gate toggle
# (via tenant settings PUT — toggle gbp_reviews_display to false, then verify endpoint returns enabled: false)
```

---

### Task 10: Unit Tests
**File:** `apps/api/src/services/__tests__/GbpManagementResolver.test.ts`
**Test cases:**
1. Flexible tier → all features enabled (hard gate passes)
2. Non-flexible tier without purchase → all features disabled (hard gate fails)
3. Non-flexible tier with BSaaS purchase → purchased feature enabled (hard gate passes)
4. Merchant toggle off → effective state false (soft gate fails, hard gate passes)
5. Merchant toggle on (default) → effective state true (both gates pass)
6. R33 boundary: `canShowReviews` (tier-level) is NOT gated by merchant prefs
7. Cache invalidation: PUT on settings triggers `invalidateEffectiveCapabilities`

**File:** `apps/api/src/tests/directory-gbp-public-routes.test.ts`
**Test cases:**
8. `GET /:slug/gbp-reviews` — tenant with capability + merchant toggle on → 200 with reviews
9. `GET /:slug/gbp-reviews` — tenant without capability → 200 with `enabled: false`
10. `GET /:slug/gbp-reviews` — tenant with capability but merchant toggle off → 200 with `enabled: false`
11. `GET /:slug/gbp-posts` — same 3 scenarios
12. `GET /:slug/gbp-photos` — same 3 scenarios
13. Public fields only — no `sentiment`, `reply_status`, `ai_drafts`, `status`, `scheduled_for` in response
14. Slug not found → 404

---

## Task Dependency Graph

```
Task 1 (capability module + features) ── Task 2 (tier + BSaaS) ── Task 3 (merchant gate + resolver)
                                                                        │
Task 5 (public endpoints) ─────────────────────────────────────────────┤
                                                                        │
Task 6 (GBP components) ───────────────────────────────────────────────┤
                                                                        │
Task 7 (directory + place integration) ────────────────────────────────┤
                                                                        │
Task 4 (upgrade funnels) ──────────────────────────────────────────────┤
Task 8 (POS + GMC CTAs) ───────────────────────────────────────────────┤
                                                                        │
Task 9 (verification) ─────────────────────────────────────────────────┤
Task 10 (tests) ───────────────────────────────────────────────────────┘
```

**Critical path:** Task 1 → Task 2 → Task 3 → Task 5 → Task 6 → Task 7 → Task 10

---

## Verification Gates

| Gate | Must pass |
|---|---|
| Capability type `gbp_management` registered | `capability_type_list` row exists |
| 4 feature keys registered | `features_list` rows exist + linked via `capability_features_list` |
| Flexible tier assignment | Full Retail Visibility Tenant has `gbp_management_flexible` |
| 5 BSaaS catalog entries | Visible in `/settings/admin/bsaas-catalog` |
| Merchant gate resolver | R33 boundary holds — tier-level fields not gated by merchant prefs |
| Merchant gate toggle | PUT on settings → `invalidateEffectiveCapabilities` → public endpoint reflects change |
| Public endpoints | 3 endpoints return data when both gates pass, `enabled: false` when either fails |
| Public fields only | No internal management fields in public response |
| GBP components self-gate | Render nothing when `enabled: false` |
| Directory + place integration | GBP sections appear on pages for entitled tenants, absent for non-entitled |
| Upgrade funnels | CTAs appear for unentitled merchants, link to BSaaS checkout |
| `pnpm checkapi` + `pnpm checkweb` | Zero new errors |
| Resolver tests | All 7 tests pass |
| Public route tests | All 7 tests pass |
| `verify-capability-deployment.md` checklist | All items pass |

---

## Files Created

| File | Task |
|---|---|
| `database/migrations/NNN_gbp_management_capability.sql` | 1 |
| `database/migrations/NNN_tenant_gbp_options_settings.sql` | 3 |
| `apps/api/src/services/resolvers/GbpManagementResolver.ts` | 3 |
| `apps/api/src/routes/gbp-options-settings.ts` | 3 |
| `apps/api/src/routes/directory-gbp-public.ts` | 5 |
| `apps/web/src/components/gbp/GbpReviewsSection.tsx` | 6 |
| `apps/web/src/components/gbp/GbpPostsSection.tsx` | 6 |
| `apps/web/src/components/gbp/GbpPhotoGallerySection.tsx` | 6 |
| `apps/api/src/services/__tests__/GbpManagementResolver.test.ts` | 10 |
| `apps/api/src/tests/directory-gbp-public-routes.test.ts` | 10 |

## Files Modified

| File | Change | Task |
|---|---|---|
| `apps/api/src/services/EffectiveCapabilityResolver.ts` | Wire `GbpManagementResolver` + pass merchant bundle | 3 |
| `apps/api/src/routes/routeRegistry.ts` | Register `directory-gbp-public.ts` + `gbp-options-settings.ts` | 5, 3 |
| `apps/web/src/services/UnifiedCapabilityService.ts` | Add `mapGbpManagement()` | 3 |
| `apps/web/src/services/CapabilityResolutionService.ts` | Add `GbpManagementState` type | 3 |
| `apps/web/src/components/dashboard/PlanSummaryWidget.tsx` | Add `gbp_management` to `CAPABILITY_META` | 3 |
| `apps/web/src/app/directory/[slug]/page.tsx` | Mount 3 GBP components | 7 |
| `apps/web/src/app/place/[slug]/page.tsx` | Mount 3 GBP components | 7 |
| `apps/web/src/app/account/marketing/gbp/page.tsx` | Add upgrade funnels + POS/GMC CTAs | 4, 8 |

---

## Out of Scope

- Tier B autopilot (Phase 2.5 — independent timeline, gated on Tier A production validation)
- Multi-location portal UX (post-v1)
- Future surface consumers (`/shops/*`, `/category-discovery`) — no component changes needed, just mount
- Per-surface merchant gate toggles (post-v1 — current model is tenant-scoped toggle, all surfaces)
- Module bundles in BSaaS (future — individual + flexible SKUs only in v1)
